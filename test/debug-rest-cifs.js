#!/usr/bin/env node

/**
 * Debug REST Mode Issues
 * Figure out why CIFS tools aren't working in REST mode
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// MCP JSON-RPC 2.0 helper function
async function callMcpTool(toolName, args, httpPort = 3000) {
  const url = `http://localhost:${httpPort}/mcp`;
  
  const jsonrpcRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    },
    id: Date.now()
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jsonrpcRequest),
  });

  // Response handling now done by callMcpTool
  if (false) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const jsonrpcResponse = response;
  
  // Handle JSON-RPC errors
  if (jsonrpcResponse.error) {
    throw new Error(`JSON-RPC Error ${jsonrpcResponse.error.code}: ${jsonrpcResponse.error.message}${jsonrpcResponse.error.data ? ` - ${jsonrpcResponse.error.data}` : ''}`);
  }

  // Return the result in the same format as REST API for compatibility
  return jsonrpcResponse.result;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadClusters() {
  try {
    const clustersPath = join(__dirname, 'clusters.json');
    const clustersData = readFileSync(clustersPath, 'utf8');
    return JSON.parse(clustersData);
  } catch (error) {
    throw new Error(`Failed to load clusters from clusters.json: ${error.message}`);
  }
}

async function debugRestServer() {
  console.log('🔍 Debugging REST server for CIFS tools...\n');
  
  const clustersConfig = loadClusters();
  const httpPort = 3020;
  
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['build/index.js', 'http', httpPort.toString()], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ONTAP_CLUSTERS: JSON.stringify(clustersConfig)
      }
    });

    let serverReady = false;
    let serverOutput = '';
    let serverError = '';

    server.stdout.on('data', (data) => {
      const output = data.toString();
      serverOutput += output;
      console.log('STDOUT:', output);
    });

    server.stderr.on('data', (data) => {
      const output = data.toString();
      serverError += output;
      console.log('STDERR:', output);
      
      if (output.includes('NetApp ONTAP MCP Server running on HTTP port')) {
        serverReady = true;
        // Test the tools
        setTimeout(async () => {
          try {
            console.log(`\n📡 Testing specific CIFS tool endpoints...`);
            
            // Test a few specific CIFS tools
            const cifsTools = [
              'list_cifs_shares',
              'get_cifs_share', 
              'create_cifs_share',
              'cluster_list_cifs_shares'
            ];
            
            let toolsFound = 0;
            
            for (const toolName of cifsTools) {
              try {
                console.log(`\n🔍 Testing tool: ${toolName}`);
                
                let requestBody = {};
                
                // Set appropriate parameters for each tool
                if (toolName === 'list_cifs_shares') {
                  requestBody = {
                    cluster_name: 'greg-vsim-1',
                    svm_name: 'vs0'
                  };
                } else if (toolName === 'cluster_list_cifs_shares') {
                  requestBody = {
                    cluster_name: 'greg-vsim-1',
                    svm_name: 'vs0'
                  };
                } else if (toolName === 'get_cifs_share') {
                  requestBody = {
                    cluster_name: 'greg-vsim-1',
                    name: 'test_share',
                    svm_name: 'vs0'
                  };
                } else if (toolName === 'create_cifs_share') {
                  requestBody = {
                    cluster_name: 'greg-vsim-1',
                    name: 'test_share',
                    path: '/test_share',
                    svm_name: 'vs0'
                  };
                }
                
                const response = await fetch(`http://localhost:${httpPort}/api/tools/${toolName}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(requestBody)
                });
                
                console.log(`Response status: ${response.status} ${response.statusText}`);
                
                if (response.status === 404) {
                  console.log(`❌ Tool ${toolName} not found in REST API`);
                } else if (response.status === 500) {
                  // Check if it's a real ONTAP API error (not a "not implemented" error)
                  const errorText = await response.text();
                  const errorData = JSON.parse(errorText);
                  
                  if (errorData.error.includes('not implemented in REST API')) {
                    console.log(`❌ Tool ${toolName} not implemented in REST API`);
                  } else {
                    // This is a legitimate ONTAP API error, which means the tool is working
                    console.log(`✅ Tool ${toolName} exists and is calling ONTAP API (ONTAP error is expected for test data)`);
                    toolsFound++;
                  }
                } else if (response.status >= 400 && response.status < 500) {
                  // 4xx means the tool exists but there's a parameter issue
                  console.log(`✅ Tool ${toolName} exists in REST API (parameter validation error is expected)`);
                  toolsFound++;
                } else if (response.status >= 200 && response.status < 300) {
                  console.log(`✅ Tool ${toolName} exists and executed successfully`);
                  toolsFound++;
                } else {
                  console.log(`⚠️  Tool ${toolName} returned unexpected status ${response.status}`);
                }
              } catch (toolError) {
                console.log(`❌ Error testing ${toolName}: ${toolError.message}`);
              }
            }
            
            console.log(`\n📊 CIFS tools found in REST mode: ${toolsFound}/${cifsTools.length}`);
            
            server.kill();
            resolve(toolsFound);
            
          } catch (error) {
            console.error(`\n❌ Test error: ${error.message}`);
            server.kill();
            reject(error);
          }
        }, 2000);
      }
    });

    server.on('error', (error) => {
      console.error('Server spawn error:', error);
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    server.on('exit', (code, signal) => {
      console.log(`Server exited with code ${code}, signal ${signal}`);
      if (!serverReady) {
        reject(new Error(`Server exited before becoming ready. Code: ${code}, Signal: ${signal}`));
      }
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!serverReady) {
        console.log('Server output:', serverOutput);
        console.log('Server error:', serverError);
        server.kill();
        reject(new Error('Server failed to start within 15 seconds'));
      }
    }, 15000);
  });
}

async function main() {
  try {
    await debugRestServer();
  } catch (error) {
    console.error('Debug failed:', error.message);
    process.exit(1);
  }
}

main();