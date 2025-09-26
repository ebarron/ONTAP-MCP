/**
 * NetApp ONTAP MCP API Client
 * 
 * Handles all communication with the MCP server, including:
 * - HTTP requests to MCP tools
 * - Response parsing and error handling
 * - Cluster-specific data parsing
 */
class McpApiClient {
    constructor(mcpUrl = 'http://localhost:3000') {
        this.mcpUrl = mcpUrl;
    }

    /**
     * Call an MCP tool with the given parameters
     * @param {string} toolName - Name of the MCP tool to call
     * @param {object} params - Parameters to pass to the tool
     * @returns {Promise<{success: boolean, data: any, error?: string}>}
     */
    async callMcp(toolName, params = {}) {
        try {
            const response = await fetch(`${this.mcpUrl}/api/tools/${toolName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message || 'MCP call failed');
            }

            return {
                success: true,
                data: this.parseMcpResponse(data.content)
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