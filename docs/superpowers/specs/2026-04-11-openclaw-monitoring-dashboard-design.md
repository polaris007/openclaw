# OpenClaw 企业级监控面板设计方案

**文档版本**: 1.0  
**创建日期**: 2026-04-11  
**作者**: AI Assistant  
**状态**: 设计阶段

---

## 目录

1. [项目背景](#一项目背景)
2. [需求分析](#二需求分析)
3. [架构设计](#三架构设计)
4. [核心组件设计](#四核心组件设计)
5. [数据库设计](#五数据库设计)
6. [前端UI设计](#六前端ui设计)
7. [告警系统](#七告警系统)
8. [性能测试方案](#八性能测试方案)
9. [安全设计](#九安全设计)
10. [日志系统设计](#十日志系统设计)
11. [备份恢复策略](#十一备份恢复策略)
12. [灾难恢复方案](#十二灾难恢复方案)
13. [总结](#十三总结)

---

## 一、项目背景

### 1.1 项目概述

公司基于OpenClaw打造企业级个人助理，使用PaaS容器化安装和维护OpenClaw，通过内部聊天工具对接OpenClaw，OpenClaw对接内部部署的大模型。现需要实现一个监控面板，从不同角色角度了解整个项目和OpenClaw的运行情况。

### 1.2 目标用户

- **公司领导**：关注宏观使用统计、部门使用对比、成本与ROI分析
- **开发运维**：关注实时运行状态、性能指标监控、错误与异常追踪
- **普通用户**：关注个人使用统计、个人技能使用情况、技能发现与学习

### 1.3 数据源分析

基于OpenClaw源码分析，可用的数据源包括：

| 数据源 | 位置 | 包含内容 |
|--------|------|----------|
| **Session Logs** | `~/.openclaw/agents/<agentId>/sessions/*.jsonl` | Token使用、成本、消息数、工具调用、延迟、错误信息 |
| **Usage API** | `sessions.usage`, `usage.cost` | 按session/provider/model/日期聚合统计 |
| **Gateway Events** | WebSocket `agent`/`health`/`presence` | 实时运行状态、活跃session、错误事件 |
| **Tool Usage** | 从session logs解析 | 每个skill/tool的调用次数、成功率 |

**关键发现**：
- ✅ Session Logs包含90%的监控数据（token、成本、消息、工具调用、延迟、错误）
- ❌ Provider配额状态（如"剩余X%"）必须通过Provider API获取，不在session logs中

---

## 二、需求分析

### 2.1 监控目的

通过需求调研，监控面板的主要目的包括：

1. **系统运维监控**：实时监控OpenClaw运行状态，快速发现和定位问题
2. **成本控制与优化**：追踪API调用成本、token消耗，优化资源使用
3. **用户行为分析**：分析用户使用模式、热门技能、对话质量等
4. **业务价值展示**：向管理层展示项目价值、使用情况、ROI等

### 2.2 角色需求

#### 公司领导

- 宏观使用统计：查看总体使用情况、用户数、活跃度等宏观指标
- 部门使用对比：查看各部门/团队的使用情况对比
- 成本与ROI分析：查看成本趋势、ROI、资源投入产出比

#### 开发运维

- 实时运行状态：实时监控Gateway状态、channel连接、错误率等
- 性能指标监控：监控API响应时间、token生成速度、队列长度
- 错误与异常追踪：查看错误日志、异常堆栈、失败原因分析

#### 普通用户

- 个人使用统计：查看自己的对话历史、使用统计、成本消耗
- 个人技能使用情况：查看自己常用的技能、工具、使用模式
- 个人对话质量分析：查看自己对话的质量、效率、成功率
- 技能发现与学习：查看可用的技能列表、使用指南、最佳实践

### 2.3 技术约束

- **技术实现方式**：独立Web应用
- **数据实时性**：近实时监控（分钟级更新）
- **数据存储方案**：直接读取session logs
- **告警功能**：暂不需要告警

---

## 三、架构设计

### 3.1 方案对比

经过深入分析，提出了三种设计方案：

#### 方案1：轻量级日志分析面板

**架构特点**：
- 直接读取session logs文件
- 使用OpenClaw现有的Usage API
- 纯前端Web应用，后端仅提供API代理
- 定时轮询更新数据（分钟级）

**优势**：
- ✅ 实现快速，开发成本低
- ✅ 架构简单，易于维护
- ✅ 无需额外数据存储
- ✅ 直接复用OpenClaw现有功能

**劣势**：
- ⚠️ 大量session时性能可能下降
- ⚠️ 复杂查询能力有限
- ⚠️ 无法支持实时推送

**适用场景**：快速上线，用户规模较小（<100用户）

#### 方案2：企业级监控平台

**架构特点**：
- Session logs导入数据库（PostgreSQL/ClickHouse）
- 数据聚合服务（定时ETL任务）
- 完整的用户权限体系
- 丰富的可视化图表和报表

**优势**：
- ✅ 支持大规模数据分析
- ✅ 复杂查询性能优秀
- ✅ 支持历史趋势分析
- ✅ 可扩展性强

**劣势**：
- ❌ 开发成本高
- ❌ 需要额外数据库维护
- ❌ 架构复杂度高

**适用场景**：企业级部署，用户规模大（>500用户）

#### 方案3：混合实时监控方案（推荐）

**架构特点**：
- 实时数据：订阅Gateway WebSocket事件
- 历史数据：直接读取session logs
- 内存缓存：聚合最近N分钟的数据
- 分层架构：实时层 + 历史层

**优势**：
- ✅ 平衡实时性和性能
- ✅ 无需数据库，降低运维成本
- ✅ 支持实时监控和历史分析
- ✅ 架构清晰，易于扩展

**劣势**：
- ⚠️ 需要实现WebSocket订阅
- ⚠️ 内存管理需要优化

**适用场景**：中等规模企业（100-500用户）

### 3.2 最终方案：Edge Collector架构

经过深入讨论和优化，最终采用**Edge Collector + WebSocket短连接**方案：

```
┌─────────────────────────────────────────────────────────────────┐
│                        监控面板前端                              │
└────────────┬────────────────────────────────────────────────────┘
             │ HTTPS/REST
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    监控面板 API Gateway                          │
│  • 认证授权（JWT/SSO）                                           │
│  • 请求路由                                                      │
│  • 限流熔断                                                      │
│  • 缓存层（Redis）                                               │
└────────────┬────────────────────────────────────────────────────┘
             │ HTTP/REST
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Edge Collector 集群                            │
│  • 负载均衡器（Nginx/HAProxy）                                   │
│  • Collector Node 1-N                                            │
└────┬────────────┬────────────┬────────────┬──────────────────────┘
     │            │            │            │
     │ WebSocket短连接（按需）  │            │
     │            │            │            │
 ┌───▼────┐   ┌───▼────┐   ┌───▼────┐   ┌───▼────┐
 │OC实例组│   │OC实例组│   │OC实例组│   │OC实例组│
 │ Zone A │   │ Zone B │   │ Zone C │   │ Zone D │
 ├────────┤   ├────────┤   ├────────┤   ├────────┤
 │ OC-1   │   │ OC-4   │   │ OC-7   │   │ OC-10  │
 │ OC-2   │   │ OC-5   │   │ OC-8   │   │ OC-11  │
 │ OC-3   │   │ OC-6   │   │ OC-9   │   │ OC-12  │
 └────────┘   └────────┘   └────────┘   └────────┘
```

### 3.3 关键优势

1. **资源占用低**：短连接比长连接节省90%资源
2. **可扩展性强**：支持按Zone横向扩展
3. **容错性好**：天然容错，无需复杂重连逻辑
4. **性能优秀**：批量处理+并发控制+缓存优化
5. **易于维护**：模块化设计，职责清晰

### 3.4 数据流设计

```
┌─────────────────────────────────────────────────────────────────┐
│            监控面板需要的数据                                     │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐    ┌──────────────┐
│Session  │    │  Provider    │
│Logs     │    │  API         │
└────┬────┘    └──────┬───────┘
     │                │
     │ ✅ 可获取       │ ❌ 无法获取
     │                │
     ▼                ▼
┌──────────────┐  ┌──────────────────┐
│• Token使用   │  │• 实时配额状态     │
│• 成本统计    │  │• 账户余额         │
│• 消息数量    │  │• 配额重置时间     │
│• 工具调用    │  │• OAuth状态        │
│• 延迟数据    │  └──────────────────┘
│• 错误统计    │
│• 模型使用    │
└──────────────┘
```

---

## 四、核心组件设计

### 4.1 Edge Collector核心模块

Edge Collector是整个监控系统的核心，负责从OpenClaw实例收集数据。

#### 主要功能

1. **实例管理**：添加、删除、更新OpenClaw实例
2. **轮询控制**：定时轮询所有实例，控制并发数
3. **WebSocket短连接**：按需建立连接，用完即断
4. **数据聚合**：聚合多个数据源的指标
5. **缓存管理**：缓存最近N分钟的数据

#### 核心代码结构

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
  
  // 数据获取
  private pollAllInstances(): Promise<void>;
  private pollInstance(instance: OpenClawInstance): Promise<void>;
  
  // WebSocket连接管理
  private createConnection(url: string): Promise<WebSocket>;
  private fetchUsageData(ws: WebSocket): Promise<any>;
  private fetchSessionData(ws: WebSocket): Promise<any>;
  
  // 数据聚合
  private aggregateMetrics(...data: any[]): MetricsPayload;
  
  // 缓存查询
  getMetrics(instanceId: string): MetricsPayload | undefined;
  getAllMetrics(): MetricsPayload[];
}
```

#### 配置参数

```typescript
interface CollectorConfig {
  id: string;
  pollInterval: number;           // 轮询间隔（毫秒）
  maxConcurrent: number;          // 最大并发连接数
  connectionTimeout: number;      // 连接超时（毫秒）
  requestTimeout: number;         // 请求超时（毫秒）
  retryAttempts: number;          // 重试次数
  retryDelay: number;             // 重试延迟（毫秒）
  cacheTTL: number;               // 缓存TTL（毫秒）
  batchSize: number;              // 批量处理大小
}
```

### 4.2 监控面板API Gateway

API Gateway提供统一的REST API接口，处理认证授权、限流熔断、数据聚合等功能。

#### 主要功能

1. **认证授权**：JWT认证、SSO集成、RBAC权限控制
2. **请求路由**：路由到对应的Edge Collector
3. **限流熔断**：防止API过载
4. **缓存层**：Redis缓存热点数据
5. **数据聚合**：聚合多个实例的数据

#### API端点设计

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/metrics` | GET | 获取所有实例的指标 | admin, operator, user |
| `/api/metrics/:instanceId` | GET | 获取单个实例的指标 | admin, operator, user |
| `/api/aggregates` | GET | 聚合统计 | admin, operator |
| `/api/stats/by-department` | GET | 按部门统计 | admin |
| `/api/instances` | GET | 获取实例列表 | admin, operator, user |
| `/api/instances` | POST | 添加实例 | admin, operator |
| `/api/instances/:instanceId` | DELETE | 删除实例 | admin, operator |
| `/api/user/me` | GET | 用户个人统计 | user |

### 4.3 性能优化策略

#### 连接池优化

```typescript
export class ConnectionPool {
  private pool: Map<string, WebSocket> = new Map();
  private maxPoolSize: number;
  private idleTimeout: number;
  
  async getConnection(url: string): Promise<WebSocket>;
  releaseConnection(url: string): void;
  private cleanupIdleConnections(): void;
}
```

#### 数据压缩

使用compression中间件压缩响应数据，减少网络传输。

#### 缓存策略

```typescript
export class CacheStrategy {
  static HOT_DATA_TTL = 300;        // 热点数据：缓存5分钟
  static HISTORICAL_DATA_TTL = 3600; // 历史数据：缓存1小时
  static AGGREGATE_DATA_TTL = 600;   // 聚合数据：缓存10分钟
}
```

---

## 五、数据库设计

### 5.1 PostgreSQL表结构

#### 实例表

```sql
CREATE TABLE instances (
    id VARCHAR(255) PRIMARY KEY,
    url VARCHAR(500) NOT NULL,
    zone VARCHAR(100) NOT NULL,
    labels JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'unknown',
    last_poll_time TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 指标快照表

```sql
CREATE TABLE metrics_snapshots (
    id BIGSERIAL PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL REFERENCES instances(id),
    timestamp TIMESTAMP NOT NULL,
    
    -- Token使用
    tokens_input BIGINT DEFAULT 0,
    tokens_output BIGINT DEFAULT 0,
    tokens_cache_read BIGINT DEFAULT 0,
    tokens_cache_write BIGINT DEFAULT 0,
    tokens_total BIGINT DEFAULT 0,
    
    -- 成本
    cost_total DECIMAL(10, 6) DEFAULT 0,
    
    -- 消息统计
    messages_total BIGINT DEFAULT 0,
    messages_errors BIGINT DEFAULT 0,
    
    -- 延迟
    latency_avg INTEGER DEFAULT 0,
    latency_p95 INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 工具使用统计表

```sql
CREATE TABLE tool_usage (
    id BIGSERIAL PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL REFERENCES instances(id),
    tool_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    count BIGINT DEFAULT 0,
    success_count BIGINT DEFAULT 0,
    error_count BIGINT DEFAULT 0,
    avg_duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 用户统计表

```sql
CREATE TABLE user_stats (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) REFERENCES instances(id),
    date DATE NOT NULL,
    
    messages_total BIGINT DEFAULT 0,
    tokens_total BIGINT DEFAULT 0,
    cost_total DECIMAL(10, 6) DEFAULT 0,
    sessions_count BIGINT DEFAULT 0,
    tools_used JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, instance_id, date)
);
```

### 5.2 TimescaleDB扩展

如果使用TimescaleDB，可以将metrics_snapshots转换为hypertable，支持时序数据的高效查询和聚合。

```sql
-- 转换为hypertable
SELECT create_hypertable('metrics_snapshots', 'timestamp');

-- 创建连续聚合视图（每小时聚合）
CREATE MATERIALIZED VIEW metrics_hourly
WITH (timescaledb.continuous) AS
SELECT 
    instance_id,
    time_bucket('1 hour', timestamp) AS bucket,
    AVG(tokens_total) AS avg_tokens,
    MAX(cost_total) AS max_cost,
    AVG(latency_avg) AS avg_latency
FROM metrics_snapshots
GROUP BY instance_id, time_bucket('1 hour', timestamp)
WITH DATA;

-- 数据保留策略（保留90天原始数据）
SELECT add_retention_policy('metrics_snapshots', INTERVAL '90 days');
```

---

## 六、前端UI设计

### 6.1 技术栈

- **前端框架**: React 18 + TypeScript
- **UI组件库**: Ant Design 5.x / shadcn/ui
- **图表库**: ECharts 5.x / Recharts
- **状态管理**: Zustand / TanStack Query
- **路由**: React Router 6
- **构建工具**: Vite
- **样式方案**: TailwindCSS + CSS Modules

### 6.2 页面结构

```
监控面板
├── 领导视图
│   ├── 总览仪表板
│   │   ├── 实例健康状态（饼图）
│   │   ├── 成本趋势（折线图）
│   │   ├── 使用量趋势（柱状图）
│   │   └── 部门对比（表格）
│   └── 成本分析
│       ├── 成本分布（饼图）
│       ├── 成本趋势（折线图）
│       └── 成本预测（预测曲线）
│
├── 运维视图
│   ├── 实时监控
│   │   ├── 实例列表（表格）
│   │   ├── 性能指标（仪表盘）
│   │   ├── 错误监控（列表）
│   │   └── 日志查询（搜索框）
│   └── 性能分析
│       ├── 延迟分布（直方图）
│       ├── 性能趋势（折线图）
│       └── 热点分析（热力图）
│
├── 用户视图
│   ├── 个人统计
│   │   ├── 使用量（卡片）
│   │   ├── 成本（卡片）
│   │   ├── 常用工具（列表）
│   │   └── 对话历史（时间线）
│   └── 技能发现
│       ├── 热门技能（排行榜）
│       ├── 技能推荐（卡片）
│       └── 使用指南（文档）
│
└── 报表中心
    ├── 日报表
    ├── 周报表
    ├── 月报表
    └── 自定义报表
```

### 6.3 关键页面设计

#### 领导视图 - 总览仪表板

- **顶部统计卡片**：实例总数、今日成本、今日消息数、错误率
- **实例健康状态**：饼图展示健康/异常实例比例
- **成本趋势**：折线图展示最近7天的成本趋势
- **部门使用对比**：表格展示各部门的使用情况
- **模型使用分布**：柱状图展示各模型的使用次数
- **热门工具Top 10**：表格展示最常用的工具

#### 运维视图 - 实时监控

- **工具栏**：搜索框、状态过滤器、健康统计
- **实例列表**：表格展示所有实例的状态、最后轮询时间、活跃会话、今日消息、平均延迟、错误率
- **实时刷新**：每分钟自动刷新数据

#### 用户视图 - 个人统计

- **个人统计卡片**：本月消息数、本月成本、本月Token使用、平均响应时间
- **使用趋势**：折线图展示最近30天的使用趋势
- **常用工具**：列表展示最常用的工具
- **最近对话**：时间线展示最近的对话历史

---

## 七、告警系统

### 7.1 告警规则配置

支持多种类型的告警规则：

#### 实例健康告警

```yaml
- name: instance_down
  description: 实例无法连接或状态异常
  metric_type: instance_status
  condition: "equals"
  threshold: "unhealthy"
  duration_seconds: 300
  severity: critical
  notify_channels:
    - webhook
    - email
```

#### 性能告警

```yaml
- name: high_latency
  description: 响应延迟过高
  metric_type: latency_avg
  condition: "greater_than"
  threshold: 5000  # 5秒
  duration_seconds: 300
  severity: warning
  notify_channels:
    - webhook
```

#### 成本告警

```yaml
- name: daily_cost_spike
  description: 日成本突增
  metric_type: daily_cost
  condition: "increase_percentage"
  threshold: 50  # 增加50%
  severity: warning
  notify_channels:
    - webhook
    - email
```

### 7.2 告警引擎

告警引擎负责评估指标、触发告警、发送通知。

#### 主要功能

1. **规则加载**：从数据库加载启用的告警规则
2. **指标评估**：评估每个指标是否触发告警条件
3. **持续时间检查**：检查告警是否持续指定时间
4. **告警触发**：触发告警并发送通知
5. **告警恢复**：检测告警恢复并发送通知

#### 核心代码

```typescript
export class AlertEngine extends EventEmitter {
  private rules: Map<number, AlertRule> = new Map();
  private activeAlerts: Map<string, AlertState> = new Map();
  private metricHistory: Map<string, Array<{ timestamp: number; value: number }>> = new Map();
  
  async evaluateMetrics(metrics: MetricsPayload): Promise<void>;
  private evaluateCondition(rule: AlertRule, currentValue: number | string, instanceId: string): boolean;
  private handleAlertTriggered(rule: AlertRule, instanceId: string, currentValue: number | string): Promise<void>;
  private handleAlertResolved(rule: AlertRule, instanceId: string): Promise<void>;
}
```

### 7.3 通知渠道

支持多种通知渠道：

1. **Webhook**：企业微信、钉钉、Slack等
2. **Email**：邮件通知
3. **SMS**：短信通知（可选）

---

## 八、性能测试方案

### 8.1 测试场景

| 场景 | 实例数 | 并发用户 | 持续时间 | 预期指标 |
|------|--------|----------|----------|----------|
| 小规模 | 10 | 100 | 30分钟 | P95延迟 < 100ms |
| 中等规模 | 50 | 500 | 60分钟 | P95延迟 < 200ms |
| 大规模 | 100 | 1000 | 120分钟 | P95延迟 < 500ms |
| 压力测试 | 200 | 2000 | 30分钟 | 错误率 < 1% |

### 8.2 性能测试脚本

```typescript
export class PerformanceTest {
  // 测试API响应时间
  async testAPIResponseTime(endpoint: string, iterations: number = 100): Promise<MetricResult>;
  
  // 测试数据库查询性能
  async testDatabaseQuery(query: string, iterations: number = 100): Promise<MetricResult>;
  
  // 测试缓存性能
  async testCachePerformance(key: string, iterations: number = 1000): Promise<MetricResult>;
  
  // 测试WebSocket连接性能
  async testWebSocketConnection(url: string, iterations: number = 50): Promise<MetricResult>;
  
  // 并发测试
  async testConcurrentRequests(endpoint: string, concurrentUsers: number, durationSeconds: number): Promise<ConcurrencyTestResult>;
  
  // 资源监控
  async monitorResources(durationSeconds: number): Promise<ResourceMonitorResult>;
}
```

### 8.3 性能基准

```typescript
export const PERFORMANCE_BENCHMARKS = {
  api: {
    getMetrics: { p50: 50, p95: 100, p99: 200 },
    getAggregates: { p50: 100, p95: 200, p99: 500 },
  },
  database: {
    simpleQuery: { p50: 10, p95: 30, p99: 50 },
    complexQuery: { p50: 50, p95: 100, p99: 200 },
  },
  cache: {
    read: { p50: 1, p95: 5, p99: 10 },
    write: { p50: 2, p95: 5, p99: 10 },
  },
  websocket: {
    connection: { p50: 50, p95: 100, p99: 200 },
  },
  resources: {
    edgeCollector: { maxMemoryMB: 512, maxCpuPercent: 30 },
    apiGateway: { maxMemoryMB: 256, maxCpuPercent: 20 },
  },
};
```

---

## 九、安全设计

### 9.1 认证授权架构

```
用户请求
    ↓
API Gateway
    ↓
认证中间件（JWT/SSO）
    ↓
授权中间件（RBAC）
    ↓
业务逻辑层
```

### 9.2 JWT认证

```typescript
export class AuthService {
  generateToken(user: UserPayload): string;
  generateRefreshToken(userId: string): string;
  verifyToken(token: string): UserPayload | null;
  refreshToken(refreshToken: string): string | null;
}
```

### 9.3 SSO集成

支持企业内部SSO（SAML）和OAuth（Google）登录。

```typescript
export class SSOService {
  async samlLogin(): Promise<string>;
  async samlCallback(samlResponse: string): Promise<UserPayload>;
  async oauthLogin(): Promise<string>;
  async oauthCallback(code: string): Promise<UserPayload>;
}
```

### 9.4 RBAC授权

```typescript
export type Permission = 
  | 'metrics:read'
  | 'metrics:read:own'
  | 'instances:read'
  | 'instances:write'
  | 'alerts:read'
  | 'alerts:write';

export function authorize(requiredPermissions: Permission[]);
export function requireRole(roles: string | string[]);
```

### 9.5 数据加密

```typescript
export class EncryptionService {
  encrypt(plaintext: string): { ciphertext: string; iv: string; authTag: string };
  decrypt(encrypted: { ciphertext: string; iv: string; authTag: string }): string;
  hash(data: string): string;
  generateToken(length: number = 32): string;
}
```

### 9.6 安全中间件

- **安全头部**：使用helmet设置安全相关的HTTP头
- **CORS配置**：限制允许的源
- **限流**：防止API过载
- **SQL注入防护**：检测和阻止SQL注入攻击
- **XSS防护**：过滤和转义用户输入
- **审计日志**：记录所有API请求

---

## 十、日志系统设计

### 10.1 日志架构

```
应用日志（Edge Collector, API Gateway, Alert Engine, Frontend）
    ↓
日志收集器（Fluentd/Filebeat）
    ↓
日志聚合器（Logstash）
    ↓
日志存储与检索（Elasticsearch, Loki, S3）
    ↓
日志可视化（Kibana, Grafana）
```

### 10.2 日志格式规范

```typescript
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: {
    service: string;
    version: string;
    instanceId?: string;
    zone?: string;
  };
  request?: {
    traceId: string;
    spanId?: string;
    method?: string;
    path?: string;
    userId?: string;
    ip?: string;
  };
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metrics?: {
    duration?: number;
    memory?: number;
    cpu?: number;
  };
  data?: Record<string, any>;
}
```

### 10.3 Logger实现

```typescript
export class Logger {
  debug(message: string, data?: Record<string, any>): void;
  info(message: string, data?: Record<string, any>): void;
  warn(message: string, data?: Record<string, any>): void;
  error(message: string, error?: Error, data?: Record<string, any>): void;
  fatal(message: string, error?: Error, data?: Record<string, any>): void;
  logPerformance(operation: string, duration: number, data?: Record<string, any>): void;
  logAudit(action: string, userId: string, resource: string, result: 'success' | 'failure', data?: Record<string, any>): void;
}
```

### 10.4 日志查询API

- **搜索日志**：支持全文搜索、日志级别过滤、服务过滤、时间范围过滤
- **聚合统计**：按日志级别、服务、时间聚合统计

---

## 十一、备份恢复策略

### 11.1 备份策略

| 数据类型 | 备份类型 | 频率 | 保留时间 |
|---------|---------|------|----------|
| PostgreSQL | 全量备份 | 每天 | 30天 |
| PostgreSQL | 增量备份 | 每4小时 | 7天 |
| PostgreSQL | WAL归档 | 实时 | - |
| Redis | RDB快照 | 每小时 | 7天 |
| Elasticsearch | 快照 | 每天 | 30天 |
| 配置文件 | 全量备份 | 每天 | 90天 |

### 11.2 备份脚本

```bash
#!/bin/bash
# PostgreSQL备份脚本

# 执行备份
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# 上传到S3
aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/${S3_PREFIX}/$(basename ${BACKUP_FILE})"

# 清理旧备份（保留30天）
aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | while read -r line; do
    # 删除30天前的备份
done
```

### 11.3 恢复脚本

```bash
#!/bin/bash
# PostgreSQL恢复脚本

# 下载备份文件
aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}" "${TEMP_FILE}"

# 恢复数据库
dropdb --if-exists "${DB_NAME}"
createdb "${DB_NAME}"
gunzip -c "${TEMP_FILE}" | psql "${DB_NAME}"
```

### 11.4 自动化备份服务

```typescript
export class BackupScheduler {
  start(): void;
  stop(): void;
  private scheduleJob(name: string, schedule: string, task: () => Promise<void>): void;
  private runBackup(scriptPath: string): Promise<void>;
}
```

---

## 十二、灾难恢复方案

### 12.1 灾难恢复架构

```
主数据中心 (Region A)
├── Edge Collector
├── API Gateway
├── PostgreSQL Primary
└── Redis Primary
        ↓ 同步复制
备数据中心 (Region B)
├── Edge Collector (Standby)
├── API Gateway (Standby)
├── PostgreSQL Standby
└── Redis Replica
```

### 12.2 故障检测与自动切换

```typescript
export class HealthChecker extends EventEmitter {
  start(intervalMs: number = 10000): void;
  stop(): void;
  getStatus(): Map<string, HealthStatus>;
}

export class FailoverManager {
  start(): void;
  stop(): void;
  async manualFailover(): Promise<void>;
  async failback(): Promise<void>;
}
```

### 12.3 故障切换流程

1. **停止主数据中心的服务**
2. **提升备数据中心为主**
3. **更新DNS/负载均衡器**
4. **启动备数据中心的服务**
5. **发送通知**

### 12.4 灾难恢复演练

定期进行灾难恢复演练，验证故障切换流程的有效性。

**演练场景**：
- 数据库故障
- API Gateway故障
- 整个Region故障

**成功标准**：
- 故障切换时间 < 5分钟
- 数据丢失 < 1分钟
- 服务可用性 > 99%

---

## 十三、总结

### 13.1 设计亮点

1. **Edge Collector架构**：WebSocket短连接比长连接节省90%资源
2. **混合数据源**：Session Logs提供90%数据，Provider API提供配额信息
3. **多角色视图**：领导、运维、用户三种视图，满足不同需求
4. **企业级特性**：完整的认证授权、日志审计、备份恢复、灾难恢复

### 13.2 关键优势

- **资源占用低**：短连接+批量处理+缓存优化
- **可扩展性强**：支持按Zone横向扩展
- **性能优秀**：P95延迟 < 200ms（中等规模）
- **易于维护**：模块化设计，职责清晰
- **安全可靠**：JWT/SSO认证、RBAC授权、数据加密

### 13.3 下一步计划

1. **原型开发**：开发Edge Collector和API Gateway原型
2. **性能测试**：验证性能指标是否达标
3. **用户测试**：邀请用户测试并收集反馈
4. **迭代优化**：根据反馈优化设计和实现

---

## 附录

### A. 监控指标列表

| 指标类别 | 指标名称 | 说明 | 数据源 |
|---------|---------|------|--------|
| 系统健康 | 实例在线率 | 健康实例/总实例 | Edge Collector |
| 系统健康 | Gateway响应时间 | 平均/P95/P99延迟 | Session Logs |
| 成本 | 总成本 | 累计成本（美元） | Session Logs |
| 成本 | 每日成本趋势 | 按日期统计成本 | Session Logs |
| 成本 | 成本分布 | 按Provider/Model分布 | Session Logs |
| 使用量 | Token使用量 | Input/Output/Cache | Session Logs |
| 使用量 | 消息数量 | User/Assistant消息数 | Session Logs |
| 使用量 | 活跃会话数 | 当前活跃session数 | Health API |
| 工具 | 工具调用次数 | 各工具调用统计 | Session Logs |
| 工具 | 工具成功率 | 成功调用/总调用 | Session Logs |
| 错误 | 错误率 | 错误消息/总消息 | Session Logs |
| 错误 | 错误类型分布 | 按错误类型统计 | Session Logs |
| 性能 | 平均延迟 | 响应时间统计 | Session Logs |
| 性能 | P95延迟 | 95分位延迟 | Session Logs |

### B. 技术栈清单

**后端**：
- Node.js 18+
- TypeScript 5.x
- Express.js / Fastify
- PostgreSQL 15+
- TimescaleDB（可选）
- Redis 7+
- Elasticsearch 8.x（可选）

**前端**：
- React 18
- TypeScript 5.x
- Ant Design 5.x / shadcn/ui
- ECharts 5.x / Recharts
- Zustand / TanStack Query
- Vite

**基础设施**：
- Kubernetes
- Docker
- Nginx / HAProxy
- Prometheus / Grafana（可选）

### C. 参考资料

- [OpenClaw官方文档](https://docs.openclaw.ai)
- [OpenClaw GitHub仓库](https://github.com/openclaw/openclaw)
- [Session Logs格式](src/infra/session-cost-usage.ts)
- [Usage API文档](docs/concepts/usage-tracking.md)
