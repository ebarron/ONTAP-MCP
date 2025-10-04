/**
 * NetApp ONTAP MCP API Client
 * 
 * Handles all communication with the MCP server using MCP JSON-RPC 2.0 over SSE:
 * - Establishes SSE connection to /mcp endpoint
 * - Sends JSON-RPC requests via POST /messages
 * - Response parsing and error handling
 * - Cluster-specific data parsing
 */
class McpApiClient {
    constructor(mcpUrl = 'http://localhost:3000') {
        this.mcpUrl = mcpUrl;
        this.sessionId = null;
        this.requestId = 1;
        this.initialized = false;
        this.eventSource = null;
        this.pendingRequests = new Map(); // Track pending JSON-RPC requests
    }

    /**
     * Initialize MCP session via SSE
     * Establishes SSE stream and extracts session ID from endpoint event
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('🔌 Establishing MCP SSE connection...');
            
            // Establish SSE stream
            this.eventSource = new EventSource(`${this.mcpUrl}/mcp`);
            
            // Wait for 'endpoint' event to get session ID
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('SSE connection timeout'));
                }, 10000);

                this.eventSource.addEventListener('endpoint', (event) => {
                    clearTimeout(timeout);
                    try {
                        // Endpoint event data is just the endpoint string: "/messages?sessionId=ABC123"
                        const endpoint = event.data.trim();
                        console.log(`📡 Received endpoint: ${endpoint}`);
                        
                        // Extract sessionId from endpoint URL
                        const match = endpoint.match(/sessionId=([^&\s]+)/);
                        if (!match) {
                            reject(new Error('No sessionId in endpoint event'));
                            return;
                        }
                        
                        this.sessionId = match[1];
                        console.log(`✅ SSE session established: ${this.sessionId}`);
                        resolve();
                    } catch (error) {
                        reject(new Error(`Failed to parse endpoint event: ${error.message}`));
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
                        console.log('📨 Received SSE message:', data);
                        
                        // Check if this is a JSON-RPC response
                        if (data.jsonrpc === '2.0' && data.id !== undefined) {
                            const pending = this.pendingRequests.get(data.id);
                            if (pending) {
                                if (data.error) {
                                    console.error('❌ JSON-RPC error:', data.error);
                                    pending.reject(new Error(data.error.message || 'MCP call failed'));
                                } else {
                                    console.log('✅ JSON-RPC result:', data.result);
                                    pending.resolve(data.result);
                                }
                                this.pendingRequests.delete(data.id);
                            } else {
                                console.warn('⚠️ Received response for unknown request ID:', data.id);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to parse SSE message:', error, 'Data:', event.data);
                    }
                });
            });

            // Send initialize request
            await this.sendJsonRpcRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: {
                    name: 'ontap-mcp-demo',
                    version: '1.0.0'
                }
            });

            this.initialized = true;
            console.log('✅ MCP client initialized');

        } catch (error) {
            console.error('❌ MCP initialization failed:', error);
            this.close();
            throw error;
        }
    }

    /**
     * Send JSON-RPC request via POST /messages
     * @param {string} method - JSON-RPC method (e.g., 'tools/call')
     * @param {object} params - Method parameters
     * @returns {Promise<any>} JSON-RPC result
     */
    async sendJsonRpcRequest(method, params) {
        if (!this.sessionId) {
            throw new Error('MCP session not initialized');
        }

        const requestId = this.requestId++;
        const request = {
            jsonrpc: '2.0',
            id: requestId,
            method: method,
            params: params
        };

        console.log(`📤 Sending JSON-RPC request #${requestId}:`, method, params);

        // Create promise for response
        const responsePromise = new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
            
            // Timeout after 30 seconds
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
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            this.pendingRequests.delete(requestId);
            throw error;
        }

        return responsePromise;
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