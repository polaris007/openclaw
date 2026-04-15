# OpenClaw Token 使用统计文档

> 文档生成时间：2026-04-15  
> 基于代码分析，涵盖 OpenClaw 中 token 统计的完整机制

## 目录

1. [概述](#概述)
2. [Session Log 文件类型](#session-log-文件类型)
3. [Token 统计核心模块](#token-统计核心模块)
4. [CLI 命令](#cli-命令)
5. [网关 API 接口](#网关-api-接口)
6. [聊天命令](#聊天命令)
7. [数据来源与文件处理](#数据来源与文件处理)
8. [使用示例](#使用示例)
9. [常见问题解答](#常见问题解答)

---

## 概述

OpenClaw 提供了完整的 token 使用统计功能，能够统计 input、output、cacheRead、cacheWrite 等多种 token 类型，并支持成本计算。

### 核心特性

- ✅ **完整的 token 统计**：支持 input、output、cacheRead、cacheWrite
- ✅ **成本计算**：支持按模型定价计算成本
- ✅ **多维度聚合**：按天、按模型、按工具、按会话统计
- ✅ **正确的文件处理**：自动处理主文件、reset 文件、deleted 文件
- ✅ **避免重复计数**：排除 .bak 和 .checkpoint 文件

---

## Session Log 文件类型

OpenClaw 的会话日志文件存储在 `~/.openclaw/agents/<agentId>/sessions/` 目录下。

### 文件类型详解

| 文件类型 | 文件名示例 | 生成时机 | 是否统计 | 说明 |
|---------|-----------|---------|---------|------|
| **主文件** | `session-id.jsonl` | 会话进行中 | ✅ 是 | 当前活跃的会话日志 |
| **Reset 文件** | `session-id.jsonl.reset.2026-04-10T11-04-48.721Z` | 执行 `/reset` 或 `/new` 时 | ✅ 是 | 重置前归档的会话 |
| **Deleted 文件** | `session-id.jsonl.deleted.2026-04-13T00-53-49.390Z` | 会话被删除时 | ✅ 是 | 删除前归档的会话 |
| **Backup 文件** | `session-id.jsonl.bak-292-1775810216210` | 文件修复时 | ❌ 否 | 修复损坏文件时的备份 |
| **Checkpoint 文件** | `session-id.checkpoint.uuid.jsonl` | 会话压缩时 | ❌ 否 | 压缩检查点，避免重复计数 |

### 文件生成机制

#### 1. Deleted 文件

**生成位置**：`src/gateway/session-transcript-files.fs.ts:126-131`

```typescript
// archiveFileOnDisk 函数
const ts = formatSessionArchiveTimestamp(Date.now());
const archivePath = `${filePath}.${reason}.${ts}`;
await fs.promises.rename(filePath, archivePath);
```

**触发时机**：
- 会话被删除时（`src/cron/session-reaper.ts`）
- 通过 `archiveRemovedSessionTranscripts()` 函数归档

#### 2. Reset 文件

**生成位置**：`src/auto-reply/reply/session.ts:644-649`

```typescript
// 执行 /reset 或 /new 时
sessionEntry.totalTokens = undefined;
sessionEntry.inputTokens = undefined;
sessionEntry.outputTokens = undefined;

// 归档旧的会话记录
await archiveSessionTranscripts(sessionId, "reset", storePath, sessionEntry?.sessionFile);
```

**触发时机**：
- 用户执行 `/reset` 命令
- 用户执行 `/new` 命令
- 会话状态重置

#### 3. Backup 文件

**生成位置**：`src/agents/session-file-repair.ts:73`

```typescript
const backupPath = `${sessionFile}.bak-${process.pid}-${Date.now()}`;
```

**触发时机**：
- 检测到会话文件损坏时
- 执行文件修复前创建备份

#### 4. Checkpoint 文件

**生成位置**：`src/gateway/session-compaction-checkpoints.ts:73-76`

```typescript
const snapshotFile = path.join(
  parsedSessionFile.dir,
  `${parsedSessionFile.name}.checkpoint.${randomUUID()}${parsedSessionFile.ext || ".jsonl"}`
);
```

**触发时机**：
- 会话压缩（compaction）时
- 创建会话快照用于恢复

---

## Token 统计核心模块

### 模块层级关系

```
用户层
├── CLI 命令 (src/cli/gateway-cli/register.ts)
├── 聊天命令 (src/auto-reply/reply/commands-session.ts)
└── 网关 API (src/gateway/server-methods/usage.ts)
    │
    ↓
统计系统层
└── session-cost-usage.ts (src/infra/session-cost-usage.ts)
    │
    ├── loadCostUsageSummary() - 所有会话汇总
    ├── loadSessionCostSummary() - 单个会话统计
    ├── loadSessionUsageTimeSeries() - 时间序列数据
    ├── loadSessionLogs() - 会话日志
    └── discoverAllSessions() - 发现所有会话
        │
        ↓
数据读取层
└── session-utils.fs.ts (src/gateway/session-utils.fs.ts)
    │
    ├── readLatestSessionUsageFromTranscript() - 读取单个文件
    │
    ↓
数据处理层
└── extractLatestUsageFromTranscriptChunk() - 解析 JSONL 数据
```

### 核心函数详解

#### 1. `loadCostUsageSummary()` - 所有会话汇总统计

**位置**：`src/infra/session-cost-usage.ts:352-441`

**功能**：统计指定时间段内所有会话的 token 使用情况

**参数**：
```typescript
{
  startMs?: number;    // 开始时间戳（毫秒）
  endMs?: number;      // 结束时间戳（毫秒）
  days?: number;       // 天数（向后兼容，默认30）
  config?: OpenClawConfig;
  agentId?: string;
}
```

**返回值**：
```typescript
{
  updatedAt: number;   // 更新时间戳
  days: number;        // 实际统计天数
  daily: CostUsageDailyEntry[];  // 按天聚合的数据
  totals: CostUsageTotals;       // 总计数据
}
```

**CostUsageTotals 结构**：
```typescript
{
  input: number;           // input token 总数
  output: number;          // output token 总数
  cacheRead: number;       // cacheRead token 总数
  cacheWrite: number;      // cacheWrite token 总数
  totalTokens: number;     // 总 token 数
  totalCost: number;       // 总成本（美元）
  inputCost: number;       // input token 成本
  outputCost: number;      // output token 成本
  cacheReadCost: number;   // cacheRead 成本
  cacheWriteCost: number;  // cacheWrite 成本
  missingCostEntries: number;  // 缺少成本数据的条目数
}
```

**关键代码逻辑**：
```typescript
// 第383行：过滤文件
.filter((entry) => entry.isFile() && isUsageCountedSessionTranscriptFileName(entry.name))

// 第391行：基于文件修改时间过滤（可能有 bug）
if (stats.mtimeMs < sinceTime) {
  return null;
}

// 第405行：基于消息时间戳过滤（正确）
const ts = entry.timestamp?.getTime();
if (!ts || ts < sinceTime || ts > untilTime) {
  return;
}
```

#### 2. `loadSessionCostSummary()` - 单个会话完整统计

**位置**：`src/infra/session-cost-usage.ts:544-814`

**功能**：统计单个会话的完整 token 数据，包括按天、按模型、按工具等维度

**参数**：
```typescript
{
  sessionId?: string;
  sessionEntry?: SessionEntry;
  sessionFile?: string;
  config?: OpenClawConfig;
  agentId?: string;
  startMs?: number;
  endMs?: number;
}
```

**返回值**：
```typescript
{
  sessionId?: string;
  sessionFile?: string;
  firstActivity?: number;     // 首次活动时间
  lastActivity?: number;      // 最后活动时间
  durationMs?: number;        // 持续时间（毫秒）
  activityDates?: string[];   // 活动日期列表
  dailyBreakdown?: SessionDailyUsage[];      // 按天分解
  dailyMessageCounts?: SessionDailyMessageCounts[];  // 按天消息数
  dailyLatency?: SessionDailyLatency[];      // 按天延迟统计
  dailyModelUsage?: SessionDailyModelUsage[];  // 按天模型使用
  messageCounts?: SessionMessageCounts;      // 消息计数
  toolUsage?: SessionToolUsage;              // 工具使用统计
  modelUsage?: SessionModelUsage[];          // 模型使用统计
  latency?: SessionLatencyStats;             // 延迟统计
  // ... 加上 CostUsageTotals 的所有字段
}
```

#### 3. `resolveExistingUsageSessionFile()` - 文件路径解析

**位置**：`src/infra/session-cost-usage.ts:289-350`

**功能**：解析会话文件路径，优先使用主文件，如果不存在则查找最新的归档文件

**关键逻辑**：
```typescript
// 第317-324行：过滤候选文件
const entries = fs.readdirSync(sessionsDir, { withFileTypes: true }).filter((entry) => {
  return (
    entry.isFile() &&
    (entry.name === baseFileName ||                                    // 主文件
     entry.name.startsWith(`${baseFileName}.reset.`) ||                // reset 文件
     entry.name.startsWith(`${baseFileName}.deleted.`))                // deleted 文件
  );
});

// 第331-344行：选择最新的归档文件
const latestArchive = entries
  .filter((entry) => isSessionArchiveArtifactName(entry.name))
  .map((entry) => entry.name)
  .toSorted((a, b) => {
    const tsA = parseSessionArchiveTimestamp(a, "deleted") ??
                parseSessionArchiveTimestamp(a, "reset") ?? 0;
    const tsB = parseSessionArchiveTimestamp(b, "deleted") ??
                parseSessionArchiveTimestamp(b, "reset") ?? 0;
    return tsB - tsA || b.localeCompare(a);
  })[0];
```

### 文件过滤函数

**位置**：`src/config/sessions/artifacts.ts`

#### `isUsageCountedSessionTranscriptFileName()`

```typescript
export function isUsageCountedSessionTranscriptFileName(fileName: string): boolean {
  if (isPrimarySessionTranscriptFileName(fileName)) {
    return true;  // 主文件：统计
  }
  return hasArchiveSuffix(fileName, "reset") ||   // reset 文件：统计
         hasArchiveSuffix(fileName, "deleted");   // deleted 文件：统计
  // 注意：.bak 文件不在列表中，不统计
}
```

#### `isPrimarySessionTranscriptFileName()`

```typescript
export function isPrimarySessionTranscriptFileName(fileName: string): boolean {
  if (fileName === "sessions.json") {
    return false;
  }
  if (!fileName.endsWith(".jsonl")) {
    return false;
  }
  return !isSessionArchiveArtifactName(fileName);  // 排除所有归档文件
}
```

---

## CLI 命令

### 1. `openclaw gateway usage-cost`

**功能**：获取使用成本摘要

**语法**：
```bash
openclaw gateway usage-cost [options]
```

**选项**：
- `--days <days>`：统计天数，默认 30
- `--json`：以 JSON 格式输出

**示例**：
```bash
# 获取最近30天的成本统计（默认）
openclaw gateway usage-cost

# 获取最近7天的成本统计
openclaw gateway usage-cost --days 7

# 获取 JSON 格式的完整数据
openclaw gateway usage-cost --days 30 --json
```

**实现位置**：`src/cli/gateway-cli/register.ts:141-161`

**底层调用**：
```typescript
const result = await callGatewayCli("usage.cost", { ...rpcOpts, config }, { days });
```

**返回数据结构**（使用 `--json` 时）：
```json
{
  "updatedAt": 1744617600000,
  "days": 30,
  "totals": {
    "input": 12345,
    "output": 67890,
    "cacheRead": 100,
    "cacheWrite": 50,
    "totalTokens": 80285,
    "totalCost": 15.75,
    "inputCost": 5.25,
    "outputCost": 10.50,
    "cacheReadCost": 0,
    "cacheWriteCost": 0,
    "missingCostEntries": 0
  },
  "daily": [
    {
      "date": "2026-03-16",
      "input": 500,
      "output": 1500,
      "cacheRead": 10,
      "cacheWrite": 5,
      "totalTokens": 2015,
      "totalCost": 0.75,
      "inputCost": 0.25,
      "outputCost": 0.50,
      "cacheReadCost": 0,
      "cacheWriteCost": 0,
      "missingCostEntries": 0
    }
    // ... 其他天
  ]
}
```

### 2. `openclaw gateway call`

**功能**：通用网关方法调用

**语法**：
```bash
openclaw gateway call <method> --params '<json>'
```

**可用方法**：

| 方法名 | 功能 | 参数 |
|-------|------|------|
| `usage.cost` | 所有会话成本汇总 | `{days?: number, startDate?: string, endDate?: string}` |
| `sessions.usage` | 会话使用统计 | `{key?: string, limit?: number, includeContextWeight?: boolean}` |
| `sessions.usage.timeseries` | 会话时间序列 | `{key: string}` |
| `sessions.usage.logs` | 会话日志 | `{key: string, limit?: number}` |

**示例**：
```bash
# 获取最近30天的成本统计
openclaw gateway call "usage.cost" --params '{"days":30}'

# 获取特定日期范围的统计
openclaw gateway call "usage.cost" --params '{"startDate":"2026-03-01","endDate":"2026-03-31"}'

# 获取单个会话的统计
openclaw gateway call "sessions.usage" --params '{"key":"agent:main:session-id"}'

# 获取会话时间序列数据
openclaw gateway call "sessions.usage.timeseries" --params '{"key":"agent:main:session-id"}'

# 获取会话日志
openclaw gateway call "sessions.usage.logs" --params '{"key":"agent:main:session-id","limit":100}'
```

---

## 网关 API 接口

### API 方法列表

**位置**：`src/gateway/server-methods/usage.ts`

#### 1. `usage.cost`

**功能**：获取所有会话的成本使用汇总

**参数**：
```typescript
{
  days?: number;           // 天数（向后兼容）
  startDate?: string;      // 开始日期 YYYY-MM-DD
  endDate?: string;        // 结束日期 YYYY-MM-DD
  mode?: "utc" | "gateway" | "specific";  // 日期解释模式
  utcOffset?: string;      // UTC 偏移，如 "UTC+8"
}
```

**实现位置**：`src/gateway/server-methods/usage.ts:373-384`

```typescript
"usage.cost": async ({ respond, params }) => {
  const config = loadConfig();
  const { startMs, endMs } = parseDateRange({
    startDate: params?.startDate,
    endDate: params?.endDate,
    days: params?.days,
    mode: params?.mode,
    utcOffset: params?.utcOffset,
  });
  const summary = await loadCostUsageSummaryCached({ startMs, endMs, config });
  respond(true, summary, undefined);
},
```

**缓存机制**：
- 缓存 TTL：30 秒
- 避免重复计算相同的日期范围

#### 2. `sessions.usage`

**功能**：获取会话使用统计（单个或多个）

**参数**：
```typescript
{
  key?: string;                    // 特定会话的 key
  limit?: number;                  // 限制返回数量，默认 50
  includeContextWeight?: boolean;  // 是否包含上下文权重
  startDate?: string;
  endDate?: string;
  mode?: "utc" | "gateway" | "specific";
  utcOffset?: string;
}
```

**实现位置**：`src/gateway/server-methods/usage.ts:385-825`

**返回数据**：
```typescript
{
  sessions: SessionUsageEntry[];
  aggregates: SessionsUsageAggregates;
}
```

**SessionUsageEntry 结构**：
```typescript
{
  key: string;
  label?: string;
  sessionId: string;
  updatedAt: number;
  agentId?: string;
  channel?: string;
  chatType?: string;
  origin?: SessionOrigin;
  usage?: SessionCostSummary;  // 包含完整的 token 统计
  contextWeight?: SystemPromptReport | null;
}
```

#### 3. `sessions.usage.timeseries`

**功能**：获取会话使用时间序列数据

**参数**：
```typescript
{
  key: string;  // 会话 key（必需）
}
```

**实现位置**：`src/gateway/server-methods/usage.ts:827-863`

**返回数据**：
```typescript
{
  sessionId?: string;
  points: SessionUsageTimePoint[];
}
```

**SessionUsageTimePoint 结构**：
```typescript
{
  timestamp: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
  cumulativeTokens: number;
  cumulativeCost: number;
}
```

#### 4. `sessions.usage.logs`

**功能**：获取会话日志条目

**参数**：
```typescript
{
  key: string;      // 会话 key（必需）
  limit?: number;   // 限制数量，默认 200，最大 1000
}
```

**实现位置**：`src/gateway/server-methods/usage.ts:864-893`

**返回数据**：
```typescript
{
  logs: SessionLogEntry[];
}
```

**SessionLogEntry 结构**：
```typescript
{
  timestamp: number;
  role: "user" | "assistant" | "tool" | "toolResult";
  content: string;
  tokens?: number;
  cost?: number;
}
```

---

## 聊天命令

### `/usage cost`

**功能**：在对话中查看成本统计

**实现位置**：`src/auto-reply/reply/commands-session.ts:266-303`

**返回内容**：
```
💸 Usage cost
Session $0.03 · 30 tokens
Today $0.15
Last 30d $1.50
```

**时间段说明**：
- **Session**：当前会话的整个生命周期
- **Today**：今天（00:00 - 现在）
- **Last 30d**：最近30天（包含今天）

**代码实现**：
```typescript
// 第267-274行：获取数据
const sessionSummary = await loadSessionCostSummary({...});
const summary = await loadCostUsageSummary({ days: 30, config: params.cfg });

// 第287-292行：计算 Today
const todayKey = new Date().toLocaleDateString("en-CA");
const todayEntry = summary.daily.find((entry) => entry.date === todayKey);
const todayCost = formatUsd(todayEntry?.totalCost);

// 第294-297行：计算 Last 30d
const last30Cost = formatUsd(summary.totals.totalCost);
```

**对应的 CLI 命令**：

| `/usage cost` 显示项 | 对应的 CLI 命令 |
|---------------------|----------------|
| Session | `openclaw gateway call "sessions.usage" --params '{"key":"会话key"}'` |
| Today | `openclaw gateway call "usage.cost" --params '{"days":1}'` |
| Last 30d | `openclaw gateway usage-cost --days 30` |

---

## 数据来源与文件处理

### 数据来源

**问题**：`openclaw gateway usage-cost --days 30 --json` 统计到的 token 数量是从哪里来的？

**答案**：**是从 session log 文件（.jsonl 文件）中统计出来的**。

### 数据流程

```
Session Log 文件 (.jsonl)
    │
    ├── 主文件: session-id.jsonl
    ├── Reset 文件: session-id.jsonl.reset.timestamp
    └── Deleted 文件: session-id.jsonl.deleted.timestamp
    │
    ↓
文件扫描 (isUsageCountedSessionTranscriptFileName)
    │
    ↓
JSONL 行解析 (readJsonlRecords)
    │
    ↓
提取消息中的 usage 字段 (parseTranscriptEntry)
    │
    ↓
累加 token 数量 (applyUsageTotals)
    │
    ↓
返回统计结果
```

### JSONL 文件格式示例

```jsonl
{"type":"message","timestamp":"2026-04-14T12:00:00Z","message":{"role":"user","content":"Hello"}}
{"type":"message","timestamp":"2026-04-14T12:00:05Z","message":{"role":"assistant","content":"Hi!","usage":{"input":10,"output":20,"cacheRead":0,"cacheWrite":0,"total":30}}}
```

### usage 字段位置

在 JSONL 文件中，usage 数据位于：
```typescript
// 位置1：message.usage（最常见）
entry.message.usage

// 位置2：entry.usage（备用）
entry.usage
```

**代码位置**：`src/infra/session-cost-usage.ts:134-136`
```typescript
const usageRaw =
  (message.usage as UsageLike | undefined) ?? 
  (entry.usage as UsageLike | undefined);
```

### 删除 Session Log 文件的影响

**问题**：如果删除了 session log 文件，统计结果会变化吗？

**答案**：**是的，删除 session log 文件会导致统计结果变化**。

#### 影响分析

1. **删除主文件**：
   - 如果存在 reset 或 deleted 归档文件，会使用最新的归档文件
   - 如果没有归档文件，该会话的数据将完全丢失

2. **删除归档文件**：
   - 该时间段的会话历史数据丢失
   - 如果主文件存在，只会统计主文件中的数据（可能不完整）

3. **删除所有文件**：
   - 该会话的所有 token 统计数据完全丢失
   - 无法恢复

#### 文件选择逻辑

**代码位置**：`src/infra/session-cost-usage.ts:317-346`

```typescript
// 第317-324行：查找候选文件
const entries = fs.readdirSync(sessionsDir, { withFileTypes: true }).filter((entry) => {
  return (
    entry.isFile() &&
    (entry.name === baseFileName ||                           // 主文件
     entry.name.startsWith(`${baseFileName}.reset.`) ||       // reset 文件
     entry.name.startsWith(`${baseFileName}.deleted.`))       // deleted 文件
  );
});

// 第326-329行：优先使用主文件
const primary = entries.find((entry) => entry.name === baseFileName);
if (primary) {
  return path.join(sessionsDir, primary.name);
}

// 第331-346行：使用最新的归档文件
const latestArchive = entries
  .filter((entry) => isSessionArchiveArtifactName(entry.name))
  .map((entry) => entry.name)
  .toSorted((a, b) => {
    // 按时间戳降序排序，选择最新的
    const tsA = parseSessionArchiveTimestamp(a, "deleted") ??
                parseSessionArchiveTimestamp(a, "reset") ?? 0;
    const tsB = parseSessionArchiveTimestamp(b, "deleted") ??
                parseSessionArchiveTimestamp(b, "reset") ?? 0;
    return tsB - tsA || b.localeCompare(a);
  })[0];
```

#### 数据丢失风险

| 操作 | 影响 | 恢复可能性 |
|-----|------|-----------|
| 删除主文件，保留归档文件 | 使用归档文件数据 | ✅ 可恢复部分数据 |
| 删除归档文件，保留主文件 | 只统计主文件数据 | ⚠️ 部分历史数据丢失 |
| 删除所有文件 | 完全丢失 | ❌ 不可恢复 |

### sessions.json 的作用

**重要**：`sessions.json` 中存储的 token 数据**不完整**，**不适合**用于完整统计。

**原因**：
1. 执行 `/reset` 或 `/new` 时，token 数据会被清空（`src/auto-reply/reply/session.ts:644-649`）
2. 系统优先使用 session log 文件作为权威数据源（`src/auto-reply/status.ts:499-547`）
3. 只有 cron 会话会立即更新 token 数据到 sessions.json

**sessions.json token 字段**：
```typescript
// src/config/sessions/types.ts:196-204
{
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;  // 标记 totalTokens 是否是最新的快照
}
```

---

## 使用示例

### 1. 查看最近30天的总 token 使用

```bash
openclaw gateway usage-cost --days 30 --json | jq '.totals | {input, output, totalTokens}'
```

**输出**：
```json
{
  "input": 12345,
  "output": 67890,
  "totalTokens": 80285
}
```

### 2. 查看每天的 token 使用趋势

```bash
openclaw gateway usage-cost --days 7 --json | jq '.daily[] | {date, tokens: .totalTokens}'
```

**输出**：
```json
{"date": "2026-04-08", "tokens": 5000}
{"date": "2026-04-09", "tokens": 6200}
{"date": "2026-04-10", "tokens": 7100}
{"date": "2026-04-11", "tokens": 8500}
{"date": "2026-04-12", "tokens": 4200}
{"date": "2026-04-13", "tokens": 9800}
{"date": "2026-04-14", "tokens": 11200}
```

### 3. 查看单个会话的完整统计

```bash
openclaw gateway call "sessions.usage" --params '{"key":"agent:main:6bc1ee54-e320-4144-b77a-bcc1f9e7a5d5","limit":1}' --json
```

### 4. 查看会话的时间序列数据

```bash
openclaw gateway call "sessions.usage.timeseries" --params '{"key":"agent:main:session-id"}' --json
```

### 5. 在对话中快速查看成本

```
用户: /usage cost
```

**输出**：
```
💸 Usage cost
Session $0.03 · 30 tokens
Today $0.15
Last 30d $1.50
```

### 6. 编程方式调用

```typescript
import { 
  loadSessionCostSummary, 
  loadCostUsageSummary 
} from './src/infra/session-cost-usage.js';

// 单个会话统计
const sessionSummary = await loadSessionCostSummary({
  sessionId: '6bc1ee54-e320-4144-b77a-bcc1f9e7a5d5',
  agentId: 'main'
});

console.log('Input tokens:', sessionSummary?.input);
console.log('Output tokens:', sessionSummary?.output);
console.log('Total tokens:', sessionSummary?.totalTokens);

// 所有会话汇总
const globalSummary = await loadCostUsageSummary({
  days: 30,
  agentId: 'main'
});

console.log('Total input tokens:', globalSummary.totals.input);
console.log('Total output tokens:', globalSummary.totals.output);
console.log('Daily breakdown:', globalSummary.daily);
```

---

## 常见问题解答

### Q1: 为什么 `/usage cost` 只显示 Session，没有 Today 和 Last 30d？

**可能原因**：

1. **文件过滤 bug**：
   - `loadCostUsageSummary()` 使用文件修改时间过滤（第391行）
   - 如果文件修改时间太旧，会被错误过滤掉
   - **解决方案**：检查文件修改时间，或修复过滤逻辑

2. **今天没有数据**：
   - 今天还没有使用记录
   - `todayEntry` 为 `undefined`

3. **最近30天没有数据**：
   - `summary.totals.totalCost` 为 `undefined` 或 `0`

**调试方法**：
```bash
# 查看原始数据
openclaw gateway usage-cost --days 30 --json

# 检查文件列表
ls -la ~/.openclaw/agents/main/sessions/
```

### Q2: token 统计数据会重复计数吗？

**答案**：**不会**，如果使用 `session-cost-usage.ts` 提供的函数。

**原因**：
1. 自动排除 `.bak` 文件（修复备份）
2. 自动排除 `.checkpoint` 文件（压缩检查点）
3. 只统计主文件、reset 文件、deleted 文件

**代码位置**：`src/config/sessions/artifacts.ts:37-42`
```typescript
export function isUsageCountedSessionTranscriptFileName(fileName: string): boolean {
  if (isPrimarySessionTranscriptFileName(fileName)) {
    return true;
  }
  return hasArchiveSuffix(fileName, "reset") || 
         hasArchiveSuffix(fileName, "deleted");
  // .bak 文件不在列表中
}
```

### Q3: 为什么 sessions.json 中的 token 数据不准确？

**答案**：sessions.json 不是权威数据源。

**原因**：
1. 执行 `/reset` 或 `/new` 时，token 数据会被清空
2. 系统优先使用 session log 文件作为数据源
3. 只有 cron 会话会立即更新 token 数据

**正确做法**：使用 `loadSessionCostSummary()` 从 session log 文件读取数据。

### Q4: 删除 session log 文件后能恢复数据吗？

**答案**：**不能**。

**建议**：
1. 定期备份 session log 文件
2. 不要手动删除 session log 文件
3. 使用归档功能而不是直接删除

### Q5: 如何查看 input 和 output token 的细分？

**方法1**：使用 `--json` 参数
```bash
openclaw gateway usage-cost --days 30 --json | jq '.totals | {input, output}'
```

**方法2**：调用网关 API
```bash
openclaw gateway call "usage.cost" --params '{"days":30}' --json | jq '.totals'
```

**方法3**：在代码中直接访问
```typescript
const summary = await loadCostUsageSummary({ days: 30 });
console.log('Input:', summary.totals.input);
console.log('Output:', summary.totals.output);
```

### Q6: 如何统计特定时间段的 token 使用？

**方法**：使用 `startDate` 和 `endDate` 参数

```bash
# 统计 2026年3月的数据
openclaw gateway call "usage.cost" --params '{"startDate":"2026-03-01","endDate":"2026-03-31"}' --json
```

### Q7: checkpoint 文件会导致重复计数吗？

**答案**：**不会**。

**原因**：checkpoint 文件被 `isUsageCountedSessionTranscriptFileName()` 排除。

**验证**：
```typescript
// checkpoint 文件名格式：session-id.checkpoint.uuid.jsonl
// 不符合主文件、reset、deleted 的格式，会被排除
```

### Q8: 如何查看某个会话使用了哪些模型？

**方法**：使用 `loadSessionCostSummary()` 的 `modelUsage` 字段

```typescript
const summary = await loadSessionCostSummary({ sessionId: 'session-id' });
console.log('Models used:', summary.modelUsage);
// [
//   { provider: 'openai', model: 'gpt-4', count: 10, totals: {...} },
//   { provider: 'anthropic', model: 'claude-3-opus', count: 5, totals: {...} }
// ]
```

### Q9: 时间范围计算逻辑是怎样的？

**`loadCostUsageSummary({ days: 30 })` 的时间范围**：

```typescript
const days = 30;
const since = new Date(now);
since.setDate(since.getDate() - (days - 1));  // 注意：减 (days-1)，不是减 days
// 例如：今天是 2026-04-14
// 开始日期：2026-04-14 - 29 = 2026-03-16
// 结束日期：2026-04-14
// 实际包含：30天（包含两端）
```

**验证**：
- `days=1`：只包含今天
- `days=30`：包含最近30天（包含今天）

### Q10: 如何理解 `missingCostEntries` 字段？

**含义**：在统计过程中，有些消息条目没有成本数据（API 没有返回成本，或模型定价缺失）。

**代码位置**：`src/infra/session-cost-usage.ts:208-214`
```typescript
const applyCostTotal = (totals: CostUsageTotals, costTotal: number | undefined) => {
  if (costTotal === undefined) {
    totals.missingCostEntries += 1;  // 计数缺失的条目
    return;
  }
  totals.totalCost += costTotal;
};
```

**影响**：如果 `missingCostEntries > 0`，显示时会标注 `(partial)`。

---

## 附录

### 相关文件列表

| 文件路径 | 功能 |
|---------|------|
| `src/infra/session-cost-usage.ts` | 核心统计模块 |
| `src/infra/session-cost-usage.types.ts` | 类型定义 |
| `src/config/sessions/artifacts.ts` | 文件过滤函数 |
| `src/gateway/server-methods/usage.ts` | 网关 API 实现 |
| `src/cli/gateway-cli/register.ts` | CLI 命令注册 |
| `src/auto-reply/reply/commands-session.ts` | 聊天命令实现 |
| `src/gateway/session-utils.fs.ts` | 文件读取工具 |
| `src/auto-reply/status.ts` | 状态显示工具 |

### 关键函数索引

| 函数名 | 位置 | 功能 |
|-------|------|------|
| `loadCostUsageSummary` | session-cost-usage.ts:352 | 所有会话汇总统计 |
| `loadSessionCostSummary` | session-cost-usage.ts:544 | 单个会话完整统计 |
| `loadSessionUsageTimeSeries` | session-cost-usage.ts:816 | 时间序列数据 |
| `loadSessionLogs` | session-cost-usage.ts:919 | 会话日志 |
| `discoverAllSessions` | session-cost-usage.ts:447 | 发现所有会话 |
| `resolveExistingUsageSessionFile` | session-cost-usage.ts:289 | 解析会话文件路径 |
| `isUsageCountedSessionTranscriptFileName` | artifacts.ts:37 | 文件过滤 |
| `extractLatestUsageFromTranscriptChunk` | session-utils.fs.ts:444 | 解析 JSONL 数据 |

### Token 字段完整列表

| 字段名 | 类型 | 说明 |
|-------|------|------|
| `input` | number | input token 数量 |
| `output` | number | output token 数量 |
| `cacheRead` | number | 缓存读取 token 数量 |
| `cacheWrite` | number | 缓存写入 token 数量 |
| `totalTokens` | number | 总 token 数量 |
| `totalCost` | number | 总成本（美元） |
| `inputCost` | number | input token 成本 |
| `outputCost` | number | output token 成本 |
| `cacheReadCost` | number | cacheRead 成本 |
| `cacheWriteCost` | number | cacheWrite 成本 |
| `missingCostEntries` | number | 缺少成本数据的条目数 |

---

**文档结束**

如有疑问或需要补充，请联系开发团队。
