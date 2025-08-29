#!/usr/bin/env node

/**
 * NetApp ONTAP Volume Lifecycle Test
 * Tests create → wait → offline → delete workflow
 * Supports both STDIO and REST API modes
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

// Configuration
const TEST_CONFIG = {
  cluster_name: 'greg-vsim-1',
  svm_name: 'vs0',
  volume_name: `test_lifecycle_${Date.now()}`,
  size: '100MB',
  aggregate_name: 'aggr1_1',
  wait_time: 10000, // 10 seconds
};

const STDIO_CONFIG = {
  cluster_ip: '10.193.184.184',
  username: 'admin',
  password: 'Netapp1!',
};

class VolumeLifecycleTest {
  constructor(mode = 'stdio') {
    this.mode = mode; // 'stdio' or 'rest'
    this.volume_uuid = null;
    this.httpPort = 3003;
    this.serverProcess = null;
  }

  async log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async sleep(ms) {
    await setTimeout(ms);
  }

  // STDIO Mode: Call MCP tools directly via server process
  async callStdioTool(toolName, args) {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        ONTAP_CLUSTERS: JSON.stringify([{
          name: TEST_CONFIG.cluster_name,
          cluster_ip: STDIO_CONFIG.cluster_ip,
          username: STDIO_CONFIG.username,
          password: STDIO_CONFIG.password,
          description: 'Test cluster'
        }])
      };

      const server = spawn('node', ['build/index.js'], {
        cwd: process.cwd(),
        env,
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
      const env = {
        ...process.env,
        ONTAP_CLUSTERS: JSON.stringify([{
          name: TEST_CONFIG.cluster_name,
          cluster_ip: STDIO_CONFIG.cluster_ip,
          username: STDIO_CONFIG.username,
          password: STDIO_CONFIG.password,
          description: 'Test cluster'
        }])
      };

      this.serverProcess = spawn('node', ['build/index.js', `--http=${this.httpPort}`], {
        cwd: process.cwd(),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let started = false;

      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes(`NetApp ONTAP MCP Server running on HTTP port ${this.httpPort}`) && !started) {
          started = true;
          resolve();
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
    await this.log(`🔧 Step 1: Creating volume '${TEST_CONFIG.volume_name}'`);
    
    const createArgs = {
      cluster_name: TEST_CONFIG.cluster_name,
      svm_name: TEST_CONFIG.svm_name,
      volume_name: TEST_CONFIG.volume_name,
      size: TEST_CONFIG.size,
      aggregate_name: TEST_CONFIG.aggregate_name,
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
        cluster_name: TEST_CONFIG.cluster_name,
        svm_name: TEST_CONFIG.svm_name,
      });
      
      const volumeText = listResult.content[0].text;
      const volumeMatch = volumeText.match(new RegExp(`- ${TEST_CONFIG.volume_name} \\(([a-f0-9-]+)\\)`));
      if (volumeMatch) {
        this.volume_uuid = volumeMatch[1];
        await this.log(`📝 Found UUID in volume list: ${this.volume_uuid}`);
      } else {
        throw new Error('Could not extract volume UUID');
      }
    }
  }

  async step2_WaitAndVerify() {
    await this.log(`⏱️ Step 2: Waiting ${TEST_CONFIG.wait_time / 1000} seconds for volume to be ready...`);
    await this.sleep(TEST_CONFIG.wait_time);
    
    // Verify volume exists and is online
    const listResult = await this.callTool('cluster_list_volumes', {
      cluster_name: TEST_CONFIG.cluster_name,
      svm_name: TEST_CONFIG.svm_name,
    });
    
    const volumeText = listResult.content[0].text;
    if (volumeText.includes(TEST_CONFIG.volume_name) && volumeText.includes('State: online')) {
      await this.log(`✅ Volume verified online and ready`);
    } else {
      throw new Error('Volume not found or not online');
    }
  }

  async step3_OfflineVolume() {
    await this.log(`📴 Step 3: Taking volume offline...`);
    
    const offlineArgs = {
      cluster_name: TEST_CONFIG.cluster_name,
      volume_uuid: this.volume_uuid,
    };

    const result = await this.callTool('cluster_offline_volume', offlineArgs);
    await this.log(`✅ Volume offline result: ${result.content[0].text}`);
    
    // Verify volume is offline
    await this.sleep(2000); // Wait 2 seconds for state change
    const listResult = await this.callTool('cluster_list_volumes', {
      cluster_name: TEST_CONFIG.cluster_name,
      svm_name: TEST_CONFIG.svm_name,
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
      cluster_name: TEST_CONFIG.cluster_name,
      volume_uuid: this.volume_uuid,
    };

    const result = await this.callTool('cluster_delete_volume', deleteArgs);
    await this.log(`✅ Volume delete result: ${result.content[0].text}`);
    
    // Verify volume is gone
    await this.sleep(2000); // Wait 2 seconds for deletion
    const listResult = await this.callTool('cluster_list_volumes', {
      cluster_name: TEST_CONFIG.cluster_name,
      svm_name: TEST_CONFIG.svm_name,
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
      await this.log(`📋 Test Config: ${JSON.stringify(TEST_CONFIG, null, 2)}`);
      
      if (this.mode === 'rest') {
        await this.log(`🌐 Starting HTTP server on port ${this.httpPort}...`);
        await this.startHttpServer();
        await this.sleep(2000); // Give server time to fully start
      }

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
