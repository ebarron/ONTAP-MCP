/**
 * MCP API Client - Streamable HTTP Transport (MCP 2025-06-18)
 * 
 * This is a wrapper around McpStreamableClient that maintains the same
 * interface as the legacy client for backwards compatibility with the demo.
 * 
 * The demo now uses the modern Streamable HTTP protocol exclusively.
 * Legacy HTTP+SSE transport is deprecated.
 * 
 * Original legacy implementation backed up in: McpApiClient-legacy.js
 */

/**
 * Universal MCP API Client (now using Streamable HTTP)
 */
class McpApiClient {
    constructor(mcpUrl = 'http://localhost:3000') {
        this.mcpUrl = mcpUrl;
        this.client = new McpStreamableClient(mcpUrl);
        this.sessionId = null;
        this.initialized = false;
    }

    /**
     * Initialize MCP session using Streamable HTTP
     */
    async initialize() {
        if (this.initialized) return;

        console.log('🔌 Initializing MCP Streamable HTTP client (MCP 2025-06-18)...');
        
        try {
            const result = await this.client.initialize();
            this.sessionId = result.sessionId;
            this.initialized = true;
            console.log(`✅ MCP session initialized: ${this.sessionId}`);
        } catch (error) {
            console.error('❌ MCP initialization failed:', error);
            throw error;
        }
    }

    /**
     * Call an MCP tool
     * @param {string} toolName - Name of the tool to call
     * @param {object} params - Parameters for the tool
     * @returns {Promise<string>} - Tool response text
     */
    async callMcp(toolName, params = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            console.log(`📞 Calling MCP tool: ${toolName}`, params);
            const result = await this.client.callTool(toolName, params);
            
            // Extract text from MCP content format
            const text = this.client.parseContent(result);
            console.log(`✅ Tool response received (${text.length} chars)`);
            
            return text;
        } catch (error) {
            console.error(`❌ MCP call failed for ${toolName}:`, error);
            throw error;
        }
    }

    /**
     * Call an MCP tool and return raw result (no text extraction)
     * Use this when you need structured data (JSON) instead of formatted text
     * @param {string} toolName - Name of the tool to call
     * @param {object} params - Parameters for the tool
     * @returns {Promise<object>} - Raw tool response (MCP content array)
     */
    async callMcpRaw(toolName, params = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            console.log(`📞 Calling MCP tool (raw): ${toolName}`, params);
            const result = await this.client.callTool(toolName, params);
            console.log(`✅ Tool response received (raw result)`);
            return result;
        } catch (error) {
            console.error(`❌ MCP call failed for ${toolName}:`, error);
            throw error;
        }
    }

    /**
     * List all available tools
     * @returns {Promise<Array>} - Array of tool definitions
     */
    async listTools() {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const result = await this.client.listTools();
            return result.tools || [];
        } catch (error) {
            console.error('❌ Failed to list tools:', error);
            throw error;
        }
    }

    /**
     * Get current session ID
     * @returns {string|null}
     */
    getSessionId() {
        return this.sessionId;
    }

    /**
     * Close the MCP session
     */
    async close() {
        if (this.client) {
            await this.client.close();
        }
        this.initialized = false;
        this.sessionId = null;
    }

    /**
     * Check if initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.initialized;
    }
}

// Export for use in demo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = McpApiClient;
}
