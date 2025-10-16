// Fix-It Modal - Confirmation dialog for executing corrective actions
// Shows action details, resolves parameters, and executes MCP tools

class FixItModal {
    constructor(apiClient, parameterResolver, undoManager) {
        this.apiClient = apiClient;
        this.parameterResolver = parameterResolver;
        this.undoManager = undoManager;
        this.currentAction = null;
        this.currentAlert = null;
        this.modalElement = null;
        
        this.createModal();
    }

    createModal() {
        // Create modal HTML structure (NetApp BlueXP style)
        const modalHTML = `
            <div id="fixItModal" class="modal-overlay" style="display: none;">
                <div class="modal-container">
                    <div class="modal-header">
                        <h2 id="fixItModalTitle">Confirm Fix-It Action</h2>
                        <button class="modal-close" onclick="window.fixItModal.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="fixItModalDescription" class="modal-description"></div>
                        
                        <!-- Corrective Action Description (from Fix-It button text) -->
                        <div id="fixItModalActionDescription" class="modal-action-description" style="display: none;">
                            <h4>Corrective Action:</h4>
                            <div id="fixItModalActionDescriptionText" class="action-description-text">
                                <!-- Action description will be injected here -->
                            </div>
                        </div>
                        
                        <!-- Required Values Section (for user-supplied parameters) -->
                        <div id="fixItModalRequiredValues" class="modal-required-values" style="display: none;">
                            <h4>Required Values:</h4>
                            <div id="fixItModalRequiredValuesContent" class="required-values-content">
                                <!-- Required input fields will be injected here -->
                            </div>
                        </div>
                        
                        <!-- CLI Command Section with Copy Button -->
                        <div id="fixItModalCli" class="modal-cli" style="display: none;">
                            <div class="cli-header">
                                <h4>CLI Command:</h4>
                                <button id="fixItModalCliCopy" class="cli-copy-button" title="Copy to clipboard">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4z"/>
                                        <path d="M2 6V2h4v1H3v3H2z"/>
                                    </svg>
                                    Copy
                                </button>
                            </div>
                            <div id="fixItModalCliCommand" class="cli-command-box">
                                <!-- CLI command will be injected here -->
                            </div>
                        </div>
                        
                        <!-- Action Parameters (hidden but kept for execution) -->
                        <div id="fixItModalParams" class="modal-params" style="display: none;">
                            <!-- Parameters will be injected here -->
                        </div>
                        
                        <div id="fixItModalWarning" class="modal-warning" style="display: none;">
                            <strong>⚠️ Warning:</strong> <span id="fixItModalWarningText"></span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="button-secondary" onclick="window.fixItModal.close()">Cancel</button>
                        <button id="fixItModalConfirm" class="button-primary" onclick="window.fixItModal.execute()">
                            Execute Fix-It Action
                        </button>
                    </div>
                    
                    <!-- Progress overlay -->
                    <div id="fixItModalProgress" class="modal-progress" style="display: none;">
                        <div class="spinner"></div>
                        <p id="fixItModalProgressText">Executing action...</p>
                    </div>
                </div>
            </div>
        `;

        // Inject modal into DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modalElement = document.getElementById('fixItModal');
        
        // Add modal styles
        this.injectStyles();
    }

    injectStyles() {
        const styles = `
            <style>
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .modal-container {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow: auto;
                    position: relative;
                }
                
                .modal-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid #e1e5e9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .modal-header h2 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                    color: #333;
                }
                
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 28px;
                    color: #666;
                    cursor: pointer;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    line-height: 1;
                }
                
                .modal-close:hover {
                    color: #333;
                }
                
                .modal-body {
                    padding: 24px;
                }
                
                .modal-description {
                    font-size: 14px;
                    color: #333;
                    margin-bottom: 20px;
                    line-height: 1.5;
                }
                
                .modal-params {
                    background: #f8f9fa;
                    border: 1px solid #e1e5e9;
                    border-radius: 4px;
                    padding: 16px;
                    margin-bottom: 20px;
                }
                
                .modal-params h4 {
                    margin: 0 0 12px 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #333;
                }
                
                .param-item {
                    margin-bottom: 12px;
                }
                
                .param-item:last-child {
                    margin-bottom: 0;
                }
                
                .param-label {
                    font-size: 12px;
                    font-weight: 600;
                    color: #666;
                    margin-bottom: 4px;
                    display: block;
                }
                
                .param-value {
                    font-size: 14px;
                    color: #333;
                    font-family: 'Monaco', 'Courier New', monospace;
                    background: white;
                    padding: 8px;
                    border-radius: 3px;
                    border: 1px solid #d1d5d9;
                }
                
                /* Corrective Action Description Section */
                .modal-action-description {
                    background: #f0f7ff;
                    border: 1px solid #b3d9ff;
                    border-radius: 4px;
                    padding: 16px;
                    margin-bottom: 20px;
                }
                
                .modal-action-description h4 {
                    margin: 0 0 8px 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #0067C5;
                }
                
                .action-description-text {
                    font-size: 14px;
                    color: #333;
                    line-height: 1.5;
                }
                
                /* Required Values Section */
                .modal-required-values {
                    background: #fff9e6;
                    border: 1px solid #ffcc00;
                    border-radius: 4px;
                    padding: 16px;
                    margin-bottom: 20px;
                }
                
                .modal-required-values h4 {
                    margin: 0 0 12px 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #996600;
                }
                
                .required-values-content {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .required-value-item {
                    display: flex;
                    flex-direction: column;
                }
                
                .required-value-label {
                    font-size: 12px;
                    font-weight: 600;
                    color: #666;
                    margin-bottom: 4px;
                }
                
                .required-value-input {
                    font-size: 14px;
                    padding: 8px 12px;
                    border: 1px solid #d1d5d9;
                    border-radius: 4px;
                    font-family: 'Monaco', 'Courier New', monospace;
                }
                
                .required-value-input:focus {
                    outline: none;
                    border-color: #0067C5;
                    box-shadow: 0 0 0 3px rgba(0, 103, 197, 0.1);
                }
                
                .required-value-input.error {
                    border-color: #dc3545;
                }
                
                /* CLI Command Section */
                .modal-cli {
                    background: #f8f9fa;
                    border: 1px solid #e1e5e9;
                    border-radius: 4px;
                    padding: 16px;
                    margin-bottom: 20px;
                }
                
                .cli-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                
                .modal-cli h4 {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #333;
                }
                
                .cli-copy-button {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: white;
                    border: 1px solid #d1d5d9;
                    border-radius: 3px;
                    color: #333;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .cli-copy-button:hover {
                    background: #f8f9fa;
                    border-color: #0067C5;
                    color: #0067C5;
                }
                
                .cli-copy-button:active {
                    background: #e8f4ff;
                }
                
                .cli-copy-button.copied {
                    background: #e8f5e9;
                    border-color: #4caf50;
                    color: #2e7d32;
                }
                
                .cli-command-box {
                    font-size: 13px;
                    color: #0066cc;
                    font-family: 'Monaco', 'Courier New', monospace;
                    background: #1e1e1e;
                    color: #d4d4d4;
                    padding: 12px;
                    border-radius: 4px;
                    border: 1px solid #333;
                    overflow-x: auto;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                
                .modal-warning {
                    background: #fff3cd;
                    border: 1px solid #ffc107;
                    border-radius: 4px;
                    padding: 12px;
                    font-size: 13px;
                    color: #856404;
                }
                
                .modal-footer {
                    padding: 16px 24px;
                    border-top: 1px solid #e1e5e9;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
                
                .button-primary, .button-secondary {
                    padding: 8px 20px;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }
                
                .button-primary {
                    background: #0067C5;
                    color: white;
                }
                
                .button-primary:hover {
                    background: #0056a3;
                }
                
                .button-secondary {
                    background: white;
                    color: #333;
                    border: 1px solid #d1d5d9;
                }
                
                .button-secondary:hover {
                    background: #f8f9fa;
                }
                
                .modal-progress {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.95);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                }
                
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #e1e5e9;
                    border-top-color: #0067C5;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                #fixItModalProgressText {
                    margin-top: 16px;
                    font-size: 14px;
                    color: #666;
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Show the Fix-It modal with a specific action
     * @param {object} action - The solution object from parsed corrective actions
     * @param {object} alert - The alert object with labels and context
     */
    async show(action, alert) {
        this.currentAction = action;
        this.currentAlert = alert;

        // Build modal title with cluster and volume context
        let title = action.solution_title;
        const clusterName = alert.labels?.cluster;
        
        // Determine source type and name from labels (mirrors AlertsView.renderAlertRow logic)
        let sourceType = '-';
        let sourceName = '-';
        
        if (alert.labels.volume) {
            sourceType = 'Volume';
            sourceName = alert.labels.volume;
        }

        if (clusterName) {
            title += ` (${clusterName}`;
            if (sourceType === 'Volume' && sourceName !== '-') {
                title += ` / ${sourceName}`;
            }
            title += ')';
        }

        // Set modal title
        document.getElementById('fixItModalTitle').textContent = title;

        // Show progress overlay while resolving parameters
        document.getElementById('fixItModalProgress').style.display = 'flex';
        document.getElementById('fixItModalProgressText').textContent = 'Analyzing parameters...';

        try {
            // Resolve parameters
            this.resolvedParams = await this.resolveParameters(action, alert);

            // DEBUG: Log action to see if cli_command is present
            console.log('🔍 Action object:', action);
            console.log('🔍 Has cli_command?', !!action.cli_command);
            console.log('🔍 CLI command:', action.cli_command);
            console.log('🔍 MCP params:', action.mcp_params);
            console.log('🔍 Resolved params:', this.resolvedParams);
            
            // Detect missing parameters that need user input
            console.log('🔍 About to detect missing parameters...');
            this.missingParams = this.detectMissingParameters(action, alert, this.resolvedParams);
            console.log('🔍 Missing params result:', this.missingParams);
            
            // Render action description (from Fix-It button text)
            this.renderActionDescription(action);
            
            // Render required values section if there are missing parameters
            if (this.missingParams.length > 0) {
                this.renderRequiredValues(this.missingParams);
            }
            
            // Render parameters in the modal (hidden but kept for execution)
            this.renderParameters(this.resolvedParams);
            
            // Render CLI command if available
            this.renderCliCommand(action, alert, this.resolvedParams);
            
            // Set up copy button handler
            this.setupCopyButton();

            // Hide progress overlay
            document.getElementById('fixItModalProgress').style.display = 'none';

            // Show the modal
            this.modalElement.style.display = 'flex';
        } catch (error) {
            console.error('❌ Failed to resolve parameters:', error);
            document.getElementById('fixItModalProgress').style.display = 'none';
            this.showError(`Failed to prepare action: ${error.message}`);
        }
    }

    /**
     * Resolve parameters for the action using ParameterResolver
     */
    async resolveParameters(action, alert) {
        const params = {};
        
        // Extract context from alert
        const clusterName = alert.labels?.cluster;
        const volumeName = alert.labels?.volume;
        const svmName = alert.labels?.svm;
        
        console.log('🔍 Resolving parameters for alert:', {
            cluster: clusterName,
            svm: svmName,
            volume: volumeName,
            allLabels: alert.labels
        });
        
        // Always need cluster and volume UUID
        params.cluster_name = clusterName;
        
        // Resolve volume UUID
        if (volumeName && svmName) {
            params.volume_uuid = await this.parameterResolver.resolveVolumeUUID(clusterName, svmName, volumeName);
            params.volume_name = volumeName;
        }
        
        // Merge any params from the action (e.g., state='online')
        if (action.mcp_params) {
            Object.assign(params, action.mcp_params);
        }
        
        // Tool-specific parameter resolution
        switch (action.mcp_tool) {
            case 'cluster_enable_volume_autosize':
                params.mode = 'grow';
                
                // Get current volume size and calculate maximum
                const currentSize = await this.parameterResolver.getCurrentVolumeSize(clusterName, volumeName);
                const suggestedMax = this.parameterResolver.suggestAutosizeMaximum(currentSize, 'double');
                params.maximum_size = this.parameterResolver.formatSize(suggestedMax);
                params.grow_threshold_percent = 85;
                break;
                
            case 'cluster_update_volume':
                // Only fetch size metrics if we're actually resizing (not changing state)
                if (action.solution_title.includes('Size') || action.solution_title.includes('Resize')) {
                    // Determine if this is "set new size" or "add to size"
                    const currentVolumeSize = await this.parameterResolver.getCurrentVolumeSize(clusterName, volumeName);
                    const currentUsedPercent = await this.parameterResolver.getCurrentVolumeUsedPercent(clusterName, volumeName);
                    
                    if (action.solution_title.includes('Set New')) {
                        // Calculate size to bring to ~80% utilization
                        const newSize = this.parameterResolver.suggestNewSize(currentVolumeSize, currentUsedPercent, 'reduce_to_80');
                        params.size = this.parameterResolver.formatSize(newSize);
                    } else {
                        // Add 20% to current size
                        const newSize = this.parameterResolver.suggestNewSize(currentVolumeSize, currentUsedPercent, 'add_20_percent');
                        params.size = this.parameterResolver.formatSize(newSize);
                    }
                }
                // For state changes, the mcp_params already has state='online' or state='offline'
                break;
                
            case 'cluster_delete_volume_snapshot':
                // Find oldest snapshot
                const snapshots = await this.parameterResolver.suggestSnapshotsToDelete(
                    clusterName, 
                    params.volume_uuid, 
                    1
                );
                
                if (snapshots && snapshots.length > 0) {
                    params.snapshot_uuid = snapshots[0].uuid;
                    params.snapshot_name = snapshots[0].name;
                } else {
                    throw new Error('No snapshots found to delete');
                }
                break;
        }
        
        return params;
    }

    /**
     * Detect missing parameters that need user input
     * Scans both MCP tool parameters and CLI command placeholders
     */
    detectMissingParameters(action, alert, resolvedParams) {
        const missing = [];
        const seen = new Set();
        
        // Check MCP tool parameters (from mcp_params)
        if (action.mcp_params) {
            for (const [key, value] of Object.entries(action.mcp_params)) {
                // If value is a placeholder (starts with { and ends with })
                if (typeof value === 'string' && value.match(/^\{[^}]+\}$/)) {
                    const paramName = value.slice(1, -1); // Remove { }
                    
                    // Check if we have this value in resolvedParams
                    if (!resolvedParams[key] && !seen.has(paramName)) {
                        missing.push({
                            key: key,
                            placeholder: paramName,
                            label: this.formatParameterLabel(paramName),
                            description: this.getParameterDescription(paramName, action)
                        });
                        seen.add(paramName);
                    }
                }
            }
        }
        
        // Check CLI command for unresolved placeholders
        if (action.cli_command) {
            const placeholderRegex = /\{([^}]+)\}/g;
            let match;
            
            while ((match = placeholderRegex.exec(action.cli_command)) !== null) {
                const paramName = match[1];
                
                // Check if this parameter is missing and not already in our list
                const hasValue = resolvedParams[paramName] || 
                               resolvedParams[paramName.replace(/_/g, '')] ||
                               alert.labels?.[paramName];
                
                if (!hasValue && !seen.has(paramName)) {
                    missing.push({
                        key: paramName,
                        placeholder: paramName,
                        label: this.formatParameterLabel(paramName),
                        description: this.getParameterDescription(paramName, action)
                    });
                    seen.add(paramName);
                }
            }
        }
        
        console.log('🔍 Missing parameters detected:', missing);
        return missing;
    }

    /**
     * Format parameter name into a human-readable label
     */
    formatParameterLabel(paramName) {
        // Convert snake_case or camelCase to Title Case
        return paramName
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
            .trim();
    }

    /**
     * Get parameter description/help text
     */
    getParameterDescription(paramName, action) {
        const descriptions = {
            'new_size': 'New size for the volume (e.g., 100GB, 1TB)',
            'size': 'Size for the resource (e.g., 100GB, 1TB)',
            'maximum_size': 'Maximum size limit (e.g., 500GB, 2TB)',
            'grow_threshold': 'Percentage full to trigger growth (e.g., 85)',
            'grow_threshold_percent': 'Percentage full to trigger growth (e.g., 85)',
            'mode': 'Autosize mode (off, grow, or grow_shrink)',
            'snapshot': 'Snapshot name to delete',
            'cluster': 'Cluster name',
            'svm': 'SVM name',
            'volume': 'Volume name'
        };
        
        return descriptions[paramName] || '';
    }

    /**
     * Render required values section with input fields
     */
    renderRequiredValues(missingParams) {
        const container = document.getElementById('fixItModalRequiredValues');
        const content = document.getElementById('fixItModalRequiredValuesContent');
        
        if (missingParams.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        let html = '';
        
        for (const param of missingParams) {
            html += `
                <div class="required-value-item">
                    <label class="required-value-label" for="required_${param.key}">
                        ${param.label}:
                    </label>
                    <input 
                        type="text" 
                        id="required_${param.key}" 
                        class="required-value-input" 
                        placeholder="${param.description || 'Enter value'}"
                        data-param-key="${param.key}"
                        data-param-placeholder="${param.placeholder}"
                    />
                </div>
            `;
        }
        
        content.innerHTML = html;
        container.style.display = 'block';
        
        // Add input event listeners to update CLI command preview and validation
        missingParams.forEach(param => {
            const input = document.getElementById(`required_${param.key}`);
            if (input) {
                input.addEventListener('input', () => {
                    this.updateCliCommandPreview();
                    this.validateRequiredValues();
                });
            }
        });
    }

    /**
     * Update CLI command preview with user-supplied values
     */
    updateCliCommandPreview() {
        if (!this.currentAction?.cli_command) return;
        
        const cliCommandBox = document.getElementById('fixItModalCliCommand');
        if (!cliCommandBox) return;
        
        let cliCommand = this.currentAction.cli_command;
        
        // Get values from input fields
        const inputs = document.querySelectorAll('.required-value-input');
        const userValues = {};
        
        inputs.forEach(input => {
            const key = input.dataset.paramKey;
            const placeholder = input.dataset.paramPlaceholder;
            const value = input.value.trim();
            
            if (value) {
                userValues[placeholder] = value;
            }
        });
        
        // Merge with resolved params
        const allValues = {
            '{cluster}': this.currentAlert.labels?.cluster || '<cluster>',
            '{svm}': this.currentAlert.labels?.svm || '<svm>',
            '{volume}': this.currentAlert.labels?.volume || this.resolvedParams.volume_name || '<volume>',
            '{size}': this.resolvedParams.size || userValues['new_size'] || userValues['size'] || '<size>',
            '{new_size}': userValues['new_size'] || userValues['size'] || '<new_size>',
            '{maximum_size}': this.resolvedParams.maximum_size || userValues['maximum_size'] || '<max_size>',
            '{mode}': this.resolvedParams.mode || userValues['mode'] || '<mode>',
            '{snapshot}': this.resolvedParams.snapshot_name || userValues['snapshot'] || '<snapshot>',
            '{grow_threshold}': this.resolvedParams.grow_threshold_percent || userValues['grow_threshold'] || userValues['grow_threshold_percent'] || '<threshold>',
        };
        
        // Replace placeholders
        for (const [placeholder, value] of Object.entries(allValues)) {
            cliCommand = cliCommand.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
        }
        
        cliCommandBox.textContent = cliCommand;
    }

    /**
     * Validate required values and update execute button state
     */
    validateRequiredValues() {
        const inputs = document.querySelectorAll('.required-value-input');
        const executeButton = document.getElementById('fixItModalConfirm');
        let allValid = true;
        
        inputs.forEach(input => {
            const value = input.value.trim();
            
            if (!value) {
                allValid = false;
                input.classList.add('error');
            } else {
                input.classList.remove('error');
            }
        });
        
        // Enable/disable execute button
        if (executeButton) {
            executeButton.disabled = !allValid;
            
            if (!allValid) {
                executeButton.style.opacity = '0.5';
                executeButton.style.cursor = 'not-allowed';
            } else {
                executeButton.style.opacity = '1';
                executeButton.style.cursor = 'pointer';
            }
        }
        
        return allValid;
    }

    /**
     * Render resolved parameters in the modal
     */
    renderParameters(params) {
        const paramsContainer = document.getElementById('fixItModalParams');
        
        let html = '<h4>Action Parameters:</h4>';
        
        for (const [key, value] of Object.entries(params)) {
            // Skip internal params
            if (key.endsWith('_name')) continue;
            
            // Format parameter name
            const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            
            html += `
                <div class="param-item">
                    <span class="param-label">${label}:</span>
                    <div class="param-value">${value}</div>
                </div>
            `;
        }
        
        paramsContainer.innerHTML = html;
    }

    /**
     * Render CLI command with parameter substitution
     */
    renderCliCommand(action, alert, params) {
        const cliContainer = document.getElementById('fixItModalCli');
        const cliCommandBox = document.getElementById('fixItModalCliCommand');
        
        // Check if action has a CLI command
        if (!action.cli_command) {
            cliContainer.style.display = 'none';
            return;
        }
        
        // Substitute placeholders with actual values
        let cliCommand = action.cli_command;
        
        // Build substitution map
        const substitutions = {
            '{cluster}': alert.labels?.cluster || '<cluster>',
            '{svm}': alert.labels?.svm || '<svm>',
            '{volume}': alert.labels?.volume || params.volume_name || '<volume>',
            '{size}': params.size || '<size>',
            '{maximum_size}': params.maximum_size || '<max_size>',
            '{mode}': params.mode || '<mode>',
            '{snapshot}': params.snapshot_name || '<snapshot>',
            '{grow_threshold}': params.grow_threshold_percent || '<threshold>',
        };
        
        // Replace all placeholders
        for (const [placeholder, value] of Object.entries(substitutions)) {
            cliCommand = cliCommand.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
        }
        
        // Show the CLI command
        cliCommandBox.textContent = cliCommand;
        cliContainer.style.display = 'block';
    }

    /**
     * Render corrective action description (from Fix-It button text)
     */
    renderActionDescription(action) {
        const descriptionContainer = document.getElementById('fixItModalActionDescription');
        const descriptionText = document.getElementById('fixItModalActionDescriptionText');
        
        // Use the solution_description (the text above the Fix-It button)
        if (action.solution_description) {
            descriptionText.textContent = action.solution_description;
            descriptionContainer.style.display = 'block';
        } else {
            descriptionContainer.style.display = 'none';
        }
    }

    /**
     * Set up copy button handler for CLI command
     */
    setupCopyButton() {
        const copyButton = document.getElementById('fixItModalCliCopy');
        const cliCommandBox = document.getElementById('fixItModalCliCommand');
        
        if (!copyButton) return;
        
        // Remove any existing event listeners by cloning
        const newCopyButton = copyButton.cloneNode(true);
        copyButton.parentNode.replaceChild(newCopyButton, copyButton);
        
        // Add click handler
        newCopyButton.addEventListener('click', async () => {
            const commandText = cliCommandBox.textContent;
            
            try {
                await navigator.clipboard.writeText(commandText);
                
                // Visual feedback - change button state
                newCopyButton.classList.add('copied');
                const originalHTML = newCopyButton.innerHTML;
                newCopyButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                    </svg>
                    Copied!
                `;
                
                // Reset after 2 seconds
                setTimeout(() => {
                    newCopyButton.classList.remove('copied');
                    newCopyButton.innerHTML = originalHTML;
                }, 2000);
                
            } catch (err) {
                console.error('Failed to copy CLI command:', err);
                
                // Fallback: Select the text
                const range = document.createRange();
                range.selectNode(cliCommandBox);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
            }
        });
    }

    /**
     * Execute the Fix-It action
     */
    async execute() {
        // Validate required values first
        if (this.missingParams && this.missingParams.length > 0) {
            if (!this.validateRequiredValues()) {
                // Show error message
                const inputs = document.querySelectorAll('.required-value-input');
                inputs.forEach(input => {
                    if (!input.value.trim()) {
                        input.classList.add('error');
                    }
                });
                
                this.showToast('Please fill in all required values', 'error');
                return;
            }
        }
        
        // Collect user-supplied values and merge with resolved params
        const finalParams = { ...this.resolvedParams };
        
        if (this.missingParams && this.missingParams.length > 0) {
            const inputs = document.querySelectorAll('.required-value-input');
            
            inputs.forEach(input => {
                const key = input.dataset.paramKey;
                const value = input.value.trim();
                
                if (value) {
                    // Add the value to finalParams using the parameter key
                    finalParams[key] = value;
                    
                    console.log(`✅ User supplied ${key} = ${value}`);
                }
            });
        }
        
        console.log('🔧 Final parameters for execution:', finalParams);
        
        // Show progress overlay
        document.getElementById('fixItModalProgress').style.display = 'flex';
        document.getElementById('fixItModalProgressText').textContent = 'Capturing current state...';
        
        let originalState = null;
        let reversibility = null;
        
        try {
            // PHASE 5.1: Capture current state BEFORE execution
            try {
                originalState = await this.undoManager.captureCurrentState(
                    this.currentAlert,
                    this.currentAction,
                    finalParams  // Use finalParams instead of resolvedParams
                );
                
                // Determine if action is reversible
                reversibility = this.undoManager.determineReversibility(
                    this.currentAction,
                    originalState
                );
                
                console.log('📸 State captured:', originalState);
                console.log('🔍 Reversibility:', reversibility);
            } catch (stateError) {
                console.warn('⚠️ State capture failed, proceeding without undo:', stateError);
                reversibility = {
                    reversible: false,
                    reason: 'Could not capture current state'
                };
            }
            
            // Update progress
            document.getElementById('fixItModalProgressText').textContent = 'Executing action...';
            
            // Call MCP tool with final parameters (including user-supplied values)
            const result = await this.apiClient.callMcp(
                this.currentAction.mcp_tool,
                finalParams  // Use finalParams instead of resolvedParams
            );
            
            console.log('✅ Fix-It action executed successfully:', result);
            
            // Show success message with undo info
            this.showSuccess(result, originalState, reversibility);
            
        } catch (error) {
            console.error('❌ Fix-It action failed:', error);
            this.showError(error.message || 'Action failed');
        }
    }

    /**
     * Show success message and close modal
     */
    showSuccess(result, originalState, reversibility) {
        // Update progress text
        document.getElementById('fixItModalProgressText').innerHTML = 
            '✅ Action completed successfully!';
        
        // PHASE 5.1: Store undo information using UndoManager
        if (reversibility && reversibility.reversible && originalState) {
            try {
                const actionId = crypto.randomUUID();
                const undoAction = this.undoManager.generateUndoAction(
                    this.currentAction,
                    originalState,
                    this.resolvedParams
                );
                
                this.undoManager.storeUndoInfo(
                    actionId,
                    undoAction,
                    originalState,
                    {
                        mcp_tool: this.currentAction.mcp_tool,
                        params: this.resolvedParams,
                        result: result
                    },
                    this.currentAlert,
                    reversibility
                );
                
                console.log('✅ Undo information stored');
            } catch (undoError) {
                console.warn('⚠️ Failed to store undo info:', undoError);
            }
        } else if (reversibility && !reversibility.reversible) {
            console.log(`ℹ️ Action not reversible: ${reversibility.reason}`);
        }
        
        // Close modal after 1 second and re-render alert details
        setTimeout(() => {
            // Capture alert reference before closing
            const alert = this.currentAlert;
            
            this.close();
            
            // Re-render the current alert details to show undo button
            if (typeof alertsView !== 'undefined' && alertsView.currentAlertIdentifier) {
                console.log('🔄 Re-rendering alert details to show undo button...');
                // Find the alert by its identifier (in case array position changed)
                const alertIndex = alertsView.findCurrentAlertIndex();
                if (alertIndex !== undefined) {
                    alertsView.showAlertDetailsByIndex(alertIndex);
                } else {
                    console.warn('⚠️ Could not re-render alert details - alert not found');
                }
            }
            
            // Show toast notification with undo option (pass alert since currentAlert is now null)
            this.showSuccessWithUndo(alert);
        }, 1000);
    }
    
    /**
     * Show success toast with undo option (using UndoManager)
     */
    showSuccessWithUndo(alert) {
        if (!alert) {
            console.warn('⚠️ No alert provided - showing simple success toast');
            this.showToast('Fix-It action completed successfully', 'success');
            return;
        }
        
        const undoInfo = this.undoManager.getUndoInfo(alert.fingerprint);
        
        if (undoInfo) {
            const undoLabel = this.undoManager.generateUndoLabel(undoInfo.undoAction);
            const message = `Fix-It action completed successfully`;
            
            // Show toast with undo button
            this.showToast(message, 'success', {
                undoLabel: undoLabel,
                onUndo: () => this.executeUndo(undoInfo)
            });
        } else {
            this.showToast('Fix-It action completed successfully', 'success');
        }
    }
    
    /**
     * Execute undo action
     */
    async executeUndo(undoInfo) {
        try {
            console.log('⏪ Executing undo:', undoInfo);
            
            // Show progress
            this.showToast('Undoing action...', 'info');
            
            // Execute undo via MCP
            const result = await this.apiClient.callMcp(undoInfo.undoAction.mcp_tool, undoInfo.undoAction.params);
            
            // Clear undo info from UndoManager
            if (this.undoManager && undoInfo.alertFingerprint) {
                this.undoManager.clearUndoInfo(undoInfo.alertFingerprint);
                console.log('🗑️ Cleared undo info for alert fingerprint:', undoInfo.alertFingerprint);
            }
            
            // Show success
            this.showToast('Action undone successfully', 'success');
            
            // Refresh alerts and re-render detail view if visible
            if (typeof alertsView !== 'undefined') {
                if (alertsView.loadAlerts) {
                    await alertsView.loadAlerts();
                }
                // Re-render current alert details to update undo button visibility
                const detailsView = document.getElementById('alertDetailsView');
                if (detailsView && detailsView.style.display !== 'none' && alertsView.currentAlertIdentifier) {
                    // Find the alert by its identifier (in case array position changed)
                    const alertIndex = alertsView.findCurrentAlertIndex();
                    if (alertIndex !== undefined) {
                        // Alert still exists - refresh details
                        alertsView.showAlertDetailsByIndex(alertIndex);
                    } else {
                        // Alert disappeared (likely resolved!) - close details and show success
                        console.log('✅ Alert resolved after undo - closing details view');
                        alertsView.closeAlertDetails();
                        this.showToast('✅ Alert resolved! The undo action fixed the underlying issue.', 'success');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to undo action:', error);
            this.showToast(`Failed to undo: ${error.message}`, 'error');
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        document.getElementById('fixItModalProgress').style.display = 'none';
        
        alert('Error: ' + message);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', options = {}) {
        // Reuse existing toast system if available
        if (window.toastNotifications) {
            window.toastNotifications.showMessage(message, type, options);
        } else {
            console.log(`[Toast] ${type}: ${message}`);
        }
    }

    /**
     * Close the modal
     */
    close() {
        this.modalElement.style.display = 'none';
        this.currentAction = null;
        this.currentAlert = null;
        this.resolvedParams = null;
        this.missingParams = null;
        
        // Clear required values section
        const requiredValuesContainer = document.getElementById('fixItModalRequiredValues');
        if (requiredValuesContainer) {
            requiredValuesContainer.style.display = 'none';
        }
        
        // Reset execute button state
        const executeButton = document.getElementById('fixItModalConfirm');
        if (executeButton) {
            executeButton.disabled = false;
            executeButton.style.opacity = '1';
            executeButton.style.cursor = 'pointer';
        }
        
        // Reset progress overlay
        document.getElementById('fixItModalProgress').style.display = 'none';
    }
}
