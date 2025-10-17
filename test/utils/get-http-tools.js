#!/usr/bin/env node
import { McpTestClient } from './mcp-test-client.js';

async function getTools() {
  const client = new McpTestClient('http://localhost:3000');
  
  try {
    await client.connect();
    
    const response = await client.request({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    
    const tools = response.result.tools.map(t => t.name).sort();
    console.log('Total tools:', tools.length);
    console.log('\nTool names:');
    tools.forEach(t => console.log(t));
    
    await client.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

getTools();
