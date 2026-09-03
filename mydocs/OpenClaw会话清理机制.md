# OpenClaw 会话清理机制

> 基准版本：当前 `main`（PR #98236 之后，存储默认 SQLite）。历史版本差异见文末「版本演变」。
> 配套文档：`OpenClaw会话转录与归档生命周期详解.md`（两阶段生命周期的完整推演）

## 核心概念

OpenClaw 的会话（session）由两部分组成：
- **store entry** — SQLite `session_nodes` 表里的一条记录（PR #98236 之前是 `sessions.json` 文件条目），包含 `sessionId`、`updatedAt`、`lastInteractionAt` 等元数据
- **transcript file** — `sessions/<uuid>.jsonl` 文件，存储实际对话消息

清理机制涉及**两个动作**：
1. **从 store 删除 entry** — 条目从 SQLite（旧版 `sessions.json`）中移除
2. **归档 transcript 文件** — 将 `.jsonl` rename 为带后缀的归档文件（不删除）

---

## 1. 归档机制

> 文件存储路径的归档实现在 `session-transcript-files.fs.ts`；SQLite 后端（当前默认）对应实现在 `session-accessor.sqlite-archive.ts` / `session-accessor.sqlite-delete-snapshot.ts`，语义一致（先归档后删行）。

### 1.1 归档文件命名

所有归档都通过 `archiveFileOnDisk` 实现：

```ts
// session-transcript-files.fs.ts:127-142
function archiveFileOnDisk(filePath, reason) {
  const ts = formatSessionArchiveTimestamp();   // ISO 时间戳
  const archived = `${filePath}.${reason}.${ts}`;
  fs.renameSync(filePath, archived);
  return archived;
}
```

**命名格式：**

| 原始文件 | 归档后 |
|---|---|
| `abc123.jsonl` | `abc123.jsonl.reset.2026-05-29T04-00-00.000Z` |
| `abc123.jsonl` | `abc123.jsonl.deleted.2026-05-29T08-00-00.000Z` |

### 1.2 `archiveSessionTranscriptsDetailed` — 归档执行函数

```ts
// session-transcript-files.fs.ts:159-202
function archiveSessionTranscriptsDetailed(opts: {
  sessionId: string;
  sessionFile?: string;
  reason: "reset" | "deleted";
  restrictToStoreDir?: boolean;
}): ArchivedSessionTranscript[]
```

它根据 `sessionId` 和 `sessionFile` 找到对应的 `.jsonl` 文件，对每个文件调用 `archiveFileOnDisk`。

### 1.3 `archiveRemovedSessionTranscripts` — 已删除 entry 的 transcript 归档

```ts
// 文件存储：store.ts:494-519（legacy 位置，已拆分至 store-maintenance-operations.ts）
// SQLite：session-accessor.sqlite-maintenance.ts:213-230（planSessionStateDeleteIfUnreferenced）
async function archiveRemovedSessionTranscripts(params) {
  const { removedSessionFiles, referencedSessionIds } = params;
  for (const [sessionId, sessionFile] of removedSessionFiles) {
    if (referencedSessionIds.has(sessionId)) continue;  // 还有别的 entry 在用，跳过
    archiveSessionTranscripts({ sessionId, reason: "deleted" });
    // → 真正 rename 成 .deleted.
  }
}
```

两步过滤：
1. 从 `removedSessionFiles` 中取出被删 entry 的 sessionId/文件路径
2. `referencedSessionIds` 里还包含这个 sessionId → **跳过**（不归档，因为还有别的 entry 在用）
3. 两边都过了 → rename 成 `.deleted.`

---

## 2. 全部清理路径

### 2.1 Store 维护（prune + cap）

| 位置 | `session-accessor.sqlite-maintenance.ts:100-142` — `applySessionEntryMaintenance`（SQLite 写事务内）；文件存储等价物 `store-maintenance-operations.ts` |
|---|---|
| 触发时机 | 任意条目写入事务时评估（有 SQL 预筛选，非每次全量跑） |
| 影响范围 | 所有 session（`activeSessionKey` 及其 parent 链等受保护 key 除外） |

**pruneStaleEntries — 超时清理**

```ts
// store-maintenance.ts:258-284
function pruneStaleEntries(store, overrideMaxAgeMs?, opts) {
  const maxAgeMs = overrideMaxAgeMs ?? resolveMaintenanceConfig().pruneAfterMs;
  const cutoffMs = Date.now() - maxAgeMs;
  // 默认 30 天
  for (const [key, entry] of Object.entries(store)) {
    if (受保护 key) continue;
    if (entry?.updatedAt != null && entry.updatedAt < cutoffMs) {
      opts.onPruned?.({ key, entry });   // 触发归档 → .deleted.
      delete store[key];
    }
  }
}
```

默认阈值：**30 天**无活动（`updatedAt` 锚点）→ entry 被删，transcript 变 `.deleted.`；无 `updatedAt` 的条目不删。

**capEntryCount — 上限清理**

```ts
// store-maintenance.ts:556-601
function capEntryCount(store, maxEntries, opts) {
  // 默认 500 条
  // 按 updatedAt 降序排，保留最新 N 条，删其余（最旧的先删）
  // 无 updatedAt 的排最后（最先删）
  toRemove.forEach(({ key, entry }) => {
    opts.onCapped?.({ key, entry });  // 触发归档 → .deleted.
    delete store[key];
  });
}
```

默认阈值：**不是超过 500 条就删**，而是攒到 **high-water = 550**（`500 + max(25, ceil(500×0.1)=50)`，见 `store-maintenance.ts:30-32,183-196`）才批量触发，一次性删回 500。`maxEntries ≤ 49` 时走严格模式（high-water = maxEntries + 1）。

### 2.2 Daily Reset（每日重置）

| 位置 | `auto-reply/reply/session.ts:658-668` |
|---|---|
| 触发时机 | 用户发消息时（惰性评估） |
| 影响范围 | 普通对话 session |
| 默认配置 | **未配置 `session.reset` 时无每日重置**（`DEFAULT_RESET_MODE = "none"`，`reset-policy.ts:23`）；显式配置 `mode: "daily"` 后 `atHour` 缺省 4 |

**惰性评估机制（核心设计）：**

```
每天凌晨4点 → 不做任何事（没有定时器）
你发消息 → resolveSession() → evaluateSessionFreshness()
                                ↓
                    sessionStartedAt < today's 4am ?
                                ↓
                      true → stale → 视为新会话（非 ACP 保留原 sessionId）
                                      旧 transcript → .reset.
```

**`resolveDailyResetAtMs` 的实现：**

```ts
// reset-policy.ts:27-36
function resolveDailyResetAtMs(now, atHour) {
  const resetAt = new Date(now);          // 拿今天的日期
  resetAt.setHours(atHour, 0, 0, 0);       // 设到今天的 atHour
  if (now < resetAt.getTime()) {           // 还没到今天 4 点？
    resetAt.setDate(resetAt.getDate() - 1); // 回退到昨天
  }
  return resetAt.getTime();                // 最近一次 atHour
}
```

**判断逻辑：**

```ts
// reset-policy.ts:74-122（evaluateSessionFreshness）
const dailyResetAt = resolveDailyResetAtMs(now=8am, atHour=4);
//                → 今天 04:00
const staleDaily = sessionStartedAt < dailyResetAt;
// 如果 session 是昨天 14:00 开始的 → staleDaily=true
```

**reset 后的行为：**

```ts
// session.ts:765-769 — 非 ACP 会话保留原 sessionId！
sessionId = isAcpSessionKey(sessionKey)
  ? crypto.randomUUID()        // 仅 ACP 会话轮换 ID
  : (entry?.sessionId ?? crypto.randomUUID());
// 注释原文：Durable resets retain their transcript identity for cursor continuity

// 旧 transcript 归档（commitReplySessionInitialization 内部，session-accessor.reset.ts）
// reason: "reset"
// → abc.jsonl → abc.jsonl.reset.<时间戳>

// 同一 sessionKey 的 entry 被 upsert 覆盖（session-accessor.reset.ts:201-243）
```

**store entry 不会被删除**，而是被 upsert 覆盖为新会话元数据（`updatedAt = now`、运行时字段清零；model override、label、delivery route 等用户选择通过 `resolveReplySessionRolloverState` 保留）。`sessions.list` 仍然看得到这个条目。

### 2.3 Idle Reset（空闲重置）

| 位置 | `reset-policy.ts:99-104` |
|---|---|
| 触发时机 | 用户发消息时（惰性评估） |
| 默认 | 关闭（未配置 `session.reset` 时；`DEFAULT_IDLE_MINUTES = 0`，`types.ts:932`，仅作 `mode: "idle"` 未配 `idleMinutes` 时的回退，0 = 永不过期） |

```ts
const idleExpiresAt = lastInteractionAt + idleMinutes * 60_000;
const staleIdle = idleExpiresAt != null && now > idleExpiresAt;
// idleMinutes = 0 → idleExpiresAt = undefined → 永不因空闲过期
```

需要在配置中显式启用：
```json5
{
  session: {
    reset: { mode: "idle", idleMinutes: 60 }
  }
}
```

### 2.4 Cron Session Reaper

| 位置 | `cron/session-reaper.ts:90-206` — `sweepCronRunSessions` |
|---|---|
| 触发时机 | 定时器，最小间隔 5 分钟 |
| 影响范围 | **仅** cron run session（key 含 `:cron:<jobId>:run:`）|
| 默认 retention | **24 小时** |

```ts
// session-reaper.ts:82-98
for (const key of Object.keys(store)) {
  if (!isCronRunSessionKey(key)) continue;   // 跳过非 cron run
  if (updatedAt < cutoff) {                  // 超过 24h
    delete store[key];
  }
}
```

匹配正则（来自 `session-key-utils.ts:50-56`）：

```ts
/^cron:[^:]+:run:[^:]+$/.test(parsed.rest)
// 完整 key 格式: agent:<agentId>:cron:<jobId>:run:<uuid>
```

清理后调用 `archiveRemovedSessionTranscripts({ reason: "deleted" })` → transcript 变 `.deleted.`

**`resolveRetentionMs` — 可配置：**

```ts
// session-reaper.ts:24-37
function resolveRetentionMs(cronConfig?) {
  if (cronConfig?.sessionRetention === false) return null;  // 禁用
  // 否则解析配置值或默认 24h
}
```

### 2.5 Heartbeat Runner 清理

| 位置 | `heartbeat-runner.ts:1442` |
|---|---|
| 触发时机 | heartbeat 轮次切换时 |
| 影响范围 | **仅** isolated heartbeat session |

清理逻辑与 cron reaper 类似，但专门针对 heartbeat 创建的 session。

### 2.6 API/CLI 手动清理

**`sessions.delete`**（`server-methods/sessions.ts:1771`）— 用户手动删除：
```ts
// 从 store 移除 entry
delete store[sessionKey];
// 归档 transcript
archiveRemovedSessionTranscripts({ reason: "deleted" });
```

**`sessions.cleanup`**（`server-methods/sessions.ts:721`）— CLI 命令 `openclaw sessions cleanup`：
```ts
// 按 CLI 参数清理指定条件的 session
```

**`cleanupArchivedSessionTranscripts`** — 物理删除已归档文件：
```ts
// session-transcript-files.fs.ts:250（fs.promises.rm 删除超龄归档文件）
// 当前 main：.deleted. 和 .reset. 统一由 session.maintenance.resetArchiveRetention 控制
//   缺省 null = 永久保留，只受磁盘预算（maxDiskBytes）逐出
//   cron reaper 的归档清理也走同一配置（session-reaper.ts:168）
// v2026.5.28 之前：.deleted. 按 pruneAfter、.reset. 按 resetArchiveRetention（未配置继承 pruneAfter）
```

---

## 3. Cron Job 的会话清理（特殊说明）

Cron job 的 session 受**两层**清理机制影响：

| 层次 | 清理对象 | key 格式 | 机制 | 默认阈值 |
|---|---|---|---|---|
| 第一层 | base cron session | `agent:main:cron:jobId` | daily/idle reset（惰性评估） | 同普通会话（每天4点） |
| 第二层 | cron run session | `agent:main:cron:jobId:run:uuid` | cron reaper（定时器） | 24h |

**第一层**与普通对话共享 `session.reset` 配置，但 cron session reset **不会**将 transcript 归档为 `.reset.`（`run-session-state.ts:29-38` 只是清空字段覆盖 entry）。

**第二层**是独立的 cron run 清理器，默认 24h 后清理所有 `:run:uuid` 子条目 → `.deleted.`。

---

## 4. 配置参考

### 4.1 基础重置策略

```json5
{
  session: {
    reset: {
      mode: "none",         // "none" | "daily" | "idle"；缺省 "none"（不自动重置）
      atHour: 4,            // 每日重置时间（仅 daily 模式），0-23，缺省 4
      idleMinutes: 60,      // 空闲超时分钟（仅 idle 模式）；0 = 永不过期
    }
  }
}
```

### 4.2 按会话类型 / 频道分别配置

```json5
{
  session: {
    resetByType: {
      direct: { mode: "idle", idleMinutes: 30 },
      group:  { mode: "daily", atHour: 6 },
      thread: { mode: "idle", idleMinutes: 120 },
    },
    resetByChannel: {
      discord: { mode: "idle", idleMinutes: 10080 },   // 按频道覆盖
    }
  }
}
// 优先级：resetByType/resetByChannel 覆盖顶层 reset（reset-policy.ts:39-71）
```

### 4.3 Store 维护

```json5
{
  session: {
    maintenance: {
      mode: "enforce",            // "enforce"（缺省，执行删除）| "warn"（只告警不删）
      maxEntries: 500,            // store 上限；high-water = 500+max(25, ceil(500×0.1)) = 550 批量触发
      pruneAfter: "30d",          // 无活动超时时间（updatedAt 锚点）
      maxDiskBytes: "10gb",       // 缺省 10 GiB，sessions 目录磁盘预算，超限最旧优先清理
      highWaterBytes: "8gb",      // 缺省 80% × maxDiskBytes，清理目标水位
    }
  }
}
```

### 4.4 归档文件保留

```json5
{
  session: {
    maintenance: {
      // 注意：在 session.maintenance 下，不是 session 顶层！
      resetArchiveRetention: "30d",  // 时长：.reset./.deleted. 归档超龄删除
                                     // false = 显式禁用按时间删除
                                     // 缺省（未配置）= 永久保留，只受磁盘预算逐出
                                     // "0h"/"0d" 立即清空，doctor 会检测并迁移
    }
  }
}
```

### 4.5 Cron Session Reaper

```json5
{
  cron: {
    sessionRetention: false,   // false=禁用 24h cron run 清理
                               // 或 "12h" = 自定义 retention
  }
}
```

### 4.6 `reset.mode: "none"` 可完全禁用自动重置

`session.reset` 的 zod schema 接受对象（`zod-schema.session.ts:16-22`）：

```ts
const SessionResetConfigSchema = z.object({
  mode: z.union([z.literal("none"), z.literal("daily"), z.literal("idle")]).optional(),
  atHour: z.number().int().min(0).max(23).optional(),
  idleMinutes: z.number().int().positive().optional(),
}).strict();
```

`false`、`null`、字符串均非法；要禁用自动重置请显式配置 `{ mode: "none" }`。

---

## 5. 完整对比表

| 清理路径 | 触发时机 | 影响范围 | store 删除？ | transcript 归档？ | 默认阈值 | 配置项 |
|---|---|---|---|---|---|---|
| **pruneStaleEntries** | 写路径 maintenance（有 stale 候选时） | 所有 session（受保护 key 除外） | ✅ 删 entry | ✅ → `.deleted.` | 30 天无活动 | `session.maintenance.pruneAfter` |
| **capEntryCount** | 写路径 maintenance（entryCount ≥ high-water 550 时） | 所有 session（受保护 key 除外） | ✅ 删最老 entry | ✅ → `.deleted.` | high-water = 500+50 | `session.maintenance.maxEntries` |
| **Daily Reset** | 用户发消息时（惰性） | 普通对话 session | ❌ upsert 覆盖 | ✅ → `.reset.` | 需显式配置；`atHour` 缺省 4 | `session.reset.mode` / `atHour` |
| **Idle Reset** | 用户发消息时（惰性） | 普通对话 session | ❌ upsert 覆盖 | ✅ → `.reset.` | 需显式配置 | `session.reset.idleMinutes` |
| **Cron Reaper** | 每 5+ 分钟定时 | cron run session | ✅ 删 entry | ✅ → `.deleted.` | 24 小时 | `cron.sessionRetention` |
| **Cron Daily Reset** | cron 运行时（惰性） | cron base session | ❌ 仅覆盖 entry | ❌ 无归档 | 同普通会话 | `session.reset.*` |
| **Heartbeat 清理** | 轮次切换时 | heartbeat session | ✅ 删 entry | ✅ → `.deleted.` | 内部计算 | 无 |
| **sessions.delete** | 用户手动操作 | 指定 session | ✅ 删 entry | ✅ → `.deleted.` | N/A | — |
| **sessions.cleanup** | CLI 命令 | 按参数筛选 | ✅ 删 entry | ✅ → `.deleted.` | 由参数决定 | — |
| **cleanupArchivedTranscripts** | 写路径 maintenance + cron reaper | `.reset.` / `.deleted.` 文件 | ❌ 不涉及 store | ❌ 物理删除文件（`fs.rm`） | 缺省永久保留（磁盘预算兜底） | `session.maintenance.resetArchiveRetention` |

---

## 6. 总结

- **惰性评估**（lazy evaluation）是智能设计核心——不在凌晨 4 点设定时器，而是用户发消息时才检查是否需要 reset
- **两种归档后缀**用途不同：`.reset.` 表示对话轮换（entry 被 upsert 覆盖、非 ACP 保留原 sessionId）、`.deleted.` 表示 entry 已从 store 删除
- **归档文件默认永久保留**（PR #98236 之后）——只受磁盘预算（`maxDiskBytes`，缺省 10 GiB）最旧优先逐出；显式设 `resetArchiveRetention` 为时长才开启按时间删除
- **cron reaper 单独管理** cron 运行级的 session，不受全局 `session.reset` 影响；其归档清理走 `resetArchiveRetention`

---

## 7. 版本演变（resetArchiveRetention）

`resetArchiveRetention` 的缺省行为历史上变过两次，查旧资料时注意版本：

| 时期 | 未配置时的行为 | 两种归档的清理时限 |
|---|---|---|
| 引入：PR #24753（`eff3c5c7077`，2026-02-23） | **继承 `pruneAfter`**（默认 30 天）；解析失败也回退 `pruneAfter` | `.deleted.` 按 `pruneAfter`；`.reset.` 按 `resetArchiveRetention` |
| `v2026.5.28`（2026-05-30 发布） | 同上（继承 `pruneAfter` = 30 天） | 同上（`pruneAfter` 一职两用：既删条目产生 `.deleted.`，又删超龄的 `.deleted.` 归档文件；锚点分别是 `updatedAt` 和归档文件名时间戳，所以 30+30=60 天窗口） |
| PR #98236（`0a8e3604ba2`，2026-07-11，SQLite 迁移） | **永久保留**（`null`） | **两种归档统一**跟 `resetArchiveRetention`，只受磁盘预算逐出 |

> PR #98236 commit message：*"resetArchiveRetention now governs both deleted and reset archives and defaults to keep"*

### 7.1 30 天竞争场景（`idleMinutes: 43200` + 其余全默认）

`idleMinutes: 43200`（30 天）恰好与缺省 `pruneAfter: 30d` 同时到期，**谁先触发谁生效**：

- 期间有其它 store 写入（其它会话消息、heartbeat、cron）触发 maintenance → 条目先被 prune（`updatedAt` 锚点）→ `.deleted.`，用户回来是全新会话
- 期间 store 完全无写路径活动 → 用户消息回来那刻 idle 滚动（`lastInteractionAt` 锚点）→ `.reset.`
- 正在交互的会话在 `preserveKeys` 中，不会被 maintenance 误删

现实中有任何其它活动时 `.deleted.` 大概率先发生。详见配套文档《OpenClaw会话转录与归档生命周期详解.md》。
