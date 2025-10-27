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

            debugLogger.log('✅ MCP configuration loaded:', {
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
        debugLogger.log('📝 Using default MCP configuration');
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

    /**
     * Get Grafana viewer URL for creating dashboard links
     */
    getGrafanaViewerUrl() {
        const grafanaConfig = this.servers?.['grafana-remote'];
        debugLogger.log('🔍 [McpConfig] grafanaConfig:', grafanaConfig);
        const viewerUrl = grafanaConfig?.viewer_url || 'http://localhost:3000';
        debugLogger.log('🔍 [McpConfig] Returning viewer URL:', viewerUrl);
        return viewerUrl;
    }

    /**
     * Update server configuration
     * @param {string} serverName - Name of the server to update
     * @param {object} config - New configuration object
     */
    async updateServerConfig(serverName, config) {
        if (!this.servers[serverName]) {
            throw new Error(`Server '${serverName}' not found`);
        }

        // Update in-memory configuration
        this.servers[serverName] = {
            ...this.servers[serverName],
            ...config
        };

        // Note: In a real implementation, this would also update mcp.json on the server
        // For now, changes are only in-memory and will be lost on page reload
        debugLogger.log(`✅ Updated ${serverName} configuration:`, this.servers[serverName]);
    }
}

// Make globally available
window.McpConfig = McpConfig;
