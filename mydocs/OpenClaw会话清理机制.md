# OpenClaw 会话清理机制

## 核心概念

OpenClaw 的会话（session）由两部分组成：
- **store entry** — `sessions.json` 里的一条记录，包含 `sessionId`、`sessionFile`、`updatedAt` 等元数据
- **transcript file** — `sessions/<uuid>.jsonl` 文件，存储实际对话消息

清理机制涉及**两个动作**：
1. **从 store 删除 entry** — 条目从 `sessions.json` 中移除
2. **归档 transcript 文件** — 将 `.jsonl` rename 为带后缀的归档文件（不删除）

---

## 1. 归档机制

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
// store.ts:494-519
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

| 位置 | `store.ts:317` — `saveSessionStoreUnlocked` |
|---|---|
| 触发时机 | **每次** `updateSessionStore()` 写入时 |
| 影响范围 | 所有 session |

**pruneStaleEntries — 超时清理**

```ts
// store-maintenance.ts:360-416
function pruneStaleEntries(store, overridePruneAfter?) {
  const pruneAfter = overridePruneAfter ?? resolveMaintenanceConfig().pruneAfter;
  // 默认 30 天
  for (const [key, entry] of Object.entries(store)) {
    if (now - lastActive > pruneAfter) {
      onPruned?.({ key, entry });   // 触发 archiveRemovedSessionTranscripts
      delete store[key];
    }
  }
}
```

默认阈值：**30 天**无活动 → entry 被删，transcript 变 `.deleted.`

**capEntryCount — 上限清理**

```ts
// store-maintenance.ts:419-464
function capEntryCount(store, overrideMax?) {
  const maxEntries = overrideMax ?? resolveMaintenanceConfig().maxEntries;
  // 默认 500 条
  // 按 updatedAt 升序排，切掉最老的直到回到上限以下
  toRemove.forEach(({ key, entry }) => {
    onCapped?.({ key, entry });  // 触发 archiveRemovedSessionTranscripts
    delete store[key];
  });
}
```

默认阈值：store 总 entry 数超过 **500 条** → 最老的被删，transcript 变 `.deleted.`

### 2.2 Daily Reset（每日重置）

| 位置 | `auto-reply/reply/session.ts:442-468` |
|---|---|
| 触发时机 | 用户发消息时（惰性评估） |
| 影响范围 | 普通对话 session |
| 默认配置 | `mode: "daily"`, `atHour: 4`（凌晨4点）|

**惰性评估机制（核心设计）：**

```
每天凌晨4点 → 不做任何事（没有定时器）
你发消息 → resolveSession() → evaluateSessionFreshness()
                                ↓
                    sessionStartedAt < today's 4am ?
                                ↓
                      true → stale → 生成新 sessionId
                                      旧 transcript → .reset.
```

**`resolveDailyResetAtMs` 的实现：**

```ts
// reset-policy.ts:23-31
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
// reset-policy.ts:83-94
const dailyResetAt = resolveDailyResetAtMs(now=8am, atHour=4);
//                → 今天 04:00
const staleDaily = sessionStartedAt < dailyResetAt;
// 如果 session 是昨天 14:00 开始的 → staleDaily=true
```

**reset 后的行为：**

```ts
// session.ts:506
sessionId = crypto.randomUUID();         // 新会话 ID

// 第 818-827 行 — 旧 transcript 归档
archiveSessionTranscriptsDetailed({
  sessionId: previousSessionEntry.sessionId,
  sessionFile: previousSessionEntry.sessionFile,
  reason: "reset",
});
// → abc.jsonl → abc.jsonl.reset.2026-05-29T04-00-00.000Z

// 第 791 行 — store entry 更新为新 sessionId
store[sessionKey] = { ...store[sessionKey], ...sessionEntry };
```

**store entry 不会被删除**，只是 `sessionId` 和 `sessionFile` 更新为新值。`sessions.list` 仍然看得到这个条目。

### 2.3 Idle Reset（空闲重置）

| 位置 | `reset-policy.ts:87-90` |
|---|---|
| 触发时机 | 用户发消息时（惰性评估） |
| 默认 | 关闭（`DEFAULT_IDLE_MINUTES = 0`）|

```ts
const idleExpiresAt = lastInteractionAt + idleMinutes * 60_000;
const staleIdle = now > idleExpiresAt;
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

| 位置 | `cron/session-reaper.ts:54-144` — `sweepCronRunSessions` |
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
// session-transcript-files.fs.ts
// 删除超过 olderThanMs 的 .deleted. 或 .reset. 文件
// 由 resetArchiveRetention 或 maintenance.pruneAfter 控制
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
      mode: "daily",        // "daily" | "idle"
      atHour: 4,            // 每日重置时间（仅 daily 模式），0-23
      idleMinutes: 60,      // 空闲超时分钟（仅 idle 模式，或 daily 的辅助）
    }
  }
}
```

### 4.2 按会话类型分别配置

```json5
{
  session: {
    resetByType: {
      direct: { mode: "idle", idleMinutes: 30 },
      group:  { mode: "daily", atHour: 6 },
      thread: { mode: "idle", idleMinutes: 120 },
    }
  }
}
```

### 4.3 Store 维护

```json5
{
  session: {
    maintenance: {
      maxEntries: 500,          // store 上限，超出的最老将被 cap → .deleted.
      pruneAfter: "30d",        // 无活动超时时间
    }
  }
}
```

### 4.4 归档文件保留

```json5
{
  session: {
    resetArchiveRetention: false,  // false=不清除 .reset. 归档文件
                                   // 或 "30d" = 超过 30 天的归档文件自动删除
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

### 4.6 `reset: false` 不是合法值

`session.reset` 的 zod schema 只接受对象：

```ts
const SessionResetConfigSchema = z.object({
  mode: z.union([z.literal("daily"), z.literal("idle")]).optional(),
  atHour: z.number().int().min(0).max(23).optional(),
  idleMinutes: z.number().int().positive().optional(),
}).strict();
```

`false`、`null`、字符串均非法。目前没有提供"完全禁用 session reset"的选项。

---

## 5. 完整对比表

| 清理路径 | 触发时机 | 影响范围 | store 删除？ | transcript 归档？ | 默认阈值 | 配置项 |
|---|---|---|---|---|---|---|
| **pruneStaleEntries** | 每次 store 写入 | 所有 session | ✅ 删 entry | ✅ → `.deleted.` | 30 天无活动 | `session.maintenance.pruneAfter` |
| **capEntryCount** | 每次 store 写入 | 所有 session | ✅ 删最老 entry | ✅ → `.deleted.` | 超过 500 条 | `session.maintenance.maxEntries` |
| **Daily Reset** | 用户发消息时（惰性） | 普通对话 session | ❌ 仅更新 sessionId | ✅ → `.reset.` | 每天凌晨 4 点 | `session.reset.mode` / `atHour` |
| **Idle Reset** | 用户发消息时（惰性） | 普通对话 session | ❌ 仅更新 sessionId | ✅ → `.reset.` | 需显式配置 | `session.reset.idleMinutes` |
| **Cron Reaper** | 每 5+ 分钟定时 | cron run session | ✅ 删 entry | ✅ → `.deleted.` | 24 小时 | `cron.sessionRetention` |
| **Cron Daily Reset** | cron 运行时（惰性） | cron base session | ❌ 仅覆盖 entry | ❌ 无归档 | 同普通会话 | `session.reset.*` |
| **Heartbeat 清理** | 轮次切换时 | heartbeat session | ✅ 删 entry | ✅ → `.deleted.` | 内部计算 | 无 |
| **sessions.delete** | 用户手动操作 | 指定 session | ✅ 删 entry | ✅ → `.deleted.` | N/A | — |
| **sessions.cleanup** | CLI 命令 | 按参数筛选 | ✅ 删 entry | ✅ → `.deleted.` | 由参数决定 | — |
| **cleanupArchivedTranscripts** | 定时或 CLI | `.reset.` / `.deleted.` 文件 | ❌ 不涉及 store | ❌ 物理删除文件 | 同 pruneAfter | `resetArchiveRetention` |

---

## 6. 总结

- **惰性评估**（lazy evaluation）是智能设计核心——不在凌晨 4 点设定时器，而是用户发消息时才检查是否需要 reset
- **两种归档后缀**用途不同：`.reset.` 表示对话轮换（历史留档）、`.deleted.` 表示 entry 已从 store 删除（清理痕迹）
- **归档不是删除**——`.reset.` 和 `.deleted.` 文件默认一直留在磁盘上，除非配置了 `resetArchiveRetention` 或运行了 `sessions cleanup`
- **cron reaper 单独管理** cron 运行级的 session，不受全局 `session.reset` 影响
