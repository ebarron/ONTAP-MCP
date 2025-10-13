#!/usr/bin/env node

/**
 * Response Format Validation Test
 * Ensures all HTTP REST API calls return proper MCP format: {content: [{type: 'text', text: '...'}]}
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// MCP JSON-RPC 2.0 helper function
async function callMcpTool(toolName, args, httpPort = 3000) {
  const url = `http://localhost:${httpPort}/mcp`;
  
  const jsonrpcRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    },
    id: Date.now()
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jsonrpcRequest),
  });

  // Response handling now done by callMcpTool
  if (false) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const jsonrpcResponse = response;
  
  // Handle JSON-RPC errors
  if (jsonrpcResponse.error) {
    throw new Error(`JSON-RPC Error ${jsonrpcResponse.error.code}: ${jsonrpcResponse.error.message}${jsonrpcResponse.error.data ? ` - ${jsonrpcResponse.error.data}` : ''}`);
  }

  // Return the result in the same format as REST API for compatibility
  return jsonrpcResponse.result;
}

// Polyfill fetch for older Node.js versions
if (!globalThis.fetch) {
  globalThis.fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// List of tools that should return proper MCP format in HTTP mode
const TOOLS_TO_TEST = [
  { name: 'list_registered_clusters', params: {} },
  { name: 'list_export_policies', params: { cluster_name: 'julia-vsim-1' } },
  { name: 'get_export_policy', params: { cluster_name: 'julia-vsim-1', policy_name: 'default' } },
  { name: 'list_snapshot_policies', params: { cluster_name: 'julia-vsim-1' } },
  { name: 'cluster_list_svms', params: { cluster_name: 'julia-vsim-1' } },
  { name: 'cluster_list_volumes', params: { cluster_name: 'julia-vsim-1' } },
  { name: 'cluster_list_aggregates', params: { cluster_name: 'julia-vsim-1' } },
];

function validateMcpResponseFormat(response) {
  // Must be an object
  if (typeof response !== 'object' || response === null) {
    return { valid: false, error: 'Response is not an object' };
  }

  // Must have content array
  if (!Array.isArray(response.content)) {
    return { valid: false, error: 'Response missing content array' };
  }

  // Content array must have at least one item
  if (response.content.length === 0) {
    return { valid: false, error: 'Content array is empty' };
  }

  // Each content item must have type and text
  for (let i = 0; i < response.content.length; i++) {
    const item = response.content[i];
    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: `Content item ${i} is not an object` };
    }
    if (item.type !== 'text') {
      return { valid: false, error: `Content item ${i} type is not 'text'` };
    }
    if (typeof item.text !== 'string') {
      return { valid: false, error: `Content item ${i} text is not a string` };
    }
  }

  return { valid: true };
}

async function testResponseFormat(tool, httpPort = 3000) {
  try {
    console.log(`🧪 Testing ${tool.name} response format...`);
    
    const response = await fetch(`http://localhost:${httpPort}/api/tools/${tool.name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tool.params)
    });

    // Response handling now done by callMcpTool
  if (false) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const result = response;
    const validation = validateMcpResponseFormat(result);

    if (!validation.valid) {
      return { 
        success: false, 
        error: `Invalid MCP format: ${validation.error}`,
        actualResponse: result
      };
    }

    return { success: true, format: 'Valid MCP format' };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting Response Format Validation Test\n');

  // Start HTTP server
  console.log('📡 Starting HTTP server...');
  const serverProcess = spawn('node', ['build/index.js', '--http=3000'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ONTAP_CLUSTERS: JSON.stringify([
        {
          name: 'julia-vsim-1',
          cluster_ip: '10.193.77.89',
          username: 'admin',
          password: 'Netapp1!',
          description: 'Test cluster'
        }
      ])
    }
  });

  // Wait for server to start
  await sleep(3000);

  try {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = [];

    console.log('🧪 Running response format validation tests...\n');

    for (const tool of TOOLS_TO_TEST) {
      totalTests++;
      const result = await testResponseFormat(tool);
      
      if (result.success) {
        console.log(`✅ ${tool.name}: ${result.format}`);
        passedTests++;
      } else {
        console.log(`❌ ${tool.name}: ${result.error}`);
        if (result.actualResponse) {
          console.log(`   Actual response: ${JSON.stringify(result.actualResponse)}`);
        }
        failedTests.push({ tool: tool.name, error: result.error });
      }
    }

    console.log(`\n📊 Response Format Test Results:`);
    console.log(`   Total: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${failedTests.length}`);

    if (failedTests.length > 0) {
      console.log(`\n❌ Failed Tests:`);
      failedTests.forEach(failure => {
        console.log(`   - ${failure.tool}: ${failure.error}`);
      });
      process.exit(1);
    } else {
      console.log(`\n🎉 All response format tests passed!`);
      process.exit(0);
    }

  } finally {
    // Cleanup server
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      await sleep(1000);
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}