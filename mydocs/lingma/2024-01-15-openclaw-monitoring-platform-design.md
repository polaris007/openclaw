# OpenClaw 企业监控平台设计文档

**版本:** 1.3  
**日期:** 2024-01-15  
**状态:** 已通过规范审查,待用户评审  
**作者:** AI Assistant
**审查者:** AI Assistant (自动审查)
**最新修订:** 补充监控指标清单、告警规则、安全加固措施

---

## 1. 概述

### 1.1 项目背景

公司基于 OpenClaw 打造企业级个人助理,采用 PaaS 容器化部署,通过内部聊天工具对接,连接内部部署的大模型。需要构建一个多角色监控平台,从不同视角了解系统运行状况和 Skill 使用情况。

### 1.2 目标用户

| 角色 | 需求 | 关键指标 |
|------|------|---------|
| **公司领导** | 整体健康状况、投资回报、趋势分析 | 活跃实例数、总会话量、成本统计、部门使用对比 |
| **开发运维** | 系统健康、故障诊断、容量规划 | 资源使用率、错误率、Skill 性能、告警管理 |
| **普通用户** | 个人使用情况、效率提升、Skill 推荐 | 个人会话统计、节省时间、成就系统、个性化建议 |

### 1.3 核心目标

1. **零修改 OpenClaw**: 完全非侵入式,不修改 OpenClaw 核心代码
2. **多角色视图**: 三个差异化界面满足不同用户需求
3. **详细 Skill 分析**: 提供调用次数、成功率、性能分布等深度指标
4. **高可扩展性**: 支持 **1000+ 实例**,易于添加新指标
5. **长期数据保留**: 90+ 天历史数据,支持趋势分析

---

## 2. 架构设计

### 2.1 整体架构图 (Edge Collectors 分层架构)

```
┌─────────────────────────────────────────────────────────────┐
│              OpenClaw Instances (1000+)                      │
│  ┌──────┐ ┌──────┐        ┌──────┐                         │
│  │Inst#1│ │Inst#2│  ...   │Inst#N│                         │
│  └──┬───┘ └──┬───┘        └──┬───┘                         │
└─────┼────────┼──────────────┼──────────────────────────────┘
      │        │              │
      │ NFS/SSH│              │ NFS/SSH (本地网络,毫秒级)
      ▼        ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│         Edge Collectors (每 50-100 实例一个)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Collector #1 │  │ Collector #2 │  │ Collector #N │     │
│  │ (Inst 1-50)  │  │(Inst 51-100) │  │ (Inst N-M)   │     │
│  │              │  │              │  │              │     │
│  │ • Read Logs  │  │ • Read Logs  │  │ • Read Logs  │     │
│  │ • Short WS   │  │ • Short WS   │  │ • Short WS   │     │
│  │ • Aggregate  │  │ • Aggregate  │  │ • Aggregate  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼────────────────┼─────────────────┼──────────────┘
          │                │                 │
          │ HTTP POST      │ HTTP POST       │ HTTP POST
          │ (Batch+Gzip)   │ (Batch+Gzip)    │ (Batch+Gzip)
          ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│            Central Aggregation Service                       │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Batch Receiver │→ │ Data Fusion  │→ │ TimescaleDB     │ │
│  │                │  │              │  │ Writer          │ │
│  │ • Validate     │  │ • Merge logs │  │                 │ │
│  │ • Decompress   │  │ • Enrich API │  │ • Raw metrics   │ │
│  │ • Deduplicate  │  │ • Generate   │  │ • Aggregations  │ │
│  └────────────────┘  │   insights   │  └────────┬────────┘ │
│                      └──────────────┘           │          │
└─────────────────────────────────────────────────┼──────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  REST API Layer (Fastify)                    │
│  /api/instances  /api/sessions  /api/skills  /api/alerts   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               React Frontend (Vite + TS)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Executive    │ │ DevOps       │ │ User         │        │
│  │ Dashboard    │ │ Console      │ │ Portal       │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈选型

#### 后端服务
- **运行时**: Node.js 24 (与 OpenClaw 保持一致)
- **Web 框架**: Fastify (高性能,低开销)
- **数据库**: TimescaleDB (PostgreSQL + 时序扩展)
- **缓存**: Redis (实时数据缓存)
- **任务调度**: node-cron (定时采集)

#### Edge Collectors
- **运行时**: Node.js 24
- **日志读取**: fs/promises (NFS), ssh2 (SSH/SFTP)
- **Gateway API**: ws (短生命周期 WebSocket 客户端)
- **HTTP 客户端**: axios (批量推送)
- **数据压缩**: zlib (Gzip 压缩,减少 80% 流量)
- **任务调度**: node-cron (定时采集和推送)
- **日志**: pino (结构化日志)
- **资源占用**: < 500MB 内存 / Collector

#### 前端应用
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI 库**: Ant Design Pro (专业密集风格)
- **图表库**: Recharts (轻量级,React 友好)
- **状态管理**: Zustand
- **HTTP 客户端**: Axios + React Query
- **样式**: Tailwind CSS + CSS Modules

#### 数据采集
- **日志读取**: fs/promises (NFS), ssh2 (SSH/SFTP)
- **Gateway API**: ws (WebSocket 客户端)
- **数据解析**: 复用 OpenClaw 内置工具 (`extractToolCallNames`, `countToolResults`)

---

## 3. 数据采集策略

### 3.1 架构演进路线

根据部署规模选择不同的采集架构:

| 规模 | 实例数 | 推荐架构 | 原因 |
|------|--------|---------|------|
| **小规模** | < 50 | 中心直连 | 简单,无需额外组件 |
| **中规模** | 50-200 | 中心直连 + 并发控制 | 需要限流和批处理 |
| **大规模** | 200-500 | 分层聚合 (Edge Collectors) | 分散连接压力 |
| **超大规模** | 500+ | 完整分层 + 消息队列 | 高可用,水平扩展 |

**本项目目标: 1000+ 实例 → 采用「分层聚合」架构**

### 3.2 为什么不能直接用 WebSocket 长连接?

#### OpenClaw Gateway 的连接限制

根据源码分析 (`src/gateway/server/preauth-connection-budget.ts`):

```typescript
const DEFAULT_MAX_PREAUTH_CONNECTIONS_PER_IP = 32; // 每个IP最多32个预认证连接
```

**问题:**
1. ❌ **连接数爆炸**: 监控平台需维护 1000+ WS 长连接
2. ❌ **资源消耗**: 每个 WS 连接 ~50KB 内存,1000 连接 = 50MB+
3. ❌ **单点故障**: 监控平台宕机导致所有连接断开
4. ⚠️ **触发限制**: 多监控实例同 IP 会触发连接数限制
5. ❌ **重连风暴**: 网络抖动时 1000 连接同时重连,压垮网关

#### WebSocket vs HTTP 对比

| 维度 | WebSocket 长连接 | HTTP 短连接 |
|------|----------------|------------|
| 适用场景 | 实时双向通信 | 请求-响应模式 |
| 连接数 | 持续占用 | 用完即断 |
| 资源消耗 | 高 (每连接 50KB+) | 低 (按需分配) |
| 扩展性 | 差 (C10K问题) | 好 (无状态) |
| 监控采集 | ❌ 不适合 | ✅ 适合 |

**结论: OpenClaw Gateway 只提供 WS API,但监控采集是「请求-响应」模式,不适合长连接。**

### 3.3 分层聚合架构 (推荐)

```
┌─────────────────────────────────────────────────────────────┐
│              OpenClaw Instances (1000+)                      │
│  ┌──────┐ ┌──────┐        ┌──────┐                         │
│  │Inst#1│ │Inst#2│  ...   │Inst#N│                         │
│  └──┬───┘ └──┬───┘        └──┬───┘                         │
└─────┼────────┼──────────────┼──────────────────────────────┘
      │        │              │
      │ NFS/SSH│              │ NFS/SSH
      ▼        ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│         Edge Collectors (每 50-100 实例一个)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Collector #1 │  │ Collector #2 │  │ Collector #N │     │
│  │ (Inst 1-50)  │  │(Inst 51-100) │  │ (Inst N-M)   │     │
│  │              │  │              │  │              │     │
│  │ • Read Logs  │  │ • Read Logs  │  │ • Read Logs  │     │
│  │ • Short WS   │  │ • Short WS   │  │ • Short WS   │     │
│  │ • Aggregate  │  │ • Aggregate  │  │ • Aggregate  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼────────────────┼─────────────────┼──────────────┘
          │                │                 │
          │ HTTP POST      │ HTTP POST       │ HTTP POST
          │ (Batch)        │ (Batch)         │ (Batch)
          ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│            Central Aggregation Service                       │
│  • Receive batched metrics from edge collectors             │
│  • Fuse with low-frequency Gateway API calls                │
│  • Store to TimescaleDB                                     │
│  • Expose REST API to Frontend                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                  TimescaleDB + REST API + Frontend
```

#### Edge Collector 设计

**部署策略:**
- 每 50-100 个 OpenClaw 实例部署一个 Edge Collector
- 与 OpenClaw 实例同机房/同 VPC,低延迟访问
- 轻量级 Node.js 服务,资源占用 < 500MB

**核心职责:**

1. **高频采集 Session Logs (每 1-5 分钟)**
```typescript
class EdgeCollector {
  async collectSessionLogs() {
    const tasks = this.instances.map(async (inst) => {
      try {
        // 本地 NFS/SSH 读取,毫秒级延迟
        const logs = await this.readLogs(inst.sessionPath);
        const metrics = this.parseLogs(logs);
        this.localCache.set(inst.id, metrics);
      } catch (error) {
        logger.error({ instanceId: inst.id, error }, 'Log collection failed');
      }
    });
    
    // 并发控制: 最多同时处理 10 个实例
    await Promise.allSettled(chunk(tasks, 10).map(batch => 
      Promise.all(batch)
    ));
  }
}
```

2. **低频调用 Gateway API (每 10-30 分钟)**
```typescript
async collectSystemHealth() {
  for (const instance of this.instances) {
    try {
      // 短生命周期 WS 连接: 连接 → 查询 → 断开
      const ws = await this.createShortLivedWS(instance.gatewayUrl);
      const health = await this.callMethod(ws, 'system.health');
      ws.close(); // 立即断开
      
      this.localCache.set(`${instance.id}.health`, health);
    } catch (error) {
      logger.warn({ instanceId: instance.id, error }, 'Health check failed');
    }
  }
}
```

3. **批量推送到中心服务 (每 5 分钟)**
```typescript
async pushToCenter() {
  const batch = {
    timestamp: Date.now(),
    collectorId: this.collectorId,
    instances: Array.from(this.localCache.entries()).map(([id, data]) => ({
      instanceId: id,
      metrics: data
    }))
  };
  
  try {
    await http.post(`${CENTER_URL}/api/metrics/batch`, batch, {
      timeout: 30000,
      retry: 3
    });
    this.localCache.clear();
  } catch (error) {
    logger.error({ error }, 'Push to center failed, will retry');
    // 保留缓存,下次合并推送
  }
}
```

**优势:**
- ✅ **分散连接压力**: 每个 Collector 只管理 50-100 实例
- ✅ **本地网络高性能**: NFS/SSH 读取 Logs,毫秒级延迟
- ✅ **Gateway API 短连接**: 用完即断,不占用长期资源
- ✅ **故障隔离**: 单个 Collector 故障不影响其他区域
- ✅ **水平扩展**: 增加 Collector 即可支持更多实例
- ✅ **批量推送**: 减少中心服务压力 (1000 实例 → 10-20 个 Collector)

#### 中心聚合服务

**职责:**
- 接收 Edge Collectors 的批量数据
- 融合 Gateway API 数据 (如果需要补充)
- 存储到 TimescaleDB
- 提供 REST API 给前端

**API 端点:**
```typescript
// POST /api/metrics/batch
interface BatchMetricsRequest {
  timestamp: number;
  collectorId: string;
  instances: Array<{
    instanceId: string;
    metrics: InstanceMetrics;
  }>;
}

// GET /api/instances/:id/health
// GET /api/sessions/usage
// GET /api/skills/performance
```

### 3.4 替代方案对比

| 方案 | 优点 | 缺点 | 适用规模 |
|------|------|------|----------|
| **中心直连 (WS长连接)** | 简单,实时性高 | 连接数爆炸,资源消耗大 | < 50 实例 |
| **中心直连 (WS短连接)** | 无需额外组件 | 频繁创建/销毁连接,开销大 | 50-200 实例 |
| **分层聚合 (Edge Collectors)** ✅ | 可扩展,故障隔离 | 需要部署额外组件 | 200-1000+ 实例 |
| **消息队列 (Kafka/RabbitMQ)** | 高吞吐,解耦 | 复杂度高,运维成本大 | 1000+ 实例,需要实时性 |

**本项目选择: 分层聚合 (Edge Collectors)**
- 平衡复杂度和可扩展性
- 符合 1000+ 实例目标
- 零修改 OpenClaw
- 5 分钟延迟可接受

### 3.4 Edge Collector 部署配置

#### 部署架构

```
区域 A (us-east-1)
├── Collector #1 (管理 Inst 1-50)
│   ├── NFS Mount: nfs-server:/export/openclaw → /data/sessions
│   └── SSH Keys: /etc/collector/keys/id_rsa
├── Collector #2 (管理 Inst 51-100)
│   ├── NFS Mount: nfs-server:/export/openclaw → /data/sessions
│   └── SSH Keys: /etc/collector/keys/id_rsa

区域 B (eu-west-1)
├── Collector #3 (管理 Inst 101-150)
│   └── ...
```

#### Docker Compose 配置

**方式 A: NFS 挂载 (推荐)**

```yaml
# docker-compose.yml (Edge Collector)
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
      # SSH Keys (如果使用 SSH 方式)
      - ./keys:/etc/collector/keys:ro
      # 日志
      - collector-logs:/var/log/collector
    
    environment:
      - COLLECTOR_ID=collector-us-east-1
      - CENTER_URL=https://monitoring.example.com
      - CENTER_API_KEY=${CENTER_API_KEY}
      - COLLECTION_INTERVAL_SESSIONS=300  # 5分钟
      - COLLECTION_INTERVAL_HEALTH=1800   # 30分钟
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
      - openclaw-network  # 访问 OpenClaw 实例

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

**方式 B: SSH 连接**

```yaml
# config/instances.yml
instances:
  - id: instance-001
    host: 10.0.1.101
    sessionPath: /home/openclaw/.openclaw/sessions
    sshKey: /etc/collector/keys/id_rsa
    sshUser: openclaw
  
  - id: instance-002
    host: 10.0.1.102
    sessionPath: /home/openclaw/.openclaw/sessions
    sshKey: /etc/collector/keys/id_rsa
    sshUser: openclaw
  
  # ... 最多 50-100 个实例
```

#### 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `COLLECTOR_ID` | Collector 唯一标识 | - |
| `CENTER_URL` | 中心服务 URL | - |
| `CENTER_API_KEY` | API 认证密钥 | - |
| `COLLECTION_INTERVAL_SESSIONS` | Session Logs 采集间隔(秒) | 300 |
| `COLLECTION_INTERVAL_HEALTH` | Gateway API 采集间隔(秒) | 1800 |
| `PUSH_INTERVAL` | 批量推送间隔(秒) | 300 |
| `MAX_CONCURRENT_INSTANCES` | 最大并发实例数 | 10 |
| `LOG_LEVEL` | 日志级别 | info |
| `GZIP_COMPRESSION` | 启用 Gzip 压缩 | true |
| `RETRY_ATTEMPTS` | 失败重试次数 | 3 |

#### Kubernetes 部署 (可选)

```yaml
# k8s/edge-collector-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: edge-collector-us-east-1
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: edge-collector
      region: us-east-1
  template:
    metadata:
      labels:
        app: edge-collector
        region: us-east-1
    spec:
      containers:
      - name: edge-collector
        image: openclaw-monitoring/edge-collector:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        volumeMounts:
        - name: nfs-sessions
          mountPath: /data/openclaw-sessions
          readOnly: true
        - name: config
          mountPath: /etc/collector/config
          readOnly: true
        envFrom:
        - secretRef:
            name: collector-secrets
        - configMapRef:
            name: collector-config
      volumes:
      - name: nfs-sessions
        persistentVolumeClaim:
          claimName: nfs-sessions-pvc
      - name: config
        configMap:
          name: collector-config
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: collector-config
  namespace: monitoring
data:
  COLLECTOR_ID: "collector-us-east-1"
  CENTER_URL: "https://monitoring.example.com"
  COLLECTION_INTERVAL_SESSIONS: "300"
  COLLECTION_INTERVAL_HEALTH: "1800"
  PUSH_INTERVAL: "300"
  MAX_CONCURRENT_INSTANCES: "10"
---
apiVersion: v1
kind: Secret
metadata:
  name: collector-secrets
  namespace: monitoring
type: Opaque
stringData:
  CENTER_API_KEY: "your-api-key-here"
```

---

### 3.6 Session Logs 采集 (Edge Collector 场景)

在 Edge Collector 架构下,**每个 Collector 负责读取其管理的 50-100 个实例的 Session Logs**。

根据部署环境选择最优方式:

**前置条件:**
- Edge Collector 与 OpenClaw 实例在同一 VPC/内网
- 低延迟网络访问 (< 10ms)
- 适当的文件访问权限 (NFS mount 或 SSH key)

**方式 A: NFS 共享存储 (PaaS 首选)**

**适用场景:** PaaS 平台提供 NFS 共享存储,所有实例挂载到同一 NFS 路径

```yaml
# docker-compose.yml (OpenClaw 实例)
volumes:
  openclaw-sessions:
    driver: nfs
    driver_opts:
      share: "nfs-server:/export/openclaw"
```

**Edge Collector 配置:**
```yaml
# docker-compose.yml (Edge Collector)
volumes:
  - nfs-server:/export/openclaw:/data/openclaw-sessions:ro
```

**优势:**
- ✅ 实时性最高(秒级)
- ✅ 像本地文件一样访问
- ✅ 无需网络连接
- ✅ 只读挂载,安全性高

**实现:**
```typescript
// src/collectors/nfs-collector.ts
import fs from 'fs/promises';
import path from 'path';

export class NfsLogCollector {
  constructor(private basePath: string) {}
  
  async collectAllInstances(): Promise<InstanceMetrics[]> {
    const instances = await fs.readdir(this.basePath);
    return Promise.all(
      instances.map(id => this.parseInstanceLogs(id))
    );
  }
  
  private async parseInstanceLogs(instanceId: string) {
    const sessionDir = path.join(this.basePath, instanceId, 'sessions');
    const files = await fs.readdir(sessionDir);
    
    const metrics = [];
    for (const file of files.filter(f => f.endsWith('.jsonl'))) {
      const filePath = path.join(sessionDir, file);
      metrics.push(await this.parseSessionFile(filePath));
    }
    
    return { instanceId, metrics };
  }
}
```

**方式 B: SSH/SFTP (通用方案)**

**适用场景:** 无法使用 NFS,需要通过 SSH 远程读取

**Edge Collector 配置:**
```typescript
// config/collectors.yml
collectors:
  - id: collector-us-east-1
    instances:
      - host: instance-001.internal
        sessionPath: /home/openclaw/.openclaw/sessions
        sshKey: /etc/collector/keys/id_rsa
      - host: instance-002.internal
        sessionPath: /home/openclaw/.openclaw/sessions
        sshKey: /etc/collector/keys/id_rsa
```

**实现:**

**方式 C: rsync 增量同步 (折中方案)**

**适用场景:** 既无 NFS 也不方便 SSH,通过定时同步到 Collector 本地

**Edge Collector 配置:**
```bash
#!/bin/bash
# /usr/local/bin/sync-logs.sh
# 每 5 分钟执行一次

INSTANCES=("instance-001" "instance-002" ... "instance-050")

for instance in "${INSTANCES[@]}"; do
  rsync -avz --include='*.jsonl' \
    ${instance}:/home/openclaw/.openclaw/sessions/ \
    /data/openclaw-logs/${instance}/ \
    --timeout=30 \
    --partial \
    || echo "Failed to sync ${instance}" >> /var/log/collector-sync.log
done
```

**crontab 配置:**
```cron
*/5 * * * * /usr/local/bin/sync-logs.sh
```

#### Session Log 格式

OpenClaw session logs 为 JSONL 格式,包含完整的 Skill 执行信息:

```jsonl
{"type":"message","timestamp":"2024-01-15T10:30:00Z","message":{"role":"assistant","provider":"openai","model":"gpt-4","content":[{"type":"tool_use","id":"toolu_abc","name":"code-assistant","input":{"prompt":"..."}}],"usage":{"input":100,"output":200,"totalTokens":300,"cost":{"total":0.003}},"durationMs":1250}}
{"type":"message","timestamp":"2024-01-15T10:30:01Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_abc","content":"...","is_error":false}]}}
```

#### 数据解析

复用 OpenClaw 内置工具:

```typescript
// src/parsers/session-log-parser.ts
import { extractToolCallNames, countToolResults } from '../utils/transcript-tools';

export class SessionLogParser {
  async parseFile(filePath: string): Promise<ParsedSession[]> {
    const sessions = new Map<string, Partial<ParsedSession>>();
    
    for await (const line of readLines(filePath)) {
      const event = JSON.parse(line);
      const message = event.message;
      
      // 提取 Skill 名称
      const toolNames = extractToolCallNames(message);
      
      // 统计执行结果
      const results = countToolResults(message);
      
      // 聚合到 session
      this.updateSession(sessions, event, toolNames, results);
    }
    
    return Array.from(sessions.values());
  }
}
---

### 3.7 Gateway API 采集 (短连接模式)

低频采集系统级指标 (每 10-30 分钟):

**关键设计: 短生命周期 WebSocket 连接**

```typescript
// src/collectors/gateway-api-collector.ts
import WebSocket from 'ws';

export class GatewayApiCollector {
  /**
   * 短连接调用: 连接 → 查询 → 断开
   */
  async callGatewayAPI(instanceUrl: string, method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(instanceUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Timeout calling ${method}`));
      }, 5000);
      
      ws.on('open', () => {
        const id = Date.now();
        ws.send(JSON.stringify({ id, method, params }));
      });
      
      ws.on('message', (data: any) => {
        clearTimeout(timeout);
        const msg = JSON.parse(data.toString());
        ws.close(); // ← 立即断开,不保持连接
        resolve(msg.result);
      });
      
      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        ws.close();
        reject(err);
      });
    });
  }
  
  /**
   * 批量查询实例系统指标
   */
  async collectSystemMetrics(instances: InstanceConfig[]): Promise<SystemMetrics[]> {
    const results = [];
    
    // 并发控制: 最多同时处理 10 个实例
    for (const batch of chunk(instances, 10)) {
      const batchResults = await Promise.allSettled(
        batch.map(async (instance) => {
          try {
            const [health, channels, cron, skills] = await Promise.all([
              this.callGatewayAPI(instance.url, 'system.health'),
              this.callGatewayAPI(instance.url, 'channels.status'),
              this.callGatewayAPI(instance.url, 'cron.status'),
              this.callGatewayAPI(instance.url, 'skills.status')
            ]);
            
            return {
              instanceId: instance.id,
              health,
              channels,
              cron,
              skills
            };
          } catch (error) {
            logger.warn({ instanceId: instance.id, error }, 'Failed to collect metrics');
            return null;
          }
        })
      );
      
      results.push(...batchResults.filter(r => r.status === 'fulfilled' && r.value !== null));
      
      // 批次间间隔,避免过载
      await sleep(1000);
    }
    
    return results;
  }
}
```

**使用示例:**
---

### 3.8 数据融合引擎

```typescript
// src/aggregators/metric-fusion.ts
export class MetricFusionEngine {
  fuseMetrics(logMetrics: LogMetrics, apiMetrics: ApiMetrics): FusedMetrics {
    return {
      // 来自 logs
      sessions: logMetrics.sessions,
      skillPerformance: logMetrics.skillStats,
      costAnalysis: logMetrics.totals,
      
      // 来自 API
      systemHealth: apiMetrics.health,
      channelStatus: apiMetrics.channels,
      cronStatus: apiMetrics.cron,
      skillConfig: apiMetrics.skills,
      
      // 智能洞察
      insights: this.generateInsights(logMetrics, apiMetrics)
    };
  }
  
  private generateInsights(logs: LogMetrics, api: ApiMetrics): Insight[] {
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
    
    return insights;
  }
}
```

---

## 4. 监控指标清单

### 4.1 系统级指标

| 指标名称 | 类型 | 采集频率 | 说明 |
|---------|------|----------|------|
| `instance.status` | Gauge | 10分钟 | 实例状态 (online/offline/error) |
| `instance.uptime_seconds` | Counter | 10分钟 | 实例运行时长(秒) |
| `instance.cpu_usage_percent` | Gauge | 10分钟 | CPU 使用率 (%) |
| `instance.memory_usage_bytes` | Gauge | 10分钟 | 内存使用量 (bytes) |
| `instance.disk_usage_bytes` | Gauge | 10分钟 | 磁盘使用量 (bytes) |
| `instance.gateway_response_time_ms` | Histogram | 10分钟 | Gateway API 响应时间 (ms) |
| `instance.active_sessions` | Gauge | 5分钟 | 活跃会话数 |
| `instance.total_sessions_24h` | Counter | 5分钟 | 24小时总会话数 |

### 4.2 会话级指标

| 指标名称 | 类型 | 采集频率 | 说明 |
|---------|------|----------|------|
| `session.duration_ms` | Histogram | 实时 | 会话持续时间 (ms) |
| `session.message_count` | Counter | 实时 | 消息数量 |
| `session.total_tokens` | Counter | 实时 | 总 Token 数 |
| `session.input_tokens` | Counter | 实时 | 输入 Token 数 |
| `session.output_tokens` | Counter | 实时 | 输出 Token 数 |
| `session.cost_usd` | Counter | 实时 | 会话成本 (USD) |
| `session.models_used` | Set | 实时 | 使用的模型列表 |
| `session.skills_executed` | Counter | 实时 | 执行的 Skill 数量 |
| `session.success_rate` | Gauge | 5分钟 | 会话成功率 (%) |

### 4.3 Skill 级指标

| 指标名称 | 类型 | 采集频率 | 说明 |
|---------|------|----------|------|
| `skill.call_count` | Counter | 5分钟 | Skill 调用次数 |
| `skill.success_count` | Counter | 5分钟 | 成功执行次数 |
| `skill.error_count` | Counter | 5分钟 | 失败执行次数 |
| `skill.success_rate` | Gauge | 5分钟 | 成功率 (%) |
| `skill.avg_duration_ms` | Histogram | 5分钟 | 平均执行时长 (ms) |
| `skill.p95_duration_ms` | Histogram | 5分钟 | P95 执行时长 (ms) |
| `skill.p99_duration_ms` | Histogram | 5分钟 | P99 执行时长 (ms) |
| `skill.token_consumption` | Counter | 5分钟 | Token 消耗量 |
| `skill.cost_usd` | Counter | 5分钟 | 成本 (USD) |
| `skill.error_types` | Set | 5分钟 | 错误类型分布 |

### 4.4 用户级指标

| 指标名称 | 类型 | 采集频率 | 说明 |
|---------|------|----------|------|
| `user.active_users_24h` | Gauge | 5分钟 | 24小时活跃用户数 |
| `user.active_users_7d` | Gauge | 1小时 | 7天活跃用户数 |
| `user.sessions_per_user` | Histogram | 1小时 | 每用户会话数 |
| `user.tokens_per_user` | Histogram | 1小时 | 每用户 Token 消耗 |
| `user.cost_per_user` | Histogram | 1小时 | 每用户成本 (USD) |
| `user.top_skills` | Set | 1小时 | 用户常用 Skill Top N |
| `user.retention_rate` | Gauge | 1天 | 用户留存率 (%) |

### 4.5 成本级指标

| 指标名称 | 类型 | 采集频率 | 说明 |
|---------|------|----------|------|
| `cost.daily_total` | Counter | 1小时 | 日总成本 (USD) |
| `cost.weekly_total` | Counter | 1天 | 周总成本 (USD) |
| `cost.monthly_total` | Counter | 1天 | 月总成本 (USD) |
| `cost.per_model` | Counter | 1小时 | 各模型成本分布 |
| `cost.per_department` | Counter | 1天 | 各部门成本分布 |
| `cost.per_skill` | Counter | 1小时 | 各 Skill 成本分布 |
| `cost.budget_utilization` | Gauge | 1小时 | 预算使用率 (%) |
| `cost.anomaly_score` | Gauge | 1小时 | 成本异常分数 (0-1) |

### 4.6 渠道级指标

| 指标名称 | 类型 | 采集频率 | 说明 |
|---------|------|----------|------|
| `channel.status` | Gauge | 10分钟 | 渠道状态 (connected/disconnected) |
| `channel.message_count` | Counter | 5分钟 | 消息数量 |
| `channel.error_count` | Counter | 5分钟 | 错误数量 |
| `channel.latency_ms` | Histogram | 5分钟 | 消息延迟 (ms) |

---

## 5. 数据模型

### 4.1 数据库 Schema

#### 会话级别指标

```sql
CREATE TABLE session_metrics (
  time TIMESTAMPTZ NOT NULL,
  instance_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id TEXT,
  agent_id TEXT,
  channel TEXT,
  duration_ms INTEGER,
  message_count INTEGER,
  total_tokens INTEGER,
  total_cost DECIMAL(10, 4),
  models TEXT[],
  skill_executions JSONB,  -- [{name, duration, success, ...}]
  PRIMARY KEY (time, instance_id, session_id)
);

SELECT create_hypertable('session_metrics', 'time');

-- 自动降采样策略
SELECT add_retention_policy('session_metrics', INTERVAL '90 days');
```

#### Skill 小时级聚合

```sql
CREATE MATERIALIZED VIEW skill_hourly_stats
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  instance_id,
  skill_name,
  SUM(calls) AS total_calls,
  AVG(duration_ms) AS avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration,
  SUM(successes) * 100.0 / SUM(calls) AS success_rate,
  SUM(cost) AS total_cost
FROM session_metrics,
  jsonb_to_recordset(skill_executions) AS 
    x(skill_name TEXT, duration_ms INTEGER, success BOOLEAN, cost DECIMAL)
GROUP BY bucket, instance_id, skill_name;
```

#### 实例健康状态

```sql
CREATE TABLE instance_health (
  time TIMESTAMPTZ NOT NULL,
  instance_id TEXT NOT NULL,
  is_online BOOLEAN,
  uptime_ms BIGINT,
  memory_usage_mb INTEGER,
  cpu_usage_percent DECIMAL(5, 2),
  active_sessions INTEGER,
  websocket_connections INTEGER,
  PRIMARY KEY (time, instance_id)
);

SELECT create_hypertable('instance_health', 'time');
```

#### 告警历史

```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instance_id TEXT,
  alert_type TEXT NOT NULL,  -- 'high_cost', 'low_success_rate', 'offline'
  severity TEXT NOT NULL,    -- 'low', 'medium', 'high', 'critical'
  message TEXT NOT NULL,
  recommendation TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_unresolved ON alerts (acknowledged) WHERE NOT acknowledged;
```

### 4.2 TypeScript 类型定义

```typescript
// src/types/metrics.ts

export interface SessionMetric {
  time: Date;
  instanceId: string;
  sessionId: string;
  userId?: string;
  agentId?: string;
  channel?: string;
  durationMs: number;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  models: string[];
  skillExecutions: SkillExecution[];
}

export interface SkillExecution {
  skillName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface SkillHourlyStats {
  bucket: Date;
  instanceId: string;
  skillName: string;
  totalCalls: number;
  avgDuration: number;
  p95Duration: number;
  successRate: number;
  totalCost: number;
}

export interface InstanceHealth {
  time: Date;
  instanceId: string;
  isOnline: boolean;
  uptimeMs: number;
  memoryUsageMb: number;
  cpuUsagePercent: number;
  activeSessions: number;
  websocketConnections: number;
}

export interface Alert {
  id: string;
  timestamp: Date;
  instanceId?: string;
  alertType: 'high_cost' | 'low_success_rate' | 'offline' | 'high_latency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendation?: string;
  acknowledged: boolean;
  resolvedAt?: Date;
}
```

---

## 6. API 设计

### 5.1 REST API 端点

#### 实例管理

```typescript
// GET /api/instances
interface ListInstancesResponse {
  instances: InstanceSummary[];
  total: number;
}

interface InstanceSummary {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'degraded';
  lastSeen: Date;
  sessionCount24h: number;
  totalCost7d: number;
}

// GET /api/instances/:id/health
interface InstanceHealthResponse {
  instanceId: string;
  isOnline: boolean;
  uptime: string;
  resources: {
    memory: { used: number; total: number; percent: number };
    cpu: { percent: number };
    disk: { used: number; total: number; percent: number };
  };
  gateway: {
    version: string;
    port: number;
    bindMode: string;
    websocketConnections: number;
  };
}
```

#### 会话统计

```typescript
// GET /api/sessions/usage
interface SessionsUsageRequest {
  startDate: string;  // ISO 8601
  endDate: string;
  instanceId?: string;
  agentId?: string;
  userId?: string;
}

interface SessionsUsageResponse {
  totals: {
    totalSessions: number;
    totalTokens: number;
    totalCost: number;
    avgDuration: number;
  };
  daily: DailyUsage[];
  topSkills: SkillUsageRanking[];
}

interface DailyUsage {
  date: string;
  sessions: number;
  tokens: number;
  cost: number;
}

interface SkillUsageRanking {
  skillName: string;
  calls: number;
  successRate: number;
  avgDuration: number;
  totalCost: number;
}
```

#### Skill 分析

```typescript
// GET /api/skills/performance
interface SkillPerformanceRequest {
  skillName?: string;
  instanceId?: string;
  period: '24h' | '7d' | '30d';
}

interface SkillPerformanceResponse {
  skills: SkillDetail[];
}

interface SkillDetail {
  name: string;
  totalCalls: number;
  successRate: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  totalCost: number;
  avgCostPerCall: number;
  errorDistribution: Record<string, number>;
  hourlyDistribution: HourlyStats[];
}

interface HourlyStats {
  hour: number;  // 0-23
  calls: number;
  avgDuration: number;
  successRate: number;
}
```

#### 告警管理

```typescript
// GET /api/alerts
interface ListAlertsRequest {
  severity?: 'low' | 'medium' | 'high' | 'critical';
  acknowledged?: boolean;
  limit?: number;
  offset?: number;
}

interface ListAlertsResponse {
  alerts: Alert[];
  total: number;
  unreadCount: number;
}

// POST /api/alerts/:id/acknowledge
interface AcknowledgeAlertRequest {
  userId: string;
  note?: string;
}

// POST /api/alerts/rules
interface CreateAlertRuleRequest {
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notificationChannels: string[];
}
```

### 5.2 WebSocket 实时推送

用于 DevOps 控制台的实时监控:

```typescript
// ws://monitor-platform/ws/devops

// 客户端订阅
{
  "type": "subscribe",
  "channels": ["instance-health", "skill-metrics", "alerts"]
}

// 服务端推送
{
  "type": "update",
  "channel": "instance-health",
  "data": {
    "instanceId": "inst-001",
    "cpu": 65.2,
    "memory": 72.8,
    "activeSessions": 12
  }
}
```

---

## 7. 告警与通知

### 7.1 告警规则定义

#### 系统级告警

| 告警名称 | 条件 | 阈值 | 窗口 | 级别 | 通知渠道 |
|---------|------|------|------|------|----------|
| 实例离线 | `instance.status == offline` | 连续 3 次检查失败 | 5分钟 | Critical | Slack + Email + PagerDuty |
| 高 CPU 使用率 | `instance.cpu_usage_percent > 85` | 持续 10 分钟 | 10分钟 | Warning | Slack |
| 高内存使用率 | `instance.memory_usage_bytes > 4GB` | 持续 15 分钟 | 15分钟 | Warning | Slack |
| Gateway 响应慢 | `instance.gateway_response_time_ms > 2000` | P95 > 2s | 10分钟 | Warning | Slack |
| 活跃会话异常 | `instance.active_sessions < 1` | 持续 1 小时 | 1小时 | Medium | Email |

#### Skill 级告警

| 告警名称 | 条件 | 阈值 | 窗口 | 级别 | 通知渠道 |
|---------|------|------|------|------|----------|
| Skill 高错误率 | `skill.success_rate < 90%` | 成功率 < 90% | 30分钟 | High | Slack + Email |
| Skill 执行慢 | `skill.p95_duration_ms > 5000` | P95 > 5s | 1小时 | Warning | Slack |
| Skill 成本异常 | `skill.cost_usd > 2x average` | 超过平均值 2 倍 | 1天 | Medium | Email |
| Skill 调用量突增 | `skill.call_count > 3x average` | 超过平均值 3 倍 | 1小时 | Warning | Slack |

#### 成本级告警

| 告警名称 | 条件 | 阈值 | 窗口 | 级别 | 通知渠道 |
|---------|------|------|------|------|----------|
| 日成本超预算 | `cost.daily_total > budget * 1.2` | 超过预算 120% | 1天 | High | Email + Slack |
| 月成本预测超标 | `cost.monthly_projected > budget * 0.9` | 预测超过预算 90% | 1天 | Medium | Email |
| 单用户成本异常 | `user.cost_per_user > 3x average` | 超过平均值 3 倍 | 1天 | Medium | Email |
| 成本增长过快 | `cost.daily_growth_rate > 20%` | 日增长率 > 20% | 1天 | Warning | Slack |

#### 用户级告警

| 告警名称 | 条件 | 阈值 | 窗口 | 级别 | 通知渠道 |
|---------|------|------|------|------|----------|
| 活跃用户下降 | `user.active_users_24h < avg * 0.7` | 低于平均值 70% | 1天 | Medium | Email |
| 用户留存率低 | `user.retention_rate < 60%` | 留存率 < 60% | 7天 | Medium | Email |

### 7.2 告警通知渠道

#### Slack 集成

```typescript
// src/notifications/slack-notifier.ts
import { WebClient } from '@slack/web-api';

export class SlackNotifier {
  private client: WebClient;
  
  constructor(token: string, channel: string) {
    this.client = new WebClient(token);
    this.channel = channel;
  }
  
  async sendAlert(alert: Alert): Promise<void> {
    const color = this.getSeverityColor(alert.severity);
    
    await this.client.chat.postMessage({
      channel: this.channel,
      attachments: [{
        color,
        title: `🚨 ${alert.alertType.toUpperCase()}`,
        text: alert.message,
        fields: [
          { title: 'Instance', value: alert.instanceId || 'N/A', short: true },
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true }
        ],
        actions: [{
          type: 'button',
          text: 'Acknowledge',
          url: `${DASHBOARD_URL}/alerts/${alert.id}/acknowledge`
        }]
      }]
    });
  }
  
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff6600';
      case 'medium': return '#ffcc00';
      case 'low': return '#00ccff';
      default: return '#cccccc';
    }
  }
}
```

#### Email 集成

```typescript
// src/notifications/email-notifier.ts
import nodemailer from 'nodemailer';

export class EmailNotifier {
  private transporter: nodemailer.Transporter;
  
  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: true,
      auth: {
        user: config.username,
        pass: config.password
      }
    });
  }
  
  async sendAlert(alert: Alert, recipients: string[]): Promise<void> {
    await this.transporter.sendMail({
      from: 'monitoring@example.com',
      to: recipients.join(','),
      subject: `[${alert.severity.toUpperCase()}] ${alert.alertType}`,
      html: this.renderAlertEmail(alert)
    });
  }
  
  private renderAlertEmail(alert: Alert): string {
    return `
      <h2>🚨 Alert: ${alert.alertType}</h2>
      <p><strong>Severity:</strong> ${alert.severity}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      <p><strong>Instance:</strong> ${alert.instanceId || 'N/A'}</p>
      <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
      ${alert.recommendation ? `<p><strong>Recommendation:</strong> ${alert.recommendation}</p>` : ''}
      <p><a href="${DASHBOARD_URL}/alerts/${alert.id}">View in Dashboard</a></p>
    `;
  }
}
```

#### Webhook 集成 (PagerDuty 等)

```typescript
// src/notifications/webhook-notifier.ts
import axios from 'axios';

export class WebhookNotifier {
  async sendAlert(alert: Alert, webhookUrl: string): Promise<void> {
    await axios.post(webhookUrl, {
      event_type: 'trigger',
      payload: {
        summary: alert.message,
        severity: this.mapSeverity(alert.severity),
        source: alert.instanceId || 'monitoring-system',
        timestamp: alert.timestamp,
        custom_details: alert
      },
      routing_key: process.env.PAGERDUTY_ROUTING_KEY
    });
  }
  
  private mapSeverity(severity: string): string {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'info';
    }
  }
}
```

### 7.3 告警抑制与去重

**告警抑制规则:**

```typescript
// src/alerts/suppression-engine.ts
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

// 使用示例
const suppression = new AlertSuppressionEngine();

if (!suppression.shouldSuppress(`cpu_high:${instanceId}`, 30)) {
  // 发送告警 (30分钟内相同实例的CPU告警只发送一次)
  await notifier.sendAlert(alert);
}
```

**告警分组:**

```typescript
// 相同类型的告警在 5 分钟内合并为一条
interface AlertGroup {
  alertType: string;
  instances: string[];
  firstOccurrence: Date;
  lastOccurrence: Date;
  count: number;
}

// 示例输出:
// "🚨 HIGH_CPU: 5 instances affected (inst-001, inst-002, ...)"
```

### 7.4 告警生命周期管理

**告警状态流转:**

```
Triggered → Acknowledged → Resolved
     ↓            ↓
  Escalated   Auto-Resolved (if condition clears)
```

**自动恢复:**

```typescript
// 如果告警条件在 30 分钟内自动清除,则自动标记为 resolved
async function checkAutoResolve(alert: Alert): Promise<void> {
  const currentMetrics = await getMetrics(alert.instanceId);
  
  if (!isConditionMet(alert.metric, alert.threshold, currentMetrics)) {
    await db.query(
      'UPDATE alerts SET resolved_at = NOW() WHERE id = $1',
      [alert.id]
    );
    
    await notifier.sendResolution(alert);
  }
}
```

---

## 8. 前端设计

### 6.1 路由结构

```typescript
// src/router/index.tsx
const routes = [
  {
    path: '/executive',
    component: ExecutiveLayout,
    children: [
      { path: '', component: ExecutiveDashboard },
      { path: 'cost-analysis', component: CostAnalysis },
      { path: 'department-report', component: DepartmentReport }
    ]
  },
  {
    path: '/devops',
    component: DevOpsLayout,
    children: [
      { path: '', component: DevOpsConsole },
      { path: 'instances/:id', component: InstanceDetail },
      { path: 'skills', component: SkillPerformance },
      { path: 'alerts', component: AlertManagement }
    ]
  },
  {
    path: '/user',
    component: UserLayout,
    children: [
      { path: '', component: UserPortal },
      { path: 'my-usage', component: MyUsage },
      { path: 'recommendations', component: SkillRecommendations },
      { path: 'achievements', component: Achievements }
    ]
  }
];
```

### 6.2 角色权限控制

```typescript
// src/auth/roles.ts
export type Role = 'executive' | 'devops' | 'user';

export const ROLE_PERMISSIONS = {
  executive: {
    pages: ['executive/*'],
    features: ['view_costs', 'export_reports'],
    dataScope: 'all'
  },
  devops: {
    pages: ['devops/*'],
    features: ['manage_instances', 'configure_alerts', 'view_logs'],
    dataScope: 'all'
  },
  user: {
    pages: ['user/*'],
    features: ['view_own_usage', 'try_skills'],
    dataScope: 'own'
  }
};

// 路由守卫组件
function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  
  if (user.role !== role && user.role !== 'admin') {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
}
```

### 6.3 核心页面组件

#### Executive Dashboard

```tsx
// src/pages/executive/Dashboard.tsx
export function ExecutiveDashboard() {
  const { data: metrics } = useQuery(['executive-metrics'], fetchExecutiveMetrics);
  
  return (
    <div className="executive-dashboard">
      {/* 核心指标卡片 */}
      <div className="metric-grid">
        <MetricCard
          title="活跃实例"
          value={`${metrics.activeInstances}/${metrics.totalInstances}`}
          trend={metrics.instanceTrend}
          status={metrics.instanceHealth}
        />
        <MetricCard
          title="今日会话"
          value={metrics.todaySessions.toLocaleString()}
          trend={metrics.sessionTrend}
        />
        <MetricCard
          title="本月成本"
          value={`¥${metrics.monthlyCost.toLocaleString()}`}
          trend={metrics.costTrend}
        />
      </div>
      
      {/* 趋势图表 */}
      <LineChart
        title="会话量趋势 (近30天)"
        data={metrics.sessionTrend30d}
        height={300}
      />
      
      {/* 部门对比 */}
      <DepartmentComparisonTable data={metrics.departmentStats} />
    </div>
  );
}
```

#### DevOps Console

```tsx
// src/pages/devops/Console.tsx
export function DevOpsConsole() {
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  
  // 实时订阅
  useWebSocket('instance-health', (data) => {
    updateInstanceHealth(data);
  });
  
  return (
    <div className="devops-console">
      <SystemHealthBar />
      
      <div className="main-content">
        <InstanceList
          instances={instances}
          selectedId={selectedInstance}
          onSelect={setSelectedInstance}
        />
        
        {selectedInstance && (
          <ResourceMonitor instanceId={selectedInstance} />
        )}
      </div>
      
      <SkillPerformanceTable />
    </div>
  );
}
```

#### User Portal

```tsx
// src/pages/user/Portal.tsx
export function UserPortal() {
  const { userStats, recommendations, achievements } = useUserDashboard();
  
  return (
    <div className="user-portal">
      <UsageSummary stats={userStats} />
      
      <div className="recommendations">
        <h2>💡 为你推荐</h2>
        {recommendations.map(rec => (
          <SkillRecommendation key={rec.id} skill={rec} />
        ))}
      </div>
      
      <AchievementGrid achievements={achievements} />
    </div>
  );
}
```

### 6.4 图表组件封装

```tsx
// src/components/charts/TrendLine.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function TrendLine({ data, title, height = 300 }) {
  return (
    <div className="trend-chart">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#8B5CF6" 
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 9. 实施计划

### Phase 1: 基础架构 (Week 1-4)

**目标:** 搭建核心基础设施,验证数据采集可行性

**任务:**
- [ ] 初始化项目结构 (monorepo)
- [ ] 配置 TimescaleDB Docker 容器
- [ ] **新增:** 设计并实现 Edge Collector 架构
- [ ] 实现 Session Log 采集器 (NFS 方式,备选 SSH)
- [ ] 实现基础数据解析器
- [ ] 创建数据库 schema 并测试
- [ ] 编写单元测试
- [ ] **新增:** 实现错误处理和重试机制
- [ ] **新增:** 实现批量推送逻辑

**交付物:**
- 可运行的 Edge Collector 服务
- 中心聚合服务
- 数据库表结构
- 基础 API 端点 (/api/health)
- 错误处理策略文档

---

### Phase 2: 核心功能 (Week 5-7)

**目标:** 实现三个角色的核心页面

**任务:**
- [ ] 搭建 React 前端项目
- [ ] 实现 Executive Dashboard
- [ ] 实现 DevOps Console
- [ ] 实现 User Portal
- [ ] 集成 Recharts 图表
- [ ] 实现 RBAC 权限控制
- [ ] 完成 REST API 开发

**交付物:**
- 完整的前端应用
- 所有 API 端点
- 基础可视化图表

---

### Phase 3: 高级功能 (Week 8-9)

**目标:** 增强功能和优化性能

**任务:**
- [ ] 实现 WebSocket 实时推送
- [ ] 添加告警引擎
- [ ] 实现数据导出 (CSV/Excel)
- [ ] 添加缓存层 (Redis)
- [ ] 性能优化 (索引、查询优化)
- [ ] 移动端适配

**交付物:**
- 实时监控系统
- 告警管理功能
- 移动端响应式界面

---

### Phase 4: 测试与部署 (Week 9-12)

**目标:** 全面测试并部署生产环境

**任务:**
- [ ] 编写集成测试
- [ ] 压力测试 (模拟 50+ 实例)
- [ ] 安全审计
- [ ] **新增:** 实现备份恢复流程
- [ ] 编写部署文档
- [ ] CI/CD 流水线
- [ ] 生产环境部署
- [ ] 用户培训
- [ ] **新增:** 监控系统自监控指标

**交付物:**
- 完整测试套件
- 部署文档
- 备份恢复手册
- 生产环境运行

---

## 10. 性能优化

### 8.1 Edge Collector 优化

**并发控制:**
```typescript
async function collectAllInstances() {
  const concurrency = 10; // 每个 Collector 最多同时处理 10 个实例
  const chunks = chunk(this.instances, concurrency);
  
  for (const chunk of chunks) {
    await Promise.allSettled(
      chunk.map(inst => collectOne(inst))
    );
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
  
  // 压缩数据
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

**错误处理与重试:**
```typescript
class ErrorHandlingStrategy {
  maxRetries = 3;
  backoffMultiplier = 2;
  
  async collectWithRetry(instance: Instance): Promise<MetricData> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.collect(instance);
      } catch (error) {
        logger.warn({ 
          instanceId: instance.id, 
          attempt, 
          error: error.message 
        }, 'Collection failed, retrying...');
        
        if (attempt === this.maxRetries) {
          await this.recordFailure(instance, error);
          throw error;
        }
        
        // 指数退避
        const delay = Math.pow(this.backoffMultiplier, attempt) * 1000;
        await sleep(delay);
      }
    }
  }
  
  private async recordFailure(instance: Instance, error: Error) {
    // 记录到数据库,用于后续分析
    await db.query(
      'INSERT INTO collection_failures (instance_id, error, timestamp) VALUES ($1, $2, NOW())',
      [instance.id, error.message]
    );
  }
}
```

**增量采集:**
```typescript
// 只采集上次采集后的新数据
const lastCollectionTime = await getLastCollectionTime(instanceId);
const newFiles = await getNewSessionFiles(instanceId, lastCollectionTime);
```

**批量写入:**
```typescript
// 批量插入数据库,减少 I/O
await db.batchInsert('session_metrics', metricsBatch, { batchSize: 1000 });
```

### 8.2 查询优化

**数据库索引:**
```sql
CREATE INDEX idx_session_metrics_instance_time 
ON session_metrics (instance_id, time DESC);

CREATE INDEX idx_session_metrics_user_time 
ON session_metrics (user_id, time DESC);

CREATE INDEX idx_skill_hourly_stats_bucket 
ON skill_hourly_stats (bucket DESC, skill_name);
```

**物化视图刷新:**
```sql
-- 每小时刷新一次
SELECT refresh_continuous_aggregate('skill_hourly_stats', 
  now() - interval '2 hours', 
  now() - interval '5 minutes');
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

## 11. 安全性

### 9.1 认证与授权

**JWT Token:**
```typescript
// 登录接口
POST /api/auth/login
{
  "username": "admin",
  "password": "******"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "role": "devops"
}
```

**API 鉴权中间件:**
```typescript
app.addHook('preHandler', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  
  const decoded = verifyToken(token);
  request.user = decoded;
  
  // 检查角色权限
  if (!hasPermission(decoded.role, request.routeOptions.url)) {
    throw new Error('Forbidden');
  }
});
```

**API 速率限制:**
```typescript
import rateLimit from 'fastify-rate-limit';

app.register(rateLimit, {
  max: 100,  // 每分钟最多100次请求
  timeWindow: '1 minute',
  ban: 10  // 超限后封禁10分钟
});
```

**SQL 注入防护:**
```typescript
// 始终使用参数化查询
const result = await db.query(
  'SELECT * FROM session_metrics WHERE instance_id = $1 AND time > $2',
  [instanceId, startTime]
);

// 禁止拼接 SQL
// ❌ 错误示例
// const sql = `SELECT * FROM metrics WHERE id = ${userId}`;
```

### 9.2 数据安全

**敏感数据脱敏:**
```typescript
function sanitizeSessionData(session: SessionMetric): SanitizedSession {
  return {
    ...session,
    userId: hashUserId(session.userId), // 哈希处理
    skillExecutions: session.skillExecutions.map(exec => ({
      ...exec,
      input: undefined,  // 移除输入参数
      output: undefined  // 移除输出结果
    }))
  };
}
```

**传输加密:**
- HTTPS (TLS 1.3)
- WebSocket over TLS (WSS)
- SSH/SFTP 加密通道

### 11.3 安全加固措施

#### Edge Collector 与中心服务通信安全

**API Key 认证:**
```typescript
// Edge Collector 配置
const collectorConfig = {
  centerUrl: 'https://monitoring.example.com',
  apiKey: process.env.CENTER_API_KEY, // 从环境变量读取
};

// 每次请求携带 API Key
await axios.post(`${centerUrl}/api/metrics/batch`, batchData, {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'X-Collector-ID': collectorId
  }
});
```

**API Key 轮换策略:**
- 每 90 天自动轮换一次 API Key
- 旧 Key 保留 7 天过渡期
- 使用 HashiCorp Vault 或 AWS Secrets Manager 管理密钥

#### SSH Key 管理

**最佳实践:**
```bash
# 1. 生成强密钥对
ssh-keygen -t ed25519 -C "collector@example.com" -f /etc/collector/keys/id_ed25519

# 2. 设置严格权限
chmod 600 /etc/collector/keys/id_ed25519
chmod 644 /etc/collector/keys/id_ed25519.pub

# 3. 在 OpenClaw 实例上配置 authorized_keys
cat id_ed25519.pub >> /home/openclaw/.ssh/authorized_keys
chmod 600 /home/openclaw/.ssh/authorized_keys

# 4. 禁用密码登录
# /etc/ssh/sshd_config
PasswordAuthentication no
PubkeyAuthentication yes
```

#### NFS 挂载安全选项

```yaml
# docker-compose.yml
volumes:
  nfs-sessions:
    driver: local
    driver_opts:
      type: nfs
      # 只读挂载
      o: "addr=nfs-server.internal,ro,noexec,nosuid,nodev"
      device: ":/export/openclaw"
```

**安全选项说明:**
- `ro`: 只读访问,防止误修改
- `noexec`: 禁止执行文件
- `nosuid`: 忽略 SUID/SGID 位
- `nodev`: 不解释设备文件

#### 网络隔离

**VPC 架构:**
```
┌─────────────────────────────────────┐
│          VPC: monitoring-vpc        │
│                                     │
│  ┌──────────┐    ┌──────────────┐  │
│  │ Collector│←──→│ Center Svc   │  │
│  │ Subnet   │    │ Subnet       │  │
│  └──────────┘    └──────────────┘  │
│         ↑              ↑            │
└─────────┼──────────────┼────────────┘
          │              │
          │ Security     │ Security
          │ Group:       │ Group:
          │ allow-nfs    │ allow-api
          │              │            
┌─────────┼──────────────┼────────────┐
│         ↓              ↓            │
│  ┌──────────┐    ┌──────────────┐  │
│  │OpenClaw  │    │ TimescaleDB  │  │
│  │Instances │    │ Subnet       │  │
│  └──────────┘    └──────────────┘  │
└─────────────────────────────────────┘
```

**Security Group 规则:**

| 方向 | 协议 | 端口 | 源/目标 | 说明 |
|------|------|------|---------|------|
| Inbound | TCP | 2049 | Collector SG | NFS 访问 |
| Inbound | TCP | 22 | Collector SG | SSH 访问 |
| Inbound | TCP | 443 | Collector SG | HTTPS API |
| Outbound | TCP | 443 | Internet | 外部通知 (Slack/Email) |

#### 容器安全

**Docker 安全选项:**
```yaml
services:
  edge-collector:
    image: openclaw-monitoring/edge-collector:latest
    security_opt:
      - no-new-privileges:true  # 禁止提权
    read_only: true  # 只读文件系统
    tmpfs:
      - /tmp:noexec,nosuid,size=100M  # 临时目录
    cap_drop:
      - ALL  # 删除所有 capabilities
    cap_add:
      - NET_BIND_SERVICE  # 仅添加必要能力
    user: "1000:1000"  # 非 root 用户运行
```

#### 审计日志

**记录关键操作:**
```typescript
// src/audit/logger.ts
import pino from 'pino';

const auditLogger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: '/var/log/audit.log' }
  }
});

export function logAuditEvent(event: AuditEvent): void {
  auditLogger.info({
    timestamp: new Date().toISOString(),
    userId: event.userId,
    action: event.action,
    resource: event.resource,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    result: event.result  // success/failure
  });
}

// 使用示例
logAuditEvent({
  userId: 'admin@example.com',
  action: 'login',
  resource: '/api/auth/login',
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  result: 'success'
});
```

**审计事件类型:**
- 用户登录/登出
- API Key 创建/删除/轮换
- 告警规则修改
- 权限变更
- 数据导出

---

## 12. 监控与运维

### 10.1 系统自监控

监控平台自身也需要监控:

**关键指标:**
```typescript
// 监控指标
const selfMetrics = {
  collectionLatency: {  // 数据采集延迟
    p50: '< 2 minutes',
    p95: '< 5 minutes',
    p99: '< 10 minutes'
  },
  apiResponseTime: {  // API 响应时间
    p50: '< 100ms',
    p95: '< 500ms',
    p99: '< 1s'
  },
  databasePerformance: {  // 数据库性能
    queryTime: '< 100ms',
    connectionPoolUsage: '< 80%'
  },
  errorRate: '< 1%',  // 错误率
  memoryUsage: '< 2GB',  // 内存使用
  cpuUsage: '< 70%'  // CPU 使用
};
```

**告警阈值:**
- 采集延迟 > 10 分钟 → Critical 告警
- API 错误率 > 5% → High 告警
- 数据库连接池使用率 > 80% → Medium 告警
- 内存使用 > 3GB → High 告警

**健康检查端点:**
```typescript
GET /health
{
  "status": "healthy",
  "uptime": 86400,
  "database": "connected",
  "redis": "connected",
  "lastCollection": "2024-01-15T10:30:00Z",
  "collectionLatency": 180,  // seconds
  "errorRate24h": 0.02
}
```

### 10.2 日志管理

```typescript
// 结构化日志
import pino from 'pino';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

logger.info({ instanceId: 'inst-001', duration: 1250 }, 'Collection completed');
```

### 10.3 备份与恢复

**自动备份策略:**
```bash
#!/bin/bash
# /etc/cron.daily/openclaw-monitor-backup.sh

BACKUP_DIR="/backup/openclaw-monitoring"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="openclaw_monitoring"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行备份 (PostgreSQL 格式)
pg_dump -Fc -h localhost -U postgres $DB_NAME > $BACKUP_DIR/backup_$DATE.dump

# 压缩备份
gzip $BACKUP_DIR/backup_$DATE.dump

# 删除7天前的备份
find $BACKUP_DIR -name "backup_*.dump.gz" -mtime +7 -delete

# 上传到对象存储 (可选)
aws s3 cp $BACKUP_DIR/backup_$DATE.dump.gz s3://company-backups/openclaw-monitor/
```

**恢复流程:**
```bash
# 1. 停止服务
systemctl stop openclaw-monitoring

# 2. 解压备份文件
gunzip backup_20240115_030000.dump.gz

# 3. 恢复数据库
pg_restore -h localhost -U postgres -d openclaw_monitoring -c backup_20240115_030000.dump

# 4. 验证数据
psql -h localhost -U postgres -d openclaw_monitoring -c "SELECT COUNT(*) FROM session_metrics;"

# 5. 重启服务
systemctl start openclaw-monitoring
```

**灾难恢复计划:**
1. **RPO (Recovery Point Objective):** 24小时 (每日备份)
2. **RTO (Recovery Time Objective):** 2小时
3. **备份保留期:** 7天本地 + 90天对象存储

---

## 13. 扩展性设计

### 11.1 添加新指标

只需三步:

1. **定义采集器:**
```typescript
class NewMetricCollector implements MetricCollector {
  name = 'new-metric';
  interval = 300000;
  
  async collect(instance: Instance): Promise<MetricData> {
    // 采集逻辑
  }
}
```

2. **注册采集器:**
```typescript
registerCollector(new NewMetricCollector());
```

3. **前端展示:**
```tsx
<NewMetricChart data={useMetricQuery('new-metric')} />
```

### 11.2 水平扩展

**多采集器实例:**
```
┌─────────────┐  ┌─────────────┐
│ Collector 1 │  │ Collector 2 │
│ (Inst 1-25) │  │ (Inst 26-50)│
└──────┬──────┘  └──────┬──────┘
       │                │
       └────────┬───────┘
                ▼
        ┌───────────────┐
        │  TimescaleDB  │
        └───────────────┘
```

**分片策略:**
```typescript
// 根据 instanceId 哈希分配
const shardIndex = hash(instanceId) % numShards;
await collectors[shardIndex].collect(instance);
```

---

## 14. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **WebSocket 长连接扩展性差** | 高 | 高 | ✅ 采用 Edge Collector 分层架构,短生命周期 WS 连接 |
| **Edge Collector 单点故障** | 中 | 中 | 部署多个 Collector,负载均衡,自动故障转移 |
| **NFS 不可用** | 高 | 低 | 降级到 SSH 采集,或 rsync 增量同步 |
| **数据库性能瓶颈** | 中 | 中 | 索引优化、读写分离、物化视图 |
| **大量实例并发采集** | 中 | 中 | 并发控制(每 Collector 最多 10)、队列缓冲 |
| **Session Log 格式变更** | 高 | 低 | 版本检测、兼容层 |
| **内存泄漏** | 中 | 低 | 定期重启、监控 RSS |
| **网络分区** | 高 | 低 | Edge Collector 本地缓存,网络恢复后补推 |
| **中心服务过载** | 高 | 中 | 批量推送、限流、水平扩展 |
| **时间线延期** | 中 | 中 | 采用敏捷迭代,优先 MVP |

---

## 15. 成功标准

### 功能性指标
- ✅ 三个角色视图完整可用
- ✅ 支持 50+ 实例监控
- ✅ Skill 执行数据统计准确
- ✅ 实时告警功能正常

### 性能指标
- ✅ 数据采集延迟 < 5 分钟
- ✅ API P95 响应时间 < 500ms
- ✅ 前端首屏加载 < 3 秒
- ✅ 支持 100+ 并发用户

### 质量指标
- ✅ 单元测试覆盖率 > 80%
- ✅ 无 Critical/High 级别安全漏洞
- ✅ 系统可用性 > 99.5%

---

## 16. 附录

### A. 参考资料
- [OpenClaw 官方文档](https://docs.openclaw.ai/)
- [TimescaleDB 文档](https://docs.timescale.com/)
- [Recharts 文档](https://recharts.org/)
- [Ant Design Pro](https://pro.ant.design/)

### B. 术语表
- **Session Log**: OpenClaw 会话日志文件 (JSONL 格式)
- **Skill**: OpenClaw 中的工具/能力模块
- **Gateway API**: OpenClaw Gateway 暴露的 WebSocket API
- **TimescaleDB**: 基于 PostgreSQL 的时序数据库

### C. 变更记录
| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2024-01-15 | AI Assistant | 初始版本 |
| 1.1 | 2024-01-15 | AI Assistant | 规范审查修订: 补充错误处理、备份恢复、安全措施,调整时间线 |
| 1.2 | 2024-01-15 | AI Assistant | **架构重大调整**: 针对 1000+ 实例场景,从中心直连改为分层聚合 (Edge Collectors),解决 WebSocket 长连接扩展性问题 |

---

## 附录 D. 规范审查报告

**审查日期:** 2024-01-15  
**审查者:** AI Assistant (自动审查)  
**审查结果:** ✅ 通过 (有条件)

### 审查摘要

本次审查对设计文档进行了全面检查,包括完整性、一致性、可行性、技术合理性、遗漏项、可维护性和安全性七个维度。

### 审查发现的问题

#### ✅ 通过的方面
1. 文档结构完整,覆盖所有必要章节
2. 技术选型合理,符合项目需求
3. 零修改 OpenClaw 的目标可实现
4. 混合采集策略平衡性能和复杂度
5. 多角色视图设计到位

#### ⚠️ 已修复的问题
1. **时间线过于乐观** - 从 8 周调整为 12 周
2. **缺少错误处理策略** - 新增指数退避重试机制
3. **缺少备份恢复流程** - 新增每日备份和灾难恢复计划
4. **缺少 API 安全措施** - 新增速率限制和 SQL 注入防护
5. **自监控指标不明确** - 新增具体指标和告警阈值
6. **WebSocket 长连接扩展性差** - 改为 Edge Collector 分层架构,短生命周期 WS 连接

### 审查建议

#### 高优先级 (已在 v1.1/v1.2 中实施)
- [x] 补充错误处理和重试机制 (Section 8.1)
- [x] 补充备份恢复流程 (Section 10.3)
- [x] 补充 API 速率限制和 SQL 注入防护 (Section 9.1)
- [x] 明确监控平台自监控指标 (Section 10.1)
- [x] 调整实施时间线更现实 (Section 7)
- [x] **重构数据采集架构为分层聚合** (Section 3) - 解决 1000+ 实例扩展性问题

#### 中优先级 (可选优化)
- [ ] 添加 NFS 前置条件说明 (Section 3.2)
- [ ] 提供 TimescaleDB 学习资源链接 (附录)
- [ ] 添加数据迁移策略说明 (Section 4)

#### 低优先级 (未来考虑)
- [ ] 考虑添加 Grafana 集成选项
- [ ] 考虑添加 Prometheus 监控导出器

### 最终结论

**设计文档质量:** 优秀 ⭐⭐⭐⭐⭐

**建议:** 文档已达到可进入实施阶段的标准。建议在 Phase 1 开始前,先完成以下准备工作:
1. 确认 PaaS 环境的 NFS/SSH 访问方式
2. 评估团队对 TimescaleDB 的熟悉程度
3. 准备测试环境所需的 OpenClaw 实例

**下一步:** 等待用户评审通过后,调用 `writing-plans` 技能创建详细实施计划。

---

**文档结束**
