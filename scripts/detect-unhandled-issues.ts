/**
 * OpenClaw Transcript 未处理问题检测器
 * 
 * 检测用户提问后没有得到完整/正确处理的情况
 */

import * as fs from 'fs';
import * as path from 'path';

interface UnhandledIssue {
  id: string;
  issueType: 'no_reply' | 'incomplete_reply' | 'aborted_reply' | 'consecutive_users' | 'tool_call_no_final_answer';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  filePath: string;
  sessionId: string;
  lineNumber: number;
  timestamp?: string;
  context: {
    userMessage?: string;
    assistantResponse?: string;
    stopReason?: string;
    errorMessage?: string;
    hasToolCall?: boolean;
    hasFinalAnswer?: boolean;
  };
}

interface MessageEvent {
  type: string;
  id?: string;
  parentId?: string;
  timestamp?: string;
  message?: {
    role: string;
    content?: Array<{
      type: string;
      text?: string;
      toolCallId?: string;
      toolName?: string;
    }>;
    stopReason?: string;
    errorMessage?: string;
    api?: string;
    provider?: string;
    model?: string;
  };
}

/**
 * 分析单个transcript文件，检测未处理的问题
 */
function analyzeUnhandledIssues(filePath: string): UnhandledIssue[] {
  const issues: UnhandledIssue[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // 提取session ID
    const sessionIdMatch = filePath.match(/sessions\/([a-f0-9-]+)\.jsonl/);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : 'unknown';
    
    // 解析所有message事件
    const messages: Array<{ lineNum: number; event: MessageEvent }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      try {
        const event = JSON.parse(lines[i]);
        
        if (event.type === 'message' && event.message?.role) {
          messages.push({
            lineNum: i + 1,
            event: event as MessageEvent,
          });
        }
      } catch (e) {
        // 跳过无效行
      }
    }
    
    // 检测各种未处理情况
    detectNoReply(messages, filePath, sessionId, issues);
    detectIncompleteReplies(messages, filePath, sessionId, issues);
    detectConsecutiveUsers(messages, filePath, sessionId, issues);
    detectToolCallWithoutFinalAnswer(messages, filePath, sessionId, issues);
    
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error);
  }
  
  return issues;
}

/**
 * 检测情形1: 用户提问后完全没有回复
 * - user是最后一条记录
 * - user的下一条不是assistant或toolResult
 */
function detectNoReply(
  messages: Array<{ lineNum: number; event: MessageEvent }>,
  filePath: string,
  sessionId: string,
  issues: UnhandledIssue[]
) {
  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const next = messages[i + 1];
    
    if (current.event.message?.role === 'user') {
      // 情形1a: user是最后一条消息
      if (!next) {
        issues.push({
          id: generateId(),
          issueType: 'no_reply',
          severity: 'HIGH',
          description: '用户提问后没有任何回复（文件在此结束）',
          filePath,
          sessionId,
          lineNumber: current.lineNum,
          timestamp: current.event.timestamp,
          context: {
            userMessage: extractUserMessage(current.event),
          },
        });
        continue;
      }
      
      // 情形1b: user的下一条不是assistant或toolResult
      const nextRole = next.event.message?.role;
      if (nextRole !== 'assistant' && nextRole !== 'toolResult') {
        issues.push({
          id: generateId(),
          issueType: 'no_reply',
          severity: 'HIGH',
          description: `用户提问后的下一条消息角色是"${nextRole}"，而非预期的assistant或toolResult`,
          filePath,
          sessionId,
          lineNumber: current.lineNum,
          timestamp: current.event.timestamp,
          context: {
            userMessage: extractUserMessage(current.event),
          },
        });
      }
    }
  }
}

/**
 * 检测情形2: Assistant回复被中止或不完整
 */
function detectIncompleteReplies(
  messages: Array<{ lineNum: number; event: MessageEvent }>,
  filePath: string,
  sessionId: string,
  issues: UnhandledIssue[]
) {
  for (const msg of messages) {
    if (msg.event.message?.role === 'assistant') {
      const stopReason = msg.event.message.stopReason;
      const errorMessage = msg.event.message.errorMessage;
      
      // 检测被中止的回复
      if (stopReason === 'aborted' || stopReason === 'error') {
        issues.push({
          id: generateId(),
          issueType: 'aborted_reply',
          severity: 'HIGH',
          description: `Assistant回复被中止 (stopReason: ${stopReason})`,
          filePath,
          sessionId,
          lineNumber: msg.lineNum,
          timestamp: msg.event.timestamp,
          context: {
            assistantResponse: extractAssistantText(msg.event),
            stopReason,
            errorMessage,
          },
        });
      }
      
      // 检测有errorMessage的回复（即使没有明确aborted）
      if (errorMessage && !stopReason) {
        issues.push({
          id: generateId(),
          issueType: 'incomplete_reply',
          severity: 'MEDIUM',
          description: `Assistant回复包含错误信息: ${errorMessage}`,
          filePath,
          sessionId,
          lineNumber: msg.lineNum,
          timestamp: msg.event.timestamp,
          context: {
            assistantResponse: extractAssistantText(msg.event),
            errorMessage,
          },
        });
      }
    }
  }
}

/**
 * 检测情形3: 连续的user消息（中间没有assistant回复）
 */
function detectConsecutiveUsers(
  messages: Array<{ lineNum: number; event: MessageEvent }>,
  filePath: string,
  sessionId: string,
  issues: UnhandledIssue[]
) {
  let consecutiveUserCount = 0;
  let startLine = 0;
  
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].event.message?.role === 'user') {
      if (consecutiveUserCount === 0) {
        startLine = messages[i].lineNum;
      }
      consecutiveUserCount++;
    } else {
      // 遇到非user消息，检查之前是否有连续user
      if (consecutiveUserCount > 1) {
        issues.push({
          id: generateId(),
          issueType: 'consecutive_users',
          severity: 'MEDIUM',
          description: `检测到${consecutiveUserCount}条连续的user消息（可能表示前几条未被处理）`,
          filePath,
          sessionId,
          lineNumber: startLine,
          context: {
            userMessage: `连续${consecutiveUserCount}条user消息`,
          },
        });
      }
      consecutiveUserCount = 0;
    }
  }
  
  // 检查文件末尾的连续user
  if (consecutiveUserCount > 1) {
    issues.push({
      id: generateId(),
      issueType: 'consecutive_users',
      severity: 'HIGH',
      description: `文件末尾有${consecutiveUserCount}条连续的user消息（都没有得到回复）`,
      filePath,
      sessionId,
      lineNumber: startLine,
      context: {
        userMessage: `连续${consecutiveUserCount}条user消息`,
      },
    });
  }
}

/**
 * 检测情形4: Tool Call后没有最终的文本回复
 * 流程应该是: user → assistant(toolCall) → toolResult → assistant(final text)
 * 如果缺少最后的assistant(final text)，说明问题未完全处理
 */
function detectToolCallWithoutFinalAnswer(
  messages: Array<{ lineNum: number; event: MessageEvent }>,
  filePath: string,
  sessionId: string,
  issues: UnhandledIssue[]
) {
  for (let i = 0; i < messages.length - 2; i++) {
    const current = messages[i];
    const next = messages[i + 1];
    const afterNext = messages[i + 2];
    
    // 检测模式: assistant(toolCall) → toolResult → ???
    if (
      current.event.message?.role === 'assistant' &&
      hasToolCall(current.event) &&
      next.event.message?.role === 'toolResult'
    ) {
      // 检查toolResult后面是否有assistant的最终回复
      const hasFinalAnswer = afterNext?.event.message?.role === 'assistant' &&
                            !hasToolCall(afterNext.event) &&
                            hasTextContent(afterNext.event);
      
      if (!hasFinalAnswer) {
        issues.push({
          id: generateId(),
          issueType: 'tool_call_no_final_answer',
          severity: 'MEDIUM',
          description: 'Tool执行后没有最终的文本回复（用户可能没看到结果解释）',
          filePath,
          sessionId,
          lineNumber: current.lineNum,
          timestamp: current.event.timestamp,
          context: {
            hasToolCall: true,
            hasFinalAnswer: false,
          },
        });
      }
    }
  }
}

/**
 * 辅助函数：检查assistant消息是否包含toolCall
 */
function hasToolCall(event: MessageEvent): boolean {
  if (!event.message?.content) return false;
  return event.message.content.some(block => block.type === 'toolCall');
}

/**
 * 辅助函数：检查assistant消息是否包含文本内容
 */
function hasTextContent(event: MessageEvent): boolean {
  if (!event.message?.content) return false;
  return event.message.content.some(block => block.type === 'text' && block.text);
}

/**
 * 辅助函数：提取用户消息文本
 */
function extractUserMessage(event: MessageEvent): string {
  if (!event.message?.content) return '';
  const textBlock = event.message.content.find(b => b.type === 'text');
  return textBlock?.text?.substring(0, 200) || '';
}

/**
 * 辅助函数：提取assistant的文本回复
 */
function extractAssistantText(event: MessageEvent): string {
  if (!event.message?.content) return '';
  const textBlock = event.message.content.find(b => b.type === 'text');
  return textBlock?.text?.substring(0, 300) || '';
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * 查找所有JSONL文件
 */
function findJsonlFiles(dir: string): string[] {
  const results: string[] = [];
  
  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(fullPath);
      }
    }
  }
  
  scan(dir);
  return results;
}

/**
 * 生成Markdown报告
 */
function generateMarkdownReport(allIssues: UnhandledIssue[]): string {
  let markdown = '# OpenClaw Session Transcript 未处理问题检测报告\n\n';
  
  // 统计概览
  const stats = {
    total: allIssues.length,
    noReply: allIssues.filter(i => i.issueType === 'no_reply').length,
    abortedReply: allIssues.filter(i => i.issueType === 'aborted_reply').length,
    incompleteReply: allIssues.filter(i => i.issueType === 'incomplete_reply').length,
    consecutiveUsers: allIssues.filter(i => i.issueType === 'consecutive_users').length,
    toolCallNoFinal: allIssues.filter(i => i.issueType === 'tool_call_no_final_answer').length,
    highSeverity: allIssues.filter(i => i.severity === 'HIGH').length,
    mediumSeverity: allIssues.filter(i => i.severity === 'MEDIUM').length,
  };
  
  markdown += '## 📊 统计概览\n\n';
  markdown += `- **总问题数**: ${stats.total}\n`;
  markdown += `- **高优先级**: ${stats.highSeverity}\n`;
  markdown += `- **中优先级**: ${stats.mediumSeverity}\n\n`;
  
  markdown += '### 问题类型分布\n\n';
  markdown += `| 问题类型 | 数量 | 说明 |\n`;
  markdown += `|---------|------|------|\n`;
  markdown += `| 无回复 (no_reply) | ${stats.noReply} | 用户提问后完全没有回复 |\n`;
  markdown += `| 回复被中止 (aborted_reply) | ${stats.abortedReply} | Assistant回复被中断 |\n`;
  markdown += `| 回复不完整 (incomplete_reply) | ${stats.incompleteReply} | 回复包含错误信息 |\n`;
  markdown += `| 连续用户消息 (consecutive_users) | ${stats.consecutiveUsers} | 多条user消息无中间回复 |\n`;
  markdown += `| Tool调用无最终答案 (tool_call_no_final_answer) | ${stats.toolCallNoFinal} | 工具执行后无文本解释 |\n\n`;
  
  // 按严重程度分组
  const groupedBySeverity = {
    HIGH: allIssues.filter(i => i.severity === 'HIGH'),
    MEDIUM: allIssues.filter(i => i.severity === 'MEDIUM'),
    LOW: allIssues.filter(i => i.severity === 'LOW'),
  };
  
  for (const [severity, issues] of Object.entries(groupedBySeverity)) {
    if (issues.length === 0) continue;
    
    markdown += `## ⚠️ ${severity === 'HIGH' ? '🔴 高优先级' : severity === 'MEDIUM' ? '🟡 中优先级' : '🟢 低优先级'}问题 (${issues.length})\n\n`;
    
    for (const issue of issues) {
      markdown += `### 问题 #${allIssues.indexOf(issue) + 1}\n\n`;
      markdown += `- **问题类型**: \`${issue.issueType}\`\n`;
      markdown += `- **严重程度**: ${issue.severity}\n`;
      markdown += `- **描述**: ${issue.description}\n`;
      markdown += `- **文件位置**: \`${issue.filePath}\`\n`;
      markdown += `- **Session ID**: \`${issue.sessionId}\`\n`;
      markdown += `- **行号**: ${issue.lineNumber}\n`;
      
      if (issue.timestamp) {
        markdown += `- **时间戳**: ${issue.timestamp}\n`;
      }
      
      if (issue.context.userMessage) {
        markdown += `- **用户消息**: \`\`\`\n${issue.context.userMessage}\n\`\`\`\n`;
      }
      
      if (issue.context.assistantResponse) {
        markdown += `- **Assistant回复**: \`\`\`\n${issue.context.assistantResponse}\n\`\`\`\n`;
      }
      
      if (issue.context.stopReason) {
        markdown += `- **停止原因**: \`${issue.context.stopReason}\`\n`;
      }
      
      if (issue.context.errorMessage) {
        markdown += `- **错误信息**: \`${issue.context.errorMessage}\`\n`;
      }
      
      markdown += '\n---\n\n';
    }
  }
  
  return markdown;
}

/**
 * 主函数
 */
async function main() {
  const transcriptDir = path.join(__dirname, '..', 'logs', 'session-transcript', 'openclaw-logs');
  
  if (!fs.existsSync(transcriptDir)) {
    console.error(`Transcript directory not found: ${transcriptDir}`);
    process.exit(1);
  }
  
  console.log('🔍 扫描transcript文件...');
  const jsonlFiles = findJsonlFiles(transcriptDir);
  console.log(`找到 ${jsonlFiles.length} 个JSONL文件\n`);
  
  const allIssues: UnhandledIssue[] = [];
  
  for (let i = 0; i < jsonlFiles.length; i++) {
    const file = jsonlFiles[i];
    const issues = analyzeUnhandledIssues(file);
    allIssues.push(...issues);
    
    if ((i + 1) % 50 === 0) {
      console.log(`已处理 ${i + 1}/${jsonlFiles.length} 个文件...`);
    }
  }
  
  console.log(`\n✅ 分析完成！共发现 ${allIssues.length} 个未处理问题\n`);
  
  // 生成报告
  const reportPath = path.join(__dirname, '..', 'mydocs', 'transcript-unhandled-issues.md');
  const report = generateMarkdownReport(allIssues);
  fs.writeFileSync(reportPath, report, 'utf-8');
  
  console.log(`📄 报告已保存到: ${reportPath}`);
  console.log(`\n详细统计:`);
  console.log(`  - 无回复: ${allIssues.filter(i => i.issueType === 'no_reply').length}`);
  console.log(`  - 回复被中止: ${allIssues.filter(i => i.issueType === 'aborted_reply').length}`);
  console.log(`  - 回复不完整: ${allIssues.filter(i => i.issueType === 'incomplete_reply').length}`);
  console.log(`  - 连续用户消息: ${allIssues.filter(i => i.issueType === 'consecutive_users').length}`);
  console.log(`  - Tool调用无最终答案: ${allIssues.filter(i => i.issueType === 'tool_call_no_final_answer').length}`);
}

main().catch(console.error);
