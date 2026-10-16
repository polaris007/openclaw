# OpenClaw 9.1 Session Transcript 存储与生命周期

> 说明 9.1（`2026.9.1`，agent schema v19）里 session transcript 存在哪、每张表存什么、一条 session 从生到删会经过哪些阶段。

---

## 1. 数据位置

每个 agent 一个 SQLite 文件：

```
~/.openclaw/agents/<agentId>/agent/openclaw-agent.sqlite    # 主文件
                                      ├─ .sqlite-wal        # 预写日志
                                      └─ .sqlite-shm        # 共享内存索引
```

- **对话记录全部在这个库里**，不再有 `.jsonl` 对话文件；`~/.openclaw/agents/<agentId>/sessions/` 目录下只剩删除/重置时导出的归档文件（`.deleted.<时间戳>[.zst]`）。
- 库采用 WAL 模式，最近写入的数据可能还在 `-wal` 文件里未合并进主文件。
- **隐身会话（incognito）跑在内存数据库里**，磁盘上不落任何文件。

---

## 2. 相关表及内容

按用途分三组。表名后附一句话说明它是干什么的。

### 2.1 核心表：对话与会话本身

| 表 | 一行代表 | 主要列 |
|---|---|---|
| `transcript_events` | **一条对话事件** | `session_id` + `seq`（第几条，从 0 连续）+ `event_json`（完整事件 JSON）+ `created_at` |
| `session_windows` | **一个 session_id（一代会话）** | `session_key`、`previous_session_id`（上一代 id）、`reason`、`transcript_updated_at/observed_at`、状态、渠道、账号、模型、开始/结束时间 |
| `session_nodes` | **一个 session_key（逻辑会话）** | `current_session_id`（当前生效 id）、`entry_json`（会话元数据完整 JSON）、label/display_name/archived_at 等 |
| `transcript_event_identities` | **一条事件的身份** | `event_id`、`seq`、`parent_id`（父子关系）、`message_idempotency_key`（去重键） |

`event_json` 里 `type` 字段区分事件种类：`session`（首行会话头）、`message`（真正的消息，含 user/assistant/toolResult）、`compaction`（压缩摘要）、`reset`（重置分隔线）、`thinking_level_change`、`model_change`、`custom`、`custom_message`、`label`、`session_info`、`leaf`（切换分支/回滚的控制行）。

### 2.2 派生表：为读得快而存的副本（删了可重建）

这三张由 `transcript_events` 计算而来，内容丢失不影响原始数据：

| 表 | 作用 |
|---|---|
| `session_transcript_active_events` | 预先算好"哪些消息可见、排第几位"，读历史直接按序号取 |
| `session_transcript_index_state` | 记录这份副本算到第几条、是否需要重建 |
| `session_transcript_fts` | 全文搜索索引（FTS5）。**只收 user/assistant 的纯文本**，工具结果、图片、摘要都不在里面，且内容已脱敏 |

> 这三张表在数据被大改后会标记为"待重建"并由后台重算；重建期间走这几张表的读取会返回"稍后重试"而不是错数据。

### 2.3 删除/归档相关表

| 表 | 作用 |
|---|---|
| `session_transcript_archives` | 会话被删除时的压缩备份：`archive_blob`（zstd/JSONL 字节）+ sha256 + 对应磁盘文件名 |
| `transcript_rewrite_watermarks` | 每个 session 一个内容版本号（`generation`），内容被改写/替换时换新值 |
| `session_pending_inputs` | 已受理但还没写进对话的输入（排队中/被打断的） |

### 2.4 表之间的关系

```
session_nodes  (session_key，1 行)  ── 一个 key 可有多个 id
       │
       ▼
session_windows  (session_id，1 行 = 一代)   ◄── 删这一行 = 删掉这一代的全部数据
       │
       ├──► transcript_events ──► transcript_event_identities
       ├──► session_transcript_archives
       ├──► transcript_rewrite_watermarks
       ├──► session_pending_inputs
       └──► trajectory_runtime_events / acp_parent_stream_events   (轨迹与 ACP 流，非对话)
```

**除归档表外，其余都以 `session_windows.session_id` 为根**：删掉户口本那一行，下面这些表的数据会被数据库自动连带删除（外键级联）；搜索索引表没有这个级联，由代码显式删除。

### 2.5 token / 用量数据在哪

| 口径 | 位置 | 说明 |
|---|---|---|
| **每轮用量** | `transcript_events.event_json` → `message.role === "assistant"` 的 `message.usage` | 字段含 `input/output/cacheRead/cacheWrite/totalTokens/cost` 等。这是最细的粒度 |
| **会话累计** | `session_nodes.entry_json` | 字段 `inputTokens/outputTokens/totalTokens/cacheRead/cacheWrite/estimatedCostUsd/contextTokens`。是累计快照，`/reset` 会清零重算 |
| 上下文大小 | 同上 `contextTokens`，及 `message.usage.contextUsage` | 反映最近一次调用的上下文规模 |

---

## 3. 生命周期：一条 session 的流转

按时间顺序。`A`=新增、`U`=修改、`D`=删除。

### ① 首次对话

**触发**：该会话的第一条消息写入。

- `A` `session_nodes`（`entry_json` 为空 `{}`，记录当前 id）
- `A` `session_windows`（新 id 一行）
- `A` `transcript_rewrite_watermarks`（分配内容版本号）
- `A` `transcript_events` 首行（`type:"session"` 会话头）

### ② 每轮对话（主路径）

**触发**：用户发言 / agent 回复 / 工具返回结果。

- `A` `transcript_events`：`seq` 递增一条，`event_json` 是完整消息
- `A` `transcript_event_identities`：该事件的 id、父事件 id、幂等键
- `A/U` 三张派生表（搜索索引、可见位置、索引健康度）在同一批写入里同步更新
- `U` `session_windows.transcript_updated_at`（写入时间水位，可作增量扫描依据）
- `U` `session_nodes.entry_json`（累计 token、费用、最后活跃时间）
- 一次工具调用会先产生 assistant 消息、后产生 toolResult，两条之间有间隔

### ③ 输入排队中

**触发**：消息已受理但还没轮到执行（忙/被打断）。

- `A` `session_pending_inputs`，`state` 为 `queued`/`interrupted`/`cancelled`
- **此阶段该输入不在 `transcript_events` 里**，执行时才写入对话表

### ④a 压缩上下文（追加式）

**触发**：上下文接近上限自动触发，或用户 `/compact`。

- `A` `transcript_events`：一条 `type:"compaction"` 事件（带摘要、保留起点）
- **旧消息一条不删**，只是模型上下文从这条之后算起
- 派生表同步更新

### ④b 压缩上下文（截断式）

**触发**：`openclaw sessions compact` 或带条数参数的 `/compact`。

- `D + A` `transcript_events`：**整段清空后按 seq 从 0 重新插入保留部分**，被总结掉的**物理删除且不留备份**
- `U` `transcript_rewrite_watermarks.generation`（换版本号）
- `U` `session_nodes.entry_json`（清空计数）

### ⑤ 重置（reset）

**触发**：用户 `/reset`，或 `session.reset` 配置的自动重置（`idle` 空闲时长 / `daily` 定点）生效。

- `A` `transcript_events`：一条 `type:"reset"` 分隔线事件。**不换 session_id**
- `U` `session_nodes.entry_json`：累计 token / 费用 / 模型选择清零重写
- **旧对话一条不删**；读历史与模型上下文都以最后一条 reset 之后为准，分隔线之前的内容默认不展示
- `session_windows.reason` 列虽然预留了 `reset` 等取值，但常规写入时**恒为空**，判断是否重置要看 `transcript_events` 里的 reset 事件

### ⑥ 分支 / 回滚 / 切换

**触发**：回退到某条消息、从某条消息分叉、切换分支。

- `A` `transcript_events`：一条 `type:"leaf"` 控制事件
- **被丢弃分支的行仍在表里**，只是不可见
- 分叉/重启恢复场景额外：
  - `A` `session_windows`（**新的 session_id** 一行，`previous_session_id` 指回旧 id）
  - `U` `session_nodes.current_session_id`（指向新 id）

> 这也是"同一个 `session_key` 会有多个 `session_id`"的原因：完整历史需要按 key 收集它的所有 id。

### ⑦ 会话被删除（先备份，再删行）

**触发**（任一）：

- `openclaw sessions delete <key>` / 网关 `sessions.delete`
- 会话超过 `session.maintenance.pruneAfter`（默认 30 天）未更新
- 会话总数超 `maxEntries`（默认 500），最旧的先删
- 定时任务会话超 `cron.sessionRetention`（默认 24h）
- `sessions cleanup --fix-missing` 清理记录损坏的条目
- 删除整个 agent
- 磁盘超预算时按最旧淘汰历史会话 —— 见下方"磁盘预算淘汰"

**动作顺序**：

1. `A` `session_transcript_archives`：这一代的对话**压缩后写进数据库**（`archive_blob`，与删除同一事务）
2. `D` `session_windows` → 数据库自动连带删除 `transcript_events`、`transcript_event_identities`、派生表、watermark、`session_pending_inputs`、轨迹等
3. 事务提交后，再导出磁盘文件 `sessions/<id>.jsonl.deleted.<时间戳>[.zst]`
4. `session_nodes` 通常**保留**（`current_session_id` 换成别的）；这个 key 一个 id 都不剩时才删

隐身会话例外：不留归档，直接删。

> **第 1 步和第 3 步是同一份内容的两份压缩副本**（库内 `archive_blob` + 磁盘文件）。所以"先备份、再删行"在磁盘占用上是**先升后降**，不是一步到位。库内那份是权威副本，磁盘那份是给人读的派生物。

#### 磁盘预算淘汰

`maxDiskBytes` 缺省 **10GiB，且默认生效**（只有显式配 `false` / `0` / `"0"` 才关闭；不写任何配置就是 10GiB 生效）。

它是**每个 agent 各自**的物理占用上限，计量范围 = 该 agent 的 SQLite 主文件 + `-wal` + 该 agent `sessions/` 目录下的全部文件（含 `.deleted`/`.reset` 归档、prompt blob）。`-shm` 不计入。

**判断的是"已用量超过 10GiB"，完全不看磁盘剩余空间**——剩余空间只被 worker 调度、备份校验、doctor 引用，与本机制无关。

目标水位 `highWaterBytes` 缺省为 `maxDiskBytes` 的 80%（即 8GiB）。检查时机：每次会话条目写入后检查一次（30 分钟节流）；delete/reset 提交后再强制检查一次（绕过节流，因为删除本身会因新归档而抬高占用）；以及 `openclaw sessions cleanup`。

执行顺序：

1. checkpoint + incremental vacuum，先回收可回收的页（**普通 delete 路径不做这件事**，所以删掉的行留下的空洞会一直占着文件体积，要等预算清理才被压回去）
2. 仍超水位 → 走 ⑧ 剪最旧归档
3. 仍超水位 → 按 `session_windows.updated_at` 最旧优先淘汰历史会话，每淘汰一个就重新计量一次字节，达标即停
4. 候选耗尽仍未达标 → 最后再剪一次归档

**淘汰多少没有固定条数**：淘汰量 = 把占用从 >10GiB 拉回 ≤8GiB 所需的最少条数，1 条或几百条都可能；每轮没有上限。候选是所有未被 live entry 引用、未被 route 指向、无在途 admission、且不在 `preserveRecentMs` 窗口内的 `session_windows` 行（`preserveRecentMs` 缺省 `null`，即不生效）。注意此路径**不**套用 ⑦ 其他触发里的 archived / pinned / main / group / thread 保护——极端压力下那些会话的**旧世代**仍可被淘汰。

### ⑧ 归档被清掉（不可逆）

**触发**（任一）：

- `session.maintenance.resetArchiveRetention` 设了时长且到期（默认 `null` = 永不清；一旦设了时长，则同时管 `.reset.*` 和 `.deleted.*` 两类）
- 磁盘超预算时按最旧优先剪归档 —— 见 ⑦"磁盘预算淘汰"，**排在淘汰会话之前**

**动作**：`D` 磁盘归档文件 + `D` `session_transcript_archives` 行。

删除顺序固定为**先删文件、确认文件没了、再删记录行**——记录行里的压缩数据是"文件丢了还能重建"的副本；反过来先删行，磁盘上会留下数据库已不认识、且再也没人能清理的孤儿文件。

**两个反直觉但有意的行为**：

- **同一轮里可以删掉自己刚生成的 `.deleted` 文件。** 淘汰会话、发布归档之后若仍超水位，会立刻按 mtime 最旧优先再剪一次归档，刚写出的那个完全可能被选中。这是明确取舍：宁可丢一份已提取的副本，也不愿再多毁掉一份仍可搜索的历史——"每个会话的数据最多被毁一次"优先于"保住一份副本"。可压缩的 JSONL 文本（zstd 约 10:1）通常能活下来；不可压缩内容（base64、图片）则很可能被立即回收。
- **未发布的归档永不删除。** `published_at IS NULL` 表示文件尚未导出成功，此时库内 `archive_blob` 是崩溃后唯一的恢复副本，任何压力下都不作为剪除对象。

**到这一步内容才真正消失**，没有回收站。要可追溯只能靠事先的快照备份。

### ⑨ 隐身会话

整个生命周期在内存数据库中，**磁盘上零痕迹**。

---

## 4. 几个需要注意的性质

| # | 性质 | 影响 |
|---|---|---|
| 1 | **每轮对话、reset、压缩（追加式）都只增不改** | 想还原历史应按 `(session_id, seq)` 顺序读 `transcript_events` |
| 2 | **截断式压缩会把 seq 从 0 重排** | 用 seq 做单调增量会重复计数；改用 `event_id` 或时间戳更稳 |
| 3 | **一个 `session_key` 可能有多个 `session_id`** | reset 不换 id，但分叉/重启恢复会换；按 key 汇总时要收齐所有 id |
| 4 | **排队输入不在对话表** | 统计用户消息需额外看 `session_pending_inputs` |
| 5 | **入库内容已脱敏** | 消息文本里的密钥类内容会被替换为掩码；但 `compaction`/`custom` 等事件的正文不走脱敏 |
| 6 | **WAL 模式** | 最新数据可能还在 `-wal`；读取需能访问 `-wal`/`-shm`，只拷主文件会漏 |
| 7 | **派生表是缓存** | 读 `transcript_events` 永远最稳；读派生表可能遇到"待重建/稍后重试" |
| 8 | **归档文件也是数据来源** | 走读历史的链路在库里查不到时会回退去读 `.deleted.zst` 归档文件 |
| 9 | **磁盘预算的牺牲顺序是"先归档、后会话"** | 超预算时优先牺牲已提取的副本，而不是多毁一份仍可搜索的历史 |
| 10 | **删除会让磁盘占用瞬时翻倍** | 同一份对话先落库（`archive_blob`）再导出文件，两份压缩副本并存；不可压缩内容下 ⑧ 可能当轮就回收掉刚生成的那个 |
| 11 | **只有磁盘预算路径会回收 SQLite 空洞** | 普通 delete 释放的页留在文件里不压缩，删会话不会让文件体积下降 |

---

## 5. ⑦⑧ 磁盘预算的源码依据（2026.9.1）

| 结论 | 位置 |
|---|---|
| 10GiB 缺省、缺省即生效 | `0901:src/config/sessions/store-maintenance.ts:30,136` |
| `highWaterBytes` 缺省 80% | `0901:src/config/sessions/store-maintenance.ts:27,160-163` |
| 关闭方式 `false` / `0` / `"0"` | `0901:src/config/sessions/store-maintenance.ts:129-151` |
| 计量 = sqlite 主文件 + `-wal` + `sessions/` 目录（不含 `-shm`） | `0901:src/config/sessions/disk-budget.ts:275-306` |
| 判定用 `>`，不看剩余空间 | `0901:src/config/sessions/session-history-eviction.ts:559` |
| 预算执行主体 | `0901:src/config/sessions/session-history-eviction.ts:551-738` |
| 最旧优先、无条数上限、每轮重算字节 | `0901:src/config/sessions/session-history-eviction.ts:594-709` |
| 候选与保护范围（entry / route / admission / preserveRecent） | `0901:src/config/sessions/session-history-eviction.ts:266-287` |
| "可剪掉本轮刚生成的归档"的取舍注释 | `0901:src/config/sessions/session-history-eviction.ts:692-708`；`0901:src/config/sessions/disk-budget.ts:319-321` |
| 归档剪除：先删文件、再删记录行 | `0901:src/config/sessions/session-history-eviction.ts:362-419` |
| 未发布归档永不剪除 | `0901:src/config/sessions/session-history-eviction.ts:379,438` |
| 空洞回收只在预算路径 | `0901:src/config/sessions/session-history-eviction.ts:289-303,575,664` |
| 归档名格式 `<id>.jsonl.<reason>.<时间戳>[.zst]` | `0901:src/config/sessions/session-accessor.sqlite-archive.ts:115` |
| 库内 `archive_blob`（权威副本） | `0901:src/state/openclaw-agent-schema.sql:400-416` |
| 触发点：写入后 30min 节流 | `0901:src/config/sessions/session-accessor.sqlite-entry.ts:574`；`0901:src/config/sessions/session-history-eviction.ts:450` |
| 触发点：delete/reset 提交后强制 | `0901:src/config/sessions/session-accessor.sqlite-lifecycle.ts:95` |
| 触发点：`openclaw sessions cleanup` | `0901:src/config/sessions/cleanup-service.ts:615` |
| `resetArchiveRetention` 同管两类归档 | `0901:src/config/sessions/store-maintenance-operations.ts:184-198` |
| 行为回归测试 | `0901:src/config/sessions/session-history-eviction.test.ts:196,252,291,318,375` |

官方口径同源：`0901:docs/reference/session-management-compaction.md:53-62`。
