#!/usr/bin/env node
/**
 * Analyze OpenClaw session transcripts for common issues and error patterns
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const LOGS_DIR = join(__dirname, '..', 'logs', 'session-transcript', 'openclaw-logs');

// Issue categories to track
const issueCategories = {
  modelErrors: [],           // Model API errors, failures
  toolErrors: [],            // Tool execution errors
  authErrors: [],            // Authentication/authorization errors
  networkErrors: [],         // Network/connectivity errors
  configErrors: [],          // Configuration errors
  permissionErrors: [],      // Permission/access denied errors
  timeoutErrors: [],         // Timeout errors
  rateLimitErrors: [],       // Rate limiting errors
  parsingErrors: [],         // JSON/parsing errors
  fileErrors: [],            // File I/O errors
  memoryErrors: [],          // Memory/resource errors
  unknownErrors: [],         // Uncategorized errors
};

// Error pattern detection
const errorPatterns = {
  modelErrors: [
    /model.*error/i,
    /api.*error/i,
    /inference.*error/i,
    /provider.*error/i,
    /invalid.*model/i,
    /model.*not.*found/i,
    /model.*unavailable/i,
    /completion.*error/i,
  ],
  toolErrors: [
    /tool.*error/i,
    /tool.*failed/i,
    /tool.*exception/i,
    /execution.*error/i,
    /tool.*timeout/i,
  ],
  authErrors: [
    /auth.*error/i,
    /authentication.*failed/i,
    /authorization.*denied/i,
    /invalid.*token/i,
    /expired.*token/i,
    /credential.*error/i,
    /login.*failed/i,
  ],
  networkErrors: [
    /network.*error/i,
    /connection.*error/i,
    /connect.*timeout/i,
    /dns.*error/i,
    /socket.*error/i,
    /fetch.*error/i,
    /request.*failed/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
  ],
  configErrors: [
    /config.*error/i,
    /configuration.*invalid/i,
    /missing.*config/i,
    /invalid.*setting/i,
    /schema.*error/i,
    /validation.*error/i,
  ],
  permissionErrors: [
    /permission.*denied/i,
    /access.*denied/i,
    /forbidden/i,
    /EACCES/i,
    /EPERM/i,
    /not.*authorized/i,
  ],
  timeoutErrors: [
    /timeout/i,
    /timed.*out/i,
    /deadline.*exceeded/i,
    /request.*timeout/i,
  ],
  rateLimitErrors: [
    /rate.*limit/i,
    /too.*many.*requests/i,
    /429/i,
    /throttl/i,
    /quota.*exceeded/i,
  ],
  parsingErrors: [
    /parse.*error/i,
    /json.*error/i,
    /syntax.*error/i,
    /invalid.*json/i,
    /unexpected.*token/i,
  ],
  fileErrors: [
    /file.*not.*found/i,
    /ENOENT/i,
    /read.*error/i,
    /write.*error/i,
    /disk.*error/i,
    /storage.*error/i,
  ],
  memoryErrors: [
    /out.*of.*memory/i,
    /OOM/i,
    /memory.*limit/i,
    /heap.*error/i,
    /allocation.*failed/i,
  ],
};

// Message types that indicate problems
const problematicMessageTypes = [
  'error',
  'failure',
  'exception',
  'crash',
  'abort',
  'cancelled',
  'rejected',
];

function findJsonlFiles(dir) {
  const results = [];
  
  function scan(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      
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

function analyzeTranscript(filePath) {
  const issues = {
    filePath,
    sessionId: null,
    errors: [],
    warnings: [],
    anomalies: [],
  };
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    let messageCount = 0;
    let errorCount = 0;
    let toolCallCount = 0;
    let toolErrorCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let event;
      
      try {
        event = JSON.parse(line);
      } catch (e) {
        issues.anomalies.push({
          line: i + 1,
          type: 'parse_error',
          message: `Failed to parse JSON: ${e.message}`,
        });
        continue;
      }
      
      // Track session ID
      if (event.type === 'session' && !issues.sessionId) {
        issues.sessionId = event.id;
      }
      
      // Check for error messages
      if (event.type === 'message') {
        messageCount++;
        
        const message = event.message;
        if (!message) continue;
        
        // Check assistant messages for errors
        if (message.role === 'assistant') {
          const content = message.content || [];
          
          for (const item of content) {
            if (item.type === 'text') {
              const text = item.text || '';
              
              // Check for error indicators in text
              for (const [category, patterns] of Object.entries(errorPatterns)) {
                for (const pattern of patterns) {
                  if (pattern.test(text)) {
                    issues.errors.push({
                      line: i + 1,
                      category,
                      message: text.substring(0, 200),
                      pattern: pattern.toString(),
                    });
                    break;
                  }
                }
              }
            }
            
            // Check for tool call errors
            if (item.type === 'toolResult' && item.isError) {
              toolErrorCount++;
              issues.errors.push({
                line: i + 1,
                category: 'toolErrors',
                message: `Tool error: ${item.toolName} - ${(item.content || []).map(c => c.text || '').join(' ').substring(0, 200)}`,
              });
            }
          }
          
          // Check stop reason for abnormal termination
          if (message.stopReason && message.stopReason !== 'stop' && message.stopReason !== 'toolUse') {
            issues.warnings.push({
              line: i + 1,
              type: 'abnormal_stop',
              stopReason: message.stopReason,
            });
          }
        }
        
        // Count tool calls
        if (message.role === 'assistant') {
          const content = message.content || [];
          for (const item of content) {
            if (item.type === 'toolCall') {
              toolCallCount++;
            }
          }
        }
      }
      
      // Check for custom error events
      if (event.type === 'custom' && event.customType) {
        const data = event.data || {};
        const dataStr = JSON.stringify(data).toLowerCase();
        
        for (const [category, patterns] of Object.entries(errorPatterns)) {
          for (const pattern of patterns) {
            if (pattern.test(dataStr) || pattern.test(event.customType)) {
              issues.errors.push({
                line: i + 1,
                category,
                eventType: event.customType,
                message: JSON.stringify(data).substring(0, 200),
              });
              break;
            }
          }
        }
      }
      
      // Check for error-type events
      if (event.type && problematicMessageTypes.some(t => event.type.toLowerCase().includes(t))) {
        issues.errors.push({
          line: i + 1,
          category: 'unknownErrors',
          eventType: event.type,
          message: JSON.stringify(event).substring(0, 200),
        });
      }
    }
    
    // Add summary statistics
    issues.summary = {
      totalLines: lines.length,
      messageCount,
      toolCallCount,
      toolErrorCount,
      errorCount: issues.errors.length,
      warningCount: issues.warnings.length,
      anomalyCount: issues.anomalies.length,
    };
    
  } catch (e) {
    issues.errors.push({
      type: 'file_read_error',
      message: `Failed to read file: ${e.message}`,
    });
  }
  
  return issues;
}

function categorizeIssues(allIssues) {
  const summary = {
    totalSessions: allIssues.length,
    sessionsWithErrors: 0,
    sessionsWithWarnings: 0,
    sessionsWithAnomalies: 0,
    totalErrors: 0,
    totalWarnings: 0,
    totalAnomalies: 0,
    errorDistribution: {},
    commonErrorMessages: {},
    topErrorPatterns: {},
  };
  
  for (const issue of allIssues) {
    if (issue.errors.length > 0) {
      summary.sessionsWithErrors++;
      summary.totalErrors += issue.errors.length;
      
      // Count by category
      for (const error of issue.errors) {
        const category = error.category || 'unknown';
        summary.errorDistribution[category] = (summary.errorDistribution[category] || 0) + 1;
        
        // Track common error messages
        const msgKey = error.message?.substring(0, 100) || 'unknown';
        summary.commonErrorMessages[msgKey] = (summary.commonErrorMessages[msgKey] || 0) + 1;
        
        // Track patterns
        if (error.pattern) {
          summary.topErrorPatterns[error.pattern] = (summary.topErrorPatterns[error.pattern] || 0) + 1;
        }
      }
    }
    
    if (issue.warnings.length > 0) {
      summary.sessionsWithWarnings++;
      summary.totalWarnings += issue.warnings.length;
    }
    
    if (issue.anomalies.length > 0) {
      summary.sessionsWithAnomalies++;
      summary.totalAnomalies += issue.anomalies.length;
    }
  }
  
  return summary;
}

function printReport(summary, sampleIssues) {
  console.log('\n=== OpenClaw Session Transcript Analysis Report ===\n');
  
  console.log('📊 Overall Statistics:');
  console.log(`   Total Sessions Analyzed: ${summary.totalSessions}`);
  console.log(`   Sessions with Errors: ${summary.sessionsWithErrors} (${((summary.sessionsWithErrors / summary.totalSessions) * 100).toFixed(1)}%)`);
  console.log(`   Sessions with Warnings: ${summary.sessionsWithWarnings}`);
  console.log(`   Sessions with Anomalies: ${summary.sessionsWithAnomalies}`);
  console.log(`   Total Errors Found: ${summary.totalErrors}`);
  console.log(`   Total Warnings Found: ${summary.totalWarnings}`);
  console.log(`   Total Anomalies Found: ${summary.totalAnomalies}\n`);
  
  console.log('🔴 Error Distribution by Category:');
  const sortedCategories = Object.entries(summary.errorDistribution)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [category, count] of sortedCategories) {
    const percentage = ((count / summary.totalErrors) * 100).toFixed(1);
    console.log(`   ${category}: ${count} (${percentage}%)`);
  }
  console.log();
  
  console.log('⚠️  Most Common Error Messages:');
  const sortedMessages = Object.entries(summary.commonErrorMessages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  for (const [message, count] of sortedMessages) {
    console.log(`   [${count}x] ${message.substring(0, 150)}`);
  }
  console.log();
  
  console.log('📋 Sample Issues from Sessions:\n');
  for (let i = 0; i < Math.min(5, sampleIssues.length); i++) {
    const issue = sampleIssues[i];
    if (issue.errors.length === 0) continue;
    
    console.log(`Session ${i + 1}: ${issue.sessionId || 'Unknown'}`);
    console.log(`  File: ${issue.filePath.split('/').slice(-3).join('/')}`);
    console.log(`  Summary: ${JSON.stringify(issue.summary)}`);
    
    if (issue.errors.length > 0) {
      console.log(`  First 3 Errors:`);
      issue.errors.slice(0, 3).forEach((error, idx) => {
        console.log(`    ${idx + 1}. [${error.category}] Line ${error.line}: ${error.message?.substring(0, 100)}`);
      });
    }
    
    if (issue.warnings.length > 0) {
      console.log(`  Warnings: ${issue.warnings.length}`);
      issue.warnings.slice(0, 2).forEach((warning, idx) => {
        console.log(`    ${idx + 1}. ${warning.type}: ${JSON.stringify(warning)}`);
      });
    }
    console.log();
  }
}

async function main() {
  console.log('Starting OpenClaw session transcript analysis...\n');
  console.log(`Scanning directory: ${LOGS_DIR}\n`);
  
  // Find all JSONL files
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
      allIssues.push(issues);
      
      processed++;
      if (processed % 10 === 0) {
        console.log(`Processed ${processed}/${jsonlFiles.length} files...`);
      }
    } catch (e) {
      console.error(`Error processing ${file}:`, e.message);
    }
  }
  
  console.log(`\nAnalysis complete. Processing ${allIssues.length} sessions...\n`);
  
  // Generate summary
  const summary = categorizeIssues(allIssues);
  
  // Get sample issues with errors for detailed reporting
  const sampleIssues = allIssues
    .filter(i => i.errors.length > 0 || i.warnings.length > 0)
    .slice(0, 20);
  
  // Print report
  printReport(summary, sampleIssues);
  
  // Save detailed results
  const outputPath = join(__dirname, 'transcript-analysis-results.json');
  const fs = await import('fs');
  fs.writeFileSync(
    outputPath,
    JSON.stringify({
      summary,
      sampleIssues: sampleIssues.slice(0, 10),
      analyzedAt: new Date().toISOString(),
    }, null, 2)
  );
  
  console.log(`\n✅ Detailed results saved to: ${outputPath}`);
}

main().catch(console.error);
