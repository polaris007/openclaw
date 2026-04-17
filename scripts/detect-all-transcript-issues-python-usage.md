# OpenClaw Transcript 问题检测器 (Python 2.7 版本)

## 功能说明

这是一个用于检测 OpenClaw Session Transcript 文件中各种问题的综合工具，支持 Python 2.7。

### 检测内容

1. **对话流程完整性检测**
   - user → assistant：用户提问后是否有回复
   - toolCall → toolResult：工具调用后是否有执行结果
   - toolResult → assistant：工具执行后是否有最终回复

2. **已知错误模式检测**
   - 模型API错误 (modelErrors)
   - 超时错误 (timeoutErrors)
   - 速率限制错误 (rateLimitErrors)
   - 工具执行错误 (toolErrors)
   - 权限错误 (permissionErrors)
   - 解析错误 (parsingErrors)
   - 网络错误 (networkErrors)

3. **异常停止检测**
   - 检测非正常的 stopReason（如 aborted、error 等）

## 安装依赖

无需额外依赖，仅使用 Python 2.7 标准库：
- `os`
- `sys`
- `re`
- `json`
- `random`
- `datetime`

## 使用方法

### 基本用法

```bash
python detect-all-transcript-issues.py
```

默认扫描路径：`logs/session-transcript/openclaw-logs`

### 自定义路径

```bash
python detect-all-transcript-issues.py /path/to/transcript/dir
```

或使用相对路径：

```bash
python detect-all-transcript-issues.py ../my-transcripts
```

## 输出文件

脚本会在 scripts 目录下生成报告文件：
- `transcript-comprehensive-issues.md`：详细的 Markdown 格式检测报告

## 报告内容

### 统计概览
- 总问题数
- 总对话轮数（排除系统消息）
- 有问题轮数
- 问题率（有问题轮数 / 总对话轮数）

### 问题类型分布
以表格形式展示各类型问题的数量

### 详细问题列表
每个问题包含：
- 事件类型
- 描述
- 用户输入（针对流程完整性问题）
- 错误信息
- 原因分析
- 文件位置
- Session ID
- 行号
- 时间戳
- Run ID（如有）
- Provider（如有）
- Model（如有）

## 与 Node.js 版本的差异

本 Python 版本与 `detect-all-transcript-issues.cjs` 功能完全一致，主要差异：

| 特性 | Node.js 版本 | Python 版本 |
|------|-------------|------------|
| 运行环境 | Node.js | Python 2.7 |
| 依赖管理 | npm/pnpm | 无外部依赖 |
| 编码处理 | UTF-8 默认 | 需要显式声明 |
| 异步处理 | async/await | 同步执行 |
| 性能 | 较快（V8引擎） | 较慢（解释型） |

## Python 2.7 兼容性说明

本脚本已针对 Python 2.7 进行了以下适配：

1. **编码声明**：文件头部添加 `# -*- coding: utf-8 -*-`
2. **print 函数**：使用 `from __future__ import print_function`
3. **字符串类型**：使用 `basestring` 进行类型检查
4. **字典访问**：使用 `.get()` 方法避免 KeyError
5. **格式化字符串**：使用 `%` 格式化而非 f-string
6. **正则表达式**：使用 `re.compile()` 预编译模式
7. **JSON 处理**：使用 `json.dumps()` 和 `json.loads()`
8. **集合去重**：使用 `set()` 数据类型
9. **文件操作**：使用 `with open()` 上下文管理器

## 故障排除

### 问题1：中文显示乱码

**解决方案**：确保终端支持 UTF-8 编码

Windows PowerShell：
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

Linux/Mac：
```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

### 问题2：找不到 transcript 目录

**错误信息**：
```
❌ Transcript directory not found: /path/to/logs/session-transcript/openclaw-logs
```

**解决方案**：
- 确认当前工作目录是否正确
- 使用绝对路径指定 transcript 目录
- 检查目录是否存在且有读取权限

### 问题3：内存不足

如果处理的文件数量非常大，可能导致内存不足。

**解决方案**：
- 分批处理文件
- 增加系统可用内存
- 考虑使用 Node.js 版本（性能更好）

### 问题4：Python 版本不兼容

**错误信息**：
```
SyntaxError: invalid syntax
```

**解决方案**：
确认使用的是 Python 2.7：
```bash
python --version
```

如果不是 2.7，请使用正确的 Python 解释器：
```bash
python2.7 detect-all-transcript-issues.py
```

## 注意事项

1. **性能**：Python 版本相比 Node.js 版本会慢一些，特别是在处理大量文件时
2. **编码**：所有文件读写都使用 UTF-8 编码
3. **路径分隔符**：自动处理 Windows (`\`) 和 Unix (`/`) 路径分隔符
4. **大文件处理**：逐行读取 JSONL 文件，不会一次性加载整个文件到内存
5. **文件过滤**：处理所有包含 `.jsonl` 的文件，包括 `.jsonl.reset`、`.jsonl.deleted` 等归档文件
6. **路径规范化**：自动解析路径中的 `..` 符号，确保正确扫描所有子目录

## 示例输出

```
📂 使用默认路径: d:\workplace\github\openclaw\scripts\..\logs\session-transcript\openclaw-logs

🔍 开始扫描transcript文件...

找到 150 个JSONL文件

已处理 50/150 个文件，发现问题 120 个...
已处理 100/150 个文件，发现问题 245 个...
已处理 150/150 个文件，发现问题 367 个...

✅ 分析完成！共发现 367 个问题

📄 报告已保存到: d:\workplace\github\openclaw\scripts\transcript-comprehensive-issues.md

📊 问题类型统计:
  - modelErrors: 150
  - flow_integrity_no_reply: 85
  - timeoutErrors: 62
  - abnormal_stop: 45
  - flow_integrity_missing_tool_result: 15
  - flow_integrity_missing_final_answer: 10

🎯 严重程度统计:
  - HIGH: 280
  - MEDIUM: 87
  - LOW: 0
```

## 维护者

本脚本由 OpenClaw 社区维护，与 Node.js 版本保持功能同步。

如需报告问题或提出改进建议，请访问：
https://github.com/openclaw/openclaw/issues
