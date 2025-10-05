/**
 * Universal MCP API Client
 * 
 * Supports multiple MCP HTTP transport patterns:
 * - Pattern 1 (SSE Streaming): GET /mcp → SSE stream → POST /messages
 * - Pattern 2 (POST-based): Direct POST /mcp with SSE-formatted responses
 * 
 * Automatically detects and adapts to server transport pattern.
 */
class McpApiClient {
    constructor(mcpUrl = 'http://localhost:3000') {
        this.mcpUrl = mcpUrl;
        this.sessionId = null;
        this.requestId = 1;
        this.initialized = false;
        this.eventSource = null;
        this.pendingRequests = new Map(); // Track pending JSON-RPC requests
        this.transportMode = null; // 'streaming' or 'post-based'
    }

    /**
     * Initialize MCP session - auto-detects transport pattern
     */
    async initialize() {
        if (this.initialized) return;

        console.log('🔌 Detecting MCP transport pattern...');
        
        // Try Pattern 1 (SSE Streaming) first
        try {
            await this.initializeStreamingMode();
            this.transportMode = 'streaming';
            console.log('✅ Using SSE streaming transport');
            return;
        } catch (error) {
            console.log('⚠️  SSE streaming failed, trying POST-based transport...');
        }

        // Fallback to Pattern 2 (POST-based)
        try {
            await this.initializePostMode();
            this.transportMode = 'post-based';
            console.log('✅ Using POST-based transport');
        } catch (error) {
            console.error('❌ All transport patterns failed');
            throw new Error('Could not establish MCP connection with any transport pattern');
        }
    }

    /**
     * Pattern 1: SSE Streaming Mode (ONTAP MCP style)
     * GET /mcp → SSE stream → POST /messages
     */
    async initializeStreamingMode() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('SSE connection timeout'));
            }, 10000);

            try {
                this.eventSource = new EventSource(`${this.mcpUrl}/mcp`);
                
                this.eventSource.addEventListener('endpoint', (event) => {
                    clearTimeout(timeout);
                    try {
                        const endpoint = event.data.trim();
                        console.log(`📡 Received endpoint: ${endpoint}`);
                        
                        const match = endpoint.match(/sessionId=([^&\s]+)/);
                        if (!match) {
                            reject(new Error('No sessionId in endpoint event'));
                            return;
                        }
                        
                        this.sessionId = match[1];
                        console.log(`✅ SSE session: ${this.sessionId}`);
                        
                        // Send initialize request
                        this.sendStreamingRequest('initialize', {
                            protocolVersion: '2024-11-05',
                            capabilities: {},
                            clientInfo: { name: 'mcp-demo', version: '1.0.0' }
                        }).then(() => {
                            this.initialized = true;
                            resolve();
                        }).catch(reject);
                        
                    } catch (error) {
                        reject(error);
                    }
                });

                this.eventSource.addEventListener('error', (event) => {
                    clearTimeout(timeout);
                    reject(new Error('SSE connection error'));
                });

                // Set up message handler for JSON-RPC responses
                this.eventSource.addEventListener('message', (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('📨 SSE message:', data);
                        
                        if (data.jsonrpc === '2.0' && data.id !== undefined) {
                            const pending = this.pendingRequests.get(data.id);
                            if (pending) {
                                if (data.error) {
                                    pending.reject(new Error(data.error.message || 'MCP call failed'));
                                } else {
                                    pending.resolve(data.result);
                                }
                                this.pendingRequests.delete(data.id);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to parse SSE message:', error);
                    }
                });
                
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    /**
     * Pattern 2: POST-based Mode (Harvest MCP style)
     * POST /mcp directly with SSE-formatted responses
     */
    async initializePostMode() {
        const requestId = this.requestId++;
        const request = {
            jsonrpc: '2.0',
            id: requestId,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'mcp-demo', version: '1.0.0' }
            }
        };

        const response = await fetch(`${this.mcpUrl}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Debug: Log all response headers
        console.log('📋 Response headers:');
        for (const [key, value] of response.headers.entries()) {
            console.log(`  ${key}: ${value}`);
        }

        // Extract session ID from response headers (if present)
        // Try both header name variations due to case sensitivity
        const sessionId = response.headers.get('Mcp-Session-Id') || 
                         response.headers.get('mcp-session-id');
        if (sessionId) {
            this.sessionId = sessionId;
            console.log('🔐 POST session ID:', sessionId);
        } else {
            this.sessionId = 'post-based'; // Stateless mode
            console.log('ℹ️  No session ID in response, using stateless mode');
        }

        const text = await response.text();
        
        // Parse SSE-formatted response
        const lines = text.split('\n');
        let jsonData = null;
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                jsonData = JSON.parse(line.substring(6));
                break;
            }
        }

        if (!jsonData || !jsonData.result) {
            throw new Error('Invalid initialize response');
        }

        console.log('✅ POST-based init:', jsonData.result.serverInfo);

        
        // Send 'initialized' notification to complete the handshake
        // This is a notification (no id field) per JSON-RPC 2.0 spec
        const notification = {
            jsonrpc: '2.0',
            method: 'notifications/initialized',
            params: {}
        };

        console.log(`📨 POST notification: notifications/initialized`);

        const headers = { 'Content-Type': 'application/json' };
        if (this.sessionId && this.sessionId !== 'post-based') {
            headers['Mcp-Session-Id'] = this.sessionId;
        }

        const notifyResponse = await fetch(`${this.mcpUrl}/mcp`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(notification)
        });

        if (!notifyResponse.ok) {
            console.warn(`⚠️  Initialized notification returned ${notifyResponse.status}`);
        } else {
            // Wait for and consume the response to ensure server processed it
            await notifyResponse.text();
            console.log('✅ Initialized notification acknowledged');
        }

        // Now mark as fully initialized
        this.initialized = true;
    }

    /**
     * Send JSON-RPC request - routes based on transport mode
     */
    async sendJsonRpcRequest(method, params) {
        if (!this.initialized) {
            throw new Error('MCP client not initialized');
        }

        if (this.transportMode === 'streaming') {
            return await this.sendStreamingRequest(method, params);
        } else {
            return await this.sendPostRequest(method, params);
        }
    }

    /**
     * Send request in streaming mode (POST /messages)
     */
    async sendStreamingRequest(method, params) {
        if (!this.sessionId) {
            throw new Error('No session ID');
        }

        const requestId = this.requestId++;
        const request = {
            jsonrpc: '2.0',
            id: requestId,
            method: method,
            params: params
        };

        console.log(`📤 Sending JSON-RPC #${requestId}:`, method, params);

        // Create promise for response
        const responsePromise = new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
            
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });

        // Send request
        try {
            const response = await fetch(`${this.mcpUrl}/messages?sessionId=${this.sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            this.pendingRequests.delete(requestId);
            throw error;
        }

        return await responsePromise;
    }

    /**
     * Send request in POST mode (direct POST /mcp)
     */
    async sendPostRequest(method, params) {
        const requestId = this.requestId++;
        const request = {
            jsonrpc: '2.0',
            id: requestId,
            method: method,
            params: params
        };

        console.log(`📤 POST request #${requestId}:`, method);

        const headers = { 'Content-Type': 'application/json' };
        if (this.sessionId && this.sessionId !== 'post-based') {
            headers['Mcp-Session-Id'] = this.sessionId;
        }

        const response = await fetch(`${this.mcpUrl}/mcp`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        
        // Parse SSE-formatted response
        const lines = text.split('\n');
        let jsonData = null;
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                jsonData = JSON.parse(line.substring(6));
                break;
            }
        }

        if (!jsonData) {
            throw new Error('Invalid response format');
        }

        if (jsonData.error) {
            throw new Error(jsonData.error.message || 'MCP call failed');
        }

        console.log(`✅ POST result #${requestId}`);
        return jsonData.result;
    }

    /**
     * Call an MCP tool with the given parameters
     * @param {string} toolName - Name of the MCP tool to call
     * @param {object} params - Parameters to pass to the tool
     * @returns {Promise<{success: boolean, data: any, error?: string}>}
     */
    async callMcp(toolName, params = {}) {
        try {
            // Ensure we're initialized
            if (!this.initialized) {
                await this.initialize();
            }

            // Send tools/call request
            const result = await this.sendJsonRpcRequest('tools/call', {
                name: toolName,
                arguments: params
            });

            return {
                success: true,
                data: this.parseMcpResponse(result.content)
            };
        } catch (error) {
            console.error('MCP call failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * List available MCP tools
     * @returns {Promise<array>} Array of tool definitions
     */
    async listTools() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Send tools/list request (MCP protocol method)
            const result = await this.sendJsonRpcRequest('tools/list', {});

            return result.tools || [];
        } catch (error) {
            console.error('Failed to list tools:', error);
            throw error;
        }
    }

    /**
     * Close the MCP session
     */
    close() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.sessionId = null;
        this.initialized = false;
        this.pendingRequests.clear();
    }

    /**
     * Parse MCP response content based on the response type
     * @param {array} content - MCP response content array
     * @returns {any} Parsed response data
     */
    parseMcpResponse(content) {
        if (!content || !Array.isArray(content)) return null;
        
        const textContent = content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('');

        // Special handling for list_registered_clusters
        if (textContent.includes('Registered clusters')) {
            const clusters = this.parseClusterList(textContent);
            console.log('parseClusterList result:', clusters); // DEBUG
            return clusters;
        }

        // Try to parse as JSON for structured data
        try {
            if (textContent.includes('{') || textContent.includes('[')) {
                return JSON.parse(textContent);
            }
        } catch (e) {
            // Not JSON, return as text
        }

        return textContent;
    }

    /**
     * Parse cluster list from text response
     * @param {string} text - Text response containing cluster list
     * @returns {array} Array of cluster objects
     */
    parseClusterList(text) {
        const clusters = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            // Look for lines like: "- cluster-name: ip (description)"
            const match = line.match(/^-\s+([^:]+):\s+([^\s]+)\s+\(([^)]+)\)/);
            if (match) {
                clusters.push({
                    name: match[1].trim(),
                    cluster_ip: match[2].trim(),
                    description: match[3].trim(),
                    username: 'admin', // Default from test clusters
                    password: '***' // Hidden for security
                });
            }
        }
        
        return clusters;
    }

    /**
     * Parse SVMs from text response
     * @param {string} text - Text response containing SVM list
     * @returns {array} Array of SVM objects
     */
    parseSvmList(text) {
        const svms = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            // Look for lines that start with "- " and contain SVM info
            // Format: "- vs123 (uuid) - State: running" or "- svm143 (uuid) - State: running"
            const svmMatch = line.match(/^-\s+(\w+)\s+\([^)]+\)\s+-\s+State:\s+running/);
            if (svmMatch) {
                const svmName = svmMatch[1];
                if (svmName && svmName !== 'Name:') {
                    svms.push({ name: svmName });
                }
            }
        }
        
        return svms;
    }

    /**
     * Parse aggregates from text response
     * @param {string} text - Text response containing aggregate list
     * @returns {array} Array of aggregate objects
     */
    parseAggregateList(text) {
        const aggregates = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            // Look for aggregate names in the format: "- aggregate_name (uuid) - State: online"
            const aggregateMatch = line.match(/^-\s+([^\s(]+)\s*\(/);
            if (aggregateMatch) {
                const aggregateName = aggregateMatch[1].trim();
                if (aggregateName && !aggregates.find(a => a.name === aggregateName)) {
                    aggregates.push({ name: aggregateName });
                }
            }
        }
        
        return aggregates;
    }

    /**
     * Parse export policies from text response
     * @param {string} text - Text response containing export policy list
     * @returns {array} Array of policy objects
     */
    parseExportPolicyList(text) {
        const policies = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            // Parse lines like "🔐 **policy-name** (ID: policy-id)"
            const policyMatch = line.match(/🔐\s+\*\*([^*]+)\*\*/);
            if (policyMatch) {
                const policyName = policyMatch[1].trim();
                if (policyName && !policies.find(p => p.name === policyName)) {
                    policies.push({ name: policyName });
                }
            }
        }
        
        return policies;
    }

    /**
     * Get cluster information
     * @param {string} clusterName - Name of the cluster
     * @returns {Promise<any>} Cluster information
     */
    async getClusterInfo(clusterName) {
        const response = await this.callMcp('cluster_list_svms', {
            cluster_name: clusterName
        });

        if (response.success) {
            return response.data;
        } else {
            console.error('Failed to get cluster info:', response.error);
            return null;
        }
    }

    /**
     * Add a new cluster to the registry
     * @param {object} clusterData - Cluster data object
     * @returns {Promise<boolean>} Success status
     */
    async addCluster(clusterData) {
        const response = await this.callMcp('add_cluster', {
            name: clusterData.name,
            cluster_ip: clusterData.cluster_ip,
            username: clusterData.username,
            password: clusterData.password,
            description: clusterData.description
        });

        return response.success;
    }

    /**
     * Test cluster connection
     * @param {string} clusterName - Name of the cluster to test
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async testClusterConnection(clusterName) {
        return await this.callMcp('cluster_list_svms', {
            cluster_name: clusterName
        });
    }

    /**
     * Load SVMs for a cluster
     * @param {string} clusterName - Name of the cluster
     * @returns {Promise<array>} Array of SVM objects
     */
    async loadSvms(clusterName) {
        const response = await this.callMcp('cluster_list_svms', {
            cluster_name: clusterName
        });

        if (response.success) {
            // Handle different response formats
            let svms = [];
            if (Array.isArray(response.data)) {
                svms = response.data;
            } else if (typeof response.data === 'string') {
                svms = this.parseSvmList(response.data);
            }
            return svms;
        }
        return [];
    }

    /**
     * Load aggregates for a cluster
     * @param {string} clusterName - Name of the cluster
     * @returns {Promise<array>} Array of aggregate objects
     */
    async loadAggregates(clusterName) {
        const response = await this.callMcp('cluster_list_aggregates', {
            cluster_name: clusterName
        });

        if (response.success && typeof response.data === 'string') {
            return this.parseAggregateList(response.data);
        }
        return [];
    }

    /**
     * Load export policies for a cluster and SVM
     * @param {string} clusterName - Name of the cluster
     * @param {string} svmName - Name of the SVM
     * @returns {Promise<array>} Array of export policy objects
     */
    async loadExportPolicies(clusterName, svmName) {
        const response = await this.callMcp('list_export_policies', {
            cluster_name: clusterName,
            svm_name: svmName
        });

        if (response.success && response.data) {
            const responseText = typeof response.data === 'string' ? response.data : response.data.toString();
            return this.parseExportPolicyList(responseText);
        }
        return [];
    }

    /**
     * Create a volume
     * @param {object} volumeData - Volume creation parameters
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async createVolume(volumeData) {
        return await this.callMcp('cluster_create_volume', volumeData);
    }

    /**
     * List volumes for a cluster
     * @param {string} clusterName - Name of the cluster
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     */
    async listVolumes(clusterName) {
        return await this.callMcp('cluster_list_volumes', {
            cluster_name: clusterName
        });
    }

    /**
     * List snapshot policies
     * @param {string} clusterName - Name of the cluster
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     */
    async listSnapshotPolicies(clusterName) {
        return await this.callMcp('list_snapshot_policies', {
            cluster_name: clusterName
        });
    }

    /**
     * List CIFS shares
     * @param {string} clusterName - Name of the cluster
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     */
    async listCifsShares(clusterName) {
        return await this.callMcp('cluster_list_cifs_shares', {
            cluster_name: clusterName
        });
    }
}

// Export for use in other modules
window.McpApiClient = McpApiClient;