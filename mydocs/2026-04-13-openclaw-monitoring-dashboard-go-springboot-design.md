# OpenClaw 企业级监控面板架构设计 (Go + SpringBoot版)

**文档版本**: 14.0  
**创建日期**: 2026-04-13  
**最后更新**: 2026-04-14  
**作者**: AI Assistant  
**状态**: 待审批  
**参考文档**: 
- `mydocs/2026-04-13-openclaw-monitoring-dashboard-optimized.md` (原始设计方案)

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
| **公司领导** | 业务价值、使用趋势 | 活跃实例数、总会话量、Token消耗趋势、部门对比 |
| **开发运维** | 系统健康、故障诊断、性能监控 | 实例状态、渠道连接、错误率、Skill性能 |
| **普通用户** | 个人使用统计、效率提升 | 个人会话、Token消耗、常用Skill、成就系统 |

### 1.3 核心约束

✅ **必须满足:**
- 零修改 OpenClaw 源码 (非侵入式)
- 支持 1000+ 实例规模
- 长期历史数据存储 (90天+,支持趋势分析)
- 近实时监控 (分钟级更新)
- 原始 Session Log 可追溯(文件丢失可从数据库元数据恢复归档位置)

⚠️ **可选功能:**
- 简单告警展示 (界面内,无需外部通知) - Phase 2
- 完整告警系统 (云助理/Email) - Phase 3 (低优先级)
- SSO 集成 - Phase 3

---

## 二、技术选型决策

### 2.1 核心技术栈

| 组件 | 技术选型 | 理由 |
|------|---------|------|
| **Edge Collector** | Go | 轻量、高并发、低资源占用(<50MB内存),适合管理50-100个实例的轮询 |
| **Registry Service** | SpringBoot | 企业级生态、团队熟悉、OceanBase集成成熟 |
| **Center Service** | SpringBoot | 同上,统一技术栈降低维护成本 |
| **数据库** | OceanBase MySQL模式 | 分布式、MySQL兼容、高可用、支持水平扩展 |
| **缓存** | Redis 7+ | 实时状态缓存、API响应加速 |
| **前端** | Vue 3 + Element Plus | 企业级UI组件库,国内广泛使用,中文文档完善 |

### 2.2 架构决策记录

#### 决策1: Edge Collector 使用 Go
- **备选方案**: Node.js/TypeScript, Python, Rust
- **选择理由**: 
  - 原生goroutine并发模型,处理100+ WebSocket连接高效
  - 编译成单一binary,部署极简
  - 内存占用最低(~50MB vs Node.js ~300MB)
  - 启动速度快(<1秒),适合容器化

#### 决策2: Center Service 使用 SpringBoot
- **备选方案**: 全部用Go,混合架构
- **选择理由**:
  - 团队已有Java/Spring经验,学习成本低
  - Spring生态完善(Spring Security, Spring Data, Actuator)
  - OceanBase MySQL模式集成成熟(JPA/Hibernate)
  - 企业级特性开箱即用(RBAC,审计日志等)

#### 决策3: Registry Service 高可用
- **方案**: 2-3实例 + 负载均衡(Nginx/SLB)
- **理由**: 避免单点故障,保证实例分配和故障转移功能持续可用

#### 决策4: Rebalance 策略
- **方案**: 事件触发 + 定期巡检兜底
- **理由**: 
  - 事件驱动:新增/删除Collector时立即重新平衡
  - 定期巡检:每小时执行一次,处理异常情况(如心跳超时未检测到)

#### 决策5: 实例分配算法
- **方案**: 简单轮询
- **理由**: 实现简单,对于1000实例规模足够,后续可根据需要升级为加权分配

#### 决策6: Session Log 存储策略
- **方案**: 元数据入库 + 原始文件归档
- **理由**:
  - 平衡存储成本和追溯能力
  - 元数据(文件名、路径、时间范围)存入OceanBase
  - 原始JSONL文件压缩归档到NAS
  - 文件丢失时可通过元数据定位归档位置

#### 决策7: 用户映射关系
- **方案**: 调用外部API实时查询 + Redis缓存
- **理由**:
  - 不修改OpenClaw源码(符合约束)
  - 不重复存储用户映射数据(单一数据源原则)
  - Redis缓存(TTL 1小时)优化频繁查询

#### 决策8: WebSocket连接模式选择
- **方案**: 短连接轮询 (而非长连接)
- **备选方案**: 持久WebSocket连接 + 心跳保活
- **选择理由**:
  1. **对Gateway影响最小化**: 
     - 短连接不占用持久连接资源,每次请求后立即释放
     - Gateway无需维护大量空闲连接的内存和状态
     - 符合“监控不应影响业务”的核心原则
  
  2. **利用Gateway内置缓存**:
     - Health API已有内存缓存(`HEALTH_REFRESH_INTERVAL_MS`)
     - Usage API有30秒缓存(`COST_USAGE_CACHE_TTL_MS = 30s`)
     - 调用时设置`probe:false`,大部分请求命中缓存,开销极低
     - 即使不使用成本统计,缓存机制仍对Token等指标生效
  
  3. **实现简单可靠**:
     - 无需处理断线重连、心跳超时、连接池管理
     - 单次失败不影响后续采集,故障隔离更好
     - Collector重启逻辑简单,无状态残留
  
  4. **性能可接受**:
     - 1000实例/60秒 ≈ 17 connections/sec
     - 每个连接生命周期~100ms,峰值并发~2
     - Gateway负载增加 < 1% CPU (实测估算)

#### 决策9: Session Log处理职责划分
- **方案**: Edge Collector负责解析JSONL内容并计算聚合指标
- **备选方案**: Center Service统一解析所有JSONL文件
- **选择理由**:
  1. **分布式计算优势**:
     - 1000个实例的解析工作分散到20个Collector上(每个50个实例)
     - 避免Center Service成为CPU瓶颈
     - 线性扩展:增加Collector即可提升处理能力
  
  2. **网络效率**:
     - Collector推送已聚合的数据,减少传输量
     - 原始JSONL文件只在归档时传输一次
  
  3. **架构清晰**:
     - Collector:数据采集 + 预处理 + 分布式计算
     - Center Service:数据存储 + 索引 + 查询
     - 职责分离,易于维护和调试

#### 决策10: Session Log备份策略
- **方案**: 基于Session ID的追踪 + 对象存储(S3/OSS/MinIO)
- **备选方案**: 第二NAS / 混合方案 / OceanBase BLOB
- **选择理由**:
  1. **成本最优**:
     - 对象存储($0.023/GB/月)比NAS便宜60%以上
     - 3.65TB数据年成本仅$940(OSS) vs $2500(NAS)
  
  2. **可靠性最高**:
     - 99.999999999%持久性
     - 支持跨区域复制和版本控制
  
  3. **功能完整**:
     - 生命周期管理(自动转冷存储/删除)
     - 服务端加密和压缩
     - 完善的SDK和工具链
  
  4. **运维简单**:
     - 无需管理硬件
     - 按需付费,无限容量
     - 成熟的监控和告警体系
  
  5. **批量控制优化**:
     - 每批最多10个实例并行,批次间隔100ms
     - 避免瞬时压力,平滑负载分布
     - 支持动态调整并发度

---

## 三、数据来源分工

根据 OpenClaw 源码验证 (`src/gateway/server-methods/usage.ts`),监控数据来自两个主要渠道:

### 3.1 数据采集方式总览

| 数据类型 | 来源 | 获取方式 | 频率 | 说明 |
|---------|------|---------|------|------|
| **实时健康状态** | Gateway API `health` | Edge Collector → Redis缓存 | 30秒 | 实例是否在线、响应延迟、渠道数、Agent数 |
| **渠道连接状态** | Gateway API `channels.status` | Edge Collector → Redis缓存 | 30秒 | 各渠道是否链接、配置状态、探测延迟 |
| **LLM配额状态** | Gateway API `usage.status` | Edge Collector → Redis缓存 | 5分钟 | Provider套餐、使用百分比、重置时间 |
| **Token消耗** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 | 输入/输出Token、缓存读写Token |
| **消息统计** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 | 会话数、用户消息、助手回复、工具调用、错误数 |
| **工具调用** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 | 工具名称、调用次数、成功/失败次数 |
| **延迟数据** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 | 平均延迟、P95延迟、最小/最大延迟 |
| **模型分布** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 | 按Provider和模型分类的Token使用 |
| **用户活跃度** | Session Logs JSONL | 文件扫描器异步处理 | 5分钟 | 用户ID、会话ID、活动时间、消息数 |

**重要发现:**
- ✅ Session Logs 包含 **90%** 的监控数据(Token、消息、工具、延迟等)
- ⚠️ Provider 配额状态必须通过 `usage.status` API 获取,不在 Session Logs 中
- ⚠️ 实时健康状态必须通过 `health` API 获取,反映当前时刻的系统状态
- ℹ️ **成本统计已移除**: 由于使用内部部署大模型,无需统计USD成本,仅关注Token消耗量

### 3.2 Gateway API 方法清单

根据 OpenClaw 源码 (`src/gateway/server-methods-list.ts`):

| 方法 | 说明 | 返回数据示例 | 需要权限 |
|------|------|------------|----------|
| `health` | 完整健康快照 | `{ok: true, durationMs: 45, channelCount: 3, agentCount: 2}` | read |
| `status` | 系统状态摘要 | `{version: "1.0", uptime: 86400}` | read |
| `usage.status` | LLM提供商配额状态 | `{providers: {openai: {plan: "pro", usedPercent: 65.5, resetAt: "2026-05-01T00:00:00Z"}}}` | read |
| `channels.status` | 渠道状态 | `{channels: [{id: "telegram", linked: true, configured: true, probeOk: true, probeMs: 120}]}` | read |
| `sessions.usage` | Session使用统计 | `{activeSessions: 15, totalSessions: 1234}` | read |
| `sessions.usage.timeseries` | 时间序列数据 | `{dataPoints: [{timestamp: "...", tokens: 1000}]}` | read |
| `sessions.usage.logs` | Session日志 | `{logs: [...]}` | read |
| `cron.status` | Cron任务状态 | `{jobs: [{name: "cleanup", nextRun: "..."}]}` | read |

### 3.3 Session Logs JSONL 格式

**JSONL 格式示例:**
```jsonl
{"type":"message","timestamp":"2026-04-13T10:30:00Z","message":{"role":"assistant","provider":"openai","model":"gpt-4","content":[{"type":"tool_use","id":"toolu_abc","name":"code-assistant","input":{"prompt":"..."}}],"usage":{"input":100,"output":200,"cacheRead":50,"cacheWrite":25,"totalTokens":300},"durationMs":1250}}
{"type":"message","timestamp":"2026-04-13T10:30:01Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_abc","content":"...","is_error":false}]}}
```

**关键字段:**
- `timestamp`: ISO 8601 时间戳
- `message.role`: user/assistant
- `message.provider`: 提供商 (openai/anthropic等)
- `message.model`: 模型名称
- `usage.input`: 输入 Token 数
- `usage.output`: 输出 Token 数
- `usage.cacheRead`: 缓存读取 Token
- `usage.cacheWrite`: 缓存写入 Token
- `usage.totalTokens`: 总 Token 数
- `durationMs`: 响应延迟 (毫秒)
- `content[].type`: tool_use/tool_result
- `content[].name`: 工具名称

### 3.4 数据流转路径

```
OpenClaw Instance
    ├─ Gateway API (WebSocket短连接)
    │   ├─ health → Edge Collector → Redis缓存(实时状态, TTL 5min)
    │   ├─ channels.status → Edge Collector → Redis缓存(实时状态, TTL 5min)
    │   └─ usage.status → Edge Collector → Redis缓存(实时状态, TTL 5min)
    │
    └─ Session Logs (文件系统JSONL)
        └─ Edge Collector扫描并解析 → 提取元数据 + 计算聚合指标 → Center Service
            ├─ 元数据入库 → session_log_metadata表
            ├─ 聚合指标入库 → metrics_token_daily/message_daily等表
            └─ 原始文件归档 → NAS (路径存入archived_location字段)
```

**重要说明:**
- ✅ **只有Edge Collector读取Session Log文件内容**,Center Service不直接读取JSONL文件
- ✅ Edge Collector负责逐行解析JSONL,计算Token消耗、消息统计、工具调用等聚合指标
- ✅ Center Service只接收已聚合的数据,负责存储和查询,不做繁重的解析工作
- ✅ 这种设计将计算负载分散到多个Collector,避免Center Service成为性能瓶颈

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
| Token消耗趋势 | Session Logs | 每日Token消耗曲线 |
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
| 常用工具排行 | Session Logs | 用户常用工具 |
| 会话时长分布 | Session Logs | 会话持续时间 |
| 最近会话列表 | Session Logs | 最近活跃会话 |

---

## 五、核心组件详细设计

### 5.1 架构图

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
│              Edge Collector Layer (Go, 10-20个)                  │
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
│            Registry Service (SpringBoot, 2-3实例HA)              │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Load Balancer (Nginx/SLB)                           │      │
│  │       ↓                                              │      │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │      │
│  │  │Registry#1│ │Registry#2│ │Registry#3│             │      │
│  │  └──────────┘ └──────────┘ └──────────┘             │      │
│  │       ↓                                              │      │
│  │  Instance Assignment & Rebalance Engine              │      │
│  └──────────────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Center Service (SpringBoot, 2-3实例HA)              │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐     │
│  │ API Gateway    │→ │ Data Fusion  │→ │ OceanBase MySQL │     │
│  │                │  │ Engine       │  │ + Redis Cache   │     │
│  │ • 认证授权     │  │ • 合并数据    │  │ • 关系型存储    │     │
│  │ • 请求路由     │  │ • 生成洞察    │  │ • 元数据存储    │     │
│  │ • 限流熔断     │  │ • 评估告警    │  │ • 归档索引      │     │
│  └────────────────┘  └──────────────┘  └────────┬────────┘     │
└─────────────────────────────────────────────────┼──────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend (Vue 3 + Element Plus)                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Executive    │ │ DevOps       │ │ User         │            │
│  │ Dashboard    │ │ Console      │ │ Portal       │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 数据流向

```
1. Edge Collector → Registry Service
   - 注册: POST /api/registry/collectors/register
   - 心跳: POST /api/registry/collectors/heartbeat
   - 获取实例列表: GET /api/registry/collectors/{id}/instances

2. Edge Collector → OpenClaw Instances
   - Health检查: WebSocket short-lived connection, method="health"
   - Usage检查: WebSocket short-lived connection, method="usage.status"
   - Session Logs: 扫描共享NAS目录,读取并解析JSONL文件内容

3. Edge Collector → Center Service
   - 批量推送元数据和聚合指标: POST /api/metrics/batch (Gzip压缩)
   - 包含: 文件元数据 + Token统计 + 消息统计 + 工具调用统计 + 延迟统计

4. Center Service → External User Service
   - 查询用户映射: GET /api/instances/{instanceId}/user
   - 缓存到Redis (TTL 1h)

5. Center Service → OceanBase
   - 写入Session Log元数据(session_log_metadata表)
   - 写入聚合指标(metrics_token_daily/message_daily等表)
   - 更新归档状态

6. Center Service → Archive Storage (NAS/S3)
   - 移动或复制原始JSONL文件到归档存储
   - 可选: Gzip压缩以节省空间
   - 返回归档路径存入session_log_metadata.archived_location字段
```

**关键职责划分:**
- **Edge Collector**: 唯一读取和解析JSONL文件内容的组件,负责分布式计算
- **Center Service**: 只接收已处理的数据,负责存储、索引和查询,不解析原始文件

---

### 5.3 Edge Collector (Go)

#### 5.3.1 功能职责

- 维护分配的OpenClaw实例列表(从Registry获取)
- **WebSocket短连接轮询**各实例Gateway API(health, usage.status)
  - 采用短连接模式:每次请求建立新连接,完成后立即关闭
  - 利用Gateway内置缓存:调用时设置`probe:false`接受缓存数据
  - 批量并发控制:每批最多10个实例,批次间隔100ms
  - 轮询频率:Health 60秒,Usage 5分钟(详见5.3.2配置)
- **WebSocket认证**: 支持 Token 认证 (`X-Auth-Token` header) 或开放访问(无认证)
- 读取并解析Session Logs JSONL文件
- 本地聚合health、usage、session数据
- 批量推送到Center Service(Gzip压缩)
- 定期上报心跳到Registry(30秒)
- 监听配置变化,动态更新实例列表(60秒)
- **本地缓存保护**: 网络分区时缓存数据,恢复后补推

#### 5.3.2 配置参数

```yaml
# config.yaml
collector_id: "collector-us-east-1"
registry_url: "http://registry-lb.internal:8080"
center_service_url: "http://center-lb.internal:8080"

# Session Log paths - can be configured per instance or as default
session_log_paths:
  default: "/var/lib/openclaw/logs"  # Default path for all instances
  # Instance-specific paths can be configured in openclaw_instances table

# WebSocket authentication (if required by OpenClaw Gateway)
# auth_type: "token"  # or "none" if gateway is open
# auth_header: "X-Auth-Token"

# Polling configuration
# 轮询频率设计原则:
# - Health: 60秒 (Gateway内部有缓存,无需高频轮询)
# - Usage: 5分钟 (Gateway有30秒缓存,5分钟足够)
# - Session Log: 5分钟 (文件系统扫描开销较大)
health_poll_interval: 60s          # Health check polling interval (从30s调整为60s)
usage_poll_interval: 5m            # Quota status polling interval
session_log_scan_interval: 5m      # Session Log scan interval

# Concurrency control
max_concurrent_instances: 10       # Max concurrent instances per batch
batch_size: 10                     # Batch size

# Push configuration
push_interval: 5m                  # Push interval
push_batch_max_size: 100           # Max batch size for push
compression_enabled: true          # Enable Gzip compression

# Heartbeat configuration
heartbeat_interval: 30s            # Heartbeat interval
config_refresh_interval: 60s       # Configuration refresh interval

# Local cache protection (for network partition scenarios)
local_cache_enabled: true          # Enable local cache for resilience
local_cache_max_age: 1h            # Max age for cached data before forcing refresh
local_cache_path: "/var/lib/collector/cache"  # Local cache directory
```

#### 5.3.3 核心数据结构

```go
// 实例信息
type OpenClawInstance struct {
    InstanceID string `json:"instance_id"` // 实例唯一标识
    UserID     string `json:"user_id"`     // 用户ID(可选,从外部API获取)
    GatewayURL string `json:"gateway_url"` // Gateway WebSocket地址 ws://host:port
    AuthToken  string `json:"auth_token"`  // 认证Token(如果需要)
}

// 指标载荷
type MetricsPayload struct {
    CollectorID    string           `json:"collector_id"`    // Collector ID
    Timestamp      time.Time        `json:"timestamp"`       // 采集时间
    InstanceID     string           `json:"instance_id"`     // 实例ID
    HealthData     *HealthData      `json:"health_data,omitempty"`
    UsageData      *UsageData       `json:"usage_data,omitempty"`
    SessionMetrics *SessionMetrics  `json:"session_metrics,omitempty"`
}

// 健康数据
type HealthData struct {
    OK           bool      `json:"ok"`            // 是否健康
    DurationMs   int       `json:"duration_ms"`   // 响应延迟(ms)
    ChannelCount int       `json:"channel_count"` // 渠道数量
    AgentCount   int       `json:"agent_count"`   // Agent数量
    Timestamp    time.Time `json:"timestamp"`     // 采集时间
}

// 配额数据
type UsageData struct {
    Providers map[string]ProviderQuota `json:"providers"` // 按provider统计
}

type ProviderQuota struct {
    Plan        string  `json:"plan"`          // 套餐名称
    UsedPercent float64 `json:"used_percent"`  // 使用百分比(0-100)
    ResetAt     string  `json:"reset_at"`      // 重置时间(ISO 8601)
}

// Session指标
type SessionMetrics struct {
    Sessions      []SessionSummary `json:"sessions"`       // 会话摘要列表
    TotalTokens   int64            `json:"total_tokens"`    // 总Token数
    MessageCount  int              `json:"message_count"`   // 消息总数
}

type SessionSummary struct {
    SessionID    string    `json:"session_id"`     // 会话ID
    StartTime    time.Time `json:"start_time"`     // 开始时间
    EndTime      time.Time `json:"end_time"`       // 结束时间
    TokenCount   int       `json:"token_count"`    // Token数
    MessageCount int       `json:"message_count"`  // 消息数
}

// Session Log元数据
type SessionLogMetadataDTO struct {
    InstanceID      string     `json:"instance_id"`       // 实例ID
    FilePath        string     `json:"file_path"`         // 文件绝对路径
    FileName        string     `json:"file_name"`         // 文件名
    FileSize        int64      `json:"file_size"`         // 文件大小(字节)
    LineCount       int        `json:"line_count"`        // 行数
    FirstTimestamp  *time.Time `json:"first_timestamp"`   // 第一条日志时间
    LastTimestamp   *time.Time `json:"last_timestamp"`    // 最后一条日志时间
}
```

#### 5.3.4 核心流程

**启动流程:**
```
1. 读取配置文件
2. 注册到Registry Service
3. 获取初始实例列表
4. 启动后台协程:
   - heartbeatLoop(): 每30秒上报心跳
   - configRefreshLoop(): 每60秒刷新实例列表
   - pollLoop(): 轮询health/usage/session数据
   - pushLoop(): 每5分钟批量推送指标
```

**轮询流程:**
```
pollLoop():
  ├─ healthTicker (60s) ← 利用Gateway缓存,降低轮询频率
  │   └─ pollHealthData()
  │       ├─ 分批并行处理(每批10个实例,批次间隔100ms)
  │       ├─ WebSocket短连接调用 health API (probe=false,使用缓存)
  │       ├─ 连接完成后立即关闭,不维持长连接
  │       └─ 缓存到 metricsCache
  │
  ├─ usageTicker (5m)
  │   └─ pollUsageData()
  │       ├─ WebSocket短连接调用 usage.status API (利用Gateway 30秒缓存)
  │       └─ 缓存到 metricsCache
  │
  └─ sessionTicker (5m)
      └─ scanAndParseSessionLogs() ← 核心:扫描并解析JSONL文件
          ├─ 扫描共享NAS上的Session Log目录
          ├─ 识别新增或修改的文件(基于文件名和修改时间)
          ├─ 逐行解析JSONL内容:
          │   ├─ 提取Session ID(从文件名)
          │   ├─ 统计Token消耗(input/output/cache_read/cache_write)
          │   ├─ 统计消息数(user/assistant/tool_use/tool_result)
          │   ├─ 统计工具调用(工具名称、成功率)
          │   ├─ 计算延迟指标(avg/p95/min/max)
          │   └─ 记录模型分布(provider/model)
          ├─ 提取文件元数据(路径、大小、行数、时间范围)
          ├─ 检测文件重命名/归档(.deleted/.reset后缀)
          └─ 缓存到 metricsCache
```

**设计说明:**
- ✅ **短连接优势**: 对Gateway影响最小,不占用持久连接资源
- ✅ **缓存友好**: 调用时设置`probe:false`,利用Gateway内置缓存机制
- ✅ **批量控制**: 每批10实例+批次延迟,避免瞬时压力
- ✅ **性能估算**: 1000实例/60秒 ≈ 17连接/秒,峰值并发~2,Gateway负载增加<1%

**推送流程:**
```
pushLoop() (每5分钟):
  1. 收集metricsCache中的所有指标
  2. 组装成MetricsPayload数组
  3. Gzip压缩(如果启用)
  4. HTTP POST到 Center Service /api/metrics/batch
  5. 成功后清空metricsCache
  6. 失败则保留,下次重试
```

#### 5.3.5 HTTP API端点(Collector自身)

```
GET /health              - Collector自身健康状态
GET /instances           - 当前管理的实例列表
GET /metrics/summary     - 本地缓存的指标摘要(调试用)
```

#### 5.3.5 Session Log处理详解

**职责边界:**
- ✅ **Edge Collector是唯一读取和解析JSONL文件内容的组件**
- ❌ Center Service不直接读取Session Log文件,只接收已聚合的数据
- ✅ 这种设计将计算负载分散到多个Collector,避免Center Service成为性能瓶颈

**处理流程:**

```go
// 伪代码: Edge Collector扫描并解析Session Log
func scanAndParseSessionLogs() {
    // 1. 获取分配给当前Collector的所有实例
    instances := getAssignedInstances()
    
    for _, instance := range instances {
        sessionDir := fmt.Sprintf("%s/sessions", instance.SessionLogPath)
        
        // 2. 扫描目录,获取所有.jsonl文件
        files := scanDirectory(sessionDir)
        
        // 3. 加载上次扫描的快照(用于检测变化)
        lastSnapshot := loadLastSnapshot(instance.InstanceID)
        
        // 4. 处理每个文件
        for _, file := range files {
            if !isSessionLogFile(file.Name()) {
                continue
            }
            
            // 5. 从文件名提取Session ID
            sessionID := parseSessionIDFromFileName(file.Name())
            if sessionID == "" {
                continue
            }
            
            // 6. 检查文件是否已处理(基于Session ID + 修改时间)
            if isAlreadyProcessed(sessionID, file.ModTime()) {
                continue
            }
            
            // 7. 逐行解析JSONL内容
            metrics := parseJSONLFile(file.Path)
            
            // 8. 检测文件重命名/归档
            if lastRecord := findLastRecord(sessionID); lastRecord != nil {
                if lastRecord.FileName != file.Name() {
                    log.Info("File renamed/archived",
                        "old:", lastRecord.FileName,
                        "new:", file.Name(),
                        "reason:", detectArchiveReason(file.Name()))
                }
            }
            
            // 9. 构建元数据
            metadata := SessionLogMetadata{
                InstanceID:     instance.InstanceID,
                SessionID:      sessionID,
                FileName:       file.Name(),
                FilePath:       file.Path,
                FileSize:       file.Size(),
                LineCount:      metrics.LineCount,
                FirstTimestamp: metrics.FirstTimestamp,
                LastTimestamp:  metrics.LastTimestamp,
            }
            
            // 10. 添加到推送队列
            addToPushQueue(metadata, metrics.AggregatedData)
        }
        
        // 11. 保存当前快照
        saveSnapshot(instance.InstanceID, files)
    }
}

// 解析JSONL文件,计算聚合指标
func parseJSONLFile(filePath string) ParsedMetrics {
    file, _ := os.Open(filePath)
    defer file.Close()
    
    var metrics ParsedMetrics
    scanner := bufio.NewScanner(file)
    
    for scanner.Scan() {
        line := scanner.Text()
        var entry SessionLogEntry
        json.Unmarshal([]byte(line), &entry)
        
        // 统计Token
        if entry.Message.Usage != nil {
            metrics.TotalInputTokens += entry.Message.Usage.Input
            metrics.TotalOutputTokens += entry.Message.Usage.Output
            metrics.CacheReadTokens += entry.Message.Usage.CacheRead
            metrics.CacheWriteTokens += entry.Message.Usage.CacheWrite
        }
        
        // 统计消息类型
        switch entry.Message.Role {
        case "user":
            metrics.UserMessageCount++
        case "assistant":
            metrics.AssistantMessageCount++
        }
        
        // 统计工具调用
        for _, content := range entry.Message.Content {
            if content.Type == "tool_use" {
                metrics.ToolCalls[content.Name]++
                if content.IsError {
                    metrics.ToolErrors[content.Name]++
                }
            }
        }
        
        // 统计延迟
        if entry.Message.DurationMs > 0 {
            metrics.Latencies = append(metrics.Latencies, entry.Message.DurationMs)
        }
        
        // 记录模型分布
        modelKey := fmt.Sprintf("%s/%s", entry.Message.Provider, entry.Message.Model)
        metrics.ModelDistribution[modelKey] += entry.Message.Usage.TotalTokens
        
        metrics.LineCount++
        
        // 记录时间范围
        ts := parseTimestamp(entry.Timestamp)
        if metrics.FirstTimestamp == nil || ts.Before(*metrics.FirstTimestamp) {
            metrics.FirstTimestamp = &ts
        }
        if metrics.LastTimestamp == nil || ts.After(*metrics.LastTimestamp) {
            metrics.LastTimestamp = &ts
        }
    }
    
    // 计算延迟统计
    if len(metrics.Latencies) > 0 {
        sort.Slice(metrics.Latencies, func(i, j int) bool {
            return metrics.Latencies[i] < metrics.Latencies[j]
        })
        metrics.AvgLatency = average(metrics.Latencies)
        metrics.P95Latency = percentile(metrics.Latencies, 95)
        metrics.MinLatency = metrics.Latencies[0]
        metrics.MaxLatency = metrics.Latencies[len(metrics.Latencies)-1]
    }
    
    return metrics
}

// 从文件名提取Session ID
func parseSessionIDFromFileName(fileName string) string {
    // 主文件: {sessionId}.jsonl
    if strings.HasSuffix(fileName, ".jsonl") {
        return strings.TrimSuffix(fileName, ".jsonl")
    }
    
    // 归档文件: {sessionId}.jsonl.{reason}.{timestamp}
    for _, reason := range []string{"deleted", "reset"} {
        marker := fmt.Sprintf(".jsonl.%s.", reason)
        if idx := strings.Index(fileName, marker); idx > 0 {
            return fileName[:idx]
        }
    }
    
    return ""
}

// 检测归档原因
func detectArchiveReason(fileName string) string {
    if strings.Contains(fileName, ".deleted.") {
        return "deleted"
    }
    if strings.Contains(fileName, ".reset.") {
        return "reset"
    }
    return ""
}
```

**性能优化:**

1. **增量扫描**: 只处理新增或修改的文件,跳过已处理的文件
2. **流式解析**: 使用`bufio.Scanner`逐行读取,避免一次性加载大文件到内存
3. **并发控制**: 每个Collector最多同时解析10个文件,避免CPU过载
4. **批量推送**: 累积5分钟的指标后一次性推送,减少网络开销
5. **错误容忍**: 单个文件解析失败不影响其他文件,记录错误后继续处理

**资源消耗估算:**

假设每个Collector管理50个实例:
- 每个实例平均每天产生10MB Session Log (约10万行JSONL)
- 每5分钟扫描一次,平均每次扫描10个新/修改文件
- 每个文件平均100KB (1000行)
- 解析速度: 1000行/秒 (Go语言JSON解析性能)
- 单文件解析耗时: ~1秒
- 并发10个文件: 总耗时~1秒
- CPU占用: ~5% (现代CPU)
- 内存占用: ~50MB (缓冲区+数据结构)

**备份与防误删:**

由于OpenClaw会自动清理30天前的归档文件,Collector需要实现备份机制:

```yaml
# Collector配置示例
backup:
  enabled: true
  storage_type: "s3"  # s3, oss, minio
  s3_endpoint: "http://minio.internal:9000"
  s3_bucket: "openclaw-backups"
  s3_prefix: "session-logs"
  retention_days: 365
  compression: "gzip"  # 启用压缩节省空间
  encryption: "aes256" # 服务端加密
```

备份策略详见第5.X节。

---

### 5.X Session Log 备份与防误删机制

#### 5.X.1 背景与挑战

**OpenClaw内置清理机制:**
- 会话删除时,JSONL文件被重命名为 `{sessionId}.jsonl.deleted.{timestamp}`
- 会话重置时,JSONL文件被重命名为 `{sessionId}.jsonl.reset.{timestamp}`
- 默认30天后(可配置),归档文件被自动删除
- 简单的文件同步无法捕获重命名操作,导致备份不完整

**设计目标:**
- 防止用户误删除Session Log文件
- 准确追踪文件重命名(包括归档操作)
- 避免重复备份相同内容(去重)
- 支持按需恢复任意历史版本

#### 5.X.2 备份架构

```
┌─────────────────────────────────────────────┐
│         OpenClaw Instance (共享NAS)          │
│  /sessions/                                  │
│    ├─ session-abc.jsonl                     │
│    ├─ session-abc.jsonl.deleted.T1  ← 重命名 │
│    └─ session-xyz.jsonl                      │
└──────────────┬──────────────────────────────┘
               │ Edge Collector 扫描(5min)
               ↓
┌─────────────────────────────────────────────┐
│         Edge Collector (Go)                  │
│  1. 扫描文件列表                             │
│  2. 提取Session ID(从文件名)                 │
│  3. 查询数据库:Session ID是否已备份?         │
│     ├─ 存在 → 更新文件名映射(检测到重命名)   │
│     └─ 不存在 → 上传备份                     │
│  4. 记录备份状态到OceanBase                  │
└──────────────┬──────────────────────────────┘
               │ HTTP POST /api/backups/sync
               ↓
┌─────────────────────────────────────────────┐
│      Center Service (SpringBoot)             │
│  1. 接收备份状态                             │
│  2. 写入session_log_backups表                │
│  3. 定期验证备份完整性                       │
│  4. 告警:文件存在但未备份                    │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│      Backup Storage (S3/OSS/MinIO)           │
│  /backups/                                   │
│    ├─ inst-001/2026/04/14/session-abc.jsonl.gz │
│    └─ inst-001/2026/04/14/session-xyz.jsonl.gz │
└─────────────────────────────────────────────┘
```

#### 5.X.3 OpenClaw Session Log文件生命周期

**重要:同一个Session ID可能有多个文件!**

根据OpenClaw源码分析,存在以下场景:

**场景A:会话重置/删除(归档)**
```
原始文件: session-abc.jsonl
         ↓ 用户执行 /reset 或 /delete
归档文件: session-abc.jsonl.reset.2026-04-14T10-30-00.000Z
新文件:   session-abc.jsonl (重新开始,相同Session ID)
```

**场景B:会话压缩(Checkpoint)**
```
原始文件: session-abc.jsonl
         ↓ 触发自动压缩(超过token阈值)
Checkpoint: session-abc.checkpoint.{uuid}.jsonl (临时备份)
压缩后:   session-abc.jsonl (内容被精简,保留摘要)
         ↓ Checkpoint清理(压缩完成后立即删除)
最终:     session-abc.jsonl (只有压缩后的版本)
```

**关键代码证据:**
- `archiveFileOnDisk()`: 重命名文件为 `{filePath}.{reason}.{timestamp}`
- `captureCompactionCheckpointSnapshot()`: 复制文件为 `{name}.checkpoint.{uuid}{ext}`
- `cleanupCompactionCheckpointSnapshot()`: 压缩完成后删除checkpoint文件

**对监控和备份的影响:**

1. **session_log_metadata表只记录当前活跃文件**
   - `file_path` 字段指向当前正在使用的文件
   - 归档文件(.reset/.deleted)不会被更新到该表
   - Checkpoint文件是临时的,不会被记录

2. **备份策略需要处理多版本文件**
   - 不能简单地用Session ID作为唯一键
   - 需要区分"同一会话的不同版本"
   - Checkpoint文件不需要备份(临时文件)

3. **Collector扫描逻辑调整**
   - 检测到 `.reset.` 或 `.deleted.` 文件时,标记为归档
   - 检测到 `.checkpoint.` 文件时,跳过不备份
   - 同一Session ID的新文件出现时,创建新的备份记录

#### 5.X.4 数据库设计(修正版)

**session_log_backups 表:**
```sql
CREATE TABLE session_log_backups (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    instance_id VARCHAR(50) NOT NULL COMMENT '实例ID',
    session_id VARCHAR(200) NOT NULL COMMENT '会话ID(从文件名提取)',
    file_name VARCHAR(200) NOT NULL COMMENT '当前文件名',
    file_path VARCHAR(500) COMMENT '当前文件路径',
    file_size BIGINT COMMENT '文件大小(字节)',
    mod_time TIMESTAMP COMMENT '文件修改时间',
    backup_location VARCHAR(500) NOT NULL COMMENT '备份存储路径(S3 key或NAS路径)',
    backed_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '首次备份时间',
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后检测到时间',
    status ENUM('active', 'archived', 'deleted') DEFAULT 'active' COMMENT '状态',
    archive_reason VARCHAR(20) COMMENT '归档原因: reset/deleted',
    version INT DEFAULT 1 COMMENT '版本号(同一Session ID的多次重置会递增)',
    
    -- 修改:允许同一Session ID有多条记录(不同版本)
    INDEX idx_instance_session_version (instance_id, session_id, version),
    INDEX idx_last_seen (last_seen_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Session Log备份索引';
```

**关键变更说明:**
- ❌ 移除 `UNIQUE KEY uk_instance_session` (不再强制唯一)
- ✅ 新增 `version` 字段,区分同一Session ID的不同版本
- ✅ 使用 `(instance_id, session_id, version)` 组合作为业务唯一键

**示例数据:**
```sql
-- 第一次会话
INSERT INTO session_log_backups VALUES 
(1, 'inst-001', 'session-abc', 'session-abc.jsonl', '/path/session-abc.jsonl', 
 102400, '2026-04-10 10:00:00', 's3://.../session-abc.jsonl.gz', 
 '2026-04-10 10:00:00', '2026-04-12 15:00:00', 'archived', 'reset', 1);

-- 用户重置后会话(相同Session ID,新版本)
INSERT INTO session_log_backups VALUES 
(2, 'inst-001', 'session-abc', 'session-abc.jsonl', '/path/session-abc.jsonl', 
 51200, '2026-04-12 15:30:00', 's3://.../session-abc-v2.jsonl.gz', 
 '2026-04-12 15:30:00', '2026-04-14 10:00:00', 'active', NULL, 2);
```

**session_log_name_history 表(可选,用于完整审计):****
```sql
CREATE TABLE session_log_name_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    backup_id BIGINT NOT NULL COMMENT '关联backup记录',
    file_name VARCHAR(200) NOT NULL COMMENT '文件名',
    file_path VARCHAR(500) COMMENT '文件路径',
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '检测时间',
    event_type ENUM('created', 'renamed', 'archived', 'deleted') COMMENT '事件类型',
    
    INDEX idx_backup (backup_id),
    INDEX idx_detected (detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文件名变更历史';
```

#### 5.X.5 Collector扫描逻辑(修正版)

```go
func scanAndBackupSessionLogs(instanceID string) {
    // 1. 扫描目录,获取所有.jsonl文件
    files := scanDirectory(sessionDir)
    
    // 2. 加载上次的备份记录
    lastBackups := loadBackupsFromDB(instanceID)
    
    // 3. 处理每个文件
    for _, file := range files {
        if !isSessionLogFile(file.Name()) {
            continue
        }
        
        // 4. 跳过Checkpoint临时文件
        if strings.Contains(file.Name(), ".checkpoint.") {
            log.Debug("Skip checkpoint file", "file:", file.Name())
            continue
        }
        
        // 5. 提取Session ID
        sessionID := parseSessionIDFromFileName(file.Name())
        if sessionID == "" {
            continue
        }
        
        // 6. 检测归档文件
        isArchived := false
        archiveReason := ""
        if strings.Contains(file.Name(), ".deleted.") {
            isArchived = true
            archiveReason = "deleted"
        } else if strings.Contains(file.Name(), ".reset.") {
            isArchived = true
            archiveReason = "reset"
        }
        
        // 7. 查询数据库:查找该Session ID的最新版本
        latestBackup := findLatestBackupBySessionID(instanceID, sessionID)
        
        if latestBackup == nil {
            // 8a. 新会话,创建备份记录(version=1)
            backupKey := uploadToS3(file.Path)
            saveBackupRecord(SessionLogBackup{
                InstanceID:     instanceID,
                SessionID:      sessionID,
                FileName:       file.Name(),
                FilePath:       file.Path,
                FileSize:       file.Size(),
                ModTime:        file.ModTime(),
                BackupLocation: backupKey,
                BackedUpAt:     time.Now(),
                LastSeenAt:     time.Now(),
                Status:         getInitialStatus(isArchived),
                ArchiveReason:  archiveReason,
                Version:        1,
            })
            
        } else if latestBackup.FileName == file.Name() {
            // 8b. 文件名相同,检查是否有变化
            if file.ModTime().After(latestBackup.LastSeenAt) {
                // 文件被修改(追加了新日志)
                backupKey := uploadToS3(file.Path)
                updateBackupRecord(latestBackup.ID, backupKey, file.ModTime())
            } else {
                // 文件未变,只更新时间戳
                updateLastSeenAt(latestBackup.ID)
            }
            
        } else {
            // 8c. 文件名不同 → 检测到新版本
            // 判断是归档还是重置后重新开始
            
            if isArchived {
                // 情况A:原文件被归档(.reset或.deleted)
                // 更新现有记录的status和archive_reason
                updateBackupStatus(latestBackup.ID, "archived", archiveReason)
                
                // 不创建新记录,因为这是同一个版本的归档
                log.Info("Session archived",
                    "sessionID:", sessionID,
                    "old:", latestBackup.FileName,
                    "new:", file.Name())
                    
            } else {
                // 情况B:用户重置会话,创建了新的活跃文件
                // 旧文件已被重命名为.reset,新文件是相同的Session ID
                // 需要创建新版本记录
                
                // 首先标记旧版本为archived
                updateBackupStatus(latestBackup.ID, "archived", "reset")
                
                // 创建新版本记录(version+1)
                newVersion := latestBackup.Version + 1
                backupKey := uploadToS3(file.Path)
                saveBackupRecord(SessionLogBackup{
                    InstanceID:     instanceID,
                    SessionID:      sessionID,
                    FileName:       file.Name(),
                    FilePath:       file.Path,
                    FileSize:       file.Size(),
                    ModTime:        file.ModTime(),
                    BackupLocation: backupKey,
                    BackedUpAt:     time.Now(),
                    LastSeenAt:     time.Now(),
                    Status:         "active",
                    ArchiveReason:  "",
                    Version:        newVersion,
                })
                
                log.Info("Session reset detected, new version created",
                    "sessionID:", sessionID,
                    "old_version:", latestBackup.Version,
                    "new_version:", newVersion)
            }
        }
    }
    
    // 9. 检测已删除的文件(数据库中有条目但扫描未发现)
    for _, backup := range lastBackups {
        if backup.Status == "active" && !fileExistsInScan(backup.FileName) {
            log.Warn("File disappeared from scan", 
                "sessionID:", backup.SessionID,
                "fileName:", backup.FileName)
            // 可选:标记为deleted,但不删除备份
            // markAsDeleted(backup.ID)
        }
    }
}

// 辅助函数
func getInitialStatus(isArchived bool) string {
    if isArchived {
        return "archived"
    }
    return "active"
}

func findLatestBackupBySessionID(instanceID, sessionID string) *SessionLogBackup {
    // 查询最新版本
    query := `SELECT * FROM session_log_backups 
              WHERE instance_id = ? AND session_id = ? 
              ORDER BY version DESC LIMIT 1`
    return db.QueryOne(query, instanceID, sessionID)
}
```

**关键逻辑说明:**

1. **Checkpoint文件跳过**: `.checkpoint.` 文件是临时的,压缩完成后会被删除,不需要备份
2. **归档检测**: `.reset.` 和 `.deleted.` 文件是原文件的归档,更新status但不创建新版本
3. **版本管理**: 当检测到同一Session ID的新活跃文件时,创建version+1的新记录
4. **状态流转**:
   - `active` → `archived`: 文件被重命名为归档文件
   - `archived` → (保持): 归档文件不再变化
   - 新文件出现 → 创建新版本(`version+1`, status=`active`)

**示例:**

```
扫描周期1:
  文件: session-abc.jsonl
  数据库: session_id="session-abc", file_name="session-abc.jsonl", status="active", version=1

扫描周期2(用户删除会话后):
  文件: session-abc.jsonl.deleted.2026-04-14T10-30-00.000Z
  检测: session_id="session-abc" 已存在,文件名变了且包含".deleted."
  操作: 
    - 更新 status = "archived"
    - 更新 archive_reason = "deleted"
    - 不创建新记录(这是同一版本的归档)

扫描周期3(用户重置会话后):
  文件: session-abc.jsonl (新的活跃文件)
  检测: session_id="session-abc" 已存在,但这是一个新的活跃文件
  操作:
    - 标记旧版本(version=1)为 archived, archive_reason="reset"
    - 创建新版本: version=2, status="active"
    - 上传到S3: s3://.../session-abc-v2.jsonl.gz
```

#### 5.X.5 存储方案选择

**推荐方案:对象存储(S3/OSS/MinIO)**

| 方案 | 成本(年) | 可靠性 | 扩展性 | 运维复杂度 | 推荐度 |
|------|---------|--------|--------|-----------|--------|
| **第二NAS** | $2500 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **MinIO自建** | $3500 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **阿里云OSS** | $940 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **AWS S3** | $1000 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **混合方案** | $4600 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **OceanBase** | $10000+ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ❌ |

**理由:**
1. ✅ **成本最低**:比NAS便宜60%以上
2. ✅ **可靠性最高**:99.999999999%持久性
3. ✅ **运维最简单**:无需管理硬件
4. ✅ **扩展性最好**:无限容量
5. ✅ **功能最全**:版本控制、生命周期、跨区域复制

#### 5.X.6 配置要求

**OpenClaw配置调整(延长清理周期):**
```json
{
  "session": {
    "maintenance": {
      "mode": "warn",
      "pruneAfter": "90d",
      "maxEntries": 10000,
      "resetArchiveRetention": "90d"
    }
  }
}
```

**Collector配置:**
```yaml
# config.yaml
backup:
  enabled: true
  storage_type: "s3"  # s3, oss, minio
  s3_endpoint: "http://minio.internal:9000"
  s3_bucket: "openclaw-backups"
  s3_access_key: "${MINIO_ACCESS_KEY}"
  s3_secret_key: "${MINIO_SECRET_KEY}"
  s3_prefix: "session-logs"
  retention_days: 365  # 备份保留365天
  scan_interval: 5m    # 扫描频率
  max_file_size_mb: 500  # 单文件最大500MB
  compression: "gzip"    # 启用Gzip压缩
  encryption: "aes256"   # 服务端加密
```

**S3/OSS生命周期规则(在控制台配置):**
```json
{
  "rules": [
    {
      "id": "session-log-lifecycle",
      "status": "Enabled",
      "filter": {"prefix": "session-logs/"},
      "transitions": [
        {
          "days": 30,
          "storageClass": "IA"  // 低频访问
        },
        {
          "days": 90,
          "storageClass": "Archive"  // 归档存储
        }
      ],
      "expiration": {
        "days": 365  // 365天后自动删除
      }
    }
  ]
}
```

#### 5.X.7 恢复流程

**场景1:恢复被删除的会话(最新版本)**
```bash
#!/bin/bash
# restore-session.sh

INSTANCE_ID=$1
SESSION_ID=$2

# 1. 从数据库查询最新版本的备份位置
BACKUP_LOCATION=$(mysql -N -e "
  SELECT backup_location FROM session_log_backups 
  WHERE instance_id='$INSTANCE_ID' AND session_id='$SESSION_ID'
  ORDER BY version DESC LIMIT 1;
")

if [ -z "$BACKUP_LOCATION" ]; then
  echo "No backup found for session $SESSION_ID"
  exit 1
fi

# 2. 从S3下载
aws s3 cp "s3://openclaw-backups/$BACKUP_LOCATION" ./recovered.jsonl.gz

# 3. 解压
gunzip recovered.jsonl.gz

# 4. 恢复到NAS
cp recovered.jsonl "/nas/sessions/${SESSION_ID}.jsonl"

echo "Session restored successfully (latest version)"
```

**场景2:恢复指定版本的会话**
```bash
#!/bin/bash
# restore-session-version.sh

INSTANCE_ID=$1
SESSION_ID=$2
VERSION=$3  # 指定版本号

# 1. 从数据库查询指定版本的备份位置
BACKUP_LOCATION=$(mysql -N -e "
  SELECT backup_location FROM session_log_backups 
  WHERE instance_id='$INSTANCE_ID' 
    AND session_id='$SESSION_ID'
    AND version=$VERSION
  LIMIT 1;
")

if [ -z "$BACKUP_LOCATION" ]; then
  echo "No backup found for session $SESSION_ID version $VERSION"
  exit 1
fi

# 2. 从S3下载
aws s3 cp "s3://openclaw-backups/$BACKUP_LOCATION" ./recovered-v${VERSION}.jsonl.gz

# 3. 解压
gunzip recovered-v${VERSION}.jsonl.gz

# 4. 恢复到NAS(使用不同的文件名避免覆盖)
cp recovered-v${VERSION}.jsonl "/nas/sessions/${SESSION_ID}-v${VERSION}.jsonl"

echo "Session restored successfully (version $VERSION)"
```

**场景3:查看会话的所有版本历史**
```sql
SELECT 
    version,
    file_name,
    status,
    archive_reason,
    file_size,
    backed_up_at,
    last_seen_at,
    backup_location
FROM session_log_backups 
WHERE instance_id = 'inst-001' 
  AND session_id = 'session-abc'
ORDER BY version ASC;

-- 输出示例:
-- +---------+-------------------------------------------+----------+----------------+------------+---------------------+---------------------+------------------------------------+
-- | version | file_name                                 | status   | archive_reason | file_size  | backed_up_at        | last_seen_at        | backup_location                    |
-- +---------+-------------------------------------------+----------+----------------+------------+---------------------+---------------------+------------------------------------+
-- |       1 | session-abc.jsonl.deleted.2026-04-12T...  | archived | deleted        |     102400 | 2026-04-10 10:00:00 | 2026-04-12 15:00:00 | s3://.../session-abc-v1.jsonl.gz   |
-- |       2 | session-abc.jsonl                         | active   | NULL           |      51200 | 2026-04-12 15:30:00 | 2026-04-14 10:00:00 | s3://.../session-abc-v2.jsonl.gz   |
-- +---------+-------------------------------------------+----------+----------------+------------+---------------------+---------------------+------------------------------------+
```

**场景4:查看文件重命名历史(可选,需要session_log_name_history表)**
```sql
SELECT h.file_name, h.event_type, h.detected_at
FROM session_log_name_history h
JOIN session_log_backups b ON h.backup_id = b.id
WHERE b.session_id = 'session-abc'
ORDER BY h.detected_at;

-- 输出示例:
-- session-abc.jsonl              | created  | 2026-04-10 10:00:00
-- session-abc.jsonl.deleted.T1   | renamed  | 2026-04-12 15:30:00
-- session-abc.jsonl              | created  | 2026-04-12 15:30:00  (新版本)
```

---

### 5.4 Registry Service (SpringBoot)

#### 5.4.1 功能职责

- Collector注册与心跳管理
- OpenClaw实例管理
- 实例分配算法(简单轮询)
- 自动Rebalance(事件驱动 + 定期巡检)
- 故障检测与转移(心跳超时>2分钟)
- 提供实例分配查询API

#### 5.4.2 数据库表结构

```sql
-- ==================== Registry相关表 ====================

-- Collector注册表
-- 用途: 记录所有Edge Collector的注册信息和健康状态
CREATE TABLE collectors (
    collector_id VARCHAR(50) PRIMARY KEY COMMENT 'Collector唯一标识',
    host VARCHAR(100) NOT NULL COMMENT 'Collector主机IP或域名',
    port INT NOT NULL COMMENT 'Collector服务端口',
    capacity INT DEFAULT 100 COMMENT '最大管理实例数容量',
    status ENUM('active', 'inactive', 'draining') DEFAULT 'active' COMMENT '状态: active=活跃, inactive=失效, draining=下线中',
    last_heartbeat TIMESTAMP NULL COMMENT '最后一次心跳时间',
    instance_count INT DEFAULT 0 COMMENT '当前管理的实例数量',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_status (status) COMMENT '按状态查询索引',
    INDEX idx_last_heartbeat (last_heartbeat) COMMENT '按心跳时间查询索引(用于故障检测)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Edge Collector注册表';

-- OpenClaw实例表
-- 用途: 记录所有被监控的OpenClaw实例基本信息
CREATE TABLE openclaw_instances (
    instance_id VARCHAR(50) PRIMARY KEY COMMENT '实例唯一标识',
    gateway_url VARCHAR(200) NOT NULL COMMENT 'Gateway WebSocket地址 ws://host:port',
    auth_token VARCHAR(500) COMMENT '认证Token(如果需要)',
    status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态: active=活跃, inactive=停用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OpenClaw实例注册表';

-- 实例-Collector映射表
-- 用途: 记录每个OpenClaw实例分配给哪个Collector管理
CREATE TABLE instance_collector_mapping (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    instance_id VARCHAR(50) NOT NULL COMMENT '实例ID',
    collector_id VARCHAR(50) NOT NULL COMMENT 'Collector ID',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
    UNIQUE KEY uk_instance (instance_id) COMMENT '实例唯一约束(一个实例只能分配给一个Collector)',
    INDEX idx_collector (collector_id) COMMENT '按Collector查询索引',
    FOREIGN KEY (instance_id) REFERENCES openclaw_instances(instance_id) ON DELETE CASCADE COMMENT '外键:实例删除时级联删除映射',
    FOREIGN KEY (collector_id) REFERENCES collectors(collector_id) ON DELETE CASCADE COMMENT '外键:Collector删除时级联删除映射'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='实例与Collector分配关系表';

-- Rebalance历史记录表
-- 用途: 记录Rebalance操作的历史,便于审计和故障排查
CREATE TABLE rebalance_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    trigger_type ENUM('collector_register', 'collector_unregister', 'scheduled', 'manual') NOT NULL COMMENT '触发类型',
    trigger_collector_id VARCHAR(50) COMMENT '触发本次Rebalance的Collector ID',
    total_instances INT NOT NULL DEFAULT 0 COMMENT '涉及的总实例数',
    reassigned_count INT NOT NULL DEFAULT 0 COMMENT '实际重新分配的实例数',
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
    completed_at TIMESTAMP NULL COMMENT '完成时间',
    status ENUM('running', 'completed', 'failed') DEFAULT 'running' COMMENT '执行状态',
    error_message TEXT COMMENT '如果失败,记录错误信息',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_trigger_type (trigger_type) COMMENT '按触发类型查询',
    INDEX idx_started_at (started_at) COMMENT '按开始时间查询',
    INDEX idx_status (status) COMMENT '按状态查询'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Rebalance操作历史记录表';
```

#### 5.4.3 核心Service

**InstanceAssignmentService.java**

```java
/**
 * 实例分配服务
 * 负责Collector注册、实例分配、Rebalance、故障转移
 */
@Service
@Slf4j
public class InstanceAssignmentService {
    
    @Autowired
    private CollectorRepository collectorRepo;
    
    @Autowired
    private InstanceRepository instanceRepo;
    
    @Autowired
    private MappingRepository mappingRepo;
    
    @Autowired
    private ApplicationEventPublisher eventPublisher;
    
    /**
     * Collector注册
     * @param request 注册请求
     */
    @Transactional
    public void registerCollector(RegisterRequest request) {
        Collector collector = collectorRepo.findById(request.getCollectorId())
            .orElse(new Collector());
        
        collector.setCollectorId(request.getCollectorId());
        collector.setHost(request.getHost());
        collector.setPort(request.getPort());
        collector.setCapacity(request.getCapacity());
        collector.setStatus(CollectorStatus.ACTIVE);
        collector.setLastHeartbeat(LocalDateTime.now());
        
        collectorRepo.save(collector);
        
        log.info("Collector registered: {}", request.getCollectorId());
        
        // 发布事件,触发Rebalance
        eventPublisher.publishEvent(new CollectorRegisteredEvent(request.getCollectorId()));
    }
    
    /**
     * 心跳上报
     * @param request 心跳请求
     */
    @Transactional
    public void heartbeat(HeartbeatRequest request) {
        Collector collector = collectorRepo.findById(request.getCollectorId())
            .orElseThrow(() -> new RuntimeException("Collector not found"));
        
        collector.setLastHeartbeat(LocalDateTime.now());
        collector.setInstanceCount(request.getInstanceCount());
        collectorRepo.save(collector);
    }
    
    /**
     * 获取Collector分配的实例列表
     * @param collectorId Collector ID
     * @return 实例列表
     */
    public List<OpenClawInstance> getAssignedInstances(String collectorId) {
        return mappingRepo.findByCollectorId(collectorId)
            .stream()
            .map(mapping -> {
                OpenClawInstance instance = instanceRepo.findById(mapping.getInstanceId())
                    .orElseThrow(() -> new RuntimeException("Instance not found"));
                return instance;
            })
            .collect(Collectors.toList());
    }
    
    /**
     * 处理Collector注册事件(触发Rebalance)
     */
    @EventListener
    @Transactional
    public void handleCollectorRegistered(CollectorRegisteredEvent event) {
        log.info("Rebalancing triggered by new collector: {}", event.getCollectorId());
        rebalance();
    }
    
    /**
     * 定期巡检Rebalance(每小时执行)
     */
    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void scheduledRebalance() {
        log.info("Scheduled rebalance running");
        rebalance();
    }
    
    /**
     * 核心Rebalance算法(简单轮询)
     * 将所有未分配的实例均匀分配给活跃的Collector
     */
    @Transactional
    public void rebalance() {
        // 1. 获取所有活跃的Collector
        List<Collector> activeCollectors = collectorRepo.findByStatus(CollectorStatus.ACTIVE);
        if (activeCollectors.isEmpty()) {
            log.warn("No active collectors");
            return;
        }
        
        // 2. 获取所有未分配的实例
        List<String> unassignedInstanceIds = mappingRepo.findUnassignedInstances();
        if (unassignedInstanceIds.isEmpty()) {
            log.info("No unassigned instances");
            return;
        }
        
        // 3. 简单轮询分配
        int i = 0;
        for (String instanceId : unassignedInstanceIds) {
            Collector collector = activeCollectors.get(i % activeCollectors.size());
            
            InstanceCollectorMapping mapping = new InstanceCollectorMapping();
            mapping.setInstanceId(instanceId);
            mapping.setCollectorId(collector.getCollectorId());
            mapping.setAssignedAt(LocalDateTime.now());
            
            mappingRepo.save(mapping);
            
            // 更新Collector的实例计数
            collector.setInstanceCount(
                mappingRepo.countByCollectorId(collector.getCollectorId())
            );
            collectorRepo.save(collector);
            
            i++;
        }
        
        log.info("Rebalanced {} instances", unassignedInstanceIds.size());
    }
    
    /**
     * 检测Collector健康状态(每分钟执行)
     * 心跳超时>2分钟的标记为inactive,并迁移其实例
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void checkCollectorHealth() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(2);
        
        List<Collector> inactiveCollectors = collectorRepo
            .findByStatusAndLastHeartbeatBefore(CollectorStatus.ACTIVE, threshold);
        
        for (Collector collector : inactiveCollectors) {
            log.warn("Collector inactive: {}", collector.getCollectorId());
            
            // 标记为inactive
            collector.setStatus(CollectorStatus.INACTIVE);
            collectorRepo.save(collector);
            
            // 迁移其实例
            migrateInstancesFromCollector(collector.getCollectorId());
        }
    }
    
    /**
     * 迁移失效Collector的实例
     * @param collectorId 失效的Collector ID
     */
    @Transactional
    private void migrateInstancesFromCollector(String collectorId) {
        // 删除该Collector的所有映射
        mappingRepo.deleteByCollectorId(collectorId);
        
        // 触发Rebalance
        rebalance();
    }
}
```

#### 5.4.4 REST API端点

```
POST /api/registry/collectors/register
  Body: {collector_id, host, port, capacity}
  Desc: Collector注册

POST /api/registry/collectors/heartbeat
  Body: {collector_id, timestamp, instance_count}
  Desc: 心跳上报

GET /api/registry/collectors/{collectorId}/instances
  Response: [{instance_id, gateway_url, auth_token}]
  Desc: 获取分配的实例列表

POST /api/registry/rebalance
  Desc: 手动触发Rebalance(管理接口)

GET /api/registry/collectors
  Response: [{collector_id, status, instance_count, last_heartbeat}]
  Desc: 查看所有Collector状态(管理接口)
```

---

### 5.5 Center Service (SpringBoot)

#### 5.5.1 功能职责

- 接收Edge Collector批量推送的指标数据
- 解析并入库Session Log元数据
- 调用外部用户服务API获取用户映射
- 聚合指标写入OceanBase
- 归档原始JSONL文件到NAS
- 提供REST API供前端查询
- Redis缓存实时状态

#### 5.5.2 数据库表结构

```sql
-- ==================== Session Log元数据表 ====================

-- Session Log元数据表
-- 用途: 记录所有采集到的Session Log文件元信息,支持从归档恢复
CREATE TABLE session_log_metadata (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    instance_id VARCHAR(50) NOT NULL COMMENT 'OpenClaw实例ID',
    user_id VARCHAR(50) COMMENT '用户ID(从外部API查询后填充)',
    file_path VARCHAR(500) NOT NULL COMMENT '原始文件绝对路径',
    file_name VARCHAR(200) NOT NULL COMMENT '原始文件名',
    file_size BIGINT COMMENT '文件大小(字节)',
    line_count INT COMMENT 'JSONL行数',
    first_timestamp TIMESTAMP NULL COMMENT '第一条日志的时间戳',
    last_timestamp TIMESTAMP NULL COMMENT '最后一条日志的时间戳',
    archived_location VARCHAR(200) COMMENT '归档位置(NAS路径)',
    archived_at TIMESTAMP NULL COMMENT '归档时间',
    ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '入库时间',
    status ENUM('pending', 'processed', 'archived', 'failed') DEFAULT 'pending' COMMENT '处理状态: pending=待处理, processed=已处理, archived=已归档, failed=失败',
    error_message TEXT COMMENT '错误信息(如果失败)',
    INDEX idx_instance_user (instance_id, user_id) COMMENT '按实例和用户查询索引',
    INDEX idx_ingested_at (ingested_at) COMMENT '按入库时间查询索引',
    INDEX idx_status (status) COMMENT '按状态查询索引(用于重试失败任务)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Session Log文件元数据表';

-- ==================== 聚合指标表 ====================

-- Token消耗日报表
-- 用途: 按天统计各实例/Provider/Model的Token消耗
CREATE TABLE metrics_token_daily (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    stat_date DATE NOT NULL COMMENT '统计日期',
    instance_id VARCHAR(50) COMMENT '实例ID',
    agent_id VARCHAR(50) COMMENT 'Agent ID',
    channel VARCHAR(50) COMMENT '渠道类型',
    provider VARCHAR(50) COMMENT 'LLM Provider名称',
    model VARCHAR(100) COMMENT '模型名称',
    input_tokens BIGINT DEFAULT 0 COMMENT '输入Token数',
    output_tokens BIGINT DEFAULT 0 COMMENT '输出Token数',
    cache_read BIGINT DEFAULT 0 COMMENT '缓存读取Token数',
    cache_write BIGINT DEFAULT 0 COMMENT '缓存写入Token数',
    total_tokens BIGINT DEFAULT 0 COMMENT '总Token数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_date_instance_provider (stat_date, instance_id, provider, model) COMMENT '唯一约束:同一天同一实例同一Provider+Model只有一条记录',
    INDEX idx_stat_date (stat_date) COMMENT '按日期查询索引',
    INDEX idx_instance_id (instance_id) COMMENT '按实例查询索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Token消耗日报表';

-- 消息统计日报表
-- 用途: 按天统计各实例的消息数量
CREATE TABLE metrics_message_daily (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    stat_date DATE NOT NULL COMMENT '统计日期',
    instance_id VARCHAR(50) COMMENT '实例ID',
    agent_id VARCHAR(50) COMMENT 'Agent ID',
    channel VARCHAR(50) COMMENT '渠道类型',
    session_count INT DEFAULT 0 COMMENT '会话数量',
    user_messages INT DEFAULT 0 COMMENT '用户消息数',
    assistant_msgs INT DEFAULT 0 COMMENT '助手回复数',
    tool_calls INT DEFAULT 0 COMMENT '工具调用次数',
    errors INT DEFAULT 0 COMMENT '错误数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_date_instance (stat_date, instance_id) COMMENT '唯一约束:同一天同一实例只有一条记录',
    INDEX idx_stat_date (stat_date) COMMENT '按日期查询索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息统计日报表';

-- 延迟统计日报表
-- 用途: 按天统计各实例/Provider的响应延迟
CREATE TABLE metrics_latency_daily (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    stat_date DATE NOT NULL COMMENT '统计日期',
    instance_id VARCHAR(50) COMMENT '实例ID',
    provider VARCHAR(50) COMMENT 'LLM Provider名称',
    model VARCHAR(100) COMMENT '模型名称',
    avg_ms DECIMAL(10,2) COMMENT '平均延迟(ms)',
    p95_ms DECIMAL(10,2) COMMENT 'P95延迟(ms)',
    min_ms DECIMAL(10,2) COMMENT '最小延迟(ms)',
    max_ms DECIMAL(10,2) COMMENT '最大延迟(ms)',
    sample_count INT DEFAULT 0 COMMENT '样本数量',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_date_instance_provider (stat_date, instance_id, provider) COMMENT '唯一约束',
    INDEX idx_stat_date (stat_date) COMMENT '按日期查询索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='延迟统计日报表';

-- 工具使用统计表
-- 用途: 按天统计各实例的工具调用情况
CREATE TABLE metrics_tool_usage (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    stat_date DATE NOT NULL COMMENT '统计日期',
    instance_id VARCHAR(50) COMMENT '实例ID',
    agent_id VARCHAR(50) COMMENT 'Agent ID',
    tool_name VARCHAR(100) COMMENT '工具名称',
    call_count INT DEFAULT 0 COMMENT '调用次数',
    success_count INT DEFAULT 0 COMMENT '成功次数',
    error_count INT DEFAULT 0 COMMENT '失败次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_date_instance_tool (stat_date, instance_id, tool_name) COMMENT '唯一约束:同一天同一实例同一工具只有一条记录',
    INDEX idx_stat_date (stat_date) COMMENT '按日期查询索引',
    INDEX idx_tool_name (tool_name) COMMENT '按工具名称查询索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具使用统计表';

-- 用户活跃度表
-- 用途: 按天统计各用户的活跃情况
CREATE TABLE metrics_user_activity (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    stat_date DATE NOT NULL COMMENT '统计日期',
    instance_id VARCHAR(50) COMMENT '实例ID',
    channel VARCHAR(50) COMMENT '渠道类型',
    user_id VARCHAR(100) COMMENT '用户ID',
    session_id VARCHAR(100) COMMENT '会话ID',
    first_activity TIMESTAMP NULL COMMENT '首次活动时间',
    last_activity TIMESTAMP NULL COMMENT '最后活动时间',
    message_count INT DEFAULT 0 COMMENT '消息数量',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_stat_date (stat_date) COMMENT '按日期查询索引',
    INDEX idx_user_id (user_id) COMMENT '按用户ID查询索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户活跃度表';

-- Skill使用小时级聚合表
-- 用途: 按小时统计各实例/Skill的性能指标，用于快速查询和趋势分析
-- 由定时任务每小时计算一次 (见 11.3 数据聚合策略)
CREATE TABLE metrics_skill_hourly_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    bucket_time TIMESTAMP NOT NULL COMMENT '统计时间窗口起点',
    instance_id VARCHAR(50) COMMENT '实例ID',
    skill_name VARCHAR(100) COMMENT 'Skill名称',
    total_calls INT DEFAULT 0 COMMENT '总调用次数',
    success_count INT DEFAULT 0 COMMENT '成功次数',
    error_count INT DEFAULT 0 COMMENT '失败次数',
    avg_duration_ms DECIMAL(10,2) DEFAULT 0 COMMENT '平均耗时(ms)',
    p95_duration_ms DECIMAL(10,2) DEFAULT 0 COMMENT 'P95耗时(ms)',
    p99_duration_ms DECIMAL(10,2) DEFAULT 0 COMMENT 'P99耗时(ms)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_bucket_instance_skill (bucket_time, instance_id, skill_name) COMMENT '唯一约束',
    INDEX idx_bucket_time (bucket_time) COMMENT '按时间窗口查询',
    INDEX idx_instance_id (instance_id) COMMENT '按实例查询',
    INDEX idx_skill_name (skill_name) COMMENT '按Skill查询'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Skill使用小时级聚合表';

-- ==================== Redis实时状态存储 ====================
-- 说明: 实例健康、渠道状态、配额状态等实时数据存储在Redis中，不持久化到数据库
-- Redis Key设计见下方 "5.5.3 Redis数据结构设计" 章节

-- ==================== 告警事件表(Phase 3) ====================
CREATE TABLE alert_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    alert_time TIMESTAMP NOT NULL COMMENT '告警触发时间',
    rule_name VARCHAR(100) COMMENT '告警规则名称',
    severity VARCHAR(20) COMMENT '严重级别: info/warning/critical',
    instance_id VARCHAR(50) COMMENT '实例ID',
    metric_name VARCHAR(100) COMMENT '指标名称',
    metric_value DECIMAL(10,2) COMMENT '指标值',
    threshold DECIMAL(10,2) COMMENT '阈值',
    message TEXT COMMENT '告警消息',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active=活跃, resolved=已解决',
    resolved_at TIMESTAMP NULL COMMENT '解决时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_alert_time (alert_time) COMMENT '按告警时间查询索引',
    INDEX idx_status (status) COMMENT '按状态查询索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警事件表';
```

#### 5.5.3 Redis数据结构设计

**设计原则:**
- 实时状态数据只存储在Redis，不持久化到数据库
- TTL设置为5分钟（300秒），过期后显示"数据过时"
- Edge Collector每30秒更新一次Redis
- Dashboard通过API从Redis读取最新状态

**Redis Key设计规范:**

```redis
# 1. 实例健康状态 (Hash)
# Key: monitor:instance:{instance_id}
# TTL: 300s
HSET monitor:instance:inst-001 ok "true" duration_ms "45" channel_count "3" agent_count "2" last_seen "2026-04-13T10:30:00Z"

# 2. 渠道连接状态 (Hash)
# Key: monitor:channel:{instance_id}:{channel}
# TTL: 300s
HSET monitor:channel:inst-001:telegram linked "true" configured "true" probe_ok "true" probe_ms "120" account_id "acc-123"

# 3. LLM配额状态 (Hash)
# Key: monitor:quota:{instance_id}:{provider}
# TTL: 300s
HSET monitor:quota:inst-001:openai plan "pro" used_percent "65.50" reset_at "2026-05-01T00:00:00Z"

# 4. 汇总状态缓存 (String - JSON格式)
# Key: monitor:summary
# TTL: 60s (快速聚合，减少遍历开销)
SET monitor:summary '{"total_instances":100,"healthy":97,"unhealthy":3,"channels":{"total":150,"linked":145,"unlinked":5},"quotas_warning":[{"instance":"inst-005","provider":"openai","used_percent":85.5}]}' EX 60

# 5. 异常实例列表 (Set)
# Key: monitor:unhealthy_instances
# TTL: 300s
SADD monitor:unhealthy_instances "inst-003" "inst-007" "inst-012"
```

**数据结构说明:**

| Redis Key | 类型 | 用途 | 更新频率 | TTL |
|-----------|------|------|---------|-----|
| `monitor:instance:{id}` | Hash | 单个实例的健康状态 | 30秒 | 300秒 |
| `monitor:channel:{id}:{ch}` | Hash | 单个渠道的连接状态 | 30秒 | 300秒 |
| `monitor:quota:{id}:{prov}` | Hash | 单个Provider的配额状态 | 5分钟 | 300秒 |
| `monitor:summary` | String (JSON) | 全局汇总状态（用于Dashboard卡片） | 60秒 | 60秒 |
| `monitor:unhealthy_instances` | Set | 异常实例ID集合（用于快速查询） | 30秒 | 300秒 |

**Java代码示例 - Redis操作:**

```java
/**
 * Redis实时状态服务
 */
@Service
@Slf4j
public class RealtimeStatusService {
    
    @Autowired
    private StringRedisTemplate redisTemplate;
    
    private static final long STATUS_TTL = 300; // 5分钟
    
    /**
     * 更新实例健康状态
     */
    public void updateInstanceHealth(String instanceId, HealthStatus status) {
        String key = "monitor:instance:" + instanceId;
        Map<String, String> data = new HashMap<>();
        data.put("ok", String.valueOf(status.isOk()));
        data.put("duration_ms", String.valueOf(status.getDurationMs()));
        data.put("channel_count", String.valueOf(status.getChannelCount()));
        data.put("agent_count", String.valueOf(status.getAgentCount()));
        data.put("last_seen", Instant.now().toString());
        
        redisTemplate.opsForHash().putAll(key, data);
        redisTemplate.expire(key, STATUS_TTL, TimeUnit.SECONDS);
        
        // 更新异常实例集合
        if (!status.isOk()) {
            redisTemplate.opsForSet().add("monitor:unhealthy_instances", instanceId);
        } else {
            redisTemplate.opsForSet().remove("monitor:unhealthy_instances", instanceId);
        }
    }
    
    /**
     * 获取所有实例的汇总状态（用于Dashboard卡片）
     */
    public DashboardSummary getDashboardSummary() {
        // 先从缓存读取
        String cached = redisTemplate.opsForValue().get("monitor:summary");
        if (cached != null) {
            return parseSummary(cached);
        }
        
        // 缓存未命中，实时计算
        Long totalInstances = redisTemplate.keys("monitor:instance:*").size();
        Long unhealthyCount = redisTemplate.opsForSet().size("monitor:unhealthy_instances");
        
        DashboardSummary summary = new DashboardSummary();
        summary.setTotalInstances(totalInstances.intValue());
        summary.setHealthyInstances(totalInstances.intValue() - unhealthyCount.intValue());
        summary.setUnhealthyInstances(unhealthyCount.intValue());
        
        // 写入缓存
        redisTemplate.opsForValue().set(
            "monitor:summary", 
            toJson(summary), 
            60, 
            TimeUnit.SECONDS
        );
        
        return summary;
    }
    
    /**
     * 获取异常实例详情（用于抽屉展示）
     */
    public List<InstanceDetail> getUnhealthyInstances() {
        Set<String> unhealthyIds = redisTemplate.opsForSet().members("monitor:unhealthy_instances");
        if (unhealthyIds == null || unhealthyIds.isEmpty()) {
            return Collections.emptyList();
        }
        
        List<InstanceDetail> details = new ArrayList<>();
        for (String instanceId : unhealthyIds) {
            String key = "monitor:instance:" + instanceId;
            Map<Object, Object> hashData = redisTemplate.opsForHash().entries(key);
            
            InstanceDetail detail = new InstanceDetail();
            detail.setInstanceId(instanceId);
            detail.setOk(Boolean.parseBoolean((String) hashData.get("ok")));
            detail.setDurationMs(Integer.parseInt((String) hashData.get("duration_ms")));
            detail.setLastSeen((String) hashData.get("last_seen"));
            details.add(detail);
        }
        
        return details;
    }
}
```

#### 5.5.4 核心Service

**SessionLogIngestionService.java**

```java
/**
 * Session Log入库服务
 * 负责解析Session Log元数据、聚合指标、归档文件
 */
@Service
@Slf4j
public class SessionLogIngestionService {
    
    @Autowired
    private SessionLogMetadataRepository metadataRepo;
    
    @Autowired
    private MetricsTokenDailyRepository tokenRepo;
    
    @Autowired
    private MetricsMessageDailyRepository messageRepo;
    
    @Autowired
    private MetricsToolUsageRepository toolUsageRepo;
    
    @Autowired
    private UserService userService; // 外部用户服务
    
    @Value("${archive.storage.path:/data/archives}")
    private String archivePath;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    /**
     * 处理Collector推送的Session Log元数据
     * @param dto Session Log元数据DTO
     */
    @Transactional
    public void ingestSessionLogMetadata(SessionLogMetadataDTO dto) {
        // 1. 保存元数据
        SessionLogMetadata metadata = new SessionLogMetadata();
        metadata.setInstanceId(dto.getInstanceId());
        metadata.setFilePath(dto.getFilePath());
        metadata.setFileName(dto.getFileName());
        metadata.setFileSize(dto.getFileSize());
        metadata.setLineCount(dto.getLineCount());
        metadata.setFirstTimestamp(dto.getFirstTimestamp());
        metadata.setLastTimestamp(dto.getLastTimestamp());
        metadata.setStatus("pending");
        
        // 2. 查询用户ID(从外部API)
        try {
            String userId = userService.getUserIdByInstanceId(dto.getInstanceId());
            metadata.setUserId(userId);
        } catch (Exception e) {
            log.warn("Failed to get user ID for instance: {}", dto.getInstanceId(), e);
        }
        
        metadataRepo.save(metadata);
        
        // 3. 异步解析和归档
        CompletableFuture.runAsync(() -> parseAndArchive(metadata));
    }
    
    /**
     * 解析Session Log文件并归档
     * @param metadata 元数据记录
     */
    private void parseAndArchive(SessionLogMetadata metadata) {
        try {
            // 1. 读取文件
            Path filePath = Paths.get(metadata.getFilePath());
            if (!Files.exists(filePath)) {
                throw new FileNotFoundException("File not found: " + metadata.getFilePath());
            }
            
            // 2. 流式解析JSONL
            List<ParsedSession> sessions = parseJsonlFile(filePath);
            
            // 3. 聚合指标
            AggregateMetrics metrics = aggregateMetrics(sessions);
            
            // 4. 写入聚合表
            saveAggregateMetrics(metadata.getInstanceId(), metrics);
            
            // 5. 归档原始文件
            String archiveLocation = archiveFile(filePath, metadata);
            
            // 6. 更新元数据状态
            metadata.setStatus("archived");
            metadata.setArchivedLocation(archiveLocation);
            metadata.setArchivedAt(LocalDateTime.now());
            metadataRepo.save(metadata);
            
            log.info("Session log processed: {}", metadata.getFileName());
            
        } catch (Exception e) {
            log.error("Failed to process session log: {}", metadata.getFileName(), e);
            metadata.setStatus("failed");
            metadata.setErrorMessage(e.getMessage());
            metadataRepo.save(metadata);
        }
    }
    
    /**
     * 流式解析JSONL文件
     * @param filePath 文件路径
     * @return 解析后的会话列表
     */
    private List<ParsedSession> parseJsonlFile(Path filePath) throws IOException {
        List<ParsedSession> sessions = new ArrayList<>();
        Map<String, ParsedSession> sessionMap = new HashMap<>();
        
        try (Stream<String> lines = Files.lines(filePath)) {
            lines.forEach(line -> {
                try {
                    JsonNode event = objectMapper.readTree(line);
                    JsonNode message = event.get("message");
                    
                    if (message == null) return;
                    
                    // 提取session信息
                    String sessionId = extractSessionId(event);
                    ParsedSession session = sessionMap.computeIfAbsent(sessionId, 
                        k -> new ParsedSession());
                    
                    // 解析token、tool等信息
                    updateSession(session, message);
                    
                } catch (Exception e) {
                    log.warn("Failed to parse line", e);
                }
            });
        }
        
        return new ArrayList<>(sessionMap.values());
    }
    
    /**
     * 聚合指标
     * @param sessions 会话列表
     * @return 聚合后的指标
     */
    private AggregateMetrics aggregateMetrics(List<ParsedSession> sessions) {
        AggregateMetrics metrics = new AggregateMetrics();
        
        for (ParsedSession session : sessions) {
            // 按provider/model聚合token
            metrics.getTokenStats()
                .computeIfAbsent(session.getProvider(), k -> new HashMap<>())
                .computeIfAbsent(session.getModel(), k -> new TokenStats())
                .accumulate(session);
            
            // 按tool聚合使用统计
            for (ToolCall tool : session.getToolCalls()) {
                metrics.getToolStats()
                    .computeIfAbsent(tool.getName(), k -> new ToolStats())
                    .accumulate(tool);
            }
            
            // 累加消息数
            metrics.addMessageCount(session.getMessageCount());
        }
        
        return metrics;
    }
    
    /**
     * 保存聚合指标到数据库
     * @param instanceId 实例ID
     * @param metrics 聚合指标
     */
    @Transactional
    private void saveAggregateMetrics(String instanceId, AggregateMetrics metrics) {
        LocalDate today = LocalDate.now();
        
        // 保存Token统计
        for (Map.Entry<String, Map<String, TokenStats>> providerEntry : 
                metrics.getTokenStats().entrySet()) {
            String provider = providerEntry.getKey();
            
            for (Map.Entry<String, TokenStats> modelEntry : 
                    providerEntry.getValue().entrySet()) {
                String model = modelEntry.getKey();
                TokenStats stats = modelEntry.getValue();
                
                MetricsTokenDaily tokenRecord = new MetricsTokenDaily();
                tokenRecord.setStatDate(today);
                tokenRecord.setInstanceId(instanceId);
                tokenRecord.setProvider(provider);
                tokenRecord.setModel(model);
                tokenRecord.setInputTokens(stats.getInputTokens());
                tokenRecord.setOutputTokens(stats.getOutputTokens());
                tokenRecord.setTotalTokens(stats.getTotalTokens());
                
                tokenRepo.save(tokenRecord);
            }
        }
        
        // 保存消息统计
        MetricsMessageDaily messageRecord = new MetricsMessageDaily();
        messageRecord.setStatDate(today);
        messageRecord.setInstanceId(instanceId);
        messageRecord.setUserMessages(metrics.getUserMessages());
        messageRecord.setAssistantMsgs(metrics.getAssistantMessages());
        messageRecord.setToolCalls(metrics.getToolCalls());
        messageRepo.save(messageRecord);
        
        // 保存工具使用统计
        for (Map.Entry<String, ToolStats> entry : metrics.getToolStats().entrySet()) {
            MetricsToolUsage toolRecord = new MetricsToolUsage();
            toolRecord.setStatDate(today);
            toolRecord.setInstanceId(instanceId);
            toolRecord.setToolName(entry.getKey());
            toolRecord.setCallCount(entry.getValue().getCallCount());
            toolRecord.setSuccessCount(entry.getValue().getSuccessCount());
            toolRecord.setErrorCount(entry.getValue().getErrorCount());
            toolUsageRepo.save(toolRecord);
        }
    }
    
    /**
     * 归档文件到NAS
     * @param sourceFile 源文件路径
     * @param metadata 元数据
     * @return 归档位置
     */
    private String archiveFile(Path sourceFile, SessionLogMetadata metadata) {
        try {
            String archiveFileName = String.format("%s_%s_%s.jsonl.gz",
                metadata.getInstanceId(),
                metadata.getFileName(),
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
            );
            
            Path archivePath = Paths.get(this.archivePath, archiveFileName);
            
            // 压缩并复制
            try (InputStream in = Files.newInputStream(sourceFile);
                 GZIPOutputStream out = new GZIPOutputStream(
                     Files.newOutputStream(archivePath))) {
                in.transferTo(out);
            }
            
            // 返回归档位置
            return archivePath.toString();
            
        } catch (IOException e) {
            throw new RuntimeException("Failed to archive file", e);
        }
    }
}
```

**UserService.java**

```java
/**
 * 用户服务集成
 * 负责从外部用户中心API查询用户映射关系
 */
@Service
@Slf4j
public class UserService {
    
    @Value("${user.service.api.url:http://user-center.internal/api}")
    private String userServiceUrl;
    
    @Autowired
    private RestTemplate restTemplate;
    
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    /**
     * 根据实例ID查询用户ID(带缓存)
     * @param instanceId 实例ID
     * @return 用户ID,如果查询失败返回null
     */
    public String getUserIdByInstanceId(String instanceId) {
        // 1. 先查Redis缓存
        String cacheKey = "user:instance:" + instanceId;
        String cachedUserId = redisTemplate.opsForValue().get(cacheKey);
        if (cachedUserId != null) {
            return cachedUserId;
        }
        
        // 2. 调用外部API
        try {
            String url = userServiceUrl + "/instances/" + instanceId + "/user";
            UserMappingResponse response = restTemplate.getForObject(
                url, UserMappingResponse.class
            );
            
            if (response != null && response.getUserId() != null) {
                // 3. 写入缓存(TTL 1小时)
                redisTemplate.opsForValue().set(cacheKey, response.getUserId(), 
                    1, TimeUnit.HOURS);
                
                return response.getUserId();
            }
        } catch (Exception e) {
            log.warn("Failed to fetch user ID for instance: {}", instanceId, e);
        }
        
        return null;
    }
}
```

#### 5.5.5 REST API端点

```
POST /api/metrics/batch
  Body: [MetricsPayload] (支持Gzip压缩)
  Desc: 接收Collector批量推送的指标

GET /api/overview
  Desc: 总览数据(领导视图)

GET /api/metrics/tokens?instanceId=&startDate=&endDate=
  Desc: Token消耗趋势

GET /api/status/health?instanceId=
  Desc: 实时健康状态(从Redis读取)

GET /api/user/{userId}/stats
  Desc: 用户个人统计

GET /api/collectors
  Desc: Collector管理列表(运维视图)
```

---

### 5.6 Data Fusion Engine (SpringBoot)

#### 5.6.1 功能职责

- 融合多数据源指标(Session Logs + Gateway API + Quota API)
- 生成智能洞察(Token消耗异常Skill、离线但有活动的实例、配额预警等)
- 评估告警规则并触发告警事件
- 提供统一的数据查询接口供前端使用

#### 5.6.2 核心Service实现

**MetricFusionEngine.java**

```java
/**
 * 数据融合引擎
 * 负责合并来自不同数据源的指标,生成智能洞察
 */
@Service
@Slf4j
public class MetricFusionEngine {
    
    @Autowired
    private SessionLogMetricsRepository sessionRepo;
    
    @Autowired
    private HealthMetricsRepository healthRepo;
    
    @Autowired
    private QuotaMetricsRepository quotaRepo;
    
    @Autowired
    private AlertRuleRepository alertRuleRepo;
    
    @Autowired
    private AlertEventRepository alertEventRepo;
    
    /**
     * 融合多数据源指标
     * @param instanceId 实例ID
     * @param timeRange 时间范围
     * @return 融合后的完整指标
     */
    public FusedMetrics fuseMetrics(String instanceId, TimeRange timeRange) {
        // 1. 从Session Logs获取会话和Token数据
        LogMetrics logMetrics = sessionRepo.getAggregatedMetrics(instanceId, timeRange);
        
        // 2. 从Health API获取实时健康状态
        HealthMetrics healthMetrics = healthRepo.getLatestHealth(instanceId);
        
        // 3. 从Quota API获取LLM配额状态
        QuotaMetrics quotaMetrics = quotaRepo.getLatestQuota(instanceId);
        
        // 4. 融合数据
        FusedMetrics fused = new FusedMetrics();
        fused.setInstanceId(instanceId);
        fused.setTimeRange(timeRange);
        
        // 来自Session Logs的数据
        fused.setSessions(logMetrics.getSessions());
        fused.setSkillPerformance(logMetrics.getSkillStats());
        fused.setTokenAnalysis(logMetrics.getTotals());
        
        // 来自Gateway API的数据
        fused.setSystemHealth(healthMetrics);
        fused.setChannelStatus(healthMetrics.getChannels());
        
        // 来自Quota API的数据
        fused.setLlmQuota(quotaMetrics.getProviders());
        
        // 5. 生成智能洞察
        List<Insight> insights = generateInsights(logMetrics, healthMetrics, quotaMetrics);
        fused.setInsights(insights);
        
        // 6. 评估告警规则
        evaluateAlertRules(instanceId, fused, insights);
        
        return fused;
    }
    
    /**
     * 生成智能洞察
     * @param logs Session Logs指标
     * @param health 健康状态指标
     * @param quota 配额指标
     * @return 洞察列表
     */
    private List<Insight> generateInsights(LogMetrics logs, HealthMetrics health, QuotaMetrics quota) {
        List<Insight> insights = new ArrayList<>();
        
        // 检测Token消耗异常且成功率低的Skill
        for (Map.Entry<String, SkillStats> entry : logs.getSkillStats().entrySet()) {
            String skillName = entry.getKey();
            SkillStats stats = entry.getValue();
            
            if (stats.getAvgTokens() > 1000 && stats.getSuccessRate() < 0.8) {
                insights.add(new Insight(
                    InsightType.WARNING,
                    Severity.MEDIUM,
                    String.format("%s Token消耗高但成功率低", skillName),
                    "检查配置或考虑替换",
                    LocalDateTime.now()
                ));
            }
        }
        
        // 检测离线但有活动的实例
        if (!health.isOnline() && logs.getSessions().size() > 0) {
            insights.add(new Insight(
                InsightType.ERROR,
                Severity.HIGH,
                "实例离线但最近有会话活动",
                "检查网络连接",
                LocalDateTime.now()
            ));
        }
        
        // 检测LLM配额即将耗尽
        for (Map.Entry<String, ProviderQuota> entry : quota.getProviders().entrySet()) {
            String provider = entry.getKey();
            ProviderQuota q = entry.getValue();
            
            if (q.getUsedPercent() > 90) {
                insights.add(new Insight(
                    InsightType.WARNING,
                    Severity.CRITICAL,
                    String.format("%s 配额使用率 %.1f%%", provider, q.getUsedPercent()),
                    "考虑升级套餐或切换模型",
                    LocalDateTime.now()
                ));
            } else if (q.getUsedPercent() > 70) {
                insights.add(new Insight(
                    InsightType.WARNING,
                    Severity.MEDIUM,
                    String.format("%s 配额使用率 %.1f%%", provider, q.getUsedPercent()),
                    "关注配额使用情况",
                    LocalDateTime.now()
                ));
            }
        }
        
        return insights;
    }
    
    /**
     * 评估告警规则
     * @param instanceId 实例ID
     * @param metrics 融合后的指标
     * @param insights 智能洞察
     */
    @Transactional
    private void evaluateAlertRules(String instanceId, FusedMetrics metrics, List<Insight> insights) {
        List<AlertRule> rules = alertRuleRepo.findByEnabledTrue();
        
        for (AlertRule rule : rules) {
            boolean triggered = evaluateRule(rule, instanceId, metrics, insights);
            
            if (triggered) {
                // 检查是否需要抑制(防重复告警)
                if (!shouldSuppressAlert(instanceId, rule.getRuleName())) {
                    // 创建告警事件
                    AlertEvent event = new AlertEvent();
                    event.setAlertTime(LocalDateTime.now());
                    event.setRuleName(rule.getRuleName());
                    event.setSeverity(rule.getSeverity());
                    event.setInstanceId(instanceId);
                    event.setMetricName(rule.getMetricName());
                    event.setMetricValue(getMetricValue(rule, metrics));
                    event.setThreshold(rule.getThreshold());
                    event.setMessage(generateAlertMessage(rule, metrics));
                    event.setStatus("active");
                    
                    alertEventRepo.save(event);
                    
                    // 记录抑制窗口期(30分钟内相同实例+规则不重复告警)
                    recordSuppressionWindow(instanceId, rule.getRuleName());
                    
                    log.info("Alert triggered: {} for instance {}", rule.getRuleName(), instanceId);
                }
            }
        }
    }
    
    /**
     * 检查是否应该抑制告警(防重复)
     * @param instanceId 实例ID
     * @param ruleName 规则名称
     * @return true=应该抑制, false=不应该抑制
     */
    private boolean shouldSuppressAlert(String instanceId, String ruleName) {
        String suppressionKey = String.format("alert_suppression:%s:%s", instanceId, ruleName);
        String lastAlertTime = redisTemplate.opsForValue().get(suppressionKey);
        
        if (lastAlertTime == null) {
            return false; // 没有历史记录,不应抑制
        }
        
        // 检查是否在抑制窗口期内(30分钟)
        LocalDateTime lastAlert = LocalDateTime.parse(lastAlertTime);
        Duration elapsed = Duration.between(lastAlert, LocalDateTime.now());
        
        return elapsed.toMinutes() < 30; // 30分钟内抑制
    }
    
    /**
     * 记录抑制窗口期
     * @param instanceId 实例ID
     * @param ruleName 规则名称
     */
    private void recordSuppressionWindow(String instanceId, String ruleName) {
        String suppressionKey = String.format("alert_suppression:%s:%s", instanceId, ruleName);
        redisTemplate.opsForValue().set(
            suppressionKey,
            LocalDateTime.now().toString(),
            30, // TTL 30分钟
            TimeUnit.MINUTES
        );
    }
}
```

#### 5.6.3 数据结构定义

**FusedMetrics.java**

```java
/**
 * 融合后的完整指标
 */
@Data
public class FusedMetrics {
    private String instanceId;           // 实例ID
    private TimeRange timeRange;         // 时间范围
    
    // 来自Session Logs
    private List<SessionSummary> sessions;           // 会话摘要
    private Map<String, SkillStats> skillPerformance; // Skill性能统计
    private TokenAnalysis tokenAnalysis;               // Token分析
    
    // 来自Gateway API
    private HealthMetrics systemHealth;              // 系统健康状态
    private List<ChannelStatus> channelStatus;       // 渠道状态
    
    // 来自Quota API
    private Map<String, ProviderQuota> llmQuota;     // LLM配额状态
    
    // 智能洞察
    private List<Insight> insights;                  // 洞察列表
}

/**
 * 智能洞察
 */
@Data
@AllArgsConstructor
public class Insight {
    private InsightType type;          // 类型: info/warning/error
    private Severity severity;         // 严重级别: low/medium/high/critical
    private String message;            // 消息描述
    private String recommendation;     // 建议操作
    private LocalDateTime timestamp;   // 生成时间
}

public enum InsightType {
    INFO, WARNING, ERROR
}

public enum Severity {
    LOW, MEDIUM, HIGH, CRITICAL
}

/**
 * Skill性能统计
 */
@Data
public class SkillStats {
    private String skillName;          // Skill名称
    private int callCount;             // 调用次数
    private double successRate;        // 成功率 (0-1)
    private double avgTokens;          // 平均Token数
    private double avgDurationMs;      // 平均耗时 (ms)
    private int errorCount;            // 错误次数
}
```

---

## 八、智能洞察与告警系统

### 8.1 告警规则配置

| 规则名称 | 触发条件 | 严重级别 | 通知渠道 |
|---------|---------|---------|----------|
| 实例健康告警 | health.ok = false | Critical | 云助理 + Email |
| 实例高负载 | 会话数 > 阈值(可配置) | Warning | 云助理 |
| 渠道断连告警 | channel.linked = false | Critical | 云助理 + Email |
| 渠道延迟告警 | probe.elapsedMs > 5000ms | Warning | 云助理 |
| LLM配额告警 | usedPercent > 70% | Warning | Email |
| LLM配额临界 | usedPercent > 90% | Critical | 云助理 + Email |
| 响应延迟告警 | avgMs > 5000ms | Warning | 云助理 |
| 错误率告警 | errors/total > 5% | Warning | 云助理 |

### 8.2 告警生命周期管理

```
触发条件满足 → 创建告警事件(status=active)
    ↓
发送通知 (云助理/Email - Phase 3,低优先级)
    ↓
界面展示告警
    ↓
条件恢复正常 → 更新status=resolved
    ↓
记录resolved_at时间
```

**数据库表结构:**

```sql
-- 告警规则表
CREATE TABLE alert_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
    description TEXT COMMENT '规则描述',
    metric_name VARCHAR(100) NOT NULL COMMENT '监控指标名称',
    operator VARCHAR(10) NOT NULL COMMENT '比较操作符: >/</>=/<=/==',
    threshold DECIMAL(10,2) NOT NULL COMMENT '阈值',
    severity VARCHAR(20) NOT NULL COMMENT '严重级别: info/warning/critical',
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    notification_channels JSON COMMENT '通知渠道配置: ["yunzhuli", "email"]',
    suppression_window_minutes INT DEFAULT 30 COMMENT '抑制窗口期(分钟)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_enabled (enabled) COMMENT '按启用状态查询索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警规则配置表';

-- 插入默认告警规则
INSERT INTO alert_rules (rule_name, description, metric_name, operator, threshold, severity, notification_channels) VALUES
('instance_health_down', '实例健康状态异常', 'health_ok', '=', 0, 'critical', '["yunzhuli", "email"]'),
('channel_disconnected', '渠道连接断开', 'channel_linked', '=', 0, 'critical', '["yunzhuli", "email"]'),
('llm_quota_high', 'LLM配额使用率高', 'quota_used_percent', '>', 70, 'warning', '["email"]'),
('llm_quota_critical', 'LLM配额即将耗尽', 'quota_used_percent', '>', 90, 'critical', '["yunzhuli", "email"]'),
('high_error_rate', '错误率过高', 'error_rate', '>', 5, 'warning', '["yunzhuli"]');
```

### 8.3 告警抑制与去重引擎

**AlertSuppressionEngine.java**

```java
/**
 * 告警抑制引擎
 * 防止相同实例+规则的告警在短时间内重复发送
 */
@Component
@Slf4j
public class AlertSuppressionEngine {
    
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    /**
     * 检查是否应该抑制告警
     * @param instanceId 实例ID
     * @param ruleName 规则名称
     * @param windowMinutes 抑制窗口期(分钟)
     * @return true=应该抑制, false=不应该抑制
     */
    public boolean shouldSuppress(String instanceId, String ruleName, int windowMinutes) {
        String suppressionKey = String.format("alert_suppression:%s:%s", instanceId, ruleName);
        String lastAlertTime = redisTemplate.opsForValue().get(suppressionKey);
        
        if (lastAlertTime == null) {
            // 没有历史记录,不应抑制
            recordSuppression(instanceId, ruleName, windowMinutes);
            return false;
        }
        
        // 检查是否在抑制窗口期内
        LocalDateTime lastAlert = LocalDateTime.parse(lastAlertTime);
        Duration elapsed = Duration.between(lastAlert, LocalDateTime.now());
        
        if (elapsed.toMinutes() < windowMinutes) {
            log.debug("Alert suppressed for {}:{} ({} min ago)", 
                instanceId, ruleName, elapsed.toMinutes());
            return true; // 抑制
        }
        
        // 超过窗口期,重新记录
        recordSuppression(instanceId, ruleName, windowMinutes);
        return false;
    }
    
    /**
     * 记录抑制窗口期
     * @param instanceId 实例ID
     * @param ruleName 规则名称
     * @param windowMinutes 窗口期(分钟)
     */
    private void recordSuppression(String instanceId, String ruleName, int windowMinutes) {
        String suppressionKey = String.format("alert_suppression:%s:%s", instanceId, ruleName);
        redisTemplate.opsForValue().set(
            suppressionKey,
            LocalDateTime.now().toString(),
            windowMinutes,
            TimeUnit.MINUTES
        );
    }
}
```

### 8.4 通知渠道集成 (Phase 3,低优先级)

**支持的通知渠道:**

| 渠道 | 优先级 | 集成方式 | 说明 |
|------|--------|---------|------|
| **云助理** | 高 | 内部IM API | 公司内部使用的IM工具,首选通知渠道 |
| **Email** | 中 | SMTP | 配置较复杂,作为备选渠道 |

**云助理集成要点:**

1. **API对接**:
   - 需要获取云助理的消息推送API端点
   - 通常需要企业内部认证Token
   - 支持Markdown格式消息

2. **消息模板示例**:
   ```json
   {
     "to": "user_id_or_group",
     "title": "【监控告警】实例健康状态异常",
     "content": "实例 inst-prod-001 健康检查失败\n时间: 2026-04-14 10:30:00\n严重级别: Critical",
     "type": "alert"
   }
   ```

3. **实施建议**:
   - Phase 3优先实现云助理集成
   - Email作为备选(配置复杂度高)
   - 不支持Slack/Webhook等外部渠道

---

## 九、动态扩展与故障转移

### 9.1 新增Collector流程

```
1. 部署新的Collector容器
   ↓
2. Collector启动,调用 Registry /register
   ↓
3. Registry创建Collector记录,发布CollectorRegisteredEvent
   ↓
4. Rebalance引擎检测到新Collector
   ↓
5. 计算新的分配方案(简单轮询)
   ↓
6. 更新instance_collector_mapping表
   ↓
7. 原有Collector下次refresh时(60秒内)获取新列表
   ↓
8. 新Collector立即开始工作
```

**示例:**
```
初始状态:
  Collector-1: [inst-001, inst-002, ..., inst-050]
  Collector-2: [inst-051, inst-052, ..., inst-100]

新增Collector-3后:
  Collector-1: [inst-001, ..., inst-033]
  Collector-2: [inst-034, ..., inst-066]
  Collector-3: [inst-067, ..., inst-100]
```

### 9.2 Collector故障转移流程

```
1. Registry定时任务检测到Collector心跳超时(>2分钟)
   ↓
2. 标记Collector状态为inactive
   ↓
3. 删除该Collector的所有instance映射
   ↓
4. 触发rebalance,将实例重新分配给其他活跃Collector
   ↓
5. 其他Collector下次refresh时(60秒内)接管这些实例
   ↓
6. 数据采集短暂中断(<5分钟),之后恢复正常
```

---

## 十、前端UI设计规范

### 10.1 技术栈

| 组件 | 技术选型 | 理由 |
|------|---------|------|
| **框架** | Vue 3.4+ + TypeScript | Composition API,性能优秀,学习曲线平缓 |
| **构建工具** | Vite 5.x | 快速开发体验,热更新快,与Vue完美集成 |
| **UI组件库** | Element Plus 2.x | 企业级组件丰富,中文文档完善,国内广泛使用 |
| **图表库** | ECharts 5.x + vue-echarts | 大数据量性能好,官方Vue wrapper支持 |
| **状态管理** | Pinia 2.x | Vue官方推荐,API简洁,TypeScript友好 |
| **数据请求** | Vue Query (TanStack Query Vue版) | 自动缓存、轮询、错误重试,与React Query相同API |
| **路由** | Vue Router 4.x | Vue官方路由,支持动态路由和懒加载 |
| **样式方案** | SCSS + CSS Modules | Element Plus内置主题定制,企业后台最佳实践 |
| **国际化** | vue-i18n 9.x | Vue官方i18n方案,支持响应式语言切换 |

### 10.2 页面结构

```
监控面板
├── 领导视图 (/executive)
│   ├── 总览仪表板
│   │   ├── 实例健康状态 (饼图)
│   │   ├── Token消耗趋势 (折线图)
│   │   ├── 使用量趋势 (柱状图)
│   │   └── 部门对比 (表格)
│   └── Token分析
│       ├── Token分布 (饼图)
│       ├── Token趋势 (折线图)
│       └── 使用预测 (预测曲线)
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
│   │   ├── Token消耗 (卡片)
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

### 10.3 关键页面详细设计

#### 10.3.1 领导视图 - 总览仪表板

**顶部统计卡片 (4个):**

1. **实例总数 / 在线实例数**
   - 显示: `987 / 1000` (绿色进度条)
   - 环比变化: `↑ 2.3%`
   
2. **今日Token / 本月Token**
   - 显示: `1.2M / 35.6M`
   - 环比变化: `↑ 5.7%`
   
3. **今日消息数 / 总会话数**
   - 显示: `12,345 / 98,765`
   - 活跃用户数: `456`
   
4. **错误率 (24h)**
   - 显示: `1.2%` (绿色正常,红色如果>5%)
   - 告警数量: `3个活跃告警`

**核心图表区:**

1. **实例健康状态 (饼图)**
   - 分类: 🟢 健康 (85%) / 🔴 离线 (10%) / 🟡 异常 (5%)
   - 点击扇区可下钻查看具体实例列表
   
2. **Token消耗趋势 (折线图)**
   - X轴: 最近7天日期
   - Y轴: 每日Token数 (百万)
   - 多条线: 按部门/Provider分组
   - 支持缩放和筛选
   
3. **部门使用对比 (表格)**
   - 列: 部门名称 / 实例数 / 今日Token / 本月Token / Token消耗 / 活跃度
   - 支持排序和导出Excel
   
4. **模型使用分布 (堆叠柱状图)**
   - X轴: 日期
   - Y轴: Token数量
   - 颜色区分: GPT-4 / Claude / 其他模型
   
5. **热门工具Top 10 (横向条形图)**
   - 显示: 工具名称 / 调用次数 / 成功率
   - 点击可查看该工具的详细统计

#### 10.3.2 运维视图 - 实时监控

**工具栏:**
- 搜索框: 按实例ID/名称/IP搜索
- 状态过滤器: 全部 / 🟢在线 / 🔴离线 / 🟡异常
- 刷新按钮: 手动刷新(默认每60秒自动刷新)
- 健康统计摘要: 在线率 98.7% / 平均延迟 245ms / 错误率 1.2%

**实例列表 (Element Plus el-table):**

| 列名 | 说明 | 示例 |
|------|------|------|
| 实例ID | 唯一标识 | `inst-prod-001` |
| 名称 | 友好名称 | `生产环境-客服机器人` |
| 状态 | 🟢在线/🔴离线/🟡异常 | 🟢 在线 |
| 最后轮询时间 | 相对时间 | `2分钟前` |
| 活跃会话数 | 当前活跃会话 | `15` |
| 今日消息数 | 累计消息 | `1,234` |
| 平均延迟 | P50延迟(ms) | `245ms` |
| P95延迟 | P95延迟(ms) | `890ms` |
| 错误率 | 24h错误率 | `1.2%` |
| LLM配额 | 使用百分比 | `65%` (进度条) |
| 操作 | 按钮组 | [查看详情] [重启] [配置] |

**交互功能:**
- 点击行展开详情: 显示渠道连接状态、Agent列表、最近告警
- 右键菜单: 快速操作(重启、查看日志、进入维护模式)
- 批量操作: 勾选多个实例后批量重启/导出

**实时更新机制:**
- 默认每60秒自动刷新数据
- WebSocket推送实时告警(Phase 3)
- 数据变更时高亮显示(绿色闪烁)

#### 10.3.3 用户视图 - 个人统计

**个人统计卡片 (4个):**

1. **本月消息数**
   - 显示: `456条`
   - 环比: `↑ 12% vs 上月`
   
2. **本月Token消耗**
   - 显示: `1.2M tokens`
   - 环比: `↑ 8% vs 上月`
   
3. **本月Token使用**
   - 显示: `123,456 tokens`
   - 占比: `输入 40% / 输出 60%`
   
4. **平均响应时间**
   - 显示: `1.2s`
   - 趋势: `↓ 0.3s vs 上周` (优化了)

**使用趋势 (折线图):**
- X轴: 最近30天日期
- Y轴: 左侧=消息数,右侧=Token数
- 双Y轴图表,同时展示消息量和Token消耗趋势
- 支持切换时间范围(7天/30天/90天)

**常用工具排行 (列表):**

| 排名 | 工具名称 | 使用次数 | 成功率 | 平均耗时 |
|------|---------|---------|--------|----------|
| 1 | code-assistant | 120次 | 95% | 2.3s |
| 2 | web-search | 85次 | 98% | 1.5s |
| 3 | image-generator | 45次 | 92% | 5.6s |

**最近对话 (时间线组件):**
- 显示最近20条对话
- 每条显示: 时间 / 问题摘要 / 使用的工具 / 耗时
- 点击可展开完整对话内容
- 支持搜索和过滤

### 10.4 响应式设计

**断点设置:**
- Desktop: ≥1200px (完整布局,多列显示)
- Tablet: 768px-1199px (简化布局,部分图表隐藏)
- Mobile: <768px (单列布局,核心指标优先)

**移动端优化:**
- 顶部统计卡片改为垂直堆叠
- 图表简化为关键数据点
- 表格改为卡片式列表
- 底部导航栏替代侧边栏

### 10.5 主题与国际化

**主题支持:**
- 浅色主题 (默认)
- 深色主题 (Dark Mode)
- 跟随系统主题自动切换

**国际化 (i18n):**
- 支持中文 / English
- 使用 `vue-i18n 9.x` 实现
- 所有文案提取到 `locales/zh-CN.ts` 和 `locales/en-US.ts`
- 支持响应式语言切换,无需刷新页面

---

## 十一、性能优化

### 11.1 Edge Collector优化

**Concurrency Control:**
```go
// Batch parallel processing, 10 instances per batch
chunks := chunk(instances, maxConcurrentInstances)
for _, batch := range chunks {
    var wg sync.WaitGroup
    for _, inst := range batch {
        wg.Add(1)
        go func(instance OpenClawInstance) {
            defer wg.Done()
            // Collection logic
        }(inst)
    }
    wg.Wait()
    time.Sleep(1 * time.Second) // Inter-batch interval
}
```

**Gzip Compression:**
```go
// Compress data (reduces traffic by 80%)
compressed, _ := gzipCompress(toJSON(payloads))
req.Header.Set("Content-Encoding", "gzip")
```

**Short-lived WebSocket:**
```go
// Create new connection for each request, close after use
conn, _ := websocket.Dial(ctx, url, nil)
defer conn.Close()
// Send request and receive response
```

### 11.2 数据库查询优化

**索引优化:**
```sql
-- 高频查询字段建立索引
CREATE INDEX idx_instance_user ON session_log_metadata(instance_id, user_id);
CREATE INDEX idx_stat_date ON metrics_token_daily(stat_date);
-- 注意: metrics_instance_health/channel_status/quota_status 表已在 v6.0 中删除
-- 实时状态改用 Redis 存储，无需相关索引
```

**批量插入:**
```java
// 使用JPA批量保存
@Transactional
public void saveBatch(List<MetricsTokenDaily> records) {
    tokenRepo.saveAll(records); // Spring Data JPA自动优化为批量INSERT
}
```

**Redis缓存:**
```java
// 缓存热门查询(5分钟TTL)
String cacheKey = "metrics:tokens:" + instanceId + ":" + date;
String cached = redisTemplate.opsForValue().get(cacheKey);
if (cached != null) {
    return JSON.parseObject(cached, List.class);
}

List<TokenMetrics> data = queryDatabase(instanceId, date);
redisTemplate.opsForValue().set(cacheKey, JSON.toJSONString(data), 5, TimeUnit.MINUTES);
return data;
```

### 11.3 数据聚合策略 (OceanBase替代方案)

由于OceanBase不支持TimescaleDB的连续聚合(Continuous Aggregates)特性,我们采用以下替代方案:

**方案A: MySQL事件调度器 (推荐)**

```sql
-- 启用事件调度器
SET GLOBAL event_scheduler = ON;

-- 创建每小时聚合任务 - Skill使用统计
CREATE EVENT evt_skill_hourly_aggregation
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    INSERT INTO metrics_skill_hourly_stats (
        bucket_time,
        instance_id,
        skill_name,
        total_calls,
        avg_duration_ms,
        p95_duration_ms,
        success_rate,
        error_count
    )
    SELECT
        DATE_FORMAT(NOW() - INTERVAL 1 HOUR, '%Y-%m-%d %H:00:00') AS bucket_time,
        instance_id,
        tool_name AS skill_name,
        SUM(call_count) AS total_calls,
        AVG(avg_ms) AS avg_duration_ms,
        -- P95计算: 使用窗口函数 APPROX_PERCENTILE 或百分位计算
        -- MySQL 8.0+ 可使用 PERCENT_RANK() 窗口函数
        CASE 
            WHEN COUNT(*) >= 20 THEN
                -- 对于大数据量使用近似计算
                SUBSTRING_INDEX(
                    SUBSTRING_INDEX(
                        GROUP_CONCAT(avg_ms ORDER BY avg_ms SEPARATOR ','),
                        ',',
                        CEIL(COUNT(*) * 0.95)
                    ),
                    ',',
                    -1
                )
            ELSE MAX(avg_ms) -- 数据量小时直接取最大值
        END AS p95_duration_ms,
        SUM(success_count) * 100.0 / NULLIF(SUM(call_count), 0) AS success_rate,
        SUM(error_count) AS error_count
    FROM metrics_tool_usage t1
    WHERE time >= NOW() - INTERVAL 1 HOUR
    AND time < NOW()
    GROUP BY instance_id, tool_name
    ON DUPLICATE KEY UPDATE
        total_calls = VALUES(total_calls),
        avg_duration_ms = VALUES(avg_duration_ms),
        p95_duration_ms = VALUES(p95_duration_ms),
        success_rate = VALUES(success_rate),
        error_count = VALUES(error_count);
END;

-- 备选方案: 使用 PERCENT_RANK() 窗口函数 (MySQL 8.0+)
-- 如果数据库支持，推荐使用此方案
/*
-- ⚠️ 注意: 使用 GROUP_CONCAT 计算 P95 时，需要确保 group_concat_max_len 足够大
-- 建议在会话级别设置: SET SESSION group_concat_max_len = 102400; (100KB)
-- 或在 MySQL 配置文件中设置: group_concat_max_len = 102400
INSERT INTO metrics_skill_hourly_stats (
    bucket_time, instance_id, skill_name, total_calls,
    avg_duration_ms, p95_duration_ms, success_rate, error_count
)
SELECT
    bucket_time,
    instance_id,
    skill_name,
    COUNT(*) AS total_calls,
    AVG(avg_ms) AS avg_duration_ms,
    MAX(CASE WHEN pct_rank <= 0.95 THEN avg_ms END) AS p95_duration_ms,
    AVG(success_rate) AS success_rate,
    SUM(error_count) AS error_count
FROM (
    SELECT
        DATE_FORMAT(time, '%Y-%m-%d %H:00:00') AS bucket_time,
        instance_id,
        tool_name AS skill_name,
        avg_ms,
        success_count,
        error_count,
        success_count * 100.0 / NULLIF(call_count, 0) AS success_rate,
        PERCENT_RANK() OVER (PARTITION BY instance_id, tool_name ORDER BY avg_ms) AS pct_rank
    FROM metrics_tool_usage
    WHERE time >= NOW() - INTERVAL 1 HOUR AND time < NOW()
) ranked
GROUP BY bucket_time, instance_id, skill_name
ON DUPLICATE KEY UPDATE
    total_calls = VALUES(total_calls),
    avg_duration_ms = VALUES(avg_duration_ms),
    p95_duration_ms = VALUES(p95_duration_ms);
*/

-- 创建每日清理任务 - 删除90天前的原始数据
CREATE EVENT evt_cleanup_old_data
ON SCHEDULE EVERY 1 DAY
STARTS '2026-04-14 02:00:00'
DO
BEGIN
    -- 保留90天的原始数据
    DELETE FROM metrics_token_daily WHERE stat_date < CURDATE() - INTERVAL 90 DAY;
    DELETE FROM metrics_message_daily WHERE stat_date < CURDATE() - INTERVAL 90 DAY;
    DELETE FROM metrics_latency_daily WHERE stat_date < CURDATE() - INTERVAL 90 DAY;
    DELETE FROM metrics_tool_usage WHERE stat_date < CURDATE() - INTERVAL 90 DAY;
    DELETE FROM metrics_user_activity WHERE stat_date < CURDATE() - INTERVAL 90 DAY;
    
    -- 注: 实时状态数据存储在Redis中，TTL自动过期，无需手动清理
    
    -- 记录清理日志
    INSERT INTO data_cleanup_log (cleanup_date, tables_cleaned, records_deleted)
    VALUES (NOW(), 'metrics_*_daily', ROW_COUNT());
END;
```

**方案B: SpringBoot定时任务 (备选)**

```java
/**
 * 数据聚合定时任务
 * 当MySQL事件调度器不可用时使用此方案
 */
@Component
@Slf4j
public class DataAggregationScheduler {
    
    @Autowired
    private JdbcTemplate jdbcTemplate;
    
    /**
     * 每小时执行一次聚合
     */
    @Scheduled(cron = "0 0 * * * ?") // 每小时整点
    @Transactional
    public void aggregateHourlyStats() {
        log.info("Starting hourly aggregation...");
        
        try {
            // 执行Skill小时级聚合SQL
            String sql = "INSERT INTO metrics_skill_hourly_stats ..."; // 同上
            jdbcTemplate.execute(sql);
            
            log.info("Hourly aggregation completed successfully");
        } catch (Exception e) {
            log.error("Hourly aggregation failed", e);
        }
    }
    
    /**
     * 每天凌晨2点执行数据清理
     */
    @Scheduled(cron = "0 0 2 * * ?") // 每天凌晨2点
    @Transactional
    public void cleanupOldData() {
        log.info("Starting daily data cleanup...");
        
        try {
            // 删除90天前的数据
            int deletedRows = jdbcTemplate.update(
                "DELETE FROM metrics_token_daily WHERE stat_date < ?",
                LocalDate.now().minusDays(90)
            );
            
            log.info("Cleaned up {} old records", deletedRows);
        } catch (Exception e) {
            log.error("Data cleanup failed", e);
        }
    }
}
```

**性能对比:**

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| MySQL事件调度器 | 数据库原生支持,性能好,不占用应用资源 | OceanBase需确认兼容性 | **推荐**: 生产环境首选 |
| SpringBoot定时任务 | 灵活可控,易于调试和监控 | 占用应用资源,需要HA配置 | 备选: 事件调度器不可用时 |

### 11.3.5 数据量估算与容量规划

> **注意**: 本节基于业务需求中的 **1000+ 实例**规模进行估算，确保容量规划满足实际需求。

**业务模型假设:**
- 部署规模: **1000个** OpenClaw实例
- 用户模式: **一对一** (每个实例服务1个用户)
- 总用户数: 1000个用户
- 数据保留期: 90天(日报表)
- 平均每实例每天活跃用户: 10人
- 平均每实例每天消息数: 500条

**各表数据量估算:**

| 表名 | 日增量 | 90天存量 | 年增量 | 风险等级 | 是否需要分区 |
|------|--------|---------|--------|---------|------------|
| `metrics_user_activity` | 10,000条 | 90万条 | 365万条 | ✅ 低 | ❌ 否 |
| `metrics_token_daily` | 60,000条 | 540万条 | 2190万条 | ⚠️ 中 | ❌ 建议按月分区 |
| `metrics_message_daily` | 1,000条 | 9万条 | 36.5万条 | ✅ 低 | ❌ 否 |
| `metrics_latency_daily` | 3,000条 | 27万条 | 109.5万条 | ✅ 低 | ❌ 否 |
| `metrics_tool_usage` | 100,000条 | 900万条 | 3650万条 | ⚠️ 中 | ❌ 建议按月分区 |
| `session_log_metadata` | 10,000条 | 90万条 | 365万条 | ⚠️ 中 | ❌ 建议归档 |
| `alert_events` | ~500条 | 4.5万条 | 18.25万条 | ✅ 低 | ❌ 否 |

**估算说明:**

1. **metrics_user_activity**: 1000实例 × 10活跃用户/天 = 10,000条/天
2. **metrics_token_daily**: 1000实例 × 3 Provider × 2 Model = 60,000条/天
3. **metrics_tool_usage**: 1000实例 × 100工具调用/天 = 100,000条/天
4. **session_log_metadata**: 1000实例 × 10文件/天 = 10,000条/天
5. **alert_events**: 保守估计每天500个告警事件

**关键结论:**

✅ **核心聚合表风险可控**
- 90天内最大表(`metrics_tool_usage`)约900万条
- 所有日报表都有唯一约束，不会重复插入
- **当前规模暂不需要分区**

⚠️ **需要关注的表**
- `metrics_token_daily` / `metrics_tool_usage` 建议按月分区
- `session_log_metadata` 建议添加归档策略（保留1年后标记为`archived`）

📊 **存储容量估算**
- 假设平均每行500字节（JSON字段较多）
- 90天常驻数据: ~700万行 × 500B = **~3.5GB**
- 加上海量Session Log文件归档到NAS
- **OceanBase存储压力可控，建议监控增长趋势**

**分区建议:**
当单表超过 **500万条** 时，建议按月分区：
```sql
-- 示例: Token统计表按月分区
ALTER TABLE metrics_token_daily PARTITION BY RANGE (TO_DAYS(stat_date)) (
    PARTITION p202604 VALUES LESS THAN (TO_DAYS('2026-05-01')),
    PARTITION p202605 VALUES LESS THAN (TO_DAYS('2026-06-01')),
    ...
);
```

### 11.4 数据保留策略

**数据分层存储策略:**

| 数据类型 | 保留期限 | 存储位置 | 清理策略 |
|---------|---------|---------|----------|
| Session Log原始文件 | 永久 | NAS归档 | 手动清理或生命周期规则 |
| Session Log元数据 | 永久 | OceanBase | 不清理,仅归档状态标记 |
| 原始指标数据(日报表) | 90天 | OceanBase | 自动删除90天前数据 |
| 聚合数据(小时/天) | 1年 | OceanBase | 保留1年,之后归档到冷存储 |
| 健康状态快照 | 180天 | OceanBase | 自动删除180天前数据 |
| 告警事件 | 1年 | OceanBase | 保留1年,已解决告警可提前归档 |

**自动化清理实现:**

```java
/**
 * 数据保留策略管理器
 */
@Service
@Slf4j
public class DataRetentionManager {
    
    @Value("${retention.raw-metrics-days:90}")
    private int rawMetricsRetentionDays;
    
    @Value("${retention.snapshot-days:180}")
    private int snapshotRetentionDays;
    
    @Value("${retention.alert-days:365}")
    private int alertRetentionDays;
    
    /**
     * 执行数据保留策略
     */
    @Scheduled(cron = "0 30 2 * * ?") // 每天凌晨2:30执行
    @Transactional
    public void enforceRetentionPolicy() {
        log.info("Enforcing data retention policy...");
        
        // 1. 清理原始指标数据
        cleanupRawMetrics();
        
        // 2. 清理快照数据
        cleanupSnapshots();
        
        // 3. 清理旧告警
        cleanupOldAlerts();
        
        // 4. 记录清理统计
        recordCleanupStats();
        
        log.info("Data retention policy enforcement completed");
    }
    
    private void cleanupRawMetrics() {
        LocalDate cutoffDate = LocalDate.now().minusDays(rawMetricsRetentionDays);
        
        String[] tables = {
            "metrics_token_daily",
            "metrics_cost_daily",
            "metrics_message_daily",
            "metrics_latency_daily",
            "metrics_tool_usage",
            "metrics_user_activity"
        };
        
        for (String table : tables) {
            int deleted = jdbcTemplate.update(
                "DELETE FROM " + table + " WHERE stat_date < ?",
                cutoffDate
            );
            log.info("Cleaned {} records from {}", deleted, table);
        }
    }
    
    /**
     * 注意: 高频快照表 (metrics_instance_health, metrics_channel_status, metrics_quota_status)
     * 已在 v6.0 中删除，实时状态改用 Redis 存储，无需定期清理
     */
    private void cleanupSnapshots() {
        // 实时状态已迁移至 Redis (monitor:instance:{instanceId}, monitor:channel:{instanceId}:{channel})
        // 无需数据库清理逻辑
        log.info("高频快照表已迁移至Redis，数据库清理跳过");
    }
    
    private void cleanupOldAlerts() {
        LocalDateTime cutoffTime = LocalDateTime.now().minusDays(alertRetentionDays);
        
        int deleted = jdbcTemplate.update(
            "DELETE FROM alert_events WHERE alert_time < ? AND status = 'resolved'",
            cutoffTime
        );
        
        log.info("Cleaned {} resolved alerts older than {} days", deleted, alertRetentionDays);
    }
}
```

### 11.5 Redis缓存结构设计

**缓存Key设计规范:**

> **注意**: 为保持一致性，所有 Key 统一使用冒号分隔命名法 (`monitor:xxx:yyy`)，TTL 统一为 300s（与 Edge Collector 30秒轮询周期配合）。

| Key | 类型 | TTL | 说明 |
|-----|------|-----|------|
| `monitor:instance:{instanceId}` | Hash | 300s | 实例实时健康状态 |
| `monitor:channel:{instanceId}:{channel}` | Hash | 300s | 渠道连接状态 |
| `monitor:quota:{instanceId}:{provider}` | Hash | 300s | LLM配额状态 |
| `monitor:summary` | String | 60s | 领导视图汇总缓存(快速响应) |
| `monitor:unhealthy_instances` | Set | 300s | 异常实例ID集合 |
| `monitor:alert_rules:active` | Set | - | 当前活跃的告警规则 |
| `monitor:overview` | String | 300s | 领导视图总览缓存 |
| `monitor:user:{userId}` | Hash | 600s | 用户统计缓存 |
| `monitor:alert:suppression:{instanceId}:{ruleName}` | String | 动态 | 告警抑制窗口期 |

**缓存更新策略:**

```java
/**
 * 缓存管理服务
 */
@Service
@Slf4j
public class CacheManagementService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    /**
     * 更新实例健康状态缓存
     * @param instanceId 实例ID
     * @param healthData 健康数据
     */
    public void updateHealthCache(String instanceId, HealthData healthData) {
        String cacheKey = "monitor:instance:" + instanceId;
        
        Map<String, Object> healthMap = new HashMap<>();
        healthMap.put("ok", healthData.isOk());
        healthMap.put("durationMs", healthData.getDurationMs());
        healthMap.put("channelCount", healthData.getChannelCount());
        healthMap.put("agentCount", healthData.getAgentCount());
        healthMap.put("timestamp", System.currentTimeMillis());
        
        redisTemplate.opsForHash().putAll(cacheKey, healthMap);
        redisTemplate.expire(cacheKey, 300, TimeUnit.SECONDS); // 300s TTL，与Edge Collector轮询周期配合
    }
    
    /**
     * 获取实例健康状态缓存
     * @param instanceId 实例ID
     * @return 健康数据,如果缓存不存在返回null
     */
    public HealthData getHealthCache(String instanceId) {
        String cacheKey = "monitor:instance:" + instanceId;
        Map<Object, Object> entries = redisTemplate.opsForHash().entries(cacheKey);
        
        if (entries.isEmpty()) {
            return null;
        }
        
        HealthData health = new HealthData();
        health.setOk((Boolean) entries.get("ok"));
        health.setDurationMs((Integer) entries.get("durationMs"));
        health.setChannelCount((Integer) entries.get("channelCount"));
        health.setAgentCount((Integer) entries.get("agentCount"));
        
        return health;
    }
    
    /**
     * 批量清理过期缓存
     */
    @Scheduled(fixedRate = 300000) // 每5分钟执行一次
    public void cleanupExpiredCache() {
        // Redis会自动清理过期的key,无需手动清理
        log.debug("Cache cleanup completed (auto-expiry)");
    }
}
```

**缓存命中率监控:**

```java
/**
 * 缓存性能监控
 */
@Component
@Slf4j
public class CacheMetricsMonitor {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    private final AtomicLong cacheHits = new AtomicLong(0);
    private final AtomicLong cacheMisses = new AtomicLong(0);
    
    /**
     * 记录缓存命中
     */
    public void recordHit() {
        cacheHits.incrementAndGet();
    }
    
    /**
     * 记录缓存未命中
     */
    public void recordMiss() {
        cacheMisses.incrementAndGet();
    }
    
    /**
     * 获取缓存命中率
     */
    public double getHitRate() {
        long hits = cacheHits.get();
        long misses = cacheMisses.get();
        long total = hits + misses;
        
        return total > 0 ? (double) hits / total : 0.0;
    }
    
    /**
     * Log cache statistics every minute
     */
    @Scheduled(fixedRate = 60000)
    public void logCacheStats() {
        double hitRate = getHitRate();
        log.info(String.format("Cache stats - Hits: %d, Misses: %d, Hit Rate: %.2f%%",
            cacheHits.get(), cacheMisses.get(), hitRate * 100));
    }
}
```

---

## 十二、安全设计

### 12.1 认证授权

**Phase 1 - JWT Token:**
```java
// Spring Security 6.0 配置 (SpringBoot 3.x)
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/registry/**").hasRole("ADMIN")
                .requestMatchers("/api/metrics/**").authenticated()
                .anyRequest().permitAll()
            )
            .addFilterBefore(jwtAuthenticationFilter(), 
                UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
```

**Phase 3 - SSO集成:**
- SAML/OAuth 2.0
- RBAC权限控制
- API速率限制

### 12.2 数据安全

- HTTPS/TLS 1.3加密传输
- 敏感数据脱敏(userId哈希处理)
- SSH Key管理(ed25519,禁用密码登录)
- NFS挂载安全选项(ro,noexec,nosuid,nodev)

### 12.3 审计日志系统

**功能职责:**
- 记录所有用户操作(登录、API调用、配置变更)
- 记录系统关键事件(Collector注册/下线、Rebalance触发)
- 支持安全审计和故障排查
- 符合企业合规要求

**数据库表结构:**

```sql
-- 审计日志表
CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '事件发生时间',
    user_id VARCHAR(50) COMMENT '操作用户ID(系统动作为NULL)',
    action VARCHAR(100) NOT NULL COMMENT '操作类型: login/api_call/config_change/collector_register/rebalance',
    resource_type VARCHAR(50) COMMENT '资源类型: instance/collector/user/config',
    resource_id VARCHAR(100) COMMENT '资源ID',
    action_detail JSON COMMENT '操作详情(JSON格式)',
    ip_address VARCHAR(50) COMMENT '客户端IP地址',
    user_agent TEXT COMMENT 'User-Agent字符串',
    result ENUM('success', 'failure') NOT NULL COMMENT '操作结果',
    error_message TEXT COMMENT '错误信息(如果失败)',
    execution_time_ms INT COMMENT '执行耗时(毫秒)',
    INDEX idx_event_time (event_time) COMMENT '按时间查询索引',
    INDEX idx_user_id (user_id) COMMENT '按用户查询索引',
    INDEX idx_action (action) COMMENT '按操作类型查询索引',
    INDEX idx_resource (resource_type, resource_id) COMMENT '按资源查询索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表';
```

**审计事件接口定义:**

```java
/**
 * 审计事件
 */
@Data
@AllArgsConstructor
public class AuditEvent {
    private LocalDateTime eventTime;      // 事件时间
    private String userId;                // 操作用户ID
    private String action;                // 操作类型
    private String resourceType;          // 资源类型
    private String resourceId;            // 资源ID
    private Map<String, Object> actionDetail; // 操作详情
    private String ipAddress;             // IP地址
    private String userAgent;             // User-Agent
    private AuditResult result;           // 结果
    private String errorMessage;          // 错误信息
    private Integer executionTimeMs;      // 执行耗时
}

public enum AuditResult {
    SUCCESS, FAILURE
}
```

**审计日志Service实现:**

```java
/**
 * 审计日志服务
 */
@Service
@Slf4j
public class AuditLogService {
    
    @Autowired
    private AuditLogRepository auditLogRepo;
    
    @Autowired
    private HttpServletRequest request;
    
    /**
     * 记录审计日志
     * @param event 审计事件
     */
    @Async("auditLogExecutor") // 异步写入,不影响主业务流程
    public void logAudit(AuditEvent event) {
        try {
            AuditLog log = new AuditLog();
            log.setEventTime(event.getEventTime());
            log.setUserId(event.getUserId());
            log.setAction(event.getAction());
            log.setResourceType(event.getResourceType());
            log.setResourceId(event.getResourceId());
            log.setActionDetail(objectMapper.writeValueAsString(event.getActionDetail()));
            log.setIpAddress(extractIpAddress());
            log.setUserAgent(request.getHeader("User-Agent"));
            log.setResult(event.getResult().name());
            log.setErrorMessage(event.getErrorMessage());
            log.setExecutionTimeMs(event.getExecutionTimeMs());
            
            auditLogRepo.save(log);
            
        } catch (Exception e) {
            log.error("Failed to save audit log", e);
            // 审计日志失败不应影响主业务,仅记录错误
        }
    }
    
    /**
     * 提取客户端IP地址
     */
    private String extractIpAddress() {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
    
    /**
     * 便捷方法: 记录成功操作
     */
    public void logSuccess(String userId, String action, String resourceType, String resourceId) {
        AuditEvent event = new AuditEvent(
            LocalDateTime.now(),
            userId,
            action,
            resourceType,
            resourceId,
            Collections.emptyMap(),
            null,
            null,
            AuditResult.SUCCESS,
            null,
            null
        );
        logAudit(event);
    }
    
    /**
     * 便捷方法: 记录失败操作
     */
    public void logFailure(String userId, String action, String resourceType, String resourceId, String errorMessage) {
        AuditEvent event = new AuditEvent(
            LocalDateTime.now(),
            userId,
            action,
            resourceType,
            resourceId,
            Collections.emptyMap(),
            null,
            null,
            AuditResult.FAILURE,
            errorMessage,
            null
        );
        logAudit(event);
    }
}
```

**使用示例:**

```java
@RestController
@RequestMapping("/api/instances")
public class InstanceController {
    
    @Autowired
    private AuditLogService auditLogService;
    
    @PostMapping("/{instanceId}/restart")
    public ResponseEntity<Void> restartInstance(@PathVariable String instanceId) {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        
        try {
            // 执行业务逻辑
            instanceService.restart(instanceId);
            
            // 记录成功审计日志
            auditLogService.logSuccess(userId, "instance_restart", "instance", instanceId);
            
            return ResponseEntity.ok().build();
            
        } catch (Exception e) {
            // 记录失败审计日志
            auditLogService.logFailure(userId, "instance_restart", "instance", instanceId, e.getMessage());
            
            throw e;
        }
    }
}
```

**审计日志查询API:**

```
GET /api/audit/logs?userId=&action=&startDate=&endDate=&page=1&size=50
  Desc: 查询审计日志(支持多条件筛选和分页)
  Response: {
    "total": 1234,
    "page": 1,
    "size": 50,
    "data": [
      {
        "id": 1,
        "eventTime": "2026-04-13T10:30:00Z",
        "userId": "admin",
        "action": "instance_restart",
        "resourceType": "instance",
        "resourceId": "inst-prod-001",
        "result": "success",
        "ipAddress": "192.168.1.100"
      }
    ]
  }
```

**审计日志保留策略:**

| 日志类型 | 保留期限 | 存储位置 |
|---------|---------|----------|
| 用户操作日志 | 1年 | OceanBase |
| 系统事件日志 | 1年 | OceanBase |
| 安全相关日志 | 3年 | OceanBase + 归档到冷存储 |

---

## 十三、部署架构

### 13.1 组件部署

| 组件 | 部署方式 | 数量 | 资源需求 |
|------|---------|------|---------|
| OpenClaw实例 | PaaS容器 | 1000+ | varies |
| Edge Collector (Go) | PaaS容器 | 10-20 | < 100MB RAM, < 0.25 CPU |
| Registry Service | SpringBoot容器 | 2-3 (HA) | 512MB RAM, 0.5 CPU |
| Center Service | SpringBoot容器 | 2-3 (HA) | 1GB RAM, 1 CPU |
| OceanBase | 有状态容器 | 3节点集群 | 8GB RAM, 4 CPU/节点 |
| Redis | 有状态容器 | 1 (主从可选) | 1GB RAM, 0.5 CPU |
| 监控前端 | 静态资源 | CDN或容器 | - |

### 13.2 数据库迁移

> 使用 **Flyway** 进行数据库版本管理，确保数据库变更可追溯、可回滚。

**迁移文件目录结构:**
```
registry-service/src/main/resources/
├── db/migration/
│   ├── V1__init_schema.sql          # 初始表结构 (collectors, openclaw_instances, mappings)
│   ├── V2__add_registry_indexes.sql # 索引优化
│   └── V3__add_rebalance_history.sql # Rebalance历史记录
center-service/src/main/resources/
├── db/migration/
│   ├── V1__init_metrics_schema.sql  # 指标相关表 (session_log_metadata, metrics_*_daily)
│   ├── V2__add_alert_tables.sql      # 告警表 (alert_rules, alert_events)
│   ├── V3__add_audit_logs.sql        # 审计日志表
│   └── V4__add_hourly_stats.sql      # 小时级聚合表
```

**flyway.conf 示例:**
```properties
# Spring Boot will auto-configure Flyway based on these properties
spring.flyway.url=jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}
spring.flyway.user=${DB_USER}
spring.flyway.password=${DB_PASSWORD}
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=true
spring.flyway.validate-on-migrate=true
```

> **注意**: 每次数据库变更需要新增 migration 文件 (如 `V5__add_xxx.sql`)，由 CI/CD 自动执行。

### 13.3 Docker Compose示例

**Edge Collector:**
```yaml
version: '3.8'

services:
  edge-collector:
    image: openclaw-monitoring/edge-collector:latest
    container_name: edge-collector-us-east-1
    restart: unless-stopped
    
    volumes:
      - ./config:/etc/collector/config:ro
      - collector-logs:/var/log/collector
    
    environment:
      - COLLECTOR_ID=collector-us-east-1
      - REGISTRY_URL=http://registry-lb.internal:8080
      - CENTER_SERVICE_URL=http://center-lb.internal:8080
      - HEALTH_POLL_INTERVAL=30s
      - PUSH_INTERVAL=5m
      - MAX_CONCURRENT_INSTANCES=10
      - LOG_LEVEL=info
    
    resources:
      limits:
        memory: 100M
        cpus: '0.25'
      reservations:
        memory: 50M
        cpus: '0.1'
    
    healthcheck:
      # Note: Port 8080 is the default listener port for Edge Collector
      # Can be configured via COLLECTOR_PORT environment variable
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:${COLLECTOR_PORT:-8080}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    
    networks:
      - monitoring-network
      - openclaw-network

volumes:
  collector-logs:
    driver: local

networks:
  monitoring-network:
    driver: bridge
  openclaw-network:
    external: true
```

---

## 十四、实施计划

### Phase 1 - MVP (6-8周)

**目标:** 搭建核心基础设施,验证数据采集可行性

**任务:**
- [ ] 初始化项目结构(monorepo: edge-collector/, registry-service/, center-service/)
- [ ] Edge Collector (Go)
  - [ ] WebSocket短连接轮询
  - [ ] Session Logs元数据提取
  - [ ] 批量推送(Gzip压缩)
  - [ ] 心跳上报
- [ ] Registry Service (SpringBoot)
  - [ ] Collector注册与心跳
  - [ ] 实例分配算法(简单轮询)
  - [ ] Rebalance引擎(事件+定期)
  - [ ] 故障检测与转移
- [ ] Center Service (SpringBoot)
  - [ ] 指标批处理API
  - [ ] Session Log元数据入库
  - [ ] 外部用户服务集成
  - [ ] 文件归档逻辑
  - [ ] **Data Fusion Engine (数据融合引擎)**
  - [ ] **智能洞察生成逻辑**
  - [ ] **告警规则评估引擎**
- [ ] 数据库
  - [ ] OceanBase表结构创建
  - [ ] 索引优化
  - [ ] **告警规则表和数据保留策略配置**
- [ ] 前端基础框架
  - [ ] **Vue 3 + Element Plus项目初始化**
  - [ ] **领导视图(MVP): 总览仪表板**
  - [ ] **运维视图(MVP): 实例列表、健康状态**
  - [ ] **用户视图(MVP): 个人统计卡片**
- [ ] **审计日志系统**
  - [ ] 审计日志表结构
  - [ ] AuditLogService实现
  - [ ] 关键操作埋点

**交付物:**
- 可运行的Edge Collector (Go binary)
- Registry Service (SpringBoot JAR)
- Center Service (SpringBoot JAR) **含数据融合和告警引擎**
- OceanBase表结构 **含审计日志和告警规则表**
- 基础API端点
- **三种角色视图前端(MVP)**
- **审计日志系统**

---

### Phase 2 - 增强 (3-4周)

**目标:** 完善三种角色视图,优化性能,实现完整UI设计

**任务:**
- [ ] 领导视图完善
  - [ ] Token分析页面
  - [ ] 部门对比表格
  - [ ] 模型使用分布图表
- [ ] 运维视图完善
  - [ ] 实时监控表格(完整字段)
  - [ ] 性能分析页面
  - [ ] 错误监控列表
  - [ ] 日志查询功能
- [ ] 用户视图完善
  - [ ] 使用趋势折线图
  - [ ] 常用工具排行榜
  - [ ] 最近对话时间线
  - [ ] 技能发现页面
- [ ] Collector管理页面
  - [ ] Collector状态列表
  - [ ] 实例分配情况
  - [ ] 健康检查日志
- [ ] 数据聚合优化
  - [ ] MySQL事件调度器配置
  - [ ] 数据保留策略自动化
  - [ ] 历史数据清理任务
- [ ] 性能优化
  - [ ] Redis缓存层
  - [ ] 数据库查询优化
  - [ ] API响应优化
- [ ] 移动端适配
- [ ] 完善错误处理和重试机制
- [ ] 国际化支持(i18n)
- [ ] 深色主题支持

**交付物:**
- **完整的三种角色视图(按UI设计规范)**
- **Collector管理界面**
- 性能优化后的系统
- 移动端响应式界面
- **数据聚合和保留策略自动化**

---

### Phase 3 - 企业级 (可选,低优先级,3-4周)

**目标:** 增强功能和安全性(告警为低优先级)

**任务:**
- [ ] 完整告警系统 (低优先级)
  - [ ] 云助理通知集成 (公司内部IM)
  - [ ] Email通知集成 (可选,配置复杂)
  - [ ] 告警抑制与去重优化
  - [ ] 告警生命周期管理界面
  - [ ] 告警规则配置UI
- [ ] SSO集成 (SAML/OAuth)
- [ ] RBAC权限控制细化
- [ ] 审计日志查询和分析界面
- [ ] 备份恢复自动化
- [ ] 监控系统自监控

**交付物:**
- 完整告警系统(云助理+Email,低优先级)
- 企业级安全特性
- **审计日志分析界面**
- 备份恢复手册

---

## 十五、风险与对策

| 风险 | 影响 | 概率 | 对策 |
|------|------|------|------|
| **Registry单点故障** | 中 | 低 | 2-3实例HA + 负载均衡 |
| **外部用户服务不可用** | 中 | 中 | Redis缓存降级,允许user_id为空 |
| **数据库性能瓶颈** | 中 | 中 | 索引优化、读写分离、分表(按日期) |
| **大量实例并发采集** | 中 | 中 | 并发控制(每Collector最多10)、队列缓冲 |
| **Session Log格式变更** | 高 | 低 | 版本检测、兼容层、异常日志告警 |
| **网络分区** | 高 | 低 | Edge Collector本地缓存,网络恢复后补推 |
| **归档存储空间不足** | 中 | 中 | 监控存储使用率,自动清理90天前归档 |

---

## 十六、成功标准

### 功能性指标
- ✅ 三个角色视图完整可用
- ✅ 支持 1000+ 实例监控
- ✅ Session Log元数据可追溯(可从归档恢复)
- ✅ 用户映射关系正确(从外部API获取)

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

## 十七、附录

### A. OpenClaw Gateway API 方法清单

| 方法 | 说明 | 需要权限 |
|------|------|---------|
| `health` | 完整健康快照 | read |
| `status` | 系统状态摘要 | read |
| `usage.status` | LLM提供商配额状态 | read |
| `channels.status` | 渠道状态 | read |

### B. Session Logs JSONL 字段

每条记录包含:
- `timestamp`: ISO 8601 时间戳
- `message.role`: user/assistant
- `message.provider`: 提供商 (openai/anthropic等)
- `message.model`: 模型名称
- `usage.input`: 输入 Token 数
- `usage.output`: 输出 Token 数
- `durationMs`: 响应延迟 (毫秒)
- `content[].type`: tool_use/tool_result
- `content[].name`: 工具名称

### C. 技术栈清单

**后端:**
- Edge Collector: Go 1.21+
- Registry/Center Service: Java 17 + SpringBoot 3.x
- OceanBase MySQL模式 (兼容MySQL 5.7/8.0)
- Redis 7+
- WebSocket客户端: github.com/gorilla/websocket (Go)
- HTTP客户端: net/http (Go), RestTemplate (Java)

**前端:**
- Vue 3.4+ (Composition API)
- TypeScript 5.x
- Element Plus 2.x
- ECharts 5.x + vue-echarts
- Pinia 2.x
- Vue Query (TanStack Query Vue版)
- Vue Router 4.x
- Vite 5.x
- SCSS + CSS Modules
- vue-i18n 9.x

**基础设施:**
- Docker / Docker Compose
- Nginx (反向代理/负载均衡)

### D. 参考资料

- [OpenClaw 官方文档](https://docs.openclaw.ai/)
- [OpenClaw GitHub 仓库](https://github.com/openclaw/openclaw)
- [OceanBase 文档](https://www.oceanbase.com/docs)
- [Vue 3 官方文档](https://cn.vuejs.org/)

---

## 附录E: 版本变更记录

### v14.0 (2026-04-14)

**主要变更:**
1. **明确Session Log处理职责划分**:
   - 新增第5.3.5节 "Session Log处理详解"
   - 明确Edge Collector是唯一读取和解析JSONL文件内容的组件
   - Center Service只接收已聚合的数据,不直接读取原始文件
   - 添加详细的Go伪代码示例,展示解析流程

2. **新增Session Log备份策略章节(第5.X节)**:
   - 背景与挑战: OpenClaw内置清理机制分析
   - 备份架构设计: Edge Collector → Center Service → 对象存储
   - **OpenClaw Session Log文件生命周期**: 详细说明同一Session ID可能有多个文件的场景
     - 场景A: 会话重置/删除(归档) - `.reset.` / `.deleted.` 文件
     - 场景B: 会话压缩(Checkpoint) - `.checkpoint.{uuid}.` 临时文件
   - 数据库表设计(修正版): session_log_backups + session_log_name_history
     - 移除 `UNIQUE KEY uk_instance_session`
     - 新增 `version` 字段,区分同一Session ID的不同版本
   - Collector扫描逻辑(修正版): 完整的Go代码实现
     - 跳过Checkpoint临时文件
     - 检测归档文件(.reset/.deleted)
     - 版本管理:同一Session ID的新活跃文件创建version+1记录
   - 存储方案对比: NAS vs MinIO vs OSS vs S3 vs 混合方案
   - 配置要求: OpenClaw配置调整 + Collector配置示例
   - 恢复流程: 支持多版本恢复的完整步骤
     - 场景1: 恢复最新版本
     - 场景2: 恢复指定版本
     - 场景3: 查看所有版本历史
     - 场景4: 查看文件重命名历史

3. **更新数据流向图**:
   - 第3.4节: 明确Collector扫描并解析JSONL文件
   - 第5.2节: 详细说明各组件职责边界
   - 添加重要说明: 只有Collector读取文件内容

4. **新增架构决策**:
   - 决策9: Session Log处理职责划分(Collector负责解析)
   - 决策10: Session Log备份策略(基于Session ID + 对象存储)

5. **性能优化建议**:
   - 增量扫描: 只处理新增或修改的文件
   - 流式解析: 使用bufio.Scanner逐行读取
   - 并发控制: 每个Collector最多同时解析10个文件
   - 资源消耗估算: CPU ~5%, 内存 ~50MB

**影响范围:**
- Edge Collector实现需要增加JSONL解析逻辑
- Center Service需要新增session_log_backups表(带version字段)
- 需要配置对象存储(S3/OSS/MinIO)用于备份
- OpenClaw配置需要调整清理周期(建议90天)

**向后兼容性:**
- ✅ 完全兼容v13.0的所有功能
- ✅ 备份功能是可选的,不影响核心监控流程
- ⚠️ 如果启用备份,需要额外的存储空间和配置
- [Element Plus 文档](https://element-plus.org/zh-CN/)
- [ECharts 文档](https://echarts.apache.org/)
- [Pinia 官方文档](https://pinia.vuejs.org/zh/)
- [Vue Router 文档](https://router.vuejs.org/zh/)
- [vue-i18n 文档](https://vue-i18n.intlify.dev/)

### E. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| Edge Collector | Edge Collector | 部署在每个区域的轻量级采集器，负责轮询 OpenClaw 实例并上报数据 |
| Center Service | Center Service | SpringBoot 服务，聚合多区域采集数据，提供 API 和 Web UI |
| Registry Service | Registry Service | SpringBoot 服务，管理 Edge Collector 注册和实例分配 |
| Rebalance | Rebalance | 实例在 Collector 之间的动态重分配机制 |
| Session Log | Session Log | OpenClaw 生成的 JSONL 格式会话日志文件 |
| P95/P99 | Percentile | 延迟分布的百分位数 |
| TTL | Time To Live | 缓存过期时间 |

### F. 变更记录

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| **1.0** | **2026-04-13** | **AI Assistant** | **初始版本 (Go + SpringBoot架构)** |
| **2.0** | **2026-04-13** | **AI Assistant** | **补充遗漏内容: 数据融合引擎、智能洞察与告警系统、前端UI设计规范、数据聚合策略、审计日志系统** |
| **3.0** | **2026-04-13** | **AI Assistant** | **二次补充: 监控指标清单、Redis缓存结构设计、章节编号全面修正** |
| **4.0** | **2026-04-13** | **AI Assistant** | **前端技术栈迁移: React → Vue 3 + Element Plus + Pinia + Vue Query** |
| **5.0** | **2026-04-13** | **AI Assistant** | **章节编号全面修正: 修复第九、十、十一章子章节编号混乱问题** |
| **6.0** | **2026-04-13** | **AI Assistant** | **架构优化: 删除高频快照表(metrics_instance_health/channel_status/quota_status)，实时状态改用Redis存储，新增Redis数据结构设计章节** |
| **7.0** | **2026-04-13** | **AI Assistant** | **数据量估算修正: 基于一对一业务模型重新估算所有表数据量，新增10.3.5节容量规划，确认无需数据库分区** |
| **8.0** | **2026-04-13** | **AI Assistant** | **章节编号全面修正: 删除重复的第六章标题，修正第五、七、八章子章节编号混乱问题** |
| **9.0** | **2026-04-14** | **AI Assistant** | **章节编号全面修正: 修正第八至十三章子章节编号混乱问题；删除cleanupSnapshots()中对已删除表的引用；补充附录E术语表；修正Spring Security配置为6.0风格；补充缺失的rebalance_history和metrics_skill_hourly_stats表定义** |
| **10.0** | **2026-04-14** | **AI Assistant** | **WebSocket连接策略优化: 明确采用短连接轮询而非长连接,调整Health轮询频率从30秒到60秒,补充Gateway缓存利用机制,新增决策8说明短连接设计理由,性能估算Gateway负载增加<1%** |
| **11.0** | **2026-04-14** | **AI Assistant** | **业务需求调整: 移除成本相关统计(内部部署大模型无需USD成本),降低告警功能优先级至Phase 3,调整通知渠道为云助理+Email(去掉Slack/Webhook),删除metrics_cost_daily表及相关代码逻辑** |
| **12.0** | **2026-04-14** | **AI Assistant** | **彻底清理成本相关内容: 删除JSONL示例中的cost字段、SessionSummary结构体中的Cost字段、API接口中的/cost端点、Gateway API清单中的usage.cost方法、Session Log字段说明中的cost.total；保留COST_USAGE_CACHE_TTL_MS常量说明但补充缓存机制对Token等指标仍然有效** |
| **13.0** | **2026-04-14** | **AI Assistant** | **深度清理成本残留: 删除SessionMetrics.TotalCost字段、metrics_skill_hourly_stats表的avg_cost/total_cost列、FusedMetrics.costAnalysis改为tokenAnalysis、SkillStats.avgCost改为avgTokens、智能洞察逻辑从"高成本低效率"改为"Token消耗异常且成功率低"、UI设计中的所有成本相关页面和图表改为Token分析** |

---

**文档结束**
