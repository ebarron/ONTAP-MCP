// UndoManager - Generic undo system for Fix-It actions
// Captures state, determines reversibility, generates undo actions

class UndoManager {
    constructor(apiClient, parameterResolver) {
        this.apiClient = apiClient;
        this.parameterResolver = parameterResolver;
        
        // In-memory storage (cleared on page reload)
        this.undoInfoStore = new Map();
    }

    /**
     * Capture current state before executing Fix-It action
     * Tries get_volume_configuration first, falls back to ParameterResolver
     */
    async captureCurrentState(alert, action, resolvedParams) {
        console.log('📸 Capturing current state before execution...');
        
        try {
            // Try to get volume configuration via MCP
            const volumeUuid = resolvedParams.volume_uuid;
            const clusterName = resolvedParams.cluster_name;
            
            if (volumeUuid && clusterName) {
                return await this.captureViaVolumeConfiguration(clusterName, volumeUuid);
            } else {
                console.warn('⚠️ Missing volume_uuid or cluster_name, using fallback');
                return await this.captureFallback(alert, resolvedParams);
            }
        } catch (error) {
            console.warn('⚠️ State capture failed, trying fallback:', error);
            return await this.captureFallback(alert, resolvedParams);
        }
    }

    /**
     * Capture state using get_volume_configuration MCP tool
     */
    async captureViaVolumeConfiguration(clusterName, volumeUuid) {
        console.log(`� Querying volume configuration: ${volumeUuid}`);
        
        try {
            // Use callMcpRaw() to get full hybrid format object {summary, data}
            const response = await this.apiClient.callMcpRaw('get_volume_configuration', {
                cluster_name: clusterName,
                volume_uuid: volumeUuid
            });
            
            console.log('🔍 Raw response type:', typeof response);
            
            // Extract from MCP envelope if needed
            let config = response;
            if (response?.content?.[0]?.text) {
                config = response.content[0].text;
                console.log('📦 Extracted from MCP envelope, type:', typeof config);
            }
            
            // Check if we have hybrid format with structured data
            if (config && typeof config === 'object' && config.data && config.summary) {
                // Hybrid format detected!
                console.log('✅ Detected hybrid format from get_volume_configuration');
                console.log('   → Has data:', !!config.data);
                console.log('   → Has summary:', !!config.summary);
                return this.parseStructuredVolumeState(config.data, volumeUuid);
            }
            
            // Try to parse as JSON string
            if (typeof config === 'string') {
                try {
                    const parsed = JSON.parse(config);
                    if (parsed.data && parsed.summary) {
                        console.log('✅ Parsed JSON string to hybrid format');
                        return this.parseStructuredVolumeState(parsed.data, volumeUuid);
                    }
                } catch (jsonError) {
                    console.error('❌ Failed to parse response as JSON:', jsonError);
                }
            }
            
            console.error('❌ Unexpected response format - hybrid format expected');
            throw new Error('State capture failed: Expected hybrid format {summary, data} but got unexpected format');
            
        } catch (error) {
            console.warn('❌ get_volume_configuration failed:', error);
            throw error;
        }
    }

    /**
     * Parse structured JSON volume state (new hybrid format)
     * Uses MCP parameter names directly - NO MAPPING NEEDED!
     */
    parseStructuredVolumeState(data, volumeUuid) {
        console.log('� Parsing structured volume state from JSON...');
        
        const state = {
            volume_uuid: volumeUuid,
            captureMethod: 'get_volume_configuration_json',
            captureTime: Date.now()
        };
        
        // Basic volume info
        if (data.volume) {
            if (data.volume.state) state.state = data.volume.state;
            if (data.volume.size) state.size = `${(data.volume.size / (1024**3)).toFixed(2)}GB`;
            if (data.volume.comment) state.comment = data.volume.comment;
        }
        
        // Autosize config - uses MCP parameter names directly!
        if (data.autosize) {
            state.mode = data.autosize.mode;  // Direct mapping!
            if (data.autosize.maximum_size) {
                state.maximum_size = `${(data.autosize.maximum_size / (1024**3)).toFixed(2)}GB`;
            }
            if (data.autosize.minimum_size) {
                state.minimum_size = `${(data.autosize.minimum_size / (1024**3)).toFixed(2)}GB`;
            }
            if (data.autosize.grow_threshold_percent !== undefined) {
                state.grow_threshold_percent = data.autosize.grow_threshold_percent;
            }
            if (data.autosize.shrink_threshold_percent !== undefined) {
                state.shrink_threshold_percent = data.autosize.shrink_threshold_percent;
            }
        }
        
        // Policies
        if (data.qos?.policy_name) state.qos_policy = data.qos.policy_name;
        if (data.snapshot_policy?.name) state.snapshot_policy = data.snapshot_policy.name;
        if (data.nfs?.export_policy) state.export_policy = data.nfs.export_policy;
        if (data.nfs?.security_style) state.security_style = data.nfs.security_style;
        
        console.log('✅ State parsed from structured JSON:', state);
        return state;
    }

    /**
     * Fallback: Capture state using ParameterResolver + Prometheus metrics
     */
    async captureFallback(alert, resolvedParams) {
        console.log('🔄 Using fallback state capture (ParameterResolver + metrics)');
        
        const state = {
            volume_uuid: resolvedParams.volume_uuid,
            captureMethod: 'prometheus_metrics',
            captureTime: Date.now()
        };
        
        // Get current size from Prometheus
        if (alert.labels?.cluster && alert.labels?.volume) {
            try {
                const size = await this.parameterResolver.getCurrentVolumeSize(
                    alert.labels.cluster,
                    alert.labels.volume
                );
                if (size) state.size = size;
            } catch (error) {
                console.warn('Could not get current size:', error);
            }
        }
        
        // Get current state from alert labels (if available)
        if (alert.labels?.state) {
            state.state = alert.labels.state;
        }
        
        console.log('✅ State captured via fallback:', state);
        return state;
    }

    /**
     * Determine if an action is reversible
     */
    determineReversibility(action, originalState) {
        console.log('🔍 Checking reversibility for:', action.mcp_tool);
        console.log('   Action mcp_params:', action.mcp_params);
        console.log('   Original state:', originalState);
        
        // Rule 1: Deletion operations are irreversible
        if (action.mcp_tool.includes('delete')) {
            return {
                reversible: false,
                reason: 'Deletion is permanent - data cannot be recovered',
                canRestore: [],
                cannotRestore: Object.keys(action.requires_params || [])
            };
        }
        
        // Rule 2: Missing original state means we can't undo
        if (!originalState || Object.keys(originalState).length <= 2) {
            // Only has volume_uuid and captureMethod
            return {
                reversible: false,
                reason: 'Original state could not be captured',
                canRestore: [],
                cannotRestore: Object.keys(action.requires_params || [])
            };
        }
        
        // Rule 3: Check which parameters can be restored
        const canRestore = [];
        const cannotRestore = [];
        
        // Analyze actual MCP parameters being changed (from mcp_params)
        const paramsToCheck = action.mcp_params ? Object.keys(action.mcp_params) : [];
        
        console.log('🔍 Checking parameters for reversibility');
        console.log('   paramsToCheck:', paramsToCheck);
        console.log('   originalState keys:', Object.keys(originalState));
        
        for (const param of paramsToCheck) {
            // Skip identifiers (not reversible by nature)
            if (param === 'cluster_name' || param === 'volume_uuid' || param === 'svm_name' || param === 'volume_name') {
                continue;
            }
            
            console.log(`   Checking param "${param}": originalState has it? ${originalState[param] !== undefined}`);
            
            // Check if we have the original value (direct parameter name match)
            if (originalState[param] !== undefined && originalState[param] !== null) {
                canRestore.push(param);
            } else {
                cannotRestore.push(param);
            }
        }
        
        // Rule 4: At least one parameter must be restorable
        if (canRestore.length === 0) {
            return {
                reversible: false,
                reason: 'No restorable parameters found',
                canRestore: [],
                cannotRestore
            };
        }
        
        // Reversible!
        return {
            reversible: true,
            partial: cannotRestore.length > 0,
            reason: null,
            canRestore,
            cannotRestore
        };
    }

    /**
     * Generate undo action by inverting the executed action
     */
    generateUndoAction(action, originalState, resolvedParams) {
        console.log('🔄 Generating undo action...');
        
        const undoParams = {
            cluster_name: resolvedParams.cluster_name,
            volume_uuid: resolvedParams.volume_uuid
        };
        
        // Build undo parameters by reverting to original values
        const changedParams = [];
        
        // Check each resolved parameter
        for (const [key, newValue] of Object.entries(resolvedParams)) {
            // Skip identifiers
            if (key === 'cluster_name' || key === 'volume_uuid' || key === 'svm_name') {
                continue;
            }
            
            // If we have the original value, revert to it (direct parameter name match)
            if (originalState[key] !== undefined && originalState[key] !== null) {
                undoParams[key] = originalState[key];
                changedParams.push(key);
            }
        }
        
        // Special handling for specific tools
        if (action.mcp_tool === 'cluster_enable_volume_autosize') {
            // If enabling autosize, undo is to disable it
            if (resolvedParams.mode && resolvedParams.mode !== 'off') {
                undoParams.mode = 'off';
                changedParams.push('mode');
            }
        }
        
        // Generate human-readable label
        const label = this.generateUndoLabel(action, changedParams, originalState);
        
        const undoAction = {
            mcp_tool: action.mcp_tool,
            params: undoParams,
            label,
            changedParams
        };
        
        console.log('✅ Undo action generated:', undoAction);
        return undoAction;
    }

    /**
     * Generate human-readable label for undo action
     */
    generateUndoLabel(action, changedParams = null, originalState = null) {
        // If called with just an action object (has changedParams property)
        if (action && action.changedParams) {
            changedParams = action.changedParams;
            originalState = action.params; // The params in the undo action ARE the original values
        }
        
        if (!changedParams || changedParams.length === 0) {
            return 'Undo change';
        }
        
        // Single parameter change - be specific
        if (changedParams.length === 1) {
            const param = changedParams[0];
            const value = originalState ? originalState[param] : 'previous value';
            
            switch (param) {
                case 'state':
                    return `Set state to ${value}`;
                case 'size':
                    return `Restore size to ${value}`;
                case 'mode':
                    return value === 'off' ? 'Disable autosize' : `Set autosize to ${value}`;
                case 'comment':
                    return 'Restore original comment';
                case 'qos_policy':
                    return `Restore QoS policy to ${value}`;
                default:
                    return `Restore ${param} to ${value}`;
            }
        }
        
        // Multiple parameters
        return `Restore ${changedParams.length} parameter(s)`;
    }

    /**
     * Generate ONTAP CLI command for undo action
     * Uses simple template-based generation for now
     */
    generateUndoCLI(undoAction, alert) {
        const tool = undoAction.mcp_tool;
        const params = undoAction.params;
        const volumeName = alert.labels?.volume || '<volume>';
        const svmName = alert.labels?.svm || alert.labels?.vserver || '<vserver>';
        
        // Template-based CLI generation
        if (tool === 'cluster_update_volume') {
            const parts = [];
            
            if (params.state === 'online') {
                return `volume online -vserver ${svmName} -volume ${volumeName}`;
            }
            if (params.state === 'offline') {
                return `volume offline -vserver ${svmName} -volume ${volumeName}`;
            }
            if (params.size) {
                parts.push(`volume modify -vserver ${svmName} -volume ${volumeName} -size ${params.size}`);
            }
            if (params.comment !== undefined) {
                parts.push(`volume modify -vserver ${svmName} -volume ${volumeName} -comment "${params.comment}"`);
            }
            
            return parts.length > 0 ? parts.join('\n') : 'volume modify -vserver <vserver> -volume <volume>';
        }
        
        if (tool === 'cluster_enable_volume_autosize') {
            if (params.mode === 'off') {
                return `volume autosize -vserver ${svmName} -volume ${volumeName} -mode off`;
            }
            return `volume autosize -vserver ${svmName} -volume ${volumeName} -mode ${params.mode}`;
        }
        
        // Default
        return `# Undo via MCP tool: ${tool}`;
    }

    /**
     * Store undo information in sessionStorage
     */
    storeUndoInfo(actionId, undoAction, originalState, executedAction, alert, reversibility) {
        const undoInfo = {
            actionId,
            timestamp: Date.now(),
            alertFingerprint: alert.fingerprint,
            
            executedAction: {
                mcp_tool: executedAction.mcp_tool,
                params: executedAction.params,
                result: executedAction.result
            },
            
            originalState,
            
            undoAction: {
                ...undoAction,
                cliCommand: this.generateUndoCLI(undoAction, alert)
            },
            
            reversibility,
            
            // Alert context for display
            alertContext: {
                cluster: alert.labels?.cluster,
                volume: alert.labels?.volume,
                svm: alert.labels?.svm || alert.labels?.vserver
            }
        };
        
        // Store in memory (cleared on page reload)
        this.undoInfoStore.set(alert.fingerprint, undoInfo);
        console.log('💾 Stored undo info in memory:', undoInfo);
        
        return undoInfo;
    }

    /**
     * Get undo information from memory (cleared on page reload)
     */
    getUndoInfo(alertFingerprint) {
        if (!alertFingerprint) return null;
        
        const undoInfo = this.undoInfoStore.get(alertFingerprint);
        if (!undoInfo) return null;
        
        // Optional: Check if undo info is stale (older than 10 minutes)
        const age = Date.now() - undoInfo.timestamp;
        const maxAge = 10 * 60 * 1000; // 10 minutes
        if (age > maxAge) {
            console.log('ℹ️ Undo info is stale (>10 minutes old), clearing...');
            this.undoInfoStore.delete(alertFingerprint);
            return null;
        }
        
        return undoInfo;
    }

    /**
     * Clear undo information for a specific alert
     */
    clearUndoInfo(alertFingerprint) {
        if (alertFingerprint) {
            this.undoInfoStore.delete(alertFingerprint);
            console.log('🗑️ Cleared undo info for alert:', alertFingerprint);
        } else {
            // Clear all undo info
            this.undoInfoStore.clear();
            console.log('🗑️ Cleared all undo info');
        }
    }

    /**
     * Check if undo is available for current alert
     */
    hasUndo(alertFingerprint) {
        const undoInfo = this.getUndoInfo(alertFingerprint);
        return undoInfo && undoInfo.reversibility?.reversible;
    }
}
