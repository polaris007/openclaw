# OpenClaw Transcript 错误检测改进方案

## 🎯 当前问题

`scripts/generate-detailed-issues.ts` 使用**预定义的正则表达式模式**来检测错误，这导致：

1. ✅ **优点**: 准确识别已知错误类型
2. ❌ **缺点**: 无法发现新的、未见过的错误模式
3. ⚠️ **风险**: 可能遗漏重要的新问题

---

## 📊 当前检测覆盖情况

### 已检测的customType

从183个JSONL文件分析中发现的customType：

| customType | 出现次数 | 是否检测 | 说明 |
|-----------|---------|---------|------|
| `openclaw:prompt-error` | ~50+ | ✅ 是 | 主要的错误事件 |
| `model-snapshot` | 大量 | ⚠️ 部分 | 正常事件，但可提取模型信息 |
| `openclaw.sessions_yield` | 少量 | ❌ 否 | 未被检测 |

### 已检测的错误模式

```typescript
const errorPatterns = {
  modelErrors: [...],      // 9个正则模式
  timeoutErrors: [...],    // 7个正则模式
  rateLimitErrors: [...],  // 5个正则模式
  toolErrors: [...],       // 5个正则模式
  permissionErrors: [...], // 6个正则模式
  parsingErrors: [...],    // 5个正则模式
  networkErrors: [...],    // 7个正则模式
};
```

---

## 🔧 改进方案

### 方案1: 未知错误发现机制 (推荐)

**目标**: 自动发现和报告未分类的错误/警告事件

**实现思路**:

```typescript
// 在 analyzeTranscript 函数中添加
function detectUnknownIssues(event: any, lineNum: number): Issue[] {
  const issues: Issue[] = [];
  
  // 1. 检测所有 custom 类型事件
  if (event.type === 'custom' && event.customType) {
    // 检查是否是已知类型
    const isKnown = Object.values(errorPatterns).some(patterns => 
      patterns.some(p => p.test(event.customType))
    );
    
    if (!isKnown && !isNormalEvent(event.customType)) {
      issues.push({
        id: generateId(),
        errorType: 'unknown_custom_event',
        eventType: event.customType,
        description: `发现未知的custom事件类型: ${event.customType}`,
        errorMessage: JSON.stringify(event.data || {}).substring(0, 300),
        causeAnalysis: '这是一个之前未见过的custom事件类型，需要人工分析其含义和影响',
        filePath: currentFilePath,
        sessionId: currentSessionId,
        lineNumber: lineNum,
        timestamp: formatTimestamp(event.timestamp),
        severity: 'MEDIUM',  // 中等优先级，需要关注
        requiresReview: true,  // 标记为需要人工审查
      });
    }
  }
  
  // 2. 检测所有包含 error/fail/warn 关键字的事件
  const eventStr = JSON.stringify(event).toLowerCase();
  const suspiciousKeywords = ['error', 'fail', 'warn', 'exception', 'crash'];
  
  for (const keyword of suspiciousKeywords) {
    if (eventStr.includes(keyword) && !isAlreadyCaptured(event, lineNum)) {
      issues.push({
        errorType: 'suspicious_event',
        eventType: event.type,
        description: `事件中包含可疑关键字: ${keyword}`,
        errorMessage: JSON.stringify(event).substring(0, 500),
        causeAnalysis: `事件内容包含"${keyword}"，但未匹配到已知错误模式`,
        // ... 其他字段
        severity: 'LOW',
        requiresReview: true,
      });
      break;  // 每个事件只报告一次
    }
  }
  
  return issues;
}
```

**优势**:
- ✅ 自动发现新错误类型
- ✅ 标记需要人工审查的事件
- ✅ 不会遗漏潜在问题
- ✅ 可以持续学习和更新模式库

---

### 方案2: 动态模式学习

**目标**: 从历史数据中自动学习错误模式

**实现思路**:

```typescript
// 第一阶段: 收集所有unique的customType和错误消息
const uniqueCustomTypes = new Set<string>();
const uniqueErrorMessages = new Set<string>();

// 扫描所有文件，收集唯一值
for (const file of jsonlFiles) {
  const events = parseFile(file);
  for (const event of events) {
    if (event.type === 'custom' && event.customType) {
      uniqueCustomTypes.add(event.customType);
    }
    
    if (event.data?.error) {
      uniqueErrorMessages.add(normalizeErrorMessage(event.data.error));
    }
  }
}

// 第二阶段: 生成模式建议
console.log('发现以下未分类的customType:');
for (const type of uniqueCustomTypes) {
  if (!isKnownType(type)) {
    console.log(`  - ${type}`);
    console.log(`    建议添加到 errorPatterns 中`);
  }
}

// 第三阶段: 生成配置文件
generatePatternConfig(uniqueCustomTypes, uniqueErrorMessages);
```

**输出示例**:

```json
{
  "suggested_patterns": {
    "newErrorType": [
      "/new.*error/i",
      "/specific.*pattern/i"
    ]
  },
  "unclassified_events": [
    {
      "customType": "openclaw.sessions_yield",
      "count": 15,
      "sample_data": {...},
      "recommendation": "可能是正常事件，建议确认是否需要检测"
    }
  ]
}
```

---

### 方案3: 混合方法 (最佳实践)

结合方案1和方案2的优点：

```typescript
class AdaptiveErrorDetector {
  private knownPatterns: ErrorPatterns;
  private unknownEvents: Map<string, EventStats> = new Map();
  private learningMode: boolean;
  
  constructor(learningMode: boolean = false) {
    this.knownPatterns = loadKnownPatterns();
    this.learningMode = learningMode;
  }
  
  analyzeEvent(event: any, context: AnalysisContext): AnalysisResult {
    // 1. 首先尝试用已知模式匹配
    const knownMatch = this.matchKnownPatterns(event);
    
    if (knownMatch) {
      return {
        type: 'KNOWN',
        category: knownMatch.category,
        issue: this.createIssueFromMatch(knownMatch, event, context),
      };
    }
    
    // 2. 如果是学习模式，记录未知事件
    if (this.learningMode) {
      this.recordUnknownEvent(event, context);
      return {
        type: 'UNKNOWN_LEARNING',
        suggestion: '此事件类型将被记录用于后续分析',
      };
    }
    
    // 3. 否则，标记为需要审查
    return {
      type: 'UNKNOWN_REVIEW',
      issue: this.createReviewIssue(event, context),
    };
  }
  
  // 定期输出学习报告
  generateLearningReport(): LearningReport {
    return {
      totalUnknownEvents: this.unknownEvents.size,
      topUnknownTypes: this.getTopUnknownTypes(10),
      suggestedPatterns: this.suggestNewPatterns(),
      reviewRequired: this.getEventsRequiringReview(),
    };
  }
}
```

---

## 📝 实施步骤

### Phase 1: 立即改进 (1天)

1. ✅ 添加未知事件检测逻辑
2. ✅ 标记所有未分类的custom事件
3. ✅ 生成待审查事件列表
4. ✅ 输出学习报告

### Phase 2: 模式完善 (2-3天)

1. ✅ 分析待审查事件
2. ✅ 添加新的检测模式
3. ✅ 更新原因分析逻辑
4. ✅ 测试覆盖率验证

### Phase 3: 自动化学习 (可选，1周)

1. ✅ 实现动态模式学习
2. ✅ 建立模式建议系统
3. ✅ 集成到CI/CD流程
4. ✅ 定期自动更新模式库

---

## 🎯 预期效果

### 改进前

- 只能检测**预定义的7类错误**
- 新错误类型**完全遗漏**
- 需要**手动维护**检测模式

### 改进后

- 检测**所有异常事件**（已知+未知）
- 自动**发现新模式**
- **智能建议**添加新规则
- 持续**学习和优化**

---

## 📊 监控指标

跟踪以下指标来评估改进效果：

| 指标 | 改进前 | 改进后目标 |
|------|--------|-----------|
| 错误检测覆盖率 | ~80% (估计) | >95% |
| 未知事件数量 | 未知 | <5% 总事件 |
| 新模式发现速度 | 手动(数周) | 自动(数天) |
| 误报率 | - | <2% |
| 人工审查工作量 | 高 | 降低50% |

---

## 🔗 相关文件

- 当前检测脚本: `scripts/generate-detailed-issues.ts`
- 检测结果: `mydocs/transcript-issues-detailed.md`
- 分析报告: `mydocs/transcript-analysis-report.md`

---

**建议**: 优先实施方案1（未知错误发现机制），可以快速实施且立即见效。方案2和3可以作为长期优化方向。
