#!/usr/bin/env node

/**
 * Debug script to see what the Go server is actually returning for tools/list
 */

import { McpTestClient } from '../utils/mcp-test-client.js';

async function main() {
  console.log('🔍 Debugging Go server tool list response\n');

  const client = new McpTestClient('http://localhost:3000');
  await client.initialize();

  const response = await client.listTools();
  
  console.log('Full response:');
  console.log(JSON.stringify(response, null, 2));
  
  console.log('\n\nFirst tool detailed:');
  if (response.tools && response.tools.length > 0) {
    const firstTool = response.tools[0];
    console.log(`Name: ${firstTool.name}`);
    console.log(`Description: ${firstTool.description}`);
    console.log(`Has inputSchema: ${!!firstTool.inputSchema}`);
    console.log(`InputSchema keys: ${firstTool.inputSchema ? Object.keys(firstTool.inputSchema) : 'null'}`);
    console.log('\nFull inputSchema:');
    console.log(JSON.stringify(firstTool.inputSchema, null, 2));
  }
}

main().catch(console.error);
