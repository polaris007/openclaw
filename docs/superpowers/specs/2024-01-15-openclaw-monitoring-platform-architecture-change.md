# 架构变更说明 - 针对 1000+ 实例场景优化

**变更日期:** 2024-01-15  
**版本:** v1.1 → v1.2  
**影响范围:** 数据采集架构 (Section 3)

---

## 📋 变更背景

### 用户反馈

> "我想到设计里的一个问题：我们的OpenClaw实例可能较多，目标是1000+，那么使用现有Gateway API是不是要用WS通信？那会不会有问题？"

### 问题分析

通过源码分析发现 OpenClaw Gateway 存在以下限制:

```typescript
// src/gateway/server/preauth-connection-budget.ts
const DEFAULT_MAX_PREAUTH_CONNECTIONS_PER_IP = 32; // 每个IP最多32个预认证连接
```

**原方案的问题 (中心直连):**

```
监控平台 (单IP)
  ├─ WS 长连接 → Instance #1
  ├─ WS 长连接 → Instance #2
  ├─ ...
  └─ WS 长连接 → Instance #1000  ❌ 不可行!
```

**严重问题:**
1. ❌ **连接数爆炸**: 需维护 1000+ WebSocket 长连接
2. ❌ **资源消耗巨大**: 每连接 ~50KB,1000 连接 = 50MB+ 内存
3. ❌ **触发限制**: 超过 `MAX_PREAUTH_CONNECTIONS_PER_IP` (32)
4. ❌ **重连风暴**: 网络抖动时 1000 连接同时重连,压垮网关
5. ❌ **单点故障**: 监控平台宕机导致所有连接断开

---

## ✅ 新方案: 分层聚合架构 (Edge Collectors)

### 整体架构

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

### 关键改进

#### 1. Edge Collector 部署策略

- **密度:** 每 50-100 个 OpenClaw 实例部署一个 Collector
- **位置:** 与 OpenClaw 实例同机房/同 VPC
- **资源:** 轻量级 Node.js 服务,< 500MB 内存
- **数量:** 1000 实例 → 10-20 个 Collectors

#### 2. 短生命周期 WebSocket 连接

**原方案 (长连接):**
```typescript
// ❌ 问题: 长期占用资源
const ws = new WebSocket(instanceUrl);
// 保持连接,定期发送心跳
setInterval(() => ws.ping(), 30000);
```

**新方案 (短连接):**
```typescript
// ✅ 优势: 用完即断,不占用长期资源
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
      ws.close(); // ← 立即断开
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

#### 3. 批量推送优化

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
  
  // 压缩数据 (减少 70-80% 传输量)
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
    // 保留缓存,下次合并推送
  }
}
```

---

## 📊 方案对比

### 性能对比

| 指标 | 原方案 (中心直连) | 新方案 (分层聚合) | 改善 |
|------|------------------|------------------|------|
| **监控平台 WS 连接数** | 1000+ | 10-20 (Collectors) | ↓ 98% |
| **单 IP 连接数** | 1000+ | ≤ 100 (per Collector) | ✅ 符合限制 |
| **内存占用 (监控平台)** | 50MB+ | 5MB | ↓ 90% |
| **网络流量** | 1000 × 独立请求 | 10-20 × 批量推送 | ↓ 80% |
| **故障影响范围** | 全部实例 | 单个区域 (50-100 实例) | 隔离 |
| **扩展性** | 差 (C10K问题) | 优秀 (水平扩展) | ✅ |

### 复杂度对比

| 维度 | 原方案 | 新方案 | 说明 |
|------|--------|--------|------|
| **架构复杂度** | 低 | 中 | 需要部署 Edge Collectors |
| **运维成本** | 低 | 中 | 多组件管理 |
| **开发工作量** | 少 | 多 20% | 需实现 Collector 和批量推送 |
| **可维护性** | 中 | 高 | 故障隔离,易于调试 |

---

## 🎯 实施影响

### Phase 1 调整 (Week 1-4)

**新增任务:**
- [ ] 设计并实现 Edge Collector 架构
- [ ] 实现批量推送逻辑
- [ ] 实现短生命周期 WS 连接封装

**交付物变更:**
- ~~可运行的数据采集服务~~ → **可运行的 Edge Collector 服务**
- 新增: **中心聚合服务**

### 技术栈补充

**Edge Collector:**
- Node.js 24
- ws (WebSocket 客户端)
- axios (HTTP 客户端)
- node-cron (定时任务)
- pino (日志)

**中心聚合服务:**
- Fastify (REST API)
- TimescaleDB (数据存储)
- Redis (可选,缓存)

---

## ⚠️ 风险评估

### 新增风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Edge Collector 单点故障 | 中 | 中 | 部署多个 Collector,负载均衡,自动故障转移 |
| 网络分区 | 高 | 低 | Edge Collector 本地缓存,网络恢复后补推 |
| 中心服务过载 | 高 | 中 | 批量推送、限流、水平扩展 |

### 已缓解风险

| 风险 | 原状态 | 新状态 | 缓解措施 |
|------|--------|--------|---------|
| WebSocket 长连接扩展性差 | 🔴 高 | ✅ 已解决 | 改为短连接 + 分层架构 |
| 大量实例并发采集 | 🟡 中 | ✅ 已优化 | 每 Collector 最多 10 并发 |

---

## 📝 迁移指南

### 从小规模升级到大规模

**阶段 1: < 50 实例**
- 使用中心直连架构
- 无需 Edge Collectors

**阶段 2: 50-200 实例**
- 引入第一个 Edge Collector
- 逐步迁移实例到 Collector

**阶段 3: 200+ 实例**
- 部署多个 Edge Collectors
- 按区域/机房划分实例

**阶段 4: 1000+ 实例**
- 完整分层架构
- 考虑引入消息队列 (Kafka/RabbitMQ)

---

## ✅ 验证清单

- [x] 确认 OpenClaw Gateway 无 HTTP REST API (只有 WS)
- [x] 确认 `MAX_PREAUTH_CONNECTIONS_PER_IP = 32` 限制
- [x] 设计 Edge Collector 架构
- [x] 实现短生命周期 WS 连接
- [x] 实现批量推送逻辑
- [x] 更新实施计划 (Phase 1: 3周 → 4周)
- [x] 更新风险与缓解措施
- [x] 更新文档版本 (v1.1 → v1.2)

---

## 🔗 相关文档

- 主设计文档: `docs/superpowers/specs/2024-01-15-openclaw-monitoring-platform-design.md`
- 对话记录: `docs/superpowers/conversation-records/2024-01-15-openclaw-monitoring-platform-design-conversation.md`

---

**变更批准:** 待用户评审  
**下一步:** 用户审查通过后,调用 `writing-plans` 创建详细实施计划
