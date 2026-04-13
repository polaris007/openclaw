# OpenClaw 监控面板设计文档

**版本**: 1.0
**日期**: 2026-04-11
**状态**: 待审批

---

## 一、概述

### 1.1 背景

公司基于OpenClaw打造企业级个人助理服务，使用PaaS容器化部署和管理OpenClaw实例。系统通过内部聊天工具对接OpenClaw，OpenClaw对接内部部署的大模型。当前实例规模目标为1000+，需要一个监控面板从不同角色角度了解系统运行情况。

### 1.2 目标

为以下角色提供量化、可观测的监控数据：

| 角色 | 关注重点 |
|------|---------|
| 公司领导 | 业务价值、使用趋势、成本汇总、系统可用率 |
| 开发运维 | 实例健康、渠道状态、性能指标、告警处理 |
| 普通用户 | 个人使用统计、会话历史、效率指标 |

### 1.3 关键约束

- 不改造OpenClaw源码，使用现有Gateway API和Session Logs文件
- 支持1000+实例规模
- 长期历史数据存储（趋势分析）
- 简单告警展示（界面内展示，无需外部通知）
- 独立服务，通过API获取数据

---

## 二、架构设计

### 2.1 整体架构

采用分层架构设计，引入Edge Collector层解决1000+实例的连接管理问题：

```
┌─────────────────────────────────────────────────────────────────┐
│                      OpenClaw实例层                              │
│  1000+实例，提供WebSocket Gateway API和Session Logs文件          │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Edge Collector层                            │
│  每Collector管理50-100实例，WS短连接轮询，本地聚合                 │
│  数量: ceil(1000/100) = 10个                                    │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                      监控服务层                                   │
│  数据聚合服务 + API服务 + TimescaleDB + Redis                    │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                      前端展示层                                   │
│  React + TypeScript + Ant Design 监控面板                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 为什么选择Edge Collector架构

| 方案 | 问题 |
|------|------|
| WebSocket持久连接 | 1000+连接池管理复杂，内存压力大，断线重连风暴 |
| REST API改造 | 需改造OpenClaw，分批轮询仍有瓶颈 |
| 实例主动推送 | 需改造OpenClaw，配置推送目标增加运维复杂度 |
| **Edge Collector** | 不改造OpenClaw，分层架构，水平扩展友好，故障隔离 |

### 2.3 数据来源分工

| 数据类型 | 来源 | 获取方式 |
|---------|------|---------|
| 实时健康状态 | Gateway API | Edge Collector WS短连接轮询 |
| 渠道连接状态 | Gateway API | Edge Collector WS短连接轮询 |
| Agent心跳状态 | Gateway API | Edge Collector WS短连接轮询 |
| LLM配额状态 | Gateway API | Edge Collector WS短连接轮询 |
| Token消耗 | Session Logs文件 | 文件扫描器异步处理 |
| 成本明细 | Session Logs文件 | 文件扫描器异步处理 |
| 消息统计 | Session Logs文件 | 文件扫描器异步处理 |
| 工具调用 | Session Logs文件 | 文件扫描器异步处理 |
| 延迟数据 | Session Logs文件 | 文件扫描器异步处理 |
| 模型分布 | Session Logs文件 | 文件扫描器异步处理 |
| 用户活跃度 | Session Logs文件 | 文件扫描器异步处理 |

---

## 三、组件设计

### 3.1 Edge Collector

#### 3.1.1 功能职责

- 维护管理实例列表（50-100个）
- WebSocket短连接轮询各实例Gateway API
- 本地聚合health、usage.status数据
- 提供HTTP API供监控服务调用
- 心跳上报自身健康状态

#### 3.1.2 轮询策略

| 参数 | 值 | 说明 |
|------|---|------|
| 轮询间隔 | 30秒 | 完整轮询周期 |
| 批次大小 | 10实例 | 每批并行轮询数量 |
| 批次间隔 | 1秒 | 避免并发风暴 |
| 单实例超时 | 10秒 | WS请求超时时间 |
| 失败重试 | 2次 | 连接失败后重试 |

#### 3.1.3 HTTP API端点

```
GET /aggregate/health    - 聚合健康状态
GET /aggregate/quota     - 聚合配额状态
GET /instances           - 管理的实例列表
GET /health              - Collector自身健康状态
```

#### 3.1.4 部署策略

- 可与OpenClaw实例就近部署（同机房/区域）
- 支持动态扩容：新增实例自动分配到负载最低的Collector
- 故障转移：Collector故障时，其管理实例迁移到其他Collector

---

### 3.2 数据采集服务 (Collector)

#### 3.2.1 功能职责

- 调用各Edge Collector获取实时状态数据
- 扫描共享存储Session Logs文件获取历史数据
- 写入TimescaleDB（长期存储）
- 更新Redis（实时缓存）
- 告警规则评估

#### 3.2.2 文件处理流程

```
扫描共享存储目录
  → 发现新增/变更的JSONL文件
  → 流式解析（避免内存溢出）
  → 提取指标字段（usage、cost、timestamp等）
  → 按时间维度聚合
  → 写入TimescaleDB
```

#### 3.2.3 历史数据重放

初始化时支持重放指定天数的历史数据：
- 扫描指定天数内的所有Session Logs文件
- 批量处理并写入数据库
- 建立完整的历史数据基线

---

### 3.3 监控API服务

#### 3.3.1 REST API端点

| 端点 | 说明 | 角色 |
|------|------|------|
| `GET /api/overview` | 总览数据（领导视图） | 所有 |
| `GET /api/metrics/tokens` | Token消耗趋势 | 领导/运维 |
| `GET /api/metrics/cost` | 成本趋势 | 领导/运维 |
| `GET /api/metrics/users` | 用户活跃度 | 领导 |
| `GET /api/metrics/tools` | 工具使用排行 | 运维 |
| `GET /api/metrics/performance` | 性能指标 | 运维 |
| `GET /api/status/health` | 实时健康状态 | 运维 |
| `GET /api/status/channels` | 渠道状态 | 运维 |
| `GET /api/status/instances` | 各实例状态 | 运维 |
| `GET /api/alerts` | 告警列表 | 运维 |
| `GET /api/user/:id/stats` | 用户个人统计 | 用户 |
| `GET /api/collectors` | Edge Collector管理 | 运维 |

---

### 3.4 存储层

#### 3.4.1 TimescaleDB表结构

```sql
-- Token消耗日报表
CREATE TABLE metrics_token_daily (
    time        TIMESTAMPTZ NOT NULL,
    instance_id VARCHAR(50),
    agent_id    VARCHAR(50),
    channel     VARCHAR(50),
    provider    VARCHAR(50),
    model       VARCHAR(100),
    input_tokens    BIGINT DEFAULT 0,
    output_tokens   BIGINT DEFAULT 0,
    cache_read      BIGINT DEFAULT 0,
    cache_write     BIGINT DEFAULT 0,
    total_tokens    BIGINT DEFAULT 0
);
SELECT create_hypertable('metrics_token_daily', 'time');

-- 成本日报表
CREATE TABLE metrics_cost_daily (
    time        TIMESTAMPTZ NOT NULL,
    instance_id VARCHAR(50),
    agent_id    VARCHAR(50),
    channel     VARCHAR(50),
    provider    VARCHAR(50),
    model       VARCHAR(100),
    total_cost      DECIMAL(10,6) DEFAULT 0,
    input_cost      DECIMAL(10,6) DEFAULT 0,
    output_cost     DECIMAL(10,6) DEFAULT 0
);
SELECT create_hypertable('metrics_cost_daily', 'time');

-- 消息统计日报表
CREATE TABLE metrics_message_daily (
    time        TIMESTAMPTZ NOT NULL,
    instance_id VARCHAR(50),
    agent_id    VARCHAR(50),
    channel     VARCHAR(50),
    session_count   INTEGER DEFAULT 0,
    user_messages   INTEGER DEFAULT 0,
    assistant_msgs  INTEGER DEFAULT 0,
    tool_calls      INTEGER DEFAULT 0,
    errors          INTEGER DEFAULT 0
);
SELECT create_hypertable('metrics_message_daily', 'time');

-- 延迟统计日报表
CREATE TABLE metrics_latency_daily (
    time        TIMESTAMPTZ NOT NULL,
    instance_id VARCHAR(50),
    provider    VARCHAR(50),
    model       VARCHAR(100),
    avg_ms      DECIMAL(10,2),
    p95_ms      DECIMAL(10,2),
    min_ms      DECIMAL(10,2),
    max_ms      DECIMAL(10,2),
    sample_count INTEGER DEFAULT 0
);
SELECT create_hypertable('metrics_latency_daily', 'time');

-- 工具使用统计
CREATE TABLE metrics_tool_usage (
    time        TIMESTAMPTZ NOT NULL,
    instance_id VARCHAR(50),
    agent_id    VARCHAR(50),
    tool_name   VARCHAR(100),
    call_count  INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count   INTEGER DEFAULT 0
);
SELECT create_hypertable('metrics_tool_usage', 'time');

-- 用户活跃度
CREATE TABLE metrics_user_activity (
    time        TIMESTAMPTZ NOT NULL,
    instance_id VARCHAR(50),
    channel     VARCHAR(50),
    user_id     VARCHAR(100),
    session_id  VARCHAR(100),
    first_activity TIMESTAMPTZ,
    last_activity  TIMESTAMPTZ,
    message_count  INTEGER DEFAULT 0
);
SELECT create_hypertable('metrics_user_activity', 'time');

-- 实例健康状态快照
CREATE TABLE metrics_instance_health (
    time        TIMESTAMPTZ NOT NULL,
    instance_id VARCHAR(50),
    ok          BOOLEAN,
    duration_ms INTEGER,
    channel_count INTEGER,
    agent_count   INTEGER
);
SELECT create_hypertable('metrics_instance_health', 'time');

-- 渠道状态快照
CREATE TABLE metrics_channel_status (
    time        TIMESTAMPTZ NOT NULL,
    instance_id VARCHAR(50),
    channel     VARCHAR(50),
    account_id  VARCHAR(50),
    linked      BOOLEAN,
    configured  BOOLEAN,
    probe_ok    BOOLEAN,
    probe_ms    INTEGER
);
SELECT create_hypertable('metrics_channel_status', 'time');

-- LLM配额状态
CREATE TABLE metrics_quota_status (
    time        TIMESTAMPTZ NOT NULL,
    instance_id VARCHAR(50),
    provider    VARCHAR(50),
    plan        VARCHAR(50),
    used_percent DECIMAL(5,2),
    reset_at    TIMESTAMPTZ
);
SELECT create_hypertable('metrics_quota_status', 'time');

-- 告警事件记录
CREATE TABLE alert_events (
    id          SERIAL PRIMARY KEY,
    time        TIMESTAMPTZ NOT NULL,
    rule_name   VARCHAR(100),
    severity    VARCHAR(20),
    instance_id VARCHAR(50),
    metric_name VARCHAR(100),
    metric_value DECIMAL(10,2),
    threshold    DECIMAL(10,2),
    message      TEXT,
    status       VARCHAR(20) DEFAULT 'active',
    resolved_at  TIMESTAMPTZ
);
```

#### 3.4.2 Redis缓存结构

| Key | 类型 | 说明 |
|-----|------|------|
| `current_health_status` | Hash | 各实例实时健康状态 |
| `current_channel_status` | Hash | 各渠道连接状态 |
| `current_quota_status` | Hash | LLM配额状态 |
| `alert_active_rules` | Set | 当前活跃的告警规则 |
| `session_stats_cache` | Hash | 会话统计缓存 |

---

### 3.5 前端监控面板

#### 3.5.1 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript | 现代标准，类型安全 |
| 构建 | Vite | 快速开发体验 |
| UI组件 | Ant Design 5.x | 企业级组件库 |
| 图表 | ECharts | 大数据量性能好 |
| 状态管理 | Zustand | 轻量级 |
| 数据请求 | TanStack Query | 缓存、轮询、自动刷新 |

#### 3.5.2 页面结构

| 页面 | 角色 | 主要内容 |
|------|------|---------|
| 领导视图 | 公司领导 | 业务概览、成本趋势、使用分布、月度报表 |
| 运维视图 | 开发运维 | 实例状态、渠道监控、LLM配额、性能指标、告警中心 |
| 用户视图 | 普通用户 | 个人统计、使用趋势、常用工具、最近会话 |
| Collector管理 | 运维 | Edge Collector状态、实例分配 |

---

## 四、指标清单

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

## 五、告警规则

### 5.1 告警规则配置

| 规则名称 | 触发条件 | 严重级别 |
|---------|---------|---------|
| 实例健康告警 | health.ok = false | Critical |
| 实例高负载 | 会话数 > 阈值 | Warning |
| 渠道断连告警 | channel.linked = false | Critical |
| 渠道延迟告警 | probe.elapsedMs > 5000ms | Warning |
| 认证即将过期 | authAgeMs < 24小时 | Warning |
| LLM配额告警 | usedPercent > 70% | Warning |
| LLM配额临界 | usedPercent > 90% | Critical |
| 响应延迟告警 | avgMs > 5000ms | Warning |
| P95延迟告警 | p95Ms > 10000ms | Warning |
| 错误率告警 | errors/total > 5% | Warning |
| 错误率严重 | errors/total > 20% | Critical |
| 成本超预算 | 月度成本 > 预算阈值 | Warning |

### 5.2 告警生命周期

```
触发条件满足 → 创建告警事件(status=active)
    → 界面展示告警
    → 条件恢复正常 → 更新status=resolved
    → 记录resolved_at时间
```

---

## 六、技术选型

### 6.1 后端技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | Node.js 20 LTS |
| API框架 | Fastify |
| WebSocket客户端 | ws |
| 数据库 | PostgreSQL + TimescaleDB |
| 缓存 | Redis |
| ORM | Prisma |
| 文件处理 | fs + readline（流式解析） |
| 定时任务 | node-cron |

### 6.2 前端技术栈

| 组件 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| UI组件 | Ant Design 5.x |
| 图表 | ECharts |
| 状态管理 | Zustand |
| 数据请求 | TanStack Query |
| 路由 | React Router 6 |
| 样式 | CSS Modules + Tailwind CSS |

---

## 七、部署架构

### 7.1 组件部署

| 组件 | 部署方式 | 说明 |
|------|---------|------|
| OpenClaw实例 | PaaS容器 | 1000+实例，共享存储 |
| Edge Collector | PaaS容器 | 10+实例，就近部署 |
| 数据采集服务 | PaaS容器 | 可多实例 |
| 监控API服务 | PaaS容器 | 可多实例 |
| TimescaleDB | 有状态容器 | 单实例或主从 |
| Redis | 有状态容器 | 单实例或主从 |
| 监控前端 | 静态资源 | CDN或容器 |

### 7.2 网络拓扑

```
OpenClaw实例 (1000+)
    ↓ WS短连接
Edge Collector (10+)
    ↓ HTTP API
监控数据采集服务
    ↓
TimescaleDB + Redis
    ↓
监控API服务
    ↓ HTTP API
监控前端面板
```

---

## 八、项目结构

```
openclaw-monitor/
├── packages/
│   ├── edge-collector/           # Edge Collector服务
│   │   ├── src/
│   │   │   ├── gateway-client.ts
│   │   │   ├── instance-manager.ts
│   │   │   ├── aggregator.ts
│   │   │   ├── api-server.ts
│   │   │   ├── scheduler.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── collector/                # 数据采集服务
│   │   ├── src/
│   │   │   ├── edge-client.ts
│   │   │   ├── file-processor.ts
│   │   │   ├── alert-engine.ts
│   │   │   ├── metrics-writer.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── api/                      # 监控API服务
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── db/
│   │   │   ├── auth/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── web/                      # 前端面板
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── services/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── shared/                   # 共享代码
│       ├── src/
│       │   ├── types/
│       │   ├── constants/
│       │   ├── utils/
│       │   └── index.ts
│       ├── package.json
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.edge.yml
│   ├── docker-compose.prod.yml
│
├── docs/
│   ├── api.md
│   ├── deployment.md
│   ├── configuration.md
│   └── alert-rules.md
│
├── scripts/
│   ├── init-db.ts
│   ├── replay-history.ts
│
├── config/
│   ├── edge-collector.yml
│   ├── alert-rules.yml
│   ├── default.yml
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 九、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Edge Collector故障 | 50实例数据丢失 | 故障转移机制，实例迁移 |
| 共享存储不可用 | 无法读取历史数据 | 本地缓存 + 重试机制 |
| TimescaleDB故障 | 无法写入历史数据 | Redis临时缓存 + 降级模式 |
| 1000+实例同时启动 | Edge Collector连接风暴 | 启动时随机延迟连接 |
| Session Logs文件积压 | 文件处理延迟 | 增加处理并行度 |

---

## 十、后续扩展

| 扩展点 | 说明 |
|------|------|
| 外部告警通知 | 当前仅界面展示，后续可扩展短信/邮件/企业微信 |
| Prometheus集成 | 当前独立系统，后续可暴露Prometheus metrics端点 |
| 多租户支持 | 当前单一公司，后续可支持多组织隔离 |
| 自定义报表 | 当前固定报表，后续可支持用户自定义 |
| AI辅助分析 | 当前人工分析，后续可引入AI识别异常模式 |

---

## 附录：OpenClaw现有API数据映射

### A.1 Gateway WebSocket API方法

| 方法 | 数据 |
|------|------|
| `health` | 完整健康快照、渠道状态、Agent心跳、会话统计 |
| `status` | 系统状态摘要、心跳配置、排队事件 |
| `usage.status` | LLM提供商配额状态、使用百分比、重置时间 |
| `usage.cost` | Token和成本统计、每日趋势 |

### A.2 Session Logs JSONL字段

每条记录包含：
- `timestamp`: 时间戳
- `message.role`: user/assistant
- `usage.input/output/cacheRead/cacheWrite`: Token消耗
- `cost.total/input/output`: 成本明细
- `provider/model`: 模型信息
- `durationMs`: 响应延迟
- `toolNames`: 工具调用

---

**文档编写**: Claude
**审批状态**: 待用户审批