# OpenClaw 9.1 Session Transcript 存储逻辑详解（对比 5.28）

> 分析对象：
> - `openclaw-0901` = OpenClaw **2026.9.1**（`package.json` `version: 2026.9.1`，agent schema v19 / state schema v15）
> - `openclaw-0528` = OpenClaw **2026.5.28**（`package.json` `version: 2026.5.28`，无 agent SQLite）
>
> 除源码外，交叉核对：官方文档（docs.openclaw.ai 的 `reference/database-schemas/agent-schema-history`、`cli/doctor/sqlite-maintenance`、`reference/session-management-compaction`）、`docs/refactor/database-first.md`、flip commit `0a8e360`（"refactor: flip sessions and transcripts to sqlite storage (#98236)"）、以及本地 `CHANGELOG.md` 条目。
>
> 文中 `0901:…` / `0528:…` 分别指上述两个 checkout 内的仓库相对路径。

---

## 0. 结论速览（TL;DR）

| | 2026.5.28 | 2026.9.1 |
|---|---|---|
| 转录载体 | 每 session 一个 **JSONL 文件** `agents/<id>/sessions/<sessionId>.jsonl` | **每 agent 一个 SQLite** `agents/<id>/agent/openclaw-agent.sqlite` 里的多张表 |
| 会话索引 | 单文件 `sessions.json`（全量 JSON，原子重写） | `session_nodes`（canonical 记录）+ `session_windows`（会话窗口/一代 generation）+ 投影列 |
| 顺序 | 文件追加序；`seq` 读时派生 | `transcript_events(session_id, seq)` 主键，`MAX(seq)+1` |
| 搜索 | 无 FTS（只有内存索引 + 线性扫描） | FTS5 `session_transcript_fts` + `sessions.search` gateway 方法 |
| 归档 | 文件改名 `.reset.<ts>` / `.deleted.<ts>` | DB blob（zstd）+ 编号发布成文件，`published_at` 崩溃恢复 |
| 锁 | `.jsonl.lock` 文件锁 + 每路径 FIFO | 进程内写队列 + `BEGIN IMMEDIATE` + writer fence / read fence |
| 迁移 | —（JSONL 就是运行时状态） | `openclaw doctor --session-sqlite` 一次性导入；**gateway 发现 legacy 直接拒绝 readiness** |

**这不是一次"换了保存位置"的小改动，而是一次存储模型替换**：顺序模型、身份（session 窗口/一代 generation）模型、读路径、搜索、归档、驱逐、并发控制、幂等、升级/降级策略全部随之改变。

时间线（web + 本地证据）：

1. v2026.5.28（本对比基线）：`src/config/sessions/*` 是 JSON/JSONL 世界，`src/state/` 目录尚不存在（0528 树无 agent DB）。
2. flip：commit `0a8e360` "refactor: flip sessions and transcripts to sqlite storage (#98236)"；官方 `agent-schema-history` 文档记载 "Sessions and transcripts moved into SQLite (#98236)" 对应 **agent schema v4**，首发 **v2026.8.1**（中间版本 2/4/5–6/7 为开发期形态，随 schema 8 在 2026.7.2-beta.1 首次落地）。
3. flip 之后 PR #113071 重构 per-agent schema：`session_entries`/`session_routes`/`sessions` → `session_nodes`/`session_windows`/`transcript_rewrite_watermarks`（schema v14；本机 9.1 为 **v19**）。
4. 9.1 的现实：JSONL 只作为 doctor 迁移输入和归档产物存在，运行时零 JSONL。

源码内注释同样明确（`0901:src/config/sessions/session-accessor.sqlite-scope.ts` 系列 + `docs/refactor/database-first.md`）：
- "Runtime never writes or reads session or transcript JSONL as active state."
- "Legacy `sessions.json`, transcript JSONL, `.jsonl.lock` … belong only to the doctor migration/import path."

---

## 1. 9.1 的物理布局

| 数据 | 位置（默认 `~/.openclaw`，`OPENCLAW_STATE_DIR` 可覆盖） |
|---|---|
| 会话行 + 转录行 + 投影 + FTS + 归档 + trajectory | `agents/<agentId>/agent/openclaw-agent.sqlite` |
| 归档**文件**（published） | `agents/<agentId>/sessions/<sessionId>.jsonl.<reason>.<ts>[.<gen>][.zst]` |
| legacy 迁移输入 | `agents/<agentId>/sessions/sessions.json`、`*.jsonl` |
| 迁移归档（导入成功后移走，不计磁盘预算） | `agents/<agentId>/session-sqlite-import-archive/` |
| 迁移运行清单 | `~/.openclaw/session-sqlite-migration-runs/<runId>.json` |
| 全局/共享库（registry、meeting transcripts 等） | `state/openclaw.sqlite` |

依据：`0901:docs/reference/session-management-compaction.md:25-41`、`0901:src/config/sessions/session-accessor.sqlite-scope.ts:297-306`、`0901:src/commands/doctor-session-sqlite.ts:1575`、`0901:src/commands/doctor-session-sqlite-migration-run.ts:195-221`。

> 注意：`openclaw transcripts` CLI **不是**会话转录，是会议纪要（Google Meet/Teams/Zoom）检查器（`0901:src/cli/program/register.transcripts.ts:1-185`）。会话转录没有 JSONL 导出 CLI；`sessions/` 下唯一的 JSONL 是生命周期归档与 doctor 的 `.bak` 备份。

---

## 2. SQLite 表结构（转录相关）

Schema 权威来源：`0901:src/state/openclaw-agent-schema.sql`（776 行），由 `0901:src/state/openclaw-agent-schema.ts` 在构建期从 `.sql` 文件读入；Kysely 生成类型见 `0901:src/state/openclaw-agent-db.generated.d.ts`。所有表均为 `STRICT`，外键统一级联删除。

### 2.1 会话身份两层模型

**`session_nodes`**（`openclaw-agent-schema.sql:15-47`）— 一个 **session_key** 一行，是逻辑会话的 canonical 记录：

- `session_key`（PK）、`current_session_id`、`entry_json`（canonical 会话记录 blob）、`entry_valid`（-1/0/1，触发器在 entry/identity 更新时置 0，等待投影）
- 索引投影列（只由唯一写入点写）：`status`、`created_at`、`created_via`（operator/spawn/channel/cron/talk/run/plugin/internal）、`created_actor_*`、`owner_actor_*`、`project_id`、`parent_session_key`、`spawned_by`、`fork_source_*`、`label`、`display_name`、`category`、`icon`、`pinned_at`、`archived_at`、`last_read_at`、`last_interaction_at`、`last_activity_at`
- 索引：`updated_at`、`last_interaction_at`、`parent_session_key`、`spawned_by`、`status`(partial)、`archived_at`(partial)、`current_session_id`、`entry_valid=0`(partial)

**`session_windows`**（`:112-155`）— 一个 **session_id** 一行，是这一代（generation）转录的归属根：

- `session_id`（PK）、`session_key`、`previous_session_id`、`reason` ∈ `initial|reset|rollover|fork|rewind|switch|recovery|compaction`、`session_scope`（conversation/shared-main/group/channel）
- **`transcript_updated_at` / `transcript_observed_at`**：物理转录突变水位（reconcile worker 的 staleness key）
- 其余与 5.28 会话条目对应的字段：`status`、`started_at/ended_at`、`chat_type`、`channel`、`account_id`、`primary_conversation_id`、`model_provider`、`model`、`agent_harness_id`、`parent_session_key`、`spawned_by`、`display_name`、`acp_owned`、`plugin_owner_id`、`session_entry_provenance`、`hook_external_content_source`
- FK：`session_key → session_nodes ON DELETE CASCADE`；`primary_conversation_id → conversations ON DELETE SET NULL`

设计注释（`openclaw-agent-schema.sql:1-3`）："`session_nodes.entry_json` is the canonical logical-session record. Promoted `session_nodes` columns are query indexes projected only by the session entry writer; `session_windows` and their children own transcript generations."

> **术语说明（重要）**：源码里描述"同一个 session_key 下由 reset/rollover/fork/rewind 产生的不同 session_id"时用的词是 **generation**（见上引注释、`transcript_rewrite_watermarks.generation` 列、`session_transcript_archives.generation` 列；PR #113071："generation-scoped transcript state stays keyed by `session_id`"）。它不是 session 的译名。本文统一说法：**一张 `session_windows` 行 = 一个"会话窗口"，也就是一代 generation 的转录归属根**；不再使用"世代"这种歧义词。

### 2.2 转录主表与身份表

**`transcript_events`**（`:389-396`）— 转录正文，一行一个事件：

```sql
CREATE TABLE IF NOT EXISTS transcript_events (
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  event_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, seq),
  FOREIGN KEY (session_id) REFERENCES "session_windows"(session_id) ON DELETE CASCADE
) STRICT;
```

- `event_json` 是**脱敏后**的完整事件（`{type:"message", id, parentId, timestamp, message}`、`compaction`、`reset`、`leaf` 等）。
- `seq` 从 0 起、连续、按 `session_id` 独立计数：`readNextTranscriptSeq` = `MAX(seq)+1`（`0901:src/config/sessions/session-accessor.sqlite-transcript-state.ts:205-217`），在写事务内读取，批次内内存自增（`0901:src/config/sessions/session-accessor.sqlite-transcript-store.ts:158-161`）。

**`transcript_event_identities`**（`:459-483`）— 事件身份/去重/树边：

- `(session_id, event_id)` PK；列 `seq`、`event_type`、`parent_id`、`message_idempotency_key`、`created_at`
- `UNIQUE INDEX (session_id, message_idempotency_key) WHERE message_idempotency_key IS NOT NULL` — **DB 级幂等**，替代 5.28 的反向尾扫
- 索引覆盖父链接（`parent_id`）、序列（`session_id, event_type, seq DESC`）

**`transcript_rewrite_watermarks`**（`:425-431`）— 每 `session_id` 一个 `generation`（32-hex UUID）。纯 append 只物化不轮换（`onConflict doNothing`）；replace/rewrite/doctor 文本修复会**轮换** generation（`0901:src/config/sessions/session-accessor.sqlite-transcript-state.ts:43-76`）。它是 cursor/fence 的令牌（`0901:src/config/sessions/session-transcript-read-fence.ts:80-111`）。

### 2.3 投影与搜索表（derived cache）

**`session_transcript_active_events`**（`:673-698`）— "可见分支"物化：

- `(session_id, active_position)` PK；`event_seq`、`message_position`（客户端可见消息序号，NULL 表示非消息事件）、`context_eligible`（压缩上下文资格，NULL=待分类）
- `UNIQUE(session_id, event_seq)`、`UNIQUE(session_id, message_position) WHERE NOT NULL`、partial index on `context_eligible IS NULL`

**`session_transcript_index_state`**（`:662-671`）— 每 session 的索引健康度：`indexed_seq`、`leaf_event_id`、`needs_rebuild`、`active_event_count`、`active_message_count`、`updated_at`。

**`session_transcript_fts`**（`:694-702`）— FTS5 虚拟表 + 5 张 shadow 表：

```sql
CREATE VIRUAL TABLE IF NOT EXISTS session_transcript_fts USING fts5(
  text, session_id UNINDEXED, message_id UNINDEXED, role UNINDEXED, timestamp UNINDEXED,
  tokenize = 'unicode61 remove-diacritics 2');
```

只对 user/assistant 文本建索引（`0901:src/config/sessions/session-transcript-projection-rebuild.ts:71-134`）。

**`session_transcript_archives`**（`:400-423`）— 冷归档（删除/reset 时被回收的那一代 generation）：

- `(session_id, generation)` PK；`session_key`、`reason`（deleted/reset）、`encoding`（identity/zstd）、`archive_blob BLOB`、`archive_sha256`（64 hex CHECK）、`archive_name`（UNIQUE，禁止 `/`/`\`）、`created_at`、`published_at`、`publish_attempts`、`last_publish_attempt_at`、`last_publish_error`
- partial index `WHERE published_at IS NULL`（待发布）+ retention index
- schema 注释："Canonical cold-tier owner for reclaimed transcript generations. The derived .deleted/.reset file may be recreated from this row after a crash."

### 2.4 其它相关表

- **`session_pending_inputs`**（`:757-774`）：**已受理但尚未归属执行的输入**。"Accepted input stays outside the active transcript until its exact turn owns execution." 列：`input_id`、`session_key`、`session_id`、`idempotency_key`、`run_id`、`request_hash`、`message_json`、`lifecycle_generation`、`state`（queued/interrupted/cancelled）、`accepted_at`、`consumed_event_id`；`UNIQUE(session_id, idempotency_key)`。5.28 无此概念。
- **`trajectory_runtime_events`**（`:432-444`）与 **`acp_parent_stream_events`**（`:446-457`）：5.28 是 `sessions/<id>.trajectory.jsonl` sidecar 文件（`0528:src/trajectory/paths.ts:61-69`），9.1 入库。
- `schema_meta`（`:5-13`）：`role`、`schema_version`、`agent_id`、`app_version`。
- 同库还有 memory 索引、`cache_entries`、`auth_profile_*`、`context_engine_turn_outbox`、`standing_intents`、board/heartbeat/goals 等（非转录主题，略）。

---

## 3. 数据流：写入、投影、读取、搜索

### 3.1 写入路径（一条消息的一生）

调用链（全部收敛到同一批函数）：

```
createUserTurnTranscriptRecorder
 → persistUserTurnTranscript                    0901:src/sessions/user-turn-transcript.ts:70
 → persistExpectedSessionTranscriptTurn         0901:src/config/sessions/session-accessor.transcript-turn.ts:281
 → appendExpectedSessionTranscriptTurn          0901:src/config/sessions/session-accessor.sqlite-transcript-turn.ts:60
 → appendTranscriptMessageInTransaction          0901:src/config/sessions/session-accessor.sqlite-transcript-message-append.ts:47
 → appendTranscriptEventInTransaction            0901:src/config/sessions/session-accessor.sqlite-transcript-store.ts:108
```

agent 运行时（SessionManager）走同步版 `persistSqliteRecord`（`0901:src/agents/sessions/session-manager-persistence.ts:162-283`）：非 message 叶子事件 → `appendTranscriptEventSync`，message → `appendTranscriptMessageSync`（同一文件 `:339-364`）。Plugin SDK 表面（`0901:src/plugin-sdk/session-transcript-runtime.ts:362-416`）与 Codex 变体（`codex-session-transcript-runtime.ts`）最终也汇入这些函数，由 `session-accessor.ts:241-244` 再导出。

硬约束：`appendTranscriptEvent*` 拒绝写 `type:"message"` 行，必须走 `appendTranscriptMessage*`（`0901:src/config/sessions/session-accessor.sqlite-transcript-write.ts:566-577`），因为只有后者施加 parent-link / idempotency / redaction 不变量。

**一次 append 在单个 `BEGIN IMMEDIATE` 事务内按序写入**（`0901:src/config/sessions/session-accessor.sqlite-transcript-store.ts:117-197`）：

1. 媒体规范化 `canonicalizeTranscriptEventMedia`（`:124`、`:619-629`）
2. `createdAt` = 事件 timestamp（数字或 ISO）否则 `Date.now()`（`:639-652`）
3. **批次首行**：`ensureTranscriptSessionRoot` upsert `session_nodes`（`entry_json:"{}"`、`entry_valid:-1`）+ `session_windows`（`reason:null`、`session_scope:"conversation"`）（`sqlite-transcript-state.ts:161-202`）；`ensureTranscriptGenerationInTransaction` 物化 `transcript_rewrite_watermarks.generation`
4. 身份去重读：`readTranscriptEventIdentity`（`session_id+event_id` 已存在 → 不写返回 false）；idempotency key owner 查询（`relocate-owner` 模式先把旧 owner 的 key 置空）
5. 插 `transcript_events(session_id, seq, event_json, created_at)`
6. `touchTranscriptMutationInTransaction` → `transcript_updated_at = max(now, prev+1, observed+1)`（`sqlite-transcript-state.ts:242-277`）——注意它**不是** `session_windows.updated_at`，是投影 staleness 专用的物理突变水位
7. `createTranscriptIndexAppenderInTransaction`（`0901:src/config/sessions/session-transcript-index.ts:245-348`）**同事务**写：`session_transcript_fts`（仅 user/assistant 文本）、`session_transcript_active_events`（active_position/message_position/context_eligible）、`session_transcript_index_state`（indexed_seq/leaf_event_id/counts）
8. 插 `transcript_event_identities`
9. 提交后若投影被标记脏：`scheduleTranscriptProjectionReconcile` → `startSessionTranscriptIndexReconcile`（deferred，不等结果）
10. `emitTranscriptUpdate` 广播（commit-then-broadcast，带单调 version fence，`0901:src/sessions/transcript-events.ts:134-147`）

**脱敏发生在 SQLite 之前**：`redactTranscriptMessageForStorage`（`sqlite-transcript-store.ts:654-665`）→ AgentMessage 走 `redactTranscriptMessage`（`0901:src/agents/transcript-redact.ts:728`，配置驱动的深度清洗），其余走 `redactSecrets`。也就是说 **`event_json` 里存的是脱敏体，列里只有身份/位置元数据**。

**seq 与"客户端序号"分离**：`seq` 原始（含 leaf 控制等非消息行）；客户端 cursor 用 `session_transcript_active_events.message_position + 1`（`0901:src/config/sessions/session-accessor.sqlite-transcript-sequences.ts:19,57-75`，原注释："Client cursors follow the final active-branch message position so abandoned rows cannot leak"）。

### 3.2 事件树（什么进转录）

canonical 类型（`0901:src/config/sessions/transcript-tree.ts:31-47`）：`message`、`thinking_level_change`、`model_change`、`compaction`、`reset`、`branch_summary`、`custom`、`custom_message`、`label`、`session_info`；外加 leaf 控制 `{type:"leaf", targetId, appendParentId?, appendMode?}`（`:87-107`）和 reset 边界 `{type:"reset", id, parentId, timestamp, reason, firstKeptEntryId?}`（`0901:src/config/sessions/session-reset-boundary-event.ts:14-21`）。工具调用不是顶层类型：调用是 assistant message 的 content block，结果是 `toolResult` 角色 message。首行是 header：`{type:"session", version, id, timestamp, cwd, parentSession?}`（`0901:src/config/sessions/transcript-header.ts:16-25`）。

### 3.3 投影/FTS 的一致性模型（这是 9.1 最"工程"的部分）

不看触发器——**全部由应用代码在同一写事务内维护**（`0901:src/config/sessions/session-transcript-index.ts:1-8` 的不变量注释：两个投影只镜像 active branch；watermark 的 `leaf_event_id` 必须等于 accessor 下次解析出的 append parent）。

- **只在前向无歧义时增量索引**：watermark 存在且 `!needs_rebuild`、`seq === indexed_seq+1`、无 `context_eligible IS NULL` 待分类行、非 leaf/side append、`treeEntry.parentId === watermark.leafEventId`（`:264-307`）
- 否则 `markSessionTranscriptIndexDirtyInTransaction` 置 `needs_rebuild=1`（清 counts，不动旧行），commit 后踢 reconcile
- **同步重建预算**：`SYNC_REBUILD_MAX_ROWS = 4_000`、`SYNC_REBUILD_MAX_BYTES = 4 MiB`（`:70-71`），超过则交给 Worker 线程
- **reconcile 流程**（`0901:src/config/sessions/session-transcript-reconcile.ts:192-323`）：Worker 离线准备全量计划 → runtime claim（负随机 `claimId` 写进 `session_transcript_index_state.updated_at`）→ 有界批量删除/追加（`PROJECTION_WRITE_CHUNK_ROWS = 512`）→ finalize；每个 chunk 都校验 claim 仍归自己且 `(transcript_updated_at, max seq)` 快照未变（`session-transcript-projection-rebuild.ts:313-526`）。单 slot owner，后来写排队而不是丢
- **读路径 fail-closed**：`withCurrentProjectionSnapshot` 在 `needs_rebuild≠0`、`indexed_seq ≠ latest.seq`、或有未分类行时返回 unavailable，并抛 `SessionTranscriptProjectionUnavailableError` → `chat.history` 返回 `retryable: true, retryAfterMs: 250`（`0901:src/gateway/server-methods/chat-history-handler.ts:73-86,387-393`）
- **网关启动**：`reconcileSessionTranscriptIndexes` 在对外服务前重建所有滞后投影（`session-transcript-reconcile.ts:192`；`0901:src/gateway/server-startup-session-migration.ts:12-36`）

### 3.4 读取路径

- **`chat.history` / `chat.startup` / `chat.metadata`**：`0901:src/gateway/server-methods/chat-history-handler.ts`（`:648-656`），三种互斥分页：`offset` XOR `messageId`（锚定读）、或 `cursor`（增量）
- **可见窗口**：`resolveVisibleHistoryProjection`（`0901:src/config/sessions/session-accessor.sqlite-history-events.ts:53-119`）join `session_transcript_active_events ⋈ transcript_event_identities ⋈ transcript_events` 找 compaction/reset 边界；可见区从最近一次 `reset` 开始；boundaries 计入 `total`
- **无 OFFSET 扫描**：字节有界的反向扫描 `resolveRecentHistoryStart` 先只读 `OCTET_LENGTH(event_json)+1` 元数据，不合适的行根本不取 payload（`:209-256`）
- **delta**：`cursor` 为 base64url `{version:1, agentId, sessionId, generation, lastSeq}`（`0901:src/config/sessions/session-accessor.sqlite-delta.ts:24-36`）；200 事件 / 1 MiB（`chat-history-delta.ts:15-16`）；遇 `hasMore`/边界事件/超预算 → 回 `{kind:"reset"}`；generation 不匹配 → `generation_mismatch` 重置
- **`sessions.get`**：只返回 `{messages}`，有界 tail（`readRecentSessionMessagesWithStatsAsync`，默认 200 条、`maxLines = limit*20+20`，允许 reset 归档回退）（`0901:src/gateway/server-methods/sessions-read.ts:670-720`）
- **SSE**：`session.message` / `sessions.changed`，payload 含 `agentId sessionKey sessionId target message messageId messageSeq runId lifecycleRevision`（`0901:src/config/sessions/session-accessor.sqlite-events.ts:11-36`、`0901:src/gateway/server-session-events.ts:82-138,361-408`）；每个转录身份一条串行 lane，`lifecycleRevision` 在 await 后重新校验
- **Read fence（新概念）**：`runWithSessionTranscriptReadFence`（`0901:src/config/sessions/session-transcript-read-fence.ts:23-122`）把"当前用户轮的受理回执"绑定到读上；跨过 fence 的 cursor 抛 `SessionTranscriptReadFenceError`，而不是悄悄把在途轮次的内容读出来

### 3.5 搜索（5.28 没有会话级全文搜索）

`searchSessionTranscripts`（`0901:src/config/sessions/session-transcript-search.ts:44-144`）：

```sql
SELECT session_windows.session_key, session_transcript_fts.session_id, message_id, role, timestamp,
  snippet(session_transcript_fts, 0, '', '', ' … ', 48) AS snippet,
  bm25(session_transcript_fts) AS rank
FROM session_transcript_fts
JOIN session_windows ON session_windows.session_id = session_transcript_fts.session_id
WHERE session_transcript_fts MATCH ?            -- 空白分词、逐词加引号、AND 组合 (:35-41)
  [AND (session_windows.session_key GLOB 'agent:<id>:*' OR session_key IN ('global','unknown'))]
  [AND session_windows.session_key IN (...)]
  AND session_transcript_fts.session_id NOT IN (SELECT session_id FROM session_transcript_index_state WHERE needs_rebuild != 0)
ORDER BY rank ASC, timestamp DESC, message_id ASC LIMIT ?
```

- 排序 = FTS5 `bm25()` 升序，对外 `score = -rank`；`limit` 默认 10、最大 25；query ≤ 4096 字符；snippet ≤ 500
- `session_key` 存在 `session_windows` 上，**键改名不会在索引里留陈旧键**（`:81-83` 注释）
- `needs_rebuild` 的 session 被排除（rewind 掉的分支文本不可见），同时回 `indexing: true` 让调用方重试
- Gateway 方法 `sessions.search`（`0901:src/gateway/server-methods/sessions-read.ts:89-207`，协议 `packages/gateway-protocol/src/schema/sessions.ts:403-419`），跨 retired physical store fan-out、按 `score desc, timestamp desc, messageId asc` 去重合并；agent 工具 `sessions-search-tool.ts` 复用同一函数（`0901:src/agents/tools/embedded-gateway-stub.runtime.ts:11`）

### 3.6 compaction / reset / rewind / 精确改写

| 操作 | 9.1 机制 |
|---|---|
| compaction（追加式） | 写一条 `type:"compaction"` 事件进 active branch（`0901:src/agents/sessions/session-manager-entries.ts:209`） |
| compaction（截断式，`sessions compact`/`/compact`） | `trimTranscriptForManualCompact`（`0901:src/config/sessions/session-accessor.sqlite-transcript-write.ts:170-231`）：快照 → 保留行计算 → 单事务内 `replaceSqliteTranscriptEventsInTransaction`（delete + 从 seq 0 重插 + **轮换 generation**）+ token 失效 + CLI 绑定清除 + `writeSessionEntry`。注释："The transcript rewrite, binding clear, and token invalidation describe one generation." **不产生备份归档**（`docs/cli/sessions.md:340-344`） |
| reset（手动 `/reset`、自动 idle/daily） | **不换 session_id**（`nextSessionId = currentEntry.sessionId`，`session-reset-service.ts:1628`、`agent-runner-session-reset.ts:75`）。在同一 session 的转录里追加一条 `type="reset"` 事件（`{id, parentId, timestamp, reason, firstKeptEntryId?}`，`session-reset-boundary-event.ts:90-97`），**不新增 session_windows 行**，旧转录行全部保留；历史读取以最后一条 reset 事件为起点重新计算可见窗口（`session-accessor.sqlite-history-events.ts:98-99`） |
| rewind / branch switch / fork | leaf 控制 `{type:"leaf", targetId, appendParentId?, appendMode?}`；前向索引器**拒绝**索引 leaf 行并标记 dirty，让可见路径重解析（`session-transcript-index.ts:276-285`） |
| 精确改写 | `rewriteTranscriptEventRowsExact`：`WHERE event_json = ?` 比较，影响行数 ≠ 1 即抛错（`sqlite-transcript-store.ts:445-461`），然后轮换 generation |
| doctor 文本修复 | `updateSqliteTranscriptEventJsonInTransaction` 保 seq，把 `transcript_updated_at` 只推 1 tick——因为它是 reconcile worker 的 staleness key（`:476-522`） |
| 删除 / 归档 | `session-history-eviction.ts:600-709`：`planSessionStateDeleteIfUnreferenced({archiveTranscript:true})` → materialize archive → 单事务（行删除 + 归档 row 插入）→ commit 后 `publishSessionStateArchives` → `emitArchivedTranscriptUpdates` |

### 3.7 冷归档的"编号发布"（crash-recoverable）

流水线（`0901:src/config/sessions/session-accessor.sqlite-archive*.ts`）：

1. **Worker 物化**：`BEGIN` → 重读删除快照并断言相等 → `transcript_events ORDER BY seq` 流式写入 `<name>.<uuid>.jsonl-stage` → `COMMIT`（`archive.worker.ts:243-306`）；压缩 zstd（Node zlib feature-detect，Bun 退化 identity）经 `createArchiveByteLimitTransform`，硬上限 256 MiB（`0901:src/config/sessions/archive-compression.ts:20-58`）
2. **同删除事务写 row**：`persistSessionTranscriptArchive` 写 `archive_blob/archive_sha256/encoding/reason`，`published_at = NULL`，读回校验（`sqlite-archive-store.ts:29-91`）
3. **commit 后发布文件**：`publishSessionStateArchives` 每批 4 条（`PENDING_ARCHIVE_PUBLISH_BATCH_SIZE`），temp(`wx`,0600) → `fs.linkSync`（EEXIST 视为已发布）→ dir sync → 读回 hash 校验；成功后单独事务写 `published_at/publish_attempts/last_publish_error`（`:115-259`）
4. **崩溃恢复**：任何后续 publish 调用都会重试 `published_at IS NULL` 的行；连 no-op 生命周期路径也会调 `publishSessionStateArchives`（`session-accessor.sqlite-lifecycle.ts:412,416`）。注释原文："The derived .deleted/.reset file may be recreated from this row after a crash."
5. **保留策略**：
   - `prunePublishedSessionArchivesByRetention` 只删**文件已不存在**的 row（`:318-323`）——row 是恢复副本，不能先删
   - 磁盘压力下 `pruneCanonicalSessionTranscriptArchivesToHighWater` 才 file + row 一起删，最旧优先（`session-history-eviction.ts:362-419`）
   - 文件删除由 `cleanupArchivedSessionTranscripts` 执行（`0901:src/gateway/session-transcript-files.fs.ts:451-497`）
   - 读压缩档对上层透明：`materializeSessionArchiveForRead` 解压到 tmp 缓存，24h TTL 清扫（`archive-compression.ts:91-153`）
6. **doctor 直写档**：`writeTranscriptArchive()` 按字节去重、读回校验不符即失败，只被 doctor 调（`sqlite-archive.ts:180-227`）

### 3.8 驱逐与磁盘预算（物理字节模型）

`0901:src/config/sessions/session-history-eviction.ts` + `store-maintenance.ts`：

- 入口 `enforceSqliteSessionHistoryDiskBudget`，30 分钟一次/store（`PHYSICAL_BUDGET_CHECK_INTERVAL_MS`），单 slot + pendingForce latch
- 计量 `measureSessionPhysicalDiskUsage`：**agent SQLite 主文件 + `-wal` + sessions 目录文件**，绝不估算逻辑行字节（`0901:src/config/sessions/disk-budget.ts:275-306`）
- 顺序：≤ `maxDiskBytes` 或 `mode:"warn"` → 直接返回 → `reclaimSqliteFreePages`（WAL checkpoint + `incremental_vacuum`）→ 仍高水位则按最旧剪归档文件 → 走历史 session（`readHistoricalSessionIds`，`ORDER BY updated_at ASC`）逐受害者 archive→删→发布→重新计量→达标即停
- 保护集：`readReferencedSessionIds` ∪ admission 在途 ∪ 近期历史（`session-history-eviction.ts:118-264`）
- dry-run：`inspectSqliteSessionHistoryDiskBudget`（`:79-116`）

`session.maintenance.*` 默认值（`store-maintenance.ts:22-33`）：`mode:"enforce"`、`pruneAfter:"30d"`、`archiveDashboardAfter:"7d"`、`maxEntries:500`、`preserveRecent:null`、`resetArchiveRetention:null`（保留到磁盘预算驱逐）、`maxDiskBytes:"10gb"`、`highWaterBytes:80%`。条目上限高水位 = `maxEntries + max(25, 10%)`（≤49 时为 `maxEntries+1`）。另有 `cron.sessionRetention` 默认 `24h`（`0901:src/cron/session-reaper.ts`）。

> 注意 flip commit `0a8e360` 的提交信息写 "maxDiskBytes defaults to 2gb so retention stays bounded"，而本机 9.1 文档/代码默认是 `10gb`——说明该默认值在后续版本调过；以 9.1 代码为准。

### 3.9 并发与正确性栅栏

| 机制 | 位置 | 作用 |
|---|---|---|
| 每 store 写队列 | `runExclusiveSqliteSessionWrite` → `runQueuedStoreWrite`（`0901:src/config/sessions/session-accessor.sqlite-scope.ts:99-131`、`src/shared/store-writer-queue.ts`） | 替代 5.28 的 `.jsonl.lock` 文件锁；同路径可重入；>1s 打日志 |
| `BEGIN IMMEDIATE` + busy timeout | `0901:src/state/openclaw-agent-db.ts:441-473`、`0901:src/infra/sqlite-transaction.ts` | 同步提交段；commit 后才做 post-commit 广播 |
| writer fence（run claim） | `0901:src/config/sessions/transcript-write-context.ts:39,213-242` | AsyncLocalStorage 带 `{expectedLifecycleRevision, expectedWriterRunId}`，每次 commit 重新校验；失 claim 抛 `SessionTranscriptWriterClaimReboundError`，拒绝为"另一个目标"写 |
| snapshot 冲突栅栏 | `withTranscriptWriteLock`（`sqlite-transcript-write.ts:421-515`） | 读快照在写事务内重校验；锁外突变 → `SqliteTranscriptMutationConflictError` |
| read fence | `session-transcript-read-fence.ts` | 见 §3.4 |
| projection claim lease | `session-transcript-projection-rebuild.ts:340-400` | 负随机 claimId + 快照匹配逐 chunk 校验 |
| DB handle LRU + lease | `0901:src/state/openclaw-agent-db.ts:496-509` | 事务中的 handle 永不被逐出（这也是事务体必须同步的原因） |
| 隐身会话 | `openclaw-agent-db.ts:261-263` | sentinel 路径键 + 真 `:memory:` DB，进程退出即消失；文件名被占用直接报错 |

### 3.10 legacy 迁移（JSONL → SQLite）

- **不做运行时导入**。`assertSessionStoreMigrationComplete()` 发现任何 legacy `sessions.json` 直接抛错："Legacy session store requires migration: <path>. Run `openclaw doctor --fix`…"——**Gateway 拒绝 readiness**（`0901:src/config/sessions/startup-migration.ts:25-59`）
- 唯一入口 `openclaw doctor --session-sqlite <mode>`（`inspect|dry-run|import|validate|compact|recover|restore`，`0901:src/commands/doctor-session-sqlite.ts:115-192`）；`.sqlite` 目标永不当 legacy 源（`:319-342`）
- 逐 session 全文件流式读（64 KiB chunk，`doctor-session-sqlite-readers.ts:125-240`），流前/中/后断言文件指纹未变
- 经**私有临时 spool DB**（`os.tmpdir()/openclaw-session-import-*/transcripts.sqlite`，finally 必删，`0901:src/config/sessions/session-accessor.sqlite-import-stage.ts:25-58`）在磁盘上做 branch repair（重复行丢弃、断链修复、终端 leaf 重发）+ legacy `openai-codex` provider 元数据规范化（`0901:src/config/sessions/legacy-transcript-repair.ts:46-67`）
- 批量 256 行导入（`SESSION_IMPORT_BATCH_SIZE`），插行后**同步完整重建投影**（doctor 不在请求路径上）
- 成功后原文件**移动**（同文件系统 rename，非复制）到 `agents/<id>/session-sqlite-import-archive/`，分类 `imported|repair-original|protected`；**先写 manifest 再移动**（migration-run），失败可 `recover` 回滚
- 官方文档（web，`cli/doctor/sqlite-maintenance`）："Hot transcript JSONL files are imported and archived after successful import; archive-tier JSONL files remain support artifacts, not runtime fallbacks."；降级需 `doctor --session-sqlite restore`，且"Sessions created after the SQLite flip are SQLite-only and will not appear to an older file-backed runtime"（`0901:docs/reference/session-management-compaction.md:94-124`）

---

## 4. 5.28 的对应实现（速查，用于对比）

- **文件布局**：`agents/<agentId>/sessions/` 扁平目录（`0528:src/config/sessions/paths.ts:10-18`），内含 `sessions.json`、`<sessionId>.jsonl`、`<id>-topic-<tid>.jsonl`、`<ts>_<id>.jsonl`（fork）、`<id>.checkpoint.<uuid>.jsonl`、`<x>.jsonl.reset.<ISO>` / `.deleted.<ISO>` / `.bak.<ISO>`、`<x>.jsonl.lock`、`<x>.trajectory.jsonl`、`skills-prompts/sha256/<2>/<64>.txt`、`.usage-cost-cache.json`
- **JSONL 行**：首行 header `{type:"session", version:3, id, timestamp, cwd, parentSession?}`（`0528:src/config/sessions/transcript-header.ts:9-16`、`version.ts:1`）；之后是一行一个 `{type, id, parentId, timestamp, ...}`（8-hex uuid4 前缀），类型含 `message`/`compaction`/`branch_summary`/`thinking_level_change`/`model_change`/`custom`/`custom_message`/`label`/`session_info`
- **两条写入路径**：gateway/channel 侧 `appendSessionTranscriptMessage`（`0528:src/config/sessions/transcript-append.ts:255-358`：AsyncLocalStorage 上下文 → 每 realpath FIFO 队列 → `.lock` 文件锁 → 可选 idempotency 反扫 → 读 leaf → 脱敏 → `fs.appendFile`）与 agent 运行时 `SessionManager.appendMessage`（`0528:src/agents/sessions/session-manager.ts:827-872`，缓冲批量/单条 O_APPEND）
- **顺序**：文件追加序即顺序；`seq` 是读时派生（`0528:src/gateway/session-transcript-index.fs.ts:161-178`）；无 parentId 的线性文件下次 append 时整文件重写迁移成树（`transcript-append.ts:130-174`，>8 MiB 跳过）
- **读**：`session-utils.fs.ts` 全量流式（64 KiB chunk）/tail（`maxBytes` 默认 8 MiB 的 `pread`）/异步内存索引（mtime+size 失效，LRU 256，`session-transcript-index.fs.ts:44-52,180-270`）
- **搜索**：无会话 FTS；消费方在 `index.entries` 上线性 `find()`；只有 memory 引擎（独立 sqlite，opt-in）能间接搜会话
- **归档**：`archiveFileOnDisk` = `fs.renameSync` 成 `.jsonl.<reason>.<ISO>`（`0528:src/gateway/session-transcript-files.fs.ts:128-143`）
- **驱逐**：`disk-budget.enforceSessionDiskBudget`（逻辑估算 + 高水位，`0528:src/config/sessions/disk-budget.ts:535-831`）+ `store-maintenance.ts`（`pruneAfter 30d`、`maxEntries 500`、`mode enforce`；`maxDiskBytes` 默认关闭）+ `cleanup-service.ts`（`openclaw sessions cleanup`）
- **rollover**：reset 时**换 sessionId 并重写文件名**（`session-file-rotation.ts:5-35`），旧文件 rename 归档，新文件只含 header

---

## 5. 除"保存位置"外的重大变化（逐项）

### 5.1 顺序与身份模型

| | 5.28 | 9.1 |
|---|---|---|
| 顺序 | 文件追加序，读时派生 seq | `(session_id, seq)` 主键，`MAX(seq)+1`，事务内分配 |
| 逻辑会话 ↔ 窗口 | 一个 `sessionId` 一个文件；reset/rollover 换 id + 重命名文件 | `session_nodes`（key 维度，一份 `entry_json`）↔ `session_windows`（session_id 一代 generation，`previous_session_id` + `reason`）；同 key 多代并存，列表只看 live 映射 |
| 分支 | 树 + `id/parentId`，rewind = 重新 append 后缀、旧行物理保留、读时过滤 | 同样的树，但有 `transcript_event_identities` 的 FK/索引承载 parent 边，且 reset 是一等 lineage 边界 |

影响：9.1 的 `reason`（reset/rollover/fork/rewind/switch/recovery/compaction）成为可查询的谱系事实，而 5.28 只能从文件名后缀猜。

### 5.2 元数据与"会话条目"

- 5.28 的会话条目在 `sessions.json` 里（`sessionId`、`sessionFile`、`updatedAt`、`compactionCheckpoints`、`delivery`…），每次写全量文件、原子 rename、有 mtime 缓存。9.1 是 `session_nodes.entry_json` + 投影列，与转录同库同事务边界，`sessionFile`/`transcriptLocator` 这类文件指针从会话行里彻底消失（`0901:src/config/sessions/legacy-sqlite-marker.ts` 只把它作为 artifacts/migration/plugin SDK 兼容保留）。

### 5.3 一致性模型：投影必须自愈

9.1 把"可见窗口"和"全文索引"都物化成可标记为 `needs_rebuild` 的投影，读路径**拒绝**读脏投影（返回可重试的 UNAVAILABLE），并有 claim lease + 快照匹配的重建协议。5.28 的等价格是"内存索引按 mtime/size 失效 + 可能读到撕裂状态"。这是从"尽力而为的缓存"到"带租约的自愈投影"的范式变化。

### 5.4 搜索能力（从无到有）

FTS5 索引 + `bm25` 排序 + `sessions.search` gateway 方法 + agent 工具 + 作用域 GLOB（`agent:<id>:*`）+ `indexing:true` 语义。5.28 会话转录没有任何全文检索。

### 5.5 读路径与协议

- `chat.history` 参数从 `{sessionKey, limit, maxChars}`（`0528:packages/gateway-protocol/src/schema/logs-chat.ts:26-31`）扩到 `{sessionKey, agentId, cursor, limit, offset, pendingBefore, inputRunIds, messageId, sessionId, maxChars}`（`0901:.../logs-chat.ts:32-51`）
- 响应带 `deltaCursor/nextOffset/hasMore/totalMessages/completeSnapshot/sessionInfo/pendingInputs/inputReceipts/inputConsumptions/metadata`（`0901:src/gateway/server-methods/chat-history-handler.ts:622-644`）；`sessions.get` 退化为只回 `{messages}`
- 可见窗口以 compaction/reset 边界为界；锚定读按身份行直接定位；反向扫描先读长度元数据

### 5.6 归档/删除语义

- 5.28：删除/重置 = **文件 rename**；reset 归档留存受 `resetArchiveRetention` 控；`.deleted/.reset/.bak` 三类后缀
- 9.1：删除/回收 = **DB blob 入库（同事务）+ 编号发布文件**；`encoding`（zstd/identity）+ sha256 + 读回校验；`published_at` 支持崩溃恢复；`.bak` 消失；reset 只写 reset 事件并新增一行窗口，旧一代的转录行保留到磁盘预算；`sessions compact` 截断**无备份**

### 5.7 驱逐：从"逻辑估算"到"物理字节"

新增 `maxDiskBytes`（默认 10gb）与 `highWaterBytes`（80%），计量含 sqlite 主文件 + WAL；超限先 `incremental_vacuum`，再删最旧归档，再淘汰历史 session（先归档再删行）；skip incognito；保护 admission 在途与近期历史。5.28 只有 `pruneAfter/maxEntries` 和一个默认关闭的 `maxDiskBytes`。

### 5.9 并发控制

5.28：`.jsonl.lock` 跨进程文件锁（stale 回收靠 pid liveness + watchdog）+ 每 realpath FIFO + AsyncLocalStorage 重入。
9.1：无锁文件；进程内写队列 + `BEGIN IMMEDIATE`；**writer fence**（run claim，防被取代的 run 继续写）+ **read fence**（防读到在途轮次）+ 投影 claim lease。多进程不再共享写权（SQLite busy timeout 负责）。

### 5.8 幂等与去重

5.28：`message.idempotencyKey` + 可选反向尾扫（默认 O(1) 不扫）；delivery mirror 靠比对尾部文本去重。
9.1：`transcript_event_identities` 的 `UNIQUE(session_id, message_idempotency_key)` 做 DB 级去重（`dedupe`/`relocate-owner` 两种模式）；重放比较时忽略 `timestamp`；冲突抛 `TranscriptTurnAdmissionConflictError`。

### 5.10 迁移/升级/降级

- 运行时零 JSONL；legacy 只能经 doctor 导入并**移走原文件**；manifest + recover/restore；迁移归档不计磁盘预算、只能 `openclaw update cleanup` 退场
- 降级是**有损**的：flip 后新建的 session 对旧版不可见；必须先 restore legacy artifacts
- agent schema 从 5.28 的"不存在"到 9.1 的 v19（v4 = sessions/transcripts 入 SQLite，#98236；v14 = session_nodes/session_windows 重构，#113071）；任何 schema 版本推进都不支持"降 marker 回退"

### 5.11 运行时可观测性

- SSE 事件从"文件路径 + 可能有 message"变成带 `messageId/messageSeq/lifecycleRevision/runId` 的结构化事件，且每个转录身份串行 lane + await 后重校验
- `session.message` 的 payload 需要时重读 DB（`readSessionMessageByIdAsync`），拿不到 seq 时退化为 count

---

## 6. 与 session transcript 相关的其它方面变化（5.28 → 9.1）

1. **待处理输入成为一等公民**：`session_pending_inputs`（queued/interrupted/cancelled、`consumed_event_id`）+ `chat.history` 的 `pendingInputs/inputReceipts/inputConsumptions`。"Accepted input stays outside the active transcript until its exact turn owns execution."（schema `:757` 注释）。5.28 完全没有这张表/这套协议。
2. **隐身会话（incognito）**：9.1 用 sentinel 路径键 + 真 `:memory:` SQLite 保存会话与压缩状态（5.28 树里 grep 不到 incognito），重启即失。
3. **trajectory / ACP 流入库**：`trajectory_runtime_events`、`acp_parent_stream_events`（5.28 是 `sessions/*.trajectory.jsonl` sidecar）。
4. **Plugin SDK 转录契约固化**：`0901:src/plugin-sdk/session-transcript-runtime.ts`（append/publish/lock/mirror）、`session-transcript-hit.ts`、`codex-session-transcript-runtime.ts`、`session-transcript-lock-runtime.ts`。web 侧 changelog 记载 PR #95030 引入"durable session-transcript SDK contract"，并要求插件"stop treating legacy file paths as identity"（`docs/refactor/database-first.md`）。
5. **delivery mirror 仍是同一张表里的合成行**：`appendAssistantMirrorMessageByIdentity` 写 `api:"openai-responses", provider:"openclaw", model:"delivery-mirror"`、zero usage 的 assistant 行（`0901:src/plugin-sdk/session-transcript-runtime.ts:295-355,442-466`），先按等价尾部可见 assistant 去重。5.28 是追加到同一个 JSONL + 文本去重。
6. **memory / session-memory hook 改按 scope 读**：`{agentId, sessionId}` 取代文件路径；memory host 侧 `listSessionTranscriptScopesForAgent`、公开搜索 hit 用 `transcript::` 前缀路径而不再是假文件路径（web: `docs/refactor/database-first.md`）。
7. **doctor 修复面搬家**：JSONL in-place 修复 + `.bak` 备份（`0528`/legacy `0901:src/commands/doctor-session-transcripts.ts`）vs SQLite canonical 修复：头事件补齐（`doctor-session-transcript-headers.ts:195-331`）、`entry_json` 重写（`session-accessor.sqlite-doctor-rewrite.ts:30-112`）、跨库 canonical key 迁移（`session-accessor.sqlite-canonical-repair.ts`）。
8. **配置面**：`session.maintenance.*` 语义重定义（`rotateBytes` 被删除并由 doctor `--fix` 清理；`resetArchiveRetention` 现在同时管 deleted/reset 两类归档且默认"保留"；新增 `maxDiskBytes`/`highWaterBytes`，语义是物理字节）。搜索相关新增 `tools.sessions.visibility`（默认 `agent`）。
9. **CLI**：`openclaw sessions` 增加 `compact`（截断 SQLite 转录、无备份）、`list/cleanup/archive/delete/tail/export-trajectory`（`0901:src/cli/program/register.status-health-sessions.ts:216-541`）；没有 JSONL 导出。`openclaw transcripts` 与 5.28 一样仍是会议纪要，但底层已改读共享 SQLite 并生成 JSONL 产物（`0901:src/transcripts/store-export-jsonl.ts:18-60`）。
10. **Redaction 与媒体规范化前置**：9.1 在写 SQLite 前统一脱敏 + `canonicalizeTranscriptEventMedia`（媒体引用规范化），5.28 在写 JSONL 行前脱敏（`0528:src/config/sessions/transcript-append.ts:344-348`）但无媒体规范化这一步。
11. **性能/内存证据**（9.1 CHANGELOG 自身记录，说明这次替换的动机）："reduce memory held by transcript scans and chat views"、"cut memory held by transcript scans"、"reuse prepared transcript batch writers"、"release transcript backing storage after eviction"、"release cached transcript backing storage (#133988)"、导入加速系列（#133350/#133403/#133496/#133546/#133611/#133641）。
12. **Schema 基线有守护**：`scripts/generate-sqlite-session-schema-baseline.ts` 生成基线，CI 校验；`docs/.generated/sqlite-session-transcript-schema-baseline.sha256` 随 flip commit 引入（web: commit `0a8e360` 文件清单）。

---

## 7. 证据链（便于复核）

| 结论 | 证据 |
|---|---|
| 5.28 无 agent SQLite、转录为 JSONL | `0528` 树无 `src/state/`；`0528:src/config/sessions/{paths,transcript-append,transcript-jsonl,transcript-header}.ts` |
| 9.1 表结构 | `0901:src/state/openclaw-agent-schema.sql:15-774`；`0901:src/state/openclaw-agent-db.generated.d.ts:345-571` |
| 写入/seq/投影 | `0901:src/config/sessions/session-accessor.sqlite-transcript-store.ts:108-197`；`sqlite-transcript-state.ts:205-217`；`session-transcript-index.ts:245-366` |
| 读/协议 | `0901:src/gateway/server-methods/chat-history-handler.ts`；`0901:packages/gateway-protocol/src/schema/logs-chat.ts:32-51` |
| 搜索 | `0901:src/config/sessions/session-transcript-search.ts:35-144`；`0901:src/gateway/server-methods/sessions-read.ts:89-207` |
| 归档/驱逐 | `0901:src/config/sessions/session-accessor.sqlite-archive*.ts`；`session-history-eviction.ts`；`docs/reference/session-management-compaction.md:43-65` |
| 迁移/降级 | `0901:src/commands/doctor-session-sqlite*.ts`；`0901:src/config/sessions/startup-migration.ts:25-59`；`0901:docs/reference/session-management-compaction.md:94-124` |
| flip 时间点/内容 | web：commit `0a8e360`（#98236，"flip sessions and transcripts to sqlite storage"）；docs.openclaw.ai `reference/database-schemas/agent-schema-history`（"Sessions and transcripts moved into SQLite (#98236)" = schema v4，首发 v2026.8.1）；PR #113071（schema v14 重构） |
| 设计意图 | web/本地 `docs/refactor/database-first.md`（"Runtime never writes or reads session or transcript JSONL as active state."） |

## 8. 尚未覆盖 / 需要注意

- 9.1 之后（>2026.9.1）还有 schema 演进（web 文档出现 schema 20/22/23/26 的 cold archives / compressed transcript 描述），**不属于本版本**，本文只描述 9.1 现状（schema 19，`session_transcript_archives` 存 blob + 发布文件双形态）。
- `meeting transcripts`（`transcripts.*`）与 session transcript 同名易混，本文按 9.1 源码口径分开。
- `docs/cli/sessions.md` 的 delete/compact 语义（incognito 不归档、compact 不备份）以 2026-09 文档为准；如需精确行为，跑 `openclaw doctor --session-sqlite inspect` 对照本机数据库。

---

## 9. 追问澄清（术语 / entry_json / 脱敏 / 完整记录位置）

### 9.1 "世代"这个词的来源

不是 session 的翻译。源码原词是 **generation**：`openclaw-agent-schema.sql:3`（"`session_windows` and their children own transcript generations"）、`transcript_rewrite_watermarks.generation`、`session_transcript_archives.generation`；PR #113071 的表述 "generation-scoped transcript state stays keyed by `session_id`" 也用它，并把旧表 `session_transcript_generations` 改名为 `transcript_rewrite_watermarks`。

含义：**同一个 session_key 下，由 reset/rollover/fork/rewind/switch/recovery/compaction 产生的不同 session_id，每一个就是一代 generation，落在 `session_windows` 的一行里**。本文后续统一称"会话窗口 / 一代（generation）"。

### 9.2 `session_nodes.entry_json` 脱敏吗？——不脱敏

- 写入函数 `writeSessionEntry`（`0901:src/config/sessions/session-accessor.sqlite-entry-store.ts:556-619`）只做 `normalizeSessionEntryTimestamp`、身份/血缘断言、`preserveCreationStamp`、可见性 copy-forward，**没有调用任何 redact**。
- 脱敏的唯一入口是消息入库前的 `redactTranscriptMessageForStorage`（`0901:src/config/sessions/session-accessor.sqlite-transcript-store.ts:654-665`），只覆盖 `transcript_events.event_json` 里的 `AgentMessage`。
- 因此 `entry_json` 中的**自由文本按原文落库**：`/goal` 的 objective（`0901:src/auto-reply/reply/commands-goal.ts:160-180`）、`lastHeartbeatText`（`0901:src/infra/heartbeat-runner-delivery.ts:581`）、`label` / `displayName` / `agentStatus` / `goal` / `pluginExtensions` / `pluginNextTurnInjections` 等。
- 例外：个别特性在写 entry 前自行脱敏，例如 `observerDigest` 走 `redactToolPayloadText`（`0901:src/gateway/session-observer-model.ts:247`）；doctor 的 `sqlite-doctor-rewrite` 也只做结构变换。

> 结论：**"转录正文会脱敏，会话元数据不会"**。如果你在排查"为什么 sessions.json/DB 里能看到某段用户原文"，先看它是在 `entry_json`（元数据，未脱敏）而不是 `transcript_events`（已脱敏）。

### 9.3 脱敏具体做了什么

入口 `redactTranscriptMessage(message, cfg, sourceAppend?)`（`0901:src/agents/transcript-redact.ts:728-749`）= 对整条 `AgentMessage` 做一次**深保留结构遍历**，规则如下：

| # | 规则 | 依据 |
|---|---|---|
| 1 | **内置大量 token 特征**（`DEFAULT_REDACT_PATTERNS`，`0901:src/logging/redact-patterns.ts:130-267`）：OpenAI `sk-`、GitHub `ghp_/github_pat_/gho_/ghu_/ghs_/ghr_`、GitLab `glpat-/gloas-/gldt-/…`、Slack `xox[baprs]-`、`xapp-`、Slack/Discord webhook URL、Groq `gsk_`、Google `AIza…/ya29./1//0…`、JWT `eyJ…`、Perplexity `pplx-`、`fal_`、Stripe `sk_live_/sk_test_/rk_live_/bb_live_`、SendGrid `SG.`、`npm_`、`pypi-`、Fernet `gAAAA…`、Telegram bot token、GitLab `GR1348941…`、`_gitlab_session` | 同一文件 |
| 2 | **授权头/连接串/配置赋值**：`Authorization: Bearer/Basic/Bot`、HTTP auth 头、`--flag <secret>` CLI 形态、`url://user:pass@`、`postgres/mysql/mongodb/redis` DSN、form-body `key=value`、`FOO=secret` 环境赋值、`BEGIN … PRIVATE KEY`、AWS `aws_secret_access_key`（40 位 base64） | 同上 |
| 3 | **敏感字段名优先**：命中 `isSensitiveFieldKey` / `STRUCTURED_SECRET_FIELD_RE` 的 key，其 value 无论形态都脱敏；`page_token/page_cursor` 保留分页状态但仍做 value 脱敏 | `0901:src/agents/transcript-redact.ts:52-68`；`0901:src/logging/redact.ts:1049-1051` |
| 4 | **掩码形状**：长度 < 18 → 整串 `***`；否则保留前 6 + 后 4，中间 `…`（`DEFAULT_REDACT_MIN_LENGTH/KEEP_START/KEEP_END`） | `0901:src/logging/redact.ts:231-239` |
| 5 | **toolResult 单独策略**：模型可见的 tool payload 走 `redactModelVisibleToolPayloadTextWithConfig`（更严格/全上下文），与普通文本策略分开 | `0901:src/agents/transcript-redact.ts:41-50, 701-702` |
| 6 | **用户自定义**：`logging.redactPatterns` 与内置模式合并（正则，需可编译） | `0901:src/logging/redact-patterns.ts` + `0901:src/logging/config.ts:66-74` + `src/config/types.base.ts:290` |
| 7 | **刻意不脱敏的部分**（为了不破坏 provider 重放）：`toolCallId`/`parentToolCallId`/`runId`/`scopeId`/`afterEntryId` 等关联键保持原值，使落库事件与实时事件可对齐（注释 "Correlation keys must match live events"）；provider 签名/加密字节（OpenAI reasoning encryption、Anthropic/Google thought signature、`textSignature`）按 provider 路由原样保留；`providerReplay` 走 `sanitizeCompactionReplayState` 单独清洗 | `0901:src/agents/transcript-redact.ts:560-663` |
| 8 | **媒体**：inline image data URL 按字节签名规范化并保留（`sanitizeInlineImageDataUrlForStorage`，`packages/media-core/src/inline-image-data-url.ts:184`），非 image/base64 元数据被拒；`preserveImageDataUrlFields` 控制 `url` 字段是否保留 data URL | `0901:src/agents/transcript-redact-images.ts:43-120` |
| 9 | **发送方身份**：若 `__openclaw.senderId/senderIdentity` 被脱敏改写，则删除 `senderIdentity`，避免把脱敏字节误解成真实发送者 | `0901:src/agents/transcript-redact.ts:714-722` |
| 10 | **非 AgentMessage 事件**（custom 等）走通用 `redactSecrets`（`0901:src/logging/redact.ts:1239`） | `0901:src/config/sessions/session-accessor.sqlite-transcript-store.ts:654-665` |

补充：5.28 同样在写行前脱敏（`0528:src/config/sessions/transcript-append.ts:344-348`），且 toolResult `details` 另受 8 KiB 上限约束；9.1 把这套规则集中到 `src/agents/transcript-redact.ts`，并新增了 provider 重放保留、媒体规范化、发送方身份三条规则。

### 9.4 一个 session 的"完整对话记录"究竟在哪

按"物理上还有多少字节"分四层：

1. **主记录：`transcript_events.event_json`**（`openclaw-agent-schema.sql:389-396`）。一行一个事件，`event_json` 是完整事件（含完整 message 内容，已脱敏）。这一层是**物理全量**——包括已经被 rewind/branch switch 废弃的分支行：这些操作**只追加**控制事件，不删行（`0901:src/config/sessions/session-accessor.sqlite-message-cut.ts:337,356` 写 `{type:"leaf", …}` 后 `appendTranscriptEventsInTransaction`）。"当前可见上下文"则是 `session_transcript_active_events` 投影 + compaction/reset 边界过滤后的视图。
2. **同一逻辑 session 的其它窗口**：reset/rollover 等会产生新的 `session_windows` 行，**旧窗口的转录行继续留在 `transcript_events`**（同库、按 `session_key` 归属）。要拿"这个 session_key 的完整历史"，需要沿 `session_nodes.current_session_id` + `previous_sessionId` 链条遍历各窗口。
3. **被显式删除/回收的窗口**：行在同事务内删除，完整内容转为 `session_transcript_archives.archive_blob`（zstd JSONL）+ 发布出的 `.jsonl.deleted.<ts>.zst` 文件。这一层是**恢复副本**，不是运行时可读状态。
4. **在途但尚未进入转录的输入**：`session_pending_inputs.message_json`（queued/interrupted/cancelled，带 `idempotency_key` 与 `run_id`）。schema 注释："Accepted input stays outside the active transcript until its exact turn owns execution."

两个会破坏"完整"的操作，需要注意：
- `openclaw sessions compact` / `/compact` 的截断路径（`trimTranscriptForManualCompact`，`0901:src/config/sessions/session-accessor.sqlite-transcript-write.ts:170-231`）**物理删除被总结掉的行且不留备份**。
- 磁盘预算驱逐历史窗口时，同样先归档再删行（`session-history-eviction.ts:600-709`），此时"完整"只存在于归档 blob/文件里。

反过来说：**title/preview 不落库**，列表页标题由读时探针从转录派生（`0901:src/config/sessions/session-accessor.sqlite-title-probes.ts:165`），所以 `entry_json` 里没有对话正文拷贝。

---

## 10. 追问澄清二：原始记录位置、脱敏覆盖面、5.28 是否脱敏

### 10.1 原始对话记录的位置与脱敏覆盖面

原始（脱敏后的）对话正文就在 **`transcript_events.event_json`**——一行一个事件，`message` 字段是完整 `AgentMessage`（角色、内容块、工具结果），按 `session_id`（一个 `session_windows` 窗口）分段、按 `seq` 连续。

但**不能说"入库的对话记录全部脱敏"**。实测结论：

| 写入面 | 是否脱敏 | 依据 |
|---|---|---|
| `message` 事件（user/assistant/toolResult/custom 角色） | ✅ 强制，且**无 operator 关闭开关** | `0901:src/config/sessions/session-accessor.sqlite-transcript-store.ts:654-665` 在进 SQLite 前调用；转录路径 mode 硬编码 `"tools"`（`0901:src/logging/redact.ts:949-973`），内置 `DEFAULT_REDACT_PATTERNS` 恒生效；`src/config/types.base.ts:288` 提到"off"的注释指向 log sink，配置项本身已不存在 |
| `session_pending_inputs.message_json` | ✅ 写前脱敏 | `0901:src/config/sessions/session-accessor.pending-inputs.ts:222,119` |
| `session_transcript_fts.text` | ✅ 派生自已脱敏消息 | `0901:src/config/sessions/session-transcript-projection-rebuild.ts:71-134` |
| **`compaction.summary` / `branch_summary.summary`** | ❌ **不脱敏** | 9.1 脱敏只挂在 message append 上；`0901:src/agents/sessions/session-manager-entries.ts:199-222` 的 `appendCompaction` 无 redact（该文件 grep 无 redact）。摘要是**模型从对话提炼的文本**，用户贴过的密钥可能在摘要里以明文重现 |
| **`custom.data` / `custom_message.content` / `label` / `session_info.name`** | ❌ 不脱敏 | 同上（`appendEntry` 路径） |
| **doctor 导入的 legacy JSONL** | ❌ 不重新脱敏（保真优先，信任源文件） | `0901:src/commands/doctor-session-sqlite-readers.ts`、`0901:src/config/sessions/session-accessor.sqlite-import.ts:147` 原样 `insertEvent({eventJson})` |
| `trajectory_runtime_events.event_json` | ❌ 存时不脱敏，**导出时**才 `redactSecrets` | `0901:src/trajectory/runtime-store.sqlite.ts`（无 redact）vs `0901:src/trajectory/export.ts:619` |
| `session_nodes.entry_json` | ❌ 不脱敏（见 §9.2） | `0901:src/config/sessions/session-accessor.sqlite-entry-store.ts:556-619` |

另有两个性质上的注意点：

1. 脱敏是**特征匹配**，不是语义保证。内置模式命中的是 API key/webhook/JWT/DSN/Authorization/PEM/env 赋值等特征（`0901:src/logging/redact-patterns.ts:130-267`）；**用户直接粘贴的密码、内部主机名、私有 URL 若不匹配任何特征，会原样保留**。
2. provider 签名/加密 reasoning 字节**故意不脱敏**（保重放），见 `0901:src/agents/transcript-redact.ts:660-663`。

### 10.2 5.28 的 session transcript 脱敏吗？——消息行脱敏，非消息事件不脱敏

5.28 与 9.1 用的是同一套 redaction（`0528:src/agents/transcript-redact.ts:103` vs 0901 同名文件），配置面也相同（内置模式恒生效，无 transcript 关闭开关）。差别在**覆盖写法**：

| 写入路径 | 5.28 | 9.1 |
|---|---|---|
| gateway/channel 消息 | ✅ `0528:src/config/sessions/transcript-append.ts:346-347` | ✅ 同函数，但下沉到 SQLite store |
| agent 运行时消息 | ⚠️ 依赖 `0528:src/agents/session-tool-result-guard-wrapper.ts:74` 对 `appendMessage` 的猴补丁；**`SessionManager.appendMessage` 自身无 redact**（grep 确认） | ✅ 唯一存储函数强制 |
| delivery mirror | ✅ `0528:src/config/sessions/transcript.ts:389,406` | ✅ `0901:src/plugin-sdk/session-transcript-runtime.ts:499-508` |
| `compaction` / `branch_summary` 摘要 | ❌ `0528:src/agents/sessions/session-manager.ts:899-923` 直写 | ❌ 同 |
| `custom` / `custom_message` / `session_info` | ❌ `0528:src/agents/sessions/session-manager.ts:925-991` 直写 | ❌ 同 |
| toolResult `details` 上限 | ✅ 8 KiB 上限 + 脱敏 | 规则并入统一 redaction |

结论：

- 5.28 **普通消息行是脱敏的**，不存在"默认关掉脱敏"的配置。
- 5.28 的弱点是**脱敏挂在调用方约定上**（guard wrapper / gateway append），而不是挂在存储唯一入口；9.1 把它下沉到唯一 append 函数——这是 9.1 的实质改善。
- **两版共同的缺口**（9.1 未修复）：压缩/分支摘要与 custom/custom_message 等非消息事件的正文不脱敏；doctor 导入与 trajectory 存储也不脱敏。若要"入库即无明文密钥"，这一组路径需要单独处理。

---

## 11. 追问澄清三：归档时的删除行为、FTS 覆盖面、生命周期数据流

### 11.1 归档（`.reset` / `.deleted`）时会不会删库里的行？——reset 不删，delete 删

| 动作 | `transcript_events` / `transcript_event_identities` | `session_transcript_fts` / `active_events` / `index_state` | 归档文件 |
|---|---|---|---|
| **reset**（不换 id） | **不删**。reset 不换 `session_id`，只写一条 reset 边界事件并重写会话记录（清空模型/用量统计）；旧转录行原样保留（docs：`session-management-compaction.md` "Reset boundaries start a fresh history window without deleting earlier transcript rows"） | 不删（旧 session_id 的投影仍在） | reset 时的文件归档走 `archivePreviousSessionTranscript`（`0901:src/config/sessions/session-accessor.reset.ts:322-346`）→ `archiveSessionTranscriptPaths`（`0901:src/gateway/session-transcript-files.fs.ts:309-332`），它只 **rename 磁盘上存在的候选文件**（`existsSync` 才处理）。运行时转录在 DB 里没有文件，所以对 SQLite session 实际是 no-op；`.jsonl.reset.*` 只在 legacy JSONL 还在时才产生 |
| **deleted**（显式删除 / 被磁盘预算回收） | **删**。`deleteSqliteSessionStateRows`（`0901:src/config/sessions/session-accessor.sqlite-lifecycle-state.ts:500-510`）先删投影，再 `DELETE FROM session_windows WHERE session_id=?`；`PRAGMA foreign_keys = ON`（`0901:src/state/openclaw-agent-db.ts:270,359`）使 FK `ON DELETE CASCADE` 连带删除 transcript_events → transcript_event_identities → active_events/index_state/watermarks/trajectory/ACP-stream/pending_inputs | **显式删**：`deleteSessionTranscriptIndexInTransaction`（`0901:src/config/sessions/session-transcript-index.ts:369-381`）删 FTS 行、active_event 行、index_state 行。注释原因："The window row cascades canonical transcript tables, but FTS is virtual; clear its projection before dropping the owner row." | **同一事务里先插 `session_transcript_archives` 行**（blob+sha256，`persistSessionTranscriptArchive`），commit 后再编号发布成 `.jsonl.deleted.<ts>[.zst]`（见 §3.7）。所以顺序是"先把内容搬进 DB blob → 再删行" |

一句话：**"归档"在 9.1 是"内容先落到归档 blob，行照删"；reset 不是归档，是新增窗口 + 边界事件。**

### 11.2 `session_transcript_fts` 是不是全量解析结果？——不是，只是 user/assistant 文本的检索投影

进入 FTS 的条件（`0901:src/config/sessions/session-transcript-projection-rebuild.ts:100-133`）：
- event 必须 `type === "message"` 且有非空 `id`
- `message.role ∈ {user, assistant}`
- 必须能提取出文本

`readMessageText`（`:71-98`）只取三种形态：`content` 为字符串 / `text` 字段 / `content` 数组里 `type ∈ {text, input_text, output_text}` 的块用 `\n` 拼接。

**不含**：toolResult 角色的工具结果、工具调用参数（它们是 assistant content block，类型不是 text）、thinking/reasoning、`compaction`/`branch_summary`/`branch`/`custom`/`custom_message`/`label`/`session_info` 等非 message 事件、图片/附件等非文本块。列也只有 `text / session_id / message_id / role / timestamp`，并且 text 是**已脱敏后**的内容。

所以应用侧的选择：

- 只要做搜索、或只要 user/assistant 问答对的纯文本（喂 RAG / 统计 / 摘要）：**直接查 FTS 最省事**，但要接受"只有两类文本、无工具结果、无图片、无结构、已脱敏"这些损失。
- 需要完整对话（工具调用、结果、思考、压缩摘要、自定义消息、时间线与分支）：**必须读 `transcript_events.event_json`**，配合 `transcript_event_identities`（parentId / idempotency）与 `session_transcript_active_events`（可见性）自己解析树。FTS 只能当"命中定位"用，再回表取 `event_json`（这正是 gateway 的 `sessions.search` 之后做的事）。
- 建议用 SDK 而不是裸 SQL：`searchSessionTranscripts`（搜索）+ `session-accessor` 的 history/delta API（读），它们已经处理了脏投影拒绝读、generation 校验、read fence 等约束（见 §3.3/§3.4）。

### 11.3 生命周期各阶段：数据怎么进表、怎么变、什么时候被删

| 阶段 | 触发的表写入 | 会被删除吗 |
|---|---|---|
| **① 创建（首批首条事件）** | upsert `session_nodes`（`entry_json:"{}"`、`entry_valid:-1`）+ `session_windows`（`reason:null`）+ 物化 `transcript_rewrite_watermarks.generation` | — |
| **② 每条消息 append** | `transcript_events`(seq) + `transcript_event_identities` + `session_transcript_fts`（user/assistant 文本）+ `session_transcript_active_events`（active_position/message_position/context_eligible）+ `session_transcript_index_state`(indexed_seq/leaf/counts) + `session_windows.transcript_updated_at`；非消息事件走 append 但**不进 FTS**（`extractTranscriptIndexEntry` 拒绝），是否进 active_events 由 `shouldProjectActiveEvent`（`projection-rebuild.ts:171-184`）决定 | 否 |
| **③ 输入受理（在途）** | 写 `session_pending_inputs`（queued/interrupted/cancelled），**不进转录** | 该行在 turn 认领后被消费（state 更新 + `consumed_event_id` 回填），后续按窗口删除级联 |
| **④ 读** | 只读 | 否 |
| **⑤ compaction（追加式）** | +1 条 `compaction` 事件（经 append 路径） | 否 |
| **⑥ compaction（截断式 `sessions compact`/`/compact`）** | 单事务内 `replaceSqliteTranscriptEventsInTransaction`：**DELETE 全部事件 → 从 seq 0 重插保留部分** → **轮换 generation** → 投影置 `needs_rebuild` → 重建 | **是**（被总结掉的行物理删除，且不留备份） |
| **⑦ reset** | 新 `session_windows` 行 + reset 边界事件；旧窗口行全留 | 否 |
| **⑧ rewind / fork / switch branch** | 追加 `leaf` 控制事件；前向索引器拒绝索引 leaf → `needs_rebuild=1` → 重建可见路径 | 否（被废弃分支的行仍物理存在，只是不可见） |
| **⑨ doctor 修复** | `rewriteTranscriptEventRowsExact`（精确改写单行）或 `updateSqliteTranscriptEventJsonInTransaction`（保 seq、推 1 tick 水位）；两者都轮换 generation | 改写等价于"删旧行写新行" |
| **⑩ delete / 磁盘预算回收** | archive blob 入库 → 删 FTS/active/index_state → 删 `session_windows`（FK 级联） | **是**（内容只存在于归档 blob/文件） |
| **⑪ 归档保留期到期 / 高水位** | 归档文件删除时同时删归档 row（高水位路径 file+row 同删）；按 `resetArchiveRetention` 的 row 删除**只删已无文件的 row** | 是（仅归档层） |

"哪些表会被删"汇总：**唯一权威删除点是 `session_windows` 行**——因为 `transcript_events`、`transcript_event_identities`、`session_transcript_active_events`、`session_transcript_index_state`、`transcript_rewrite_watermarks`、`trajectory_runtime_events`、`acp_parent_stream_events`、`session_pending_inputs` 都有指向它的 FK `ON DELETE CASCADE`。例外两个需要显式删除：**FTS 虚拟表**（无 FK，投影 owner 主动清）和**归档表**（独立行，文件删后才删 row）。

---

## 12. 追问澄清四：5.28 的"两阶段归档"在 9.1 还成立吗？

5.28 的模型（详见 `mydocs/OpenClaw会话转录与归档生命周期详解.md`）：
```
阶段 1  活跃 <sid>.jsonl ──rename──→ <sid>.jsonl.reset.<ts> / .deleted.<ts>（不删字节）
阶段 2  按 resetArchiveRetention / 磁盘预算 rm 掉归档文件
```

9.1：**两阶段仍在，但第一步换了实现，第二步换了主触发器。**

### 12.1 阶段 1：从"改名活跃文件"变成"从 DB 行生成新文件"，reset 更退化为不归档

| 触发 | 5.28 | 9.1 |
|---|---|---|
| reset | `fs.renameSync` 产出 `.jsonl.reset.<ts>` | DB 行**不删**：不换 session_id，只写一条 reset 边界事件 + 重写会话记录（`0901:src/config/sessions/session-accessor.reset.ts:322-346`；`session_windows.reason` 实际恒为 NULL，见 `sqlite-session-row.ts:52`）。文件层归档代码仍调用 `archiveSessionTranscriptPaths`（`0901:src/gateway/session-transcript-files.fs.ts:309-332`），但只 rename **磁盘上存在的候选文件**（`existsSync` 门），运行时转录在 DB 里 → **对 SQLite session 是 no-op** |
| delete | rename 产出 `.jsonl.deleted.<ts>` | 同事务写 `session_transcript_archives`（blob+sha256），commit 后**新生成** `<sessionId>.jsonl.deleted.<ts>[.<generation>][.zst]`（§3.7） |

因此：**文件名后缀格式没变**（`parseSessionArchiveTimestamp` 仍按 `.{reason}.{timestamp}` 解析，`0901:src/config/sessions/artifacts.ts:175-195`），但 `.reset.*` 在 9.1 实际几乎不再生成——所有 DB 归档路径的 reason 都是 `"deleted"`（`0901:src/config/sessions/session-accessor.sqlite-lifecycle-state.ts:441`、`sqlite-lifecycle.ts:375`、`sqlite-projection.ts:587`）；`"reset"` 只保留在类型（`"deleted" | "reset"`）与文件层路径里。

### 12.2 阶段 2：还在，但默认靠磁盘预算而不是年龄计时器

| 触发 | 9.1 实现 | 默认 |
|---|---|---|
| 年龄清理 | `cleanupArchivedSessionTranscripts`（`0901:src/gateway/session-transcript-files.fs.ts:451-497`，按 reason 规则 + `olderThanMs`）+ `prunePublishedSessionArchivesByRetention`（只删**文件已不存在**的归档 row，row 是崩溃恢复副本） | `resetArchiveRetention: null` = **不按年龄清** |
| 磁盘预算（主路径） | `pruneCanonicalSessionTranscriptArchivesToHighWater`（file+row 同删，最旧优先，`0901:src/config/sessions/session-history-eviction.ts:362-419`）；legacy 文件路径 `pruneSessionTranscriptArchivesToHighWater`（按 mtime，排除未发布名，`0901:src/config/sessions/disk-budget.ts:314-341`） | `maxDiskBytes: 10gb`、`highWaterBytes: 80%` |
| 仍超限 | 继续淘汰历史 session：archive blob → 删窗口行（级联）→ 发布文件，逐个重新计量 | 每 30 分钟一轮 + 删除后强制踢一次 |

源码注释把设计意图讲得很清楚（`0901:src/config/sessions/store-maintenance-operations.ts:180-183`）：
> "null retention keeps archived transcripts: they are conversation history, and the disk budget (not a wall-clock timer) is the only eviction path."

### 12.3 与 5.28 的差异汇总

| | 5.28 | 9.1 |
|---|---|---|
| 第一步是否让活跃数据消失 | 改名后活跃文件消失（字节仍在归档名下） | reset：**数据从未被移走**（DB 行原样保留）；delete：行删除但内容已在同事务归档 blob |
| reset 归档文件 | 每次 reset 必然产生 | 实际不产生（no-op） |
| 第二步默认触发 | `resetArchiveRetention` + 逻辑磁盘预算 | **物理字节预算**（sqlite 主文件 + WAL + sessions 目录）为主；年龄清理需显式配置 |
| 归档内容身份 | 就是那个被改名的文件 | canonical 是 `session_transcript_archives` row；磁盘文件是**派生**产物，丢了可从 row 重建 |
| 归档清理顺序 | 删文件即结束 | 先删文件，确认后才删 row（高水位路径 file+row 同删；年龄路径只删无文件残留的 row） |

---

## 13. 追问澄清五：触发条件（reset / 归档 / 彻底删除）

> **更正**：本文早期版本把 reset 描述成"新增一行 `session_windows`"。这是错的——见 §13.2 的实测结论。

### 13.1 各动作的触发条件

**A. reset（清空对话、重新开始）——不删任何数据**

| 触发方式 | 说明 | 依据 |
|---|---|---|
| 用户发 `/reset` | 处理中**沿用同一个 session_id**，只是清空统计、追加分隔事件 | `0901:src/gateway/session-reset-service.ts:1628`（`nextSessionId = currentEntry?.sessionId ?? randomUUID()`）、`0901:src/auto-reply/reply/agent-runner-session-reset.ts:75` |
| 自动 reset：`session.reset.mode = "daily"` + `atHour` | 到达设定小时后算过期 | `0901:src/config/sessions/reset-policy.ts:96-110`（`sessionStartedAt < dailyResetAt`） |
| 自动 reset：`session.reset.mode = "idle"` + `idleMinutes` | 距上次互动超过空闲分钟数算过期 | 同上（`now > lastInteractionAt + idleMinutes*60000`） |
| 重启恢复 rollover、agent 初始化发现会话过期 | 走同一套 reset 流程 | `0901:src/config/sessions/entry-freshness.ts:95-106` |

注意：未显式配置 `session.reset` 时，自动 reset 关闭（`resetPolicy.configured !== true` 时视为新鲜，`entry-freshness.ts:96-99`）。旧版用 `updatedAt = 0` 表示"待重置"的墓碑标记仍被识别（`reset-policy.ts:80-83`）。

**B. delete（归档 + 删记录）**

| 触发 | 说明 | 依据 |
|---|---|---|
| `openclaw sessions delete <key>` / gateway `sessions.delete` | 默认归档转录（隐身会话不归档） | `0901:src/gateway/server-methods/sessions-delete.ts:269-276` |
| 会话条目过期（`session.maintenance.pruneAfter`，默认 30 天） | 每次保存会话记录时顺带清理 | `0901:src/config/sessions/session-registry-maintenance.ts:84` |
| 条目数超上限（`maxEntries`，默认 500） | 最旧的先删 | `0901:src/config/sessions/store-maintenance.ts` |
| `openclaw sessions cleanup --fix-missing` | 转录文件丢失/为空（≤4 KiB 且无消息）的条目 | `0901:src/config/sessions/cleanup-service.ts:552,568` |
| 定时任务会话过期（`cron.sessionRetention`，默认 24h） | cron 专用清扫器 | `0901:src/cron/session-reaper.ts:130-182` |
| 模型探测会话（`model-run-*`）24h | 仅在有维护压力时触发 | `0901:src/config/sessions/store-maintenance.ts`（model-run prune） |
| 磁盘超预算（`maxDiskBytes`） | 归档文件不够抵时才淘汰历史会话，最旧优先 | `0901:src/config/sessions/session-history-eviction.ts:600-709` |
| 删除 agent | 清空该 agent 的全部会话 | `purgeDeletedAgentSessionEntries` |

**C. 彻底删除归档文件**

| 触发 | 默认 |
|---|---|
| `session.maintenance.resetArchiveRetention` 按年龄清（`.reset`/`.deleted` 都算） | 默认 `null` = **不按年龄清** |
| 磁盘超预算（物理字节含 sqlite + WAL + sessions 目录）→ 先删最旧归档文件 | 启用 `maxDiskBytes` 后生效 |
| 归档文件已不存在 → 顺带清掉归档记录行 | 自动 |

### 13.2 reset 到底做了什么（更正前述误解）

**不是新增 `session_windows` 行。** 实测：

1. `nextSessionId = currentEntry.sessionId`——**沿用同一个 id**（`session-reset-service.ts:1628`、`agent-runner-session-reset.ts:75`）。
2. 往这个 session 的转录里追加**一条**事件，内容是 `{type:"reset", id, parentId, timestamp, reason, firstKeptEntryId?}`（`0901:src/config/sessions/session-reset-boundary-event.ts:90-97`）。它就存在 `transcript_events` 表的 `event_json` 里——**"reset 边界"不是某个表的某列，而是转录表里 type 为 `reset` 的一行**。
3. 重写会话记录（`session_nodes.entry_json`），清掉模型选择、token/费用统计、compaction 计数等。
4. **转录旧行一条都不删**。历史读取时从最后一条 reset 事件之后开始算"可见窗口"（`0901:src/config/sessions/session-accessor.sqlite-history-events.ts:98-99`）；`preserve-tail` 模式还会保留末尾若干条 user/assistant 记录用于重放（`session-reset-boundary-event.ts:86-88`）。

补充两点容易搞错的：

- `session_windows.reason` 列（枚举 initial/reset/rollover/fork/rewind/switch/recovery/compaction）**在常规写入路径里恒为 NULL**（`0901:src/config/sessions/session-accessor.sqlite-session-row.ts:52`）。别用它判断 reset。
- **什么时候才会新增一行 `session_windows`**：出现**新的 session_id** 时——fork/分支（`0901:src/agents/sessions/session-manager-branching.ts:108`）、子 agent、定时任务隔离会话、重启恢复 rollover、doctor 跨库迁移。新旧 id 通过 `previous_session_id` 串起来。

### 13.3 "彻底删除"到底删什么

**删记录（同一次事务内完成）**：

| 表 | 怎么被删 |
|---|---|
| `session_transcript_fts`（搜索索引） | 显式删除（虚拟表无外键） |
| `session_transcript_active_events`（可见位置投影） | 显式删除 |
| `session_transcript_index_state`（索引健康度） | 显式删除 |
| `session_windows`（这一代会话的"户口本"） | 显式删除——**这是唯一的总开关** |
| `transcript_events`（对话正文） | 靠外键自动连带删除 |
| `transcript_event_identities`（事件身份/幂等键） | 靠外键自动连带删除 |
| `transcript_rewrite_watermarks`、`trajectory_runtime_events`、`acp_parent_stream_events`、`session_pending_inputs` | 靠外键自动连带删除 |
| `session_nodes`（逻辑会话） | 只有该 key 没有任何 session_id 剩留时才删；否则保留并换 `current_session_id` |
| `session_transcript_archives` | **最后才删**：文件已确认删除后才清记录行（它是崩溃恢复副本） |

**删文件**：

| 对象 | 何时删 |
|---|---|
| `sessions/<sessionId>.jsonl.deleted.<ts>[.zst]`（由归档记录生成的） | 达到 `resetArchiveRetention` 年龄，或磁盘超预算被剪 |
| `sessions/<sessionId>.jsonl.reset.<ts>` | 同上（9.1 运行时基本不产生） |
| `session-sqlite-import-archive/` 里的旧 JSONL | 不计入磁盘预算，只能 `openclaw update cleanup` 退场 |
| 数据库里的归档 blob（`archive_blob`） | 归档文件删除后，按保留策略清对应记录行；磁盘压力下文件+记录一起清 |

**顺序很重要**：先把内容写进归档记录 → 删数据库行 → 提交 → 再生成文件 → 文件确认后才清归档记录行。所以任何一步崩溃都不会丢对话。

---

## 14. 追问澄清六：什么是"投影" / 删除后能否找回 / reset 分隔线为什么必要 / 彻底删除删什么

### 14.1 "投影"是什么

大白话：**投影 = 从原始数据算出来、为了查得快而另存一份的副本。删了可以随时重算，丢了不影响原始数据。**

类比：书的目录（投影），书页（原始数据）；目录撕了重编一遍就行。

9.1 里有三份投影，全部从"对话正文表"算出来：

| 投影 | 干什么用 | 原始数据 |
|---|---|---|
| 可见位置表（`session_transcript_active_events`） | 预先算好"哪些消息是可见的、排在第几位"，读历史时直接按序号取，不用每次重新遍历整棵树 | `transcript_events` + 事件关系表 |
| 索引健康度（`session_transcript_index_state`） | 记"已经算到第几条了""要不要重建" | 同上 |
| 搜索索引（`session_transcript_fts`） | 让全文搜索快（`bm25` 排序） | 同上（只索引 user/assistant 文本） |

为什么要这层：对话可能有几百 MB，如果每次读历史都从头遍历树、把每条 JSON 都解析一遍，界面会卡。所以提前算好一份"目录"。代价是可能算错或算旧了——所以每份投影都带一个"健康标记"，发现对不上就标脏、后台重建；重建期间读历史会返回"稍后重试"，而不是给你一份错乱的内容（见 §3.3）。

### 14.2 "删会话" vs "彻底删除"是两个操作（重要更正）

**本文早期版本把这两件事混为一谈，实测代码后更正。**

| | 操作 1：删会话 | 操作 2：彻底删除（清归档） |
|---|---|---|
| 触发 | `sessions delete`、条目过期（30 天）、条目超上限、cron 会话 24h、`sessions cleanup --fix-missing`、删 agent | 归档文件到 `resetArchiveRetention` 年限；磁盘超预算（`maxDiskBytes`） |
| 做什么 | **先备份**：把对话压缩写进归档记录（DB blob）→ 删库里的原始行（**同一事务**）→ 提交 → 再生成 `.deleted.<时间戳>.zst` 磁盘文件 → 回读校验 | 删掉操作 1 生成的归档文件 + 归档记录行 |
| 内容还在吗 | **在**（在归档里，这是设计好的安全副本） | **不在**——这一步不可逆 |
| 对应你原来的问法 | "变成 .deleted" | "彻底删除" |

操作 1 的代码：`0901:src/config/sessions/session-history-eviction.ts:600-709`（驱逐场景）与 `0901:src/config/sessions/session-accessor.sqlite-lifecycle-state.ts:232-267`；归档生成见 `0901:src/config/sessions/session-accessor.sqlite-archive.ts`。
操作 2 的代码：年龄清理 `0901:src/gateway/session-transcript-files.fs.ts:451-497`；磁盘预算 `0901:src/config/sessions/session-history-eviction.ts:362-419`。

> 注意 5.28 的"改名 + 删文件"两阶段在 9.1 依然存在两个阶段，但第二阶段的语义从"删改名后的文件"变成了"删由 DB 归档生成的派生文件"。

### 14.3 reset 为什么需要分隔线（因为它不换 session_id）

你的疑问：**"reset 应该会生成新 session id 吧？那按 session 看历史不就行了？"**

关键事实（两处代码都能验证）：**reset 不换 session_id**。
- `nextSessionId = currentEntry?.sessionId ?? randomUUID()`（`0901:src/gateway/session-reset-service.ts:1628`）
- `const nextSessionId = prevEntry.sessionId`（`0901:src/auto-reply/reply/agent-runner-session-reset.ts:75`）

只有"这个 key 之前根本没有会话"时才会用 `randomUUID()`。

所以正因为 id 没变，"按 session 读历史"会把 reset 之前的老对话一起读出来。**分隔线就是用来补这个洞的**——它标记"当前这段对话从哪一行开始"。

分隔线具体怎么起作用（`0901:src/config/sessions/session-accessor.sqlite-reset-window.ts`）：

| 环节 | 做法 |
|---|---|
| 找分隔线 | 取**最后一条** `type=reset` 的事件（`:98-104`） |
| 算可见范围 | 可见消息数 = **保留的尾巴** + 分隔线之后的消息数（`:269-283`）。老对话不算在内 |
| 保留的尾巴 | 分隔线事件里带 `firstKeptEntryId`，标记"从这条开始的前几条要留着"，实际只留**成对的 user/assistant 消息**（工具结果丢弃，`selectResetKeptEntries`）——这样 reset 后接话不至于完全失去上下文（`:160-228`） |
| 历史显示 | 分隔线本身作为一个标记显示出来；**只看历史时，只有 reset 会切断窗口，压缩不会切**（`:46-48`） |
| 模型上下文 | 分隔线也切（而且压缩也切），并且只算 `context_eligible = 1` 的消息（`readVisibleTranscriptStats`，`:374-402`）——所以 `/reset` 之后模型确实看不到老对话 |

一句话：**id 不变 + 分隔线标起点 = 同一个 session 里可以反复 reset 而老对话不丢、也不进上下文。**

对比 5.28：5.28 的 reset 是换 id + 改名文件，所以"当前对话"天然就是一个新文件，不需要分隔线。这是 9.1 把 reset 改成"不换 id"带来的连锁变化。

### 14.4 彻底删除到底删哪些数据

**A. 数据库里删（一次事务内）**

1. 搜索索引行（`session_transcript_fts`）——显式删
2. 可见位置行（`session_transcript_active_events`）——显式删
3. 索引健康度行（`session_transcript_index_state`）——显式删
4. **这一代会话的"户口本"行（`session_windows`）**——显式删，这是总开关
5. 由它**自动连带**删掉的：对话正文（`transcript_events`）、事件身份/幂等键（`transcript_event_identities`）、代次标记（`transcript_rewrite_watermarks`）、轨迹（`trajectory_runtime_events`）、ACP 流（`acp_parent_stream_events`）、待处理输入（`session_pending_inputs`）
6. 逻辑会话行（`session_nodes`）——**通常保留**，只把指向换成新的；这个 key 一个 session_id 都不剩时才删

**B. 磁盘上删**

| 对象 | 何时删 |
|---|---|
| 由归档生成的 `.deleted.<时间戳>[.zst]` 文件 | 到 `resetArchiveRetention` 年限，或磁盘超预算被剪 |
| `.reset.<时间戳>` 文件 | 同上（9.1 运行时基本不产生） |
| 迁移期挪走的旧 JSONL（`session-sqlite-import-archive/`） | 不计入磁盘预算，只能 `openclaw update cleanup` |
| 归档压缩包本体（`archive_blob`） | 文件确认删除后才清对应记录行；磁盘压力下文件+记录一起清 |

**C. 不删的**

- 分隔线、压缩摘要这些"边界记录"随对话正文一起进归档，不单独留
- 同一 key 的其它代 session_id（如果还没被回收）不受影响

---

## 15. 追问澄清七：彻底删除的处理逻辑与可逆性（更正混淆）

### 15.1 先把我混为一谈的两件事拆开

| | 操作 1：**删会话** | 操作 2：**彻底删除（清归档）** |
|---|---|---|
| 触发 | `sessions delete`、条目过期（30d）、条目超上限（500）、cron 会话 24h、`sessions cleanup --fix-missing`、删 agent、磁盘超预算时淘汰历史会话 | 归档文件到了 `resetArchiveRetention` 年限；磁盘超预算 |
| 流程 | 先备份到归档 → 同事务删原始行 → commit → 生成 `.deleted.<ts>[.zst]` 文件 → 回读校验 | 删掉操作 1 生成的归档**文件** + 归档**记录行** |
| 可逆？ | 内容在归档里，可救 | **不可逆** |
| 你说的"变成 .deleted" | ✅ 指这个 | — |
| 你说的"彻底删除" | — | ✅ 指这个 |

（5.28 的"改名 + 删文件"两阶段在 9.1 仍存在，但第二阶段删的是**由 DB 归档生成的派生文件**，不是改名后的活跃文件。）

### 15.2 彻底删除的处理逻辑：它找哪些记录去删

有两条完全独立的路径，都只在"磁盘超预算"或"年龄到期"时跑。

**路径 A：按年龄清（默认关闭）**

- `session.maintenance.resetArchiveRetention` 设为时长（如 `"7d"`）才启用；默认 `null` = **不清**
- 流程：先扫 `sessions/` 目录，按文件名里的 `.deleted.<ts>` / `.reset.<ts>` 解析时间戳，超龄的直接 `rm` 文件（`0901:src/gateway/session-transcript-files.fs.ts:451-497`）；紧接着 `prunePublishedSessionArchivesByRetention`（`0901:src/config/sessions/session-accessor.sqlite-archive-store.ts:265-347`）**只删那些文件确认已不存在的记录行**（`!fs.existsSync`）
- 所以顺序是：**先删文件 → 确认文件没了 → 再删记录行**。记录行里那份压缩 blob 是"文件丢了还能重建"的救命副本，所以不能先删行
- 每次最多处理 256 条归档记录（`ARCHIVE_RETENTION_BATCH_SIZE`）

**路径 B：磁盘超预算（默认开启，主路径）**

触发条件是**物理字节**超标：agent 的 SQLite 主文件 + `-wal` 文件 + `sessions/` 目录里的文件，加总超过 `maxDiskBytes`（默认 10gb）。每 30 分钟扫一次，写完会话记录也会顺手踢一次。

它按这个顺序一步步来，每步后重新量体积，降到高水位（默认 80%）就停：

1. **回收数据库自身空间**：WAL 归档 + 增量 vacuum（不动数据）
2. **剪最旧的归档**：从归档表里按生成时间最旧取**一条**，删掉对应文件，**同一事务里删掉该记录行**，回收空间，重新量，循环
3. **还不够就淘汰旧会话**：列出所有"历史会话"（见下），从旧到新逐个：先把它备份成新归档 → 删它的全部行 → 生成文件 → 重新量 → 达标即停

"历史会话"怎么挑（`readHistoricalSessionIds`，`session-history-eviction.ts:266-287`）：
- 候选 = 户口本表里**所有**行，按 `updated_at` 从旧到新排
- **排除三类受保护的**：
  1. 还被活着的会话条目引用的（列表里还看得见的）
  2. 正在跑的活儿认领过的（`collectAdmissionProtectedSessionIds`，哪怕这个 id 已经不是当前 id）
  3. 配了 `preserveRecent` 时最近活跃的那些
- 注意：**"reset 掉的老对话"就在候选里**——因为 reset 不换 id，它一直挂在同一个户口本下，永远不会被当成"历史"淘汰；会被淘汰的是换了新 id 之后**旧 id 那一代**（比如 fork/回滚/重启恢复产生的旧代）

### 15.3 彻底删除之后能找回吗

**不能。这是不可逆的。**

原因：
- 删会话时那份"安全副本"就是归档本身（DB 里的压缩 blob + 磁盘文件）。彻底删除 = 把最后这份副本也删了
- 9.1 **没有回收站、没有撤销命令**。doctor 的 `--session-sqlite restore` 恢复的是**升级迁移**时挪走的旧 JSONL，跟这个无关
- 唯一能救的情况：**删之前就有外部副本**——`openclaw backup sqlite` 快照，或你自己复制过 state 目录

补充一个细节：如果只删了磁盘文件、还没删记录行（路径 A 中两步之间），内容其实还在 DB blob 里；但代码把这两步连着跑，实际上几十毫秒内就都没了。真要说"还能捞"，只有在这两步之间手动停进程这一种可能。

### 15.4 彻底删除到底删哪些数据（简版）

- **磁盘文件**：`sessions/*.jsonl.deleted.<ts>[.zst]`、`*.reset.<ts>`、遗留的 `.bak`
- **归档记录行**（连带里面的压缩 blob）
- **如果是淘汰旧会话走的路径**：还会删那一代的全部行——对话正文、事件身份、搜索索引、可见位置、索引健康度、轨迹、待处理输入，以及户口本行本身（外键级联）；当这个 key 没有任何 id 剩留时，逻辑会话行也删

---

## 16. 追问澄清八：两个设计质疑（删除顺序 / 归档文件是否多余）

### 16.1 "反正都要删，顺序反了有什么区别？"

**最终状态一样；区别在"删到一半崩溃"那一刻。** 源码注释直接给出了理由（`0901:src/config/sessions/session-history-eviction.ts:399-403`）：

```
// The database is the recovery copy. Retain it unless its derived file
// is gone, otherwise retention could leave an undeletable orphan.
```

| 顺序 | 崩在中间时 | 后果 |
|---|---|---|
| **先删文件 → 再删记录行**（现行） | 文件没了、行还在 | 行里的压缩 blob 完好，任何时候都能把文件重新生成；下一轮清理继续删行。**控制权始终在系统手里** |
| 先删行 → 再删文件 | 行没了、文件还在 | 文件成为**孤儿**：数据库里没有任何记录提到它，而所有清理都只认有记录行的对象 → 它永远占空间且**自动清不掉** |

第二种在磁盘紧张时最糟：本想腾地方，却制造出一个永远腾不掉的孤儿。所以"顺序不能反"讲的是故障状态，不是最终状态。

### 16.2 "不导出文件，不就没事了？"——文件不只是备份，它是行删掉后唯一还能读的地方

这一点是最容易误解的。查证结论（`0901:src/gateway/session-transcript-readers.ts:213-214`）：

```ts
if (messages.length === 0 && opts.allowResetArchiveFallback === true) {
  return await archivedTranscriptReader(target).read({ ...opts, resetArchiveOnly: true });
}
```

读历史的调用方普遍带着 `allowResetArchiveFallback: true`（`0901:src/gateway/session-history-tail.ts:88,93,161`）。因此实际链路是：

1. 先从 SQLite 读（正常路径）
2. **SQLite 里一行都没有时，退回读归档文件**（`.deleted.zst` 先被解压成明文缓存再解析，`0901:src/config/sessions/archive-compression.ts:91-123`）

也就是说：会话被删除后，客户端如果还留着它的界面并重连请求历史，仍然能从归档文件里把对话读回来。**这不是"为了备份而备份"，是一个在读路径上真实生效的 fallback。** 删掉文件，这条 fallback 就断了。

### 16.3 但你的另一条批评成立：一份压缩数据存了两遍

- 压缩比约 10:1（`0901:src/config/sessions/archive-compression.ts:1-3`："JSONL transcripts compress ~10:1"）
- **DB blob 与磁盘文件是同一份压缩字节**——等于同一份内容占两份空间
- 删归档文件只省约一半；删记录行才省另一半；删行后还需增量 vacuum 才真正归还文件系统空间（未回收的空页仍计入体积，`0901:docs/reference/session-management-compaction.md`）
- 默认 `maxDiskBytes` 10GB、高水位 80%（`0901:src/config/sessions/store-maintenance.ts:27,30`），长期实例大概率会触发

### 16.4 权衡与可行简化

现行设计用这些代价：

| 代价 | 换来的能力 |
|---|---|
| 一份压缩数据存两处（DB blob + 文件） | 文件丢了能从 DB 重建（崩溃恢复） |
| 删除要跨两个对象协调，且顺序有约束 | 行删了还能从文件读（读路径 fallback） |
| 归档文件计入磁盘预算 → 到期/超限要清理 | "永不删对话"在压缩后成本可接受 |

如果不需要 §16.2 的 fallback，可简化为：**只在 DB 里存 blob，删除时直接删行 + vacuum**——省一半空间、去掉整套跨对象协调。代价是会话删除后历史彻底读不到。

建议：如果确实需要"删了还能翻历史"，就保留现状但把 `maxDiskBytes` 调大或让归档不计入预算；如果不需要，写 issue 建议移除文件导出，比调预算更省。
