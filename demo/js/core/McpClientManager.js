/**
 * MCP Client Manager
 * 
 * Manages multiple MCP server connections with automatic tool discovery and routing.
 * Completely MCP-agnostic - no hard-coded knowledge about specific servers.
 * 
 * Features:
 * - Connects to all enabled servers from config
 * - Automatic tool discovery via standard MCP listTools()
 * - Dynamic routing table based on discovered capabilities
 * - Graceful failover if servers become unavailable
 * - Zero hard-coded MCP-specific knowledge
 */
class McpClientManager {
    constructor(mcpConfig) {
        this.config = mcpConfig;
        this.clients = new Map();        // server-name → McpApiClient instance
        this.toolRoutes = new Map();     // tool-name → [server-names] (discovered dynamically)
        this.toolDefinitions = new Map(); // tool-name → tool definition (for ChatGPT)
        this.initialized = false;
    }

    /**
     * Initialize connections to all enabled servers
     * Discovers tools from each server automatically
     */
    async initialize() {
        console.log('🔌 McpClientManager: Initializing multi-server connections...');
        
        const enabledServers = this.config.getEnabledServers();
        
        if (enabledServers.length === 0) {
            throw new Error('No enabled MCP servers found in configuration');
        }

        console.log(`📡 Found ${enabledServers.length} enabled server(s):`, enabledServers.map(s => s.name));

        // Connect to all enabled servers
        const connectionPromises = enabledServers.map(async (server) => {
            try {
                console.log(`  🔗 Connecting to ${server.name} at ${server.url}...`);
                const client = new McpApiClient(server.url);
                await client.initialize();
                this.clients.set(server.name, client);
                console.log(`  ✅ ${server.name} connected successfully`);
                return { server: server.name, success: true };
            } catch (error) {
                console.error(`  ❌ ${server.name} connection failed:`, error.message);
                return { server: server.name, success: false, error: error.message };
            }
        });

        const results = await Promise.all(connectionPromises);
        
        // Check if at least one server connected
        const successfulConnections = results.filter(r => r.success);
        if (successfulConnections.length === 0) {
            throw new Error('Failed to connect to any MCP servers');
        }

        console.log(`✅ Connected to ${successfulConnections.length}/${enabledServers.length} server(s)`);

        // Discover tools from all connected servers
        await this.discoverAllTools();
        
        this.initialized = true;
        console.log('✅ McpClientManager initialized successfully');
    }

    /**
     * Discover tools from all connected servers
     * Builds routing table automatically - NO hard-coded knowledge
     */
    async discoverAllTools() {
        console.log('🔍 Discovering tools from all connected servers...');
        
        this.toolRoutes.clear();
        this.toolDefinitions.clear();
        
        for (const [serverName, client] of this.clients) {
            try {
                console.log(`  📋 Discovering tools from ${serverName}...`);
                const tools = await client.listTools();
                
                if (!tools || !Array.isArray(tools)) {
                    console.warn(`  ⚠️  ${serverName} returned invalid tool list, skipping`);
                    continue;
                }

                console.log(`  ✅ ${serverName} provides ${tools.length} tool(s)`);
                
                // Build routing table: tool-name → [server-names]
                for (const tool of tools) {
                    const toolName = tool.name;
                    
                    // Add to routing table
                    if (!this.toolRoutes.has(toolName)) {
                        this.toolRoutes.set(toolName, []);
                    }
                    this.toolRoutes.get(toolName).push(serverName);
                    
                    // Store tool definition (first server wins if duplicate)
                    if (!this.toolDefinitions.has(toolName)) {
                        this.toolDefinitions.set(toolName, {
                            ...tool,
                            servers: [serverName]  // Track which server(s) provide this
                        });
                    } else {
                        // Tool exists on multiple servers - add to server list
                        this.toolDefinitions.get(toolName).servers.push(serverName);
                    }
                }
            } catch (error) {
                console.error(`  ❌ Failed to discover tools from ${serverName}:`, error.message);
            }
        }

        const totalTools = this.toolRoutes.size;
        const duplicateTools = Array.from(this.toolRoutes.values()).filter(servers => servers.length > 1).length;
        
        console.log(`✅ Discovered ${totalTools} unique tool(s) across all servers`);
        if (duplicateTools > 0) {
            console.log(`ℹ️  ${duplicateTools} tool(s) available from multiple servers (will use first available)`);
        }
    }

    /**
     * Route a tool call to the appropriate server
     * Uses automatic discovery - NO hard-coded routing logic
     * 
     * @param {string} toolName - Name of the tool to call
     * @param {object} params - Parameters for the tool
     * @param {string} preferredServer - Optional: specific server to use
     * @returns {Promise} Tool execution result
     */
    async callTool(toolName, params, preferredServer = null, raw = false) {
        if (!this.initialized) {
            throw new Error('McpClientManager not initialized');
        }

        // If specific server requested and available, use it
        if (preferredServer && this.clients.has(preferredServer)) {
            console.log(`🎯 Routing ${toolName} to preferred server: ${preferredServer}`);
            const client = this.clients.get(preferredServer);
            if (raw) {
                const result = await client.callMcpRaw(toolName, params);
                return this._extractDataFromHybridFormat(result);
            }
            return await client.callMcp(toolName, params);
        }

        // Otherwise, use automatic routing based on discovery
        const servers = this.toolRoutes.get(toolName);
        
        if (!servers || servers.length === 0) {
            throw new Error(`Tool '${toolName}' not available on any connected server`);
        }

        // Try servers in order (with automatic failover)
        let lastError = null;
        for (const serverName of servers) {
            try {
                const client = this.clients.get(serverName);
                if (!client) {
                    console.warn(`⚠️  Server ${serverName} not connected, trying next...`);
                    continue;
                }
                
                console.log(`🔧 Routing ${toolName} → ${serverName}`);
                if (raw) {
                    const result = await client.callMcpRaw(toolName, params);
                    return this._extractDataFromHybridFormat(result);
                }
                const result = await client.callMcp(toolName, params);
                return result;
                
            } catch (error) {
                console.warn(`⚠️  ${serverName} failed for ${toolName}: ${error.message}`);
                lastError = error;
                
                // If multiple servers provide this tool, try the next one
                if (servers.length > 1) {
                    console.log(`   Trying next server for ${toolName}...`);
                    continue;
                }
            }
        }

        // All servers failed
        throw new Error(`All servers failed for tool '${toolName}': ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Extract structured data from hybrid format responses
     * If the response has { summary, data }, return JSON.stringify(data)
     * Otherwise return the text content as-is
     */
    _extractDataFromHybridFormat(result) {
        try {
            // Extract text from MCP content format
            if (result?.content?.[0]?.text) {
                let textValue = result.content[0].text;
                
                // If it's a string, try parsing as JSON
                if (typeof textValue === 'string') {
                    try {
                        const parsed = JSON.parse(textValue);
                        if (parsed && typeof parsed === 'object' && 'data' in parsed) {
                            console.log('🔍 Extracting structured data from hybrid format');
                            return JSON.stringify(parsed.data, null, 2);
                        }
                    } catch (e) {
                        // Not JSON or no data field, return as-is
                    }
                    return textValue;
                }
                
                // If it's already an object with data field
                if (typeof textValue === 'object' && textValue !== null && 'data' in textValue) {
                    console.log('🔍 Extracting structured data from hybrid format object');
                    return JSON.stringify(textValue.data, null, 2);
                }
                
                return typeof textValue === 'string' ? textValue : JSON.stringify(textValue, null, 2);
            }
            
            // Fallback
            return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        } catch (error) {
            console.error('Error extracting data from hybrid format:', error);
            return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        }
    }

    /**
     * Get all available tools from all servers
     * Returns tools with server tagging for visibility
     */
    async listAllTools() {
        const allTools = [];
        
        for (const [toolName, definition] of this.toolDefinitions) {
            allTools.push({
                ...definition,
                // Include which server(s) provide this tool
                availableFrom: definition.servers
            });
        }
        
        return allTools;
    }

    /**
     * Get client for specific server (for backward compatibility)
     */
    getClient(serverName) {
        return this.clients.get(serverName);
    }

    /**
     * Get list of connected servers
     */
    getConnectedServers() {
        return Array.from(this.clients.keys());
    }

    /**
     * Check if a specific tool is available
     */
    isToolAvailable(toolName) {
        return this.toolRoutes.has(toolName);
    }

    /**
     * Get which server(s) provide a specific tool
     */
    getToolServers(toolName) {
        return this.toolRoutes.get(toolName) || [];
    }

    /**
     * Get statistics about connected servers and tools
     */
    getStats() {
        return {
            connectedServers: this.clients.size,
            totalTools: this.toolRoutes.size,
            toolsByServer: Array.from(this.clients.keys()).map(serverName => {
                const tools = Array.from(this.toolRoutes.entries())
                    .filter(([_, servers]) => servers.includes(serverName))
                    .map(([name, _]) => name);
                return {
                    server: serverName,
                    toolCount: tools.length
                };
            })
        };
    }

    /**
     * Close all server connections
     */
    async closeAll() {
        console.log('🔌 Closing all MCP connections...');
        for (const [serverName, client] of this.clients) {
            try {
                if (client.close) {
                    await client.close();
                }
                console.log(`  ✅ ${serverName} connection closed`);
            } catch (error) {
                console.warn(`  ⚠️  Error closing ${serverName}:`, error.message);
            }
        }
        this.clients.clear();
        this.toolRoutes.clear();
        this.toolDefinitions.clear();
        this.initialized = false;
    }
}

// Make globally available
window.McpClientManager = McpClientManager;
