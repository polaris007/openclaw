# OpenClaw 架构分析

## 一、整体架构

OpenClaw 采用 **Hub-and-Spoke（中心辐射）架构**，核心是一个长期运行的 **Gateway 网关进程**：

```
┌─────────────────────────────────────────────────────────────────┐
│                        Gateway (核心网关)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Sessions │  │ Routing  │  │ Channels │  │ Agent Engine │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │  Tools   │  │  Memory  │  │   MCP    │  │   Security   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────┘
        ▲           ▲           ▲           ▲           ▲
        │           │           │           │           │
   WebSocket    Channels    Providers    Skills      Nodes
   Clients     (Plugins)    (Plugins)   (Plugins)   (iOS/Android)
```

### Gateway 网关

- **职责**：单一控制平面，管理所有会话、路由、渠道连接
- **协议**：WebSocket API，JSON-RPC 请求/响应
- **特点**：One Gateway per host，是消息会话的唯一控制者

### 核心模块

| 模块 | 位置 | 职责 |
|-----|------|------|
| **Gateway** | `src/gateway/` | WebSocket 服务器，认证，消息路由 |
| **Channels** | `src/channels/` + `extensions/` | 消息渠道集成 |
| **Agents** | `src/agents/` | 智能体引擎，ACP 子进程管理 |
| **Plugins** | `src/plugins/` | 插件加载，Provider 运行时 |
| **Tools** | `src/tools/` | 内置工具：bash, browser, canvas 等 |
| **Memory** | `src/memory/` + `extensions/memory-*` | 记忆系统 |
| **Security** | `src/security/` | 安全审计，沙箱隔离 |
| **Config** | `src/config/` | 配置读写，Schema 验证 |

---

## 二、Channels 渠道系统

### 内置渠道
- **WebChat**：无需插件，内置 Web 界面

### 插件渠道（可移除）

| 渠道 | 插件目录 | 说明 |
|-----|---------|------|
| Telegram | `extensions/telegram/` | Telegram Bot |
| Discord | `extensions/discord/` | Discord Bot |
| Slack | `extensions/slack/` | Slack App |
| WhatsApp | `extensions/whatsapp/` | WhatsApp Web |
| Feishu | `extensions/feishu/` | 飞书 |
| Microsoft Teams | `extensions/msteams/` | MS Teams |
| Signal | `extensions/signal/` | Signal |
| iMessage | `extensions/imessage/` | iMessage (macOS) |

**总计 80+ 个渠道插件**

---

## 三、Plugins 插件系统

### 插件类型

| 类型 | 说明 | 示例 |
|-----|------|------|
| **Channel Plugins** | 消息渠道集成 | `extensions/telegram/` |
| **Provider Plugins** | AI 模型提供商 | `extensions/deepseek/`, `extensions/qwen/` |
| **Memory Plugins** | 记忆存储后端 | `extensions/memory-lancedb/` |
| **Tool Plugins** | 工具扩展 | `extensions/browser/` |
| **Capability Plugins** | 能力扩展 | `extensions/image-generation-core/` |

### 插件结构

```
extensions/telegram/
├── index.ts              # 插件入口
├── api.ts                # Telegram API 封装
├── channel-plugin-api.ts # 渠道接口实现
├── runtime-api.ts        # 运行时 API
├── openclaw.plugin.json  # 插件清单
└── package.json          # 依赖声明
```

---

## 四、Skills 技能系统

### Skills vs Plugins

| 概念 | 层次 | 说明 |
|-----|------|------|
| **Skills** | 提示词模板 | Markdown 文件，指导 AI 如何完成任务 |
| **Plugins** | 代码级扩展 | TypeScript 模块，添加新功能/渠道/Provider |

### Skills 结构

```
~/.openclaw/workspace/skills/<skill-name>/SKILL.md
```

### 通过 ClawHub 分发

- 技能市场：https://clawhub.ai
- 用户可自定义创建
- Bundle-style Plugins 可打包 Skills

---

## 五、MCP (Model Context Protocol)

### 双向集成

| 方向 | 说明 |
|-----|------|
| **MCP Server** | OpenClaw 作为 MCP 服务器，暴露工具给外部客户端 |
| **MCP Client** | OpenClaw 作为 MCP 客户端，调用外部 MCP 服务器 |

### 连接方式

**Stdio 传输**（OpenClaw 启动 MCP Server）：
```json5
{
  mcp: {
    servers: {
      my-server: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
      }
    }
  }
}
```

**HTTP 传输**（连接已存在的 MCP Server）：
```json5
{
  mcp: {
    servers: {
      remote-server: {
        url: "https://your-server.com/mcp",
        transport: "streamable-http",
        headers: { "X-API-Key": "xxx" }
      }
    }
  }
}
```

---

## 六、Memory 记忆系统

### 架构层次

```
┌─────────────────────────────────────────────────────────────────┐
│                    Memory 系统架构                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              memory-core (核心插件)                       │   │
│  │  • memory_search 工具 - 语义搜索                          │   │
│  │  • memory_get 工具 - 读取记忆文件                         │   │
│  │  • Dreaming 机制 - 记忆整理/提炼                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│         ┌─────────────────┼─────────────────┐                  │
│         ▼                 ▼                 ▼                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐        │
│  │ memory-     │  │ memory-     │  │ active-memory   │        │
│  │ lancedb     │  │ wiki        │  │                 │        │
│  │ (向量存储)  │  │ (知识库)    │  │ (活跃记忆管理)  │        │
│  └─────────────┘  └─────────────┘  └─────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 搜索范围 (corpus 参数)

| corpus 值 | 搜索范围 |
|----------|---------|
| `"memory"` | MEMORY.md + memory/*.md + extraPaths |
| `"wiki"` | Wiki Vault |
| `"all"` | 记忆 + Wiki |
| `"sessions"` | 会话记录 |

### Dreaming 机制

| 阶段 | 频率 | 功能 |
|-----|------|------|
| **Light Dreaming** | 每 6 小时 | 处理最近 2 天会话，去重 |
| **Deep Dreaming** | 每天凌晨 3 点 | 分析记忆模式，提炼重要信息写入 MEMORY.md |
| **REM Dreaming** | 每周日凌晨 5 点 | 发现深层模式和关联 |

### 存储位置

```
~/.openclaw/workspace/
├── MEMORY.md           # 主记忆文件 (持久记忆)
└── memory/             # 记忆目录
    ├── 2026-05-09.md   # 每日记忆 (自动生成)
    ├── projects.md     # 用户自定义记忆文件
    └── .dreams/        # Dreaming 内部文件
```

---

## 七、Wiki 知识库

### Vault 结构

```
~/.openclaw/wiki/main/
├── AGENTS.md
├── WIKI.md
├── index.md
├── entities/          # 实体页面
├── concepts/          # 概念页面
├── syntheses/         # 综合页面
├── sources/           # 来源页面 (导入的文档)
├── reports/           # 报告页面 (自动生成)
└── .openclaw-wiki/    # 缓存和配置
```

### 数据来源

| 来源 | 方式 |
|-----|------|
| 用户手动创建 | 用户编辑 .md 文件 |
| 导入外部文档 | `openclaw wiki ingest` |
| AI 自动生成 | `wiki_apply` 工具 |
| 插件自动生成 | `openclaw wiki compile` |

### 访问方式

- **Obsidian 集成**：主要 UI 方式
- **CLI 命令行**：`openclaw wiki` 命令系列
- **Gateway RPC**：WebSocket 接口
- **memory_search**：`corpus="wiki"` 或 `corpus="all"`

---

## 八、Security 安全系统

### Sandbox 沙箱机制

**后端类型**：

| 后端 | 说明 |
|-----|------|
| **Docker** | 在容器中执行命令（默认推荐） |
| **SSH** | 通过 SSH 连接远程主机执行 |
| **OpenShell** | 本地受限 Shell |

**配置示例**：
```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",  // 非主会话使用沙箱
        backend: "docker",
        allowTools: ["bash", "read", "write", "edit"],
        denyTools: ["browser", "canvas", "nodes", "cron"]
      }
    }
  }
}
```

---

## 九、Nodes 移动端节点

### 功能

- 设备配对：通过 Gateway WebSocket 连接
- 能力扩展：camera, screen.record, location.get
- 语音功能：Voice Wake, Push-to-Talk

### 相关代码

| 路径 | 说明 |
|-----|------|
| `src/gateway/node-*.ts` | Node 连接、认证、能力管理 |
| `src/node-host/` | Node 宿主运行时 |
| `apps/ios/` | iOS 应用源码 |
| `apps/android/` | Android 应用源码 |

---

## 十、配置文件

### 主配置文件

```
~/.openclaw/openclaw.json
```

### 最小配置

```json5
{
  agent: {
    model: "<provider>/<model-id>"
  }
}
```

### 工作空间

```
~/.openclaw/workspace/
├── AGENTS.md      # Agent 指导文件
├── SOUL.md        # 人格设定
├── TOOLS.md       # 工具说明
├── MEMORY.md      # 记忆文件
├── memory/        # 记忆目录
├── sessions/      # 会话记录
└── skills/        # 技能目录
```

---

## 十一、可移除/精简的模块

| 模块类别 | 可移除项 | 影响 |
|---------|---------|------|
| **渠道插件** | 80+ 个外部渠道插件 | 大幅减少代码体积 |
| **模型插件** | 保留需要的，移除其他 | 减少依赖 |
| **移动端** | iOS/Android Node 相关代码 | 无移动端需求可移除 |
| **语音功能** | talk-voice, elevenlabs | 无语音需求可移除 |
| **图像生成** | image-generation-* | 无图像生成需求可移除 |
| **视频生成** | video-generation-* | 无视频需求可移除 |
| **社交功能** | nostr, matrix | 无社交需求可移除 |

---

## 十二、企业级增强建议

| 需求 | 当前状态 | 建议增强 |
|-----|---------|---------|
| **审计日志** | 有基础审计 | 增强为完整审计系统，支持结构化日志导出 |
| **监控运维** | 有 Prometheus 插件 | 增强健康检查、告警机制 |
| **数据隔离** | 有沙箱机制 | 增强工作区隔离、数据脱敏 |
| **用户认证** | 有设备配对机制 | 可对接企业 LDAP/AD/OAuth |
| **合规报告** | 无 | 新增合规报告生成模块 |
