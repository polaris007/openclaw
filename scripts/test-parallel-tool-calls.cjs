/**
 * 测试并行工具调用检测逻辑
 */

const fs = require('fs');
const path = require('path');

// 模拟消息序列
const testCases = [
  {
    name: '正常并行工具调用：多个toolResult后跟assistant',
    messages: [
      { role: 'user' },
      { role: 'assistant', hasToolCall: true },
      { role: 'toolResult' },
      { role: 'toolResult' },
      { role: 'toolResult' },
      { role: 'assistant' }, // ✅ 正常
    ],
    expectedIssues: 0,
  },
  {
    name: '异常情况：toolResult后跟user',
    messages: [
      { role: 'user' },
      { role: 'assistant', hasToolCall: true },
      { role: 'toolResult' },
      { role: 'user' }, // ❌ 异常
    ],
    expectedIssues: 1,
  },
  {
    name: '异常情况：toolResult是最后一条消息',
    messages: [
      { role: 'user' },
      { role: 'assistant', hasToolCall: true },
      { role: 'toolResult' }, // ❌ 文件结束
    ],
    expectedIssues: 1,
  },
  {
    name: '正常情况：单个toolResult后跟assistant',
    messages: [
      { role: 'user' },
      { role: 'assistant', hasToolCall: true },
      { role: 'toolResult' },
      { role: 'assistant' }, // ✅ 正常
    ],
    expectedIssues: 0,
  },
];

function hasToolCall(event) {
  return event.hasToolCall || false;
}

function detectFlowIntegrity(messages) {
  const issues = [];
  
  for (let i = 0; i < messages.length; i++) {
    const current = { event: { message: messages[i] } };
    const next = messages[i + 1] ? { event: { message: messages[i + 1] } } : null;
    
    // 规则3: toolResult后面必须要有assistant或另一个toolResult
    if (current.event.message?.role === 'toolResult') {
      if (!next) {
        issues.push({
          description: '工具执行完成后没有Assistant的最终回复（文件在此结束）',
        });
      } else if (next.event.message?.role !== 'assistant' && next.event.message?.role !== 'toolResult') {
        issues.push({
          description: `工具执行完成后的下一条消息角色是"${next.event.message?.role}"，而非预期的assistant最终回复或另一个toolResult`,
        });
      }
      // 如果next是toolResult，这是正常的并行工具调用场景，不报错
    }
  }
  
  return issues;
}

console.log('🧪 测试并行工具调用检测逻辑\n');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const issues = detectFlowIntegrity(testCase.messages);
  const success = issues.length === testCase.expectedIssues;
  
  if (success) {
    console.log(`✅ PASS: ${testCase.name}`);
    console.log(`   预期问题数: ${testCase.expectedIssues}, 实际问题数: ${issues.length}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${testCase.name}`);
    console.log(`   预期问题数: ${testCase.expectedIssues}, 实际问题数: ${issues.length}`);
    if (issues.length > 0) {
      issues.forEach(issue => console.log(`   - ${issue.description}`));
    }
    failed++;
  }
  console.log();
}

console.log('=' .repeat(80));
console.log(`\n测试结果: ${passed} 通过, ${failed} 失败\n`);

if (failed > 0) {
  process.exit(1);
}
