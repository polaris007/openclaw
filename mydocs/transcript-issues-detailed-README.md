# OpenClaw Session Transcript 问题清单使用说明

## 📄 文档说明

本文档 (`transcript-issues-detailed.md`) 包含了从183个session transcript文件中提取的**所有130个问题**的详细记录。

---

## 📊 统计信息

- **总问题数**: 130个
- **涉及会话**: 41个
- **涉及文件**: 41个

### 问题分布

| 错误类型 | 数量 | 占比 |
|---------|------|------|
| warning (警告) | 78 | 60.0% |
| modelErrors (模型错误) | 30 | 23.1% |
| timeoutErrors (超时错误) | 22 | 16.9% |

---

## 📋 每条记录包含的信息

每个问题都作为**独立的记录**，包含以下完整信息：

1. **错误类型** (`errorType`): modelErrors, timeoutErrors, warning等
2. **事件类型** (`eventType`): 具体的事件名称，如 `openclaw:prompt-error`, `abnormal_stop`
3. **描述** (`description`): 问题的简要描述
4. **错误信息** (`errorMessage`): 当时的具体错误内容
5. **原因分析** (`causeAnalysis`): 对问题根本原因的详细分析
6. **文件位置** (`filePath`): 问题所在的transcript文件路径（相对于项目根目录）
7. **Session ID** (`sessionId`): 会话的唯一标识符
8. **行号** (`lineNumber`): 错误在文件中的具体行号
9. **时间戳** (`timestamp`): 问题发生的时间
10. **Run ID** (`runId`): 请求运行的ID（如果可用）
11. **Provider** (`provider`): 使用的模型提供商
12. **Model** (`model`): 使用的模型名称
13. **Stop Reason** (`stopReason`): 如果是异常停止，包含停止原因

---

## 🔍 如何使用

### 1. 查找特定类型的问题

使用Markdown阅读器或文本编辑器的搜索功能：

```bash
# 查找所有模型错误
grep "错误类型.*modelErrors" transcript-issues-detailed.md

# 查找所有超时错误
grep "错误类型.*timeoutErrors" transcript-issues-detailed.md

# 查找特定Session的问题
grep "Session ID.*your-session-id" transcript-issues-detailed.md
```

### 2. 定位具体问题文件

每条记录都包含完整的文件路径和行号，可以直接打开查看：

```bash
# 示例：打开问题#1所在的文件并跳转到第67行
code logs/session-transcript/openclaw-logs/.../2b9f7ba4-e50c-4f33-bf96-85367fa6cebf.jsonl +67
```

### 3. 按时间分析问题

所有记录都包含时间戳，可以按时间顺序追踪问题的发生模式。

### 4. 关联分析

通过Session ID和Run ID可以关联同一个会话中的多个相关问题。

---

## 🛠️ 重新生成文档

如果需要重新分析或更新文档，运行：

```bash
cd d:\workplace\github\openclaw
node scripts/generate-detailed-issues.ts
```

这会：
1. 扫描所有JSONL文件
2. 提取所有问题和警告
3. 为每个问题生成详细记录
4. 输出到 `mydocs/transcript-issues-detailed.md`

---

## 📝 记录格式示例

```markdown
### 问题 #1

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
This operation was aborted
```
- **原因分析**: 请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消
- **文件位置**: `logs/session-transcript/openclaw-logs/.../2b9f7ba4-e50c-4f33-bf96-85367fa6cebf.jsonl`
- **Session ID**: `2b9f7ba4-e50c-4f33-bf96-85367fa6cebf`
- **行号**: 67
- **时间戳**: 2026-04-13T08:22:43.124Z
- **Run ID**: `bc2b3f7b-2fae-4774-92b5-a36dc673385d`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---
```

---

## ⚠️ 注意事项

1. **一个问题一条记录**: 即使是同类型的错误，也会分别列出，每条都有独立的编号
2. **完整信息**: 每条记录都包含尽可能多的上下文信息，便于问题排查
3. **相对路径**: 文件路径使用相对于项目根目录的路径，便于定位
4. **自动排序**: 问题按类型分组，然后在组内按发现顺序排列

---

## 🔗 相关文档

- [README-transcript-analysis.md](./README-transcript-analysis.md) - 分析总结
- [transcript-analysis-report.md](./transcript-analysis-report.md) - 完整分析报告
- [transcript-technical-analysis.md](./transcript-technical-analysis.md) - 技术分析与改进方案

---

**生成时间**: 2026-04-16  
**分析工具**: `scripts/generate-detailed-issues.ts`  
**数据源**: `logs/session-transcript/openclaw-logs/` (183个文件)
