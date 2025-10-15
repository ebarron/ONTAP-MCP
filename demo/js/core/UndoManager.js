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
                // New hybrid format detected!
                console.log('✅ Detected hybrid format from get_volume_configuration');
                console.log('   → Has data:', !!config.data);
                console.log('   → Has summary:', !!config.summary);
                return this.parseStructuredVolumeState(config.data, volumeUuid);
            }
            
            // Try to parse as JSON string (fallback)
            if (typeof config === 'string') {
                try {
                    const parsed = JSON.parse(config);
                    if (parsed.data && parsed.summary) {
                        console.log('✅ Parsed JSON string to hybrid format');
                        return this.parseStructuredVolumeState(parsed.data, volumeUuid);
                    }
                } catch (jsonError) {
                    // Not JSON - fall through to text parsing
                    console.log('ℹ️ Response is not JSON, using text parsing');
                }
                
                // Fall back to text parsing (old format or summary-only)
                return this.parseTextVolumeState(config, volumeUuid);
            }
            
            console.warn('⚠️ Unexpected response format, using fallback');
            return this.parseTextVolumeState(String(config), volumeUuid);
            
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
     * Parse text format volume state (old format - for backwards compatibility)
     */
    parseTextVolumeState(config, volumeUuid) {
        console.log('📝 Parsing text format volume state...');
        
        // Parse the text response to extract current values
        const state = {
            volume_uuid: volumeUuid,
            captureMethod: 'get_volume_configuration_text',
            captureTime: Date.now()
        };
        
        // Extract state from response text
        if (config && typeof config === 'string') {
            // Parse state: online/offline/restricted (handle emoji and markdown)
            // Format can be: "📈 **State:** online" or "State: online"
            const stateMatch = config.match(/State:\*\*\s*(\w+)|State:\s*(\w+)/i);
            if (stateMatch) {
                state.state = (stateMatch[1] || stateMatch[2]).toLowerCase();
            }
            
            // Parse size (handle markdown bold)
            const sizeMatch = config.match(/Size:\*\*\s*(\d+(?:\.\d+)?)\s*(GB|TB|MB)|Size:\s*(\d+(?:\.\d+)?)\s*(GB|TB|MB)/i);
            if (sizeMatch) state.size = `${sizeMatch[1] || sizeMatch[3]}${sizeMatch[2] || sizeMatch[4]}`;
            
            // Parse comment (handle markdown bold)
            const commentMatch = config.match(/Comment:\*\*\s*(.+)|Comment:\s*(.+)/i);
            if (commentMatch) state.comment = (commentMatch[1] || commentMatch[2]).trim();
            
            // Parse QoS policy (not in current formatVolumeConfig, but keep for future)
            const qosMatch = config.match(/QoS Policy:\*\*\s*(\S+)|QoS Policy:\s*(\S+)/i);
            if (qosMatch) {
                const qosValue = qosMatch[1] || qosMatch[2];
                if (qosValue !== '-') state.qos_policy = qosValue;
            }
            
            // Parse snapshot policy (handle markdown bold)
            const snapMatch = config.match(/Snapshot Policy:\*\*\s*(\S+)|Snapshot Policy:\s*(\S+)/i);
            if (snapMatch) {
                const snapValue = snapMatch[1] || snapMatch[2];
                if (snapValue !== '-' && snapValue !== 'None') state.snapshot_policy = snapValue;
            }
            
            // Parse autosize configuration (matches format from formatVolumeConfig)
            // Check for disabled state first: "📏 **Autosize:** Disabled"
            if (config.match(/Autosize:\*\*\s*Disabled|Autosize:\s*Disabled/i)) {
                state.autosize_mode = 'off';
            } else {
                // Parse mode: "   • Mode: grow"
                const autosizeMatch = config.match(/•\s*Mode:\s*(\w+)/i);
                if (autosizeMatch) {
                    state.autosize_mode = autosizeMatch[1].toLowerCase();
                }
                
                // Parse maximum size: "   • Maximum Size: 190.00MB"
                const maxMatch = config.match(/•\s*Maximum Size:\s*(\d+(?:\.\d+)?)\s*(GB|TB|MB)/i);
                if (maxMatch) {
                    state.autosize_maximum = `${maxMatch[1]}${maxMatch[2]}`;
                }
                
                // Parse minimum size: "   • Minimum Size: 95.00MB"
                const minMatch = config.match(/•\s*Minimum Size:\s*(\d+(?:\.\d+)?)\s*(GB|TB|MB)/i);
                if (minMatch) {
                    state.autosize_minimum = `${minMatch[1]}${minMatch[2]}`;
                }
                
                // Parse grow threshold: "   • Grow Threshold: 85%"
                const growMatch = config.match(/•\s*Grow Threshold:\s*(\d+)%/i);
                if (growMatch) {
                    state.autosize_grow_threshold = parseInt(growMatch[1]);
                }
                
                // Parse shrink threshold: "   • Shrink Threshold: 50%"
                const shrinkMatch = config.match(/•\s*Shrink Threshold:\s*(\d+)%/i);
                if (shrinkMatch) {
                    state.autosize_shrink_threshold = parseInt(shrinkMatch[1]);
                }
            }
        }
        
        console.log('✅ State parsed from text format:', state);
        return state;
    }    /**
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
        
        // Check if we're using the new JSON format (no parameter mapping needed!)
        const isJsonFormat = originalState.captureMethod === 'get_volume_configuration_json';
        
        // Parameter name mapping for OLD text format only
        // NEW JSON format uses MCP parameter names directly - NO MAPPING NEEDED!
        const paramMapping = isJsonFormat ? {} : {
            'mode': 'autosize_mode',              // autosize mode
            'maximum_size': 'autosize_maximum',   // autosize max size  
            'minimum_size': 'autosize_minimum',   // autosize min size
            'grow_threshold_percent': 'autosize_grow_threshold',     // autosize grow %
            'shrink_threshold_percent': 'autosize_shrink_threshold'  // autosize shrink %
        };
        
        // Analyze actual MCP parameters being changed (from mcp_params)
        const paramsToCheck = action.mcp_params ? Object.keys(action.mcp_params) : [];
        
        console.log('🔍 DEBUG: Checking parameters for reversibility');
        console.log('   Format:', isJsonFormat ? 'JSON (direct mapping)' : 'TEXT (requires mapping)');
        console.log('   paramsToCheck:', paramsToCheck);
        console.log('   originalState keys:', Object.keys(originalState));
        
        for (const param of paramsToCheck) {
            // Skip identifiers (not reversible by nature)
            if (param === 'cluster_name' || param === 'volume_uuid' || param === 'svm_name' || param === 'volume_name') {
                continue;
            }
            
            // Map action parameter name to state parameter name (for text format only)
            const stateParamName = paramMapping[param] || param;
            
            console.log(`   Checking param "${param}" (maps to "${stateParamName}"): originalState has it? ${originalState[stateParamName] !== undefined}`);
            
            // Check if we have the original value (using mapped name)
            if (originalState[stateParamName] !== undefined && originalState[stateParamName] !== null) {
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
        
        // Check if we're using the new JSON format (no parameter mapping needed!)
        const isJsonFormat = originalState.captureMethod === 'get_volume_configuration_json';
        
        // Parameter name mapping for OLD text format only
        // NEW JSON format uses MCP parameter names directly - NO MAPPING NEEDED!
        const paramMapping = isJsonFormat ? {} : {
            'mode': 'autosize_mode',
            'maximum_size': 'autosize_maximum',
            'minimum_size': 'autosize_minimum',
            'grow_threshold_percent': 'autosize_grow_threshold',
            'shrink_threshold_percent': 'autosize_shrink_threshold'
        };
        
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
            
            // Map action parameter name to state parameter name
            const stateParamName = paramMapping[key] || key;
            
            // If we have the original value, revert to it
            if (originalState[stateParamName] !== undefined && originalState[stateParamName] !== null) {
                undoParams[key] = originalState[stateParamName];
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
