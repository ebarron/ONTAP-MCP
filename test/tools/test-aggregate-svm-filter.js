#!/usr/bin/env node

/**
 * NetApp ONTAP Aggregate Listing Test
 * Tests cluster_list_aggregates with and without SVM filtering
 * Supports both STDIO and HTTP (MCP JSON-RPC 2.0) modes
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { McpTestClient } from '../utils/mcp-test-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load cluster configuration from external file
function loadClusters() {
  try {
    const clustersPath = join(__dirname, '../clusters.json');
    const clustersData = readFileSync(clustersPath, 'utf8');
    const clustersObj = JSON.parse(clustersData);
    
    // Convert object to array
    return Object.entries(clustersObj).map(([name, config]) => ({
      name,
      ...config
    }));
  } catch (error) {
    throw new Error(`Failed to load clusters from clusters.json: ${error.message}`);
  }
}

class AggregateListTester {
  constructor(mode = 'stdio', serverAlreadyRunning = false) {
    this.mode = mode;
    this.serverProcess = null;
    this.requestId = 1;
    this.serverAlreadyRunning = serverAlreadyRunning;
    this.mcpClient = null;
  }

  async initialize() {
    if (this.mode === 'http') {
      await this.startHttpServer();
      this.mcpClient = new McpTestClient('http://localhost:3000');
      await this.mcpClient.initialize();
      
      // Load clusters into session
      const clusters = loadClusters();
      if (clusters.length === 0) {
        throw new Error('No clusters configured in test/clusters.json');
      }
      
      // Add first cluster to session
      this.testCluster = clusters[0];
      await this.mcpClient.callTool('add_cluster', {
        name: this.testCluster.name,
        cluster_ip: this.testCluster.cluster_ip,
        username: this.testCluster.username,
        password: this.testCluster.password,
        description: this.testCluster.description || 'Test cluster'
      });
    } else {
      const clusters = loadClusters();
      if (clusters.length === 0) {
        throw new Error('No clusters configured in test/clusters.json');
      }
      this.testCluster = clusters[0];
    }
  }

  async callTool(toolName, params) {
    if (this.mode === 'stdio') {
      return await this.callStdioToolDirect(toolName, params);
    } else {
      const result = await this.mcpClient.callTool(toolName, params);
      return this.mcpClient.parseContent(result);
    }
  }

  async callStdioToolDirect(toolName, params) {
    return new Promise((resolve, reject) => {
      const buildPath = join(__dirname, '..', '..', 'build', 'index.js');
      
      const child = spawn('node', [buildPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let initialized = false;

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // Check if we got the initialize response
        if (!initialized && stdout.includes('"serverInfo"')) {
          initialized = true;
          // Now send the actual tool call
          const toolRequest = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: params
            }
          };
          child.stdin.write(JSON.stringify(toolRequest) + '\n');
          child.stdin.end();
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // First, send MCP initialize request
      const clustersConfig = {
        [this.testCluster.name]: {
          cluster_ip: this.testCluster.cluster_ip,
          username: this.testCluster.username,
          password: this.testCluster.password,
          description: this.testCluster.description || 'Test cluster'
        }
      };

      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          },
          initializationOptions: {
            ONTAP_CLUSTERS: clustersConfig
          }
        }
      };

      child.stdin.write(JSON.stringify(initRequest) + '\n');

      child.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse MCP response - get the tool call response (id: 2)
            const lines = stdout.split('\n').filter(line => line.trim());
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
              if (toolResponse.error) {
                reject(new Error(`Tool error: ${JSON.stringify(toolResponse.error)}`));
              } else if (toolResponse.result && toolResponse.result.content) {
                const textContent = toolResponse.result.content
                  .filter(item => item.type === 'text')
                  .map(item => item.text)
                  .join('');
                resolve(textContent);
              } else {
                reject(new Error('Unexpected response format'));
              }
            } else {
              reject(new Error('No tool response received'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else {
          reject(new Error(`Process exited with code ${code}. Stderr: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      setTimeout(() => {
        if (!initialized) {
          child.kill();
          reject(new Error('MCP initialization timeout'));
        }
      }, 10000);
    });
  }

  async startHttpServer() {
    if (this.serverAlreadyRunning) {
      console.log('🔧 Using pre-started HTTP server');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const buildPath = join(__dirname, '..', '..', 'build', 'index.js');
      this.serverProcess = spawn('node', [buildPath, '--http=3000'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env,
          ONTAP_CLUSTERS: '[]'
        }
      });

      let started = false;
      
      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('NetApp ONTAP MCP Server running on HTTP port 3000') && !started) {
          started = true;
          setTimeout(() => resolve(), 1000);
        }
      });

      this.serverProcess.on('error', reject);
      
      setTimeout(() => {
        if (!started) {
          reject(new Error('Server failed to start within timeout'));
        }
      }, 10000);
    });
  }

  async stopServer() {
    if (this.serverProcess && !this.serverAlreadyRunning) {
      this.serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (this.mcpClient) {
      await this.mcpClient.close();
    }
  }

  async runTests() {
    console.log(`\n🧪 Testing cluster_list_aggregates in ${this.mode.toUpperCase()} mode`);
    console.log(`📋 Using cluster: ${this.testCluster.name} (${this.testCluster.cluster_ip})\n`);
    
    const results = [];
    let allPassed = true;
    
    try {
      // Test 1: List all aggregates (without SVM filter)
      console.log('Test 1: List all aggregates (no SVM filter)');
      const allAggregatesText = await this.callTool('cluster_list_aggregates', {
        cluster_name: this.testCluster.name
      });
      
      const allAggregateNames = this.parseAggregateNames(allAggregatesText);
      
      if (allAggregateNames.length === 0) {
        console.log('❌ FAILED: No aggregates found on cluster');
        allPassed = false;
        results.push({ test: 'list_all_aggregates', passed: false });
      } else {
        console.log(`✅ PASSED: Found ${allAggregateNames.length} aggregates`);
        console.log(`   Aggregates: ${allAggregateNames.join(', ')}\n`);
        results.push({ test: 'list_all_aggregates', passed: true });
      }
      
      // Test 2: Get SVMs to test filtering
      console.log('Test 2: Get SVMs for filtering');
      const svmsText = await this.callTool('cluster_list_svms', {
        cluster_name: this.testCluster.name
      });
      
      const svmNames = this.parseSvmNames(svmsText);
      
      if (svmNames.length === 0) {
        console.log('❌ FAILED: No SVMs found on cluster');
        allPassed = false;
        results.push({ test: 'list_svms', passed: false });
      } else {
        console.log(`✅ PASSED: Found ${svmNames.length} SVMs`);
        console.log(`   SVMs: ${svmNames.join(', ')}\n`);
        results.push({ test: 'list_svms', passed: true });
        
        // Test 3: List aggregates for first SVM
        const testSvm = svmNames[0];
        console.log(`Test 3: List aggregates for SVM '${testSvm}'`);
        
        const svmAggregatesText = await this.callTool('cluster_list_aggregates', {
          cluster_name: this.testCluster.name,
          svm_name: testSvm
        });
        
        const svmAggregateNames = this.parseAggregateNames(svmAggregatesText);
        
        if (svmAggregateNames.length === 0) {
          console.log(`⚠️  WARNING: No aggregates assigned to SVM '${testSvm}'`);
          console.log('   This is valid if SVM has no aggr-list configured\n');
          results.push({ test: 'list_svm_aggregates', passed: true, warning: true });
        } else {
          console.log(`✅ PASSED: Found ${svmAggregateNames.length} aggregates for SVM`);
          console.log(`   SVM Aggregates: ${svmAggregateNames.join(', ')}`);
          results.push({ test: 'list_svm_aggregates', passed: true });
          
          // Test 4: Verify SVM aggregates are subset of all aggregates
          console.log('\nTest 4: Verify SVM aggregates are subset of all aggregates');
          const allValid = svmAggregateNames.every(name => allAggregateNames.includes(name));
          
          if (allValid) {
            console.log('✅ PASSED: All SVM aggregates are valid cluster aggregates');
            results.push({ test: 'verify_subset', passed: true });
          } else {
            console.log('❌ FAILED: Some SVM aggregates are not in cluster aggregate list');
            allPassed = false;
            results.push({ test: 'verify_subset', passed: false });
          }
          
          // Test 5: Verify response format
          console.log('\nTest 5: Verify response format');
          if (svmAggregatesText.includes(`Aggregates assigned to SVM '${testSvm}'`)) {
            console.log('✅ PASSED: Response contains correct description for SVM filter');
            results.push({ test: 'verify_format', passed: true });
          } else {
            console.log('❌ FAILED: Response description incorrect for SVM filter');
            allPassed = false;
            results.push({ test: 'verify_format', passed: false });
          }
        }
      }
      
    } catch (error) {
      console.error(`\n❌ TEST ERROR: ${error.message}`);
      allPassed = false;
    }
    
    return { allPassed, results };
  }

  parseAggregateNames(text) {
    const names = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Match pattern: "- aggregate_name (uuid)"
      const match = line.match(/^-\s+([^\s(]+)\s*\(/);
      if (match) {
        names.push(match[1].trim());
      }
    }
    
    return names;
  }

  parseSvmNames(text) {
    const names = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Match pattern: "- svm_name (uuid) - State: xxx"
      const match = line.match(/^-\s+([^\s(]+)\s*\(/);
      if (match) {
        names.push(match[1].trim());
      }
    }
    
    return names;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(arg => !arg.startsWith('--')) || 'stdio';
  const serverAlreadyRunning = args.includes('--server-running');
  
  if (!['stdio', 'http'].includes(mode)) {
    console.error('Usage: node test-aggregate-svm-filter.js [stdio|http] [--server-running]');
    process.exit(1);
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 NetApp ONTAP Aggregate Listing Test - ${mode.toUpperCase()} mode`);
  console.log(`${'='.repeat(70)}`);
  
  if (serverAlreadyRunning) {
    console.log('🔧 Using pre-started HTTP server\n');
  }
  
  const tester = new AggregateListTester(mode, serverAlreadyRunning);
  
  try {
    await tester.initialize();
    const { allPassed, results } = await tester.runTests();
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Test Results Summary:');
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const warning = result.warning ? ' (warning)' : '';
      console.log(`${status} ${result.test}${warning}`);
    });
    
    console.log('='.repeat(70));
    if (allPassed) {
      console.log('🎉 All tests PASSED!');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests FAILED');
      process.exit(1);
    }
  } finally {
    await tester.stopServer();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`\n❌ Fatal error: ${error.message}`);
    process.exit(1);
  });
}
