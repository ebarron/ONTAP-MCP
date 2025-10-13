#!/usr/bin/env node

/**
 * Simple test for Streamable HTTP Transport (MCP 2025-06-18 spec)
 * Uses SSE streaming (default SDK behavior)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EventSource } from 'eventsource';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'http://localhost:3000';
const MCP_ENDPOINT = `${BASE_URL}/mcp`;

// Load cluster configuration
function loadClusters() {
  try {
    const clustersPath = join(__dirname, '../clusters.json');
    const clustersData = readFileSync(clustersPath, 'utf8');
    return JSON.parse(clustersData);
  } catch (error) {
    throw new Error(`Failed to load clusters from clusters.json: ${error.message}`);
  }
}

/**
 * Parse SSE response to extract JSON-RPC messages
 */
function parseSSEResponse(text) {
  const lines = text.split('\n');
  const messages = [];
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.substring(6);
      try {
        messages.push(JSON.parse(data));
      } catch (e) {
        console.error('Failed to parse SSE data:', data);
      }
    }
  }
  
  return messages;
}

/**
 * Send request and collect SSE response
 */
async function sendRequest(url, body, headers = {}) {
  return new Promise(async (resolve, reject) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...headers
      },
      body: JSON.stringify(body)
    });

    const sessionId = response.headers.get('mcp-session-id');
    const contentType = response.headers.get('content-type');

    console.log(`Response: ${response.status}, Content-Type: ${contentType}, Session-ID: ${sessionId}`);

    if (contentType?.includes('text/event-stream')) {
      // SSE stream - collect all data
      let sseData = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseData += decoder.decode(value, { stream: true });
        }

        const messages = parseSSEResponse(sseData);
        resolve({ sessionId, messages, headers: Object.fromEntries(response.headers.entries()) });
      } catch (error) {
        reject(error);
      }
    } else {
      // JSON response
      const data = await response.json();
      resolve({ sessionId, data, headers: Object.fromEntries(response.headers.entries()) });
    }
  });
}

async function test() {
  console.log('🧪 Testing Streamable HTTP Transport (SSE mode)\n');

  const clusters = loadClusters();

  // Test 1: Initialize
  console.log('Test 1: Initialize session...');
  const initResult = await sendRequest(MCP_ENDPOINT, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
      initializationOptions: { ONTAP_CLUSTERS: clusters }
    }
  });

  console.log('  Session ID:', initResult.sessionId);
  console.log('  Messages:', JSON.stringify(initResult.messages, null, 2));
  
  if (!initResult.sessionId) {
    throw new Error('No session ID in response!');
  }

  const sessionId = initResult.sessionId;

  // Test 2: List tools
  console.log('\nTest 2: List tools...');
  const listResult = await sendRequest(MCP_ENDPOINT, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  }, {
    'Mcp-Session-Id': sessionId,
    'Mcp-Protocol-Version': '2025-06-18'
  });

  console.log('  Tools count:', listResult.messages?.[0]?.result?.tools?.length || 0);

  // Test 3: Call tool
  console.log('\nTest 3: Call list_registered_clusters...');
  const callResult = await sendRequest(MCP_ENDPOINT, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'list_registered_clusters',
      arguments: {}
    }
  }, {
    'Mcp-Session-Id': sessionId,
    'Mcp-Protocol-Version': '2025-06-18'
  });

  console.log('  Result:', callResult.messages?.[0]?.result?.content?.[0]?.text?.substring(0, 200));

  console.log('\n✅ All tests passed!');
}

test().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
