#!/usr/bin/env node
/**
 * Generate detailed issue list from session transcripts
 * Each issue as a separate record with full details
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, '..', 'logs', 'session-transcript', 'openclaw-logs');
const OUTPUT_FILE = join(__dirname, '..', 'mydocs', 'transcript-issues-detailed.md');

// Error patterns for detection
const errorPatterns = {
  modelErrors: [
    /model.*error/i,
    /api.*error/i,
    /inference.*error/i,
    /provider.*error/i,
    /invalid.*model/i,
    /model.*not.*found/i,
    /completion.*error/i,
    /LLM.*timeout/i,
    /operation.*aborted/i,
    /prompt.*error/i,
  ],
  timeoutErrors: [
    /timeout/i,
    /timed.*out/i,
    /deadline.*exceeded/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /connection.*timed/i,
    /idle.*timeout/i,
  ],
  rateLimitErrors: [
    /rate.*limit/i,
    /too.*many.*requests/i,
    /429/i,
    /quota.*exceeded/i,
    /throttl/i,
  ],
  toolErrors: [
    /tool.*error/i,
    /tool.*failed/i,
    /execution.*error/i,
    /command.*exited/i,
    /exit.*code/i,
  ],
  permissionErrors: [
    /permission.*denied/i,
    /access.*denied/i,
    /forbidden/i,
    /EACCES/i,
    /EPERM/i,
    /not.*authorized/i,
  ],
  parsingErrors: [
    /parse.*error/i,
    /json.*error/i,
    /syntax.*error/i,
    /invalid.*json/i,
    /unexpected.*token/i,
  ],
  networkErrors: [
    /network.*error/i,
    /connection.*error/i,
    /connect.*timeout/i,
    /dns.*error/i,
    /socket.*error/i,
    /fetch.*error/i,
    /request.*failed/i,
  ],
};

function findJsonlFiles(dir: string): string[] {
  const results: string[] = [];
  
  function scan(currentDir: string) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // Skip directories we can't access
    }
  }
  
  scan(dir);
  return results;
}

function extractErrorMessage(data: any): string {
  if (!data) return 'Unknown error';
  
  if (typeof data === 'string') {
    return data.substring(0, 300);
  }
  
  if (data.error) {
    return data.error;
  }
  
  if (data.message) {
    return data.message;
  }
  
  return JSON.stringify(data).substring(0, 300);
}

function analyzeCause(category: string, errorMessage: string, context: any): string {
  const msg = errorMessage.toLowerCase();
  
  switch (category) {
    case 'modelErrors':
      if (msg.includes('timeout') || msg.includes('idle')) {
        return '模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入';
      }
      if (msg.includes('abort')) {
        return '请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消';
      }
      if (msg.includes('error')) {
        return '模型API调用失败，可能原因：1) API密钥无效或过期；2) 模型不可用或未配置；3) 请求格式错误；4) 服务端内部错误';
      }
      return '模型层发生未知错误，需要查看详细日志确定具体原因';
    
    case 'timeoutErrors':
      if (msg.includes('connection') || msg.includes('connect')) {
        return '网络连接超时，可能原因：1) 目标服务不可达；2) 防火墙阻止连接；3) DNS解析失败；4) 网络不稳定';
      }
      if (msg.includes('idle')) {
        return '空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达';
      }
      return '操作超时，超过预设的时间限制。建议检查网络状态、优化请求复杂度或增加超时阈值';
    
    case 'rateLimitErrors':
      return 'API速率限制被触发，可能原因：1) 短时间内发送过多请求；2) 超出配额限制；3) 共享IP被限流。建议实施指数退避重试策略';
    
    case 'toolErrors':
      if (msg.includes('not found') || msg.includes('module')) {
        return '工具依赖缺失，需要的模块或命令未安装。建议检查环境依赖并自动安装';
      }
      if (msg.includes('exit code') || msg.includes('exited')) {
        return '工具执行失败，命令返回非零退出码。可能原因：1) 命令语法错误；2) 缺少必要参数；3) 运行时错误';
      }
      return '工具执行过程中发生错误，需要检查工具配置和输入参数';
    
    case 'permissionErrors':
      if (msg.includes('sudo') || msg.includes('root')) {
        return '权限不足，需要提升权限执行。建议使用sudo或以root用户运行，或调整文件/目录权限';
      }
      if (msg.includes('ssh') || msg.includes('auth')) {
        return '认证失败，可能原因：1) 密码错误；2) 服务器只允许密钥认证；3) 账户被锁定';
      }
      return '访问被拒绝，当前用户没有足够的权限执行此操作。需要检查文件或目录的权限设置';
    
    case 'parsingErrors':
      return '数据解析失败，可能原因：1) JSON格式不正确；2) 编码问题；3) 数据结构与预期不符。建议验证输入数据的格式和完整性';
    
    case 'networkErrors':
      if (msg.includes('refused')) {
        return '连接被拒绝，目标服务未监听指定端口。可能服务未启动或端口配置错误';
      }
      if (msg.includes('dns')) {
        return 'DNS解析失败，域名无法解析。检查网络连接和DNS配置';
      }
      return '网络通信失败，需要检查网络连接、防火墙设置和目标服务的可用性';
    
    default:
      return '未知错误类型，需要进一步分析';
  }
}

function getRelativePath(filePath: string): string {
  return relative(join(__dirname, '..'), filePath).replace(/\\/g, '/');
}

function formatTimestamp(timestamp: any): string {
  if (!timestamp) return 'N/A';
  
  if (typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }
  
  return timestamp;
}

function analyzeTranscript(filePath: string) {
  const issues = [];
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    let sessionId = null;
    let currentProvider = null;
    let currentModel = null;
    
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      let event;
      
      try {
        event = JSON.parse(line);
      } catch (e) {
        continue;
      }
      
      // Track session info
      if (event.type === 'session' && !sessionId) {
        sessionId = event.id;
      }
      
      if (event.type === 'model_change') {
        currentProvider = event.provider;
        currentModel = event.modelId;
      }
      
      // Check for custom error events
      if (event.type === 'custom' && event.customType) {
        const data = event.data || {};
        const dataStr = JSON.stringify(data).toLowerCase();
        const eventType = event.customType.toLowerCase();
        
        for (const [category, patterns] of Object.entries(errorPatterns)) {
          for (const pattern of patterns) {
            if (pattern.test(dataStr) || pattern.test(eventType)) {
              const errorMessage = extractErrorMessage(data);
              
              issues.push({
                id: issues.length + 1,
                errorType: category,
                eventType: event.customType,
                description: `检测到${getErrorTypeName(category)}事件`,
                errorMessage: errorMessage,
                causeAnalysis: analyzeCause(category, errorMessage, data),
                filePath: getRelativePath(filePath),
                sessionId: sessionId || event.data?.sessionId || 'Unknown',
                lineNumber: lineNum,
                timestamp: formatTimestamp(data.timestamp || event.timestamp),
                runId: data.runId || 'N/A',
                provider: data.provider || currentProvider || 'Unknown',
                model: data.model || currentModel || 'Unknown',
                rawEvent: event,
              });
              
              break;
            }
          }
        }
      }
      
      // Check for abnormal stop reasons (warnings)
      if (event.type === 'message' && event.message?.role === 'assistant') {
        const stopReason = event.message.stopReason;
        
        if (stopReason && stopReason !== 'stop' && stopReason !== 'toolUse') {
          const messageContent = event.message.content || [];
          const textContent = messageContent
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text || '')
            .join(' ')
            .substring(0, 200);
          
          issues.push({
            id: issues.length + 1,
            errorType: 'warning',
            eventType: 'abnormal_stop',
            description: `对话异常终止 (stopReason: ${stopReason})`,
            errorMessage: textContent || `消息以 ${stopReason} 原因停止`,
            causeAnalysis: getStopReasonAnalysis(stopReason),
            filePath: getRelativePath(filePath),
            sessionId: sessionId || 'Unknown',
            lineNumber: lineNum,
            timestamp: formatTimestamp(event.timestamp),
            runId: 'N/A',
            provider: currentProvider || 'Unknown',
            model: currentModel || 'Unknown',
            stopReason: stopReason,
            rawEvent: event,
          });
        }
      }
    }
    
  } catch (e) {
    // Skip files that can't be read
  }
  
  return issues;
}

function getErrorTypeName(category: string): string {
  const names: Record<string, string> = {
    modelErrors: '模型API错误',
    timeoutErrors: '超时错误',
    rateLimitErrors: '速率限制错误',
    toolErrors: '工具执行错误',
    permissionErrors: '权限错误',
    parsingErrors: '解析错误',
    networkErrors: '网络错误',
    warning: '警告',
  };
  
  return names[category] || category;
}

function getStopReasonAnalysis(stopReason: string): string {
  const analyses: Record<string, string> = {
    'aborted': '请求被主动中止。可能原因：1) 用户取消操作；2) 系统资源压力触发清理；3) 超时保护机制启动；4) 并发控制取消旧请求',
    'error': '执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因',
    'length': '达到最大输出长度限制。Prompt可能需要简化，或者需要分多次完成',
    'content_filter': '内容过滤器触发了拦截。输出包含敏感或不适当的内容',
    'cancelled': '操作被取消。通常是用户或客户端发起的取消请求',
  };
  
  return analyses[stopReason] || `未知的停止原因: ${stopReason}，需要进一步调查`;
}

function generateMarkdownReport(allIssues: any[]): string {
  let markdown = '# OpenClaw Session Transcript 问题详细清单\n\n';
  markdown += `**生成时间**: ${new Date().toISOString()}\n`;
  markdown += `**分析文件数**: ${allIssues.length > 0 ? '见统计' : 0}\n`;
  markdown += `**问题总数**: ${allIssues.length}\n\n`;
  markdown += '---\n\n';
  
  // Statistics
  const stats = calculateStatistics(allIssues);
  markdown += '## 📊 统计概览\n\n';
  markdown += '| 错误类型 | 数量 | 占比 |\n';
  markdown += '|---------|------|------|\n';
  
  for (const [type, count] of Object.entries(stats.byType).sort((a: any, b: any) => b[1] - a[1])) {
    const percentage = ((count / allIssues.length) * 100).toFixed(1);
    markdown += `| ${type} | ${count} | ${percentage}% |\n`;
  }
  
  markdown += `\n**涉及会话数**: ${stats.uniqueSessions}\n`;
  markdown += `**涉及文件数**: ${stats.uniqueFiles}\n\n`;
  markdown += '---\n\n';
  
  // Detailed issues
  markdown += '## 🔴 问题详细列表\n\n';
  
  for (const issue of allIssues) {
    markdown += `### 问题 #${issue.id}\n\n`;
    markdown += `- **错误类型**: ${issue.errorType}\n`;
    markdown += `- **事件类型**: \`${issue.eventType}\`\n`;
    markdown += `- **描述**: ${issue.description}\n`;
    markdown += `- **错误信息**: \n\`\`\`\n${issue.errorMessage}\n\`\`\`\n`;
    markdown += `- **原因分析**: ${issue.causeAnalysis}\n`;
    markdown += `- **文件位置**: \`${issue.filePath}\`\n`;
    markdown += `- **Session ID**: \`${issue.sessionId}\`\n`;
    markdown += `- **行号**: ${issue.lineNumber}\n`;
    markdown += `- **时间戳**: ${issue.timestamp}\n`;
    
    if (issue.runId && issue.runId !== 'N/A') {
      markdown += `- **Run ID**: \`${issue.runId}\`\n`;
    }
    
    if (issue.provider && issue.provider !== 'Unknown') {
      markdown += `- **Provider**: \`${issue.provider}\`\n`;
    }
    
    if (issue.model && issue.model !== 'Unknown') {
      markdown += `- **Model**: \`${issue.model}\`\n`;
    }
    
    if (issue.stopReason) {
      markdown += `- **Stop Reason**: \`${issue.stopReason}\`\n`;
    }
    
    markdown += '\n---\n\n';
  }
  
  return markdown;
}

function calculateStatistics(issues: any[]) {
  const stats: {
    byType: Record<string, number>;
    uniqueSessions: Set<string>;
    uniqueFiles: Set<string>;
  } = {
    byType: {},
    uniqueSessions: new Set(),
    uniqueFiles: new Set(),
  };
  
  for (const issue of issues) {
    stats.byType[issue.errorType] = (stats.byType[issue.errorType] || 0) + 1;
    stats.uniqueSessions.add(issue.sessionId);
    stats.uniqueFiles.add(issue.filePath);
  }
  
  return {
    byType: stats.byType,
    uniqueSessions: stats.uniqueSessions.size,
    uniqueFiles: stats.uniqueFiles.size,
  };
}

async function main() {
  console.log('Starting detailed issue extraction...\n');
  
  const jsonlFiles = findJsonlFiles(LOGS_DIR);
  console.log(`Found ${jsonlFiles.length} transcript files\n`);
  
  if (jsonlFiles.length === 0) {
    console.log('No transcript files found. Exiting.');
    return;
  }
  
  // Analyze each file
  const allIssues = [];
  let processed = 0;
  
  for (const file of jsonlFiles) {
    try {
      const issues = analyzeTranscript(file);
      allIssues.push(...issues);
      
      processed++;
      if (processed % 20 === 0) {
        console.log(`Processed ${processed}/${jsonlFiles.length} files... (${allIssues.length} issues found)`);
      }
    } catch (e: any) {
      console.error(`Error processing ${file}:`, e.message);
    }
  }
  
  console.log(`\nAnalysis complete. Total issues found: ${allIssues.length}\n`);
  
  // Sort issues by type and then by ID
  allIssues.sort((a, b) => {
    if (a.errorType !== b.errorType) {
      return a.errorType.localeCompare(b.errorType);
    }
    return a.id - b.id;
  });
  
  // Re-number after sorting
  allIssues.forEach((issue, index) => {
    issue.id = index + 1;
  });
  
  // Generate report
  const markdown = generateMarkdownReport(allIssues);
  
  // Write to file
  writeFileSync(OUTPUT_FILE, markdown, 'utf-8');
  
  console.log(`✅ Detailed issue list saved to: ${OUTPUT_FILE}`);
  console.log(`📊 Total issues documented: ${allIssues.length}`);
  
  // Print summary
  const stats = calculateStatistics(allIssues);
  console.log('\n📈 Issue Distribution:');
  for (const [type, count] of Object.entries(stats.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${type}: ${count}`);
  }
}

main().catch(console.error);
