# OpenClaw 监控面板设计 - 对话记录

**日期**: 2026-04-11
**参与者**: 用户, Claude

---

## 一、需求提出

**用户**:
我们公司基于OpenClaw在打造企业级的个人助理，使用PaaS容器化安装和维护OpenClaw，通过内部聊天工具对接OpenClaw，OpenClaw对接内部部署的大模型。现在想实现一个监控面板，可以从公司领导、开发运维、普通用户等不同角色角度了解整个项目、OpenClaw的运行情况，需要提供一些量化、可观测的指标、数据。现在请你分析当前项目下的OpenClaw的源码，分析这个监控面板可以怎样设计，可以提供哪些指标、数据。

---

## 二、项目探索

**Claude**:
探索了OpenClaw项目结构，发现其核心架构：

**OpenClaw 架构概览：**
- **Gateway 网关层**：WebSocket服务器、HTTP端点、认证、会话管理
- **Agent 运行时**：LLM提供商集成（支持OpenAI、Anthropic、Gemini等）
- **Channel 渠道层**：消息平台适配器（WhatsApp、Telegram、Slack、Discord等）
- **任务系统**：后台任务、定时任务
- **现有可观测性**：健康检查端点、渠道监控、使用统计API、结构化日志

---

## 三、需求确认问答

### Q1: 技术实现方式

**Claude**: 监控面板的技术实现方式倾向哪种？

**选项**:
- 内置到OpenClaw中
- 独立服务调用OpenClaw API（用户选择）
- 对接现有监控平台

**用户选择**: 独立服务调用OpenClaw API

---

### Q2: 角色优先级

**Claude**: 三个角色（公司领导、开发运维、普通用户）的关注优先级是怎样的？

**选项**:
- 公司领导视角优先（用户选择）
- 开发运维视角优先
- 三者均衡覆盖
- 普通用户视角优先

**用户选择**: 公司领导视角优先

---

### Q3: 数据存储

**Claude**: 监控数据是否需要持久化存储以支持历史趋势分析？

**选项**:
- 仅实时展示
- 短期历史存储
- 长期归档存储（用户选择）

**用户选择**: 长期归档存储

---

### Q4: 告警需求

**Claude**: 是否需要告警功能？

**选项**:
- 不需要
- 需要简单告警展示（用户选择）
- 需要完整告警通知

**用户选择**: 需要简单告警展示（界面内展示）

---

### Q5: 前端技术栈

**Claude**: 监控面板的前端技术栈偏好？

**选项**:
- 现代前端框架（推荐）（用户选择）
- 纯HTML/JS模板
- 跟随公司现有技术栈

**用户选择**: 现代前端框架（推荐）

---

### Q6: KPI重点

**Claude**: 公司领导最关心的KPI方向有哪些？（可多选）

**选项**:
- 使用量指标（日活用户、会话数、消息量等）
- 性能指标（AI响应时间、成功率、错误率等）
- 资源消耗（Token消耗、模型成本、渠道状态等）
- 质量指标（用户满意度、对话质量评估等）

**用户选择**: 四个全部选中

---

## 四、方案对比讨论

### 方案一：轻量级数据采集 + 时间序列数据库（推荐）

```
OpenClaw ──API──> 数据采集服务 ──写入──> TimescaleDB/PostgreSQL
                       │                          │
                       └──采集──> Redis缓存 ───────┘
                                                    │
监控面板前端 <────GraphQL/REST API────监控后端服务────┘
```

**优点**：
- 利用OpenClaw已有的`/health`、`/usage` API，改动最小
- TimescaleDB天然支持时间序列数据的聚合和压缩
- PostgreSQL生态成熟
- 与PaaS容器化部署契合

---

### 方案二：Prometheus + Grafana 标准监控栈

**优点**：
- 业界标准方案
- 内置告警规则和丰富的可视化

**缺点**：
- 需要在OpenClaw中添加Prometheus metrics暴露端点
- 领导视角的定制报表不如自研灵活

---

### 方案三：全自研监控平台

**优点**：
- 最灵活的定制能力
- 实时数据推送

**缺点**：
- 开发工作量大
- 架构复杂度高

---

**Claude推荐**: 方案一

---

## 五、数据来源分析

### 用户问题
OpenClaw现有的health、usage API可以统计到哪些数据？

### Claude分析结果

**Health API (`health` 方法)**：
| 数据类别 | 字段 |
|---------|------|
| 系统状态 | ok, ts, durationMs |
| 渠道状态 | channels.{channelId}.configured/linked |
| 渠道探测 | channels.{channelId}.probe.ok/elapsedMs/error |
| Agent心跳 | agents[].heartbeat.everyMs/enabled |
| 会话统计 | sessions.count/recent[].age |

**Usage API系列**：

| 方法 | 数据 |
|------|------|
| usage.status | LLM提供商配额状态、usedPercent、resetAt |
| usage.cost | Token统计、成本统计、每日趋势 |
| sessions.usage | 消息统计、工具使用、模型分析、性能指标、渠道分析、每日明细 |

---

## 六、API架构讨论

### 用户问题
OpenClaw现有的health、usage API是不是都是通过OpenClaw Gateway提供出来的？

### Claude确认
是的，Gateway API架构：

**HTTP 端点（有限）**：
- `/healthz` - K8s存活探针
- `/readyz` - K8s就绪探针
- `/hooks/*` - Webhook触发
- `/api/*`, `/v1/*` - OpenAI兼容API

**WebSocket Gateway Methods（核心数据）**：
- `health` - 完整健康快照
- `status` - 系统状态摘要
- `usage.status` - LLM提供商配额状态
- `usage.cost` - Token和成本统计
- `sessions.usage` - 会话使用详情

---

## 七、关键信息补充

### 用户补充
我们可以获取到所有OpenClaw的session logs文件，再加上这一点考虑，这个方案还有什么优化的地方吗？

### Claude优化架构

```
实时状态（REST API）          历史数据（直接读文件）
───────────────────         ────────────────────
• 渠道连接状态                • Token使用统计
• Agent心跳状态               • 成本趋势分析
• 当前活跃会话                • 消息量统计
• 系统健康检查                • 工具使用排行
• LLM配额状态                 • 延迟分布统计
                              • 用户活跃度分析

        ↓                              ↓
   OpenClaw API              Session Logs文件
   (轻量级查询)              (批量异步处理)
```

**核心优化**：OpenClaw仅处理实时状态查询，Session Logs文件直接读取处理历史数据。

---

### Q7: Session Logs文件访问方式

**Claude**: Session logs文件的访问方式是什么？

**选项**:
- 本地文件系统
- 共享存储（用户选择）
- 容器日志采集

**用户选择**: 共享存储（NFS/S3）

---

### Q8: 实例部署数量

**Claude**: OpenClaw的部署方式是单实例还是多实例？

**选项**:
- 单实例部署
- 多实例部署（用户选择）

**用户选择**: 多实例部署

---

## 八、最终方案讨论

### 用户问题
是OpenClaw新增HTTP REST API - 暴露监控数据端点这个方案好，还是OpenClaw实例主动推送数据给统计平台好？

### Claude方案对比

**方案A：新增HTTP REST API（被动暴露）**

优点：
- 简单直观，符合Prometheus pull模型
- 监控服务控制采集频率
- OpenClaw无状态

缺点：
- 需修改OpenClaw源码
- 轮询有延迟

---

**方案B：主动推送（Push模式）**

优点：
- 实时性好
- OpenClaw自控推送时机
- 解耦监控服务

缺点：
- 需配置推送目标
- 网络故障需重试机制
- 下游不可用时影响稳定性

---

**用户选择**: 方案一（不改造OpenClaw）

---

## 九、关键问题：1000+实例规模

### 用户提出
我们的OpenClaw实例可能较多，目标是1000+，那么使用现有Gateway API是不是要用WS通信？那会不会有问题？

### Claude问题分析

WebSocket方案在1000+实例场景的问题：
| 问题 | 影响 |
|------|------|
| 连接资源消耗 | 内存/CPU压力大 |
| 连接管理复杂度 | 维护成本高 |
| 并发请求风暴 | 网络带宽峰值 |
| 连接稳定性 | 断线重连风暴 |
| 认证开销 | 每连接需认证 |

---

### 新方案提出

**方案A：实例主动推送**
**方案B：分批轮询 + 连接池优化**
**方案C：引入消息队列中间层**

---

### 用户问题
如果改造OpenClaw提供数据获取的REST API服务，可行吗？

### Claude评估

改造工作量约50-100行代码，OpenClaw已有HTTP服务器框架、health逻辑、认证框架可复用。

REST API方案可行，但相比推送方案仍有瓶颈。

---

## 十、Edge Collector方案提出

### 用户提出
是不是还有一个方案：使用Edge Collector通过 WebSocket 短连接来调用 Gateway API，每个EdgeCollector管理一批OpenClaw？

### Claude详细分析

```
OpenClaw实例层 (1000+)
    ↓ WS短连接
Edge Collector层 (每个管理50-100实例)
    ↓ HTTP API (聚合数据)
监控服务层
    ↓
前端展示层
```

**优势**：
| 优势 | 说明 |
|------|------|
| 不改造OpenClaw | 使用现有Gateway API |
| 分层架构 | 监控服务不直接面对1000+实例 |
| 连接资源可控 | 每Collector仅管理50实例短连接 |
| 数据本地聚合 | 减少网络传输 |
| 水平扩展 | 1000实例可部署20个Collector |
| 故障隔离 | 单Collector故障影响范围可控 |

---

### 用户确认
确认采用Edge Collector方案。

---

## 十一、最终架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────┐
│                    OpenClaw实例层                    │
│  1000+实例，Gateway WS API + Session Logs文件       │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│                   Edge Collector层                   │
│  每Collector管理50-100实例，WS短连接轮询，本地聚合   │
│  数量: ceil(1000/100) = 10个                        │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│                    监控服务层                        │
│  数据聚合 + API服务 + TimescaleDB + Redis          │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│                    前端展示层                        │
│  React + TypeScript + Ant Design 监控面板          │
└─────────────────────────────────────────────────────┘
```

### 数据来源分工
| 数据类型 | 来源 | 获取方式 |
|---------|------|---------|
| 实时健康状态 | Gateway API | Edge Collector WS短连接 |
| 渠道连接状态 | Gateway API | Edge Collector WS短连接 |
| Token消耗/成本 | Session Logs | 文件扫描器异步处理 |
| 消息统计/工具调用 | Session Logs | 文件扫描器异步处理 |

### 指标清单
- **领导视角**：DAU/MAU、会话总数、Token消耗、成本趋势、渠道分布、系统可用率
- **运维视角**：实例健康、渠道状态、LLM配额、响应延迟、错误率、告警事件
- **用户视角**：个人会话数、消息量、Token消耗、成本、常用工具

### 告警规则（12条）
- 实例健康告警、实例高负载
- 渠道断连告警、渠道延迟告警、认证即将过期
- LLM配额告警、LLM配额临界
- 响应延迟告警、P95延迟告警
- 错误率告警、错误率严重
- 成本超预算

### 技术选型
| 层 | 技术 |
|------|------|
| 后端 | Node.js + Fastify + ws + TimescaleDB + Redis + Prisma |
| 前端 | React + TypeScript + Vite + Ant Design + ECharts + Zustand + TanStack Query |

---

## 十二、设计文档编写

### Claude
编写正式设计文档至：
```
docs/superpowers/specs/2026-04-11-openclaw-monitor-dashboard-design.md
```

文档内容：
- 概述（背景、目标、约束）
- 架构设计（Edge Collector分层架构）
- 组件设计（Edge Collector、数据采集、API服务、前端）
- 存储层（TimescaleDB表结构、Redis缓存）
- 指标清单（三角色视角）
- 告警规则配置
- 技术选型
- 部署架构
- 项目结构
- 风险与对策

### Spec Review结果
**状态**: Approved
**问题**: 无
**建议**: 修正文档日期（2024→2026）

---

## 十三、总结

**最终方案**：Edge Collector分层架构

**核心决策**：
| 决策点 | 选择 |
|------|------|
| 数据来源 | Session Logs文件 + Gateway WebSocket API |
| 实时状态采集 | Edge Collector WS短连接轮询 |
| 历史数据处理 | 直接扫描共享存储文件 |
| 不改造OpenClaw | 利用现有API和文件 |
| 数据库 | TimescaleDB（长期存储） |
| 前端 | React + Ant Design |
| 部署 | PaaS容器化独立部署 |

**设计文档位置**：
```
docs/superpowers/specs/2026-04-11-openclaw-monitor-dashboard-design.md
```

---

**文档编写**: 2026-04-11