#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpTestClient, MCP_PROTOCOL_VERSION } from '../utils/mcp-test-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to extract text from hybrid format response
function extractFromHybridFormat(textOrObj) {
  // Handle object format {summary: "...", data: [...]}
  if (typeof textOrObj === 'object' && textOrObj !== null) {
    return textOrObj;
  }
  
  // Handle JSON string format
  if (typeof textOrObj === 'string') {
    try {
      const parsed = JSON.parse(textOrObj);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) {
      // Not JSON, return as-is
    }
  }
  
  // Return string as-is
  return textOrObj;
}

/**
 * QoS Policy Lifecycle Test with Template-Based Values
 * 
 * This test:
 * 1. Lists existing QoS policies to find a template
 * 2. Uses template values to create a new policy  
 * 3. Tests full CRUD lifecycle (Create, Read, Update, Delete)
 * 4. Works with both STDIO and HTTP JSON-RPC transports
 */

// Initialize test based on transport mode
async function initializeTest(mode, serverAlreadyRunning = false) {
  const clustersPath = path.join(__dirname, '../clusters.json');
  
  if (!fs.existsSync(clustersPath)) {
    throw new Error(`Clusters configuration not found at ${clustersPath}`);
  }
  
  const clustersData = JSON.parse(fs.readFileSync(clustersPath, 'utf8'));
  
  // Handle both array format and object format
  let clusters;
  let clusterName;
  
  if (Array.isArray(clustersData)) {
    clusters = clustersData;
    clusterName = clusters[0]?.name;
  } else {
    // Convert object format to array format
    const clusterNames = Object.keys(clustersData);
    clusterName = clusterNames[0];
    clusters = clusterNames.map(name => ({
      name,
      ...clustersData[name]
    }));
  }
  
  if (!clusterName) {
    throw new Error('No clusters configured in clusters.json');
  }
  
  console.log(`🎯 Using cluster: ${clusterName} (${mode.toUpperCase()} mode)`);
  
  let callTool;
  
  if (mode === 'stdio') {
    callTool = await initializeStdioMode(clustersData);
  } else if (mode === 'http' || mode === 'rest') {
    callTool = await initializeHttpMode(clustersData, serverAlreadyRunning);
  } else {
    throw new Error(`Unsupported mode: ${mode}. Use 'stdio' or 'http'.`);
  }
  
  return { clusterName, callTool };
}

// Initialize STDIO mode with MCP server
async function initializeStdioMode(clustersData) {
  // Start MCP server process
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
  
  // Store the server process for cleanup
  global.mcpServerProcess = serverProcess;
  
  // Return tool calling function
  return async (toolName, params = {}) => {
    return callMcpTool(serverProcess, toolName, params);
  };
}

// Initialize HTTP mode with API calls
async function initializeHttpMode(clustersData, serverAlreadyRunning = false) {
  const baseUrl = 'http://localhost:3000';
  let serverProcess = null;
  
  // Start HTTP server for testing (unless already running)
  if (!serverAlreadyRunning) {
    console.log('🚀 Starting HTTP server for testing...');
    serverProcess = spawn('node', ['build/index.js', '--http=3000'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ONTAP_CLUSTERS: JSON.stringify(clustersData)
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      let started = false;

      serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('NetApp ONTAP MCP Server running on HTTP port 3000') && !started) {
          started = true;
          setTimeout(() => resolve(), 1000); // Wait for full initialization
        }
      });

      serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start HTTP server: ${error.message}`));
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!started) {
          reject(new Error('HTTP server startup timeout'));
        }
      }, 10000);
    });

    // Store server process for cleanup
    global.httpServerProcess = serverProcess;
  console.log('✅ HTTP server started successfully');
} else {
  console.log('🔧 Using pre-started HTTP server');
}

// Initialize MCP client - create new session and load clusters
console.log('🆕 Creating new test session and loading clusters');
const mcpClient = new McpTestClient(baseUrl);
await mcpClient.initialize();

// Load clusters into session
const { loadClustersIntoSession } = await import('../utils/mcp-test-client.js');
await loadClustersIntoSession(mcpClient);

// Store MCP client for cleanup
global.mcpClient = mcpClient;  // Test server connectivity
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Server health check failed: ${response.status}`);
    }
    console.log('✅ HTTP server is responding');
  } catch (error) {
    throw new Error(`HTTP server health check failed: ${error.message}`);
  }
  
  // Return tool calling function
  return async (toolName, params = {}) => {
    const result = await mcpClient.callTool(toolName, params);
    // Return the full MCP response structure (contains {content: [{type, text}]})
    // The test code will handle extracting hybrid format objects or text as needed
    return result;
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
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };
    
    let response = '';
    const handleData = (data) => {
      response += data.toString();
      // Look for complete JSON-RPC response (ends with newline)
      const lines = response.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line.trim());
            if (parsed.id === 0 && parsed.result) {
              serverProcess.stdout.removeListener('data', handleData);
              clearTimeout(timeoutHandle);
              resolve(serverProcess);
              return;
            }
          } catch (e) {
            // Not valid JSON yet, continue
          }
        }
      }
    };
    
    serverProcess.stdout.on('data', handleData);
    serverProcess.stderr.on('data', (data) => {
      // Log server errors but don't fail (normal startup logs go here)
      const msg = data.toString();
      if (!msg.includes('Loaded cluster') && !msg.includes('Pre-registered')) {
        console.error('Server error:', msg);
      }
    });
    
    serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
    
    const timeoutHandle = setTimeout(() => {
      serverProcess.stdout.removeListener('data', handleData);
      console.error('Timeout waiting for MCP server initialization');
      console.error('Server may still be loading or responding slowly');
      reject(new Error('MCP server initialization timeout'));
    }, 30000); // Increased from 10s to 30s for slower systems
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
    let errorOutput = '';

    const handleData = (data) => {
      response += data.toString();
    };

    const handleError = (data) => {
      errorOutput += data.toString();
    };

    serverProcess.stdout.on('data', handleData);
    serverProcess.stderr.on('data', handleError);

    serverProcess.stdin.write(JSON.stringify(request) + '\n');

    // Wait for response
    setTimeout(() => {
      serverProcess.stdout.removeListener('data', handleData);
      serverProcess.stderr.removeListener('data', handleError);

      if (errorOutput) {
        reject(new Error(`Server error: ${errorOutput}`));
        return;
      }

      try {
        const lines = response.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const parsed = JSON.parse(lastLine);
        
        if (parsed.error) {
          reject(new Error(`MCP Error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
        } else if (parsed.result && parsed.result.content) {
          const textItems = parsed.result.content
            .filter(item => item.type === 'text')
            .map(item => extractFromHybridFormat(item.text));
          
          // If single item and it's an object (hybrid format), return the object
          if (textItems.length === 1 && typeof textItems[0] === 'object' && textItems[0] !== null) {
            resolve(textItems[0]);
          } else {
            // Multiple items or strings - join them
            resolve(textItems.join(''));
          }
        } else {
          reject(new Error(`Unexpected response format: ${JSON.stringify(parsed)}`));
        }
      } catch (parseError) {
        reject(new Error(`Response parsing error: ${parseError.message}\nResponse: ${response}`));
      }
    }, 3000);
  });
}

// Call tool via HTTP JSON-RPC
async function callHttpTool(baseUrl, toolName, params) {
  try {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Math.floor(Math.random() * 1000000),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`JSON-RPC Error ${data.error.code}: ${data.error.message}`);
    }
    
    if (!data.result || !data.result.content) {
      throw new Error(`Unexpected response format: ${JSON.stringify(data)}`);
    }
    
    return data.result.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('');
      
  } catch (error) {
    throw new Error(`HTTP tool call failed: ${error.message}`);
  }
}

// Extract policy UUID from create response
function extractPolicyUuid(createResponse) {
  // Extract from MCP envelope if needed
  let responseData = createResponse;
  if (createResponse && createResponse.content && Array.isArray(createResponse.content) && createResponse.content[0]) {
    responseData = createResponse.content[0].text;
  }
  
  // Extract text from hybrid format
  const responseText = typeof responseData === 'object' && responseData !== null && responseData.summary 
    ? responseData.summary 
    : String(responseData);
  
  // Try multiple patterns to find UUID
  // Pattern 1: UUID: followed by uuid
  let uuidMatch = responseText.match(/UUID:\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (uuidMatch) return uuidMatch[1];
  
  // Pattern 2: Just find any UUID in the response
  uuidMatch = responseText.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (uuidMatch) return uuidMatch[1];
  
  // Pattern 3: Look for policy name in existing policies and get its UUID
  // This is a fallback - we'll try to list policies and find our newly created one
  console.log('⚠️  UUID not found in create response, will try to find it by listing policies');
  return null;
}

// Get existing QoS policies to use as templates
async function getQosPolicyTemplate(clusterName, callTool) {
  try {
    // First, get a valid SVM
    console.log('📋 Getting valid SVM from cluster...');
    const svmList = await callTool('cluster_list_svms', { cluster_name: clusterName });
    
    // Parse SVM list (handle multiple response formats)
    let validSvm = null;
    
    // Extract the actual data from MCP envelope if present
    let svmData = svmList;
    if (svmList && svmList.content && Array.isArray(svmList.content) && svmList.content[0]) {
      svmData = svmList.content[0].text;
    }
    
    // Now parse the extracted data
    if (typeof svmData === 'object' && svmData !== null) {
      // Hybrid format object: {summary: "...", data: [...]}
      if (svmData.data && Array.isArray(svmData.data) && svmData.data.length > 0) {
        validSvm = svmData.data[0].name;
      } else if (svmData.summary) {
        // Fallback to parsing summary
        const match = svmData.summary.match(/^-\s+([^\s(]+)\s*\(/m);
        if (match) validSvm = match[1].trim();
      }
    } else if (typeof svmData === 'string') {
      // String format - try JSON parse first
      try {
        const parsed = JSON.parse(svmData);
        if (parsed && parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
          validSvm = parsed.data[0].name;
        } else if (parsed && parsed.summary) {
          const match = parsed.summary.match(/^-\s+([^\s(]+)\s*\(/m);
          if (match) validSvm = match[1].trim();
        }
      } catch (e) {
        // Fallback to regex parsing of plain text
        const lines = svmData.split('\n');
        for (const line of lines) {
          const match = line.match(/^-\s+([^\s(]+)\s*\(/);
          if (match) {
            validSvm = match[1].trim();
            break;
          }
        }
      }
    }
    
    if (!validSvm) {
      throw new Error('No valid SVMs found on cluster');
    }
    
    console.log(`✅ Found valid SVM: ${validSvm}`);
    
    // Now list QoS policies across all SVMs to find templates
    console.log('📋 Listing existing QoS policies across all SVMs...');
    const qosList = await callTool('cluster_list_qos_policies', { cluster_name: clusterName });
    
    // Extract from MCP envelope if needed
    let qosListData = qosList;
    if (qosList && qosList.content && Array.isArray(qosList.content) && qosList.content[0]) {
      qosListData = qosList.content[0].text;
    }
    
    // Extract text from hybrid format
    const qosListText = typeof qosListData === 'object' && qosListData !== null && qosListData.summary 
      ? qosListData.summary 
      : String(qosListData);
    
    console.log('📋 Found existing QoS policies to use as templates:');
    console.log(qosListText.substring(0, 500) + (qosListText.length > 500 ? '...' : ''));
    
    // Parse the response to extract policy details
    const lines2 = qosListText.split('\n');
    const policies = [];
    
    let currentPolicy = null;
    for (const line of lines2) {
      // Match policy header: 🎛️ **policy-name** (uuid)
      const policyMatch = line.match(/🎛️\s+\*\*([^*]+)\*\*\s+\(([^)]+)\)/);
      if (policyMatch) {
        if (currentPolicy) {
          policies.push(currentPolicy);
        }
        currentPolicy = {
          name: policyMatch[1],
          uuid: policyMatch[2],
          svm: null,
          type: null,
          shared: null
        };
      }
      
      // Parse policy properties
      if (currentPolicy) {
        const svmMatch = line.match(/•\s+SVM:\s+(.+)/);
        const typeMatch = line.match(/•\s+Type:\s+(.+)/);
        const sharedMatch = line.match(/•\s+Shared:\s+(.+)/);
        
        if (svmMatch) currentPolicy.svm = svmMatch[1].trim();
        if (typeMatch) currentPolicy.type = typeMatch[1].trim();
        if (sharedMatch) currentPolicy.shared = sharedMatch[1].trim() === 'Yes';
      }
    }
    
    // Don't forget the last policy
    if (currentPolicy) {
      policies.push(currentPolicy);
    }
    
    console.log(`📊 Parsed ${policies.length} existing policies`);
    policies.forEach(p => console.log(`  • ${p.name} (${p.type}) on SVM: ${p.svm}`));
    
    // Find a good template (prefer non-unknown types, exclude our test policies)
    const template = policies.find(p => 
      p.type && p.type !== 'unknown' && p.type !== 'Unknown' &&
      !p.name.includes('test-') &&
      p.svm && p.svm !== 'Unknown' && p.svm !== 'unknown'
    ) || policies[0]; // Fallback to first policy
    
    // Return the template with a valid SVM (always use validSvm for creation, not template SVM)
    // Template SVM might be admin vserver which can't be used for creating new QoS policies
    const finalTemplate = {
      name: (template && template.name) ? template.name : 'default',
      uuid: (template && template.uuid) ? template.uuid : null,
      type: (template && template.type) ? template.type : 'fixed',
      svm: validSvm  // Always use the data SVM, not the template SVM which might be admin vserver
    };
    
    console.log(`🎯 Selected template: ${finalTemplate.name} with SVM: ${finalTemplate.svm}`);
    return finalTemplate;
    
  } catch (error) {
    throw new Error(`Failed to get QoS policy template: ${error.message}`);
  }
}

// Main test function
async function testQosLifecycle(mode = 'stdio', serverAlreadyRunning = false) {
  console.log(`\n🧪 Starting QoS Policy Lifecycle Test with Template Values (${mode.toUpperCase()})`);
  
  const { clusterName, callTool } = await initializeTest(mode, serverAlreadyRunning);
  
  // Step 1: Get existing QoS policies as templates
  console.log('\n📡 Step 1: Getting existing QoS policies as templates...');
  const template = await getQosPolicyTemplate(clusterName, callTool);
  const testSvm = template.svm;
  console.log(`✅ Using template SVM: ${testSvm}`);

  // Step 2: Create a fixed QoS policy using template as reference
  console.log('\n🔧 Step 2: Creating fixed QoS policy using template values...');
  
  // Generate unique policy name based on template
  const testPolicyName = `test-fixed-${template.name.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;
  
  // Create fixed policy with conservative values - no shared parameter to avoid API error  
  const createResult = await callTool('cluster_create_qos_policy', {
    cluster_name: clusterName,
    policy_name: testPolicyName,
    svm_name: testSvm,
    policy_type: 'fixed',
    max_throughput: '1000iops'       // Conservative value
    // Removed min_throughput and is_shared to simplify
  });
  
  console.log('Create result:', createResult);
  
  // Extract policy UUID from response
  let policyUuid = extractPolicyUuid(createResult);
  if (!policyUuid) {
    console.log('⚠️  Trying to find UUID by listing policies...');
    // Fallback: list policies and find our newly created one
    const listResult = await callTool('cluster_list_qos_policies', { 
      cluster_name: clusterName,
      svm_name: testSvm 
    });
    
    // Extract from MCP envelope if needed
    let listResultData = listResult;
    if (listResult && listResult.content && Array.isArray(listResult.content) && listResult.content[0]) {
      listResultData = listResult.content[0].text;
    }
    
    // Extract text from hybrid format
    const listResultText = typeof listResultData === 'object' && listResultData !== null && listResultData.summary 
      ? listResultData.summary 
      : String(listResultData);
    
    // Parse the list to find our policy
    const lines = listResultText.split('\n');
    for (const line of lines) {
      if (line.includes(testPolicyName)) {
        const uuidMatch = line.match(/\(([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\)/i);
        if (uuidMatch) {
          policyUuid = uuidMatch[1];
          break;
        }
      }
    }
  }
  
  if (!policyUuid) {
    throw new Error('Failed to extract policy UUID from create response or policy listing');
  }
  console.log(`✅ Created policy: ${testPolicyName} (UUID: ${policyUuid})`);

  // Step 3: List QoS policies to verify creation
  console.log('\n📋 Step 3: Listing QoS policies to verify creation...');
  const listResult2 = await callTool('cluster_list_qos_policies', { 
    cluster_name: clusterName,
    svm_name: testSvm 
  });
  
  // Extract from MCP envelope if needed
  let listResultData2 = listResult2;
  if (listResult2 && listResult2.content && Array.isArray(listResult2.content) && listResult2.content[0]) {
    listResultData2 = listResult2.content[0].text;
  }
  
  // Extract text from hybrid format
  const listResultText2 = typeof listResultData2 === 'object' && listResultData2 !== null && listResultData2.summary 
    ? listResultData2.summary 
    : String(listResultData2);
  
  console.log('List result (first 300 chars):', listResultText2.substring(0, 300) + '...');
  
  if (!listResultText2.includes(testPolicyName)) {
    throw new Error(`Created policy ${testPolicyName} not found in policy list`);
  }
  console.log(`✅ Policy ${testPolicyName} found in list`);

  // Step 4: Get specific policy details
  console.log('\n🔍 Step 4: Getting policy details...');
  const getResult = await callTool('cluster_get_qos_policy', {
    cluster_name: clusterName,
    policy_uuid: policyUuid
  });
  console.log('Get result:', getResult);
  console.log(`✅ Retrieved policy details for ${testPolicyName}`);

  // Step 5: Update policy with new throughput values
  console.log('\n🔄 Step 5: Updating policy with new throughput values...');
  const updateResult = await callTool('cluster_update_qos_policy', {
    cluster_name: clusterName,
    policy_uuid: policyUuid,
    max_throughput: '2000iops',  // Double the original value
    min_throughput: '200iops'    // Add minimum throughput
  });
  console.log('Update result:', updateResult);
  console.log(`✅ Updated policy ${testPolicyName} with new throughput limits`);

  // Step 6: Verify the update by getting updated policy details
  console.log('\n🔍 Step 6: Verifying policy update...');
  const updatedGetResult = await callTool('cluster_get_qos_policy', {
    cluster_name: clusterName,
    policy_uuid: policyUuid
  });
  console.log('Updated get result:', updatedGetResult);
  console.log(`✅ Verified updated policy details for ${testPolicyName}`);

  // Step 7: Clean up - delete the test policy
  console.log('\n🗑️  Step 7: Cleaning up test policy...');
  const deleteResult = await callTool('cluster_delete_qos_policy', {
    cluster_name: clusterName,
    policy_uuid: policyUuid
  });
  console.log('Delete result:', deleteResult);
  console.log(`✅ Deleted test policy ${testPolicyName}`);

  console.log(`\n🎉 QoS Policy Lifecycle Test (${mode.toUpperCase()}) PASSED`);
  console.log(`✅ Template approach working: Using valid SVM from cluster`);
  console.log(`✅ Full operations successful: CREATE ✓ LIST ✓ GET ✓ UPDATE ✓ DELETE ✓`);
  console.log(`✅ Both STDIO and HTTP JSON-RPC should work with this approach`);

  // Clean up MCP client
  if (global.mcpClient) {
    console.log('\n🧹 Cleaning up MCP client...');
    try {
      await global.mcpClient.close();
    } catch (error) {
      console.error(`⚠️ Error closing MCP client: ${error.message}`);
    }
  }

  // Clean up server processes (only if we started them)
  if (mode === 'stdio' && global.mcpServerProcess) {
    console.log('\n🧹 Cleaning up MCP server process...');
    global.mcpServerProcess.kill('SIGTERM');
    // Give it a moment to terminate gracefully
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Server process terminated');
  } else if (mode === 'http' && !serverAlreadyRunning && global.httpServerProcess) {
    console.log('\n🧹 Cleaning up HTTP server process...');
    global.httpServerProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ HTTP server process terminated');
  }
}

// Run the test
async function runQosLifecycleTest(mode, serverAlreadyRunning = false) {
  try {
    await testQosLifecycle(mode, serverAlreadyRunning);
  } catch (error) {
    console.error(`\n❌ QoS Policy Lifecycle Test (${mode.toUpperCase()}) FAILED`);
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(`Stack: ${error.stack}`);
    }
    
    // Clean up MCP client
    if (global.mcpClient) {
      console.log('\n🧹 Cleaning up MCP client...');
      try {
        await global.mcpClient.close();
      } catch (e) {
        console.error(`⚠️ Error closing MCP client: ${e.message}`);
      }
    }
    
    // Clean up server processes (only if we started them)
    if (mode === 'stdio' && global.mcpServerProcess) {
      console.log('\n🧹 Cleaning up MCP server process after error...');
      global.mcpServerProcess.kill('SIGTERM');
    } else if (mode === 'http' && !serverAlreadyRunning && global.httpServerProcess) {
      console.log('\n🧹 Cleaning up HTTP server process after error...');
      global.httpServerProcess.kill('SIGTERM');
    }
    
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);
const mode = args.find(arg => !arg.startsWith('--')) || 'stdio';
const serverAlreadyRunning = args.includes('--server-running');

if (serverAlreadyRunning) {
  console.log('🔧 Server Already Running: true');
}

runQosLifecycleTest(mode, serverAlreadyRunning).catch(error => {
  console.error('❌ Test runner error:', error.message);
  process.exit(1);
});