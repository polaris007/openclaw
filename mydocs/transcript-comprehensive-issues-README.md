# OpenClaw Transcript 综合问题检测报告使用说明

## 📋 文档说明

本文档是使用 `scripts/detect-all-transcript-issues.ts` 脚本生成的OpenClaw会话转录文件（transcript）的综合问题检测报告。

**报告文件**: `mydocs/transcript-comprehensive-issues.md`  
**生成脚本**: `scripts/detect-all-transcript-issues.ts`

---

## 🔍 检测逻辑

本脚本合并了三种检测逻辑，全面覆盖对话过程中的各类问题：

### 0. 系统消息过滤（新增）

**自动忽略系统生成的user消息**，例如：
- 会话启动提示（"A new session was started via /new or /reset"）
- Session Startup sequence指令
- HEARTBEAT.md读取提示
- 内部上下文标记（`<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>>`）
- 系统状态消息（以 "System: [" 开头）

这样可以确保只分析真实的用户输入，避免误报。

### 1. 对话流程完整性检测（核心新增）

基于以下三条规则检测对话流程是否完整：

| 规则 | 说明 | 错误类型 |
|------|------|---------|
| **user → assistant** | 用户提问后必须有AI回复 | `flow_integrity_no_reply` |
| **toolCall → toolResult** | 工具调用后必须有执行结果 | `flow_integrity_missing_tool_result` |
| **toolResult → assistant** | 工具执行后必须有最终回复 | `flow_integrity_missing_final_answer` |

**不满足以上任一条，就认为这次对话有问题。**

**特殊规则**: 
- `sessions_yield` 工具结果会被跳过检测，因为该工具用于异步任务提交，不需要立即返回最终答案。
- **并行工具调用**：多个连续的 `toolResult` 后面跟着一个 `assistant` 是正常的（例如同时调用5个read工具），不会被标记为问题。只有当 `toolResult` 后面既不是 `assistant` 也不是另一个 `toolResult` 时才会报错。

### 2. 已知错误模式检测

通过正则表达式匹配以下7类错误：

- `modelErrors` - 模型API错误
- `timeoutErrors` - 超时错误
- `rateLimitErrors` - 速率限制错误
- `toolErrors` - 工具执行错误
- `permissionErrors` - 权限错误
- `parsingErrors` - 解析错误
- `networkErrors` - 网络错误

### 3. 异常停止检测

检测assistant消息的`stopReason`字段，识别非正常停止：
- `aborted` - 请求被中止
- `error` - 发生错误
- 其他非标准值（正常值为：`stop`, `toolUse`, `length`）

---

## 📝 报告格式

每个问题记录包含以下字段：

```markdown
### 问题 #N

- **错误类型**: `错误类型代码`
- **事件类型**: `事件类型（message/custom等）`
- **描述**: 问题的简要描述
- **用户输入**: `触发该问题的用户输入内容` （仅flow_integrity类型）
- **错误信息**: ```
  具体的错误信息或上下文
  ```
- **原因分析**: 可能的原因列表
- **文件位置**: `相对文件路径`
- **Session ID**: `会话ID`
- **行号**: JSONL文件中的行号
- **时间戳**: 问题发生的时间
- **Run ID**: （如果可用）运行ID
- **Provider**: （如果可用）模型提供商
- **Model**: （如果可用）模型名称
```

**特点**:
- ✅ 一个问题一条记录
- ✅ 按问题类型分组，便于批量分析
- ✅ 包含完整的上下文信息（流程完整性错误会提取错误行和下一行的内容）
- ✅ **提取用户输入**：对于flow_integrity类型的三个问题（no_reply、missing_tool_result、missing_final_answer），自动从当前或最近的user消息中提取用户输入内容（最长200字符），便于快速理解问题背景和复现步骤
- ✅ **系统消息过滤**：自动忽略系统生成的user消息（如会话启动提示），只统计真实用户对话轮数
- ✅ **对话轮数统计**：在报告概览中显示总对话轮数（排除系统消息），帮助了解实际交互规模
- ✅ **有问题轮数统计**：统计存在任何类型问题的对话轮数（包括flow_integrity、modelErrors、timeoutErrors等所有类型），并计算问题率（有问题轮数/总对话轮数）。同一轮次的多个问题只计为1轮，避免重复计数
- ✅ 便于追踪和定位问题

---

## 🎯 如何使用

### 1. 查看整体情况

打开报告文件，首先查看顶部的"统计概览"部分，了解：
- 总问题数
- 各类型问题分布
- 严重程度分布

### 2. 按问题类型查看

报告按问题类型分组，每个类型包含所有相关问题：
- `flow_integrity_missing_final_answer` - 工具执行后无最终回复
- `abnormal_stop` - 异常停止
- `modelErrors` - 模型API错误
- `flow_integrity_missing_tool_result` - 工具调用后无执行结果
- `timeoutErrors` - 超时错误
- `flow_integrity_no_reply` - 用户提问后无回复

### 3. 定位具体问题

对于每个问题，可以通过以下信息快速定位：
- **文件位置**: 找到对应的JSONL文件
- **行号**: 直接跳转到具体行
- **Session ID**: 在系统中搜索该会话
- **时间戳**: 确定问题发生的时间点

### 4. 分析原因

每个问题都包含了"原因分析"字段，列出了可能的原因，帮助快速诊断。

### 5. 重新运行检测

如果修复了问题或收集了新的transcript文件，可以重新运行脚本生成最新报告：

```bash
# 使用默认路径 (logs/session-transcript/openclaw-logs)
bun scripts/detect-all-transcript-issues.ts

# 指定自定义路径
bun scripts/detect-all-transcript-issues.ts /path/to/your/transcripts
```

**报告输出位置**: 脚本所在目录 (`scripts/transcript-comprehensive-issues.md`)

---

## 🔧 脚本技术细节

### 检测流程

1. **扫描文件**: 递归查找`logs/session-transcript/openclaw-logs`目录下所有`.jsonl`文件
2. **解析消息**: 提取所有`message`和`custom`类型的事件
3. **执行检测**:
   - 流程完整性检测
   - 已知错误模式匹配
   - 异常停止检查
4. **生成报告**: 输出Markdown格式的详细报告

### 关键优化

- **排除误报**: 只对`role: "assistant"`的消息且**仅检查errorMessage字段**进行错误模式匹配，避免将content中的命令行参数、代码注释等文本误判为错误
- **特殊规则**: 
  - 跳过`sessions_yield`工具结果的流程完整性检测（该工具用于异步任务提交，不需要立即返回最终答案）
  - **支持并行工具调用**：多个连续的 `toolResult` 后面跟着一个 `assistant` 是正常的中间状态，不会被标记为问题。只有当 `toolResult` 后面既不是 `assistant` 也不是另一个 `toolResult` 时才会报错
  - **避免重复统计**：
    - 如果 `user` 消息后的下一条是 `openclaw:prompt-error` 等错误事件，跳过流程完整性检测，因为这些错误已经在 `detectKnownErrors` 中被统计为 `modelErrors`
    - 如果 `toolResult` 后面是 `openclaw:prompt-error` 等错误事件，跳过流程完整性检测，因为这些错误已经在 `detectKnownErrors` 中被统计为 `modelErrors` 或 `timeoutErrors`
    - 如果 `toolCall` 后的下一条消息是 `openclaw:prompt-error` 等错误事件，说明 toolCall 被中止，跳过检测以避免与 `detectKnownErrors` 重复统计
  - **跳过中止的toolCall**：
    - 如果 assistant 消息的 `stopReason` 是 `aborted` 或 `error`，说明 toolCall 未执行，跳过 toolResult 检测
- **全面扫描**: 检测所有包含`.jsonl`的文件名（包括`.jsonl.reset.*`等Reset归档文件），确保不遗漏任何会话日志
- **准确提取Session ID**: 从JSONL文件的第一个`session`事件中提取，而非依赖文件名
- **去重机制**: 每个事件只匹配一次错误类型，避免重复报告
- **上下文提取**: 对于流程完整性错误，自动提取错误行和下一行的原始内容，便于快速诊断
- **用户输入提取**: 对于flow_integrity类型的三个问题（no_reply、missing_tool_result、missing_final_answer），自动从当前或最近的user消息中提取用户输入内容（最长200字符），便于快速理解问题背景和复现步骤
- **跨平台支持**: 报告生成在脚本所在目录，支持通过命令行参数指定任意扫描路径，方便在其他机器上执行
- **精确匹配**: HTTP状态码429和403使用单词边界`\b429\b`和`\b403\b`匹配，避免误匹配UUID、时间戳或其他数字序列中的数字

---

## 📈 改进建议

根据检测结果，可以考虑以下改进方向：

### 1. 处理flow_integrity问题 (30个)
- **missing_tool_result (15个)**: 检查工具执行的可靠性，确保每个toolCall都有对应的toolResult
- **no_reply (13个)**: 调查会话中断的根本原因，增强错误恢复机制
- **missing_final_answer (2个)**: 确保工具执行后Always生成文本解释

### 2. 降低abnormal_stop (168个)
- 分析`aborted`和`error`停止的具体场景
- 实现更优雅的取消机制
- 添加失败恢复逻辑

### 3. 解决modelErrors (105个)
- 优化模型API调用的错误处理
- 增加重试机制和退避策略
- 监控模型服务可用性

### 4. 减少timeoutErrors (23个)
- 实现动态超时策略
- 添加请求排队和退避机制
- 优化长耗时操作的Checkpoint机制

---

## 📂 相关文件

- **检测脚本**: `scripts/detect-all-transcript-issues.ts`
- **检测报告**: `mydocs/transcript-comprehensive-issues.md`
- **早期分析**: `mydocs/transcript-analysis-report.md`
- **检测方法分析**: `mydocs/unhandled-issue-detection-analysis.md`
- **改进方案**: `mydocs/transcript-error-detection-improvement.md`

---

## ❓ 常见问题

### Q1: 为什么报告不按优先级分类？

A: 按问题类型分类更有利于：
- 批量分析同一类问题的根本原因
- 针对性地制定修复策略
- 避免优先级判断的主观性
- 更清晰地看到各类问题的分布情况

### Q2: 如何验证检测结果的准确性？

A: 可以随机抽取几个问题，手动检查对应的JSONL文件：
1. 找到报告中提到的文件和行号
2. 查看该行及其上下文的实际内容
3. 验证问题描述是否准确

### Q3: 能否自定义检测规则？

A: 可以修改脚本中的以下内容：
- `errorPatterns`对象：添加或修改错误匹配模式
- `detectFlowIntegrity`函数：调整流程完整性检测规则
- `isSystemGeneratedUserMessage`函数：修改系统消息识别规则
- `analyzeCause`函数：定制原因分析逻辑

### Q4: 报告文件太大怎么办？

A: 可以使用以下方法：
- 使用Markdown编辑器打开（支持大文件）
- 使用`grep`命令搜索特定问题类型
- 修改脚本，按问题类型分别生成多个报告

---

**最后更新**: 2026-04-17（新增系统消息过滤、对话轮数统计和有问题轮数统计，有问题轮数涵盖所有问题类型）  
**维护者**: OpenClaw Team
