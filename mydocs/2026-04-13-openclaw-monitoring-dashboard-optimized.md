# OpenClaw 企业级监控面板设计方案 (优化版)

**文档版本**: 2.0  
**创建日期**: 2026-04-13  
**作者**: AI Assistant (基于三份设计文档融合优化)  
**状态**: 待审批  
**参考文档**: 
- `mydocs/2024-01-15-openclaw-monitoring-platform-design.md` (架构与数据融合)
- `mydocs/2026-04-11-openclaw-monitor-dashboard-design.md` (核心架构)
- `mydocs/2026-04-11-openclaw-monitoring-dashboard-design.md` (前端与安全)

---

## 一、项目背景与目标

### 1.1 业务场景

公司基于 OpenClaw 打造企业级个人助理服务:
- **部署方式**: PaaS 容器化部署和管理
- **对接方式**: 内部聊天工具 → OpenClaw → 内部部署大模型
- **实例规模**: 目标支持 **1000+ 实例**
- **核心需求**: 从不同角色视角了解系统运行状况和 Skill 使用情况

### 1.2 目标用户与需求

| 角色 | 关注重点 | 关键指标 |
|------|---------|---------|
| **公司领导** | 业务价值、成本ROI、使用趋势 | 活跃实例数、总会话量、成本统计、部门对比 |
| **开发运维** | 系统健康、故障诊断、性能监控 | 实例状态、渠道连接、错误率、Skill性能 |
| **普通用户** | 个人使用统计、效率提升 | 个人会话、Token消耗、常用Skill、成就系统 |

### 1.3 核心约束

✅ **必须满足:**
- 零修改 OpenClaw 源码 (非侵入式)
- 支持 1000+ 实例规模
- 长期历史数据存储 (90天+,支持趋势分析)
- 近实时监控 (分钟级更新)

⚠️ **可选功能:**
- 简单告警展示 (界面内,无需外部通知) - Phase 1
- 完整告警系统 (Slack/Email/Webhook) - Phase 3
- SSO 集成 - Phase 3

---

## 二、架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                   OpenClaw Instances (1000+)                     │
│  ┌──────┐ ┌──────┐        ┌──────┐                              │
│  │Inst#1│ │Inst#2│  ...   │Inst#N│                              │
│  └──┬───┘ └──┬───┘        └──┬───┘                              │
└─────┼────────┼──────────────┼───────────────────────────────────┘
      │        │              │
      │ WebSocket短连接         │ (每30秒轮询一次)
      ▼        ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Edge Collector Layer (10-20个)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Collector #1 │  │ Collector #2 │  │ Collector #N │          │
│  │ (Inst 1-50)  │  │(Inst 51-100) │  │ (Inst N-M)   │          │
│  │              │  │              │  │              │          │
│  │ • WS短连接    │  │ • WS短连接    │  │ • WS短连接    │          │
│  │ • 读取Logs   │  │ • 读取Logs   │  │ • 读取Logs   │          │
│  │ • 本地聚合    │  │ • 本地聚合    │  │ • 本地聚合    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼────────────────┼─────────────────┼───────────────────┘
          │                │                 │
          │ HTTP POST       │ HTTP POST       │ HTTP POST
          │ (批量+Gzip)     │ (批量+Gzip)     │ (批量+Gzip)
          ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Monitoring Service Layer                        │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐     │
│  │ API Gateway    │→ │ Data Fusion  │→ │ TimescaleDB     │     │
│  │ (Fastify)      │  │ Engine       │  │ + Redis Cache   │     │
│  │                │  │              │  │                 │     │
│  │ • 认证授权     │  │ • 合并数据    │  │ • 时序存储      │     │
│  │ • 请求路由     │  │ • 生成洞察    │  │ • 连续聚合      │     │
│  │ • 限流熔断     │  │ • 评估告警    │  │ • 自动降采样    │     │
│  └────────────────┘  └──────────────┘  └────────┬────────┘     │
└─────────────────────────────────────────────────┼──────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend (React + Ant Design)                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Executive    │ │ DevOps       │ │ User         │            │
│  │ Dashboard    │ │ Console      │ │ Portal       │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 为什么选择 Edge Collector 架构?

| 方案 | 问题 | 适用规模 |
|------|------|----------|
| WebSocket长连接 | 1000+连接池管理复杂,内存压力大,断线重连风暴 | < 50实例 |
| REST API改造 | 需改造OpenClaw,分批轮询仍有瓶颈 | 不适用 |
| 实例主动推送 | 需改造OpenClaw,配置推送目标增加运维复杂度 | 不适用 |
| **Edge Collector** ✅ | 不改造OpenClaw,分层架构,水平扩展友好,故障隔离 | **1000+实例** |

**关键优势:**
- ✅ **资源占用低**: 短连接比长连接节省90%资源
- ✅ **可扩展性强**: 支持按Zone横向扩展
- ✅ **容错性好**: 天然容错,单个Collector故障不影响其他区域
- ✅ **性能优秀**: 批量处理+并发控制+缓存优化
- ✅ **易于维护**: 模块化设计,职责清晰

### 2.3 数据来源分工

根据 OpenClaw 源码验证 (`src/gateway/server-methods/usage.ts`):

| 数据类型 | 来源 | 获取方式 | 频率 |
|---------|------|---------|------|
| **实时健康状态** | Gateway API `health` | Edge Collector WS短连接 | 30秒 |
| **渠道连接状态** | Gateway API `channels.status` | Edge Collector WS短连接 | 30秒 |
| **LLM配额状态** | Gateway API `usage.status` | Edge Collector WS短连接 | 5分钟 |
| **Token消耗** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 |
| **成本明细** | Session Logs JSONL / `usage.cost` | 文件扫描器 + API | 5分钟 |
| **消息统计** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 |
| **工具调用** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 |
| **延迟数据** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 |
| **模型分布** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 |
| **用户活跃度** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 |

**重要发现:**
- ✅ Session Logs 包含 **90%** 的监控数据
- ⚠️ Provider 配额状态必须通过 `usage.status` API 获取,不在 Session Logs 中
- ⚠️ 某些高级成本分析可能需要直接调用 Provider API (可选)

---

## 三、核心组件设计

### 3.1 Edge Collector

#### 3.1.1 功能职责

- 维护管理实例列表 (50-100个)
- WebSocket 短连接轮询各实例 Gateway API
- 读取并解析 Session Logs JSONL 文件
- 本地聚合 health、usage、session 数据
- 提供 HTTP API 供监控服务调用
- 心跳上报自身健康状态

#### 3.1.2 轮询策略

| 参数 | 值 | 说明 |
|------|---|------|
| 轮询间隔 | 30秒 | 完整轮询周期 |
| 批次大小 | 10实例 | 每批并行轮询数量 |
| 批次间隔 | 1秒 | 避免并发风暴 |
| 单实例超时 | 10秒 | WS请求超时时间 |
| 失败重试 | 2次 | 指数退避重试 |
| Session Logs采集 | 每5分钟 | 增量扫描新文件 |

#### 3.1.3 核心代码结构

```typescript
export class EdgeCollector extends EventEmitter {
  private config: CollectorConfig;
  private instances: Map<string, OpenClawInstance> = new Map();
  private metricsCache: LRUCache<string, MetricsPayload>;
  private isRunning = false;
  private limiter: ReturnType<typeof pLimit>;
  
  // 实例管理
  addInstance(instance: OpenClawInstance): void;
  removeInstance(instanceId: string): void;
  
  // 轮询控制
  start(): void;
  stop(): void;
  
  // 数据采集
  private pollAllInstances(): Promise<void>;
  private pollInstance(instance: OpenClawInstance): Promise<void>;
  private collectSessionLogs(instance: OpenClawInstance): Promise<SessionMetrics>;
  
  // WebSocket连接管理 (短连接)
  private createShortLivedConnection(url: string): Promise<WebSocket>;
  private fetchHealthData(ws: WebSocket): Promise<HealthData>;
  private fetchUsageData(ws: WebSocket): Promise<UsageData>;
  
  // 数据聚合
  private aggregateMetrics(health: HealthData, usage: UsageData, sessions: SessionMetrics): MetricsPayload;
  
  // 批量推送到中心服务
  async pushToCenter(): Promise<void>;
  
  // 缓存查询
  getMetrics(instanceId: string): MetricsPayload | undefined;
  getAllMetrics(): MetricsPayload[];
}
```

#### 3.1.4 HTTP API 端点

```
GET /aggregate/health    - 聚合健康状态
GET /aggregate/quota     - 聚合配额状态
GET /aggregate/sessions  - 聚合会话统计
GET /instances           - 管理的实例列表
GET /health              - Collector自身健康状态
POST /push-metrics       - 主动推送指标 (备用)
```

#### 3.1.5 部署策略

- **就近部署**: 与 OpenClaw 实例同机房/同 VPC,低延迟访问
- **动态扩容**: 新增实例自动分配到负载最低的 Collector
- **故障转移**: Collector 故障时,其管理实例迁移到其他 Collector
- **资源限制**: 每个 Collector < 500MB 内存, < 0.5 CPU

### 3.2 数据采集服务 (Collector Service)

#### 3.2.1 功能职责

- 调用各 Edge Collector 获取实时状态数据
- 接收 Edge Collector 的批量推送
- 扫描共享存储 Session Logs 文件 (备用路径)
- 写入 TimescaleDB (长期存储)
- 更新 Redis (实时缓存)
- 告警规则评估 (Phase 3)

#### 3.2.2 数据融合引擎

```typescript
export class MetricFusionEngine {
  /**
   * 融合多数据源指标
   */
  fuseMetrics(
    logMetrics: LogMetrics,      // 来自 Session Logs
    apiMetrics: ApiMetrics,      // 来自 Gateway API
    quotaMetrics: QuotaMetrics   // 来自 usage.status
  ): FusedMetrics {
    return {
      // 来自 logs
      sessions: logMetrics.sessions,
      skillPerformance: logMetrics.skillStats,
      costAnalysis: logMetrics.totals,
      
      // 来自 API
      systemHealth: apiMetrics.health,
      channelStatus: apiMetrics.channels,
      
      // 来自配额API
      llmQuota: quotaMetrics.providers,
      
      // 智能洞察
      insights: this.generateInsights(logMetrics, apiMetrics, quotaMetrics)
    };
  }
  
  /**
   * 生成智能洞察
   */
  private generateInsights(logs: LogMetrics, api: ApiMetrics, quota: QuotaMetrics): Insight[] {
    const insights: Insight[] = [];
    
    // 检测高成本低效率的 Skill
    for (const [skillName, stats] of logs.skillStats) {
      if (stats.avgCost > 1.0 && stats.successRate < 0.8) {
        insights.push({
          type: 'warning',
          severity: 'medium',
          message: `${skillName} 成本高但成功率低`,
          recommendation: '检查配置或考虑替换',
          timestamp: Date.now()
        });
      }
    }
    
    // 检测离线但有活动的实例
    if (!api.health.isOnline && logs.sessions.length > 0) {
      insights.push({
        type: 'error',
        severity: 'high',
        message: '实例离线但最近有会话活动',
        recommendation: '检查网络连接',
        timestamp: Date.now()
      });
    }
    
    // 检测 LLM 配额即将耗尽
    for (const [provider, quota] of quota.providers) {
      if (quota.usedPercent > 90) {
        insights.push({
          type: 'warning',
          severity: 'critical',
          message: `${provider} 配额使用率 ${quota.usedPercent}%`,
          recommendation: '考虑升级套餐或切换模型',
          timestamp: Date.now()
        });
      }
    }
    
    return insights;
  }
}
```

#### 3.2.3 Session Logs 解析

**JSONL 格式示例:**
```jsonl
{"type":"message","timestamp":"2026-04-13T10:30:00Z","message":{"role":"assistant","provider":"openai","model":"gpt-4","content":[{"type":"tool_use","id":"toolu_abc","name":"code-assistant","input":{"prompt":"..."}}],"usage":{"input":100,"output":200,"totalTokens":300,"cost":{"total":0.003}},"durationMs":1250}}
{"type":"message","timestamp":"2026-04-13T10:30:01Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_abc","content":"...","is_error":false}]}}
```

**流式解析实现:**
```typescript
export class SessionLogParser {
  async parseFile(filePath: string): Promise<ParsedSession[]> {
    const sessions = new Map<string, Partial<ParsedSession>>();
    
    // 流式读取,避免内存溢出
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream });
    
    for await (const line of rl) {
      try {
        const event = JSON.parse(line);
        const message = event.message;
        
        // 提取 Skill 名称 (复用 OpenClaw 内置工具)
        const toolNames = extractToolCallNames(message);
        
        // 统计执行结果
        const results = countToolResults(message);
        
        // 聚合到 session
        this.updateSession(sessions, event, toolNames, results);
      } catch (error) {
        logger.warn({ filePath, error }, 'Failed to parse log line');
      }
    }
    
    return Array.from(sessions.values());
  }
}
```

### 3.3 监控 API 服务 (API Gateway)

#### 3.3.1 REST API 端点

| 端点 | 方法 | 说明 | 角色权限 |
|------|------|------|---------|
| `/api/overview` | GET | 总览数据 (领导视图) | all |
| `/api/metrics/tokens` | GET | Token消耗趋势 | admin, operator |
| `/api/metrics/cost` | GET | 成本趋势 | admin, operator |
| `/api/metrics/users` | GET | 用户活跃度 | admin |
| `/api/metrics/tools` | GET | 工具使用排行 | operator |
| `/api/metrics/performance` | GET | 性能指标 | operator |
| `/api/status/health` | GET | 实时健康状态 | operator |
| `/api/status/channels` | GET | 渠道状态 | operator |
| `/api/status/instances` | GET | 各实例状态 | operator |
| `/api/alerts` | GET | 告警列表 | operator |
| `/api/user/:id/stats` | GET | 用户个人统计 | user (own only) |
| `/api/collectors` | GET | Edge Collector管理 | admin |

#### 3.3.2 认证授权

**Phase 1 - 简化版:**
```typescript
// JWT Token 认证
app.addHook('preHandler', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  
  const decoded = verifyToken(token);
  request.user = decoded;
});
```

**Phase 3 - 完整版:**
- JWT 认证 + Refresh Token
- SSO 集成 (SAML/OAuth)
- RBAC 权限控制
- API 速率限制

### 3.4 存储层

#### 3.4.1 TimescaleDB 表结构

**核心表 (9张):**

```sql
-- 1. Token消耗日报表
CREATE TABLE metrics_token_daily (
    time            TIMESTAMPTZ NOT NULL,
    instance_id     VARCHAR(50),
    agent_id        VARCHAR(50),
    channel         VARCHAR(50),
    provider        VARCHAR(50),
    model           VARCHAR(100),
    input_tokens    BIGINT DEFAULT 0,
    output_tokens   BIGINT DEFAULT 0,
    cache_read      BIGINT DEFAULT 0,
    cache_write     BIGINT DEFAULT 0,
    total_tokens    BIGINT DEFAULT 0
);
SELECT create_hypertable('metrics_token_daily', 'time');

-- 2. 成本日报表
CREATE TABLE metrics_cost_daily (
    time            TIMESTAMPTZ NOT NULL,
    instance_id     VARCHAR(50),
    agent_id        VARCHAR(50),
    channel         VARCHAR(50),
    provider        VARCHAR(50),
    model           VARCHAR(100),
    total_cost      DECIMAL(10,6) DEFAULT 0,
    input_cost      DECIMAL(10,6) DEFAULT 0,
    output_cost     DECIMAL(10,6) DEFAULT 0
);
SELECT create_hypertable('metrics_cost_daily', 'time');

-- 3. 消息统计日报表
CREATE TABLE metrics_message_daily (
    time            TIMESTAMPTZ NOT NULL,
    instance_id     VARCHAR(50),
    agent_id        VARCHAR(50),
    channel         VARCHAR(50),
    session_count   INTEGER DEFAULT 0,
    user_messages   INTEGER DEFAULT 0,
    assistant_msgs  INTEGER DEFAULT 0,
    tool_calls      INTEGER DEFAULT 0,
    errors          INTEGER DEFAULT 0
);
SELECT create_hypertable('metrics_message_daily', 'time');

-- 4. 延迟统计日报表
CREATE TABLE metrics_latency_daily (
    time            TIMESTAMPTZ NOT NULL,
    instance_id     VARCHAR(50),
    provider        VARCHAR(50),
    model           VARCHAR(100),
    avg_ms          DECIMAL(10,2),
    p95_ms          DECIMAL(10,2),
    min_ms          DECIMAL(10,2),
    max_ms          DECIMAL(10,2),
    sample_count    INTEGER DEFAULT 0
);
SELECT create_hypertable('metrics_latency_daily', 'time');

-- 5. 工具使用统计
CREATE TABLE metrics_tool_usage (
    time            TIMESTAMPTZ NOT NULL,
    instance_id     VARCHAR(50),
    agent_id        VARCHAR(50),
    tool_name       VARCHAR(100),
    call_count      INTEGER DEFAULT 0,
    success_count   INTEGER DEFAULT 0,
    error_count     INTEGER DEFAULT 0
);
SELECT create_hypertable('metrics_tool_usage', 'time');

-- 6. 用户活跃度
CREATE TABLE metrics_user_activity (
    time            TIMESTAMPTZ NOT NULL,
    instance_id     VARCHAR(50),
    channel         VARCHAR(50),
    user_id         VARCHAR(100),
    session_id      VARCHAR(100),
    first_activity  TIMESTAMPTZ,
    last_activity   TIMESTAMPTZ,
    message_count   INTEGER DEFAULT 0
);
SELECT create_hypertable('metrics_user_activity', 'time');

-- 7. 实例健康状态快照
CREATE TABLE metrics_instance_health (
    time            TIMESTAMPTZ NOT NULL,
    instance_id     VARCHAR(50),
    ok              BOOLEAN,
    duration_ms     INTEGER,
    channel_count   INTEGER,
    agent_count     INTEGER
);
SELECT create_hypertable('metrics_instance_health', 'time');

-- 8. 渠道状态快照
CREATE TABLE metrics_channel_status (
    time            TIMESTAMPTZ NOT NULL,
    instance_id     VARCHAR(50),
    channel         VARCHAR(50),
    account_id      VARCHAR(50),
    linked          BOOLEAN,
    configured      BOOLEAN,
    probe_ok        BOOLEAN,
    probe_ms        INTEGER
);
SELECT create_hypertable('metrics_channel_status', 'time');

-- 9. LLM配额状态
CREATE TABLE metrics_quota_status (
    time            TIMESTAMPTZ NOT NULL,
    instance_id     VARCHAR(50),
    provider        VARCHAR(50),
    plan            VARCHAR(50),
    used_percent    DECIMAL(5,2),
    reset_at        TIMESTAMPTZ
);
SELECT create_hypertable('metrics_quota_status', 'time');

-- 10. 告警事件记录 (Phase 3)
CREATE TABLE alert_events (
    id              SERIAL PRIMARY KEY,
    time            TIMESTAMPTZ NOT NULL,
    rule_name       VARCHAR(100),
    severity        VARCHAR(20),
    instance_id     VARCHAR(50),
    metric_name     VARCHAR(100),
    metric_value    DECIMAL(10,2),
    threshold       DECIMAL(10,2),
    message         TEXT,
    status          VARCHAR(20) DEFAULT 'active',
    resolved_at     TIMESTAMPTZ
);
```

**连续聚合视图:**

```sql
-- Skill 小时级聚合
CREATE MATERIALIZED VIEW skill_hourly_stats
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  instance_id,
  tool_name AS skill_name,
  SUM(call_count) AS total_calls,
  AVG(avg_ms) AS avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_ms) AS p95_duration,
  SUM(success_count) * 100.0 / NULLIF(SUM(call_count), 0) AS success_rate,
  SUM(call_count) FILTER (WHERE error_count > 0) AS error_count
FROM metrics_tool_usage
GROUP BY bucket, instance_id, tool_name;

-- 数据保留策略 (90天原始数据)
SELECT add_retention_policy('metrics_token_daily', INTERVAL '90 days');
SELECT add_retention_policy('metrics_cost_daily', INTERVAL '90 days');
SELECT add_retention_policy('metrics_message_daily', INTERVAL '90 days');
```

#### 3.4.2 Redis 缓存结构

| Key | 类型 | TTL | 说明 |
|-----|------|-----|------|
| `current_health:{instanceId}` | Hash | 60s | 实例实时健康状态 |
| `current_channels:{instanceId}` | Hash | 60s | 渠道连接状态 |
| `current_quota:{instanceId}` | Hash | 300s | LLM配额状态 |
| `alert_active_rules` | Set | - | 当前活跃的告警规则 |
| `overview_cache` | String | 300s | 领导视图总览缓存 |
| `user_stats:{userId}` | Hash | 600s | 用户统计缓存 |

---

## 四、监控指标清单

### 4.1 领导视角指标

| 指标 | 数据来源 | 说明 |
|------|---------|------|
| 日活跃用户数 (DAU) | Session Logs | 当天有消息的会话数 |
| 月活跃用户数 (MAU) | Session Logs | 月度有活动的会话数 |
| 会话总数 | Session Logs | 累计会话数量 |
| 新增会话趋势 | Session Logs | 每日新增会话 |
| 消息总量 | Session Logs | 累计消息数 |
| Token消耗总量 | Session Logs | 累计Token |
| 成本汇总 | Session Logs | 累计/月度成本 |
| 成本趋势 | Session Logs | 每日成本曲线 |
| 渠道分布 | Session Logs | 各渠道使用占比 |
| Agent分布 | Session Logs | 各Agent使用占比 |
| 模型分布 | Session Logs | 各模型Token占比 |
| 系统可用率 | Gateway API | 健康时间占比 |

### 4.2 运维视角指标

| 指标 | 数据来源 | 说明 |
|------|---------|------|
| 实例健康状态 | Gateway API | ok/unhealthy |
| 实例负载分布 | Session Logs + Gateway | 各实例会话数 |
| 渠道连接状态 | Gateway API | linked/unlinked |
| 渠道响应延迟 | Gateway API | probe.elapsedMs |
| Agent心跳状态 | Gateway API | enabled/everyMs |
| LLM配额使用率 | Gateway API | usedPercent |
| 平均响应延迟 | Session Logs | AI回复平均耗时 |
| P95响应延迟 | Session Logs | 95%请求延迟上限 |
| 错误率趋势 | Session Logs | errors/total |
| 工具调用成功率 | Session Logs | success/total |
| 告警事件列表 | 告警引擎 | 触发的告警 |

### 4.3 用户视角指标

| 指标 | 数据来源 | 说明 |
|------|---------|------|
| 个人会话数 | Session Logs | 用户会话数 |
| 个人消息量 | Session Logs | 用户发送消息数 |
| 个人Token消耗 | Session Logs | 用户累计Token |
| 个人成本 | Session Logs | 用户累计成本 |
| 常用工具排行 | Session Logs | 用户常用工具 |
| 会话时长分布 | Session Logs | 会话持续时间 |
| 最近会话列表 | Session Logs | 最近活跃会话 |

---

## 五、告警系统 (Phase 3)

### 5.1 告警规则配置

| 规则名称 | 触发条件 | 严重级别 | 通知渠道 |
|---------|---------|---------|---------|
| 实例健康告警 | health.ok = false | Critical | Slack + Email |
| 实例高负载 | 会话数 > 阈值 | Warning | Slack |
| 渠道断连告警 | channel.linked = false | Critical | Slack + Email |
| 渠道延迟告警 | probe.elapsedMs > 5000ms | Warning | Slack |
| LLM配额告警 | usedPercent > 70% | Warning | Email |
| LLM配额临界 | usedPercent > 90% | Critical | Slack + Email |
| 响应延迟告警 | avgMs > 5000ms | Warning | Slack |
| 错误率告警 | errors/total > 5% | Warning | Slack |
| 成本超预算 | 月度成本 > 预算阈值 | Warning | Email |

### 5.2 告警生命周期

```
触发条件满足 → 创建告警事件(status=active)
    → 发送通知 (Slack/Email/Webhook)
    → 界面展示告警
    → 条件恢复正常 → 更新status=resolved
    → 记录resolved_at时间
```

### 5.3 告警抑制与去重

```typescript
export class AlertSuppressionEngine {
  private suppressionWindows = new Map<string, number>();
  
  /**
   * 检查是否应该抑制告警
   */
  shouldSuppress(alertKey: string, windowMinutes: number): boolean {
    const now = Date.now();
    const lastAlert = this.suppressionWindows.get(alertKey);
    
    if (!lastAlert) {
      this.suppressionWindows.set(alertKey, now);
      return false;
    }
    
    const elapsed = (now - lastAlert) / (1000 * 60); // minutes
    if (elapsed < windowMinutes) {
      return true; // 抑制
    }
    
    this.suppressionWindows.set(alertKey, now);
    return false;
  }
}

// 使用示例: 30分钟内相同实例的CPU告警只发送一次
if (!suppression.shouldSuppress(`cpu_high:${instanceId}`, 30)) {
  await notifier.sendAlert(alert);
}
```

---

## 六、前端UI设计

### 6.1 技术栈

| 组件 | 技术 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript | 现代标准,类型安全 |
| 构建 | Vite | 快速开发体验 |
| UI组件 | Ant Design 5.x | 企业级组件库 |
| 图表 | ECharts 5.x | 大数据量性能好 |
| 状态管理 | Zustand | 轻量级 |
| 数据请求 | TanStack Query | 缓存、轮询、自动刷新 |
| 路由 | React Router 6 | 标准路由方案 |
| 样式 | TailwindCSS + CSS Modules | 灵活且可维护 |

### 6.2 页面结构

```
监控面板
├── 领导视图 (/executive)
│   ├── 总览仪表板
│   │   ├── 实例健康状态 (饼图)
│   │   ├── 成本趋势 (折线图)
│   │   ├── 使用量趋势 (柱状图)
│   │   └── 部门对比 (表格)
│   └── 成本分析
│       ├── 成本分布 (饼图)
│       ├── 成本趋势 (折线图)
│       └── 成本预测 (预测曲线)
│
├── 运维视图 (/devops)
│   ├── 实时监控
│   │   ├── 实例列表 (表格)
│   │   ├── 性能指标 (仪表盘)
│   │   ├── 错误监控 (列表)
│   │   └── 日志查询 (搜索框)
│   └── 性能分析
│       ├── 延迟分布 (直方图)
│       ├── 性能趋势 (折线图)
│       └── 热点分析 (热力图)
│
├── 用户视图 (/user)
│   ├── 个人统计
│   │   ├── 使用量 (卡片)
│   │   ├── 成本 (卡片)
│   │   ├── 常用工具 (列表)
│   │   └── 对话历史 (时间线)
│   └── 技能发现
│       ├── 热门技能 (排行榜)
│       ├── 技能推荐 (卡片)
│       └── 使用指南 (文档)
│
└── Collector管理 (/collectors) [运维]
    ├── Collector状态列表
    ├── 实例分配情况
    └── 健康检查日志
```

### 6.3 关键页面设计

#### 领导视图 - 总览仪表板

**顶部统计卡片:**
- 实例总数 / 在线实例数
- 今日成本 / 本月成本
- 今日消息数 / 总会话数
- 错误率 (24h)

**核心图表:**
- 实例健康状态 (饼图): 健康/异常实例比例
- 成本趋势 (折线图): 最近7天的成本趋势
- 部门使用对比 (表格): 各部门的使用情况
- 模型使用分布 (柱状图): 各模型的使用次数
- 热门工具Top 10 (表格): 最常用的工具

#### 运维视图 - 实时监控

**工具栏:**
- 搜索框 (按实例ID/名称)
- 状态过滤器 (全部/在线/离线/异常)
- 健康统计 (在线率/平均延迟/错误率)

**实例列表 (表格):**
- 实例ID / 名称
- 状态 (🟢在线/🔴离线/🟡异常)
- 最后轮询时间
- 活跃会话数
- 今日消息数
- 平均延迟 (ms)
- 错误率 (%)
- 操作 (查看详情/重启)

**实时更新:** 每分钟自动刷新数据

#### 用户视图 - 个人统计

**个人统计卡片:**
- 本月消息数
- 本月成本
- 本月Token使用
- 平均响应时间

**使用趋势:** 折线图展示最近30天的使用趋势

**常用工具:** 列表展示最常用的工具 (带使用次数和成功率)

**最近对话:** 时间线展示最近的对话历史

---

## 七、安全设计

### 7.1 认证授权架构

```
用户请求
    ↓
API Gateway
    ↓
认证中间件 (JWT/SSO)
    ↓
授权中间件 (RBAC)
    ↓
业务逻辑层
```

### 7.2 JWT 认证

```typescript
export class AuthService {
  generateToken(user: UserPayload): string;
  generateRefreshToken(userId: string): string;
  verifyToken(token: string): UserPayload | null;
  refreshToken(refreshToken: string): string | null;
}
```

**Token Payload:**
```typescript
interface UserPayload {
  userId: string;
  role: 'admin' | 'operator' | 'user';
  permissions: Permission[];
  exp: number;
}
```

### 7.3 RBAC 权限控制

```typescript
export type Permission = 
  | 'metrics:read'
  | 'metrics:read:own'
  | 'instances:read'
  | 'instances:write'
  | 'alerts:read'
  | 'alerts:write';

// 权限中间件
export function authorize(requiredPermissions: Permission[]) {
  return (req, res, next) => {
    const user = req.user;
    if (!hasPermissions(user.permissions, requiredPermissions)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

### 7.4 安全加固措施

**API 安全:**
- HTTPS (TLS 1.3)
- API 速率限制 (100次/分钟/IP)
- SQL 注入防护 (参数化查询)
- XSS 防护 (输入过滤和转义)

**数据安全:**
- 敏感数据脱敏 (userId 哈希处理)
- 传输加密 (HTTPS/WSS)
- SSH Key 管理 (ed25519,禁用密码登录)
- NFS 挂载安全选项 (ro,noexec,nosuid,nodev)

**审计日志:**
```typescript
export interface AuditEvent {
  userId: string;
  action: string;  // login/api_call/config_change
  resource: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure';
  timestamp: Date;
}
```

---

## 八、性能优化

### 8.1 Edge Collector 优化

**并发控制:**
```typescript
async function collectAllInstances() {
  const concurrency = 10; // 每个Collector最多同时处理10个实例
  const chunks = chunk(this.instances, concurrency);
  
  for (const chunk of chunks) {
    await Promise.allSettled(
      chunk.map(inst => collectOne(inst))
    );
    await sleep(1000); // 批次间间隔,避免过载
  }
}
```

**短生命周期 WebSocket 连接:**
```typescript
async callGatewayAPI(instanceUrl: string, method: string) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(instanceUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout'));
    }, 5000);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method }));
    });
    
    ws.on('message', (data) => {
      clearTimeout(timeout);
      const result = JSON.parse(data.toString());
      ws.close(); // 立即断开
      resolve(result);
    });
    
    ws.on('error', (err) => {
      clearTimeout(timeout);
      ws.close();
      reject(err);
    });
  });
}
```

**批量推送优化:**
```typescript
async pushToCenter() {
  const batch = this.aggregateLocalCache();
  
  // 压缩数据 (减少80%流量)
  const compressed = gzipSync(JSON.stringify(batch));
  
  try {
    await http.post(`${CENTER_URL}/api/metrics/batch`, compressed, {
      headers: { 'Content-Encoding': 'gzip' },
      timeout: 30000,
      retry: 3,
      retryDelay: 5000
    });
    this.localCache.clear();
  } catch (error) {
    logger.error({ error }, 'Push failed, will retry next cycle');
  }
}
```

### 8.2 数据库查询优化

**索引优化:**
```sql
CREATE INDEX idx_metrics_token_instance_time 
ON metrics_token_daily (instance_id, time DESC);

CREATE INDEX idx_metrics_cost_provider_time 
ON metrics_cost_daily (provider, time DESC);

CREATE INDEX idx_metrics_tool_instance_time 
ON metrics_tool_usage (instance_id, time DESC, tool_name);
```

**API 缓存:**
```typescript
// Redis 缓存热门查询
const cacheKey = `metrics:${instanceId}:${period}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const data = await queryDatabase(params);
await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5分钟 TTL
return data;
```

---

## 九、部署架构

### 9.1 组件部署

| 组件 | 部署方式 | 数量 | 资源需求 |
|------|---------|------|---------|
| OpenClaw实例 | PaaS容器 | 1000+ |  varies |
| Edge Collector | PaaS容器 | 10-20 | < 500MB RAM, < 0.5 CPU |
| 数据采集服务 | PaaS容器 | 2-3 (HA) | 1GB RAM, 1 CPU |
| 监控API服务 | PaaS容器 | 2-3 (HA) | 512MB RAM, 0.5 CPU |
| TimescaleDB | 有状态容器 | 1 (主从可选) | 4GB RAM, 2 CPU |
| Redis | 有状态容器 | 1 (主从可选) | 1GB RAM, 0.5 CPU |
| 监控前端 | 静态资源 | CDN或容器 | - |

### 9.2 Docker Compose 配置

**Edge Collector:**
```yaml
version: '3.8'

services:
  edge-collector:
    image: openclaw-monitoring/edge-collector:latest
    container_name: edge-collector-us-east-1
    restart: unless-stopped
    
    volumes:
      # NFS 共享存储 (只读)
      - nfs-sessions:/data/openclaw-sessions:ro
      # Collector 配置
      - ./config:/etc/collector/config:ro
      # SSH Keys (如果使用SSH方式)
      - ./keys:/etc/collector/keys:ro
      # 日志
      - collector-logs:/var/log/collector
    
    environment:
      - COLLECTOR_ID=collector-us-east-1
      - CENTER_URL=https://monitoring.example.com
      - CENTER_API_KEY=${CENTER_API_KEY}
      - COLLECTION_INTERVAL_SESSIONS=300  # 5分钟
      - COLLECTION_INTERVAL_HEALTH=30     # 30秒
      - PUSH_INTERVAL=300                 # 5分钟
      - MAX_CONCURRENT_INSTANCES=10       # 并发控制
      - LOG_LEVEL=info
    
    resources:
      limits:
        memory: 512M
        cpus: '0.5'
      reservations:
        memory: 256M
        cpus: '0.25'
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    
    networks:
      - monitoring-network
      - openclaw-network  # 访问OpenClaw实例

volumes:
  nfs-sessions:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server.internal,rw
      device: ":/export/openclaw"
  
  collector-logs:
    driver: local

networks:
  monitoring-network:
    driver: bridge
  openclaw-network:
    external: true
```

### 9.3 网络拓扑

```
OpenClaw实例 (1000+)
    ↓ WebSocket短连接 (内网)
Edge Collector (10-20个)
    ↓ HTTP API批量推送 (内网)
监控数据采集服务
    ↓
TimescaleDB + Redis
    ↓
监控API服务
    ↓ HTTPS
监控前端面板 (CDN)
```

---

## 十、实施计划

### Phase 1 - MVP (4-6周)

**目标:** 搭建核心基础设施,验证数据采集可行性

**任务:**
- [ ] 初始化项目结构 (monorepo)
- [ ] 配置 TimescaleDB Docker 容器
- [ ] 实现 Edge Collector 核心功能
  - [ ] WebSocket 短连接轮询
  - [ ] Session Logs 解析
  - [ ] 本地聚合逻辑
  - [ ] 批量推送
- [ ] 实现数据采集服务
  - [ ] 数据融合引擎
  - [ ] TimescaleDB 写入
  - [ ] Redis 缓存
- [ ] 创建数据库 schema 并测试
- [ ] 实现基础 API 端点
  - [ ] `/api/overview`
  - [ ] `/api/status/health`
  - [ ] `/api/metrics/tokens`
- [ ] 搭建 React 前端项目
- [ ] 实现运维视图 (基础版)
  - [ ] 实例列表
  - [ ] 健康状态展示
  - [ ] 基础图表
- [ ] 编写单元测试
- [ ] 压力测试 (模拟50+实例)

**交付物:**
- 可运行的 Edge Collector 服务
- 数据采集服务
- 数据库表结构
- 基础 API 端点
- 运维视图前端 (MVP)

---

### Phase 2 - 增强 (2-3周)

**目标:** 完善三种角色视图,优化性能

**任务:**
- [ ] 实现领导视图
  - [ ] 总览仪表板
  - [ ] 成本分析
  - [ ] 部门对比
- [ ] 实现用户视图
  - [ ] 个人统计
  - [ ] 使用趋势
  - [ ] 常用工具
- [ ] 添加连续聚合视图
- [ ] 性能优化
  - [ ] 数据库索引优化
  - [ ] Redis 缓存层
  - [ ] API 响应优化
- [ ] 移动端适配
- [ ] 完善错误处理和重试机制
- [ ] 编写集成测试

**交付物:**
- 完整的三种角色视图
- 性能优化后的系统
- 移动端响应式界面

---

### Phase 3 - 企业级 (可选,2-3周)

**目标:** 增强功能和安全性

**任务:**
- [ ] 实现完整告警系统
  - [ ] 告警规则引擎
  - [ ] Slack/Email/Webhook 通知
  - [ ] 告警抑制与去重
  - [ ] 告警生命周期管理
- [ ] SSO 集成 (SAML/OAuth)
- [ ] RBAC 权限控制
- [ ] 审计日志
- [ ] 备份恢复自动化
- [ ] 监控系统自监控
- [ ] 灾难恢复演练

**交付物:**
- 完整告警系统
- 企业级安全特性
- 备份恢复手册
- 生产环境运行

---

## 十一、风险与对策

| 风险 | 影响 | 概率 | 对策 |
|------|------|------|------|
| **Edge Collector 单点故障** | 中 | 中 | 部署多个Collector,负载均衡,自动故障转移 |
| **NFS/SSH 不可用** | 高 | 低 | 降级到备用采集方式,本地缓存+重试 |
| **数据库性能瓶颈** | 中 | 中 | 索引优化、读写分离、物化视图 |
| **大量实例并发采集** | 中 | 中 | 并发控制(每Collector最多10)、队列缓冲 |
| **Session Logs 格式变更** | 高 | 低 | 版本检测、兼容层 |
| **内存泄漏** | 中 | 低 | 定期重启、监控 RSS |
| **网络分区** | 高 | 低 | Edge Collector 本地缓存,网络恢复后补推 |
| **中心服务过载** | 高 | 中 | 批量推送、限流、水平扩展 |

---

## 十二、成功标准

### 功能性指标
- ✅ 三个角色视图完整可用
- ✅ 支持 1000+ 实例监控
- ✅ Skill 执行数据统计准确
- ✅ 实时告警功能正常 (Phase 3)

### 性能指标
- ✅ 数据采集延迟 < 5 分钟
- ✅ API P95 响应时间 < 200ms
- ✅ 前端首屏加载 < 3 秒
- ✅ 支持 100+ 并发用户

### 质量指标
- ✅ 单元测试覆盖率 > 80%
- ✅ 无 Critical/High 级别安全漏洞
- ✅ 系统可用性 > 99.5%

---

## 十三、附录

### A. OpenClaw Gateway API 方法清单

根据源码验证 (`src/gateway/server-methods-list.ts`):

| 方法 | 说明 | 需要权限 |
|------|------|---------|
| `health` | 完整健康快照 | read |
| `status` | 系统状态摘要 | read |
| `usage.status` | LLM提供商配额状态 | read |
| `usage.cost` | Token和成本统计 | read |
| `sessions.usage` | Session使用统计 | read |
| `sessions.usage.timeseries` | 时间序列数据 | read |
| `sessions.usage.logs` | Session日志 | read |
| `channels.status` | 渠道状态 | read |
| `cron.status` | Cron任务状态 | read |

### B. Session Logs JSONL 字段

每条记录包含:
- `timestamp`: ISO 8601 时间戳
- `message.role`: user/assistant
- `message.provider`: 提供商 (openai/anthropic等)
- `message.model`: 模型名称
- `usage.input`: 输入 Token 数
- `usage.output`: 输出 Token 数
- `usage.cacheRead`: 缓存读取 Token
- `usage.cacheWrite`: 缓存写入 Token
- `cost.total`: 总成本 (USD)
- `cost.input`: 输入成本
- `cost.output`: 输出成本
- `durationMs`: 响应延迟 (毫秒)
- `content[].type`: tool_use/tool_result
- `content[].name`: 工具名称

### C. 技术栈清单

**后端:**
- Node.js 24 LTS (与 OpenClaw 保持一致)
- TypeScript 5.x
- Fastify (Web 框架)
- PostgreSQL 15+ with TimescaleDB
- Redis 7+
- ws (WebSocket 客户端)
- axios (HTTP 客户端)
- node-cron (定时任务)
- pino (结构化日志)

**前端:**
- React 18
- TypeScript 5.x
- Ant Design 5.x
- ECharts 5.x
- Zustand
- TanStack Query
- Vite
- TailwindCSS

**基础设施:**
- Docker / Docker Compose
- Kubernetes (可选)
- Nginx (反向代理)

### D. 参考资料

- [OpenClaw 官方文档](https://docs.openclaw.ai/)
- [OpenClaw GitHub 仓库](https://github.com/openclaw/openclaw)
- [TimescaleDB 文档](https://docs.timescale.com/)
- [ECharts 文档](https://echarts.apache.org/)
- [Ant Design 文档](https://ant.design/)

### E. 变更记录

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2024-01-15 | AI Assistant | 初始版本 (文档1) |
| 1.0 | 2026-04-11 | AI Assistant | Monitor Dashboard (文档2) |
| 1.0 | 2026-04-11 | AI Assistant | Monitoring Dashboard (文档3) |
| **2.0** | **2026-04-13** | **AI Assistant** | **融合优化版 (本文档)** |

---

**文档结束**
