# OpenClaw Transcript 综合问题检测报告使用说明

## 📋 文档说明

本文档是使用 `scripts/detect-all-transcript-issues.ts` 脚本生成的OpenClaw会话转录文件（transcript）的综合问题检测报告。

**报告文件**: `mydocs/transcript-comprehensive-issues.md`  
**生成脚本**: `scripts/detect-all-transcript-issues.ts`

---

## 🔍 检测逻辑

本脚本合并了三种检测逻辑，全面覆盖对话过程中的各类问题：

### 1. 对话流程完整性检测（核心新增）

基于以下三条规则检测对话流程是否完整：

| 规则 | 说明 | 错误类型 |
|------|------|---------|
| **user → assistant** | 用户提问后必须有AI回复 | `flow_integrity_no_reply` |
| **toolCall → toolResult** | 工具调用后必须有执行结果 | `flow_integrity_missing_tool_result` |
| **toolResult → assistant** | 工具执行后必须有最终回复 | `flow_integrity_missing_final_answer` |

**不满足以上任一条，就认为这次对话有问题。**

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

## 📊 当前统计结果

**扫描文件数**: 183个JSONL文件  
**总问题数**: 341个

### 问题类型分布

| 问题类型 | 数量 | 占比 | 说明 |
|---------|------|------|------|
| flow_integrity_missing_final_answer | 207 | 60.7% | 工具执行后无最终回复 |
| abnormal_stop | 78 | 22.9% | 异常停止 |
| modelErrors | 30 | 8.8% | 模型API错误 |
| timeoutErrors | 22 | 6.5% | 超时错误 |
| flow_integrity_no_reply | 2 | 0.6% | 用户提问后无回复 |
| flow_integrity_missing_tool_result | 1 | 0.3% | 工具调用后无执行结果 |
| permissionErrors | 1 | 0.3% | 权限错误 |

### 严重程度分布

- **🔴 高优先级 (HIGH)**: 134个 (39.3%)
- **🟡 中优先级 (MEDIUM)**: 207个 (60.7%)
- **🟢 低优先级 (LOW)**: 0个 (0%)

---

## 📝 报告格式

每个问题记录包含以下字段：

```markdown
### 问题 #N

- **错误类型**: `错误类型代码`
- **事件类型**: `事件类型（message/custom等）`
- **描述**: 问题的简要描述
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
- ✅ 即使是同类型的问题也分开记录
- ✅ 包含完整的上下文信息
- ✅ 便于追踪和定位问题

---

## 🎯 如何使用

### 1. 查看整体情况

打开报告文件，首先查看顶部的"统计概览"部分，了解：
- 总问题数
- 各类型问题分布
- 严重程度分布

### 2. 优先处理高优先级问题

滚动到"🔴 高优先级问题"部分，这些问题需要优先关注和解决：
- 对话流程中断（user无回复、toolCall无结果等）
- 模型API错误
- 超时错误
- 异常停止

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
cd d:\workplace\github\openclaw
bun scripts/detect-all-transcript-issues.ts
```

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
- **特殊规则**: 跳过`sessions_yield`工具结果的流程完整性检测（该工具用于异步任务，不需要立即返回最终答案）
- **准确提取Session ID**: 从JSONL文件的第一个`session`事件中提取，而非依赖文件名
- **去重机制**: 每个事件只匹配一次错误类型，避免重复报告

---

## 📈 改进建议

根据检测结果，可以考虑以下改进方向：

### 1. 处理flow_integrity问题 (214个)
- **missing_final_answer (211个)**: 确保工具执行后Always生成文本解释
- **no_reply (2个)**: 调查会话中断的根本原因
- **missing_tool_result (1个)**: 检查工具执行的可靠性

### 2. 降低abnormal_stop (78个)
- 分析`aborted`和`error`停止的具体场景
- 实现更优雅的取消机制
- 添加失败恢复逻辑

### 3. 解决modelErrors (30个)
- 优化模型API调用的错误处理
- 增加重试机制和退避策略
- 监控模型服务可用性

### 4. 减少timeoutErrors (22个)
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

### Q1: 为什么有些问题是中优先级而不是高优先级？

A: `flow_integrity_missing_final_answer`被标记为中优先级，因为：
- 可能是多轮工具调用的中间状态
- 不一定是真正的错误，可能是正常的对话流程
- 需要人工判断是否确实缺少最终答案

### Q2: 如何验证检测结果的准确性？

A: 可以随机抽取几个问题，手动检查对应的JSONL文件：
1. 找到报告中提到的文件和行号
2. 查看该行及其上下文的实际内容
3. 验证问题描述是否准确

### Q3: 能否自定义检测规则？

A: 可以修改脚本中的以下内容：
- `errorPatterns`对象：添加或修改错误匹配模式
- `detectFlowIntegrity`函数：调整流程完整性检测规则
- `analyzeCause`函数：定制原因分析逻辑

### Q4: 报告文件太大怎么办？

A: 可以使用以下方法：
- 使用Markdown编辑器打开（支持大文件）
- 使用`grep`命令搜索特定问题类型
- 修改脚本，按问题类型分别生成多个报告

---

**最后更新**: 2026-04-16  
**维护者**: OpenClaw Team
