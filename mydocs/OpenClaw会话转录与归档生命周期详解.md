# OpenClaw 会话转录与归档生命周期详解

> 覆盖版本：`v2026.5.28` 行为对比到当前 `main`（PR #98236 之后的 SQLite 存储）

---

## 1. 核心模型：两阶段生命周期

OpenClaw 的会话由两层构成：

- **Store 条目** — SQLite `session_nodes` 表（旧版 `sessions.json`）里的一条记录，字段含 `sessionId`、`updatedAt`、`lastInteractionAt` 等
- **转录文件** — `sessions/<sessionId>.jsonl`，存储实际对话消息

清理分**两个阶段**，后缀是阶段 1 的产物，磁盘删除是阶段 2：

```
阶段 1：产生归档（重命名，不删文件）
  活跃转录 <sid>.jsonl  ──→  <sid>.jsonl.reset.<时间戳>
                         ──→  <sid>.jsonl.deleted.<时间戳>

阶段 2：清理归档（rm 删除文件）
  已存在的 .reset.* / .deleted.*  ──→  从磁盘删除
```

后缀的产生者和清理者是两套独立的机制、受不同参数控制，混在一起就是所有误解的根源。

---

## 2. 阶段 1：转录文件如何变成 `.reset` / `.deleted`

### 2.1 变成 `.reset.<时间戳>` — 会话滚动

**触发者**：`session.reset` 配置

```json
{
  "session": {
    "reset": { "mode": "idle", "idleMinutes": 43200 }
  }
}
```

**类型**（`src/config/sessions/reset-policy.ts:5`）：

| `mode` | 含义 | 判定依据 |
|---|---|---|
| `daily` | 每日滚动（默认 `atHour: 4` 凌晨 4 点） | `sessionStartedAt < 当日 04:00` |
| `idle` | 空闲超时滚动 | `now > lastInteractionAt + idleMinutes * 60000` |
| `none` | 不自动滚动（未配置 reset 时） | — |

**关键设计：惰性评估（lazy evaluation）** — 没有定时器（`src/auto-reply/reply/session.ts:658-668`）。

```
每天凌晨 4 点          → 什么都不做
用户给该会话发消息      → evaluateSessionFreshness() 检查是否过期
                        → stale → 视为新会话
```

**滚动时的行为**（`src/auto-reply/reply/session.ts:726-769`）：

- `previousSessionEntry` 被捕获，旧转录归档为 `.reset.<时间戳>`（`session-accessor.reset.ts` 里 `SessionEntryLifecycleUpsert`，非 ACP 会话保留同一 `sessionId` 以维持游标连续性）
- Store 条目**不删除**，而是被**覆盖重写**（`updatedAt = now`，运行时字段清零，部分用户选择通过 `resolveReplySessionRolloverState` 保留）
- 触发 `session_end`（reason=`idle`/`daily`）和 `session_start` 钩子

**受影响的参数**：`session.reset`、`session.resetByType`（按 `direct`/`group`/`thread` 分别配置）、`session.resetByChannel`

---

### 2.2 变成 `.deleted.<时间戳>` — 条目删除时归档

`.deleted` 后缀不是某个“删除模式”的产物，而是**任何导致 Store 条目被删除的动作**都会把该条目的转录重命名为 `.deleted.<时间戳>`（`session-accessor.sqlite-maintenance.ts:220` `archiveTranscript: true`）。

| 删除条目的触发者 | 默认阈值 | 配置项 | 源码 |
|---|---|---|---|
| **pruneAfter 超时** | 30 天 | `session.maintenance.pruneAfter` | `store-maintenance.ts:22,258` |
| **maxEntries 上限** | 500 条 | `session.maintenance.maxEntries` | `store-maintenance.ts:24,556` |
| **磁盘预算** | 10 GiB | `session.maintenance.maxDiskBytes` | `store-maintenance.ts:29,95` |
| **cron reaper**（仅 `cron:*:run:*`） | 24 小时 | `cron.sessionRetention` | `cron/session-reaper.ts:19` |
| **手动** `/delete` / `sessions.delete` | — | — | `server-methods/sessions.ts` |
| **CLI** `openclaw sessions cleanup` | 按参数 | — | — |

**`pruneAfter` 细节**（`store-maintenance.ts:258-284`）：

- 判定字段：`entry.updatedAt < now - pruneAfterMs`；无 `updatedAt` 的条目不删
- 触发时机：写路径（任意条目写入事务中 `applySessionEntryMaintenance`，`session-accessor.sqlite-maintenance.ts:100-142`），有 `updatedAt < cutoff` 的候选就跑

**`maxEntries` 细节**（`store-maintenance.ts:30-32,183-207,556-601`）：

- 不是超过 500 就删，而是按 **high-water** 批量触发：

  ```
  500 ≤ 49  → high-water = 500 + 1（严格）
  500 > 49  → high-water = 500 + max(25, ceil(500×0.1)=50) = 550
  ```

  攒到 **550 条**才触发，一次性删回 500（删最旧的 50 条）
- 排序：按 `updatedAt` 降序保留最新的 N 条；无 `updatedAt` 的排最后、最先删

**保护名单**：`activeSessionKey` 及其 `parentSessionKey` 链、`cron`/`subagent` 等受保护 key 不会被 `prune`/`cap` 删除（`session-accessor.sqlite-maintenance.ts:167-172`）

---

### 2.3 阶段 1 对比总表

| 转录归档后缀 | 产生动作 | 触发时机 | Store 条目 |
|---|---|---|---|
| `.reset.<时间戳>` | 会话滚动（惰性评估 stale） | 该会话收到下一条消息时 | **不删除**，覆盖重写 |
| `.deleted.<时间戳>` | 任意条目删除 | 写路径 maintenance / 定时器 / 手动 | **删除** |

---

## 3. 各参数的缺省值与行为

> 未写进配置 = 生效的默认值（`resolveMaintenanceConfig` 解析时填充）

### 3.1 `session.maintenance` 维护参数

| 参数 | 缺省值 | 源码 | 控制行为 |
|---|---|---|---|
| `pruneAfter` | **30 天**（`30*24*60*60*1000` ms） | `store-maintenance.ts:22` | 条目 `updatedAt` 超限 → 删条目 → 产生 `.deleted` |
| `maxEntries` | **500 条** | `store-maintenance.ts:24` | 条目数 ≥ high-water（500 时为 550）→ 按 `updatedAt` 删最旧的 → 产生 `.deleted` |
| `maxDiskBytes` | **10 GiB** | `store-maintenance.ts:29` | sessions 目录超限 → 按最旧优先清理条目+工件 |
| `highWaterBytes` | **80% × maxDiskBytes** | `store-maintenance.ts:26` | 磁盘清理目标水位 |
| `mode` | **`enforce`** | `store-maintenance.ts:25` | `enforce`=执行删除；`warn`=只告警不删（`sqlite-maintenance.ts:115`） |

> 注意：`pruneAfter` / `maxEntries` / `maxDiskBytes` 未配置也会执行；只有 `resetArchiveRetention` 例外（见下）。

### 3.2 `session.reset` 滚动参数

| 参数 | 缺省值 | 说明 |
|---|---|---|
| `mode` | `none`（未配置时不自动滚动） | `daily`/`idle`/`none` |
| `atHour` | `4`（`mode: daily` 时） | `reset-policy.ts:24` |
| `idleMinutes` | 未配置时不启用；`mode: idle` 未配 `idleMinutes` 时取 `DEFAULT_IDLE_MINUTES` | `reset-policy.ts:66` |

### 3.3 归档相关

| 参数 | 缺省值 | 控制行为 |
|---|---|---|
| `session.maintenance.resetArchiveRetention` | **永久保留**（`null`，当前 main） | `.reset.*` / `.deleted.*` 归档文件的按时间清理（见第 4 节） |
| `cron.sessionRetention` | **24 小时** | `cron:*:run:*` 条目的清理；`false` 禁用 |

---

## 4. 阶段 2：`.reset` / `.deleted` 归档文件被从磁盘删除

### 4.1 清理机制

**执行函数**：`cleanupArchivedSessionTranscripts`（`22e4289d3f0:src/gateway/session-transcript-files.fs.ts:250`）

```ts
// 扫描 sessions 目录，按 reason 匹配后缀，解析文件名时间戳
const timestamp = parseSessionArchiveTimestamp(entry, reason);
if (now - timestamp > olderThanMs) {
  await fs.promises.rm(fullPath);   // ← 真正删除磁盘文件
}
```

**调用位置**（当前 `main`，`store-maintenance-operations.ts:182-188` + `cron/session-reaper.ts:168`）：

```ts
// 两种归档用同一时限
rules: [
  { reason: "deleted", olderThanMs: resetArchiveRetentionMs },
  { reason: "reset",   olderThanMs: resetArchiveRetentionMs },
]
```

**触发时机**：写路径 maintenance + cron reaper；扫描 `sessions` 目录中已存在的归档文件。

---

### 4.2 配置项 `resetArchiveRetention`

```json
{
  "session": {
    "maintenance": {
      "resetArchiveRetention": "30d"   // 时长字符串/数字；false=显式禁用；无法解析 fail-safe 到保留
    }
  }
}
```

- 类型：`src/config/types.base.ts:261` `resetArchiveRetention?: string|number|false`
- 解析：`store-maintenance.ts:73-93`，`parseDurationMs`（无单位默认按天）
- 它**只管归档文件**，不管 SQLite 里的历史会话行/可搜索记录（那部分由磁盘预算约束）

**版本演变（关键）**：

| 时期 | `resetArchiveRetention` 未配置时的行为 |
|---|---|
| 引入：PR #24753（`eff3c5c7077`，2026-02-23） | 继承 `pruneAfter`（默认 30 天） |
| `v2026.5.28`（2026-05-30） | 继承 `pruneAfter` = 30 天；`deleted` 归档按 `pruneAfter`、`.reset` 按 `resetArchiveRetention` 分开清理 |
| PR #98236（`0a8e3604ba2`，2026-07-11，SQLite 迁移）| **永久保留**（`null`），两种归档统一跟 `resetArchiveRetention`，只受磁盘预算逐出 |

> PR #98236 的 commit message 原文：*“resetArchiveRetention now governs both deleted and reset archives and defaults to keep”*
> 同时 `resolveResetArchiveRetentionMs` 的签名从 `(maintenance, pruneAfterMs)` 改为 `(maintenance)`，未配置/解析失败的 fallback 从 `return pruneAfterMs` 改为 `return null`。

所以“缺省继承 `pruneAfter`”的说法对应 **#98236 之前**的老行为，当前 `main` 已改为永久保留。

---

### 4.3 `v2026.5.28` 的一个易混点：`pruneAfter` 的一职两用

在 `v2026.5.28` 上 `pruneAfter` 同时参与两个阶段，但锚点不同，不是浪费：

- **条目级**（阶段 1）：`entry.updatedAt` 超 30 天 → 删条目 → 当天产生 `.deleted.<Day30>`
- **归档级**（阶段 2）：`.deleted.*` 文件年龄 `(now - 文件名时间戳)` 超 30 天 → `rm` 删除

时间轴（`pruneAfter=30d`，`resetArchiveRetention` 未配置继承 30d）：

```
Day 0    最后一条消息              <sid>.jsonl                    updatedAt = Day 0
Day 30   条目超限                  → 产生 .deleted.<Day30>        归档年龄 = 0
Day 60   归档文件超限              → rm 删除 .deleted.<Day30>     归档年龄 = 30 天
```

从最后对话到归档彻底消失是 **60 天**窗口。`idleMinutes: 43200`（30 天）与 `pruneAfter: 30d` 重合时，Day 30 那天的 `.reset` vs `.deleted` 竞争见第 5 节。

---

## 5. 深入：30 天场景（`idleMinutes: 43200` + 全默认）

只配了：

```json
{ "session": { "reset": { "mode": "idle", "idleMinutes": 43200 } } }
```

其余全默认（`pruneAfter: 30d`、`maxEntries: 500`、`maxDiskBytes: 10 GiB`、`resetArchiveRetention` 当前永久保留 / 5.28 时 30 天）。

**问题 1：30 天没活动，转录变 `.reset` 还是 `.deleted`？**

两者都是 30 天，同时到期，**谁先触发谁生效**：

- **Idle reset（惰性）**：只在该会话收到下一条消息时评估（`lastInteractionAt` 锚点）
  → stale → 滚动 → `.reset.<时间戳>`，条目 `updatedAt` 刷新，不再满足 prune
- **pruneAfter（写路径）**：任意该 agent 的 store 写入事务跑 `applySessionEntryMaintenance`（`sqlite-maintenance.ts:100-142`，SQL 预筛选 `updated_at < now-30d`），该条目被删 → `.deleted.<时间戳>`
  → 正在交互的会话因在 `preserveKeys`（`activeSessionKey`）中，不会被误删

| 期间是否有其它 store 写入（其它会话消息、heartbeat、cron 等触发 maintenance） | 结果 |
|---|---|
| 有 | 条目先被 prune → `.deleted`；用户回来是全新会话 |
| 完全没有 | 用户消息回来那刻 idle 滚动 → `.reset` |

现实中只要有任何其它活动，`.deleted` 大概率先发生。

**问题 2：30 天之前条目超过 500？**

- 攒到 **high-water = 550** 才触发 `capEntryCount`（`store-maintenance.ts:183-207`），一次性删回 500（删最旧的 50 条，类型不限）
- 排序按 `updatedAt` 降序，无 `updatedAt` 的最先删
- `activeSessionKey` 及其 parent 链受保护，不会被 cap 删
- 被删条目的转录归档为 `.deleted.<时间戳>`（`archiveTranscript: true`），SQLite 行和 trajectory 清理在写锁释放后 best-effort 完成

---

## 6. 其它相关参数与逻辑

| 参数 | 位置/缺省 | 说明 |
|---|---|---|
| `session.maintenance.mode` | `session.maintenance.mode`，缺省 `enforce`（`store-maintenance.ts:25`） | `enforce`=执行条目/磁盘清理；`warn`=只告警不删（`sqlite-maintenance.ts:115`、`store-maintenance-operations.ts:128`） |
| `session.scope` / `session.mainKey` | 会话键作用域 | 影响 `sessionKey` 划分，进而影响 `reset` 按类型/频道的覆盖 |
| `session.resetByType` / `resetByChannel` | 按会话类型/频道覆盖 reset 策略 | `reset-policy.ts:39-71`，`resetByType` 优先于顶层 `reset` |
| `cron.sessionRetention` | `cron.sessionRetention`，缺省 `"24h"` | 仅 `agent:*:cron:*:run:*` run 会话；`false` 禁用（`session-reaper.ts:30`） |
| `maxDiskBytes` / `highWaterBytes` | `10 GiB` / `80%×maxDiskBytes` | sessions 目录磁盘用量超限时按最旧优先清理条目+工件 |

**存储后端说明**（AGENTS.md 约束）：当前默认 SQLite（`session_nodes` 表），`sessions.json` 为历史文件路径；`SQLite` 维护走 `session-accessor.sqlite-maintenance.ts`，文件存储走 `store-maintenance-operations.ts`，逻辑一致、事务边界不同。

---

## 7. 配置示例

```json
{
  "session": {
    "reset": { "mode": "idle", "idleMinutes": 43200 },
    "maintenance": {
      "mode": "enforce",
      "pruneAfter": "30d",
      "maxEntries": 500,
      "maxDiskBytes": "10gb",
      "resetArchiveRetention": "30d"
    }
  },
  "cron": { "sessionRetention": "24h" }
}
```

- 想让 idle 过期归档活得更久 → 显式把 `resetArchiveRetention` 设大（如 `"90d"`）或 `false`（永久保留）
- 想让会话条目更快过期 → 改小 `pruneAfter`
- 想完全不按时间清归档 → `resetArchiveRetention: false`

---

## 8. 常见误区

- **`resetArchiveRetention` 缺省继承 `pruneAfter`** — 仅 #98236 之前正确；当前缺省永久保留
- **`pruneAfter` 把文件变成 `.deleted`** — 不准确。`pruneAfter` 删的是条目，条目删除的副作用才是产生 `.deleted` 归档；归档文件的后续删除在 5.28 上也是 `pruneAfter`，当前已统一到 `resetArchiveRetention`
- **30 天到就变 `.deleted`** — 不一定。`idle` 30 天与 `pruneAfter` 30 天是两套时钟、两种锚点（`lastInteractionAt` vs `updatedAt` / `reason: deleted` vs `reason: reset`），竞争结果取决于期间是否有其它写路径
- **Daily/Idle reset 会删条目** — 不会。reset 是覆盖重写，条目一直留在 store 里
