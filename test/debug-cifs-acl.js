#!/usr/bin/env node

/**
 * Test CIFS ACL Issue Specifically
 * Test creating shares with and without ACLs to isolate the problem
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadClusters() {
  try {
    const clustersPath = join(__dirname, 'clusters.json');
    const clustersData = readFileSync(clustersPath, 'utf8');
    return JSON.parse(clustersData);
  } catch (error) {
    throw new Error(`Failed to load clusters from clusters.json: ${error.message}`);
  }
}

async function testCifsAclIssue() {
  console.log('🔍 Testing CIFS ACL Issue Specifically...\n');
  
  const clustersConfig = loadClusters();
  const httpPort = 3026;
  
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
      if (output.includes('NetApp ONTAP MCP Server running on HTTP port')) {
        serverReady = true;
        
        setTimeout(async () => {
          try {
            // Step 1: Create a share without ACL first
            console.log(`\n📝 Step 1: Creating CIFS share without ACL...`);
            
            const createParams = {
              "cluster_name": "karan-ontap-1",
              "name": "debug-test-share",
              "path": "/",
              "svm_name": "vs123"
            };
            
            const createResponse = await fetch(`http://localhost:${httpPort}/api/tools/cluster_create_cifs_share`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(createParams)
            });
            
            console.log(`Create Response: ${createResponse.status}`);
            const createResult = await createResponse.text();
            console.log(createResult.substring(0, 150) + '...');
            
            if (createResponse.status === 200) {
              console.log(`✅ Share created successfully without ACL`);
              
              // Step 2: Try to update the share with ACL
              console.log(`\n📝 Step 2: Trying to update share with ACL using update_cifs_share...`);
              
              const updateParams = {
                "cluster_name": "karan-ontap-1",
                "name": "debug-test-share",
                "svm_name": "vs123",
                "access_control": [
                  {
                    "permission": "full_control", 
                    "type": "windows", 
                    "user_or_group": "Everyone"
                  }
                ]
              };
              
              const updateResponse = await fetch(`http://localhost:${httpPort}/api/tools/update_cifs_share`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateParams)
              });
              
              console.log(`Update Response: ${updateResponse.status}`);
              const updateResult = await updateResponse.text();
              console.log(updateResult.substring(0, 300) + '...');
              
              // Step 3: Clean up - delete the test share
              console.log(`\n📝 Step 3: Cleaning up test share...`);
              
              const deleteParams = {
                "cluster_name": "karan-ontap-1",
                "name": "debug-test-share",
                "svm_name": "vs123"
              };
              
              const deleteResponse = await fetch(`http://localhost:${httpPort}/api/tools/cluster_delete_cifs_share`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(deleteParams)
              });
              
              console.log(`Delete Response: ${deleteResponse.status}`);
              const deleteResult = await deleteResponse.text();
              console.log(deleteResult.substring(0, 150) + '...');
              
            } else {
              console.log(`❌ Share creation failed, can't test ACL update`);
            }
            
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
    await testCifsAclIssue();
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

main();