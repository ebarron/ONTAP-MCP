#!/usr/bin/env node

/**
 * NetApp ONTAP Export Policy Lifecycle Test
 * Tests create → add_rule → get → delete workflow
 * Supports both STDIO and HTTP (MCP JSON-RPC 2.0) modes
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { McpTestClient, MCP_PROTOCOL_VERSION } from '../utils/mcp-test-client.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Load cluster configuration from external file
function loadClusters() {
  try {
    const clustersPath = join(__dirname, '../clusters.json');
    const clustersData = readFileSync(clustersPath, 'utf8');
    const clustersObj = JSON.parse(clustersData);
    
    // Convert object format to array format
    const clusters = [];
    for (const [name, config] of Object.entries(clustersObj)) {
      clusters.push({
        name: name,
        cluster_ip: config.cluster_ip,
        username: config.username,
        password: config.password,
        description: config.description
      });
    }
    
    return clusters;
  } catch (error) {
    throw new Error(`Failed to load clusters from clusters.json: ${error.message}`);
  }
}

// Get clusters from the MCP server via HTTP API
async function getClustersFromServer(httpPort = 3000) {
  try {
    const response = await fetch(`http://localhost:${httpPort}/api/tools/list_registered_clusters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    // Response handling now done by callMcpTool
  if (false) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = response;
    
    // Parse the response from the tool
    const clusters = [];
    const content = result.content[0].text;
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Parse lines like "- cluster-name: 10.1.1.1 (description)"
      const match = line.match(/^-\s+([^:]+):\s+([^\s]+)\s+\(([^)]+)\)/);
      if (match) {
        clusters.push({
          name: match[1].trim(),
          cluster_ip: match[2].trim(),
          description: match[3].trim()
        });
      }
    }
    
    return clusters;
  } catch (error) {
    throw new Error(`Failed to get clusters from server: ${error.message}`);
  }
}

// STDIO mode: communicate with MCP server via JSON-RPC over stdin/stdout
async function testStdioMode(cluster) {
  console.log(`\n🔧 Testing STDIO Mode with cluster: ${cluster.name} (${cluster.cluster_ip})`);
  
  const mcpProcess = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ONTAP_CLUSTERS: JSON.stringify([cluster])
    }
  });
  
  let stdoutData = '';
  let stderrData = '';
  
  mcpProcess.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });
  
  mcpProcess.stderr.on('data', (data) => {
    stderrData += data.toString();
  });
  
  // Initialize MCP connection
  const initMessage = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(initMessage) + '\n');
  
  // Wait for initialization response
  await sleep(2000);
  
  const timestamp = Date.now();
  const policyName = `test-policy-stdio-${timestamp}`;
  
  // Test 1: Create Export Policy
  console.log(`📋 Creating export policy: ${policyName}`);
  const createMessage = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "create_export_policy",
      arguments: {
        cluster_name: cluster.name,
        policy_name: policyName,
        svm_name: "svm143"
      }
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(createMessage) + '\n');
  await sleep(3000);
  
  // Test 2: Add Export Rule
  console.log(`📏 Adding export rule to policy: ${policyName}`);
  const addRuleMessage = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "add_export_rule",
      arguments: {
        cluster_name: cluster.name,
        policy_name: policyName,
        svm_name: "svm143",
        clients: [{ match: "192.168.1.0/24" }],
        ro_rule: ["sys"],
        rw_rule: ["sys"],
        superuser: ["none"],
        protocols: ["nfs"]
      }
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(addRuleMessage) + '\n');
  await sleep(3000);
  
  // Test 3: Get Export Policy
  console.log(`📖 Getting export policy: ${policyName}`);
  const getMessage = {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "get_export_policy",
      arguments: {
        cluster_name: cluster.name,
        policy_name: policyName,
        svm_name: "svm143"
      }
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(getMessage) + '\n');
  await sleep(3000);
  
  // Test 4: Delete Export Policy
  console.log(`🗑️ Deleting export policy: ${policyName}`);
  const deleteMessage = {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "delete_export_policy",
      arguments: {
        cluster_name: cluster.name,
        policy_name: policyName,
        svm_name: "svm143"
      }
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(deleteMessage) + '\n');
  await sleep(3000);
  
  // Close the process
  mcpProcess.stdin.end();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      mcpProcess.kill();
      reject(new Error('STDIO test timed out'));
    }, 30000);
    
    mcpProcess.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`✅ STDIO Mode completed with exit code: ${code}`);
      
      if (stderrData.includes('Error') || stderrData.includes('error')) {
        console.error('⚠️ STDERR output:', stderrData.slice(-500));
      }
      
      // Check for success indicators in stdout
      const hasCreateSuccess = stdoutData.includes('created successfully') || stdoutData.includes('Export policy');
      const hasRuleSuccess = stdoutData.includes('rule added') || stdoutData.includes('Export rule');
      const hasDeleteSuccess = stdoutData.includes('deleted successfully') || stdoutData.includes('deleted');
      
      if (hasCreateSuccess && hasRuleSuccess && hasDeleteSuccess) {
        console.log('✅ STDIO Mode: All export policy operations completed successfully');
        resolve(true);
      } else {
        console.log('⚠️ STDIO Mode: Some operations may have failed, check output');
        console.log('Last 500 chars of stdout:', stdoutData.slice(-500));
        resolve(false);
      }
    });
    
    mcpProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`❌ STDIO Mode process error: ${error.message}`);
      reject(error);
    });
  });
}

// REST mode: communicate with MCP server via HTTP API
async function testRestMode(cluster, httpPort = 3000, serverAlreadyRunning = false) {
  console.log(`\n🌐 Testing REST Mode with cluster: ${cluster.name} (${cluster.cluster_ip})`);
  
  let serverProcess = null;
  let mcpClient = null;
  
  // Start HTTP server for testing (unless already running)
  if (!serverAlreadyRunning) {
    serverProcess = spawn('node', ['build/index.js', '--http=3000'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ONTAP_CLUSTERS: JSON.stringify([cluster])
      }
    });
    
  // Wait for server to start
  await sleep(3000);
}

// Initialize MCP client - each test creates its own session
console.log('🆕 Creating new test session and loading clusters');
mcpClient = new McpTestClient(`http://localhost:${httpPort}`);
await mcpClient.initialize();

// Load clusters into session
const { loadClustersIntoSession } = await import('../utils/mcp-test-client.js');
await loadClustersIntoSession(mcpClient);  const timestamp = Date.now();
  const policyName = `test-policy-rest-${timestamp}`;
  
  try {
    // Test 1: Create Export Policy
    console.log(`📋 Creating export policy: ${policyName}`);
    const createResult = await mcpClient.callTool('create_export_policy', {
      cluster_name: cluster.name,
      policy_name: policyName,
      svm_name: "svm143"
    });
    console.log('✅ Create policy response received');
    
    // Test 2: Add Export Rule
    console.log(`📏 Adding export rule to policy: ${policyName}`);
    const addRuleResult = await mcpClient.callTool('add_export_rule', {
      cluster_name: cluster.name,
      policy_name: policyName,
      svm_name: "svm143",
      clients: [{ match: "192.168.1.0/24" }],
      ro_rule: ["sys"],
      rw_rule: ["sys"],
      superuser: ["none"],
      protocols: ["nfs"]
    });
    console.log('✅ Add rule response received');
    
    // Test 3: Get Export Policy
    console.log(`📖 Getting export policy: ${policyName}`);
    const getResult = await mcpClient.callTool('get_export_policy', {
      cluster_name: cluster.name,
      policy_name: policyName,
      svm_name: "svm143"
    });
    console.log('✅ Get policy response received');
    
    // Test 4: List Export Policies (verify our policy appears)
    console.log(`📋 Listing export policies to verify ${policyName} exists`);
    const listResult = await mcpClient.callTool('list_export_policies', {
      cluster_name: cluster.name,
      svm_name: "svm143"
    });
    console.log('✅ List policies response received');
    
    // Validate response format
    if (!listResult.content || !Array.isArray(listResult.content) || !listResult.content[0] || !listResult.content[0].text) {
      throw new Error('List policies response format invalid - missing content[0].text');
    }
    
    // Check if our policy appears in the list
    const listText = listResult.content[0].text;
    if (!listText.includes(policyName)) {
      throw new Error(`Created policy ${policyName} not found in list response`);
    }
    
    console.log(`✅ Policy ${policyName} found in list output`);
    
    // Test 5: Delete Export Policy
    console.log(`🗑️ Deleting export policy: ${policyName}`);
    const deleteResult = await mcpClient.callTool('delete_export_policy', {
      cluster_name: cluster.name,
      policy_name: policyName,
      svm_name: "svm143"
    });
    console.log('✅ Delete policy response received');
    
    console.log('✅ REST Mode: All export policy operations completed successfully');
    return true;
    
  } catch (error) {
    console.error(`❌ REST Mode failed: ${error.message}`);
    return false;
  } finally {
    // Cleanup MCP client
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (error) {
        console.error(`⚠️ Error closing MCP client: ${error.message}`);
      }
    }
    
    // Always cleanup the server process (if we started it)
    if (!serverAlreadyRunning && serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      await sleep(1000);
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(arg => !arg.startsWith('--')) || 'both'; // 'stdio', 'http', or 'both'
  const serverAlreadyRunning = args.includes('--server-running');
  
  console.log('🚀 NetApp ONTAP Export Policy Lifecycle Test');
  console.log(`📋 Testing Mode: ${mode}`);
  if (serverAlreadyRunning) {
    console.log('🔧 Server Already Running: true');
  }
  
  try {
    // Load cluster configuration
    let clusters;
    if (mode === 'http') {
      // For REST mode only, try server first, fallback to clusters.json
      try {
        console.log('\n🔍 Loading clusters from MCP server...');
        clusters = await getClustersFromServer();
      } catch (error) {
        console.log('⚠️ Server not available, loading from clusters.json...');
        clusters = loadClusters();
      }
    } else if (mode === 'both') {
      // For both mode, use clusters.json to avoid server dependency
      console.log('\n🔍 Loading clusters from clusters.json...');
      clusters = loadClusters();
    } else {
      console.log('\n🔍 Loading clusters from clusters.json...');
      clusters = loadClusters();
    }
    
    if (!clusters || clusters.length === 0) {
      throw new Error('No clusters found');
    }
    
    const testCluster = clusters.find(c => c.name === 'karan-ontap-1') || clusters[0];
    console.log(`🎯 Using cluster: ${testCluster.name} (${testCluster.cluster_ip})`);
    
    let stdioSuccess = true;
    let restSuccess = true;
    
    // Run tests based on mode
    if (mode === 'stdio' || mode === 'both') {
      try {
        stdioSuccess = await testStdioMode(testCluster);
      } catch (error) {
        console.error(`❌ STDIO test failed: ${error.message}`);
        stdioSuccess = false;
      }
    }
    
    if (mode === 'http' || mode === 'both') {
      try {
        restSuccess = await testRestMode(testCluster, 3000, serverAlreadyRunning);
      } catch (error) {
        console.error(`❌ REST test failed: ${error.message}`);
        restSuccess = false;
      }
    }
    
    // Summary
    console.log('\n📊 Test Summary:');
    if (mode === 'stdio' || mode === 'both') {
      console.log(`   STDIO Mode: ${stdioSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    }
    if (mode === 'http' || mode === 'both') {
      console.log(`   REST Mode:  ${restSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    }
    
    const overallSuccess = stdioSuccess && restSuccess;
    console.log(`\n🎯 Overall Result: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);
    
    process.exit(overallSuccess ? 0 : 1);
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();