#!/usr/bin/env node

import { McpStreamableClient } from './mcp-streamable-client.js';

async function disableAutosize() {
  console.log('🔌 Connecting to MCP server...');
  const client = new McpStreamableClient('http://localhost:3000');
  
  await client.initialize();
  console.log('✅ Connected to MCP server');
  
  console.log('\n🔧 Disabling autosize on volume...');
  const result = await client.callTool('cluster_enable_volume_autosize', {
    cluster_name: 'umeng-aff300-01-02',
    volume_uuid: '46e4d669-dd2f-11ed-9baf-00a098d390f2',
    mode: 'off'
  });
  
  console.log('\n✅ Autosize disabled successfully!');
  console.log('Result:', result.content[0].text);
  
  process.exit(0);
}

disableAutosize().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
