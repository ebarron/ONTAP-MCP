/**
 * MCP Streamable HTTP Client for Browser (MCP 2025-06-18)
 * 
 * Client for MCP servers using Streamable HTTP transport.
 * This is the modern protocol that replaces legacy HTTP+SSE.
 * 
 * Key features:
 * - Single /mcp endpoint for all operations
 * - Session ID in Mcp-Session-Id header (not SSE event body)
 * - POST /mcp for all requests
 * - SSE streaming for responses
 * 
 * Protocol: https://spec.modelcontextprotocol.io/specification/2025-06-18/
 */

const MCP_PROTOCOL_VERSION = '2025-06-18';

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
class McpStreamableClient {
    constructor(baseUrl = 'http://localhost:3000', options = {}) {
        this.baseUrl = baseUrl;
        this.mcpEndpoint = `${baseUrl}/mcp`;
        this.sessionId = options.sessionId || null;
        this.requestId = 1;
        this.initialized = false;
    }

    /**
     * Send HTTP request and collect SSE response
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
                    name: 'mcp-demo-streamable',
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
     * Send JSON-RPC request with optional session (stateless servers don't use session IDs)
     */
    async sendJsonRpcRequest(method, params = {}) {
        if (!this.initialized) {
            throw new Error('Client not initialized. Call initialize() first.');
        }

        // Session ID is optional for stateless servers (like Grafana MCP)
        // if (!this.sessionId) {
        //     throw new Error('No session ID available');
        // }

        const request = {
            jsonrpc: '2.0',
            id: this.requestId++,
            method,
            params
        };

        // Only add session headers if we have a session ID (stateful mode)
        const headers = {
            'Mcp-Protocol-Version': MCP_PROTOCOL_VERSION
        };
        if (this.sessionId) {
            headers['Mcp-Session-Id'] = this.sessionId;
        }

        try {
            const result = await this.sendHttpRequest(this.mcpEndpoint, request, headers);

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
     * Handles hybrid format {summary, data} for dual consumption
     */
    parseContent(result) {
        // If result is a string, return it
        if (typeof result === 'string') {
            return result;
        }

        // If result has content array (MCP format), extract text
        if (result?.content?.[0]?.text) {
            let textValue = result.content[0].text;
            
            // If textValue is a string, try parsing it as JSON (hybrid format might be stringified)
            if (typeof textValue === 'string') {
                try {
                    const parsed = JSON.parse(textValue);
                    if (parsed && typeof parsed === 'object' && 'summary' in parsed) {
                        return parsed.summary;
                    }
                } catch (e) {
                    // Not JSON, continue with original string
                }
                return textValue;
            }
            
            // Handle hybrid format object: {summary: "...", data: [...]}
            if (typeof textValue === 'object' && textValue !== null && 'summary' in textValue) {
                return textValue.summary;
            }
            
            return textValue;
        }

        // If result is an object, stringify it
        if (typeof result === 'object') {
            return JSON.stringify(result, null, 2);
        }

        return String(result);
    }
}

// Export for use in demo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { McpStreamableClient, MCP_PROTOCOL_VERSION };
}
