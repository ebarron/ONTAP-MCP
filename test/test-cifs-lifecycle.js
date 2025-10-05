#!/usr/bin/env node

/**
 * NetApp ONTAP CIFS Share Lifecycle Test
 * Tests create → configure → delete workflow for CIFS shares
 * Supports both STDIO and HTTP (MCP JSON-RPC 2.0) modes
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { McpTestClient } from './mcp-test-client.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Load cluster configuration from external file
function loadClusters() {
  try {
    const clustersPath = join(__dirname, 'clusters.json');
    const clustersData = readFileSync(clustersPath, 'utf8');
    return JSON.parse(clustersData);
  } catch (error) {
    throw new Error(`Failed to load clusters from clusters.json: ${error.message}`);
  }
}

// Get clusters from the MCP server via HTTP API
async function getClustersFromServer(httpPort = 3000) {
  try {
    // Create new session - HTTP/SSE architecture requires this
    const mcpClient = new McpTestClient(`http://localhost:${httpPort}`);
    await mcpClient.initialize();
    
    // Load clusters into session
    const { loadClustersIntoSession } = await import('./mcp-test-client.js');
    await loadClustersIntoSession(mcpClient);
    
    // Add retry mechanism for server startup
    let result;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!result && attempts < maxAttempts) {
      try {
        result = await mcpClient.callTool('list_registered_clusters', {});
        if (result) break;
      } catch (error) {
        console.log(`DEBUG: Attempt ${attempts + 1} failed:`, error.message);
      }
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      }
    }
    
    // Cleanup
    try {
      await mcpClient.close();
    } catch (e) {
      // Ignore cleanup errors
    }
    
    if (!result) {
      throw new Error(`Failed to get response from server after ${maxAttempts} attempts`);
    }
    
    console.log('DEBUG: Server response:', JSON.stringify(result, null, 2));
    
    if (result.content && result.content[0] && result.content[0].text) {
      const text = result.content[0].text;
      
      if (text.includes('No clusters registered')) {
        return [];
      }
      
      const lines = text.split('\n');
      const clusters = [];
      
      for (const line of lines) {
        if (line.trim().startsWith('- ')) {
          const match = line.match(/- ([^:]+): ([^\s]+) \(([^)]*)\)/);
          if (match) {
            clusters.push({
              name: match[1].trim(),
              cluster_ip: match[2].trim(),
              description: match[3].trim()
            });
          }
        }
      }
      
      console.log('DEBUG: Parsed clusters:', clusters);
      return clusters;
    }
    
    throw new Error('Unexpected response format');
  } catch (error) {
    throw new Error(`Failed to get clusters from MCP server: ${error.message}`);
  }
}

// Configuration - get cluster information based on mode
async function getTestConfig(mode = 'stdio', httpPort = 3000) {
  let clusters = [];
  
  if (mode === 'http') {
    clusters = await getClustersFromServer(httpPort);
  } else {
    // STDIO mode: load clusters from clusters.json
    const clustersConfig = loadClusters();
    // Convert object to array format
    clusters = Object.entries(clustersConfig).map(([name, config]) => ({
      name,
      cluster_ip: config.cluster_ip,
      username: config.username,
      password: config.password,
      description: config.description
    }));
  }
  
  if (clusters.length === 0) {
    throw new Error('No clusters found in configuration');
  }

  // Find a working cluster - prefer karan-ontap-1 as it was successful in other tests
  let testCluster = clusters.find(c => c.name === 'karan-ontap-1');
  if (!testCluster) {
    // Fallback to greg-vsim-1 
    testCluster = clusters.find(c => c.name === 'greg-vsim-1');
  }
  if (!testCluster) {
    // Fallback to any available cluster
    testCluster = clusters[0];
  }
  if (!testCluster) {
    throw new Error('No suitable cluster found in configuration');
  }
  
  return {
    cluster_name: testCluster.name,
    cluster_ip: testCluster.cluster_ip,
    username: testCluster.username, 
    password: testCluster.password,
    test_svm: testCluster.name === 'karan-ontap-1' ? 'vs123' : 'vs0',  // Use correct SVM name per cluster
    aggregate_name: testCluster.name === 'karan-ontap-1' ? 'sti248_vsim_ocvs076k_aggr1' : 'aggr1',  // Use correct aggregate per cluster
    test_volume_name: `test_cifs_vol_${Date.now()}`,
    test_volume_size: '1GB',
    test_share_name: `test_cifs_share_${Date.now()}`,
    test_users: [
      { user_or_group: 'Everyone', permission: 'read', type: 'windows' }
    ]
  };
}

// Main test class
class CifsShareLifecycleTest {
  constructor(mode = 'stdio', serverAlreadyRunning = false) {
    this.mode = mode; // 'stdio' or 'http'
    this.httpPort = 3000; // Standard port - tests run sequentially so no conflicts
    this.serverProcess = null; // For managing HTTP server process
    this.serverAlreadyRunning = serverAlreadyRunning;
    this.mcpClient = null; // MCP client for HTTP mode
  }

  // STDIO Mode: Call MCP tools directly via server process
  async callStdioTool(toolName, args) {
    return new Promise((resolve, reject) => {
      // Load cluster configuration for STDIO mode too
      let clustersConfig;
      try {
        clustersConfig = loadClusters();
      } catch (error) {
        reject(new Error(`Failed to load cluster configuration: ${error.message}`));
        return;
      }

      const server = spawn('node', ['build/index.js'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ONTAP_CLUSTERS: JSON.stringify(clustersConfig)
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      server.stdout.on('data', (data) => {
        output += data.toString();
      });

      server.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Send MCP request
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      server.stdin.write(JSON.stringify(mcpRequest) + '\n');
      server.stdin.end();

      server.on('close', (code) => {
        if (code === 0) {
          try {
            const lines = output.split('\n').filter(line => line.trim());
            const lastLine = lines[lines.length - 1];
            if (lastLine) {
              const response = JSON.parse(lastLine);
              resolve(response.result);
            } else {
              console.log('DEBUG: No response received');
              console.log('DEBUG: Output lines:', lines);
              console.log('DEBUG: Error output:', errorOutput);
              reject(new Error('No response received'));
            }
          } catch (error) {
            console.log('DEBUG: Parse error:', error.message);
            console.log('DEBUG: Raw output:', output);
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else {
          console.log('DEBUG: Server exit code:', code);
          console.log('DEBUG: Error output:', errorOutput);
          reject(new Error(`Server exited with code ${code}: ${errorOutput}`));
        }
      });

      server.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });
    });
  }

  // REST Mode: Call tools via HTTP API
  async callHttpTool(toolName, args) {
    // Initialize MCP client if not already done
    if (!this.mcpClient) {
      // Create new session and load clusters
      console.log('🆕 Creating new test session and loading clusters');
      this.mcpClient = new McpTestClient(`http://localhost:${this.httpPort}`);
      await this.mcpClient.initialize();
      
      // Load clusters into session
      const { loadClustersIntoSession } = await import('./mcp-test-client.js');
      await loadClustersIntoSession(this.mcpClient);
    }

    // Call tool and return result
    const result = await this.mcpClient.callTool(toolName, args);
    return result;
  }

  async callTool(toolName, args) {
    if (this.mode === 'stdio') {
      return await this.callStdioTool(toolName, args);
    } else {
      return await this.callHttpTool(toolName, args);
    }
  }

  // Helper to extract text from result (handles both STDIO and HTTP/MCP formats)
  extractText(result) {
    if (this.mode === 'stdio') {
      // STDIO returns direct result with content array
      return result.content && result.content[0] ? result.content[0].text : '';
    } else {
      // HTTP/MCP returns result with content array
      if (this.mcpClient) {
        return this.mcpClient.parseContent(result);
      }
      return result.content && result.content[0] ? result.content[0].text : '';
    }
  }

  // Start HTTP server for HTTP mode testing
  async startHttpServer() {
    if (this.serverAlreadyRunning) {
      console.log('Using pre-started HTTP server');
      // Verify server is responsive
      try {
        const response = await fetch(`http://localhost:${this.httpPort}/health`);
        if (!response.ok) {
          throw new Error(`Server health check failed: ${response.status}`);
        }
        console.log('✅ Server health check passed');
      } catch (error) {
        throw new Error(`Server not responsive: ${error.message}`);
      }
      return;
    }

    return new Promise((resolve, reject) => {
      // Load cluster configuration from external file
      let clustersConfig;
      try {
        clustersConfig = loadClusters();
        console.log(`[DEBUG] Loaded ${Object.keys(clustersConfig).length} clusters from clusters.json`);
      } catch (error) {
        reject(new Error(`Failed to load cluster configuration: ${error.message}`));
        return;
      }

      const clustersEnv = JSON.stringify(clustersConfig);

      this.serverProcess = spawn('node', ['build/index.js', `--http=${this.httpPort}`], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ONTAP_CLUSTERS: clustersEnv
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let started = false;

      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes(`NetApp ONTAP MCP Server running on HTTP port ${this.httpPort}`) && !started) {
          started = true;
          // Wait a moment for server to fully initialize
          setTimeout(() => resolve(), 1000);
        }
      });

      this.serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start HTTP server: ${error.message}`));
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!started) {
          reject(new Error('HTTP server failed to start within 10 seconds'));
        }
      }, 10000);
    });
  }

  // Stop HTTP server
  async stopHttpServer() {
    if (this.serverAlreadyRunning) {
      console.log('Leaving pre-started server running for next test');
      return;
    }

    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  async runTest() {
    console.log(`\\n🚀 Starting CIFS Share Lifecycle Test (${this.mode.toUpperCase()} mode)\\n`);

    try {
      // Start HTTP server for HTTP mode testing
      if (this.mode === 'http') {
        console.log('📡 Starting HTTP server...');
        await this.startHttpServer();
        console.log(`✅ HTTP server started on port ${this.httpPort}\\n`);
      }

      // Get test configuration
      const config = await getTestConfig(this.mode, this.httpPort);
      let volumeUuid = null; // Declare once at the top
      
      console.log('📋 Test Configuration:');
      console.log(`   Cluster: ${config.cluster_name}`);
      console.log(`   SVM: ${config.test_svm}`);
      console.log(`   Volume: ${config.test_volume_name} (${config.test_volume_size})`);
      console.log(`   CIFS Share: ${config.test_share_name}\\n`);

      // Step 1: Create volume first  
      console.log('📦 Step 1: Creating volume...');
      
      let createResult;
      // Use multi-cluster tools in both HTTP and STDIO modes
      console.log(`📋 Using cluster: ${config.cluster_name}, aggregate: ${config.aggregate_name}`);
      try {
        createResult = await this.callTool('cluster_create_volume', {
          cluster_name: config.cluster_name,
          svm_name: config.test_svm,
          volume_name: config.test_volume_name,
          size: config.test_volume_size,
          aggregate_name: config.aggregate_name
        });
      } catch (error) {
        console.error('❌ Volume creation failed:', error.message);
        throw error;
      }

      console.log('✅ Volume created successfully:');
      if (createResult.content && createResult.content[0]) {
        const volumeText = createResult.content[0].text;
        console.log(volumeText);
        // Extract UUID from the response
        const uuidMatch = volumeText.match(/UUID: ([a-f0-9-]+)/i);
        if (uuidMatch) {
          volumeUuid = uuidMatch[1];
          console.log(`📦 Extracted Volume UUID: ${volumeUuid}`);
        }
      } else {
        console.log(JSON.stringify(createResult, null, 2));
      }

      // Wait a moment for volume to be ready
      await sleep(3000);

      // Step 1b: Create CIFS share on the volume
      console.log('\\n📁 Step 1b: Creating CIFS share on volume...');
      
      let createShareResult;
      if (this.mode === 'http') {
        // HTTP mode: use multi-cluster tools
        createShareResult = await this.callTool('cluster_create_cifs_share', {
          cluster_name: config.cluster_name,
          name: config.test_share_name,
          path: `/`,
          svm_name: config.test_svm,
          comment: 'Test CIFS share created by automated test',
          access_control: config.test_users
        });
      } else {
        // STDIO mode: use single-cluster tools  
        createShareResult = await this.callTool('create_cifs_share', {
          cluster_ip: config.cluster_ip,
          username: config.username,
          password: config.password,
          name: config.test_share_name,
          path: `/`,
          svm_name: config.test_svm,
          comment: 'Test CIFS share created by automated test',
          access_control: config.test_users
        });
      }

      console.log('✅ CIFS share created successfully:');
      if (createShareResult.content && createShareResult.content[0]) {
        console.log(createShareResult.content[0].text);
      } else {
        console.log(JSON.stringify(createShareResult, null, 2));
      }

      // Wait a moment for the volume and share to be fully created
      console.log('\\n⏳ Waiting for volume and share to be fully available...');
      await sleep(3000);

      // Step 2: List CIFS shares to verify creation
      console.log('\\n📋 Step 2: Listing CIFS shares to verify creation...');
      
      let listResult;
      if (this.mode === 'http') {
        // HTTP mode: use multi-cluster tools
        listResult = await this.callTool('cluster_list_cifs_shares', {
          cluster_name: config.cluster_name,
          svm_name: config.test_svm,
          share_name_pattern: config.test_share_name
        });
      } else {
        // STDIO mode: use single-cluster tools
        listResult = await this.callTool('list_cifs_shares', {
          cluster_ip: config.cluster_ip,
          username: config.username,
          password: config.password,
          svm_name: config.test_svm,
          share_name_pattern: config.test_share_name
        });
      }

      if (listResult.content && listResult.content[0]) {
        console.log(listResult.content[0].text);
      } else {
        console.log(JSON.stringify(listResult, null, 2));
      }

      // Step 3: Get detailed share information (optional, skip on HTTP mode for now)
      if (this.mode === 'stdio') {
        console.log('\\n🔍 Step 3: Getting detailed CIFS share information...');
        
        const getShareResult = await this.callTool('get_cifs_share', {
          cluster_ip: config.cluster_ip,
          username: config.username,
          password: config.password,
          name: config.test_share_name,
          svm_name: config.test_svm
        });

        if (getShareResult.content && getShareResult.content[0]) {
          console.log(getShareResult.content[0].text);
        } else {
          console.log(JSON.stringify(getShareResult, null, 2));
        }
      } else {
        console.log('\\n🔍 Step 3: Skipping detailed share information (not available in HTTP mode)...');
      }

      // Step 4: Update CIFS share properties (only available in STDIO mode)
      if (this.mode === 'stdio') {
        console.log('\\n🔧 Step 4: Updating CIFS share properties...');
        const updateResult = await this.callTool('update_cifs_share', {
          cluster_ip: config.cluster_ip,
          username: config.username,
          password: config.password,
          name: config.test_share_name,
          svm_name: config.test_svm,
          comment: 'Updated test CIFS share - comment changed',
          access_control: [
            { user_or_group: 'Everyone', permission: 'change', type: 'windows' }
          ]
        });

        if (updateResult.content && updateResult.content[0]) {
          console.log(updateResult.content[0].text);
        } else {
          console.log(JSON.stringify(updateResult, null, 2));
        }
      } else {
        console.log('\\n🔧 Step 4: Skipping CIFS share update (not available in HTTP mode)...');
      }

      // Step 5: Clean up - Delete CIFS share
      console.log('\\n🗑️  Step 5: Cleaning up - Deleting CIFS share...');
      
      let deleteShareResult;
      if (this.mode === 'http') {
        // HTTP mode: use multi-cluster delete tool
        deleteShareResult = await this.callTool('cluster_delete_cifs_share', {
          cluster_name: config.cluster_name,
          name: config.test_share_name,
          svm_name: config.test_svm
        });
      } else {
        // STDIO mode: use single-cluster tools
        deleteShareResult = await this.callTool('delete_cifs_share', {
          cluster_ip: config.cluster_ip,
          username: config.username,
          password: config.password,
          name: config.test_share_name,
          svm_name: config.test_svm
        });
      }

      if (deleteShareResult.content && deleteShareResult.content[0]) {
        console.log(deleteShareResult.content[0].text);
      } else {
        console.log(JSON.stringify(deleteShareResult, null, 2));
      }

      // Step 6: Clean up - Take volume offline and delete
      console.log('\\n🗑️  Step 6: Taking volume offline for deletion...');
      
      // First get the volume UUID
      let volumesResult;
      // Use multi-cluster tools in both HTTP and STDIO modes
      volumesResult = await this.callTool('cluster_list_volumes', {
        cluster_name: config.cluster_name,
        svm_name: config.test_svm
      });

      if (volumesResult.content && volumesResult.content[0]) {
        const volumeText = volumesResult.content[0].text;
        const uuidMatch = volumeText.match(new RegExp(`${config.test_volume_name}.*?UUID: ([a-f0-9-]+)`, 'i'));
        if (uuidMatch) {
          volumeUuid = uuidMatch[1];
        }
      }

      if (volumeUuid) {
        console.log(`📦 Found volume UUID: ${volumeUuid}`);
        
        // Offline the volume using multi-cluster tools
        let offlineResult;
        offlineResult = await this.callTool('cluster_offline_volume', {
          cluster_name: config.cluster_name,
          volume_uuid: volumeUuid
        });

        console.log('✅ Volume taken offline');
        
        // Wait a moment
        await sleep(2000);

        // Delete the volume using multi-cluster tools
        console.log('\\n🗑️  Step 7: Deleting test volume...');
        let deleteVolumeResult;
        deleteVolumeResult = await this.callTool('cluster_delete_volume', {
          cluster_name: config.cluster_name,
          volume_uuid: volumeUuid
        });

        if (deleteVolumeResult.content && deleteVolumeResult.content[0]) {
          console.log(deleteVolumeResult.content[0].text);
        } else {
          console.log(JSON.stringify(deleteVolumeResult, null, 2));
        }
      } else {
        console.log('⚠️  Could not find volume UUID for cleanup');
      }

      console.log('\\n🎉 CIFS Share Lifecycle Test completed successfully!\\n');

    } catch (error) {
      console.error(`\\n❌ Test failed: ${error.message}\\n`);
      throw error;
    } finally {
      // Close MCP client if we used it
      if (this.mcpClient) {
        await this.mcpClient.close();
        this.mcpClient = null;
      }

      // Always stop HTTP server if running and we started it
      if (this.mode === 'http') {
        await this.stopHttpServer();
      }
    }
  }
}

// Main execution
async function main() {
  const mode = process.argv[2] || 'stdio'; // Default to stdio mode
  const serverAlreadyRunning = process.argv.includes('--server-running');
  
  if (!['stdio', 'http'].includes(mode)) {
    console.error('Usage: node test-cifs-lifecycle.js [stdio|http] [--server-running]');
    process.exit(1);
  }

  const test = new CifsShareLifecycleTest(mode, serverAlreadyRunning);
  
  try {
    await test.runTest();
  } catch (error) {
    console.error('Test execution failed:', error.message);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}