# OpenClaw 工具系统

## 一、工具分类概览

OpenClaw 内置丰富的工具集，按功能分类如下：

```
┌─────────────────────────────────────────────────────────────────┐
│                       工具分类                                   │
├─────────────────────────────────────────────────────────────────┤
│  核心工具     │ bash, read, write, edit, process               │
│  会话管理     │ sessions_list, sessions_history, sessions_send │
│              │ sessions_spawn, sessions_yield, session_status  │
│  网络/浏览器  │ web_search, web_fetch, browser                 │
│  生成类       │ image_generate, video_generate, music_generate │
│  多媒体       │ tts, pdf                                       │
│  设备控制     │ nodes                                          │
│  定时任务     │ cron                                           │
│  Agent 管理   │ agents_list, subagents                         │
│  其他         │ gateway, canvas, update_plan                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、核心工具

### 文件操作工具

| 工具 | 功能 | 参数示例 |
|-----|------|---------|
| `read` | 读取文件 | `{ path: "/path/to/file" }` |
| `write` | 写入文件 | `{ path: "/path/to/file", content: "..." }` |
| `edit` | 编辑文件 | `{ path: "...", old_string: "...", new_string: "..." }` |

### 命令执行工具

| 工具 | 功能 | 参数示例 |
|-----|------|---------|
| `bash` | 执行 shell 命令 | `{ command: "ls -la" }` |
| `process` | 进程管理 | `{ action: "list" | "kill", pid: 123 }` |

---

## 三、会话管理工具

用于多 Agent 通信和会话管理：

| 工具 | 功能 | 说明 |
|-----|------|------|
| `sessions_list` | 列出所有会话 | 查看活跃会话列表 |
| `sessions_history` | 查看会话历史 | 读取其他会话的消息历史 |
| `sessions_send` | 发送消息 | 向其他会话发送消息 |
| `sessions_spawn` | 生成子 Agent | 创建新的子 Agent 会话 |
| `sessions_yield` | 让出控制 | 子 Agent 让出控制权 |
| `session_status` | 查看会话状态 | 获取会话当前状态 |

### 使用示例

```typescript
// 列出所有会话
sessions_list({ agentId: "*", status: "active" })

// 查看其他会话历史
sessions_history({ sessionKey: "agent:sales:main", limit: 50 })

// 向其他会话发送消息
sessions_send({ 
  sessionKey: "agent:sales:main", 
  message: "客户询问产品价格" 
})

// 生成子 Agent
sessions_spawn({
  agentId: "dev",
  message: "Write unit tests for auth module",
  tools: ["bash", "edit", "read"]
})
```

---

## 四、网络工具

### web_search

搜索互联网获取实时信息：

```typescript
web_search({
  query: "OpenAI GPT-4 最新功能",
  count: 10,
  freshness: "week"  // day, week, month, year
})
```

**配置方式**：

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "brave",  // brave, perplexity, google
        maxResults: 10,
        timeoutSeconds: 30
      }
    }
  }
}
```

### web_fetch

抓取网页内容：

```typescript
web_fetch({
  url: "https://example.com/article",
  maxChars: 50000
})
```

### browser

控制浏览器进行交互：

```typescript
browser_navigate({ url: "https://example.com" })
browser_snapshot()  // 获取页面快照
browser_click({ uid: "element-uid" })
browser_fill({ uid: "input-uid", value: "text" })
```

---

## 五、生成类工具

| 工具 | 功能 | 配置 |
|-----|------|------|
| `image_generate` | 生成图片 | 需要 image-generation 插件 |
| `video_generate` | 生成视频 | 需要 video-generation 插件 |
| `music_generate` | 生成音乐/音频 | 需要 music-generation 插件 |

### 使用示例

```typescript
image_generate({
  prompt: "A sunset over mountains",
  size: "1024x1024",
  style: "realistic"
})
```

---

## 六、多媒体工具

### tts (文字转语音)

```typescript
tts({
  text: "Hello, world!",
  voice: "default",
  speed: 1.0
})
```

### pdf (PDF 处理)

```typescript
// 读取 PDF
pdf({ action: "read", path: "/path/to/file.pdf" })

// 生成 PDF
pdf({ action: "generate", content: "...", output: "/path/to/output.pdf" })
```

---

## 七、设备控制工具

### nodes

控制 iOS/Android 移动设备：

```typescript
// 获取设备列表
nodes({ action: "list" })

// 控制设备
nodes({ 
  action: "camera", 
  deviceId: "xxx",
  command: "capture"
})
```

**支持的能力**：
- camera: 拍照
- screen.record: 屏幕录制
- location.get: 获取位置

---

## 八、定时任务工具

### cron

创建和管理定时任务：

```typescript
// 创建定时任务
cron({
  action: "create",
  schedule: "0 9 * * *",  // 每天 9 点
  command: "send_daily_report"
})

// 列出任务
cron({ action: "list" })

// 删除任务
cron({ action: "delete", jobId: "xxx" })
```

---

## 九、工具权限控制

### 配置方式

```json5
{
  tools: {
    // 基础配置
    profile: "minimal",  // minimal, coding, messaging, full
    
    // 允许列表
    allow: ["read", "write", "bash"],
    
    // 额外允许（追加到 allow）
    alsoAllow: ["web_search"],
    
    // 拒绝列表
    deny: ["browser", "nodes"]
  }
}
```

### Agent 级别配置

```json5
{
  agents: {
    list: [
      {
        id: "main",
        tools: {
          allow: ["*"]  // 允许所有工具
        }
      },
      {
        id: "sales",
        tools: {
          allow: ["sessions_send", "sessions_list"],
          deny: ["bash", "browser"]  // 禁用危险工具
        }
      }
    ]
  }
}
```

### Sandbox 沙箱配置

```json5
{
  tools: {
    sandbox: {
      tools: {
        allow: ["read", "write", "edit"],
        deny: ["bash", "browser", "nodes", "cron"]
      }
    }
  }
}
```

---

## 十、工具禁用机制

### 1. 功能级禁用

针对特定工具的专用配置：

```json5
{
  tools: {
    web: {
      search: {
        enabled: false  // 禁用 web_search
      },
      fetch: {
        enabled: false  // 禁用 web_fetch
      }
    }
  }
}
```

### 2. 权限级禁用

通用权限控制：

```json5
{
  tools: {
    deny: ["web_search", "browser", "nodes"]
  }
}
```

### 3. Provider 级禁用

按模型提供商禁用：

```json5
{
  tools: {
    byProvider: {
      "openai": {
        deny: ["bash"]
      },
      "deepseek": {
        allow: ["read", "write", "edit"]
      }
    }
  }
}
```

---

## 十一、工具 Profile 预设

OpenClaw 提供内置 Profile：

| Profile | 包含的工具 |
|---------|-----------|
| `minimal` | 基础工具：read, write, edit |
| `coding` | 编程工具：+ bash, process, web_search |
| `messaging` | 消息工具：sessions_*, message |
| `full` | 所有工具 |

使用方式：

```json5
{
  tools: {
    profile: "coding",
    alsoAllow: ["browser"]  // 追加工具
  }
}
```

---

## 十二、工具开发扩展

### 创建自定义工具

```typescript
// 在 src/agents/tools/ 下创建
export function createMyCustomTool(): AnyAgentTool {
  return {
    label: "My Custom Tool",
    name: "my_custom",
    description: "Does something custom",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string" }
      }
    },
    execute: async (_toolCallId, args, signal) => {
      // 实现逻辑
      return { result: "..." };
    }
  };
}
```

### 注册工具

在 `src/agents/openclaw-tools.ts` 中注册：

```typescript
import { createMyCustomTool } from "./tools/my-custom.js";

// 在工具列表中添加
const tools = [
  // ...existing tools
  createMyCustomTool()
];
```

---

## 十三、企业安全建议

### 生产环境推荐配置

```json5
{
  tools: {
    profile: "minimal",
    
    // 仅允许必要工具
    allow: ["read", "write", "edit", "web_search"],
    
    // 禁用危险工具
    deny: [
      "bash",        // 禁止命令执行
      "browser",     // 禁止浏览器操作
      "nodes",       // 禁止设备控制
      "cron",        // 禁止定时任务
      "process"      // 禁止进程管理
    ],
    
    // 文件系统限制
    fs: {
      workspaceOnly: true  // 仅限工作空间
    },
    
    // 循环检测
    loopDetection: {
      enabled: true,
      criticalThreshold: 20
    }
  }
}
```

### 按场景配置

| 场景 | 允许工具 | 禁用工具 |
|-----|---------|---------|
| 文档助手 | read, write, edit, web_search | bash, browser, nodes |
| 代码助手 | read, write, edit, bash, web_search | nodes, cron |
| 客服助手 | sessions_*, message | bash, browser, nodes |
| 数据分析 | read, bash, web_fetch | browser, nodes, cron |
