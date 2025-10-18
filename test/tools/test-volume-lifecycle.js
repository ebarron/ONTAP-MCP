#!/usr/bin/env node

/**
 * NetApp ONTAP Volume Lifecycle Test
 * Tests create → wait → offline → delete workflow
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
    return JSON.parse(clustersData);
  } catch (error) {
    throw new Error(`Failed to load clusters from clusters.json: ${error.message}`);
  }
}

// Get clusters from the MCP server via HTTP API
async function getClustersFromServer(httpPort = 3000) {
  try {
    // Each call creates a new session - HTTP/SSE architecture requires this
    const client = new McpTestClient(`http://localhost:${httpPort}`);
    await client.initialize();
    console.log(`[${new Date().toISOString()}] 🆕 Created session for cluster discovery`);
    
    // Load clusters into the session
    const { loadClustersIntoSession } = await import('../utils/mcp-test-client.js');
    const loadResult = await loadClustersIntoSession(client);
    console.log(`[${new Date().toISOString()}] 📦 Loaded ${loadResult.successCount}/${loadResult.total} clusters`);
    
    const result = await client.callTool('list_registered_clusters', {});
    await client.close();
    
    // Parse the response from the tool
    const text = client.parseContent(result);
    
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

  // Use first available cluster
  const testCluster = clusters[0];
  console.log(`[${new Date().toISOString()}] 🎯 Using cluster: ${testCluster.name} (${testCluster.cluster_ip})`);
  
  // Discover aggregates and SVMs from the cluster
  console.log(`[${new Date().toISOString()}] 🔍 Discovering aggregates and SVMs from cluster...`);
  
  // Get aggregates - create fresh session
  const mcpClient = new McpTestClient(`http://localhost:${httpPort}`);
  await mcpClient.initialize();
  
  // Load clusters into session
  const { loadClustersIntoSession } = await import('../utils/mcp-test-client.js');
  await loadClustersIntoSession(mcpClient);
  
  const aggregateList = await mcpClient.callTool('cluster_list_aggregates', {
    cluster_name: testCluster.name
  });
  
  // Parse hybrid format (new format with {summary, data})
  const aggregateResult = mcpClient.parseHybridFormat(aggregateList);
  let aggregateName = null;
  
  if (aggregateResult.isHybrid && aggregateResult.data && aggregateResult.data.length > 0) {
    // Use structured data from hybrid format
    aggregateName = aggregateResult.data[0].name;
  } else {
    // Fallback to regex parsing for old format
    const aggregateMatch = aggregateResult.summary.match(/- ([^\s(]+)/);
    aggregateName = aggregateMatch ? aggregateMatch[1] : null;
  }
  
  if (!aggregateName) {
    await mcpClient.close();
    throw new Error('Could not find any aggregates on cluster');
  }
  
  console.log(`[${new Date().toISOString()}] ✅ Using aggregate: ${aggregateName}`);
  
  // Get SVMs
  const svmList = await mcpClient.callTool('cluster_list_svms', {
    cluster_name: testCluster.name
  });
  
  // Parse hybrid format
  const svmResult = mcpClient.parseHybridFormat(svmList);
  let svmName = null;
  
  if (svmResult.isHybrid && svmResult.data && svmResult.data.length > 0) {
    // Use structured data from hybrid format
    svmName = svmResult.data[0].name;
  } else {
    // Fallback to regex parsing for old format
    const svmMatch = svmResult.summary.match(/- ([^\s(]+)/);
    svmName = svmMatch ? svmMatch[1] : null;
  }
  
  await mcpClient.close();
  
  if (!svmName) {
    throw new Error('Could not find any SVMs on cluster');
  }
  
  console.log(`[${new Date().toISOString()}] ✅ Using SVM: ${svmName}`);
  
  return {
    cluster_name: testCluster.name,
    svm_name: svmName,
    volume_name: `test_lifecycle_${Date.now()}`,
    size: '100MB',
    aggregate_name: aggregateName,
    wait_time: 10000, // 10 seconds
    cluster_info: testCluster
  };
}

/**
 * Helper: Extract first item name from hybrid format response
 * Handles both object format {summary, data} and string format
 */
function extractFirstItemFromHybridFormat(textOrObj) {
  if (typeof textOrObj === 'object' && textOrObj !== null) {
    // Hybrid format: { summary: "...", data: [...] }
    if (textOrObj.data && Array.isArray(textOrObj.data) && textOrObj.data.length > 0) {
      return textOrObj.data[0].name;
    } else if (textOrObj.summary) {
      // Fallback to parsing summary text
      const match = textOrObj.summary.match(/- ([^\s(]+)/);
      return match ? match[1] : null;
    }
  } else {
    // Old format: text string or JSON string
    const textStr = String(textOrObj || '');
    try {
      const parsed = JSON.parse(textStr);
      if (parsed && parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
        return parsed.data[0].name;
      } else if (parsed && parsed.summary) {
        const match = parsed.summary.match(/- ([^\s(]+)/);
        return match ? match[1] : null;
      }
    } catch (e) {
      // Not JSON, use regex on raw text
      const match = textStr.match(/- ([^\s(]+)/);
      return match ? match[1] : null;
    }
  }
  return null;
}

/**
 * Helper: Extract summary text from hybrid format response
 * Converts object format {summary, data} to plain text for compatibility
 */
function extractTextFromHybridFormat(textOrObj) {
  if (typeof textOrObj === 'object' && textOrObj !== null) {
    // Hybrid format: { summary: "...", data: [...] }
    // Return the summary text for backward compatibility
    return textOrObj.summary || '';
  } else {
    // Old format: already a string or JSON string
    const textStr = String(textOrObj || '');
    try {
      const parsed = JSON.parse(textStr);
      // If it's a parsed hybrid format, return the summary
      if (parsed && parsed.summary) {
        return parsed.summary;
      }
      // Otherwise return original string
      return textStr;
    } catch (e) {
      // Not JSON, return as-is
      return textStr;
    }
  }
}

class VolumeLifecycleTest {
  constructor(mode = 'stdio', serverAlreadyRunning = false) {
    this.mode = mode; // 'stdio' or 'http'
    this.config = null; // Will be set async
    this.volume_uuid = null;
    this.httpPort = 3000;
    this.serverProcess = null;
    this.serverAlreadyRunning = serverAlreadyRunning;
    this.mcpClient = null; // MCP client for HTTP mode
  }

  async initialize() {
    if (this.mode === 'http') {
      // HTTP mode: get from server using cluster_name (server has persistent registry)
      this.config = await getTestConfig(this.httpPort);
    } else {
      // STDIO mode: use cluster_name (ONTAP_CLUSTERS env var provides the registry)
      const clustersData = loadClusters();
      
      // Handle both array and object formats
      let clusters;
      if (Array.isArray(clustersData)) {
        clusters = clustersData;
      } else {
        // Convert object format to array
        clusters = Object.keys(clustersData).map(name => ({
          name,
          ...clustersData[name]
        }));
      }
      
      if (clusters.length === 0) {
        throw new Error('No clusters found in clusters.json');
      }
      
      // Use first available cluster
      const cluster = clusters[0];
      await this.log(`🎯 Using cluster: ${cluster.name}`);
      
      // Discover aggregates and SVMs from the cluster
      await this.log('🔍 Discovering aggregates and SVMs from cluster...');
      
      const aggregateList = await this.callStdioToolDirect('cluster_list_aggregates', {
        cluster_name: cluster.name
      }, clustersData);
      
      // Handle both string and object responses
      const aggregateTextOrObj = aggregateList.content && aggregateList.content[0] 
        ? aggregateList.content[0].text 
        : '';
      
      const aggregateName = extractFirstItemFromHybridFormat(aggregateTextOrObj);
      
      if (!aggregateName) {
        throw new Error('Could not find any aggregates on cluster');
      }
      
      await this.log(`✅ Using aggregate: ${aggregateName}`);
      
      // Get available SVMs
      const svmList = await this.callStdioToolDirect('cluster_list_svms', {
        cluster_name: cluster.name
      }, clustersData);
      
      // Handle both string and object responses
      const svmTextOrObj = svmList.content && svmList.content[0] 
        ? svmList.content[0].text 
        : '';
      
      const svmName = extractFirstItemFromHybridFormat(svmTextOrObj);
      
      if (!svmName) {
        throw new Error('Could not find any SVMs on cluster');
      }
      
      await this.log(`✅ Using SVM: ${svmName}`);
      
      this.config = {
        cluster_name: cluster.name,  // Use cluster_name for STDIO mode too
        svm_name: svmName,
        volume_name: `test_lifecycle_${Date.now()}`,
        size: '100MB',
        aggregate_name: aggregateName,
        wait_time: 10000,
        http_port: this.httpPort,
        cluster_info: cluster
      };
    }
  }

  async log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async sleep(ms) {
    await sleep(ms);
  }

  // Helper for calling STDIO tools during initialization (before config is fully set)
  async callStdioToolDirect(toolName, args, clustersConfig) {
    return new Promise((resolve, reject) => {
      // Convert clusters object to array format for environment variable
      let clustersArray;
      if (Array.isArray(clustersConfig)) {
        clustersArray = clustersConfig;
      } else {
        // Convert object format to array format
        clustersArray = Object.keys(clustersConfig).map(name => ({
          name,
          ...clustersConfig[name]
        }));
      }
      
      const server = spawn('node', ['build/index.js'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ONTAP_CLUSTERS: JSON.stringify(clustersArray)
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      let initialized = false;

      server.stdout.on('data', (data) => {
        output += data.toString();
        
        // Check if we got the initialize response
        if (!initialized && output.includes('"serverInfo"')) {
          initialized = true;
          // Now send the actual tool call
          const toolRequest = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: args
            }
          };
          server.stdin.write(JSON.stringify(toolRequest) + '\n');
          server.stdin.end();
        }
      });

      server.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // First, send MCP initialize request
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          },
        }
      };

      server.stdin.write(JSON.stringify(initRequest) + '\n');

      server.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse MCP response - get the tool call response (id: 2)
            const lines = output.split('\n').filter(line => line.trim());
            let toolResponse = null;
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.id === 2) {
                  toolResponse = parsed;
                  break;
                }
              } catch (e) {
                // Skip non-JSON lines
              }
            }
            
            if (toolResponse) {
              resolve(toolResponse.result);
            } else {
              reject(new Error('No tool response received'));
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
      let initialized = false;

      server.stdout.on('data', (data) => {
        output += data.toString();
        
        // Check if we got the initialize response
        if (!initialized && output.includes('"serverInfo"')) {
          initialized = true;
          // Now send the actual tool call
          const toolRequest = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: args
            }
          };
          server.stdin.write(JSON.stringify(toolRequest) + '\n');
          server.stdin.end();
        }
      });

      server.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // First, send MCP initialize request
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          },
        }
      };

      server.stdin.write(JSON.stringify(initRequest) + '\n');

      server.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse MCP response - get the last JSON-RPC response (the tool call response)
            const lines = output.split('\n').filter(line => line.trim());
            // Find the tool call response (id: 2)
            let toolResponse = null;
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.id === 2) {
                  toolResponse = parsed;
                  break;
                }
              } catch (e) {
                // Skip non-JSON lines
              }
            }
            
            if (toolResponse) {
              resolve(toolResponse.result);
            } else {
              reject(new Error('No tool response received'));
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
    if (this.serverAlreadyRunning) {
      await this.log('Using pre-started HTTP server');
      // Verify server is responsive
      try {
        const response = await fetch(`http://localhost:${this.httpPort}/health`);
        if (!response.ok) {
          throw new Error(`Server health check failed: ${response.status}`);
        }
        await this.log('✅ Server health check passed');
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

  async stopHttpServer() {
    if (this.serverAlreadyRunning) {
      await this.log('Leaving pre-started server running for next test');
      return;
    }

    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  async callHttpTool(toolName, args) {
    // Initialize MCP client if not already done
    if (!this.mcpClient) {
      // Create new session - session reuse doesn't work with HTTP/SSE architecture
      // Each SSE connection creates a new session on the server
      this.mcpClient = new McpTestClient(`http://localhost:${this.httpPort}`);
      await this.mcpClient.initialize();
      await this.log(`🆕 Created new test session: ${this.mcpClient.sessionId}`);
      
      // Load clusters into this session
      if (this.serverAlreadyRunning) {
        const { loadClustersIntoSession } = await import('../utils/mcp-test-client.js');
        const result = await loadClustersIntoSession(this.mcpClient);
        await this.log(`📦 Loaded ${result.successCount}/${result.total} clusters into session`);
      }
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
      const textOrObj = result.content && result.content[0] ? result.content[0].text : '';
      return extractTextFromHybridFormat(textOrObj);
    } else {
      // HTTP/MCP mode - mcpClient.parseContent already handles hybrid format
      if (this.mcpClient) {
        return this.mcpClient.parseContent(result);
      }
      const textOrObj = result.content && result.content[0] ? result.content[0].text : '';
      return extractTextFromHybridFormat(textOrObj);
    }
  }

  // Helper to get cluster auth params (cluster_name for both modes)
  getClusterAuth() {
    return { cluster_name: this.config.cluster_name };
  }

  // Pre-flight cleanup: Remove any leftover test volumes from previous failed runs
  async cleanupOldTestVolumes() {
    try {
      await this.log(`🧹 Pre-flight cleanup: Checking for leftover test volumes...`);
      
      const listResult = await this.callTool('cluster_list_volumes', {
        ...this.getClusterAuth(),
        svm_name: this.config.svm_name,
      });
      
      const volumeText = this.extractText(listResult);
      const lines = volumeText.split('\n');
      
      // Look for test_lifecycle_ volumes
      const testVolumePattern = /- (test_lifecycle_\d+) \(([a-f0-9-]+)\)/;
      let cleanedCount = 0;
      
      for (const line of lines) {
        const match = line.match(testVolumePattern);
        if (match) {
          const volumeName = match[1];
          const volumeUuid = match[2];
          
          await this.log(`   Found old test volume: ${volumeName}, attempting to delete...`);
          
          try {
            // Try to offline first
            await this.callTool('cluster_update_volume', {
              ...this.getClusterAuth(),
              volume_uuid: volumeUuid,
              state: 'offline'
            });
            await this.sleep(1000);
          } catch (error) {
            // May already be offline, continue
          }
          
          try {
            // Delete the volume
            await this.callTool('cluster_delete_volume', {
              ...this.getClusterAuth(),
              volume_uuid: volumeUuid
            });
            cleanedCount++;
            await this.log(`   ✅ Deleted old test volume: ${volumeName}`);
          } catch (error) {
            await this.log(`   ⚠️ Could not delete ${volumeName}: ${error.message}`);
          }
        }
      }
      
      if (cleanedCount > 0) {
        await this.log(`✅ Pre-flight cleanup: Removed ${cleanedCount} old test volume(s)`);
      } else {
        await this.log(`✅ Pre-flight cleanup: No old test volumes found`);
      }
    } catch (error) {
      await this.log(`⚠️ Pre-flight cleanup failed (non-fatal): ${error.message}`);
    }
  }

  // Test Steps
  async step1_CreateVolume() {
    await this.log(`🔧 Step 1: Creating volume '${this.config.volume_name}'`);
    
    const createArgs = {
      ...this.getClusterAuth(),
      svm_name: this.config.svm_name,
      volume_name: this.config.volume_name,
      size: this.config.size,
      aggregate_name: this.config.aggregate_name
    };

    const result = await this.callTool('cluster_create_volume', createArgs);
    
    // Check for errors before proceeding
    if (result.isError) {
      const text = this.extractText(result);
      throw new Error(`Volume creation failed: ${text}`);
    }
    
    const text = this.extractText(result);
    await this.log(`✅ Volume created: ${text.substring(0, 100)}...`);
    
    // Extract UUID from response
    const uuidMatch = text.match(/🆔 \*\*UUID:\*\* ([a-f0-9-]+)|UUID: ([a-f0-9-]+)/);
    if (uuidMatch) {
      this.volume_uuid = uuidMatch[1] || uuidMatch[2];
      await this.log(`📝 Extracted UUID: ${this.volume_uuid}`);
    } else {
      // Need to list volumes to get UUID
      await this.log(`🔍 UUID not in response, listing volumes to find it...`);
      const listResult = await this.callTool('cluster_list_volumes', {
        ...this.getClusterAuth(),
        svm_name: this.config.svm_name,
      });
      
      const volumeText = this.extractText(listResult);
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
      ...this.getClusterAuth(),
      svm_name: this.config.svm_name,
    });
    
    const volumeText = this.extractText(listResult);
    if (volumeText.includes(this.config.volume_name) && volumeText.includes('State: online')) {
      await this.log(`✅ Volume verified online and ready`);
    } else {
      throw new Error('Volume not found or not online');
    }
  }

  async step2_5_UpdateVolumeQoSPolicy() {
    await this.log(`🔄 Step 2.5: Testing comprehensive volume update - changing QoS policy from performance-fixed to value-fixed`);
    
    const updateArgs = {
      ...this.getClusterAuth(),
      volume_uuid: this.volume_uuid,
      qos_policy: 'value-fixed', // Change to value-fixed to test update functionality
      comment: `Updated via comprehensive update tool - ${new Date().toISOString()}`
    };

    const result = await this.callTool('cluster_update_volume', updateArgs);
    const resultText = this.extractText(result);
    await this.log(`✅ Volume update result: ${resultText.substring(0, 100)}...`);
    
    // Verify the update was applied by checking volume configuration
    await this.sleep(2000); // Wait 2 seconds for update to take effect
    
    try {
      const configResult = await this.callTool('get_volume_configuration', {
        volume_uuid: this.volume_uuid
      });
      
      const configText = this.extractText(configResult);
      
      // Try parsing as JSON first (new hybrid format)
      try {
        const parsed = JSON.parse(configText);
        if (parsed.data && parsed.summary) {
          // New hybrid format
          await this.log(`📋 Volume configuration (hybrid format) received`);
          await this.log(`📊 QoS policy in data: ${parsed.data.qos?.policy_name || 'none'}`);
          
          if (parsed.data.qos?.policy_name === 'value-fixed') {
            await this.log(`✅ QoS policy successfully updated to value-fixed (verified via structured data)`);
          } else {
            await this.log(`⚠️ QoS policy in structured data: ${parsed.data.qos?.policy_name || 'none'}`);
          }
          
          // Also log summary snippet for verification
          await this.log(`📝 Summary: ${parsed.summary.substring(0, 200)}...`);
        } else {
          // JSON but not hybrid format - check text
          await this.log(`📋 Volume configuration: ${configText.substring(0, 200)}...`);
          if (configText.includes('value-fixed')) {
            await this.log(`✅ QoS policy successfully updated to value-fixed`);
          }
        }
      } catch (jsonError) {
        // Old text format
        await this.log(`📋 Volume configuration (text format): ${configText.substring(0, 200)}...`);
        
        if (configText.includes('value-fixed')) {
          await this.log(`✅ QoS policy successfully updated to value-fixed`);
        } else {
          await this.log(`⚠️ QoS policy update may not be reflected in configuration yet`);
        }
      }
    } catch (error) {
      await this.log(`⚠️ Could not verify configuration update: ${error.message}`);
    }
  }

  async step3_OfflineVolume() {
    await this.log(`📴 Step 3: Taking volume offline...`);
    
    const offlineArgs = {
      ...this.getClusterAuth(),
      volume_uuid: this.volume_uuid,
      state: 'offline'
    };

    const result = await this.callTool('cluster_update_volume', offlineArgs);
    const resultText = this.extractText(result);
    await this.log(`✅ Volume offline result: ${resultText.substring(0, 100)}...`);
    
    // Verify volume is offline
    await this.sleep(2000); // Wait 2 seconds for state change
    const listResult = await this.callTool('cluster_list_volumes', {
      ...this.getClusterAuth(),
      svm_name: this.config.svm_name,
    });
    
    const volumeText = this.extractText(listResult);
    if (volumeText.includes(this.volume_uuid) && volumeText.includes('State: offline')) {
      await this.log(`✅ Volume confirmed offline`);
    } else {
      await this.log(`⚠️ Warning: Volume state not confirmed as offline`);
    }
  }

  async step4_DeleteVolume() {
    await this.log(`🗑️ Step 4: Deleting volume...`);
    
    const deleteArgs = {
      ...this.getClusterAuth(),
      volume_uuid: this.volume_uuid,
    };

    const result = await this.callTool('cluster_delete_volume', deleteArgs);
    const resultText = this.extractText(result);
    await this.log(`✅ Volume delete result: ${resultText.substring(0, 100)}...`);
    
    // Verify volume is gone
    await this.sleep(2000); // Wait 2 seconds for deletion
    const listResult = await this.callTool('cluster_list_volumes', {
      ...this.getClusterAuth(),
      svm_name: this.config.svm_name,
    });
    
    const volumeText = this.extractText(listResult);
    if (!volumeText.includes(this.volume_uuid)) {
      await this.log(`✅ Volume confirmed deleted`);
    } else {
      await this.log(`⚠️ Warning: Volume still appears in listing`);
    }
  }

  async runTest() {
    try {
      await this.log(`🚀 Starting Volume Lifecycle Test (${this.mode.toUpperCase()} mode)`);
      
      // Start HTTP server for configuration (both modes need this)
      if (this.mode === 'http') {
        await this.log(`🌐 Starting/connecting to HTTP server on port ${this.httpPort}...`);
        await this.startHttpServer();
        await this.sleep(1000); // Give server time to fully start
      }

      // Initialize configuration after server is started
      await this.log(`🔧 Initializing test configuration...`);
      await this.initialize();
      
      await this.log(`📋 Test Config: ${JSON.stringify(this.config, null, 2)}`);

      // Clean up any leftover test volumes from previous failed runs
      await this.cleanupOldTestVolumes();

      await this.step1_CreateVolume();
      await this.step2_WaitAndVerify();
      await this.step2_5_UpdateVolumeQoSPolicy();
      await this.step3_OfflineVolume();
      await this.step4_DeleteVolume();
      
      await this.log(`🎉 Volume Lifecycle Test with QoS Policy-Group Integration COMPLETED SUCCESSFULLY!`);
      
    } catch (error) {
      await this.log(`❌ Test FAILED: ${error.message}`);
      
      // Try to clean up the test volume if it was created
      if (this.volume_uuid) {
        await this.log(`🧹 Attempting cleanup of test volume...`);
        try {
          // Try to offline first
          await this.callTool('cluster_update_volume', {
            ...this.getClusterAuth(),
            volume_uuid: this.volume_uuid,
            state: 'offline'
          });
          await this.sleep(1000);
        } catch (offlineError) {
          await this.log(`⚠️ Could not offline volume (may already be offline): ${offlineError.message}`);
        }
        
        try {
          // Try to delete
          await this.callTool('cluster_delete_volume', {
            ...this.getClusterAuth(),
            volume_uuid: this.volume_uuid
          });
          await this.log(`✅ Cleanup successful: test volume deleted`);
        } catch (deleteError) {
          await this.log(`⚠️ Could not delete volume: ${deleteError.message}`);
          await this.log(`⚠️ Manual cleanup may be required for volume: ${this.config.volume_name || this.volume_uuid}`);
        }
      }
      
      throw error;
    } finally {
      // Close MCP client if we used it
      if (this.mcpClient) {
        await this.mcpClient.close();
        this.mcpClient = null;
      }
      
      // Stop HTTP server if we started it
      if (this.mode === 'http') {
        await this.log(`🛑 Stopping HTTP server...`);
        await this.stopHttpServer();
      }
    }
  }
}

// Main execution
async function main() {
  const mode = process.argv[2] || 'stdio';
  const serverAlreadyRunning = process.argv.includes('--server-running');
  
  if (!['stdio', 'http'].includes(mode)) {
    console.error('Usage: node test-volume-lifecycle.js [stdio|http] [--server-running]');
    process.exit(1);
  }

  const test = new VolumeLifecycleTest(mode, serverAlreadyRunning);
  
  try {
    await test.runTest();
    process.exit(0);
  } catch (error) {
    console.error(`\n💥 Test failed: ${error.message}`);
    process.exit(1);
  }
}

main();

main().catch(console.error);
