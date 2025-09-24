import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test the cluster information tools (get_all_clusters_info and list_registered_clusters)
 * in both STDIO and REST modes to ensure they work consistently.
 */
class ClusterInfoTester {
  constructor(mode = 'stdio') {
    this.mode = mode;
    this.serverProcess = null;
    this.requestId = 1;
  }

  async callTool(toolName, params) {
    if (this.mode === 'stdio') {
      return await this.callToolStdio(toolName, params);
    } else {
      return await this.callToolRest(toolName, params);
    }
  }

  async callToolStdio(toolName, params) {
    return new Promise((resolve, reject) => {
      const buildPath = path.join(__dirname, '..', 'build', 'index.js');
      const child = spawn('node', [buildPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';
      let responseReceived = false;

      const request = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params
        }
      };

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // Look for complete JSON-RPC response
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.trim() && !responseReceived) {
            try {
              const response = JSON.parse(line);
              if (response.id === request.id) {
                responseReceived = true;
                child.kill();
                
                if (response.error) {
                  reject(new Error(`Tool error: ${JSON.stringify(response.error)}`));
                } else if (response.result && response.result.content) {
                  // Extract text content from MCP response
                  const textContent = response.result.content
                    .filter(item => item.type === 'text')
                    .map(item => item.text)
                    .join('');
                  resolve(textContent);
                } else {
                  reject(new Error('Unexpected response format'));
                }
                return;
              }
            } catch (e) {
              // Not JSON, continue reading
            }
          }
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (!responseReceived) {
          reject(new Error(`Process exited with code ${code}. Stderr: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      // Send the request
      child.stdin.write(JSON.stringify(request) + '\n');
      child.stdin.end();

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!responseReceived) {
          child.kill();
          reject(new Error('Tool call timeout'));
        }
      }, 10000);
    });
  }

  async callToolRest(toolName, params) {
    const response = await fetch(`http://localhost:3000/api/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract text content from MCP response structure
    return data.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('');
  }

  async startHttpServer() {
    return new Promise((resolve, reject) => {
      const buildPath = path.join(__dirname, '..', 'build', 'index.js');
      this.serverProcess = spawn('node', [buildPath, '--http=3000'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env,
          ONTAP_CLUSTERS: '[]' // Empty cluster list for testing
        }
      });

      let started = false;
      
      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('NetApp ONTAP MCP Server running on HTTP port 3000') && !started) {
          started = true;
          // Wait a bit more for full startup
          setTimeout(resolve, 1000);
        }
      });

      this.serverProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Server process exited with code ${code}`));
        }
      });

      this.serverProcess.on('error', (error) => {
        reject(new Error(`Server process error: ${error.message}`));
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!started) {
          reject(new Error('HTTP server failed to start within 5 seconds'));
        }
      }, 5000);
    });
  }

  async stopServer() {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise((resolve) => {
        this.serverProcess.on('exit', resolve);
        setTimeout(resolve, 2000); // Timeout after 2s
      });
    }

    console.log('🔌 Server stopped');
  }

  async runTests() {
    const results = [];
    
    try {
      if (this.mode === 'rest') {
        await this.startHttpServer();
      }

      // Test 1: get_all_clusters_info
      const clustersInfoResult = await this.testGetAllClustersInfo();
      results.push({
        test: 'get_all_clusters_info',
        mode: this.mode,
        ...clustersInfoResult
      });

      // Test 2: list_registered_clusters (for comparison)
      const listClustersResult = await this.testListRegisteredClusters();
      results.push({
        test: 'list_registered_clusters',
        mode: this.mode,
        ...listClustersResult
      });

    } finally {
      if (this.mode === 'rest') {
        await this.stopServer();
      }
    }

    return results;
  }

  async testGetAllClustersInfo() {
    const startTime = Date.now();
    
    try {
      const result = await this.callTool('get_all_clusters_info', {});
      const duration = Date.now() - startTime;
      
      console.log(`✅ get_all_clusters_info (${this.mode}): ${duration}ms`);
      console.log(`   Response length: ${result.length} characters`);
      
      return {
        success: true,
        duration,
        responseLength: result.length,
        response: result.substring(0, 200) + (result.length > 200 ? '...' : '')
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ get_all_clusters_info (${this.mode}) failed: ${error.message}`);
      
      return {
        success: false,
        duration,
        error: error.message
      };
    }
  }

  async testListRegisteredClusters() {
    const startTime = Date.now();
    
    try {
      const result = await this.callTool('list_registered_clusters', {});
      const duration = Date.now() - startTime;
      
      console.log(`✅ list_registered_clusters (${this.mode}): ${duration}ms`);
      console.log(`   Response length: ${result.length} characters`);
      
      return {
        success: true,
        duration,
        responseLength: result.length,
        response: result.substring(0, 200) + (result.length > 200 ? '...' : '')
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ list_registered_clusters (${this.mode}) failed: ${error.message}`);
      
      return {
        success: false,
        duration,
        error: error.message
      };
    }
  }
}

// Main execution
async function main() {
  const mode = process.argv[2] || 'stdio';
  
  if (!['stdio', 'rest'].includes(mode)) {
    console.error('Usage: node test-cluster-info.js [stdio|rest]');
    process.exit(1);
  }
  
  console.log(`🧪 Testing cluster info tools in ${mode.toUpperCase()} mode...\n`);
  
  const tester = new ClusterInfoTester(mode);
  const results = await tester.runTests();
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.test} (${result.mode}): ${result.duration}ms`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  const allPassed = results.every(r => r.success);
  console.log(`\n${allPassed ? '🎉 All tests passed!' : '⚠️  Some tests failed'}`);
  
  process.exit(allPassed ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}