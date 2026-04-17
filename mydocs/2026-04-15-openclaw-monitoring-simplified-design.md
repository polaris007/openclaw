# OpenClaw 简化版监控系统设计文档

**版本**: v1.5  
**日期**: 2026-04-15  
**作者**: OpenClaw Team  
**状态**: Draft

---

## 1. 项目背景与目标

### 1.1 业务场景

OpenClaw 是一款企业级个人助理服务，基于开源 OpenClaw 框架进行二次开发和部署。系统通过容器化方式部署在 PaaS 平台上，为多个用户提供 AI 对话服务。

**核心需求**：
- 监控所有用户实例（龙虾）的运行状态
- 统计全局运营数据（对话量、技能使用、Token消耗等）
- 提供对话记录检索和链路追溯能力
- 支持多维度数据分析（按时间、用户、技能等）

### 1.2 技术约束

1. **零修改原则**: 不允许修改 OpenClaw 源码，保持上游兼容性
2. **NAS 日志访问**: Session Log 文件通过 NFS 挂载到应用容器内
3. **单服务架构**: 仅使用一个 Java SpringBoot 后端服务，无独立 Collector
4. **数据库**: OceanBase MySQL 兼容模式

### 1.3 设计目标

- ✅ 简化架构，降低运维复杂度
- ✅ 接受 1 小时数据延迟，换取实现简单性
- ✅ 健康状态缓存，查询性能优异
- ✅ 支持手动触发任务，便于调试和即时更新

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────┐
│         Java SpringBoot Backend Service              │
│                                                      │
│  ┌────────────────┐    ┌────────────────────────┐   │
│  │ 定时任务调度器  │    │   REST API Controller   │   │
│  │                │    │                         │   │
│  │ • Session扫描   │    │ • 运营大盘接口          │   │
│  │ • 健康检查轮询  │    │ • 对话检索接口          │   │
│  │ • 手动触发接口  │    │ • 管理接口              │   │
│  └───────┬────────┘    └───────────┬────────────┘   │
│          │                         │                 │
│  ┌───────▼─────────────────────────▼────────────┐   │
│  │        业务逻辑层 (Service Layer)             │   │
│  │                                              │   │
│  │ • Session Log 解析引擎 (流式 JSONL)           │   │
│  │ • Turn 聚合计算                              │   │
│  │ • Gateway 健康检查客户端                      │   │
│  │ • 数据统计与指标计算                          │   │
│  └──────────────┬───────────────────────────────┘   │
│                 │                                    │
└─────────────────┼────────────────────────────────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
  ┌──▼──┐   ┌────▼────┐  ┌───▼────┐
  │ NFS │   │OceanBase│  │ 其他   │
  │挂载 │   │ MySQL   │  │ 存储   │
  │     │   │         │  │        │
  │Sess-│   │• dashboard_      │
  │ion  │   │  openclaw_       │
  │Log  │   │  instances       │
  │文件 │   │• dashboard_      │
  │     │   │  session_turn    │
  │     │   │• dashboard_      │
  │     │   │  gateway_health_ │
  │     │   │  cache           │
  │     │   │• dashboard_      │
  │     │   │  session_        │
  │     │   │  processing_     │
  │     │   │  state           │
  └─────┘   └─────────┘  └────────┘
```

### 2.2 核心组件说明

#### 2.2.1 Session Log 扫描任务

**触发方式**：
- 定时触发：每 1 小时自动执行（Spring @Scheduled）
- 手动触发：`POST /api/v1/admin/trigger-task?type=session_scan`

**处理流程**：
1. 扫描 NFS 挂载目录下的所有 Session Log 文件（基于配置的路径模式）
2. **检测文件变化**：基于文件大小、修改时间判断是否需要处理
3. **检测 Compaction（双重检测机制）**：
   - **主要方式**：在第二遍扫描时统计 JSONL 文件中 `type: "compaction"` 记录数量
   - 与数据库中存储的 `compaction_count` 对比，如果数量增加则判定为发生了新的 compaction
   - **备用方式**：检测文件大小缩小超过 10%（用于兜底，防止遗漏）
   - 如果检测到新的 compaction，触发全量重扫
4. **流式扫描**：逐行解析 JSONL 文件，提取消息元数据并聚合为 Turn
5. **不解析 Token 统计**：Token、成本等数据通过 Gateway `usage.cost` API 直接获取（见 3.2.5 节）
6. **解析 Skill 和 Model 信息**：从 tool call 记录和 message usage 字段提取
7. 聚合 Turn 结构（消息数、时间范围、Skill 使用、Model 使用等）到 session_turn 表
8. **清理无效数据**：如果检测到 compaction，删除该 session 未完成的 Turn 记录
9. 更新 last_message_id 和 compaction_count 记录

**Session 文件路径规则**：
- **NFS 挂载根目录**：通过配置项 `monitoring.session.scan.nfs-mount-path` 指定
- **路径模式**：`{nfs-mount-path}/instances/{instance_id}/agents/{agent_id}/sessions/*.jsonl`
- **文件名格式**：
  - 标准会话：`{sessionId}.jsonl`（例如：`abc-123-def.jsonl`）
  - Topic 会话：`{sessionId}-topic-{encodedTopic}.jsonl`
  - Fork 会话：`{timestamp}_{sessionId}.jsonl`
- **目录结构示例**：
  ```
  /mnt/session-logs/
  └── instances/
      ├── instance-001/
      │   └── agents/
      │       └── main/
      │           └── sessions/
      │               ├── abc-123.jsonl
      │               ├── def-456-topic-work.jsonl
      │               └── ...
      ├── instance-002/
      │   └── agents/
      │       └── main/
      │           └── sessions/
      │               └── ...
      └── ...
  ```
- **Instance 关联**：从路径中提取 `instance_id`，与 `openclaw_instances` 表关联
- **Agent 隔离**：支持多 agent 场景，每个 agent 有独立的 sessions 目录

**Compaction 机制说明**：

OpenClaw 的 Session Compaction 分为两个阶段：

1. **Compaction 阶段**：
   - 将历史对话压缩为摘要，减少 token 消耗
   - 在 JSONL 文件中添加一条 `type: "compaction"` 记录
   - **此时旧消息仍然保留**在文件中
   - Compaction 记录包含 `firstKeptEntryId` 字段，标记未压缩部分的起点
   - Compaction 记录示例：
     ```json
     {
       "type": "compaction",
       "id": "comp_abc123",
       "timestamp": "2026-04-15T10:30:00Z",
       "firstKeptEntryId": "msg_xyz789",
       "parentId": "msg_def456"
     }
     ```

2. **Truncation 阶段**（独立执行）：
   - 从 JSONL 文件中物理删除被压缩的旧消息（`firstKeptEntryId` 之前的消息）
   - 保留：Session header、Compaction 记录、未压缩的尾部消息
   - 文件大小显著减小（通常 >10%）

**增量策略**：
- **文件级别**：检测文件修改时间或大小变化
- **Compaction 检测（双重保障）**：
  - **主要方式**：统计 JSONL 文件中 `type: "compaction"` 记录数量，与数据库存储的 `compaction_count` 对比
  - **备用方式**：文件大小缩小超过 10% 时，判定为发生 truncation
  - **优势**：主要方式更可靠，即使 compaction 导致的文件缩小 <10% 也能检测到
  - **实现**：在第二遍扫描时同时统计 compaction_count，避免两遍完整扫描
- **消息级别**：正常情况下记录 last_message_id，只处理新增消息
- **全量重扫**：检测到新的 compaction 后，重置 last_message_id，重新扫描整个文件
- **数据清理**：compaction 后删除 is_complete=0 的未完成 Turn 记录，避免数据不一致

#### 2.2.2 Gateway 健康检查轮询

**触发方式**：
- 定时触发：每 5 分钟自动执行
- 手动触发：`POST /api/v1/admin/trigger-task?type=health_check`

**处理流程**：
1. 从 `openclaw_instances` 表获取所有 status为running的instance 列表
2. **并行执行健康检查**：使用线程池（默认 50 个并发线程）同时检查多个实例
3. 对每个 instance，创建短生命周期 WebSocket 连接，调用 `health` 方法（不是 HTTP GET）
4. WebSocket 连接超时设置为 3 秒（可配置）
5. 解析 Health RPC 响应，提取关键指标更新到 `gateway_health_cache` 表
6. 等待所有检查完成（最多 60 秒），单个实例失败不影响其他
7. 对比 `openclaw_instances` 表，清理非 running 的 instance 缓存记录

**性能优化说明**：
- **并行执行**：采用线程池并行检查，1000 个实例可在 0.4-1.5 秒内完成
- **短连接模式**：每次检查创建新连接，无需维护长连接状态
- **资源可控**：通过 `parallelism` 配置控制并发度，默认 50
- **容错性好**：单个实例失败不影响其他实例的检查结果

**重要说明 - Health API 调用方式**：
- ❌ **错误方式**: HTTP GET `/health` （只返回 `{"ok":true,"status":"live"}`）
- ✅ **正确方式**: WebSocket RPC `health` 方法
- **调用示例**（TypeScript）:
  ```typescript
  const summary = await callGateway<HealthSummary>({
    method: "health",
    params: { probe: false },  // probe=true 会执行渠道探测，耗时更长
    timeoutMs: 3000,
    config: cfg,
  });
  ```
- **Java 实现**: 需要使用 WebSocket 客户端库（如 Java-WebSocket 或 Spring WebSocket）建立连接并发送 JSON-RPC 请求

**Health API 实际返回结构**（来自 OpenClaw 源码 `src/commands/health.ts`）：
```json
{
  "ok": true,
  "ts": 1713123456789,
  "durationMs": 245,
  "channels": {
    "discord": {
      "accountId": "default",
      "configured": true,
      "probe": {
        "ok": true,
        "elapsedMs": 120,
        "bot": { "username": "mybot" }
      }
    },
    "telegram": {
      "accountId": "default",
      "configured": false
    }
  },
  "channelOrder": ["discord", "telegram", "slack"],
  "channelLabels": {
    "discord": "Discord",
    "telegram": "Telegram"
  },
  "heartbeatSeconds": 30,
  "defaultAgentId": "main",
  "agents": [
    {
      "agentId": "main",
      "name": "Main Agent",
      "isDefault": true,
      "heartbeat": {
        "everyMs": 30000,
        "lastBeat": 1713123456000
      },
      "sessions": {
        "path": "/data/sessions/main.json",
        "count": 15,
        "recent": [...]
      }
    }
  ],
  "sessions": {
    "path": "/data/sessions/main.json",
    "count": 15,
    "recent": [
      {
        "key": "discord:user123",
        "updatedAt": 1713123400000,
        "age": 56789
      }
    ]
  }
}
```

**关键字段映射到缓存表**：
- `ok` → `status`: `true` = "online", `false` = "offline"
- `agents[0].heartbeat.lastBeat` → `last_heartbeat`: 最后心跳时间戳
- `ts` → `last_check_time`: 健康检查时间
- `agents[0].heartbeat.everyMs` → 可用于计算下次预期心跳
- **注意**: 实际返回中**没有** `version`, `nodeId`, `memory.rss` 等字段

**Token 统计数据获取策略（统一方案）**：

**核心原则**：所有 Token/Cost/Model 统计统一使用 Gateway `usage.cost` API，不再使用 `sessions.list`

**分工说明**：
- **Token/Cost/Model 统计**：通过 Gateway `usage.cost` API 按日期范围轮询获取（权威数据源）
- **Skill/Turn 统计**：从 `dashboard_session_turn` 表聚合（Session Log 解析结果）
- **Turn 级别 Token 分摊**：当 Session Log 解析失败时，按比例从 `usage.cost` API 数据分摊

**Gateway usage.cost API 返回字段**：
```json
{
  "updatedAt": 1713123456789,       // 数据更新时间戳
  "days": 1,                         // 统计天数
  "daily": [                         // 每日明细（按日期分组）
    {
      "date": "2026-04-14",          // 日期 YYYY-MM-DD
      "input": 1200,                 // 输入 Token 数
      "output": 800,                 // 输出 Token 数
      "cacheRead": 100,              // 缓存读取 Token 数
      "cacheWrite": 50,              // 缓存写入 Token 数
      "totalTokens": 2150,           // 总 Token 数
      "totalCost": 0.035,            // 总成本（美元）
      "inputCost": 0.012,            // 输入成本
      "outputCost": 0.020,           // 输出成本
      "cacheReadCost": 0.002,        // 缓存读成本
      "cacheWriteCost": 0.001,       // 缓存写成本
      "missingCostEntries": 0        // 缺失成本条目的数量
    }
  ],
  "totals": {                        // 总计（整个日期范围的汇总）
    "input": 1200,
    "output": 800,
    "cacheRead": 100,
    "cacheWrite": 50,
    "totalTokens": 2150,
    "totalCost": 0.035,
    "inputCost": 0.012,
    "outputCost": 0.020,
    "cacheReadCost": 0.002,
    "cacheWriteCost": 0.001,
    "missingCostEntries": 0
  }
}
```

**⚠️ 重要说明**：
1. `usage.cost` 返回的是 **日期范围内的累计值**，不是 Session 级别的
2. `daily` 数组提供按天分组的详细数据，适合时间序列分析
3. `totals` 是整个查询范围的汇总值
4. **不包含** Skill 调用信息、Channel 分布、User 维度等，这些只能从 Session Log 解析
5. 支持 `startDate`/`endDate` 参数精确控制日期范围，或 `days` 参数指定最近 N 天

**Gateway WebSocket 客户端设计**：
- **连接模式**：短连接（Short-lived Connection），每次调用后立即关闭
- **不使用连接池**：避免长连接占用资源和状态管理复杂度
- **实现流程**：
  ```java
  public CostUsageSummary fetchCostUsage(LocalDate startDate, LocalDate endDate) {
      String wsUrl = convertToWebSocketUrl(instance.getAccessUrl());
      String token = extractTokenFromUrl(instance.getAccessUrl());
      
      // 1. 创建临时 WebSocket 连接
      GatewayClient client = new GatewayClient.Builder()
          .url(wsUrl)
          .token(token)
          .connectTimeoutMs(3000)  // 连接超时 3 秒
          .requestTimeoutMs(5000)  // 请求超时 5 秒
          .build();
      
      try {
          // 2. 建立连接并发送请求
          client.connect();
          CostUsageSummary result = client.request("usage.cost", Map.of(
              "startDate", startDate.toString(),  // "2026-04-14"
              "endDate", endDate.toString()        // "2026-04-14"
          ));
          
          // 3. 解析返回数据
          return result;
          
      } catch (Exception e) {
          log.error("Gateway usage.cost 调用失败: startDate={}, endDate={}", 
              startDate, endDate, e);
          throw new GatewayCallException("Failed to fetch cost usage", e);
          
      } finally {
          // 4. 立即关闭连接（短连接模式）
          client.close();
      }
  }
  ```
- **错误处理**：
  - 连接超时：3 秒后放弃，标记该实例为"Gateway 不可达"
  - 请求超时：5 秒后放弃，记录日志
  - 认证失败：检查 token 是否有效，连续失败 3 次告警
  - 网络异常：捕获异常并记录，不影响其他实例的轮询
- **性能考虑**：
  - 每次调用开销：约 50-100ms（包括连接建立、握手、数据传输、关闭）
  - 1000 个实例 × 每 5 分钟 = 约 8.3 次/秒的并发调用
  - 建议：使用线程池并行调用多个实例（例如 50 个并发）

**快速失败机制**：
- 连接超时：3 秒
- 读取超时：3 秒
- 失败后立即标记为 offline，不重试

#### 2.2.3 手动触发接口

**接口路径**：`POST /api/v1/admin/trigger-task`

**请求参数**：
```json
{
  "type": "session_scan" | "health_check"
}
```

**执行策略**：
- 任务互斥：如果同类型任务正在执行，返回提示信息
- 异步执行：立即返回"任务已提交"，不阻塞请求
- 无权限控制：内部使用，暂不需要认证

---

## 3. 数据库设计

### 3.1 表结构总览

| 表名 | 说明 | 主要用途 |
|------|------|----------|
| `openclaw_instances` | 用户实例表 | 存储每个用户的 Gateway 连接信息，已存在，仅用于查询数据，不可写入 |
| `dashboard_session_turn` | 会话对话单元表 | 聚合统计每个 Turn 的消息数和指标 |
| `dashboard_gateway_health_cache` | Gateway 健康状态缓存表 | 缓存所有 instance 的健康状态 |
| `dashboard_session_processing_state` | Session 处理状态表 | 记录每个文件的处理进度（last_message_id） |
| `dashboard_stats_daily` | 每日运营统计表 | 预聚合的全局/用户/技能维度统计数据，支持前端快速查询 |
| `dashboard_stats_hourly` | 每小时趋势统计表 | 按小时聚合的时间序列数据，用于热度趋势图 |

### 3.2 详细表结构

#### 3.2.1 openclaw_instances（用户实例表）
**该表已在库中存在，仅用于查询数据，不可写入**

**认证机制说明**:
OpenClaw Gateway 需要认证才能调用 RPC 方法。监控系统从该表获取认证信息：

1. **优先使用 `access_url`**: 该字段已包含完整的认证参数
   ```sql
   SELECT access_url FROM openclaw_instances WHERE id = 113;
   -- 结果: http://host:port?token=1c1d23658e3ab1fe...
   ```

2. **备用方案**: 使用 `base_url` + `encrypted_token` 构造 URL
   ```java
   String wsUrl = baseUrl.replace("/v1", "") + "?token=" + encryptedToken;
   ```

3. **URL 转换规则**: HTTP → WebSocket
   - `http://` → `ws://`
   - `https://` → `wss://`

**示例数据**: 参见 [openclaw-instances_sample-data.txt](./openclaw-instances_sample-data.txt)

```sql
CREATE TABLE IF NOT EXISTS openclaw_instances (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    uid VARCHAR(64) NOT NULL COMMENT '用户ID',
    instance_name VARCHAR(128) DEFAULT '' NOT NULL COMMENT '实例名称',
    namespace VARCHAR(64) DEFAULT 'default' COMMENT 'K8s命名空间',
    base_url VARCHAR(512) COMMENT 'API基础URL',
    node_port INT COMMENT '分配的NodePort端口',
    retry_count INT DEFAULT 0 COMMENT '重试次数',
    access_url VARCHAR(512) COMMENT '访问地址',
    encrypted_token VARCHAR(256) COMMENT '加密的认证token',
    status VARCHAR(32) DEFAULT 'creating' COMMENT '状态: creating, running, error, deleting, deleted',
    current_step VARCHAR(64) COMMENT '当前步骤',
    progress INT DEFAULT 0 COMMENT '进度百分比 0-100',
    pod_name VARCHAR(128) COMMENT '对应的Pod名称',
    deployment_ready BOOLEAN DEFAULT FALSE COMMENT 'Deployment是否就绪',
    service_ready BOOLEAN DEFAULT FALSE COMMENT 'Service是否就绪',
    pod_phase VARCHAR(32) COMMENT 'Pod状态Phase',
    pod_conditions JSON COMMENT 'Pod详细条件',
    config_json JSON COMMENT 'ConfigMap配置内容',
    deployment_json JSON COMMENT 'Deployment配置内容',
    service_json JSON COMMENT 'Service配置内容',
    user_config_json JSON COMMENT '用户配置信息',
    pod_json JSON COMMENT 'Pod配置内容（预留字段）',
    estimated_ready_time TIMESTAMP NULL COMMENT '预估就绪时间',
    last_event_time TIMESTAMP NULL COMMENT '最后事件时间',
    last_status_check TIMESTAMP NULL COMMENT '最后状态检查时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP NULL COMMENT '逻辑删除时间',
    
    INDEX idx_uid (uid),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_deleted_at (deleted_at),
    UNIQUE KEY uk_instance_name_namespace (instance_name, namespace)
) COMMENT='OpenClaw实例管理表';
```



#### 3.2.2 dashboard_session_turn（会话对话单元表）

```sql
CREATE TABLE `dashboard_session_turn` (
  `turn_id` VARCHAR(128) NOT NULL COMMENT 'Turn 唯一标识（session_id + first_message_id）',
  `session_id` VARCHAR(128) NOT NULL COMMENT '会话 ID',
  `session_key` VARCHAR(256) NOT NULL COMMENT 'Session Key（用于关联 Gateway API 数据）',
  `instance_id` VARCHAR(128) NOT NULL COMMENT '实例 ID',
  `user_id` VARCHAR(128) DEFAULT NULL COMMENT '用户 ID',
  `channel` VARCHAR(64) DEFAULT NULL COMMENT '渠道类型',
  `first_message_id` VARCHAR(128) NOT NULL COMMENT 'Turn 第一条消息 ID',
  `last_message_id` VARCHAR(128) NOT NULL COMMENT 'Turn 最后一条消息 ID',
  `start_time` DATETIME NOT NULL COMMENT 'Turn 开始时间',
  `end_time` DATETIME DEFAULT NULL COMMENT 'Turn 结束时间',
  `is_complete` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否完成: 0-进行中, 1-已完成',
  `message_count` INT NOT NULL DEFAULT 0 COMMENT '消息总数',
  `user_message_count` INT NOT NULL DEFAULT 0 COMMENT '用户消息数',
  `assistant_message_count` INT NOT NULL DEFAULT 0 COMMENT 'Assistant 消息数',
  `tool_call_count` INT NOT NULL DEFAULT 0 COMMENT '工具调用次数',
  `total_duration_ms` BIGINT DEFAULT 0 COMMENT '总耗时（毫秒）',
  `ai_duration_ms` BIGINT DEFAULT 0 COMMENT 'AI 响应总耗时（毫秒）',
  `input_tokens` INT DEFAULT 0 COMMENT '输入 Token 数（优先从 Log 解析，缺失时从 Gateway 分摊）',
  `output_tokens` INT DEFAULT 0 COMMENT '输出 Token 数（优先从 Log 解析，缺失时从 Gateway 分摊）',
  `total_tokens` INT DEFAULT 0 COMMENT '总 Token 数（优先从 Log 解析，缺失时从 Gateway 分摊）',
  `estimated_cost_cents` INT DEFAULT 0 COMMENT '预估成本（美分，优先从 Log 解析，缺失时从 Gateway 分摊）',
  `skill_ids` TEXT COMMENT '使用的 Skill ID 列表（JSON 数组，从 Session Log 解析）',
  `model_ids` TEXT COMMENT '使用的模型 ID 列表（JSON 数组，从 Session Log 解析）',
  `user_input_preview` VARCHAR(500) DEFAULT NULL COMMENT '用户输入预览（前500字符）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`turn_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_session_key` (`session_key`),
  KEY `idx_instance_id` (`instance_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_is_complete` (`is_complete`),
  KEY `idx_channel` (`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话对话单元统计表';
```

**字段说明**：
- `turn_id`: 由 `session_id + first_message_id` 组合生成，保证唯一性
- `is_complete`: 0 表示 Turn 还在进行中（等待下一条 user 消息），1 表示已完成
- `skill_ids`: JSON 数组格式，如 `["official-doc-writer", "pptx"]`
- `user_input_preview`: 截取第一条 user 消息的前 500 字符作为预览

**Turn 定义**：
- 一个 Turn 从一条 user 消息开始，到下一条 user 消息之前结束
- 包含中间所有的 assistant 消息、tool 调用等
- 最后一个 Turn 可能未完成（is_complete=0），直到收到新的 user 消息

#### 3.2.3 dashboard_gateway_health_cache（Gateway 健康状态缓存表）

```sql
CREATE TABLE `dashboard_gateway_health_cache` (
  `instance_id` VARCHAR(128) NOT NULL COMMENT '实例 ID',
  `status` VARCHAR(32) NOT NULL DEFAULT 'offline' COMMENT '状态: online/offline',
  `last_heartbeat` DATETIME DEFAULT NULL COMMENT '最后心跳时间（从 agents[0].heartbeat.lastBeat 获取）',
  `last_check_time` DATETIME NOT NULL COMMENT '最后检查时间',
  `version` VARCHAR(64) DEFAULT NULL COMMENT 'OpenClaw 版本（Health API 不返回此字段，保留为 NULL）',
  `channels_total` INT DEFAULT 0 COMMENT '渠道总数（Health API 不返回此字段，保留为 0）',
  `agents_total` INT DEFAULT 0 COMMENT 'Agent 总数（Health API 不返回此字段，保留为 0）',
  `memory_rss_mb` INT DEFAULT 0 COMMENT '内存占用 MB（Health API 不返回此字段，保留为 0）',
  `error_message` VARCHAR(512) DEFAULT NULL COMMENT '错误信息',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`instance_id`),
  KEY `idx_status` (`status`),
  KEY `idx_last_check_time` (`last_check_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Gateway 健康状态缓存表';
```

**字段说明**：
- `status`: online 表示 Gateway 可达，offline 表示不可达
- `last_heartbeat`: 从 Health API 响应中获取的最后心跳时间
- `last_check_time`: 本地最后一次健康检查的时间
- `version`, `channels_total`, `agents_total`, `memory_rss_mb`: 从 Health API 响应中提取的详细指标
- `error_message`: 如果检查失败，记录错误原因

#### 3.2.4 dashboard_session_processing_state（Session 处理状态表）

```sql
CREATE TABLE `dashboard_session_processing_state` (
  `file_path_hash` VARCHAR(64) NOT NULL COMMENT '文件路径的 SHA256 Hash',
  `file_path` VARCHAR(1024) NOT NULL COMMENT '文件完整路径',
  `last_message_id` VARCHAR(128) DEFAULT NULL COMMENT '最后处理的消息 ID',
  `last_processed_time` DATETIME DEFAULT NULL COMMENT '最后处理时间',
  `file_size` BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
  `file_modified_time` DATETIME DEFAULT NULL COMMENT '文件修改时间',
  `processed_count` BIGINT DEFAULT 0 COMMENT '累计处理的消息数',
  `compaction_count` INT DEFAULT 0 COMMENT 'Compaction 记录数量，用于检测新的 compaction',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`file_path_hash`),
  KEY `idx_file_path` (`file_path`(255)),
  KEY `idx_last_processed_time` (`last_processed_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Session 文件处理状态表';
```

**字段说明**：
- `file_path_hash`: 文件路径的 SHA256 Hash，作为主键避免长字符串索引
- `last_message_id`: 记录该文件最后处理到的消息 ID，用于增量处理
- `file_size`, `file_modified_time`: 用于快速判断文件是否有变化
- `compaction_count`: 记录该文件中 compaction 记录的数量，用于检测新的 compaction 事件（主要检测方式）

#### 3.2.5 dashboard_stats_daily（每日运营统计表）

**设计目的**：预聚合每日统计数据，支持前端运营大盘接口快速查询。

**数据生成方式**：采用**混合数据源方案**
- **Token/Cost/Model 统计**：从 Gateway `usage.cost` API 轮询获取（权威数据源，但只提供全局总计）
- **Skill/Turn 统计**：从 `dashboard_session_turn` 表聚合（Session Log 解析结果）

```sql
CREATE TABLE `dashboard_stats_daily` (
  `stat_date` DATE NOT NULL COMMENT '统计日期',
  `dimension_type` VARCHAR(32) NOT NULL COMMENT '维度类型: global/user/skill/channel/model',
  `dimension_key` VARCHAR(128) NOT NULL COMMENT '维度键值: user_id/skill_id/channel/model_id',
  `dimension_name` VARCHAR(256) DEFAULT NULL COMMENT '维度名称（如技能中文名、渠道中文名）',
  
  `turn_count` INT NOT NULL DEFAULT 0 COMMENT 'Turn 数量',
  `message_count` INT NOT NULL DEFAULT 0 COMMENT '消息总数',
  `user_message_count` INT NOT NULL DEFAULT 0 COMMENT '用户消息数',
  `assistant_message_count` INT NOT NULL DEFAULT 0 COMMENT 'Assistant 消息数',
  `tool_call_count` INT NOT NULL DEFAULT 0 COMMENT '工具调用次数',
  
  `total_tokens` BIGINT NOT NULL DEFAULT 0 COMMENT '总 Token 数',
  `input_tokens` BIGINT NOT NULL DEFAULT 0 COMMENT '输入 Token 数',
  `output_tokens` BIGINT NOT NULL DEFAULT 0 COMMENT '输出 Token 数',
  `estimated_cost_cents` BIGINT NOT NULL DEFAULT 0 COMMENT '预估成本（美分）',
  
  `avg_duration_ms` BIGINT DEFAULT 0 COMMENT '平均耗时（毫秒）',
  `avg_ai_duration_ms` BIGINT DEFAULT 0 COMMENT '平均 AI 响应耗时（毫秒）',
  
  `unique_users` INT DEFAULT 0 COMMENT '独立用户数（仅 global 维度有效）',
  `online_instances` INT DEFAULT 0 COMMENT '在线实例数（从 health_cache 获取）',
  `offline_instances` INT DEFAULT 0 COMMENT '离线实例数（从 health_cache 获取）',
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`stat_date`, `dimension_type`, `dimension_key`),
  KEY `idx_stat_date` (`stat_date`),
  KEY `idx_dimension_type` (`dimension_type`),
  KEY `idx_dimension_key` (`dimension_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日运营统计表';
```

**字段说明**：
- `dimension_type`: 区分不同维度的统计数据
  - `global`: 全局汇总（dimension_key = "all"）
  - `user`: 按用户维度（dimension_key = user_id）
  - `skill`: 按技能维度（dimension_key = skill_id）
  - `channel`: 按渠道维度（dimension_key = channel）
  - `model`: 按模型维度（dimension_key = model_id）
- `dimension_name`: 用于前端展示的可读名称（如“公文写作”、“Discord”）
- `unique_users`: 仅在 global 维度有意义，表示当天的独立用户数
- `online_instances`, `offline_instances`: 仅在 global 维度有意义，从 `gateway_health_cache` 表获取

**数据更新策略**：

**Gateway Token 数据轮询任务（每 5 分钟执行）**：

**设计思路**：直接调用 `usage.cost` API 获取指定日期范围的 Token 统计数据，无需维护快照表

```java
@Scheduled(cron = "0 */5 * * * ?") // 每 5 分钟执行
public void pollGatewayTokenStats() {
    // 1. 计算要查询的日期范围（最近 1 小时的数据）
    LocalDateTime now = LocalDateTime.now();
    LocalDate today = now.toLocalDate();
    
    List<OpenclawInstance> instances = instanceRepository.findByStatus("running");
    
    for (OpenclawInstance instance : instances) {
        try {
            // 2. 调用 Gateway usage.cost API 获取今日数据
            CostUsageSummary summary = gatewayClient.fetchCostUsage(today, today);
            
            if (summary == null || summary.getTotals() == null) {
                log.warn("未获取到 Token 数据: instance={}", instance.getInstanceId());
                continue;
            }
            
            // 3. 提取总计数据
            CostUsageTotals totals = summary.getTotals();
            
            // 4. 写入小时统计表（使用 INSERT ... ON DUPLICATE KEY UPDATE）
            statsRepository.upsertHourlyTokenStats(
                now.withMinute(0).withSecond(0),  // 当前小时的起始时间
                "global", "all",
                totals.getInput(),
                totals.getOutput(),
                totals.getTotalTokens(),
                convertToCents(totals.getTotalCost())
            );
            
            // 5. 按用户维度写入（需要从 daily 数据中拆分，但 usage.cost 不支持 user 维度）
            // 注意：usage.cost 只提供全局总计，不提供 user/channel/model 维度
            // 这些维度仍需从 Session Log 解析后聚合
            
            log.info("Gateway Token 数据同步完成: instance={}, totalTokens={}, totalCost={}", 
                     instance.getInstanceId(), 
                     totals.getTotalTokens(),
                     totals.getTotalCost());
        } catch (Exception e) {
            log.error("Gateway Token 数据同步失败: instance={}", instance.getInstanceId(), e);
        }
    }
}
```

**关键变化**：
1. ✅ **不再需要 `dashboard_session_token_snapshot` 表** - `usage.cost` 直接返回累计值
2. ✅ **简化逻辑** - 无需计算增量，直接使用 API 返回的 `totals`
3. ⚠️ **维度限制** - `usage.cost` 只提供全局总计，不提供 user/channel/model 细分
4. ✅ **更准确** - 直接从 Gateway 内部统计获取，避免 Session Log 解析误差
```



**策略 B：Session Turn 数据聚合**（每小时第 30 分钟执行）
```java
// Session 扫描任务完成后触发 Skill/Turn 统计聚合
@Scheduled(cron = "0 30 * * * ?") // 每小时第 30 分钟执行
public void refreshDailyStatsFromTurns() {
    LocalDate today = LocalDate.now();
    
    // 1. 计算技能维度统计数据（从 dashboard_session_turn 聚合）
    refreshSkillStats(today);
    
    // 2. 计算渠道维度统计数据（从 dashboard_session_turn 聚合）
    refreshChannelStats(today);
    
    // 3. 合并 Gateway Token 数据和 Session Turn 数据
    mergeTokenAndTurnStats(today);
    
    log.info("每日运营统计数据刷新完成: date={}", today);
}
```

**数据来源分工**：
| 统计维度 | 数据来源 | 更新频率 | 说明 |
|---------|---------|---------|------|
| Token 消耗 | Gateway usage.cost API | 每 5 分钟 | 权威数据源，直接返回累计值 |
| Cost 成本 | Gateway usage.cost API | 每 5 分钟 | 基于实际计费模型计算 |
| Model 使用 | dashboard_session_turn | 每小时 | 从 Session Log 解析（usage.cost 不提供 model 维度） |
| Skill 调用 | dashboard_session_turn | 每小时 | 从 Session Log 解析 |
| Turn 数量 | dashboard_session_turn | 每小时 | 从 Session Log 解析 |
| Channel 分布 | dashboard_session_turn | 每小时 | 从 Session Log 解析（usage.cost 不提供 channel 维度） |
| User 维度 | dashboard_session_turn | 每小时 | 从 Session Log 解析（usage.cost 不提供 user 维度） |

**Turn 级别 Token 分摊策略（可选优化）**：

当 Session Log 解析失败或消息缺少 usage 字段时，可按比例从 `usage.cost` API 的全局数据分摊到各个 Turn：

```java
/**
 * 如果 Turn 级别的 Token 数据缺失，从 usage.cost API 的全局数据按比例分摊
 */
private void distributeGlobalTokensToTurns(LocalDate date, List<TurnAggregate> turns) {
    // 1. 从 Gateway 获取全局 Token 总数
    CostUsageSummary summary = gatewayClient.fetchCostUsage(date, date);
    if (summary == null || summary.getTotals() == null) {
        return; // 无法分摊，保持为 0
    }
    
    long globalTotalTokens = summary.getTotals().getTotalTokens();
    
    // 2. 检查是否已有 Turn 级别的 Token 数据
    long existingTurnTokens = turns.stream()
        .mapToLong(t -> t.getTotalTokens() != null ? t.getTotalTokens() : 0)
        .sum();
    
    // 3. 如果已有数据且接近全局总数，说明 Log 解析成功，不需要分摊
    if (existingTurnTokens > 0 && Math.abs(existingTurnTokens - globalTotalTokens) < 100) {
        log.debug("Turn 级别 Token 数据完整，无需分摊: date={}", date);
        return;
    }
    
    // 4. 按消息数比例分摊
    long totalMessages = turns.stream().mapToInt(TurnAggregate::getMessageCount).sum();
    if (totalMessages == 0) {
        return;
    }
    
    for (TurnAggregate turn : turns) {
        if (turn.getTotalTokens() == null || turn.getTotalTokens() == 0) {
            // 按比例分摊
            double ratio = (double) turn.getMessageCount() / totalMessages;
            turn.setTotalTokens((int) (globalTotalTokens * ratio));
            // input/output 也按比例分摊
            turn.setInputTokens((int) (summary.getTotals().getInput() * ratio));
            turn.setOutputTokens((int) (summary.getTotals().getOutput() * ratio));
            turn.setEstimatedCostCents((int) (convertToCents(summary.getTotals().getTotalCost()) * ratio));
        }
    }
    
    log.info("Token 分摊完成: date={}, globalTotal={}, distributed={}", 
        date, globalTotalTokens, 
        turns.stream().mapToLong(TurnAggregate::getTotalTokens).sum());
}
```

#### 3.2.6 dashboard_stats_hourly（每小时趋势统计表）

**设计目的**：预聚合每小时统计数据，支持前端趋势图接口快速查询。

**数据生成方式**：与 `dashboard_stats_daily` 相同，采用**混合数据源方案**
- **Token/Cost/Model 统计**：从 Gateway `usage.cost` API 轮询获取（但只提供全局总计，不包含 user/channel/model 维度）
- **Skill/Turn 统计**：从 `dashboard_session_turn` 表聚合

```sql
CREATE TABLE `dashboard_stats_hourly` (
  `bucket_time` DATETIME NOT NULL COMMENT '时间桶（精确到小时）',
  `dimension_type` VARCHAR(32) NOT NULL COMMENT '维度类型: global/user/skill',
  `dimension_key` VARCHAR(128) NOT NULL COMMENT '维度键值',
  
  `turn_count` INT NOT NULL DEFAULT 0 COMMENT 'Turn 数量',
  `message_count` INT NOT NULL DEFAULT 0 COMMENT '消息总数',
  `total_tokens` BIGINT NOT NULL DEFAULT 0 COMMENT '总 Token 数',
  `estimated_cost_cents` BIGINT NOT NULL DEFAULT 0 COMMENT '预估成本（美分）',
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`bucket_time`, `dimension_type`, `dimension_key`),
  KEY `idx_bucket_time` (`bucket_time`),
  KEY `idx_dimension_type` (`dimension_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每小时趋势统计表';
```

**字段说明**：
- `bucket_time`: 时间桶，精确到小时（例如：2026-04-15 10:00:00）
- 其他字段含义与 `dashboard_stats_daily` 相同

**数据更新策略**：

**策略 A：Gateway Token 数据实时更新**（每 5 分钟执行一次）
```java
// 从 Gateway usage.cost API 获取 Token 统计数据
@Scheduled(cron = "0 */5 * * * ?") // 每 5 分钟执行
public void pollGatewayTokenStats() {
    LocalDate today = LocalDate.now();
    List<OpenclawInstance> instances = instanceRepository.findByStatus("running");
    
    for (OpenclawInstance instance : instances) {
        try {
            // 1. 调用 Gateway usage.cost API
            CostUsageSummary summary = gatewayClient.fetchCostUsage(today, today);
            
            if (summary == null || summary.getTotals() == null) {
                continue;
            }
            
            // 2. 提取总计数据
            CostUsageTotals totals = summary.getTotals();
            LocalDateTime currentHour = LocalDateTime.now().withMinute(0).withSecond(0);
            
            // 3. 写入 hourly 统计表（使用 INSERT ... ON DUPLICATE KEY UPDATE 实现幂等性）
            statsRepository.upsertHourlyTokenStats(
                currentHour,
                "global", "all",
                totals.getInput(),
                totals.getOutput(),
                totals.getTotalTokens(),
                convertToCents(totals.getTotalCost())
            );
            
            log.info("Gateway Token 数据同步完成: instance={}, totalTokens={}", 
                     instance.getInstanceId(), totals.getTotalTokens());
        } catch (Exception e) {
            log.error("Gateway Token 数据同步失败: instance={}", 
                     instance.getInstanceId(), e);
        }
    }
}
```

**重要说明**：
- `usage.cost` API **不支持**按 user/channel/model 维度拆分
- 这些维度的 Token 统计仍需从 Session Log 解析后聚合
- `usage.cost` 只提供全局总计，适合宏观监控

**策略 B：Session Turn 数据聚合**（每小时第 30 分钟执行）
```java
// Session 扫描任务完成后触发 Skill/Turn 统计聚合
@Scheduled(cron = "0 30 * * * ?") // 每小时第 30 分钟执行
public void refreshHourlyStatsFromTurns() {
    LocalDateTime currentHour = LocalDateTime.now().withMinute(0).withSecond(0);
    
    // 1. 计算技能维度统计数据（从 dashboard_session_turn 聚合）
    refreshSkillHourlyStats(currentHour);
    
    // 2. 计算渠道维度统计数据（从 dashboard_session_turn 聚合）
    refreshChannelHourlyStats(currentHour);
    
    // 3. 合并 Gateway Token 数据和 Session Turn 数据
    mergeTokenAndTurnHourlyStats(currentHour);
    
    log.info("每小时运营统计数据刷新完成: bucket_time={}", currentHour);
}
```

**使用场景**：
- 前端趋势图：查询最近 24 小时 / 7 天的 Token 消耗趋势
- 热度分析：查看哪个时间段最活跃
- 实时监控：每 5 分钟更新一次 Token 数据，提供近实时统计

---

## 4. API 接口定义

### 4.1 接口总览

| 模块 | 接口路径 | 方法 | 说明 |
|------|----------|------|------|
| **下拉列表** | `/api/v1/skills/options` | GET | 获取技能下拉列表 |
| **运营大盘** | `/api/v1/global-stats` | GET | 全局统计数据 |
| | `/api/v1/summary` | GET | 汇总统计（支持多维度） |
| | `/api/v1/trend` | GET | 趋势数据 |
| | `/api/v1/usersummary` | GET | 用户维度统计 |
| **对话检索** | `/api/v1/turns/search` | POST | 搜索对话记录 |
| | `/api/v1/turns/{turnId}/trace` | GET | 获取对话链路详情 |
| **管理接口** | `/api/v1/admin/trigger-task` | POST | 手动触发定时任务 |

### 4.2 详细接口定义

#### 4.2.1 获取技能下拉列表

**接口**: `GET /api/v1/skills/options`

**说明**: 获取技能下拉列表数据字典

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "skillId": "official-doc-writer", "skillName": "公文写作" },
    { "skillId": "pptx", "skillName": "PPT生成" },
    { "skillId": "code-review", "skillName": "代码审查" }
  ]
}
```

---

#### 4.2.2 全局统计数据

**接口**: `GET /api/v1/global-stats`

**说明**: 获取全局运营统计数据

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| dateFrom | String | 是 | 开始日期，格式 YYYY-MM-DD |
| dateTo | String | 是 | 结束日期，格式 YYYY-MM-DD |

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "totalUsers": 1250,
    "totalSessions": 8500,
    "totalTurns": 45000,
    "totalMessages": 180000,
    "totalTokens": 95000000,
    "totalCostCents": 125000,
    "avgTurnsPerSession": 5.29,
    "avgMessagesPerTurn": 4.0,
    "onlineInstances": 980,
    "offlineInstances": 270
  }
}
```

---

#### 4.2.3 汇总统计

**接口**: `GET /api/v1/summary`

**说明**: 获取多维度汇总统计数据

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| dateFrom | String | 是 | 开始日期 |
| dateTo | String | 是 | 结束日期 |
| groupBy | String | 否 | 分组维度：skill/channel/user/model，默认 skill |

**响应**（以 skill 分组为例）:
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "groupKey": "official-doc-writer",
      "groupName": "公文写作",
      "turnCount": 12000,
      "messageCount": 48000,
      "tokenCount": 25000000,
      "costCents": 35000,
      "avgDurationMs": 3500
    },
    {
      "groupKey": "pptx",
      "groupName": "PPT生成",
      "turnCount": 8000,
      "messageCount": 32000,
      "tokenCount": 18000000,
      "costCents": 28000,
      "avgDurationMs": 5200
    }
  ]
}
```
```

---

#### 4.2.4 趋势数据

**接口**: `GET /api/v1/trend`

**说明**: 获取时间序列趋势数据

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| dateFrom | String | 是 | 开始日期 |
| dateTo | String | 是 | 结束日期 |
| granularity | String | 否 | 粒度：day/hour，默认 day |
| metric | String | 否 | 指标：turns/messages/tokens/cost，默认 turns |

**响应**（按天统计 turns）:
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "timePoint": "2026-04-01",
      "value": 1500
    },
    {
      "timePoint": "2026-04-02",
      "value": 1680
    },
    {
      "timePoint": "2026-04-03",
      "value": 1420
    }
  ]
}
```
```

---

#### 4.2.5 用户维度统计

**接口**: `GET /api/v1/usersummary`

**说明**: 获取用户维度的统计数据

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| dateFrom | String | 是 | 开始日期 |
| dateTo | String | 是 | 结束日期 |
| page | Integer | 否 | 页码，默认 1 |
| pageSize | Integer | 否 | 每页数量，默认 20 |
| sortBy | String | 否 | 排序字段：turns/messages/tokens/cost，默认 turns |
| sortOrder | String | 否 | 排序方向：asc/desc，默认 desc |

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 1250,
    "page": 1,
    "pageSize": 20,
    "items": [
      {
        "userId": "user_001",
        "instanceId": "inst_abc123",
        "turnCount": 450,
        "messageCount": 1800,
        "tokenCount": 950000,
        "costCents": 1250,
        "lastActiveTime": "2026-04-14T15:30:00Z",
        "gatewayStatus": "online"
      }
    ]
  }
}
```

---

#### 4.2.6 搜索对话记录

**接口**: `POST /api/v1/turns/search`

**说明**: 根据条件搜索对话记录

**请求体**:
```json
{
  "dateFrom": "2026-04-01",
  "dateTo": "2026-04-14",
  "userId": "user_001",
  "instanceId": "inst_abc123",
  "skillId": "official-doc-writer",
  "channel": "discord",
  "keyword": "公文",
  "page": 1,
  "pageSize": 20,
  "sortBy": "start_time",
  "sortOrder": "desc"
}
```

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 156,
    "page": 1,
    "pageSize": 20,
    "items": [
      {
        "turnId": "sess_xyz_first_msg_001",
        "sessionId": "sess_xyz",
        "userId": "user_001",
        "instanceId": "inst_abc123",
        "channel": "discord",
        "startTime": "2026-04-14T10:30:00Z",
        "endTime": "2026-04-14T10:35:00Z",
        "isComplete": true,
        "messageCount": 8,
        "userMessageCount": 2,
        "assistantMessageCount": 6,
        "totalDurationMs": 4500,
        "aiDurationMs": 3200,
        "totalTokens": 5600,
        "estimatedCostCents": 8,
        "skillIds": ["official-doc-writer"],
        "modelIds": ["sonnet-4.6"],
        "userInputPreview": "帮我写一份关于..."
      }
    ]
  }
}
```

---

#### 4.2.7 获取对话链路详情

**接口**: `GET /api/v1/turns/{turnId}/trace`

**说明**: 获取指定 Turn 的完整消息链路

**路径参数**:
- `turnId`: Turn 的唯一标识

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "turnId": "sess_xyz_first_msg_001",
    "sessionId": "sess_xyz",
    "messages": [
      {
        "messageId": "msg_001",
        "role": "user",
        "content": "帮我写一份关于...",
        "timestamp": "2026-04-14T10:30:00Z",
        "durationMs": null,
        "tokens": null,
        "costCents": null,
        "skillId": null,
        "modelId": null,
        "toolCalls": []
      },
      {
        "messageId": "msg_002",
        "role": "assistant",
        "content": "好的，我来帮您...",
        "timestamp": "2026-04-14T10:30:05Z",
        "durationMs": 3200,
        "tokens": {
          "input": 1200,
          "output": 800,
          "total": 2000
        },
        "costCents": 3,
        "skillId": "official-doc-writer",
        "modelId": "sonnet-4.6",
        "toolCalls": []
      },
      {
        "messageId": "msg_003",
        "role": "assistant",
        "content": "",
        "timestamp": "2026-04-14T10:30:08Z",
        "durationMs": 1500,
        "tokens": {
          "input": 2100,
          "output": 150,
          "total": 2250
        },
        "costCents": 2,
        "skillId": null,
        "modelId": "sonnet-4.6",
        "toolCalls": [
          {
            "toolName": "search_web",
            "arguments": "{\"query\": \"公文写作规范\"}",
            "result": "..."
          }
        ]
      }
    ],
    "statistics": {
      "messageCount": 8,
      "userMessageCount": 2,
      "assistantMessageCount": 6,
      "toolCallCount": 3,
      "totalDurationMs": 4500,
      "aiDurationMs": 3200,
      "totalTokens": 5600,
      "estimatedCostCents": 8
    }
  }
}
```

---

#### 4.2.8 手动触发定时任务

**接口**: `POST /api/v1/admin/trigger-task`

**说明**: 手动触发 Session 扫描或健康检查任务

**请求体**:
```json
{
  "type": "session_scan"
}
```

**type 可选值**:
- `session_scan`: 触发 Session Log 扫描任务
- `health_check`: 触发 Gateway 健康检查任务

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "taskId": "task_20260415_001",
    "type": "session_scan",
    "status": "submitted",
    "message": "任务已提交"
  }
}
```

**任务执行中时的响应**:
```json
{
  "code": 409,
  "message": "conflict",
  "data": {
    "taskId": "task_20260415_001",
    "type": "session_scan",
    "status": "running",
    "message": "同类型任务正在执行中，请稍后重试"
  }
}
```
```

---

### 4.3 统一错误响应格式

所有 API 接口在出错时返回以下格式：

```json
{
  "code": 400,
  "message": "Invalid request parameters",
  "data": null,
  "errors": [
    {
      "field": "dateFrom",
      "message": "Must be in YYYY-MM-DD format"
    }
  ]
}
```

**常见错误码**：
| 错误码 | 说明 | 示例场景 |
|--------|------|----------|
| 400 | 参数错误 | 日期格式不正确、必填参数缺失 |
| 404 | 资源不存在 | turnId 不存在 |
| 409 | 冲突 | 任务正在执行中 |
| 500 | 服务器内部错误 | 数据库连接失败、NFS 挂载异常 |

---

## 5. 核心代码示例

### 5.1 Session Log 扫描任务

```java
@Component
@Slf4j
public class SessionScanTask {
    
    @Autowired
    private SessionProcessingStateRepository stateRepository;
    
    @Autowired
    private SessionTurnRepository turnRepository;
    
    @Value("${monitoring.session.scan.cron:0 0 * * * ?}")
    private String scanCron;
    
    @Value("${monitoring.session.scan.nfs-mount-path:/mnt/session-logs}")
    private String nfsMountPath;
    
    @Value("${monitoring.session.scan.path-pattern:instances/*/agents/*/sessions/*.jsonl}")
    private String pathPattern;
    
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    
    /**
     * 定时执行 Session 扫描
     */
    @Scheduled(cron = "${monitoring.session.scan.cron:0 0 * * * ?}")
    public void scheduledScan() {
        if (!isRunning.compareAndSet(false, true)) {
            log.warn("Session 扫描任务已在执行中，跳过本次调度");
            return;
        }
        
        try {
            log.info("开始执行 Session Log 扫描任务");
            executeScan();
            log.info("Session Log 扫描任务执行完成");
        } catch (Exception e) {
            log.error("Session Log 扫描任务执行失败", e);
        } finally {
            isRunning.set(false);
        }
    }
    
    /**
     * 手动触发扫描
     */
    public TaskResult triggerManualScan() {
        if (!isRunning.compareAndSet(false, true)) {
            return TaskResult.conflict("session_scan", "同类型任务正在执行中");
        }
        
        CompletableFuture.runAsync(() -> {
            try {
                executeScan();
            } finally {
                isRunning.set(false);
            }
        });
        
        return TaskResult.submitted("session_scan");
    }
    
    private void executeScan() {
        // 1. 获取所有需要处理的 Session Log 文件
        List<File> sessionFiles = findSessionLogFiles();
        
        log.info("找到 {} 个 Session Log 文件，开始处理", sessionFiles.size());
        
        // 2. 并行处理文件（使用线程池，默认 10 个并发）
        ExecutorService fileExecutor = Executors.newFixedThreadPool(10, r -> {
            Thread t = new Thread(r, "session-scan-worker");
            t.setDaemon(true);
            return t;
        });
        
        try {
            List<CompletableFuture<Void>> futures = sessionFiles.stream()
                .map(file -> CompletableFuture.runAsync(() -> {
                    try {
                        processSessionFile(file);
                    } catch (Exception e) {
                        log.error("处理文件失败: {}", file.getAbsolutePath(), e);
                    }
                }, fileExecutor))
                .collect(Collectors.toList());
            
            // 等待所有文件处理完成（最多 30 分钟）
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                .get(30, TimeUnit.MINUTES);
            
            log.info("所有 Session Log 文件处理完成");
        } catch (TimeoutException e) {
            log.warn("Session 扫描超时，部分文件可能未处理完成");
            futures.forEach(f -> f.cancel(true));
        } catch (Exception e) {
            log.error("Session 扫描执行失败", e);
        } finally {
            fileExecutor.shutdown();
            try {
                if (!fileExecutor.awaitTermination(10, TimeUnit.SECONDS)) {
                    fileExecutor.shutdownNow();
                }
            } catch (InterruptedException e) {
                fileExecutor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
    
    /**
     * 扫描 NFS 挂载目录下的所有 Session Log 文件
     */
    private List<File> findSessionLogFiles() {
        List<File> files = new ArrayList<>();
        Path basePath = Paths.get(nfsMountPath);
        
        if (!Files.exists(basePath)) {
            log.warn("NFS 挂载路径不存在: {}", nfsMountPath);
            return files;
        }
        
        try {
            // 使用 glob 模式匹配文件
            String globPattern = basePath.resolve(pathPattern).toString();
            
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(
                    basePath, 
                    path -> matchPattern(path, basePath, pathPattern))) {
                
                for (Path path : stream) {
                    if (Files.isRegularFile(path) && path.toString().endsWith(".jsonl")) {
                        files.add(path.toFile());
                    }
                }
            }
            
            log.debug("扫描到 {} 个 Session Log 文件", files.size());
            
        } catch (IOException e) {
            log.error("扫描 Session Log 文件失败", e);
        }
        
        return files;
    }
    
    /**
     * 匹配路径模式（简化版 glob）
     * 支持：instances/*/agents/*/sessions/*.jsonl
     */
    private boolean matchPattern(Path path, Path basePath, String pattern) {
        String relativePath = basePath.relativize(path).toString();
        
        // 检查是否符合预期模式：instances/{instanceId}/agents/{agentId}/sessions/{fileName}.jsonl
        String[] parts = relativePath.split("/");
        
        if (parts.length != 5) {
            return false;
        }
        
        return "instances".equals(parts[0]) 
            && "agents".equals(parts[2]) 
            && "sessions".equals(parts[3])
            && parts[4].endsWith(".jsonl");
    }
    
    /**
     * 从文件路径中提取 instance_id
     */
    private String extractInstanceIdFromPath(String filePath) {
        // 例如：/mnt/session-logs/instances/instance-001/agents/main/sessions/abc.jsonl
        String[] parts = filePath.split("/");
        
        for (int i = 0; i < parts.length; i++) {
            if ("instances".equals(parts[i]) && i + 1 < parts.length) {
                return parts[i + 1];
            }
        }
        
        return null;
    }
    
    private void processSessionFile(File file) throws IOException {
        String filePath = file.getAbsolutePath();
        String fileHash = DigestUtils.sha256Hex(filePath);
        
        // 2. 检查文件是否有变化
        SessionProcessingState state = stateRepository.findByFilePathHash(fileHash);
        if (state != null && !hasFileChanged(file, state)) {
            log.debug("文件未变化，跳过: {}", filePath);
            return;
        }
        
        // 3. 第一遍扫描：统计 compaction 记录数量（主要检测方式）
        int currentCompactionCount = countCompactionEntries(file);
        int storedCompactionCount = state != null ? state.getCompactionCount() : 0;
        
        // 4. 检测是否有新的 compaction
        boolean hasNewCompaction = currentCompactionCount > storedCompactionCount;
        
        // 5. 备用检测：文件大小缩小超过 10%（用于兜底）
        if (!hasNewCompaction && state != null) {
            long currentSize = file.length();
            long previousSize = state.getFileSize();
            if (previousSize > 0 && currentSize < previousSize * 0.9) {
                log.warn("检测到文件大小显著缩小: {}, 之前={} bytes, 当前={} bytes, 缩小={:.1f}%",
                    filePath, previousSize, currentSize, 
                    (1 - (double)currentSize / previousSize) * 100);
                hasNewCompaction = true;
            }
        }
        
        // 6. 如果检测到新的 compaction，触发全量重扫
        String lastMessageId = state != null ? state.getLastMessageId() : null;
        if (hasNewCompaction) {
            log.info("检测到新的 compaction: {}, 旧计数={}, 新计数={}", 
                filePath, storedCompactionCount, currentCompactionCount);
            
            // 重置 last_message_id，触发全量重扫
            lastMessageId = null;
            
            // 清理该 session 的未完成 Turn 记录
            String sessionId = extractSessionIdFromPath(filePath);
            if (sessionId != null) {
                cleanupIncompleteTurns(sessionId);
            }
        }
        
        // 7. 第二遍扫描：流式处理 + 分批写入数据库（同时统计 compaction_count）
        TurnAggregate lastTurn = streamProcessAndBatchWrite(file, lastMessageId);
        
        // 8. Token 实时同步：解析完成后调用 Gateway 获取整个 instance 的 Token 数据
        // 注意：为避免重复调用，只在处理第一个文件时同步，或添加去重逻辑
        if (lastTurn != null && shouldSyncToken(filePath)) {
            String instanceId = extractInstanceIdFromPath(filePath);
            try {
                syncTokenData(instanceId);
                syncedInstances.add(instanceId);  // 标记为已同步
            } catch (Exception e) {
                log.warn("Token 同步失败: instance={}, 将在下次扫描重试", instanceId, e);
                // 不阻断流程，继续更新处理状态
            }
        }
        
        // 9. 更新处理状态（包括 compaction_count）
        if (lastTurn != null) {
            updateProcessingState(fileHash, filePath, file, lastTurn.getLastMessageId(), lastTurn.getCompactionCount());
        }
    }
    
    private boolean hasFileChanged(File file, SessionProcessingState state) {
        long currentSize = file.length();
        long currentTime = file.lastModified();
        
        return currentSize != state.getFileSize() || 
               currentTime != state.getFileModifiedTime().getTime();
    }
    
    /**
     * 判断是否需要同步 Token 数据
     * 为避免重复调用，只在处理每个 instance 的第一个文件时同步
     */
    private boolean shouldSyncToken(String filePath) {
        // 简单策略：提取 instance_id，检查该 instance 是否已在本轮扫描中同步过
        String instanceId = extractInstanceIdFromPath(filePath);
        // 可以使用 ThreadLocal 或 ConcurrentHashMap 记录已同步的 instance
        return !syncedInstances.contains(instanceId);
    }
    
    private final Set<String> syncedInstances = ConcurrentHashMap.newKeySet();
    
    /**
     * 流式处理 JSONL 文件，分批写入数据库
     * 内存中只保留当前正在构建的 Turn 和一个小的写入批次
     * 
     * @return 最后处理的 Turn，用于更新处理状态
     */
    private TurnAggregate streamProcessAndBatchWrite(File file, String lastMessageId) throws IOException {
        List<TurnAggregate> batch = new ArrayList<>();
        int batchSize = 100; // 每 100 条 Turn 写入一次
        TurnAggregate lastTurn = null;
        TurnBuilder builder = new TurnBuilder();
        
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) {
                    continue;
                }
                
                try {
                    JsonNode message = objectMapper.readTree(line);
                    String messageId = message.get("id").asText();
                    
                    // 跳过已处理的消息
                    if (lastMessageId != null && messageId.compareTo(lastMessageId) <= 0) {
                        continue;
                    }
                    
                    // 构建 Turn
                    builder.addMessage(message);
                    
                    // 如果遇到新的 user 消息，完成当前 Turn
                    if ("user".equals(message.get("role").asText()) && builder.hasCurrentTurn()) {
                        TurnAggregate completedTurn = builder.completeCurrentTurn();
                        if (completedTurn != null) {
                            batch.add(completedTurn);
                            lastTurn = completedTurn;
                            
                            // 达到批次大小，写入数据库
                            if (batch.size() >= batchSize) {
                                turnRepository.batchUpsert(batch);
                                batch.clear();
                            }
                        }
                    }
                } catch (Exception e) {
                    // 忽略解析错误的行
                    log.debug("解析行失败: {}", line, e);
                }
            }
        }
        
        // 处理最后一个未完成的 Turn（文件末尾可能没有新的 user 消息）
        if (builder.hasCurrentTurn()) {
            TurnAggregate lastIncompleteTurn = builder.completeCurrentTurn();
            if (lastIncompleteTurn != null) {
                batch.add(lastIncompleteTurn);
                lastTurn = lastIncompleteTurn;
            }
        }
        
        // 写入剩余的 Turn
        if (!batch.isEmpty()) {
            turnRepository.batchUpsert(batch);
        }
        
        return lastTurn;
    }
    
    /**
     * Compaction 计数已移至 streamProcessAndBatchWrite 中同步进行，避免两遍完整扫描
     * 此方法保留用于备用检测逻辑
     */
    @Deprecated
    private int countCompactionEntries(File file) throws IOException {
        int count = 0;
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) {
                    continue;
                }
                try {
                    JsonNode entry = objectMapper.readTree(line);
                    if ("compaction".equals(entry.path("type").asText())) {
                        count++;
                    }
                } catch (Exception e) {
                    // 忽略解析错误的行
                    log.debug("解析行失败: {}", line, e);
                }
            }
        }
        return count;
    }
    
    /**
     * 从文件路径中提取 session_id
     * 例如：/mnt/session-logs/instances/instance-001/agents/main/sessions/abc-123.jsonl
     * 返回：abc-123
     */
    private String extractSessionIdFromPath(String filePath) {
        String fileName = new File(filePath).getName();
        // 移除 .jsonl 后缀
        if (fileName.endsWith(".jsonl")) {
            return fileName.substring(0, fileName.length() - 6);
        }
        return fileName;
    }
    
    /**
     * 清理指定 session 的未完成 Turn 记录
     * Compaction 后，未完成的 Turn 可能引用了已被删除的消息，需要清理
     */
    private void cleanupIncompleteTurns(String sessionId) {
        int deleted = turnRepository.deleteBySessionIdAndIsComplete(sessionId, false);
        if (deleted > 0) {
            log.info("清理 session {} 的未完成 Turn 记录: {} 条", sessionId, deleted);
        }
    }
    
    /**
     * 实时同步 Token 数据（方案B - 优化版）
     * 解析完 session 文件后，一次性获取整个 instance 所有 session 的 Token 数据
     */
    private void syncTokenData(String instanceId) {
        // 1. 从 openclaw_instances 表获取 instance 信息
        OpenclawInstance instance = instanceRepository.findByInstanceId(instanceId);
        if (instance == null) {
            log.warn("找不到 instance: {}", instanceId);
            return;
        }
        
        // 2. 调用 Gateway usage.cost RPC 一次性获取所有 session 的 Token 数据
        CostUsageSummary summary = gatewayClient.fetchCostUsage(startDate, endDate);
        GatewaySessionsClient client = new GatewaySessionsClient();
        List<GatewaySessionsClient.SessionTokenStats> allSessions = client.fetchAllSessionTokenStats(instance);
        
        if (allSessions == null || allSessions.isEmpty()) {
            log.warn("未获取到任何 session 的 Token 数据: instance={}", instanceId);
            return;
        }
        
        // 3. 批量更新数据库中所有 session 的 Turn 记录
        int updatedCount = 0;
        for (GatewaySessionsClient.SessionTokenStats stats : allSessions) {
            String sessionId = stats.getSessionId();
            if (sessionId == null || sessionId.isEmpty()) {
                continue;
            }
            
            // 更新该 session 下的所有 Turn 记录
            int count = turnRepository.updateTokenBySessionId(sessionId, 
                stats.getInputTokens(),
                stats.getOutputTokens(),
                stats.getTotalTokens(),
                stats.getEstimatedCostCents(),
                stats.getModel()
            );
            updatedCount += count;
        }
        
        log.info("Token 同步完成: instance={}, sessions={}, turns_updated={}", 
            instanceId, allSessions.size(), updatedCount);
    }
    
    /**
     * 更新处理状态（包括 compaction_count）
     */
    private void updateProcessingState(String fileHash, String filePath, File file, 
                                       String lastMessageId, int compactionCount) {
        SessionProcessingState state = stateRepository.findByFilePathHash(fileHash);
        if (state == null) {
            state = new SessionProcessingState();
            state.setFilePathHash(fileHash);
            state.setFilePath(filePath);
        }
        
        state.setLastMessageId(lastMessageId);
        state.setLastProcessedTime(LocalDateTime.now());
        state.setFileSize(file.length());
        state.setFileModifiedTime(LocalDateTime.ofInstant(
            Instant.ofEpochMilli(file.lastModified()), 
            ZoneId.systemDefault()
        ));
        state.setCompactionCount(compactionCount);
        
        stateRepository.save(state);
    }
}
```

### 5.2 Gateway 健康检查任务

```java
@Component
@Slf4j
public class HealthCheckTask {
    
    @Autowired
    private OpenclawInstanceRepository instanceRepository;
    
    @Autowired
    private GatewayHealthCacheRepository healthCacheRepository;
    
    @Value("${monitoring.health.check.timeout:3000}")
    private int timeoutMs;
    
    @Value("${monitoring.health.check.parallelism:50}")
    private int parallelism;
    
    private final ExecutorService executor;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    
    public HealthCheckTask() {
        this.executor = Executors.newFixedThreadPool(parallelism, r -> {
            Thread t = new Thread(r, "health-check-worker");
            t.setDaemon(true);
            return t;
        });
    }
    
    /**
     * 定时执行健康检查
     */
    @Scheduled(fixedDelay = 300000) // 5分钟
    public void scheduledHealthCheck() {
        if (!isRunning.compareAndSet(false, true)) {
            log.warn("健康检查任务已在执行中，跳过本次调度");
            return;
        }
        
        try {
            log.info("开始执行 Gateway 健康检查任务");
            executeHealthCheck();
            log.info("Gateway 健康检查任务执行完成");
        } catch (Exception e) {
            log.error("Gateway 健康检查任务执行失败", e);
        } finally {
            isRunning.set(false);
        }
    }
    
    /**
     * 手动触发健康检查
     */
    public TaskResult triggerManualHealthCheck() {
        if (!isRunning.compareAndSet(false, true)) {
            return TaskResult.conflict("health_check", "同类型任务正在执行中");
        }
        
        CompletableFuture.runAsync(() -> {
            try {
                executeHealthCheck();
            } finally {
                isRunning.set(false);
            }
        });
        
        return TaskResult.submitted("health_check");
    }
    
    private void executeHealthCheck() {
        // 1. 获取所有 running 状态的 instance
        List<OpenclawInstance> instances = instanceRepository.findByStatus("running");
        
        if (instances.isEmpty()) {
            log.info("没有运行中的实例，跳过健康检查");
            return;
        }
        
        Set<String> existingInstanceIds = instances.stream()
            .map(OpenclawInstance::getInstanceId)
            .collect(Collectors.toSet());
        
        // 2. 并行执行健康检查
        List<CompletableFuture<Void>> futures = instances.stream()
            .map(instance -> CompletableFuture.runAsync(() -> {
                try {
                    checkInstanceHealth(instance);
                } catch (Exception e) {
                    log.error("检查实例健康状态失败: {}", instance.getInstanceId(), e);
                    saveOfflineStatus(instance.getInstanceId(), e.getMessage());
                }
            }, executor))
            .collect(Collectors.toList());
        
        // 3. 等待所有检查完成（最多 60 秒）
        try {
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                .get(60, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            log.warn("健康检查超时，部分实例可能未完成检查");
            futures.forEach(f -> f.cancel(true));
        } catch (Exception e) {
            log.error("等待健康检查完成时出错", e);
        }
        
        // 4. 清理已删除的 instance 缓存
        cleanupDeletedInstances(existingInstanceIds);
    }
    
    private void checkInstanceHealth(OpenclawInstance instance) {
        GatewayHealthCache cache = new GatewayHealthCache();
        cache.setInstanceId(instance.getInstanceId());
        cache.setLastCheckTime(LocalDateTime.now());
        
        try {
            // 通过 WebSocket RPC 调用 health 方法
            JsonNode healthData = callGatewayHealthRpc(
                instance.getGatewayUrl(),
                instance.getAuthToken(),
                3000  // 超时 3 秒
            );
            
            if (healthData != null) {
                // 解析 ok 字段判断在线状态
                boolean isOnline = healthData.path("ok").asBoolean(false);
                cache.setStatus(isOnline ? "online" : "offline");
                
                // 解析最后心跳时间：agents[0].heartbeat.lastBeat
                JsonNode agents = healthData.path("agents");
                if (agents.isArray() && agents.size() > 0) {
                    JsonNode firstAgent = agents.get(0);
                    JsonNode heartbeat = firstAgent.path("heartbeat");
                    long lastBeatMs = heartbeat.path("lastBeat").asLong(0);
                    if (lastBeatMs > 0) {
                        cache.setLastHeartbeat(
                            LocalDateTime.ofInstant(
                                Instant.ofEpochMilli(lastBeatMs), 
                                ZoneId.systemDefault()
                            )
                        );
                    }
                }
                
                // 没有 version, nodeId, memory 等字段，这些字段设为 null
                cache.setVersion(null);
                cache.setChannelsTotal(0);
                cache.setAgentsTotal(0);
                cache.setMemoryRssMb(0);
                cache.setErrorMessage(null);
                
                log.debug("健康检查成功: {} - status={}", 
                    instance.getInstanceId(), cache.getStatus());
            } else {
                cache.setStatus("offline");
                cache.setErrorMessage("WebSocket RPC 调用失败");
                log.warn("健康检查失败: {} - RPC 返回 null", 
                    instance.getInstanceId());
            }
        } catch (Exception e) {
            cache.setStatus("offline");
            cache.setErrorMessage(e.getMessage());
            log.error("健康检查异常: {}", instance.getInstanceId(), e);
        }
        
        healthCacheRepository.save(cache);
    }
    
    /**
     * 通过 WebSocket RPC 调用 Gateway health 方法
     * 
     * @param gatewayUrl Gateway URL，如 ws://localhost:18789
     * @param authToken 认证 Token
     * @param timeoutMs 超时时间（毫秒）
     * @return HealthSummary JSON 数据，失败返回 null
     */
    private JsonNode callGatewayHealthRpc(String gatewayUrl, String authToken, int timeoutMs) {
        // TODO: 实现 WebSocket RPC 调用
        // 需要使用 WebSocket 客户端库，例如:
        // 1. Java-WebSocket: https://github.com/TooTallNate/Java-WebSocket
        // 2. Spring WebSocket: org.springframework.web.socket
        // 3. Tyrus: org.glassfish.tyrus
        
        // 伪代码示例：
        // 1. 建立 WebSocket 连接到 gatewayUrl
        // 2. 发送 JSON-RPC 请求:
        //    {
        //      "jsonrpc": "2.0",
        //      "id": 1,
        //      "method": "health",
        //      "params": { "probe": false }
        //    }
        // 3. 等待响应（超时 timeoutMs）
        // 4. 解析响应:
        //    {
        //      "jsonrpc": "2.0",
        //      "id": 1,
        //      "result": { ...HealthSummary... }
        //    }
        // 5. 返回 result 字段
        
        throw new UnsupportedOperationException("需要实现 WebSocket RPC 客户端");
    }
    
    /**
     * 清理已删除或不活跃的 instance 缓存
     */
    private void cleanupDeletedInstances(Set<String> existingInstanceIds) {
        List<GatewayHealthCache> allCaches = healthCacheRepository.findAll();
        
        for (GatewayHealthCache cache : allCaches) {
            if (!existingInstanceIds.contains(cache.getInstanceId())) {
                healthCacheRepository.deleteByInstanceId(cache.getInstanceId());
                log.info("清理已删除实例的健康缓存: {}", cache.getInstanceId());
            }
        }
    }
    
    /**
     * 保存离线状态（用于并行检查失败时）
     */
    private void saveOfflineStatus(String instanceId, String errorMessage) {
        GatewayHealthCache cache = new GatewayHealthCache();
        cache.setInstanceId(instanceId);
        cache.setStatus("offline");
        cache.setErrorMessage(errorMessage);
        cache.setLastCheckTime(LocalDateTime.now());
        healthCacheRepository.save(cache);
    }
    
    @PreDestroy
    public void shutdown() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(10, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
```

### 5.3 管理接口 Controller

```java
@RestController
@RequestMapping("/api/v1/admin")
@Slf4j
public class AdminController {
    
    @Autowired
    private SessionScanTask sessionScanTask;
    
    @Autowired
    private HealthCheckTask healthCheckTask;
    
    @PostMapping("/trigger-task")
    public ResponseEntity<TaskResponse> triggerTask(@RequestBody TriggerTaskRequest request) {
        String type = request.getType();
        
        TaskResult result;
        if ("session_scan".equals(type)) {
            result = sessionScanTask.triggerManualScan();
        } else if ("health_check".equals(type)) {
            result = healthCheckTask.triggerManualHealthCheck();
        } else {
            return ResponseEntity.badRequest()
                .body(TaskResponse.error("不支持的任务类型: " + type));
        }
        
        if (result.isConflict()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(TaskResponse.conflict(result));
        }
        
        return ResponseEntity.ok(TaskResponse.success(result));
    }
}
```

### 5.4 运营大盘接口实现

**核心思路**：前端接口直接查询预聚合表 `dashboard_stats_daily` 和 `dashboard_stats_hourly`，无需实时计算。

**数据延迟处理策略**：
- **问题**：Token 数据每 5 分钟更新，Skill/Turn 数据每小时第 30 分钟更新，两者存在时间差
- **解决方案**：采用**延迟展示策略**
  - 前端查询时，如果当前小时还未完成聚合（即当前时间 < 下一小时的 00:30），则展示上一小时的完整数据
  - 例如：10:20 查询 → 展示 09:00-10:00 的数据（已完整）
  - 例如：10:40 查询 → 展示 10:00-11:00 的数据（Token 已有，Skill/Turn 待 10:30 更新）
  - 在 UI 上标注“数据延迟约 X 分钟”，提升用户体验
- **实现逻辑**：
  ```java
  private LocalDate determineQueryDate(LocalDate requestedDate) {
      LocalDateTime now = LocalDateTime.now();
      LocalDateTime currentHourStart = now.withMinute(0).withSecond(0);
      
      // 如果当前时间距离下一个整点超过 30 分钟，说明当前小时的数据还未完全聚合
      if (now.getMinute() < 30) {
          // 返回上一个完整的小时
          return currentHourStart.minusHours(1).toLocalDate();
      } else {
          // 当前小时的数据应该已经聚合完成
          return currentHourStart.toLocalDate();
      }
  }
  ```

#### 5.4.1 全局统计数据接口

**接口**: `GET /api/v1/global-stats`

**实现逻辑**：
```java
@RestController
@RequestMapping("/api/v1")
@Slf4j
public class GlobalStatsController {
    
    @Autowired
    private DailyStatsRepository statsRepository;
    
    @Autowired
    private GatewayHealthCacheRepository healthCacheRepository;
    
    @GetMapping("/global-stats")
    public ResponseEntity<ApiResponse<GlobalStatsResponse>> getGlobalStats(
            @RequestParam String dateFrom,
            @RequestParam String dateTo) {
        
        LocalDate from = LocalDate.parse(dateFrom);
        LocalDate to = LocalDate.parse(dateTo);
        
        // 1. 从预聚合表查询全局统计数据
        List<DailyStats> globalStats = statsRepository.findByDimensionTypeAndDateRange(
            "global", "all", from, to
        );
        
        // 2. 累加多天的数据
        GlobalStatsResponse response = aggregateGlobalStats(globalStats);
        
        // 3. 获取当前在线/离线实例数（从 health_cache 实时读取）
        long onlineCount = healthCacheRepository.countByStatus("online");
        long offlineCount = healthCacheRepository.countByStatus("offline");
        response.setOnlineInstances((int) onlineCount);
        response.setOfflineInstances((int) offlineCount);
        
        return ResponseEntity.ok(ApiResponse.success(response));
    }
    
    private GlobalStatsResponse aggregateGlobalStats(List<DailyStats> statsList) {
        GlobalStatsResponse response = new GlobalStatsResponse();
        
        for (DailyStats stats : statsList) {
            response.setTotalUsers(Math.max(response.getTotalUsers(), stats.getUniqueUsers()));
            response.setTotalSessions(response.getTotalSessions() + stats.getTurnCount());
            response.setTotalTurns(response.getTotalTurns() + stats.getTurnCount());
            response.setTotalMessages(response.getTotalMessages() + stats.getMessageCount());
            response.setTotalTokens(response.getTotalTokens() + stats.getTotalTokens());
            response.setTotalCostCents(response.getTotalCostCents() + stats.getEstimatedCostCents());
        }
        
        // 计算平均值
        if (response.getTotalSessions() > 0) {
            response.setAvgTurnsPerSession(
                (double) response.getTotalTurns() / response.getTotalSessions()
            );
        }
        if (response.getTotalTurns() > 0) {
            response.setAvgMessagesPerTurn(
                (double) response.getTotalMessages() / response.getTotalTurns()
            );
        }
        
        return response;
    }
}
```

#### 5.4.2 汇总统计接口

**接口**: `GET /api/v1/summary?groupBy=skill`

**实现逻辑**：
```java
@GetMapping("/summary")
public ResponseEntity<ApiResponse<List<SummaryItem>>> getSummary(
        @RequestParam String dateFrom,
        @RequestParam String dateTo,
        @RequestParam(defaultValue = "skill") String groupBy) {
    
    LocalDate from = LocalDate.parse(dateFrom);
    LocalDate to = LocalDate.parse(dateTo);
    
    // 直接从预聚合表查询指定维度的数据
    List<DailyStats> statsList = statsRepository.findByDimensionTypeAndDateRange(
        groupBy, null, from, to  // dimension_key=null 表示所有维度
    );
    
    // 按 dimension_key 分组并累加
    Map<String, SummaryItem> summaryMap = new HashMap<>();
    for (DailyStats stats : statsList) {
        String key = stats.getDimensionKey();
        summaryMap.computeIfAbsent(key, k -> new SummaryItem())
            .accumulate(stats);
    }
    
    List<SummaryItem> result = summaryMap.values().stream()
        .sorted(Comparator.comparing(SummaryItem::getTurnCount).reversed())
        .collect(Collectors.toList());
    
    return ResponseEntity.ok(ApiResponse.success(result));
}
```

#### 5.4.3 趋势数据接口

**接口**: `GET /api/v1/trend?granularity=day&metric=tokens`

**实现逻辑**：
```java
@GetMapping("/trend")
public ResponseEntity<ApiResponse<List<TrendDataPoint>>> getTrend(
        @RequestParam String dateFrom,
        @RequestParam String dateTo,
        @RequestParam(defaultValue = "day") String granularity,
        @RequestParam(defaultValue = "turns") String metric) {
    
    LocalDate from = LocalDate.parse(dateFrom);
    LocalDate to = LocalDate.parse(dateTo);
    
    List<TrendDataPoint> result;
    
    if ("hour".equals(granularity)) {
        // 从小时统计表查询
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();
        
        List<HourlyStats> hourlyStats = hourlyStatsRepository.findByDimensionTypeAndTimeRange(
            "global", "all", fromDt, toDt
        );
        
        result = hourlyStats.stream()
            .map(stats -> new TrendDataPoint(
                stats.getBucketTime().toString(),
                extractMetric(stats, metric)
            ))
            .sorted(Comparator.comparing(TrendDataPoint::getTimePoint))
            .collect(Collectors.toList());
    } else {
        // 从天统计表查询
        List<DailyStats> dailyStats = statsRepository.findByDimensionTypeAndDateRange(
            "global", "all", from, to
        );
        
        result = dailyStats.stream()
            .map(stats -> new TrendDataPoint(
                stats.getStatDate().toString(),
                extractMetric(stats, metric)
            ))
            .sorted(Comparator.comparing(TrendDataPoint::getTimePoint))
            .collect(Collectors.toList());
    }
    
    return ResponseEntity.ok(ApiResponse.success(result));
}

private Long extractMetric(DailyStats stats, String metric) {
    switch (metric) {
        case "turns": return (long) stats.getTurnCount();
        case "messages": return (long) stats.getMessageCount();
        case "tokens": return stats.getTotalTokens();
        case "cost": return stats.getEstimatedCostCents();
        default: return (long) stats.getTurnCount();
    }
}
```

#### 5.4.4 用户维度统计接口

**接口**: `GET /api/v1/usersummary`

**实现逻辑**：
```java
@GetMapping("/usersummary")
public ResponseEntity<ApiResponse<PageResponse<UserSummaryItem>>> getUserSummary(
        @RequestParam String dateFrom,
        @RequestParam String dateTo,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        @RequestParam(defaultValue = "turns") String sortBy,
        @RequestParam(defaultValue = "desc") String sortOrder) {
    
    LocalDate from = LocalDate.parse(dateFrom);
    LocalDate to = LocalDate.parse(dateTo);
    
    // 从预聚合表查询用户维度数据
    List<DailyStats> userStats = statsRepository.findByDimensionTypeAndDateRange(
        "user", null, from, to
    );
    
    // 按用户分组并累加
    Map<String, UserSummaryItem> userMap = new HashMap<>();
    for (DailyStats stats : userStats) {
        String userId = stats.getDimensionKey();
        userMap.computeIfAbsent(userId, k -> new UserSummaryItem())
            .accumulate(stats);
    }
    
    // 排序
    List<UserSummaryItem> allUsers = userMap.values().stream()
        .sorted(getUserComparator(sortBy, sortOrder))
        .collect(Collectors.toList());
    
    // 分页
    int total = allUsers.size();
    int fromIndex = (page - 1) * pageSize;
    int toIndex = Math.min(fromIndex + pageSize, total);
    List<UserSummaryItem> pagedItems = allUsers.subList(fromIndex, toIndex);
    
    PageResponse<UserSummaryItem> response = new PageResponse<>();
    response.setTotal(total);
    response.setPage(page);
    response.setPageSize(pageSize);
    response.setItems(pagedItems);
    
    return ResponseEntity.ok(ApiResponse.success(response));
}
```

---

### 5.4 Gateway Token 统计数据获取

**说明**: Token、成本等统计数据不从 Session Log 解析，而是通过 Gateway RPC 接口获取。

#### 5.4.1 RPC 方法

**方法名**: `usage.cost`

**请求参数**:
```json
{
  "agentId": "main",           // Agent ID，默认 "main"
  "includeGlobal": false,      // 是否包含全局会话
  "includeUnknown": false,     // 是否包含未知会话
  "limit": 100                 // 限制返回数量（可选）
}
```

**响应格式**:
```json
{
  "ts": 1713123456789,
  "path": "/data/sessions/main.json",
  "count": 15,
  "defaults": { ... },
  "sessions": [
    {
      "key": "discord:user123",
      "sessionId": "sess_abc",
      "updatedAt": 1713123400000,
      "inputTokens": 1200,
      "outputTokens": 800,
      "totalTokens": 2000,
      "estimatedCostUsd": 0.035,
      "contextTokens": 1500,
      "modelProvider": "anthropic",
      "model": "sonnet-4.6",
      ...
    }
  ]
}
```

**关键字段**:
- `inputTokens`: 输入 Token 数
- `outputTokens`: 输出 Token 数
- `totalTokens`: 总 Token 数
- `estimatedCostUsd`: 预估成本（美元）
- `contextTokens`: 上下文 Token 数
- `modelProvider`: 模型提供商
- `model`: 模型 ID

#### 5.4.2 WebSocket 连接建立

**步骤**:
1. **从数据库获取认证信息**:
   ```sql
   SELECT instance_id, access_url, encrypted_token 
   FROM openclaw_instances 
   WHERE status = 'running'
   ```
   
   **示例数据**（来自 `openclaw-instances_sample-data.txt`）:
   - `instance_id`: `113`
   - `access_url`: `http://openclaw-18100732-svc.default.svc.cluster.local:18789?token=1c1d23658e3ab1fe568ab57af641c745ac04bf86d64fa0f7d893145762aac810`
   - `encrypted_token`: `1c1d23658e3ab1fe568ab57af641c745ac04bf86d64fa0f7d893145762aac810`

2. **构造 WebSocket URL**:
   - **方式1（推荐）**: 直接从 `access_url` 转换
     ```java
     // access_url: http://host:port?token=xxx
     String wsUrl = accessUrl.replace("http://", "ws://")
                             .replace("https://", "wss://");
     // 结果: ws://host:port?token=xxx
     ```
   
   - **方式2**: 使用 `base_url` + `encrypted_token`
     ```java
     // base_url: http://host:port/v1
     String baseUrl = instance.getBaseUrl(); // 去掉 /v1 后缀
     String wsUrl = baseUrl.replace("http://", "ws://")
                           .replace("https://", "wss://")
                           + "?token=" + instance.getEncryptedToken();
     // 结果: ws://host:port?token=xxx
     ```

3. **认证机制**:
   OpenClaw Gateway 支持多种认证方式：
   
   - **URL 参数认证**（最常用）:
     ```
     ws://host:port?token=YOUR_TOKEN
     ```
     ✅ 简单直接，适合监控系统使用
   
   - **WebSocket 子协议头**:
     ```java
     Map<String, String> headers = new HashMap<>();
     headers.put("Authorization", "Bearer YOUR_TOKEN");
     ```
   
   - **连接后发送认证消息**:
     ```json
     {
       "type": "auth",
       "token": "YOUR_TOKEN"
     }
     ```

4. **建立 WebSocket 连接**: 使用 WebSocket 客户端库建立连接

5. **发送 JSON-RPC 请求**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "health",
     "params": { "probe": false }
   }
   ```

6. **接收响应**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": { ...HealthSummary... }
   }
   ```

7. **解析 `result` 字段**

#### 5.4.3 Java 实现示例

```java
@Service
@Slf4j
public class GatewaySessionsClient {
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * 通过 usage.cost RPC 一次性获取所有 session 的 Token 统计数据
     * 返回的是日期范围内的累计值，不是 Session 级别的
     */
    public List<SessionTokenStats> fetchAllSessionTokenStats(OpenclawInstance instance) {
        
        // 1. 建立 WebSocket 连接（从 instance 中获取认证信息）
        try (WebSocketClient client = createWebSocketClient(instance)) {
            
            // 2. 构建 JSON-RPC 请求
            JsonNode request = buildJsonRpcRequest("usage.cost", Map.of(
                "startDate", startDate.toString(),  // "2026-04-14"
                "endDate", endDate.toString()        // "2026-04-14"
            ));
                "agentId", "main",
                "limit", 1000  // 限制返回数量，避免大数据量
            ));
            
            // 3. 发送请求并等待响应（超时 5 秒）
            String responseJson = client.sendAndReceive(request.toString(), 5000);
            
            // 4. 解析响应
            JsonNode response = objectMapper.readTree(responseJson);
            JsonNode result = response.path("result");
            JsonNode sessions = result.path("sessions");
            
            // 5. 提取所有 session 的 Token 统计信息
            List<SessionTokenStats> statsList = new ArrayList<>();
            for (JsonNode session : sessions) {
                SessionTokenStats stats = new SessionTokenStats();
                stats.setSessionId(session.path("sessionId").asText(null));
                stats.setSessionKey(session.path("key").asText());
                stats.setInputTokens(session.path("inputTokens").asInt(0));
                stats.setOutputTokens(session.path("outputTokens").asInt(0));
                stats.setTotalTokens(session.path("totalTokens").asInt(0));
                stats.setEstimatedCostCents(
                    (int)(session.path("estimatedCostUsd").asDouble(0.0) * 100)
                );
                stats.setContextTokens(session.path("contextTokens").asInt(0));
                stats.setModelProvider(session.path("modelProvider").asText(null));
                stats.setModel(session.path("model").asText(null));
                statsList.add(stats);
            }
            
            log.debug("获取到 {} 个 session 的 Token 数据", statsList.size());
            return statsList;
            
        } catch (Exception e) {
            log.error("获取 Session Token 统计失败", e);
            return Collections.emptyList();
        }
    }
    
    /**
     * 创建 WebSocket 客户端
     */
    private WebSocketClient createWebSocketClient(OpenclawInstance instance) {
        // 方式1（推荐）: 直接从 access_url 转换
        String accessUrl = instance.getAccessUrl();
        if (accessUrl != null && !accessUrl.isEmpty()) {
            String wsUrl = accessUrl.replace("http://", "ws://")
                                    .replace("https://", "wss://");
            log.debug("使用 access_url 建立 WebSocket 连接: {}", wsUrl);
            return new WebSocketClient(wsUrl);
        }
        
        // 方式2: 使用 base_url + encrypted_token
        String baseUrl = instance.getBaseUrl();
        String token = instance.getEncryptedToken();
        if (baseUrl != null && token != null) {
            // 去掉 /v1 后缀
            String cleanBaseUrl = baseUrl.replaceAll("/v1$", "");
            String wsUrl = cleanBaseUrl.replace("http://", "ws://")
                                       .replace("https://", "wss://")
                                       + "?token=" + token;
            log.debug("使用 base_url + token 建立 WebSocket 连接: {}", wsUrl);
            return new WebSocketClient(wsUrl);
        }
        
        throw new IllegalArgumentException(
            "无法构造 WebSocket URL: instance_id=" + instance.getInstanceId()
        );
    }
    
    /**
     * 构建 JSON-RPC 请求
     */
    private JsonNode buildJsonRpcRequest(String method, Map<String, Object> params) {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("jsonrpc", "2.0");
        request.put("id", 1);
        request.put("method", method);
        request.set("params", objectMapper.valueToTree(params));
        return request;
    }
    
    @Data
    public static class SessionTokenStats {
        private String sessionKey;
        private String sessionId;
        private int inputTokens;
        private int outputTokens;
        private int totalTokens;
        private int estimatedCostCents;
        private int contextTokens;
        private String modelProvider;
        private String model;
    }
}
```

#### 5.4.4 使用场景

1. **Session 扫描任务（实时同步 - 方案B）**: 
   - 解析完一个 session 文件后，调用 Gateway `usage.cost` 获取该 instance 下**全局**的 Token 统计
   - **重要说明**：`usage.cost` API 返回的是日期范围内的累计值，不是 Session 级别的
   - 无法按 user/channel/model 维度拆分，这些维度仍需从 Session Log 解析
   - 批量更新到 `dashboard_session_turn` 表中对应 session 的所有 Turn 记录
   - **优点**：一次 RPC 调用获取所有 session 的 Token 数据，效率高
   - **缺点**：Gateway 不可用时会影响扫描进度
   - **容错处理**：如果 Gateway 调用失败，记录日志并继续处理下一个文件，Token 字段保持为 0
   - **实现方式**：
     ```typescript
     // Gateway usage.cost 调用示例
     const result = await callGateway({
       method: "usage.cost",
       params: { 
         startDate: "2026-04-14",  // 开始日期
         endDate: "2026-04-14"     // 结束日期
       }
     });
     
     // result.totals 包含全局总计：
     // - input, output, totalTokens, totalCost
     // - inputCost, outputCost, cacheReadCost, cacheWriteCost
     // 注意：不提供 user/channel/model 维度，这些需从 Session Log 解析
     ```

2. **按需查询**: 
   - 用户查询对话详情时，如数据库 Token 为 0，可实时从 Gateway 获取最新数据
   - 避免数据库数据过期

3. **重试机制**: 
   - 对于 Token 为 0 的 Turn，可在下次扫描时自动重试同步
   - 或提供手动触发接口强制重新同步指定 session

---

## 6. 部署说明

### 6.1 环境要求

- **JDK**: 17+
- **数据库**: OceanBase MySQL 兼容模式
- **NFS**: 已挂载 Session Log 目录到容器内

### 6.2 配置文件

**application.yml**:
```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://oceanbase-host:3306/openclaw_monitoring
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    hibernate:
      naming:
        physical-strategy: org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl

monitoring:
  session:
    scan:
      cron: "0 0 * * * ?"                    # 每小时执行
      nfs-mount-path: /mnt/session-logs       # NFS 挂载根目录
      path-pattern: instances/*/agents/*/sessions/*.jsonl  # 文件路径模式（可配置）
      compaction-size-threshold: 0.9          # 文件大小缩小超过 10% 判定为 compaction
  health:
    check:
      timeout: 3000          # 单个实例超时（毫秒）
      parallelism: 50        # 并发检查的实例数
      total-timeout: 60000   # 整体超时（毫秒）
```

### 6.3 NFS 挂载

**OpenClaw Gateway 部署配置**：

每个 OpenClaw instance 需要将其 session 目录挂载到统一的 NFS 路径：

```bash
# Instance 001 的启动命令
docker run -d \
  --name openclaw-instance-001 \
  -v /path/to/instance-001/sessions:/data/openclaw/agents/main/sessions \
  -v nfs-server:/mnt/session-logs/instances/instance-001:/mnt/session-logs/instances/instance-001:nfs \
  openclaw-gateway:latest

# Instance 002 的启动命令
docker run -d \
  --name openclaw-instance-002 \
  -v /path/to/instance-002/sessions:/data/openclaw/agents/main/sessions \
  -v nfs-server:/mnt/session-logs/instances/instance-002:/mnt/session-logs/instances/instance-002:nfs \
  openclaw-gateway:latest
```

**监控系统容器配置**：

```bash
docker run -d \
  --name openclaw-monitoring \
  -v nfs-server:/mnt/session-logs:/mnt/session-logs:nfs \
  -e DB_USERNAME=admin \
  -e DB_PASSWORD=secret \
  openclaw-monitoring:latest
```

**NFS 目录结构**：
```
/mnt/session-logs/
└── instances/
    ├── instance-001/
    │   └── agents/
    │       └── main/
    │           └── sessions/
    │               ├── abc-123.jsonl
    │               ├── def-456.jsonl
    │               └── ...
    ├── instance-002/
    │   └── agents/
    │       └── main/
    │           └── sessions/
    │               └── ...
    └── ...
```

**注意事项**：
- 确保 NFS 服务器有足够的存储空间
- 建议启用 NFS 权限控制，只允许授权的 instance 写入
- 监控系统容器只需要读权限

### 6.4 数据库初始化

执行 DDL 脚本创建表结构：
```bash
mysql -h oceanbase-host -u admin -p openclaw_monitoring < schema.sql
```

---

## 7. 性能优化建议

### 7.1 Session Log 解析优化

1. **流式解析**: 使用 BufferedReader 逐行读取，避免一次性加载大文件
2. **分块批量写入**: 每解析 100 个 Turn 后批量插入数据库，避免内存中累积大量数据
   - 不在内存中保留整个文件的所有 Turn（防止 OOM）
   - 不使用单一大事务（失败回滚代价大）
   - 使用固定大小的批次（100 条），平衡性能和内存占用
3. **增量处理**: 基于 last_message_id 只处理新增消息
4. **路径配置化**: Session 文件扫描路径通过配置文件指定，支持灵活调整
5. **Compaction 检测优化**: 在第二遍扫描时同时统计 compaction_count，避免两遍完整扫描，减少 I/O 开销
6. **文件级并行**: 使用线程池（默认 10 并发）并行处理多个 session 文件，提升整体扫描速度
7. **Token 实时同步**: 每个 session 文件解析完成后立即调用 Gateway 获取 Token 数据，保证数据一致性

### 7.2 数据库优化

1. **索引优化**: 确保常用查询字段有索引（instance_id, start_time, user_id）
2. **分区表**: 当数据量大时，考虑按时间对 `dashboard_session_turn` 表分区
3. **连接池**: 使用 HikariCP，合理配置连接池大小（建议 minimumIdle=5, maximumPoolSize=20）
4. **批量写入事务**: 每个批次（100 条 Turn）作为一个独立事务，失败时仅回滚当前批次，不影响其他批次
5. **ON DUPLICATE KEY UPDATE**: 使用 MySQL 的 upsert 语法，避免先查询再插入/更新的两次操作

### 7.3 健康检查优化

1. **并行执行**: 使用线程池并行检查多个 instance，1000 个实例可在 0.4-1.5 秒内完成
2. **短连接模式**: 每次检查创建新连接，无需维护长连接状态，降低复杂度
3. **超时控制**: 严格设置 WebSocket 超时，避免长时间阻塞
4. **缓存读取**: 查询时直接读缓存表，不调用 Gateway

### 7.4 运营统计优化

1. **预聚合策略**: 
   - **Gateway Token 数据**：每 5 分钟轮询 `usage.cost` API，直接获取累计值，无需维护快照表
   - **Session Turn 数据**：Session 扫描任务完成后，立即触发统计数据聚合
   - 将明细数据（`dashboard_session_turn`）聚合到统计表（`dashboard_stats_daily`, `dashboard_stats_hourly`）
   - 前端接口直接查询预聚合表，避免实时计算
   
2. **混合数据源优势**：
   - **准确性**：Token/Cost 使用 Gateway `usage.cost` API 权威值，避免 Session Log 解析的边界情况
   - **完整性**：Skill/Turn 使用 Session Log 解析，保证功能完整性（包括 user/channel/model 维度）
   - **实时性**：Token 数据 5 分钟延迟，Skill/Turn 数据 1 小时延迟
   - **可校验**：两套数据源可以互相验证，及时发现数据异常
   
3. **简化设计**：
   - 直接调用 `usage.cost` API 获取日期范围内的累计值，无需维护快照表
   - 无需计算增量，直接使用 API 返回的 `totals`
   - 注意：`usage.cost` 只提供全局总计，不提供 user/channel/model 细分
   
4. **Turn 级别 Token 分摊**（可选优化）：
   - 当 Session Log 解析失败或消息缺少 usage 字段时，按比例从 Gateway API 数据分摊
   - 按消息数比例分配：`turnTokens = sessionTokens * (turnMessages / totalMessages)`
   - 作为 fallback 机制，保证数据完整性
   
5. **多维度支持**: 
   - global: 全局汇总
   - user: 按用户维度
   - skill: 按技能维度
   - channel: 按渠道维度
   - model: 按模型维度
   
6. **查询性能**: 
   - 无预聚合：每次查询需扫描数万条 Turn 记录，耗时秒级
   - 有预聚合：直接读取几十条聚合记录，耗时毫秒级
   - 性能提升 **100-1000 倍**
5. **历史数据回填机制**: 
   - **场景**：系统初始化、数据修复、统计逻辑变更
   - **实现**：提供管理接口手动触发历史数据回填
   ```java
   /**
    * 手动触发历史数据回填（用于系统初始化或数据修复）
    */
   @PostMapping("/admin/backfill-stats")
   public ResponseEntity<String> backfillStats(
           @RequestParam String startDate,
           @RequestParam String endDate) {
       
       LocalDate start = LocalDate.parse(startDate);
       LocalDate end = LocalDate.parse(endDate);
       
       // 异步执行回填任务
       CompletableFuture.runAsync(() -> {
           for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
               log.info("开始回填 {} 的统计数据", date);
               
               // 1. 回填每日统计数据
               refreshDailyStatsForDate(date);
               
               // 2. 回填每小时统计数据
               refreshHourlyStatsForDate(date);
               
               log.info("完成回填 {} 的统计数据", date);
           }
       });
       
       return ResponseEntity.ok("历史数据回填任务已提交，请在后台查看日志");
   }
   ```
   - **使用示例**：
     ```bash
     # 回填 2026-04-01 到 2026-04-15 的数据
     curl -X POST http://localhost:8080/api/v1/admin/backfill-stats \
          -d "startDate=2026-04-01&endDate=2026-04-15"
     ```
6. **失败重试与监控**: 
   - **定时检测**：每天凌晨 2 点检测昨天的统计数据是否完整
   ```java
   /**
    * 检测并修复异常的统计数据
    */
   @Scheduled(cron = "0 0 2 * * ?") // 每天凌晨 2 点执行
   public void detectAndFixAnomalies() {
       LocalDate yesterday = LocalDate.now().minusDays(1);
       
       // 1. 检查昨天的统计数据是否完整
       boolean dailyStatsComplete = checkDailyStatsCompleteness(yesterday);
       boolean hourlyStatsComplete = checkHourlyStatsCompleteness(yesterday);
       
       // 2. 如果缺失，重新聚合
       if (!dailyStatsComplete) {
           log.warn("检测到 {} 的每日统计数据不完整，开始修复", yesterday);
           refreshDailyStatsForDate(yesterday);
       }
       
       if (!hourlyStatsComplete) {
           log.warn("检测到 {} 的小时统计数据不完整，开始修复", yesterday);
           refreshHourlyStatsForDate(yesterday);
       }
       
       // 3. 发送告警（如果有异常）
       if (!dailyStatsComplete || !hourlyStatsComplete) {
           alertService.sendAlert("统计数据异常", 
               String.format("%s 的统计数据不完整，已自动修复", yesterday));
       }
   }
   ```
   - **Gateway 连接失败处理**：
     - 单个实例连接失败不影响其他实例
     - 连续失败 3 次后标记该实例为"Token 同步异常"，发送告警
     - 下次定时任务会自动重试
   
   - **数据一致性校验**（新增）：每天凌晨 3 点执行
   ```java
   /**
    * 校验 Gateway API 数据与 Session Log 解析数据的一致性
    */
   @Scheduled(cron = "0 0 3 * * ?") // 每天凌晨 3 点执行
   public void validateDataConsistency() {
       LocalDate yesterday = LocalDate.now().minusDays(1);
       
       // 1. 获取昨天所有活跃 Session 的 Gateway 累计值
       List<TokenSnapshot> snapshots = snapshotRepository.findByLastSnapshotDate(yesterday);
       
       for (TokenSnapshot snapshot : snapshots) {
           // 2. 从 dashboard_session_turn 表聚合同一 Session 的 Token 总数
           long turnTotalTokens = turnRepository.sumTotalTokensBySessionKey(
               snapshot.getSessionKey(), yesterday
           );
           
           // 3. 计算差异率
           long gatewayTotal = snapshot.getLastTotalTokens();
           if (gatewayTotal == 0) {
               continue; // 跳过无数据的 Session
           }
           
           double diffRate = Math.abs((double)(gatewayTotal - turnTotalTokens) / gatewayTotal);
           
           // 4. 如果差异超过 5%，记录告警
           if (diffRate > 0.05) {
               log.error("数据不一致: sessionKey={}, gateway={}, turn={}, diff={:.2f}%",
                   snapshot.getSessionKey(), gatewayTotal, turnTotalTokens, diffRate * 100);
               
               alertService.sendAlert("数据一致性告警",
                   String.format("Session %s 的 Token 数据差异 %.2f%% (Gateway=%d, Turn=%d)",
                       snapshot.getSessionKey(), diffRate * 100, gatewayTotal, turnTotalTokens));
               
               // 5. 标记该 Session 的数据为可疑
               turnRepository.markAsSuspicious(snapshot.getSessionKey(), yesterday);
           }
       }
       
       log.info("数据一致性校验完成: date={}, checked={}", yesterday, snapshots.size());
   }
   ```

### 7.5 异常恢复与容错

1. **断点续传**: 基于 `dashboard_session_processing_state` 表的 `last_message_id` 实现增量处理，任务中断后可从上次位置继续
2. **重试机制**: 
   - 单个文件处理失败不影响其他文件
   - Gateway Token 同步失败时记录日志，下次扫描自动重试
   - 连续失败 3 次的文件标记为异常，跳过处理并告警
3. **资源清理**: 任务执行完成后确保线程池正确关闭，避免资源泄漏
4. **幂等性**: 使用 `turn_id` 作为主键，重复处理同一消息不会造成数据重复

---

## 8. 监控与告警
暂时不做要求

---

## 9. 附录

### 9.1 术语表

| 术语 | 说明 |
|------|------|
| Turn | 对话单元，从一条 user 消息到下一条 user 消息之间的所有消息 |
| Session | 会话，包含多个 Turn |
| Instance | OpenClaw 实例，对应一个用户 |
| Gateway | OpenClaw 网关服务，提供 WebSocket 和 HTTP API |

### 9.2 参考资料
- [OpenClaw 源码](https://github.com/openclaw/openclaw)
- [Session Log 格式说明](./2026-04-14-openclaw-monitoring-design.md)
- [Session Log 数据文件](./test/openclaw-logs)
- [API 接口文档](./API接口文档.md)
- [openclaw_instances 数据](./openclaw-instances_sample-data.txt)

---

**文档版本历史**:

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| v1.0 | 2026-04-15 | OpenClaw Team | 初始版本 |
| v1.1 | 2026-04-15 | OpenClaw Team | 优化健康检查并行执行，采用方案C（并行+短连接） |
| v1.2 | 2026-04-15 | OpenClaw Team | 完善 Session 文件扫描逻辑，路径配置化，支持 NFS 多实例隔离 |
| v1.3 | 2026-04-15 | OpenClaw Team | 修复 Session 扫描串行瓶颈、Turn 聚合完整性、Token 实时同步策略、Compaction 检测优化、事务边界、异常恢复机制、文档格式问题 |
| v1.4 | 2026-04-15 | OpenClaw Team | 新增预聚合统计表设计（`dashboard_stats_daily`, `dashboard_stats_hourly`），补充前端运营大盘接口实现逻辑 |
| v1.5 | 2026-04-15 | OpenClaw Team | **混合数据源架构（方案B+）**：Token/Cost/Model 统计采用 Gateway sessions.list API + 增量快照机制，Skill/Turn 统计从 Session Log 解析；新增 dashboard_session_token_snapshot 表维护快照状态；补充 Turn 级别 Token 分摊策略作为 fallback；修正 sessions.list API 返回字段说明；添加数据一致性校验机制 |
