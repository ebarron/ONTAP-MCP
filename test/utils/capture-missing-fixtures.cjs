#!/usr/bin/env node

/**
 * Manually capture golden fixtures for get_cifs_share and cluster_get_qos_policy
 */

const fs = require('fs').promises;
const path = require('path');

const MCP_SERVER = 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '../fixtures/hybrid-golden');

// Simple MCP client
async function callMcpTool(toolName, params) {
  const sessionResp = await fetch(`${MCP_SERVER}/mcp`, {
    headers: { 'Accept': 'text/event-stream' }
  });
  
  const text = await sessionResp.text();
  const endpointMatch = text.match(/"type":\s*"endpoint"[^}]*"uri":\s*"([^"]+)"/);
  if (!endpointMatch) throw new Error('No endpoint found');
  
  const endpoint = endpointMatch[1];
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: params }
    })
  });
  
  return await response.json();
}

async function captureFixture(toolName, params, filename) {
  console.log(`\n📸 Capturing: ${toolName}`);
  console.log(`  ℹ️  Params:`, params);
  
  try {
    const response = await callMcpTool(toolName, params);
    
    if (response.error) {
      console.log(`  ❌ Failed: ${response.error.message}`);
      return false;
    }
    
    const fixture = {
      metadata: {
        tool: toolName,
        capturedAt: new Date().toISOString(),
        cluster: params.cluster_name || 'N/A',
        params,
        mcpProtocol: '2024-11-05',
        implementation: 'typescript'
      },
      response: response.result
    };
    
    const filepath = path.join(OUTPUT_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(fixture, null, 2));
    console.log(`  ✅ Saved: ${filename}`);
    return true;
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🌟 Capturing Missing Golden Fixtures\n');
  console.log(`Server: ${MCP_SERVER}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);
  
  // 1. cluster_get_qos_policy
  await captureFixture(
    'cluster_get_qos_policy',
    {
      cluster_name: 'C1_sti245-vsim-ocvs026a_1758285854',
      policy_uuid: 'hardcoded-extreme-fixed-58285854'
    },
    'cluster_get_qos_policy.json'
  );
  
  // 2. get_cifs_share - try with cluster_name first (might work with hybrid tools)
  const cifsSuccess = await captureFixture(
    'get_cifs_share',
    {
      cluster_name: 'C1_sti245-vsim-ocvs026a_1758285854',
      name: 'simple-test-share',
      svm_name: 'vs0'
    },
    'get_cifs_share.json'
  );
  
  // If that didn't work, try with legacy params
  if (!cifsSuccess) {
    console.log(`  ℹ️  Trying with legacy cluster_ip params...`);
    await captureFixture(
      'get_cifs_share',
      {
        cluster_ip: '10.196.19.12',
        username: 'admin',
        password: 'netapp1!',
        name: 'simple-test-share',
        svm_name: 'vs0'
      },
      'get_cifs_share.json'
    );
  }
  
  console.log('\n✅ Done!\n');
}

main().catch(console.error);
