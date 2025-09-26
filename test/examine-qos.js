#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Simple QoS policy examiner - just lists existing policies to understand ONTAP defaults
 */

// Initialize STDIO mode with MCP server
async function initializeStdioMode(clustersData) {
  const serverProcess = spawn('node', ['build/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ONTAP_CLUSTERS: JSON.stringify(clustersData)
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Initialize MCP server with handshake
  await initializeMcpServer(serverProcess);
  
  return async (toolName, params = {}) => {
    return callMcpTool(serverProcess, toolName, params);
  };
}

// MCP server initialization handshake
function initializeMcpServer(serverProcess) {
  return new Promise((resolve, reject) => {
    const initRequest = {
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };
    
    let response = '';
    const handleData = (data) => {
      response += data.toString();
      if (response.includes('\n')) {
        try {
          const parsed = JSON.parse(response.trim());
          if (parsed.id === 0) {
            serverProcess.stdout.removeListener('data', handleData);
            resolve(serverProcess);
          }
        } catch (e) {
          // Continue waiting for complete response
        }
      }
    };
    
    serverProcess.stdout.on('data', handleData);
    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });
    
    serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
    
    setTimeout(() => {
      serverProcess.stdout.removeListener('data', handleData);
      reject(new Error('MCP server initialization timeout'));
    }, 5000);
  });
}

// Call MCP tool via STDIO
function callMcpTool(serverProcess, toolName, params) {
  return new Promise((resolve, reject) => {
    const requestId = Math.floor(Math.random() * 1000000);
    
    const request = {
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params
      }
    };

    let response = '';
    serverProcess.stdout.on('data', (data) => {
      response += data.toString();
    });

    serverProcess.stdin.write(JSON.stringify(request) + '\n');

    // Wait for response
    setTimeout(() => {
      try {
        const lines = response.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const parsed = JSON.parse(lastLine);
        
        if (parsed.error) {
          reject(new Error(`MCP Error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
        } else if (parsed.result && parsed.result.content) {
          const textContent = parsed.result.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('');
          resolve(textContent);
        } else {
          reject(new Error(`Unexpected response format: ${JSON.stringify(parsed)}`));
        }
      } catch (parseError) {
        reject(new Error(`Response parsing error: ${parseError.message}\nResponse: ${response}`));
      }
    }, 3000);
  });
}

async function examineQoSPolicies() {
  console.log(`\n🔍 Examining existing QoS policies to understand ONTAP defaults`);
  
  // Load cluster configuration
  const clustersPath = path.join(__dirname, 'clusters.json');
  const clustersData = JSON.parse(fs.readFileSync(clustersPath, 'utf8'));
  const clusterName = Object.keys(clustersData)[0];
  
  console.log(`🎯 Using cluster: ${clusterName}`);
  
  const callTool = await initializeStdioMode(clustersData);
  
  // List SVMs
  console.log('\n📡 Step 1: List SVMs...');
  const svmList = await callTool('cluster_list_svms', { cluster_name: clusterName });
  console.log('SVMs:', svmList);
  
  // List all QoS policies
  console.log('\n📡 Step 2: List QoS policies...');  
  const qosList = await callTool('cluster_list_qos_policies', { cluster_name: clusterName });
  console.log('QoS Policies:', qosList);
  
  // Try creating a minimal fixed policy to see what parameters ONTAP actually wants
  console.log('\n📡 Step 3: Try creating minimal fixed QoS policy...');
  
  // Find first valid SVM
  let validSvm = 'vs0'; // default guess
  const svmLines = svmList.split('\n');
  for (const line of svmLines) {
    const match = line.match(/^-\s+([^\s(]+)\s*\(/);
    if (match) {
      validSvm = match[1].trim();
      break;
    }
  }
  
  console.log(`Using SVM: ${validSvm}`);
  
  try {
    const createResult = await callTool('cluster_create_qos_policy', {
      cluster_name: clusterName,
      policy_name: `test-simple-${Date.now().toString().slice(-6)}`,
      svm_name: validSvm,
      policy_type: 'fixed',
      max_throughput: '1000iops'
      // No is_shared parameter - let's see if ONTAP has a default
    });
    
    console.log('✅ Simple creation result:', createResult);
  } catch (error) {
    console.log('❌ Simple creation failed:', error.message);
  }
}

// Run the examination
examineQoSPolicies().catch(error => {
  console.error('❌ Examination failed:', error.message);
  process.exit(1);
});