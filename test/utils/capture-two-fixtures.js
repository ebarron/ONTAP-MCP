#!/usr/bin/env node

/**
 * Capture golden fixtures for get_cifs_share and cluster_get_qos_policy
 * Uses proper Streamable HTTP protocol (MCP 2025-06-18)
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'http://localhost:3000';
const GOLDEN_DIR = join(__dirname, '../fixtures/hybrid-golden');

async function sendMcpRequest(method, params, sessionId = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  };
  
  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  const response = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    })
  });

  const newSessionId = response.headers.get('mcp-session-id');
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    return { data: await response.json(), sessionId: newSessionId };
  } else if (contentType?.includes('text/event-stream')) {
    // SSE stream - collect all data
    let sseData = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseData += decoder.decode(value, { stream: true });
    }

    // Parse SSE events
    const messages = [];
    for (const line of sseData.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          messages.push(JSON.parse(line.substring(6)));
        } catch (e) {
          // Skip non-JSON lines
        }
      }
    }

    return { data: messages[messages.length - 1], sessionId: newSessionId };
  }

  throw new Error(`Unexpected content type: ${contentType}`);
}

async function main() {
  console.log('🌟 Capturing Golden Fixtures for Missing Tools\n');
  
  // Initialize session
  console.log('Initializing MCP session...');
  const { data: initResult, sessionId } = await sendMcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'capture-script', version: '1.0.0' }
  });
  
  console.log(`✅ Session initialized: ${sessionId}\n`);

  // 1. Capture cluster_get_qos_policy
  console.log('📸 Capturing: cluster_get_qos_policy');
  const qosParams = {
    cluster_name: 'C1_sti245-vsim-ocvs026a_1758285854',
    policy_uuid: '79d911d5-a971-11f0-b21b-005056bd74cc'  // test-fixed-extremefixed-596825
  };
  
  const { data: qosResponse } = await sendMcpRequest('tools/call', {
    name: 'cluster_get_qos_policy',
    arguments: qosParams
  }, sessionId);

  if (qosResponse.error) {
    console.error('  ❌ Error:', qosResponse.error);
    throw new Error(`Failed to capture cluster_get_qos_policy: ${qosResponse.error.message}`);
  }

  const qosFixture = {
    metadata: {
      tool: 'cluster_get_qos_policy',
      category: 'qos',
      capturedAt: new Date().toISOString(),
      cluster: 'C1_sti245-vsim-ocvs026a_1758285854',
      params: qosParams,
      mcpProtocol: '2024-11-05',
      implementation: 'typescript'
    },
    response: qosResponse.result
  };

  writeFileSync(
    join(GOLDEN_DIR, 'cluster_get_qos_policy.json'),
    JSON.stringify(qosFixture, null, 2)
  );
  console.log('  ✅ Saved: cluster_get_qos_policy.json\n');

  // 2. Capture get_cifs_share
  console.log('📸 Capturing: get_cifs_share');
  const cifsParams = {
    cluster_ip: '10.196.19.12',
    username: 'admin',
    password: 'netapp1!',
    name: 'simple-test-share',
    svm_name: 'vs0'
  };
  
  const { data: cifsResponse } = await sendMcpRequest('tools/call', {
    name: 'get_cifs_share',
    arguments: cifsParams
  }, sessionId);

  const cifsFixture = {
    metadata: {
      tool: 'get_cifs_share',
      category: 'cifs',
      capturedAt: new Date().toISOString(),
      cluster: 'C1_sti245-vsim-ocvs026a_1758285854',
      params: cifsParams,
      mcpProtocol: '2024-11-05',
      implementation: 'typescript'
    },
    response: cifsResponse.result
  };

  writeFileSync(
    join(GOLDEN_DIR, 'get_cifs_share.json'),
    JSON.stringify(cifsFixture, null, 2)
  );
  console.log('  ✅ Saved: get_cifs_share.json\n');

  console.log('✅ Done! Golden fixtures captured successfully.\n');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
