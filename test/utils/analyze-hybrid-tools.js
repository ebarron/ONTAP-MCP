#!/usr/bin/env node

/**
 * Analyze all TypeScript tools that return hybrid format {summary, data}
 * This helps us understand which tools need validation testing
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const toolsDir = join(__dirname, '../../src/tools');

function analyzeFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const fileName = filePath.split('/').pop();
  
  // Find all functions that return hybrid format
  const hybridFunctions = [];
  
  // Pattern: return { summary, data }
  const lines = content.split('\n');
  let currentFunction = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect function definition
    if (line.includes('export async function handle')) {
      const match = line.match(/export async function (handle\w+)/);
      if (match) {
        currentFunction = match[1];
      }
    }
    
    // Detect hybrid return
    if (currentFunction && line.includes('return { summary, data')) {
      // Look back to find the tool name in registerTool calls
      let toolName = null;
      for (let j = Math.max(0, i - 100); j < i; j++) {
        if (lines[j].includes("registerTool('") || lines[j].includes('registerTool("')) {
          const toolMatch = lines[j].match(/registerTool\(['"]([^'"]+)['"]/);
          if (toolMatch) {
            toolName = toolMatch[1];
          }
        }
      }
      
      hybridFunctions.push({
        function: currentFunction,
        toolName: toolName || 'unknown',
        line: i + 1
      });
      currentFunction = null;
    }
  }
  
  return { fileName, hybridFunctions };
}

function main() {
  console.log('🔍 Analyzing TypeScript tools for hybrid format usage...\n');
  
  const files = readdirSync(toolsDir)
    .filter(f => f.endsWith('.ts') && f.endsWith('-tools.ts'));
  
  const allTools = [];
  
  for (const file of files) {
    const filePath = join(toolsDir, file);
    const result = analyzeFile(filePath);
    
    if (result.hybridFunctions.length > 0) {
      console.log(`📄 ${result.fileName}`);
      result.hybridFunctions.forEach(func => {
        console.log(`   ✓ ${func.toolName} (${func.function})`);
        allTools.push({
          file: result.fileName,
          ...func
        });
      });
      console.log();
    }
  }
  
  console.log(`\n📊 Summary: ${allTools.length} tools use hybrid format\n`);
  console.log('Tool Names:');
  allTools.forEach(tool => {
    console.log(`  - ${tool.toolName}`);
  });
  
  // Group by file
  console.log('\n\nBy File:');
  const byFile = {};
  allTools.forEach(tool => {
    if (!byFile[tool.file]) byFile[tool.file] = [];
    byFile[tool.file].push(tool.toolName);
  });
  
  Object.keys(byFile).sort().forEach(file => {
    console.log(`\n${file}:`);
    byFile[file].forEach(tool => console.log(`  - ${tool}`));
  });
}

main();
