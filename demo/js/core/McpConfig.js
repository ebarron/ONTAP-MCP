/**
 * MCP Configuration Loader
 * 
 * Loads MCP server configurations from mcp.json file.
 * Supports multiple MCP servers with dynamic URL configuration.
 */
class McpConfig {
    constructor() {
        this.config = null;
        this.servers = {};
        this.defaultServer = null;
    }

    /**
     * Load MCP configuration from mcp.json
     */
    async load() {
        try {
            const response = await fetch('mcp.json');
            if (!response.ok) {
                console.warn('⚠️ mcp.json not found, using defaults');
                this.useDefaults();
                return;
            }

            this.config = await response.json();
            this.servers = this.config.servers || {};
            
            // Default to first enabled server if no default specified
            this.defaultServer = this.config.default || 
                                Object.keys(this.servers).find(name => this.servers[name].enabled) ||
                                Object.keys(this.servers)[0];

            console.log('✅ MCP configuration loaded:', {
                servers: Object.keys(this.servers),
                enabled: Object.keys(this.servers).filter(name => this.servers[name].enabled),
                defaultServer: this.defaultServer
            });
        } catch (error) {
            console.error('❌ Error loading MCP config:', error);
            this.useDefaults();
        }
    }

    /**
     * Use default configuration if mcp.json is not available
     */
    useDefaults() {
        this.servers = {
            'netapp-ontap': {
                type: 'http',
                url: 'http://localhost:3000',
                description: 'NetApp ONTAP MCP Server',
                enabled: true
            }
        };
        this.defaultServer = 'netapp-ontap';
        console.log('📝 Using default MCP configuration');
    }

    /**
     * Get URL for a specific server
     */
    getServerUrl(serverName = null) {
        const name = serverName || this.defaultServer;
        const server = this.servers[name];
        
        if (!server) {
            console.warn(`⚠️ Server '${name}' not found, using default`);
            return this.servers[this.defaultServer]?.url || 'http://localhost:3000';
        }

        if (!server.enabled) {
            console.warn(`⚠️ Server '${name}' is disabled`);
        }

        return server.url;
    }

    /**
     * Get all enabled servers
     */
    getEnabledServers() {
        return Object.entries(this.servers)
            .filter(([_, config]) => config.enabled)
            .map(([name, config]) => ({
                name,
                ...config
            }));
    }

    /**
     * Get server configuration
     */
    getServer(serverName = null) {
        const name = serverName || this.defaultServer;
        return this.servers[name];
    }

    /**
     * Check if a server is available
     */
    isServerEnabled(serverName) {
        const server = this.servers[serverName];
        return server && server.enabled;
    }
}

// Make globally available
window.McpConfig = McpConfig;
