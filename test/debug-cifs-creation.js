#!/usr/bin/env node

/**
 * Test CIFS Share Creation Issue
 * Reproduce the exact error reported by the user
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

async function testCifsShareCreation() {
  console.log('🔍 Testing CIFS Share Creation Issue...\n');
  
  const clustersConfig = loadClusters();
  const httpPort = 3025;
  
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['build/index.js', 'http', httpPort.toString()], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ONTAP_CLUSTERS: JSON.stringify(clustersConfig)
      }
    });

    let serverReady = false;

    server.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('SERVER:', output.trim());
      
      if (output.includes('NetApp ONTAP MCP Server running on HTTP port')) {
        serverReady = true;
        
        setTimeout(async () => {
          try {
            console.log(`\n📡 Testing cluster_create_cifs_share with exact user parameters...`);
            
            const testParams = {
              "access_control": [
                {
                  "permission": "full_control", 
                  "type": "windows", 
                  "user_or_group": "Everyone"
                }
              ],
              "cluster_name": "karan-ontap-1",
              "name": "mpc-test-share",
              "path": "/",
              "svm_name": "vs123"
            };
            
            console.log('Request parameters:');
            console.log(JSON.stringify(testParams, null, 2));
            
            const response = await fetch(`http://localhost:${httpPort}/api/tools/cluster_create_cifs_share`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(testParams)
            });
            
            console.log(`\nResponse status: ${response.status} ${response.statusText}`);
            
            const result = await response.text();
            console.log('Response body:');
            
            try {
              const jsonResult = JSON.parse(result);
              console.log(JSON.stringify(jsonResult, null, 2));
            } catch (e) {
              console.log(result);
            }
            
            // Also test a few variations to diagnose the issue
            console.log(`\n🔍 Testing variations to diagnose the issue...`);
            
            // Test 1: Different path
            const testParams2 = {
              ...testParams,
              "name": "mpc-test-share-2",
              "path": "/vol/test_vol"
            };
            
            console.log(`\nTest 1: Different path (/vol/test_vol)`);
            const response2 = await fetch(`http://localhost:${httpPort}/api/tools/cluster_create_cifs_share`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(testParams2)
            });
            
            const result2 = await response2.text();
            console.log(`Status: ${response2.status}, Response: ${result2.substring(0, 200)}...`);
            
            // Test 2: No access control
            const testParams3 = {
              "cluster_name": "karan-ontap-1",
              "name": "mpc-test-share-3",
              "path": "/",
              "svm_name": "vs123"
            };
            
            console.log(`\nTest 2: No access control`);
            const response3 = await fetch(`http://localhost:${httpPort}/api/tools/cluster_create_cifs_share`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(testParams3)
            });
            
            const result3 = await response3.text();
            console.log(`Status: ${response3.status}, Response: ${result3.substring(0, 200)}...`);
            
            server.kill();
            resolve();
            
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
      if (!serverReady) {
        reject(new Error(`Server exited before becoming ready. Code: ${code}, Signal: ${signal}`));
      }
    });

    setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error('Server failed to start within 10 seconds'));
      }
    }, 10000);
  });
}

async function main() {
  try {
    await testCifsShareCreation();
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

main();