#!/usr/bin/env node

/**
 * Dynamic tool count verification for NetApp ONTAP MCP Server
 * This script actually queries the MCP server to count tools rather than using hardcoded values
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

console.log('=== Dynamic NetApp ONTAP MCP Tool Count Verification ===');
console.log('');

// Start the MCP server in STDIO mode
const serverProcess = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: process.cwd()
});

let response = '';
let errorOutput = '';

serverProcess.stdout.on('data', (data) => {
  response += data.toString();
});

serverProcess.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

// Send tools/list request
const toolsListRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list'
};

console.log('📡 Sending tools/list request to MCP server...');
serverProcess.stdin.write(JSON.stringify(toolsListRequest) + '\n');

// Wait for response and process it
setTimeout(() => {
  serverProcess.kill();
  
  try {
    // Parse the response
    const lines = response.split('\n').filter(line => line.trim());
    let toolsResponse = null;
    
    // Find the JSON-RPC response
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.id === 1 && parsed.result && parsed.result.tools) {
          toolsResponse = parsed;
          break;
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    }
    
    if (toolsResponse) {
      const tools = toolsResponse.result.tools;
      console.log(`✅ Successfully retrieved ${tools.length} tools from MCP server`);
      console.log('');
      
      // Categorize tools
      const categories = {
        'Cluster Management': ['add_cluster', 'list_registered_clusters', 'get_all_clusters_info', 'cluster_list_svms', 'cluster_list_aggregates'],
        'Snapshot Policy': tools.filter(t => t.name.includes('snapshot_polic') && !t.name.includes('schedule')).map(t => t.name),
        'Export Policy': tools.filter(t => t.name.includes('export_polic') || t.name.includes('export_rule') || t.name.includes('nfs_access')).map(t => t.name),
        'Legacy Volume (Deprecated)': tools.filter(t => ['list_volumes', 'create_volume', 'get_volume_stats', 'offline_volume', 'delete_volume'].includes(t.name)).map(t => t.name),
        'Multi-cluster Volume': tools.filter(t => t.name.startsWith('cluster_') && (t.name.includes('volume') || t.name.includes('volume_stats'))).map(t => t.name),
        'Volume Configuration': tools.filter(t => t.name.includes('volume_configuration') || t.name.includes('volume_security') || t.name.includes('resize_volume') || t.name.includes('volume_comment')).map(t => t.name),
        'CIFS Legacy': tools.filter(t => t.name.includes('cifs') && !t.name.startsWith('cluster_')).map(t => t.name),
        'CIFS Multi-cluster': tools.filter(t => t.name.includes('cifs') && t.name.startsWith('cluster_')).map(t => t.name),
        'Snapshot Schedule': tools.filter(t => t.name.includes('snapshot_schedule')).map(t => t.name),
        'QoS Policies': tools.filter(t => t.name.includes('qos_polic')).map(t => t.name)
      };
      
      console.log('📊 Tool Categories:');
      let totalCounted = 0;
      Object.entries(categories).forEach(([category, toolNames]) => {
        if (toolNames.length > 0) {
          console.log(`   • ${category}: ${toolNames.length} tools`);
          totalCounted += toolNames.length;
        }
      });
      
      console.log('');
      console.log('📋 All Tools:');
      tools.forEach((tool, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${tool.name}`);
      });
      
      console.log('');
      if (tools.length === 55) {
        console.log('✅ PASS: Found expected 55 tools');
      } else {
        console.log(`❌ FAIL: Expected 55 tools, found ${tools.length}`);
      }
      
      if (totalCounted !== tools.length) {
        console.log(`⚠️  WARNING: Categorized ${totalCounted} tools but server reported ${tools.length}`);
        
        // Find uncategorized tools
        const allCategorized = Object.values(categories).flat();
        const uncategorized = tools.filter(t => !allCategorized.includes(t.name));
        if (uncategorized.length > 0) {
          console.log('❓ Uncategorized tools:');
          uncategorized.forEach(tool => console.log(`   • ${tool.name}`));
        }
      }
      
    } else {
      console.log('❌ Failed to get valid tools/list response');
      console.log('Raw response:', response);
      if (errorOutput) {
        console.log('Error output:', errorOutput);
      }
    }
    
  } catch (error) {
    console.log('❌ Error parsing MCP response:', error.message);
    console.log('Raw response:', response);
    if (errorOutput) {
      console.log('Error output:', errorOutput);
    }
  }
}, 3000);