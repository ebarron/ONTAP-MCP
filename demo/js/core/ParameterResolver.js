/**
 * Parameter Resolver
 * 
 * Bridges the gap between alert labels (human-friendly names) and MCP tool parameters (UUIDs).
 * Provides helper methods for:
 * - Resolving volume names to UUIDs
 * - Fetching current volume metrics from Prometheus
 * - Calculating suggested volume sizes
 * - Finding and suggesting snapshots to delete
 */

class ParameterResolver {
    constructor(mcpClient, harvestClient = null) {
        this.mcpClient = mcpClient;  // ONTAP MCP client for volume operations
        this.harvestClient = harvestClient;  // Harvest MCP client for Prometheus metrics
    }

    /**
     * Resolve volume name to UUID by querying the cluster
     * @param {string} clusterName - Cluster name
     * @param {string} svmName - SVM name
     * @param {string} volumeName - Volume name
     * @returns {Promise<string>} - Volume UUID
     */
    async resolveVolumeUUID(clusterName, svmName, volumeName) {
        try {
            console.log(`🔍 Searching for volume: cluster="${clusterName}", svm="${svmName}", volume="${volumeName}"`);
            
            const result = await this.mcpClient.callMcp('cluster_list_volumes', {
                cluster_name: clusterName,
                svm_name: svmName
            });

            // Parse the text response to find volumes
            const text = typeof result === 'string' ? result : result.content[0].text;
            const lines = text.split('\n');
            
            console.log(`📋 Searching through ${lines.length} lines for volume "${volumeName}"`);
            const foundVolumes = [];
            
            for (const line of lines) {
                // Format: "- volume_name (uuid) - Size: 100GB, Used: 50%"
                const match = line.match(/^-\s+([^\s(]+)\s+\(([^)]+)\)/);
                if (match) {
                    foundVolumes.push(match[1]);
                    console.log(`  Found volume: "${match[1]}" (UUID: ${match[2]})`);
                    if (match[1] === volumeName) {
                        console.log(`✅ Match found! Returning UUID: ${match[2]}`);
                        return match[2]; // Return UUID
                    }
                }
            }

            console.error(`❌ Volume "${volumeName}" not found. Available volumes:`, foundVolumes);
            
            // Check if this might be a FlexGroup constituent name issue
            const possibleFlexGroup = volumeName.match(/^(.+)__\d+$/);
            if (possibleFlexGroup) {
                const baseVolName = possibleFlexGroup[1];
                if (foundVolumes.includes(baseVolName)) {
                    throw new Error(`Volume '${volumeName}' not found. This appears to be a FlexGroup constituent name (${baseVolName}__NNNN). The base FlexGroup '${baseVolName}' exists, but Fix-It actions cannot target individual constituents. Please contact support if you need to manage FlexGroup volumes.`);
                }
            }
            
            throw new Error(`Volume '${volumeName}' not found in SVM '${svmName}'. Available: ${foundVolumes.join(', ')}`);
        } catch (error) {
            console.error('Error resolving volume UUID:', error);
            throw error;
        }
    }

    /**
     * Get current volume size from Prometheus metrics
     * @param {string} clusterName - Cluster name
     * @param {string} volumeName - Volume name
     * @returns {Promise<number>} - Volume size in bytes
     */
    async getCurrentVolumeSize(clusterName, volumeName) {
        if (!this.harvestClient) {
            throw new Error('Harvest client not configured - cannot query metrics');
        }

        try {
            const query = `volume_size_total{cluster="${clusterName}", volume="${volumeName}"}`;
            console.log(`📊 Querying Prometheus: ${query}`);
            
            const result = await this.harvestClient.callMcp('metrics_query', { query });
            
            // Parse the text response
            const text = typeof result === 'string' ? result : result.content[0].text;
            console.log(`📊 Metrics response:`, text.substring(0, 200));
            
            // Try to parse JSON - could be wrapped in markdown or plain JSON
            let data;
            const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) {
                data = JSON.parse(jsonMatch[1]);
            } else if (text.trim().startsWith('{')) {
                // Plain JSON response
                data = JSON.parse(text);
            } else {
                throw new Error('Unable to parse metrics response format');
            }
            
            if (data.data?.result && data.data.result.length > 0) {
                const sizeBytes = parseFloat(data.data.result[0].value[1]);
                console.log(`✅ Volume size: ${sizeBytes} bytes (${this.formatSize(sizeBytes)})`);
                return sizeBytes;
            }

            throw new Error(`No size metric found for volume ${volumeName}`);
        } catch (error) {
            console.error('Error getting current volume size:', error);
            throw error;
        }
    }

    /**
     * Get current volume used percentage from Prometheus metrics
     * @param {string} clusterName - Cluster name
     * @param {string} volumeName - Volume name
     * @returns {Promise<number>} - Used percentage (0-100)
     */
    async getCurrentVolumeUsedPercent(clusterName, volumeName) {
        if (!this.harvestClient) {
            throw new Error('Harvest client not configured - cannot query metrics');
        }

        try {
            const query = `volume_size_used_percent{cluster="${clusterName}", volume="${volumeName}"}`;
            console.log(`📊 Querying Prometheus: ${query}`);
            
            const result = await this.harvestClient.callMcp('metrics_query', { query });
            
            // Parse the text response
            const text = typeof result === 'string' ? result : result.content[0].text;
            
            // Try to parse JSON - could be wrapped in markdown or plain JSON
            let data;
            const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) {
                data = JSON.parse(jsonMatch[1]);
            } else if (text.trim().startsWith('{')) {
                // Plain JSON response
                data = JSON.parse(text);
            } else {
                throw new Error('Unable to parse metrics response format');
            }

            if (data.data?.result && data.data.result.length > 0) {
                const usedPercent = parseFloat(data.data.result[0].value[1]);
                console.log(`✅ Volume used: ${usedPercent}%`);
                return usedPercent;
            }

            throw new Error(`No used percentage metric found for volume ${volumeName}`);
        } catch (error) {
            console.error('Error getting volume used percentage:', error);
            throw error;
        }
    }

    /**
     * Calculate suggested new volume size based on current usage
     * @param {number} currentSize - Current volume size in bytes
     * @param {number} usedPercent - Current used percentage (0-100)
     * @param {string} strategy - Sizing strategy
     * @returns {number} - Suggested new size in bytes
     */
    suggestNewSize(currentSize, usedPercent, strategy = 'reduce_to_80') {
        const usedSize = currentSize * (usedPercent / 100);

        switch (strategy) {
            case 'reduce_to_80':
                // Size to bring utilization down to 80%
                return Math.ceil(usedSize / 0.80);

            case 'reduce_to_70':
                // Size to bring utilization down to 70%
                return Math.ceil(usedSize / 0.70);

            case 'add_20_percent':
                // Add 20% more capacity
                return Math.ceil(currentSize * 1.20);

            case 'add_50_percent':
                // Add 50% more capacity
                return Math.ceil(currentSize * 1.50);

            case 'add_fixed_100gb':
                // Add fixed 100GB
                return currentSize + (100 * 1024 * 1024 * 1024);

            case 'double':
                // Double the size
                return currentSize * 2;

            default:
                // Default: reduce to 80%
                return Math.ceil(usedSize / 0.80);
        }
    }

    /**
     * Format bytes to human-readable size string
     * @param {number} bytes - Size in bytes
     * @param {string} unit - Target unit (GB, TB, etc.) or 'auto'
     * @returns {string} - Formatted size (e.g., "500GB")
     */
    formatSize(bytes, unit = 'auto') {
        const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const k = 1024;

        if (unit === 'auto') {
            if (bytes === 0) return '0B';
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return `${Math.ceil(bytes / Math.pow(k, i))}${units[i]}`;
        }

        // Convert to specific unit
        const unitIndex = units.indexOf(unit.toUpperCase());
        if (unitIndex === -1) {
            throw new Error(`Invalid unit: ${unit}`);
        }

        const value = bytes / Math.pow(k, unitIndex);
        return `${Math.ceil(value)}${units[unitIndex]}`;
    }

    /**
     * Get list of snapshots and suggest oldest ones to delete
     * @param {string} clusterName - Cluster name
     * @param {string} volumeUUID - Volume UUID
     * @param {number} count - Number of suggestions to return
     * @returns {Promise<Array>} - Array of snapshot suggestions
     */
    async suggestSnapshotsToDelete(clusterName, volumeUUID, count = 5) {
        try {
            const result = await this.mcpClient.callMcp('cluster_list_volume_snapshots', {
                cluster_name: clusterName,
                volume_uuid: volumeUUID,
                sort_by: 'create_time',
                order: 'asc' // Oldest first
            });

            // Parse snapshot list from text response
            const text = typeof result === 'string' ? result : result.content[0].text;
            const snapshots = this.parseSnapshotList(text);

            return snapshots.slice(0, count);
        } catch (error) {
            console.error('Error getting snapshot suggestions:', error);
            throw error;
        }
    }

    /**
     * Parse snapshot list from MCP text response
     * @param {string} text - MCP response text
     * @returns {Array} - Array of parsed snapshots
     */
    parseSnapshotList(text) {
        const snapshots = [];
        const lines = text.split('\n');
        let currentSnapshot = null;

        for (const line of lines) {
            // Match snapshot name line: "1. snapshot_name"
            const nameMatch = line.match(/^\d+\.\s+(.+)$/);
            if (nameMatch) {
                if (currentSnapshot) {
                    snapshots.push(currentSnapshot);
                }
                currentSnapshot = {
                    name: nameMatch[1].trim()
                };
                continue;
            }

            if (currentSnapshot) {
                // Match UUID line: "   UUID: abc-123-def"
                const uuidMatch = line.match(/^\s+UUID:\s+(.+)$/);
                if (uuidMatch) {
                    currentSnapshot.uuid = uuidMatch[1].trim();
                    continue;
                }

                // Match Created line: "   Created: 2024-10-09T10:30:00Z"
                const createdMatch = line.match(/^\s+Created:\s+(.+)$/);
                if (createdMatch) {
                    currentSnapshot.created = createdMatch[1].trim();
                    continue;
                }

                // Match Size line: "   Size: 5.23 GB"
                const sizeMatch = line.match(/^\s+Size:\s+(.+)$/);
                if (sizeMatch) {
                    currentSnapshot.size = sizeMatch[1].trim();
                    continue;
                }
            }
        }

        // Push last snapshot
        if (currentSnapshot) {
            snapshots.push(currentSnapshot);
        }

        return snapshots;
    }

    /**
     * Calculate suggested autosize maximum based on current size and growth expectations
     * @param {number} currentSize - Current volume size in bytes
     * @param {string} strategy - Sizing strategy
     * @returns {number} - Suggested maximum size in bytes
     */
    suggestAutosizeMaximum(currentSize, strategy = 'double') {
        switch (strategy) {
            case 'double':
                return currentSize * 2;

            case 'triple':
                return currentSize * 3;

            case 'add_50_percent':
                return Math.ceil(currentSize * 1.5);

            case 'add_500gb':
                return currentSize + (500 * 1024 * 1024 * 1024);

            case 'add_1tb':
                return currentSize + (1024 * 1024 * 1024 * 1024);

            default:
                return currentSize * 2;
        }
    }

    /**
     * Validate that a suggested size is reasonable
     * @param {number} currentSize - Current size in bytes
     * @param {number} newSize - Proposed new size in bytes
     * @returns {Object} - Validation result with { valid: boolean, reason: string }
     */
    validateSizeChange(currentSize, newSize) {
        if (newSize <= currentSize) {
            return {
                valid: false,
                reason: 'New size must be larger than current size (ONTAP does not support shrinking volumes with data)'
            };
        }

        const increasePercent = ((newSize - currentSize) / currentSize) * 100;

        if (increasePercent > 1000) {
            return {
                valid: false,
                reason: `Size increase of ${Math.round(increasePercent)}% seems excessive. Consider a smaller increase.`
            };
        }

        if (increasePercent < 5) {
            return {
                valid: false,
                reason: `Size increase of ${Math.round(increasePercent)}% is too small. Increase by at least 5%.`
            };
        }

        return { valid: true };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParameterResolver;
}
