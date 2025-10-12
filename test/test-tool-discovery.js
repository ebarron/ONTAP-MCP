#!/usr/bin/env node
/**
 * Tool Discovery Test
 * Verifies correct tool count in both STDIO and HTTP modes
 */

import { spawn } from 'child_process';
import { McpTestClient } from './mcp-test-client.js';
import { readFileSync } from 'fs';

// Base ONTAP tools: 51 (removed cluster_offline_volume, state now in cluster_update_volume)
// Harvest metrics tools: 9 (enabled when HARVEST_TSDB_URL is set)
const BASE_TOOL_COUNT = 51;
const HARVEST_TOOL_COUNT = 9;
const EXPECTED_TOOL_COUNT = process.env.HARVEST_TSDB_URL ? BASE_TOOL_COUNT + HARVEST_TOOL_COUNT : BASE_TOOL_COUNT;

console.log(`🔍 Harvest integration: ${process.env.HARVEST_TSDB_URL ? 'ENABLED' : 'DISABLED'}`);
console.log(`   Expected tool count: ${EXPECTED_TOOL_COUNT} (${BASE_TOOL_COUNT} base + ${process.env.HARVEST_TSDB_URL ? HARVEST_TOOL_COUNT : 0} harvest)`);

// Load clusters from test/clusters.json
let ONTAP_CLUSTERS;
try {
  ONTAP_CLUSTERS = readFileSync('test/clusters.json', 'utf-8');
} catch (error) {
  console.error('❌ Failed to load test/clusters.json:', error.message);
  process.exit(1);
}

/**
 * Test STDIO mode by spawning MCP server and sending JSON-RPC requests
 */
async function testStdioMode() {
  return new Promise((resolve, reject) => {
    console.log('\n📡 Testing STDIO mode...');
    
    const server = spawn('node', ['build/index.js'], {
      env: { ...process.env, ONTAP_CLUSTERS },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let responseReceived = false;

    server.stdout.on('data', (data) => {
      stdoutData += data.toString();
      
      // Look for JSON-RPC response
      const lines = stdoutData.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          try {
            const response = JSON.parse(line);
            if (response.result?.tools) {
              const toolCount = response.result.tools.length;
              console.log(`STDIO mode returned ${toolCount} tools`);
              
              if (toolCount === EXPECTED_TOOL_COUNT) {
                console.log('✅ STDIO mode: PASS');
                responseReceived = true;
                server.kill();
                resolve(true);
              } else {
                console.error(`❌ STDIO mode: FAIL (expected ${EXPECTED_TOOL_COUNT}, got ${toolCount})`);
                responseReceived = true;
                server.kill();
                resolve(false);
              }
              return;
            }
          } catch (e) {
            // Not JSON or not the response we want
          }
        }
      }
    });

    server.stderr.on('data', (data) => {
      // Ignore stderr (debug logs)
    });

    server.on('close', (code) => {
      if (!responseReceived) {
        console.error('❌ STDIO mode: No response received');
        resolve(false);
      }
    });

    // Send tools/list request via STDIO
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };
    
    server.stdin.write(JSON.stringify(request) + '\n');
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.error('❌ STDIO mode: Timeout');
        server.kill();
        resolve(false);
      }
    }, 5000);
  });
}

/**
 * Test HTTP mode via MCP protocol (uses shared test server on port 3000)
 */
async function testHttpMode() {
  console.log('\n🌐 Testing HTTP mode via MCP protocol...');
  
  const client = new McpTestClient('http://localhost:3000');
  
  try {
    await client.initialize();
    
    const result = await client.sendRequest('tools/list', {});
    
    if (result.error) {
      throw new Error(`tools/list failed: ${result.error.message}`);
    }
    
    const toolCount = result.result?.tools?.length || 0;
    console.log(`HTTP mode returned ${toolCount} tools`);
    
    await client.close();
    
    if (toolCount === EXPECTED_TOOL_COUNT) {
      console.log('✅ HTTP mode: PASS');
      return true;
    } else {
      console.error(`❌ HTTP mode: FAIL (expected ${EXPECTED_TOOL_COUNT}, got ${toolCount})`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ HTTP mode error:', error.message);
    await client.close();
    return false;
  }
}

async function main() {
  console.log('\n=== ONTAP MCP Tool Discovery Test ===');
  
  let allPassed = true;
  
  // Test STDIO mode
  const stdioPass = await testStdioMode();
  allPassed = allPassed && stdioPass;
  
  // Test HTTP mode (uses shared server from run-all-tests.sh)
  const httpPass = await testHttpMode();
  allPassed = allPassed && httpPass;
  
  console.log('\n📊 Results Summary:');
  console.log('==================');
  console.log(`STDIO mode: ${stdioPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`HTTP mode:  ${httpPass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (allPassed) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

main();
