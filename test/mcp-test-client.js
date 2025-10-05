#!/usr/bin/env node

/**
 * MCP JSON-RPC 2.0 Test Client
 * 
 * Reusable client for testing MCP servers via HTTP/SSE transport.
 * Used by all test files when running in HTTP mode.
 * 
 * This client properly implements:
 * - SSE stream establishment (GET /mcp)
 * - Session ID extraction from SSE events
 * - JSON-RPC 2.0 message routing (POST /messages)
 * - Error handling and response parsing
 * 
 * Compatible with both ONTAP MCP server and Harvest MCP server.
 */

/**
 * MCP JSON-RPC 2.0 Client over HTTP/SSE
 * 
 * Usage:
 *   const client = new McpTestClient('http://localhost:3000');
 *   await client.initialize();
 *   const result = await client.callTool('list_registered_clusters', {});
 */
export class McpTestClient {
  constructor(baseUrl = 'http://localhost:3000', options = {}) {
    this.baseUrl = baseUrl;
    this.sessionId = options.sessionId || null; // Allow pre-set session ID
    this.requestId = 1;
    this.initialized = false; // Always require initialization to set up SSE stream
    this.sseReader = null; // Keep SSE stream alive
    this.pendingResponses = new Map(); // Track pending requests
    this.readingStream = false;
    this.reusingSession = !!options.sessionId; // Track if we're reusing an existing session
  }

  /**
   * Start reading SSE stream for responses (runs in background)
   */
  async startReadingStream() {
    if (this.readingStream || !this.sseReader) return;
    
    this.readingStream = true;
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (this.readingStream) {
        const { done, value } = await this.sseReader.read();
        if (done) {
          this.readingStream = false;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // Check if this is a JSON-RPC response
              if (data.jsonrpc === '2.0' && data.id !== undefined) {
                // Resolve the pending request
                const resolve = this.pendingResponses.get(data.id);
                if (resolve) {
                  resolve(data);
                  this.pendingResponses.delete(data.id);
                }
              }
            } catch (error) {
              // Ignore non-JSON data events
            }
          }
        }
      }
    } catch (error) {
      // Stream closed or error - this is normal on shutdown
      this.readingStream = false;
    }
  }

  /**
   * Initialize MCP session via SSE stream
   * 
   * Process:
   * 1. GET /mcp to establish SSE stream
   * 2. Read 'endpoint' event from SSE stream
   * 3. Extract sessionId from endpoint URL
   * 4. Send 'initialize' JSON-RPC request
   * 5. Store session ID for subsequent requests
   * 
   * When reusing a session (sessionId provided in constructor):
   * - Establishes SSE stream for receiving responses
   * - Skips the 'initialize' JSON-RPC call (session already initialized)
   * - Trusts that the session ID is valid
   */
  async initialize() {
    try {
      // If reusing a session, establish SSE stream but skip full initialization
      if (this.reusingSession && this.sessionId) {
        // Establish SSE stream for this session
        const response = await fetch(`${this.baseUrl}/mcp`, {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to establish SSE stream: ${response.status} ${response.statusText}`);
        }

        // Verify SSE content type
        const contentType = response.headers.get('Content-Type');
        if (!contentType || !contentType.includes('text/event-stream')) {
          throw new Error(`Expected text/event-stream, got ${contentType}`);
        }

        // Store reader and start reading stream
        this.sseReader = response.body.getReader();
        this.startReadingStream();
        
        this.initialized = true;
        
        // Note: We trust the provided sessionId and don't validate
        // The session was created by create-shared-session.js and is still active
        
        return {
          sessionId: this.sessionId,
          reusingSession: true
        };
      }
      
      // Normal initialization for new sessions
      // Step 1: Establish SSE stream
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to establish SSE stream: ${response.status} ${response.statusText}`);
      }

      // Verify SSE content type
      const contentType = response.headers.get('Content-Type');
      if (!contentType || !contentType.includes('text/event-stream')) {
        throw new Error(`Expected text/event-stream, got ${contentType}`);
      }

      // Step 2: Read SSE stream to extract session ID
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let foundEndpoint = false;

      // Read initial events (should get 'endpoint' event quickly)
      const timeout = setTimeout(() => {
        reader.cancel();
        throw new Error('Timeout waiting for endpoint event from SSE stream');
      }, 5000);

      try {
        while (!foundEndpoint) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            // Look for endpoint event
            if (line.startsWith('event: endpoint')) {
              foundEndpoint = true;
              continue;
            }

            // Extract session ID from endpoint data
            if (foundEndpoint && line.startsWith('data: ')) {
              const endpoint = line.substring(6).trim();
              // Endpoint format: "/messages?sessionId=ABC123"
              const match = endpoint.match(/sessionId=([^&\s]+)/);
              if (match) {
                this.sessionId = match[1];
                clearTimeout(timeout);
                // Keep SSE stream alive - store reader for later cleanup
                this.sseReader = reader;
                
                // Start reading stream for responses in background
                this.startReadingStream();
                break;
              }
            }
          }

          if (this.sessionId) break;
        }
      } catch (error) {
        clearTimeout(timeout);
        if (reader) reader.cancel();
        throw error;
      }

      if (!this.sessionId) {
        throw new Error('Failed to extract session ID from SSE stream');
      }

      // Step 3: Send initialize request
      const initResult = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'mcp-test-client',
          version: '1.0.0'
        }
      });

      if (initResult.error) {
        throw new Error(`Initialize failed: ${initResult.error.message}`);
      }

      this.initialized = true;
      return {
        sessionId: this.sessionId,
        serverInfo: initResult.result.serverInfo,
        protocolVersion: initResult.result.protocolVersion
      };

    } catch (error) {
      throw new Error(`MCP initialization failed: ${error.message}`);
    }
  }

  /**
   * Send JSON-RPC 2.0 request to the server
   * 
   * @param {string} method - JSON-RPC method (e.g., 'tools/list', 'tools/call')
   * @param {object} params - Method parameters
   * @returns {Promise<{result?: any, error?: any}>}
   */
  async sendRequest(method, params = {}) {
    if (!this.sessionId) {
      throw new Error('Must call initialize() first to establish session');
    }

    const requestId = this.requestId++;
    
    try {
      // Create a promise that resolves when we get the response from SSE
      const responsePromise = new Promise((resolve, reject) => {
        this.pendingResponses.set(requestId, resolve);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.pendingResponses.has(requestId)) {
            this.pendingResponses.delete(requestId);
            reject(new Error('Request timeout'));
          }
        }, 10000);
      });

      // Send the POST request (which returns 202 Accepted)
      const response = await fetch(`${this.baseUrl}/messages?sessionId=${this.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: requestId
        })
      });

      if (!response.ok && response.status !== 202) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Wait for response from SSE stream
      const data = await responsePromise;

      // Validate JSON-RPC 2.0 response
      if (data.jsonrpc !== '2.0') {
        throw new Error(`Invalid JSON-RPC version: ${data.jsonrpc}`);
      }

      if (data.error) {
        return { error: data.error };
      }

      return { result: data.result };

    } catch (error) {
      this.pendingResponses.delete(requestId);
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  /**
   * List all available tools
   * 
   * @returns {Promise<Array>} Array of tool definitions
   */
  async listTools() {
    if (!this.initialized) {
      await this.initialize();
    }

    const { result, error } = await this.sendRequest('tools/list', {});

    if (error) {
      throw new Error(`Failed to list tools: ${error.message}`);
    }

    return result.tools || [];
  }

  /**
   * Call an MCP tool
   * 
   * @param {string} toolName - Name of the tool to call
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool result
   */
  async callTool(toolName, args = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const { result, error } = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    });

    if (error) {
      throw new Error(`Tool '${toolName}' failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Parse MCP content array to extract text
   * 
   * @param {object} result - Tool result with content array
   * @returns {string} Extracted text content
   */
  parseContent(result) {
    if (!result || !result.content || !Array.isArray(result.content)) {
      return '';
    }

    return result.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('');
  }

  /**
   * Close the client connection
   */
  async close() {
    // Don't close if we're reusing a shared session
    if (this.reusingSession) {
      return;
    }
    
    this.readingStream = false;
    
    if (this.sseReader) {
      try {
        await this.sseReader.cancel();
      } catch (error) {
        // Ignore cancellation errors
      }
      this.sseReader = null;
    }
    
    this.sessionId = null;
    this.initialized = false;
    this.pendingResponses.clear();
  }
}

/**
 * Load clusters from clusters.json file
 */
async function loadClustersFromFile(filePath = 'test/clusters.json') {
  const fs = await import('fs');
  const path = await import('path');
  
  const clustersPath = path.resolve(process.cwd(), filePath);
  const clustersData = JSON.parse(fs.readFileSync(clustersPath, 'utf8'));
  
  // Handle both array and object formats
  if (Array.isArray(clustersData)) {
    return clustersData;
  }
  
  // Convert object format to array
  return Object.keys(clustersData).map(name => ({
    name,
    ...clustersData[name]
  }));
}

/**
 * Load clusters into an MCP session via add_cluster tool
 * Returns the number of clusters successfully loaded
 */
async function loadClustersIntoSession(mcpClient, clusters = null) {
  // If no clusters provided, load from clusters.json
  if (!clusters) {
    clusters = await loadClustersFromFile();
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const cluster of clusters) {
    try {
      const result = await mcpClient.callTool('add_cluster', {
        name: cluster.name,
        cluster_ip: cluster.cluster_ip,
        username: cluster.username,
        password: cluster.password,
        description: cluster.description || `Loaded from clusters.json`
      });
      
      // Check if successful
      const text = mcpClient.parseContent(result);
      if (text.includes('added successfully')) {
        successCount++;
      } else {
        console.error(`Failed to add cluster ${cluster.name}: ${text}`);
        failCount++;
      }
    } catch (error) {
      console.error(`Failed to add cluster ${cluster.name}:`, error.message);
      failCount++;
    }
  }
  
  return { successCount, failCount, total: clusters.length };
}

/**
 * Create a test session with clusters pre-loaded
 * This is used by run-all-tests.sh to create a shared session
 */
async function createSessionWithClusters(baseUrl = 'http://localhost:3000') {
  const client = new McpTestClient(baseUrl);
  await client.initialize();
  
  console.log(`[SESSION] Created session: ${client.sessionId}`);
  
  const result = await loadClustersIntoSession(client);
  console.log(`[SESSION] Loaded ${result.successCount}/${result.total} clusters into session`);
  
  if (result.failCount > 0) {
    console.warn(`[SESSION] Warning: ${result.failCount} clusters failed to load`);
  }
  
  return {
    sessionId: client.sessionId,
    client: client,
    clusters: result
  };
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    McpTestClient,
    loadClustersFromFile,
    loadClustersIntoSession,
    createSessionWithClusters
  };
}

// Export helper functions for ES modules (McpTestClient already exported as class)
export {
  loadClustersFromFile,
  loadClustersIntoSession,
  createSessionWithClusters
};
