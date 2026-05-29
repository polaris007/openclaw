# OpenClaw 插件系统

## 一、插件类型概览

OpenClaw 支持多种类型的插件，每种插件承担不同的职责：

| 类型 | 说明 | 示例 |
|-----|------|------|
| **Channel Plugins** | 消息渠道集成 | `extensions/telegram/`, `extensions/discord/` |
| **Provider Plugins** | AI 模型提供商 | `extensions/deepseek/`, `extensions/qwen/` |
| **Memory Plugins** | 记忆存储后端 | `extensions/memory-lancedb/` |
| **Tool Plugins** | 工具扩展 | `extensions/browser/` |
| **Capability Plugins** | 能力扩展 | `extensions/image-generation-core/` |

---

## 二、插件目录结构

### 标准插件结构

```
extensions/telegram/
├── index.ts              # 插件入口
├── api.ts                # Telegram API 封装
├── channel-plugin-api.ts # 渠道接口实现
├── runtime-api.ts        # 运行时 API
├── openclaw.plugin.json  # 插件清单
└── package.json          # 依赖声明
```

### 插件清单文件 (openclaw.plugin.json)

每个插件必须包含清单文件，声明插件元数据和入口：

```json
{
  "name": "telegram",
  "version": "1.0.0",
  "type": "channel",
  "main": "index.ts",
  "provides": ["channel:telegram"]
}
```

---

## 三、内置渠道插件

OpenClaw 内置 **WebChat** 渠道，无需插件即可使用。

### 可移除的外部渠道插件（80+ 个）

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
| WeChat | `extensions/wechat/` | 微信 |
| DingTalk | `extensions/dingtalk/` | 钉钉 |
| Matrix | `extensions/matrix/` | Matrix |
| Nostr | `extensions/nostr/` | Nostr |

---

## 四、Provider 插件

Provider 插件负责与 AI 模型提供商通信：

### 常见 Provider 插件

| Provider | 插件目录 | 说明 |
|---------|---------|------|
| OpenAI | `extensions/openai/` | GPT 系列 |
| DeepSeek | `extensions/deepseek/` | DeepSeek 模型 |
| Qwen | `extensions/qwen/` | 通义千问 |
| Claude | `extensions/anthropic/` | Claude 系列 |
| Gemini | `extensions/google/` | Google Gemini |
| xAI | `extensions/xai/` | Grok |
| Ollama | `extensions/ollama/` | 本地模型 |
| LM Studio | `extensions/lmstudio/` | 本地模型 |

### Provider 插件职责

1. **API 适配**：将 OpenClaw 请求转换为提供商 API 格式
2. **流式响应**：处理 SSE/WebSocket 流式输出
3. **工具调用**：适配不同提供商的工具调用格式
4. **错误处理**：处理 API 限流、错误重试

---

## 五、Memory 插件

Memory 插件提供记忆存储后端：

| 插件 | 说明 |
|-----|------|
| `memory-lancedb` | LanceDB 向量存储 |
| `memory-wiki` | Wiki 知识库集成 |
| `active-memory` | 活跃记忆管理 |

### Memory 插件接口

```typescript
interface MemoryPlugin {
  // 语义搜索
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // 获取记忆
  get(key: string): Promise<MemoryEntry | null>;
  
  // 存储记忆
  set(key: string, value: MemoryEntry): Promise<void>;
  
  // 删除记忆
  delete(key: string): Promise<void>;
}
```

---

## 六、插件加载机制

### 加载流程

```
Gateway 启动
    │
    ▼
扫描 extensions/ 目录
    │
    ▼
读取 openclaw.plugin.json
    │
    ▼
验证插件类型和依赖
    │
    ▼
加载插件入口 (index.ts)
    │
    ▼
注册插件能力到 Gateway
```

### 配置启用/禁用插件

```json5
{
  plugins: {
    // 禁用特定插件
    disabled: ["signal", "matrix"],
    
    // 插件特定配置
    telegram: {
      botToken: "xxx"
    }
  }
}
```

---

## 七、插件开发指南

### 创建新插件

1. **创建目录**：`extensions/my-plugin/`
2. **编写清单**：`openclaw.plugin.json`
3. **实现接口**：根据插件类型实现对应接口
4. **声明依赖**：`package.json`

### 插件接口示例

```typescript
// extensions/my-plugin/index.ts
import type { PluginDefinition } from "@openclaw/plugin-sdk";

export default {
  name: "my-plugin",
  version: "1.0.0",
  type: "channel",
  
  async initialize(context) {
    // 初始化逻辑
  },
  
  async shutdown() {
    // 清理逻辑
  }
} satisfies PluginDefinition;
```

---

## 八、企业定制建议

### 精简插件

| 场景 | 建议移除的插件 |
|-----|---------------|
| 仅内部使用 | 移除所有社交渠道插件 (signal, matrix, nostr) |
| 仅国内使用 | 移除海外渠道 (telegram, discord, slack) |
| 无语音需求 | 移除 talk-voice, elevenlabs |
| 无图像生成 | 移除 image-generation-* |
| 无视频生成 | 移除 video-generation-* |

### 保留核心插件

- **必须保留**：至少一个 Provider 插件
- **建议保留**：memory-lancedb (记忆存储)
- **按需保留**：业务所需的渠道插件

---

## 九、插件与 Skills 的区别

| 概念 | 层次 | 形式 | 用途 |
|-----|------|------|------|
| **Plugins** | 代码级扩展 | TypeScript 模块 | 添加新功能/渠道/Provider |
| **Skills** | 提示词模板 | Markdown 文件 | 指导 AI 如何完成任务 |

Skills 位于工作空间：

```
~/.openclaw/workspace/skills/<skill-name>/SKILL.md
```

可通过 ClawHub (https://clawhub.ai) 分发 Skills。
