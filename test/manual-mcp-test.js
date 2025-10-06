#!/usr/bin/env node

/**
 * Manual MCP test to diagnose the issue
 */

async function test() {
  console.log('Step 1: GET /mcp to establish SSE...');
  
  const response = await fetch('http://localhost:3000/mcp', {
    method: 'GET',
    headers: {
      'Accept': 'text/event-stream'
    }
  });
  
  console.log('Status:', response.status);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  let sessionId = null;
  let buffer = '';
  
  // Read a few chunks
  for (let i = 0; i < 5; i++) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    console.log('Chunk', i, ':', buffer);
    
    // Try to extract session ID
    const match = buffer.match(/sessionId=([^&\s\n]+)/);
    if (match) {
      sessionId = match[1];
      console.log('\nFound session ID:', sessionId);
      break;
    }
  }
  
  if (!sessionId) {
    console.error('Failed to extract session ID');
    reader.cancel();
    return;
  }
  
  console.log('\nStep 2: POST /messages with initialize request...');
  
  const initResponse = await fetch(`http://localhost:3000/messages?sessionId=${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: 'manual-test',
          version: '1.0.0'
        }
      },
      id: 1
    })
  });
  
  console.log('Init response status:', initResponse.status);
  console.log('Init response headers:', Object.fromEntries(initResponse.headers.entries()));
  
  const initText = await initResponse.text();
  console.log('Init response body:', initText.substring(0, 200));
  
  reader.cancel();
}

test().catch(console.error);
