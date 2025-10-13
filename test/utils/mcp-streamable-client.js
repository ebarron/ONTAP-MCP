#!/usr/bin/env node

/**
 * MCP Streamable HTTP Test Client (MCP 2025-06-18)
 * 
 * Client for testing MCP servers via Streamable HTTP transport.
 * Replaces the legacy HTTP+SSE transport client.
 * 
 * Key differences from legacy:
 * - Single /mcp endpoint for all operations
 * - Session ID in Mcp-Session-Id header (not SSE event body)
 * - POST /mcp for initialization
 * - SSE streaming for responses
 */

export const MCP_PROTOCOL_VERSION = '2025-06-18';

/**
 * Parse SSE response to extract JSON-RPC messages
 */
function parseSSEResponse(text) {
  const lines = text.split('\n');
  const messages = [];
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.substring(6);
      try {
        messages.push(JSON.parse(data));
      } catch (e) {
        // Ignore parse errors for non-JSON SSE data
      }
    }
  }
  
  return messages;
}

/**
 * MCP Streamable HTTP Client (2025-06-18 spec)
 * 
 * Usage:
 *   const client = new McpStreamableClient('http://localhost:3000');
 *   await client.initialize();
 *   const result = await client.callTool('list_registered_clusters', {});
 */
export class McpStreamableClient {
  constructor(baseUrl = 'http://localhost:3000', options = {}) {
    this.baseUrl = baseUrl;
    this.mcpEndpoint = `${baseUrl}/mcp`;
    this.sessionId = options.sessionId || null;
    this.requestId = 1;
    this.initialized = false;
  }

  /**
   * Send HTTP request and collect SSE response (internal method)
   */
  async sendHttpRequest(url, body, headers = {}) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...headers
      },
      body: JSON.stringify(body)
    });

    // Extract session ID from header (for initialization)
    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId && !this.sessionId) {
      this.sessionId = sessionId;
    }

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('text/event-stream')) {
      // SSE stream - collect all data
      let sseData = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseData += decoder.decode(value, { stream: true });
        }

        const messages = parseSSEResponse(sseData);
        return messages[0]; // Return first message (should be the response)
      } catch (error) {
        throw new Error(`SSE read error: ${error.message}`);
      }
    } else if (contentType?.includes('application/json')) {
      // Direct JSON response
      return await response.json();
    } else {
      throw new Error(`Unexpected content type: ${contentType}`);
    }
  }

  /**
   * Initialize MCP session
   */
  async initialize(initOptions = {}) {
    if (this.initialized) {
      throw new Error('Client already initialized');
    }

    const initRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: 'mcp-streamable-test-client',
          version: '1.0.0'
        },
        ...initOptions
      }
    };

    try {
      const result = await this.sendHttpRequest(this.mcpEndpoint, initRequest);

      if (result.error) {
        throw new Error(`Initialize failed: ${result.error.message}`);
      }

      this.initialized = true;
      return {
        sessionId: this.sessionId,
        serverInfo: result.result?.serverInfo,
        protocolVersion: result.result?.protocolVersion
      };
    } catch (error) {
      throw new Error(`MCP initialization failed: ${error.message}`);
    }
  }

  /**
   * Send JSON-RPC request with session
   */
  async sendJsonRpcRequest(method, params = {}) {
    if (!this.initialized) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    if (!this.sessionId) {
      throw new Error('No session ID available');
    }

    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    };

    try {
      const result = await this.sendHttpRequest(this.mcpEndpoint, request, {
        'Mcp-Session-Id': this.sessionId,
        'Mcp-Protocol-Version': MCP_PROTOCOL_VERSION
      });

      if (result.error) {
        throw new Error(`${method} failed: ${result.error.message}`);
      }

      return result.result;
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  /**
   * List available tools
   */
  async listTools() {
    return await this.sendJsonRpcRequest('tools/list', {});
  }

  /**
   * Legacy sendRequest method for backwards compatibility
   * Returns { result, error } instead of throwing
   */
  async sendRequest(method, params = {}) {
    try {
      const result = await this.sendJsonRpcRequest(method, params);
      return { result, error: null };
    } catch (error) {
      return { 
        result: null, 
        error: { 
          message: error.message,
          code: -32000 
        } 
      };
    }
  }

  /**
   * Call a tool
   * Returns the full MCP result (including content array)
   * Use parseContent() to extract text if needed
   */
  async callTool(toolName, args = {}) {
    const result = await this.sendJsonRpcRequest('tools/call', {
      name: toolName,
      arguments: args
    });

    return result;
  }

  /**
   * Close session (optional - for cleanup)
   */
  async close() {
    if (!this.sessionId) return;

    try {
      await fetch(this.mcpEndpoint, {
        method: 'DELETE',
        headers: {
          'Mcp-Session-Id': this.sessionId
        }
      });
    } catch (error) {
      // Ignore errors during close
    }

    this.sessionId = null;
    this.initialized = false;
  }

  /**
   * Get current session ID
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Parse content from tool call result (for backwards compatibility)
   * Returns the text content from a tool call result
   */
  parseContent(result) {
    // If result is a string, return it
    if (typeof result === 'string') {
      return result;
    }

    // If result has content array (MCP format), extract text
    if (result?.content?.[0]?.text) {
      return result.content[0].text;
    }

    // If result is an object, stringify it
    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }

    return String(result);
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
  const client = new McpStreamableClient(baseUrl);
  await client.initialize();
  
  console.log(`[SESSION] Created session: ${client.sessionId}`);
  
  const result = await loadClustersIntoSession(client);
  console.log(`[SESSION] Loaded ${result.successCount}/${result.total} clusters into session`);
  
  if (result.failCount > 0) {
    console.warn(`[SESSION] Warning: ${result.failCount} clusters failed to load`);
  }
  
  return {
    sessionId: client.sessionId,
    client,
    clusters: result
  };
}

/**
 * Example usage
 */
async function example() {
  const client = new McpStreamableClient('http://localhost:3000');
  
  try {
    // Initialize
    const initResult = await client.initialize();
    console.log('Initialized:', initResult);

    // List tools
    const tools = await client.listTools();
    console.log('Tools:', tools.tools?.length);

    // Call a tool
    const clusters = await client.callTool('list_registered_clusters');
    console.log('Clusters:', clusters);

    // Close
    await client.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Export helper functions for ES modules
export {
  loadClustersFromFile,
  loadClustersIntoSession,
  createSessionWithClusters
};

// Run example if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  example();
}
