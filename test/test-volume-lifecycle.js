#!/usr/bin/env node

/**
 * NetApp ONTAP Volume Lifecycle Test
 * Tests create → wait → offline → delete workflow
 * Supports both STDIO and REST API modes
 */

import { spawn } from 'child_process';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Parse the response from the tool
    if (result.content && result.content[0] && result.content[0].text) {
      const text = result.content[0].text;
      
      // If no clusters, return empty array
      if (text.includes('No clusters registered')) {
        return [];
      }
      
      // Extract cluster info from the text response
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
      
      return clusters;
    }
    
    throw new Error('Unexpected response format');
  } catch (error) {
    throw new Error(`Failed to get clusters from MCP server: ${error.message}`);
  }
}

// Configuration - dynamically get first cluster from MCP server
async function getTestConfig(httpPort = 3000) {
  const clusters = await getClustersFromServer(httpPort);
  
  if (clusters.length === 0) {
    throw new Error('No clusters found in MCP server configuration');
  }

  const firstCluster = clusters[0];
  
  return {
    cluster_name: firstCluster.name,
    svm_name: process.env.TEST_SVM_NAME || 'vs0', // Allow override via env var
    volume_name: `test_lifecycle_${Date.now()}`,
    size: '100MB',
    aggregate_name: process.env.TEST_AGGREGATE_NAME || 'aggr1_1', // Allow override via env var
    wait_time: 10000, // 10 seconds
    cluster_info: firstCluster
  };
}

class VolumeLifecycleTest {
  constructor(mode = 'stdio') {
    this.mode = mode; // 'stdio' or 'rest'
    this.config = null; // Will be set async
    this.volume_uuid = null;
    this.httpPort = 3000;
    this.serverProcess = null;
  }

  async initialize() {
    this.config = await getTestConfig(this.httpPort);
  }

  async log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async sleep(ms) {
    await sleep(ms);
  }

  // STDIO Mode: Call MCP tools directly via server process
  async callStdioTool(toolName, args) {
    return new Promise((resolve, reject) => {
      const server = spawn('node', ['../build/index.js'], {
        cwd: process.cwd(),
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
            // Parse MCP response
            const lines = output.split('\n').filter(line => line.trim());
            const lastLine = lines[lines.length - 1];
            if (lastLine) {
              const response = JSON.parse(lastLine);
              resolve(response.result);
            } else {
              reject(new Error('No response received'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else {
          reject(new Error(`Server exited with code ${code}: ${errorOutput}`));
        }
      });

      server.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });
    });
  }

  // REST Mode: Call HTTP API endpoints
  async startHttpServer() {
    return new Promise((resolve, reject) => {
      // Use the same cluster configuration that's in the MCP JSON (new object format)
      const clustersEnv = JSON.stringify({
        "greg-vsim-1": {
          "cluster_ip": "10.193.184.184",
          "username": "admin",
          "password": "Netapp1!",
          "description": "Gregs vSim ONTAP cluster"
        },
        "julia-vsim-1": {
          "cluster_ip": "10.193.77.89",
          "username": "admin",
          "password": "Netapp1!",
          "description": "Julias first vSim ONTAP cluster"
        },
        "julia-vsim-2": {
          "cluster_ip": "10.61.183.200",
          "username": "admin",
          "password": "!nT3r$1gH+ K1ouD",
          "description": "Julias second vSim cluster"
        }
      });

      this.serverProcess = spawn('node', ['../build/index.js', `--http=${this.httpPort}`], {
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

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!started) {
          reject(new Error('HTTP server failed to start within 5 seconds'));
        }
      }, 5000);
    });
  }

  async stopHttpServer() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  async callRestTool(toolName, args) {
    const url = `http://localhost:${this.httpPort}/api/tools/${toolName}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return await response.json();
  }

  async callTool(toolName, args) {
    if (this.mode === 'stdio') {
      return await this.callStdioTool(toolName, args);
    } else {
      return await this.callRestTool(toolName, args);
    }
  }

  // Test Steps
  async step1_CreateVolume() {
    await this.log(`🔧 Step 1: Creating volume '${this.config.volume_name}'`);
    
    const createArgs = {
      cluster_name: this.config.cluster_name,
      svm_name: this.config.svm_name,
      volume_name: this.config.volume_name,
      size: this.config.size,
      aggregate_name: this.config.aggregate_name,
    };

    const result = await this.callTool('cluster_create_volume', createArgs);
    await this.log(`✅ Volume created: ${JSON.stringify(result.content[0].text)}`);
    
    // Extract UUID from response
    const text = result.content[0].text;
    const uuidMatch = text.match(/UUID: ([a-f0-9-]+)/);
    if (uuidMatch) {
      this.volume_uuid = uuidMatch[1];
      await this.log(`📝 Extracted UUID: ${this.volume_uuid}`);
    } else {
      // Need to list volumes to get UUID
      await this.log(`🔍 UUID not in response, listing volumes to find it...`);
      const listResult = await this.callTool('cluster_list_volumes', {
        cluster_name: this.config.cluster_name,
        svm_name: this.config.svm_name,
      });
      
      const volumeText = listResult.content[0].text;
      const volumeMatch = volumeText.match(new RegExp(`- ${this.config.volume_name} \\(([a-f0-9-]+)\\)`));
      if (volumeMatch) {
        this.volume_uuid = volumeMatch[1];
        await this.log(`📝 Found UUID in volume list: ${this.volume_uuid}`);
      } else {
        throw new Error('Could not extract volume UUID');
      }
    }
  }

  async step2_WaitAndVerify() {
    await this.log(`⏱️ Step 2: Waiting ${this.config.wait_time / 1000} seconds for volume to be ready...`);
    await this.sleep(this.config.wait_time);
    
    // Verify volume exists and is online
    const listResult = await this.callTool('cluster_list_volumes', {
      cluster_name: this.config.cluster_name,
      svm_name: this.config.svm_name,
    });
    
    const volumeText = listResult.content[0].text;
    if (volumeText.includes(this.config.volume_name) && volumeText.includes('State: online')) {
      await this.log(`✅ Volume verified online and ready`);
    } else {
      throw new Error('Volume not found or not online');
    }
  }

  async step3_OfflineVolume() {
    await this.log(`📴 Step 3: Taking volume offline...`);
    
    const offlineArgs = {
      cluster_name: this.config.cluster_name,
      volume_uuid: this.volume_uuid,
    };

    const result = await this.callTool('cluster_offline_volume', offlineArgs);
    await this.log(`✅ Volume offline result: ${result.content[0].text}`);
    
    // Verify volume is offline
    await this.sleep(2000); // Wait 2 seconds for state change
    const listResult = await this.callTool('cluster_list_volumes', {
      cluster_name: this.config.cluster_name,
      svm_name: this.config.svm_name,
    });
    
    const volumeText = listResult.content[0].text;
    if (volumeText.includes(this.volume_uuid) && volumeText.includes('State: offline')) {
      await this.log(`✅ Volume confirmed offline`);
    } else {
      await this.log(`⚠️ Warning: Volume state not confirmed as offline`);
    }
  }

  async step4_DeleteVolume() {
    await this.log(`🗑️ Step 4: Deleting volume...`);
    
    const deleteArgs = {
      cluster_name: this.config.cluster_name,
      volume_uuid: this.volume_uuid,
    };

    const result = await this.callTool('cluster_delete_volume', deleteArgs);
    await this.log(`✅ Volume delete result: ${result.content[0].text}`);
    
    // Verify volume is gone
    await this.sleep(2000); // Wait 2 seconds for deletion
    const listResult = await this.callTool('cluster_list_volumes', {
      cluster_name: this.config.cluster_name,
      svm_name: this.config.svm_name,
    });
    
    const volumeText = listResult.content[0].text;
    if (!volumeText.includes(this.volume_uuid)) {
      await this.log(`✅ Volume confirmed deleted`);
    } else {
      await this.log(`⚠️ Warning: Volume still appears in listing`);
    }
  }

  async runTest() {
    try {
      await this.log(`🚀 Starting Volume Lifecycle Test (${this.mode.toUpperCase()} mode)`);
      
      if (this.mode === 'rest') {
        await this.log(`🌐 Starting HTTP server on port ${this.httpPort}...`);
        await this.startHttpServer();
        await this.sleep(2000); // Give server time to fully start
      }

      // Initialize configuration after server is started
      await this.log(`🔧 Initializing test configuration...`);
      await this.initialize();
      
      await this.log(`📋 Test Config: ${JSON.stringify(this.config, null, 2)}`);

      await this.step1_CreateVolume();
      await this.step2_WaitAndVerify();
      await this.step3_OfflineVolume();
      await this.step4_DeleteVolume();
      
      await this.log(`🎉 Volume Lifecycle Test COMPLETED SUCCESSFULLY!`);
      
    } catch (error) {
      await this.log(`❌ Test FAILED: ${error.message}`);
      throw error;
    } finally {
      if (this.mode === 'rest') {
        await this.log(`🛑 Stopping HTTP server...`);
        await this.stopHttpServer();
      }
    }
  }
}

// Main execution
async function main() {
  const mode = process.argv[2] || 'stdio';
  
  if (!['stdio', 'rest'].includes(mode)) {
    console.error('Usage: node test-volume-lifecycle.js [stdio|rest]');
    process.exit(1);
  }

  const test = new VolumeLifecycleTest(mode);
  
  try {
    await test.runTest();
    process.exit(0);
  } catch (error) {
    console.error(`\n💥 Test failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
