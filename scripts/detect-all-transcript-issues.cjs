/**
 * OpenClaw Transcript 综合问题检测器 (Node.js 版本)
 * 
 * 合并所有检测逻辑：
 * 1. 对话流程完整性检测（user→assistant, toolCall→toolResult, toolResult→assistant）
 * 2. 已知错误模式检测（modelErrors, timeoutErrors等）
 * 3. 异常停止检测（stopReason异常）
 * 
 * 使用方法：
 *   node scripts/detect-all-transcript-issues.js [transcript_dir]
 * 
 * 参数说明：
 *   transcript_dir: 可选，指定要扫描的transcript目录路径
 *                  如果不提供，默认使用 logs/session-transcript/openclaw-logs
 */

const fs = require('fs');
const path = require('path');

// ==================== 错误模式定义 ====================

const errorPatterns = {
  modelErrors: [
    /model.*error/i,
    /api.*error/i,
    /LLM.*timeout/i,
    /operation.*aborted/i,
    /\baborted\b/i,
    /prompt.*error/i,
    /request.*failed/i,
    /inference.*error/i,
    /generation.*failed/i,
    /model.*unavailable/i,
  ],
  timeoutErrors: [
    /timeout/i,
    /timed.*out/i,
    /ETIMEDOUT/i,
    /idle.*timeout/i,
    /connection.*timeout/i,
    /request.*timeout/i,
    /deadline.*exceeded/i,
  ],
  rateLimitErrors: [
    /rate.*limit/i,
    /\b429\b/i,
    /too.*many.*requests/i,
    /quota.*exceeded/i,
    /throttl/i,
  ],
  toolErrors: [
    /tool.*error/i,
    /tool.*failed/i,
    /execution.*error/i,
    /command.*failed/i,
    /tool.*timeout/i,
  ],
  permissionErrors: [
    /permission.*denied/i,
    /access.*denied/i,
    /forbidden/i,
    /\b403\b/i,
    /unauthorized/i,
    /auth.*error/i,
  ],
  parsingErrors: [
    /parse.*error/i,
    /invalid.*json/i,
    /syntax.*error/i,
    /malformed/i,
    /unexpected.*token/i,
  ],
  networkErrors: [
    /network.*error/i,
    /connection.*refused/i,
    /ECONNREFUSED/i,
    /ENOTFOUND/i,
    /socket.*hang.*up/i,
    /fetch.*failed/i,
    /dns.*error/i,
  ],
};

const errorTypeNames = {
  modelErrors: '模型API错误',
  timeoutErrors: '超时错误',
  rateLimitErrors: '速率限制错误',
  toolErrors: '工具执行错误',
  permissionErrors: '权限错误',
  parsingErrors: '解析错误',
  networkErrors: '网络错误',
};

// ==================== 辅助函数 ====================

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function formatTimestamp(ts) {
  if (!ts) return 'N/A';
  if (typeof ts === 'number') {
    return new Date(ts).toISOString();
  }
  return ts;
}

function analyzeCause(category, errorMessage, context) {
  const msg = errorMessage.toLowerCase();
  
  switch (category) {
    case 'modelErrors':
      if (msg.includes('timeout') || msg.includes('idle')) {
        return '模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入';
      }
      if (msg.includes('aborted') || msg.includes('cancel')) {
        return '请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消';
      }
      if (msg.includes('context') || msg.includes('token')) {
        return '上下文长度超限，可能原因：1) 会话历史过长；2) 单次输入内容过多；3) 未正确配置max_tokens参数；4) 缺少Compaction机制导致上下文累积';
      }
      return '模型API调用失败，可能原因：1) API密钥无效或过期；2) 模型服务暂时不可用；3) 请求格式不正确；4) 配额已用完';
    
    case 'timeoutErrors':
      if (msg.includes('idle')) {
        return '空闲超时，可能原因：1) 用户长时间未输入；2) 工具执行时间过长；3) 网络中断导致连接保持但无数据传输';
      }
      return '请求超时，可能原因：1) 网络延迟过高；2) 服务端处理缓慢；3) 防火墙或代理拦截；4) DNS解析超时';
    
    case 'rateLimitErrors':
      return '触发速率限制，可能原因：1) 短时间内请求过于频繁；2) 超过API配额限制；3) 多个实例共享同一API密钥；4) 未实现请求排队或退避机制';
    
    case 'toolErrors':
      if (msg.includes('permission') || msg.includes('denied')) {
        return '工具执行权限不足，可能原因：1) 文件系统权限限制；2) 沙箱环境约束；3) 需要sudo权限但未配置；4) 访问受限资源';
      }
      return '工具执行失败，可能原因：1) 命令不存在或路径错误；2) 依赖未安装；3) 输入参数不正确；4) 工具内部逻辑错误';
    
    case 'permissionErrors':
      return '权限验证失败，可能原因：1) API密钥无效；2) OAuth token过期；3) IP白名单限制；4) 账户被禁用或欠费';
    
    case 'parsingErrors':
      return '数据解析失败，可能原因：1) JSON格式不正确；2) 编码问题；3) 数据结构与预期不符；4) 特殊字符未转义';
    
    case 'networkErrors':
      if (msg.includes('refused')) {
        return '连接被拒绝，可能原因：1) 目标服务未启动；2) 端口未开放；3) 防火墙阻止；4) 服务地址配置错误';
      }
      if (msg.includes('notfound') || msg.includes('dns')) {
        return 'DNS解析失败，可能原因：1) 域名拼写错误；2) DNS服务器故障；3) 网络连接中断；4) hosts文件配置问题';
      }
      return '网络连接错误，可能原因：1) 网络不稳定；2) 代理配置错误；3) SSL证书问题；4) 服务端重启或维护';
    
    default:
      return '未知错误类型，需要人工分析具体原因';
  }
}

function extractContextInfo(lineNum, messages) {
  try {
    const currentIndex = messages.findIndex(m => m.lineNum === lineNum);
    if (currentIndex === -1) return '';
    
    const currentMsg = messages[currentIndex];
    const nextMsg = messages[currentIndex + 1];
    
    let context = '\n--- 错误行内容 ---\n';
    context += `Line ${lineNum}: ${JSON.stringify(currentMsg.event).substring(0, 500)}\n`;
    
    if (nextMsg) {
      context += `\n--- 下一行内容 ---\n`;
      context += `Line ${nextMsg.lineNum}: ${JSON.stringify(nextMsg.event).substring(0, 500)}\n`;
    }
    
    return context;
  } catch (e) {
    return '\n[提取上下文失败]';
  }
}

function hasToolCall(event) {
  if (!event.message?.content) return false;
  return event.message.content.some(block => block.type === 'toolCall');
}

// ==================== 核心检测函数 ====================

/**
 * 检测1: 对话流程完整性
 */
function detectFlowIntegrity(messages, filePath, sessionId) {
  const issues = [];
  
  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const next = messages[i + 1];
    
    // 规则1: user后面必须要有assistant
    if (current.event.message?.role === 'user') {
      if (!next) {
        const contextInfo = extractContextInfo(current.lineNum, messages);
        issues.push({
          id: generateId(),
          errorType: 'flow_integrity_no_reply',
          eventType: 'message',
          description: '用户提问后没有任何回复（文件在此结束）',
          errorMessage: `Expected assistant message after user message, but reached end of file\n${contextInfo}`,
          causeAnalysis: '可能的原因：1) 会话被意外中断；2) 系统崩溃导致回复丢失；3) 网络断开；4) 用户主动终止会话但未记录',
          filePath,
          sessionId,
          lineNumber: current.lineNum,
          timestamp: current.event.timestamp,
          severity: 'HIGH',
        });
      } else if (next.event.message?.role !== 'assistant') {
        const contextInfo = extractContextInfo(current.lineNum, messages);
        issues.push({
          id: generateId(),
          errorType: 'flow_integrity_no_reply',
          eventType: 'message',
          description: `用户提问后的下一条消息角色是"${next.event.message?.role}"，而非预期的assistant`,
          errorMessage: `Expected "assistant" after "user", but got "${next.event.message?.role}"\n${contextInfo}`,
          causeAnalysis: '可能的原因：1) 系统状态异常导致跳过回复；2) 消息顺序错乱；3) Compaction/Reset操作导致的记录不完整；4) 并发请求导致消息交错',
          filePath,
          sessionId,
          lineNumber: current.lineNum,
          timestamp: current.event.timestamp,
          severity: 'HIGH',
        });
      }
    }
    
    // 规则2: toolCall后面必须要有toolResult
    if (current.event.message?.role === 'assistant' && hasToolCall(current.event)) {
      if (!next) {
        const contextInfo = extractContextInfo(current.lineNum, messages);
        issues.push({
          id: generateId(),
          errorType: 'flow_integrity_missing_tool_result',
          eventType: 'message',
          description: 'Assistant调用了工具但没有收到工具执行结果（文件在此结束）',
          errorMessage: `Expected toolResult after toolCall, but reached end of file\n${contextInfo}`,
          causeAnalysis: '可能的原因：1) 工具执行超时或被中断；2) 工具执行过程中系统崩溃；3) 日志记录不完整；4) 工具异步执行但未等待结果',
          filePath,
          sessionId,
          lineNumber: current.lineNum,
          timestamp: current.event.timestamp,
          severity: 'HIGH',
        });
      } else if (next.event.message?.role !== 'toolResult') {
        const contextInfo = extractContextInfo(current.lineNum, messages);
        issues.push({
          id: generateId(),
          errorType: 'flow_integrity_missing_tool_result',
          eventType: 'message',
          description: `Assistant调用工具后的下一条消息角色是"${next.event.message?.role}"，而非预期的toolResult`,
          errorMessage: `Expected "toolResult" after "toolCall", but got "${next.event.message?.role}"\n${contextInfo}`,
          causeAnalysis: '可能的原因：1) 工具执行失败但未记录错误；2) 消息顺序错乱；3) 工具被跳过直接继续对话；4) 日志损坏或缺失',
          filePath,
          sessionId,
          lineNumber: current.lineNum,
          timestamp: current.event.timestamp,
          severity: 'HIGH',
        });
      }
    }
    
    // 规则3: toolResult后面必须要有assistant
    if (current.event.message?.role === 'toolResult') {
      const toolName = current.event.message.toolName;
      
      if (toolName === 'sessions_yield') {
        continue;
      }
      
      if (!next) {
        // toolResult是最后一条消息，没有后续
        const contextInfo = extractContextInfo(current.lineNum, messages);
        issues.push({
          id: generateId(),
          errorType: 'flow_integrity_missing_final_answer',
          eventType: 'message',
          description: '工具执行完成后没有Assistant的最终回复（文件在此结束）',
          errorMessage: `Expected assistant message after toolResult, but reached end of file\n${contextInfo}`,
          causeAnalysis: '可能的原因：1) Assistant在处理工具结果时出错；2) 会话被意外终止；3) 工具结果过于复杂导致无法生成回复；4) 系统资源耗尽',
          filePath,
          sessionId,
          lineNumber: current.lineNum,
          timestamp: current.event.timestamp,
          severity: 'MEDIUM',
        });
      } else if (next.event.message?.role !== 'assistant' && next.event.message?.role !== 'toolResult') {
        // toolResult后面既不是assistant也不是另一个toolResult，说明流程异常
        const contextInfo = extractContextInfo(current.lineNum, messages);
        issues.push({
          id: generateId(),
          errorType: 'flow_integrity_missing_final_answer',
          eventType: 'message',
          description: `工具执行完成后的下一条消息角色是"${next.event.message?.role}"，而非预期的assistant最终回复或另一个toolResult`,
          errorMessage: `Expected "assistant" or "toolResult" after "toolResult", but got "${next.event.message?.role}"\n${contextInfo}`,
          causeAnalysis: '可能的原因：1) Assistant未能正确处理工具结果；2) 触发了新的用户输入打断流程；3) 消息顺序异常；4) 并发请求导致消息交错',
          filePath,
          sessionId,
          lineNumber: current.lineNum,
          timestamp: current.event.timestamp,
          severity: 'MEDIUM',
        });
      }
      // 注意：如果next是toolResult，这是正常的并行工具调用场景，不报错
    }
  }
  
  return issues;
}

/**
 * 检测2: 已知错误模式
 */
function detectKnownErrors(messages, filePath, sessionId) {
  const issues = [];
  
  for (const msg of messages) {
    const event = msg.event;
    
    // 检测custom事件中的错误
    if (event.type === 'custom' && event.customType) {
      const customType = event.customType.toLowerCase();
      const dataStr = JSON.stringify(event.data || {}).toLowerCase();
      
      for (const [category, patterns] of Object.entries(errorPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(customType) || pattern.test(dataStr)) {
            const errorMessage = event.data?.error || JSON.stringify(event.data);
            issues.push({
              id: generateId(),
              errorType: category,
              eventType: event.customType,
              description: `检测到${errorTypeNames[category]}事件`,
              errorMessage: errorMessage.substring(0, 500),
              causeAnalysis: analyzeCause(category, errorMessage, event.data),
              filePath,
              sessionId,
              lineNumber: msg.lineNum,
              timestamp: formatTimestamp(event.timestamp || event.data?.timestamp),
              runId: event.data?.runId,
              provider: event.data?.provider,
              model: event.data?.model,
              severity: 'HIGH',
            });
            break;
          }
        }
      }
    }
    
    // 检测message中的错误（仅针对assistant角色）
    if (event.type === 'message' && event.message && event.message.role === 'assistant') {
      const errorMessage = event.message.errorMessage;
      
      if (!errorMessage) {
        continue;
      }
      
      const errorMsgLower = errorMessage.toLowerCase();
      
      for (const [category, patterns] of Object.entries(errorPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(errorMsgLower)) {
            issues.push({
              id: generateId(),
              errorType: category,
              eventType: 'message',
              description: `在message事件中检测到${errorTypeNames[category]}`,
              errorMessage: errorMessage.substring(0, 500),
              causeAnalysis: analyzeCause(category, errorMessage, event.message),
              filePath,
              sessionId,
              lineNumber: msg.lineNum,
              timestamp: formatTimestamp(event.timestamp),
              provider: event.message.provider,
              model: event.message.model,
              severity: 'HIGH',
            });
            break;
          }
        }
      }
    }
  }
  
  return issues;
}

/**
 * 检测3: 异常停止
 */
function detectAbnormalStops(messages, filePath, sessionId) {
  const issues = [];
  const normalStopReasons = ['stop', 'toolUse', 'length'];
  
  for (const msg of messages) {
    if (msg.event.type === 'message' && msg.event.message?.stopReason) {
      const stopReason = msg.event.message.stopReason;
      
      if (!normalStopReasons.includes(stopReason)) {
        const errorMessage = msg.event.message.errorMessage || `Unexpected stop reason: ${stopReason}`;
        
        issues.push({
          id: generateId(),
          errorType: 'abnormal_stop',
          eventType: 'message',
          description: `检测到异常停止原因: ${stopReason}`,
          errorMessage: errorMessage.substring(0, 500),
          causeAnalysis: analyzeCause('modelErrors', errorMessage, msg.event.message),
          filePath,
          sessionId,
          lineNumber: msg.lineNum,
          timestamp: formatTimestamp(msg.event.timestamp),
          provider: msg.event.message.provider,
          model: msg.event.message.model,
          severity: stopReason === 'aborted' || stopReason === 'error' ? 'HIGH' : 'MEDIUM',
        });
      }
    }
  }
  
  return issues;
}

/**
 * 分析单个transcript文件
 */
function analyzeTranscript(filePath) {
  const allIssues = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // 提取session ID
    let sessionId = 'unknown';
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'session' && parsed.id) {
          sessionId = parsed.id;
          break;
        }
      } catch (e) {
        // 跳过无效行
      }
    }
    
    // 解析所有message事件
    const messages = [];
    
    for (let i = 0; i < lines.length; i++) {
      try {
        const event = JSON.parse(lines[i]);
        
        if (event.type === 'message' || event.type === 'custom') {
          messages.push({
            lineNum: i + 1,
            event: event,
          });
        }
      } catch (e) {
        // 跳过无效行
      }
    }
    
    // 执行三种检测
    const flowIssues = detectFlowIntegrity(messages, filePath, sessionId);
    const knownErrorIssues = detectKnownErrors(messages, filePath, sessionId);
    const abnormalStopIssues = detectAbnormalStops(messages, filePath, sessionId);
    
    allIssues.push(...flowIssues, ...knownErrorIssues, ...abnormalStopIssues);
    
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error);
  }
  
  return allIssues;
}

/**
 * 查找所有JSONL文件
 */
function findJsonlFiles(dir) {
  const results = [];
  
  function scan(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name.includes('.jsonl')) {
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
function generateMarkdownReport(allIssues) {
  let markdown = '# OpenClaw Session Transcript 综合问题检测报告\n\n';
  markdown += `**生成时间**: ${new Date().toISOString()}\n\n`;
  
  // 统计概览
  const stats = {
    total: allIssues.length,
    byType: {},
  };
  
  for (const issue of allIssues) {
    stats.byType[issue.errorType] = (stats.byType[issue.errorType] || 0) + 1;
  }
  
  markdown += '## 📊 统计概览\n\n';
  markdown += `- **总问题数**: ${stats.total}\n\n`;
  
  markdown += '### 问题类型分布\n\n';
  markdown += '| 问题类型 | 数量 | 说明 |\n';
  markdown += '|---------|------|------|\n';
  
  const typeDescriptions = {
    flow_integrity_no_reply: '用户提问后无回复',
    flow_integrity_missing_tool_result: '工具调用后无执行结果',
    flow_integrity_missing_final_answer: '工具执行后无最终回复',
    modelErrors: '模型API错误',
    timeoutErrors: '超时错误',
    rateLimitErrors: '速率限制错误',
    toolErrors: '工具执行错误',
    permissionErrors: '权限错误',
    parsingErrors: '解析错误',
    networkErrors: '网络错误',
    abnormal_stop: '异常停止',
  };
  
  for (const [type, count] of Object.entries(stats.byType).sort((a, b) => b[1] - a[1])) {
    const desc = typeDescriptions[type] || type;
    markdown += `| ${type} | ${count} | ${desc} |\n`;
  }
  
  markdown += '\n---\n\n';
  
  // 按问题类型分组输出详细问题
  const groupedByType = {};
  for (const issue of allIssues) {
    if (!groupedByType[issue.errorType]) {
      groupedByType[issue.errorType] = [];
    }
    groupedByType[issue.errorType].push(issue);
  }
  
  const typeDescriptionsLong = {
    flow_integrity_no_reply: '用户提问后无回复',
    flow_integrity_missing_tool_result: '工具调用后无执行结果',
    flow_integrity_missing_final_answer: '工具执行后无最终回复',
    modelErrors: '模型API错误',
    timeoutErrors: '超时错误',
    rateLimitErrors: '速率限制错误',
    toolErrors: '工具执行错误',
    permissionErrors: '权限错误',
    parsingErrors: '解析错误',
    networkErrors: '网络错误',
    abnormal_stop: '异常停止',
  };
  
  const sortedTypes = Object.entries(groupedByType).sort((a, b) => b[1].length - a[1].length);
  
  let globalIssueNumber = 1;
  
  for (const [errorType, issues] of sortedTypes) {
    const typeDesc = typeDescriptionsLong[errorType] || errorType;
    markdown += `## ${errorType} - ${typeDesc} (${issues.length})\n\n`;
    
    for (const issue of issues) {
      markdown += `### 问题 #${globalIssueNumber}\n\n`;
      globalIssueNumber++;
      markdown += `- **事件类型**: \`${issue.eventType}\`\n`;
      markdown += `- **描述**: ${issue.description}\n`;
      markdown += `- **错误信息**: \`\`\`\n${issue.errorMessage}\n\`\`\`\n`;
      markdown += `- **原因分析**: ${issue.causeAnalysis}\n`;
      markdown += `- **文件位置**: \`${issue.filePath.replace(process.cwd() + path.sep, '')}\`\n`;
      markdown += `- **Session ID**: \`${issue.sessionId}\`\n`;
      markdown += `- **行号**: ${issue.lineNumber}\n`;
      
      if (issue.timestamp) {
        markdown += `- **时间戳**: ${issue.timestamp}\n`;
      }
      
      if (issue.runId) {
        markdown += `- **Run ID**: \`${issue.runId}\`\n`;
      }
      
      if (issue.provider) {
        markdown += `- **Provider**: \`${issue.provider}\`\n`;
      }
      
      if (issue.model) {
        markdown += `- **Model**: \`${issue.model}\`\n`;
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
  const args = process.argv.slice(2);
  const customDir = args[0];
  
  let transcriptDir;
  if (customDir) {
    transcriptDir = path.isAbsolute(customDir) ? customDir : path.join(process.cwd(), customDir);
    console.log(`📂 使用自定义路径: ${transcriptDir}\n`);
  } else {
    transcriptDir = path.join(__dirname, '..', 'logs', 'session-transcript', 'openclaw-logs');
    console.log(`📂 使用默认路径: ${transcriptDir}\n`);
  }
  
  if (!fs.existsSync(transcriptDir)) {
    console.error(`❌ Transcript directory not found: ${transcriptDir}`);
    process.exit(1);
  }
  
  console.log('🔍 开始扫描transcript文件...\n');
  const jsonlFiles = findJsonlFiles(transcriptDir);
  console.log(`找到 ${jsonlFiles.length} 个JSONL文件\n`);
  
  const allIssues = [];
  
  for (let i = 0; i < jsonlFiles.length; i++) {
    const file = jsonlFiles[i];
    const issues = analyzeTranscript(file);
    allIssues.push(...issues);
    
    if ((i + 1) % 50 === 0) {
      console.log(`已处理 ${i + 1}/${jsonlFiles.length} 个文件，发现问题 ${allIssues.length} 个...`);
    }
  }
  
  console.log(`\n✅ 分析完成！共发现 ${allIssues.length} 个问题\n`);
  
  const reportPath = path.join(__dirname, 'transcript-comprehensive-issues.md');
  const report = generateMarkdownReport(allIssues);
  fs.writeFileSync(reportPath, report, 'utf-8');
  
  console.log(`📄 报告已保存到: ${reportPath}\n`);
  
  const stats = {};
  for (const issue of allIssues) {
    stats[issue.errorType] = (stats[issue.errorType] || 0) + 1;
  }
  
  console.log('📊 问题类型统计:');
  for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${type}: ${count}`);
  }
  
  console.log(`\n🎯 严重程度统计:`);
  console.log(`  - HIGH: ${allIssues.filter(i => i.severity === 'HIGH').length}`);
  console.log(`  - MEDIUM: ${allIssues.filter(i => i.severity === 'MEDIUM').length}`);
  console.log(`  - LOW: ${allIssues.filter(i => i.severity === 'LOW').length}`);
}

main().catch(console.error);
