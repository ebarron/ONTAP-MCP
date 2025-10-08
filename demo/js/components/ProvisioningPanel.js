// NetApp ONTAP Provisioning Panel Component
// Handles the complete storage provisioning workflow including form creation,
// data loading, and volume/CIFS share creation

class ProvisioningPanel {
    constructor(demo) {
        this.demo = demo;
        this.apiClient = demo.apiClient;
        this.notifications = demo.notifications;
        this.alertRules = new ProvisioningAlertRules(demo);
    }

    // Main entry point to show the provisioning panel
    show() {
        if (!this.demo.selectedCluster) {
            this.notifications.showError('Please select a cluster first');
            return;
        }

        console.log('Showing provisioning panel for cluster:', this.demo.selectedCluster.name);
        // Create or show the right-side expansion panel
        let panel = document.getElementById('provisioningPanel');
        if (!panel) {
            panel = this.createPanel();
            document.body.appendChild(panel);
        }
        
        // Trigger the expansion animation
        panel.classList.add('visible');
        document.body.classList.add('panel-open');
        
        // Load data for the selected cluster
        this.loadData();
    }

    // Create the HTML structure for the provisioning panel
    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'provisioningPanel';
        panel.className = 'right-panel';
        panel.innerHTML = `
            <div class="panel-content">
                <div class="panel-header">
                    <h2>Provision Storage</h2>
                    <button class="panel-close" onclick="app.provisioningPanel.close()">×</button>
                </div>
                <div class="panel-body">
                    <div class="selected-cluster-info">
                        <h3>Selected Cluster: ${this.demo.selectedCluster.name}</h3>
                        <p>IP: ${this.demo.selectedCluster.cluster_ip}</p>
                    </div>
                    
                    <!-- Details Section -->
                    <div class="form-section">
                        <h3>Details</h3>
                        <div class="form-group">
                            <label for="volumeName">Volume Name</label>
                            <input type="text" id="volumeName" name="volumeName" 
                                   placeholder="e.g., my_volume_name (alphanumeric and _ only)" 
                                   pattern="[a-zA-Z0-9_]+" 
                                   title="Only letters, numbers, and underscores allowed"
                                   required>
                        </div>
                        <div class="form-group">
                            <label for="volumeSize">Volume Size</label>
                            <input type="text" id="volumeSize" name="volumeSize" placeholder="e.g., 100GB" required>
                        </div>
                        <div class="form-group checkbox-group">
                            <label>
                                <input type="checkbox" id="monitorCapacity" name="monitorCapacity">
                                Monitor for Capacity issues
                                <span class="alert-preview-icon" id="previewCapacityRules" style="display: none;" title="Preview Alert Rules">
                                    <svg role="img" aria-labelledby="ic_capacity_info" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <desc id="ic_capacity_info">Preview capacity alert rules</desc>
                                        <path fill-rule="evenodd" clip-rule="evenodd" d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM7.01621 7.09091V11.8175C7.04077 12.0615 7.15313 12.2883 7.3324 12.4556C7.51167 12.623 7.74563 12.7195 7.99075 12.7273C8.24007 12.7347 8.48224 12.6434 8.6645 12.4731C8.84677 12.3028 8.95436 12.0674 8.96384 11.8182V7.09091C8.93915 6.84727 8.82692 6.62085 8.64797 6.45367C8.46903 6.28649 8.23551 6.1899 7.99075 6.18182C7.74119 6.17396 7.49864 6.26513 7.31606 6.43545C7.13348 6.60577 7.02569 6.8414 7.01621 7.09091ZM7.22882 3.22861C7.02423 3.4332 6.9093 3.71067 6.9093 4C6.90323 4.14488 6.9273 4.28944 6.97998 4.42454C7.03266 4.55964 7.1128 4.68234 7.21533 4.78487C7.31787 4.88741 7.44057 4.96755 7.57567 5.02023C7.71077 5.07291 7.85533 5.09697 8.00021 5.09091C8.14509 5.09697 8.28965 5.07291 8.42475 5.02023C8.55985 4.96755 8.68255 4.88741 8.78508 4.78487C8.88762 4.68234 8.96776 4.55964 9.02043 4.42454C9.07311 4.28944 9.09718 4.14488 9.09112 4C9.09112 3.71067 8.97618 3.4332 8.7716 3.22861C8.56701 3.02403 8.28953 2.90909 8.00021 2.90909C7.71088 2.90909 7.4334 3.02403 7.22882 3.22861Z"/>
                                    </svg>
                                </span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label for="svmSelect">Storage VM (SVM)</label>
                            <select id="svmSelect" name="svmSelect" required>
                                <option value="">Loading SVMs...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="aggregateSelect">Aggregate</label>
                            <select id="aggregateSelect" name="aggregateSelect" required>
                                <option value="">Select SVM first...</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Performance Section -->
                    <div class="form-section">
                        <h3>Performance</h3>
                        <div class="form-group">
                            <label for="qosPolicy">QoS Policy Group</label>
                            <select id="qosPolicy" name="qosPolicy">
                                <option value="">Loading policies...</option>
                            </select>
                        </div>
                        <div class="form-group checkbox-group">
                            <label>
                                <input type="checkbox" id="monitorPerformance" name="monitorPerformance">
                                Monitor for Performance issues
                                <span class="alert-preview-icon" onclick="event.preventDefault(); app.provisioningPanel.showAlertRulesPreview('performance');" title="Preview Alert Rules">
                                    <svg role="img" aria-labelledby="ic_perf_info" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <desc id="ic_perf_info">Preview performance alert rules</desc>
                                        <path fill-rule="evenodd" clip-rule="evenodd" d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM7.01621 7.09091V11.8175C7.04077 12.0615 7.15313 12.2883 7.3324 12.4556C7.51167 12.623 7.74563 12.7195 7.99075 12.7273C8.24007 12.7347 8.48224 12.6434 8.6645 12.4731C8.84677 12.3028 8.95436 12.0674 8.96384 11.8182V7.09091C8.93915 6.84727 8.82692 6.62085 8.64797 6.45367C8.46903 6.28649 8.23551 6.1899 7.99075 6.18182C7.74119 6.17396 7.49864 6.26513 7.31606 6.43545C7.13348 6.60577 7.02569 6.8414 7.01621 7.09091ZM7.22882 3.22861C7.02423 3.4332 6.9093 3.71067 6.9093 4C6.90323 4.14488 6.9273 4.28944 6.97998 4.42454C7.03266 4.55964 7.1128 4.68234 7.21533 4.78487C7.31787 4.88741 7.44057 4.96755 7.57567 5.02023C7.71077 5.07291 7.85533 5.09697 8.00021 5.09091C8.14509 5.09697 8.28965 5.07291 8.42475 5.02023C8.55985 4.96755 8.68255 4.88741 8.78508 4.78487C8.88762 4.68234 8.96776 4.55964 9.02043 4.42454C9.07311 4.28944 9.09718 4.14488 9.09112 4C9.09112 3.71067 8.97618 3.4332 8.7716 3.22861C8.56701 3.02403 8.28953 2.90909 8.00021 2.90909C7.71088 2.90909 7.4334 3.02403 7.22882 3.22861Z"/>
                                    </svg>
                                </span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Protection Section -->
                    <div class="form-section">
                        <h3>Protection</h3>
                        <div class="form-group">
                            <label for="snapshotPolicy">Snapshot Policy</label>
                            <select id="snapshotPolicy" name="snapshotPolicy">
                                <option value="">Loading policies...</option>
                            </select>
                        </div>
                        <div class="form-group checkbox-group">
                            <label>
                                <input type="checkbox" id="monitorDataProtection" name="monitorDataProtection">
                                Monitor for Data Protection issues
                                <span class="alert-preview-icon" onclick="event.preventDefault(); app.provisioningPanel.showAlertRulesPreview('dataprotection');" title="Preview Alert Rules">
                                    <svg role="img" aria-labelledby="ic_dataprotection_info" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <desc id="ic_dataprotection_info">Preview data protection alert rules</desc>
                                        <path fill-rule="evenodd" clip-rule="evenodd" d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM7.01621 7.09091V11.8175C7.04077 12.0615 7.15313 12.2883 7.3324 12.4556C7.51167 12.623 7.74563 12.7195 7.99075 12.7273C8.24007 12.7347 8.48224 12.6434 8.6645 12.4731C8.84677 12.3028 8.95436 12.0674 8.96384 11.8182V7.09091C8.93915 6.84727 8.82692 6.62085 8.64797 6.45367C8.46903 6.28649 8.23551 6.1899 7.99075 6.18182C7.74119 6.17396 7.49864 6.26513 7.31606 6.43545C7.13348 6.60577 7.02569 6.8414 7.01621 7.09091ZM7.22882 3.22861C7.02423 3.4332 6.9093 3.71067 6.9093 4C6.90323 4.14488 6.9273 4.28944 6.97998 4.42454C7.03266 4.55964 7.1128 4.68234 7.21533 4.78487C7.31787 4.88741 7.44057 4.96755 7.57567 5.02023C7.71077 5.07291 7.85533 5.09697 8.00021 5.09091C8.14509 5.09697 8.28965 5.07291 8.42475 5.02023C8.55985 4.96755 8.68255 4.88741 8.78508 4.78487C8.88762 4.68234 8.96776 4.55964 9.02043 4.42454C9.07311 4.28944 9.09718 4.14488 9.09112 4C9.09112 3.71067 8.97618 3.4332 8.7716 3.22861C8.56701 3.02403 8.28953 2.90909 8.00021 2.90909C7.71088 2.90909 7.4334 3.02403 7.22882 3.22861Z"/>
                                    </svg>
                                </span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Protocol Section -->
                    <div class="form-section">
                        <h3>Protocol</h3>
                        <div class="form-group">
                            <label>Access Protocol</label>
                            <div class="radio-group">
                                <label>
                                    <input type="radio" name="protocol" id="protocolNfs" value="nfs" checked onchange="app.provisioningPanel.handleProtocolChange()">
                                    NFS
                                </label>
                                <label>
                                    <input type="radio" name="protocol" id="protocolCifs" value="cifs" onchange="app.provisioningPanel.handleProtocolChange()">
                                    CIFS/SMB
                                </label>
                            </div>
                        </div>
                        
                        <div id="nfsOptions" class="protocol-options">
                            <div class="form-group">
                                <label for="exportPolicy">Export Policy</label>
                                <select id="exportPolicy" name="exportPolicy">
                                    <option value="">Loading policies...</option>
                                </select>
                            </div>
                        </div>
                        
                        <div id="cifsOptions" class="protocol-options" style="display: none;">
                            <div class="form-group">
                                <label for="cifsShareName">CIFS Share Name</label>
                                <input type="text" id="cifsShareName" name="cifsShareName">
                            </div>
                            <div class="form-group">
                                <label for="shareComment">Share Comment (Optional)</label>
                                <input type="text" id="shareComment" name="shareComment">
                            </div>
                            <div class="form-group">
                                <label for="cifsUsers">Users/Groups</label>
                                <input type="text" id="cifsUsers" name="cifsUsers" value="Everyone" placeholder="e.g., Everyone, DOMAIN\\username">
                            </div>
                            <div class="form-group">
                                <label for="cifsPermissions">Permissions</label>
                                <select id="cifsPermissions" name="cifsPermissions">
                                    <option value="full_control" selected>Full Control</option>
                                    <option value="change">Change</option>
                                    <option value="read">Read</option>
                                    <option value="no_access">No Access</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="app.provisioningPanel.close()">Cancel</button>
                        <button type="button" class="btn-primary" onclick="app.provisioningPanel.handleProvisioning()">Create Volume</button>
                    </div>
                </div>
            </div>
        `;
        return panel;
    }

    // Close the provisioning panel
    close() {
        const panel = document.getElementById('provisioningPanel');
        if (panel) {
            panel.classList.remove('visible');
            document.body.classList.remove('panel-open');
            setTimeout(() => {
                if (panel.parentNode) {
                    panel.parentNode.removeChild(panel);
                }
            }, 300);
        }
    }

    // Load all data needed for provisioning (SVMs, policies, etc.)
    async loadData() {
        // Show loading states
        this.setDropdownLoading('svmSelect', 'Loading SVMs...');
        this.setDropdownLoading('qosPolicy', 'Loading policies...');
        this.setDropdownLoading('snapshotPolicy', 'Loading policies...');
        this.setDropdownLoading('exportPolicy', 'Select SVM first...');

        // Load SVMs first
        // QoS policies, export policies and snapshot policies will be loaded when user selects an SVM
        try {
            await this.loadSvms();
            
            // Load admin QoS policies (available across all SVMs)
            await this.loadAdminQosPolicies();
            
            // Set export policy to disabled state until SVM is selected
            const exportSelect = document.getElementById('exportPolicy');
            exportSelect.innerHTML = '<option value="">Select SVM first</option>';
            exportSelect.disabled = true;
            this.setDropdownReady('exportPolicy');
            
            // Set snapshot policy to disabled state until SVM is selected
            const snapshotSelect = document.getElementById('snapshotPolicy');
            snapshotSelect.innerHTML = '<option value="">Select SVM first</option>';
            snapshotSelect.disabled = true;
            this.setDropdownReady('snapshotPolicy');
            
            // Setup event handlers for monitoring checkboxes
            this.setupMonitoringEventHandlers();
        } catch (error) {
            console.error('Error loading provisioning data:', error);
        }
    }

    // Setup event handlers for monitoring checkboxes and preview links
    setupMonitoringEventHandlers() {
        // Capacity monitoring checkbox
        const capacityCheckbox = document.getElementById('monitorCapacity');
        const capacityPreviewLink = document.getElementById('previewCapacityRules');
        
        if (capacityCheckbox && capacityPreviewLink) {
            capacityCheckbox.addEventListener('change', (e) => {
                capacityPreviewLink.style.display = e.target.checked ? 'inline' : 'none';
            });
            
            capacityPreviewLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAlertRulesPreview('capacity');
            });
        }
    }

    // Load SVMs for the selected cluster
    async loadSvms() {
        try {
            const response = await this.apiClient.callMcp('cluster_list_svms', {
                cluster_name: this.demo.selectedCluster.name
            });

            const svmSelect = document.getElementById('svmSelect');
            
            // Response is now text from Streamable HTTP client
            if (response && typeof response === 'string') {
                // Parse text response - look for data SVMs specifically
                const svms = [];
                const lines = response.split('\n');
                for (const line of lines) {
                    // Look for lines that start with "- " and contain SVM info
                    // Format: "- vs123 (uuid) - State: running" or "- svm143 (uuid) - State: running"
                    const svmMatch = line.match(/^-\s+([^\s(]+)\s*\(/);
                    if (svmMatch) {
                        const svmName = svmMatch[1];
                        if (svmName && svmName !== 'Name:') {
                            svms.push({ name: svmName });
                        }
                    }
                }

                if (svms.length > 0) {
                    svmSelect.innerHTML = '<option value="">Select SVM...</option>' + 
                        svms.map(svm => 
                            `<option value="${svm.name || svm}">${svm.name || svm}</option>`
                        ).join('');
                        
                    // Remove any existing event listeners and add new one
                    const newSvmSelect = svmSelect.cloneNode(true);
                    svmSelect.parentNode.replaceChild(newSvmSelect, svmSelect);
                    
                    // Add event listener to load export policies and snapshot policies when SVM is selected
                    newSvmSelect.addEventListener('change', () => {
                        if (newSvmSelect.value) {
                            this.loadExportPolicies();
                            this.loadSnapshotPoliciesForSvm(newSvmSelect.value);
                            this.loadAggregatesForSvm(newSvmSelect.value);
                            this.loadQosPoliciesForSvm(newSvmSelect.value);
                        } else {
                            // Reset export policy dropdown
                            const exportSelect = document.getElementById('exportPolicy');
                            exportSelect.innerHTML = '<option value="">Select SVM first</option>';
                            exportSelect.disabled = true;
                            
                            // Reset snapshot policy dropdown
                            const snapshotSelect = document.getElementById('snapshotPolicy');
                            snapshotSelect.innerHTML = '<option value="">Select SVM first</option>';
                            snapshotSelect.disabled = true;
                            
                            // Reset aggregate dropdown
                            const aggregateSelect = document.getElementById('aggregateSelect');
                            aggregateSelect.innerHTML = '<option value="">Select SVM first</option>';
                            aggregateSelect.disabled = true;
                            
                            // Reset QoS policy dropdown to admin policies only
                            this.loadAdminQosPolicies();
                        }
                    });
                } else {
                    svmSelect.innerHTML = '<option value="">No data SVMs found</option>';
                }
                this.setDropdownReady('svmSelect');
            } else {
                svmSelect.innerHTML = '<option value="">Error loading SVMs</option>';
                this.setDropdownReady('svmSelect');
            }
        } catch (error) {
            console.error('Error loading SVMs:', error);
            const svmSelect = document.getElementById('svmSelect');
            svmSelect.innerHTML = '<option value="">Error loading SVMs</option>';
            this.setDropdownReady('svmSelect');
        }
    }

    // Load snapshot policies for a specific SVM
    async loadSnapshotPoliciesForSvm(svmName) {
        try {
            const policySelect = document.getElementById('snapshotPolicy');
            this.setDropdownLoading('snapshotPolicy', 'Loading snapshot policies...');
            
            // Call the real MCP API to get actual snapshot policies from the cluster
            console.log('Loading snapshot policies from cluster:', this.demo.selectedCluster.name);
            const response = await this.apiClient.callMcp('list_snapshot_policies', {
                cluster_name: this.demo.selectedCluster.name
                // Note: snapshot policies are cluster-wide, not SVM-specific
            });

            // Parse the response to extract policy names
            let policyOptions = [];
            
            // Response is now text from Streamable HTTP client
            const responseText = (response && typeof response === 'string') ? response : '';
            
            if (responseText) {
                // Parse the formatted response to extract policy names
                const lines = responseText.split('\n');
                
                // Extract policy names from format: **1. policy-name**
                const policyMatches = responseText.match(/\*\*\d+\.\s+([^*\n]+)\*\*/g);
                
                if (policyMatches && policyMatches.length > 0) {
                    policyOptions = policyMatches.map(match => {
                        const name = match.replace(/\*\*\d+\.\s+/, '').replace(/\*\*/, '').trim();
                        return { name: name };
                    });
                    console.log('Loaded snapshot policies:', policyOptions.map(p => p.name));
                } else {
                    console.warn('Could not parse snapshot policies from response');
                    // Fallback to default policies
                    policyOptions = [{ name: 'default' }, { name: 'none' }];
                }
            } else {
                console.warn('No snapshot policy data received');
                // Fallback to default policies
                policyOptions = [{ name: 'default' }, { name: 'none' }];
            }

            // Populate the dropdown with actual policies from the cluster
            policySelect.innerHTML = '<option value="">Select snapshot policy...</option>' + 
                policyOptions.map(policy => 
                    `<option value="${policy.name}">${policy.name}</option>`
                ).join('');
            policySelect.disabled = false;
            
            this.setDropdownReady('snapshotPolicy');
            console.log('Snapshot policies loaded successfully:', policyOptions.length, 'policies');

        } catch (error) {
            console.error('Error loading snapshot policies for SVM:', error);
            const policySelect = document.getElementById('snapshotPolicy');
            policySelect.innerHTML = '<option value="">Error loading policies</option><option value="default">default</option>';
            policySelect.disabled = false;
            this.setDropdownReady('snapshotPolicy');
        }
    }

    // Load aggregates for a specific SVM
    async loadAggregatesForSvm(svmName) {
        try {
            this.setDropdownLoading('aggregateSelect', 'Loading aggregates...');
            
            const response = await this.apiClient.callMcp('cluster_list_aggregates', {
                cluster_name: this.demo.selectedCluster.name
            });

            const aggregateSelect = document.getElementById('aggregateSelect');
            aggregateSelect.disabled = false;
            
            // Response is now text from Streamable HTTP client
            if (response && typeof response === 'string') {
                let aggregates = [];
                
                // Parse text response for aggregates
                const lines = response.split('\n');
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

                if (aggregates.length > 0) {
                    aggregateSelect.innerHTML = '<option value="">Select aggregate...</option>' +
                        aggregates.map(aggregate => 
                            `<option value="${aggregate.name}">${aggregate.name}</option>`
                        ).join('');
                } else {
                    aggregateSelect.innerHTML = '<option value="">No aggregates found</option>';
                }
            } else {
                aggregateSelect.innerHTML = '<option value="">Error loading aggregates</option>';
            }
            
            this.setDropdownReady('aggregateSelect');
        } catch (error) {
            console.error('Error loading aggregates for SVM:', error);
            const aggregateSelect = document.getElementById('aggregateSelect');
            aggregateSelect.innerHTML = '<option value="">Error loading aggregates</option>';
            aggregateSelect.disabled = false;
            this.setDropdownReady('aggregateSelect');
        }
    }

    // Load export policies for the selected SVM
    async loadExportPolicies() {
        try {
            const svmSelect = document.getElementById('svmSelect');
            const selectedSvm = svmSelect ? svmSelect.value : null;
            
            if (!selectedSvm) {
                const exportSelect = document.getElementById('exportPolicy');
                exportSelect.innerHTML = '<option value="">Select SVM first</option>';
                return;
            }
            
            // Use the actual export policy API
            const result = await this.apiClient.callMcp('list_export_policies', {
                cluster_name: this.demo.selectedCluster.name,
                svm_name: selectedSvm
            });

            const exportSelect = document.getElementById('exportPolicy');
            
            // Response is now text from Streamable HTTP client
            if (result && typeof result === 'string') {
                // Parse export policies from response
                const policies = [];
                const lines = result.split('\n');
                
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
                
                if (policies.length > 0) {
                    exportSelect.innerHTML = '<option value="">Select export policy...</option>' +
                        '<option value="NEW_EXPORT_POLICY" style="font-weight: bold; color: #0067C5;">+ New Export Policy</option>' +
                        policies.map(policy => 
                            `<option value="${policy.name}">${policy.name}</option>`
                        ).join('');
                } else {
                    exportSelect.innerHTML = '<option value="">No export policies found</option>' +
                        '<option value="NEW_EXPORT_POLICY" style="font-weight: bold; color: #0067C5;">+ New Export Policy</option>';
                }
            } else {
                // Fallback with default policies
                exportSelect.innerHTML = '<option value="">Select export policy...</option>' +
                    '<option value="NEW_EXPORT_POLICY" style="font-weight: bold; color: #0067C5;">+ New Export Policy</option>' +
                    '<option value="default">default</option>';
            }
            this.setDropdownReady('exportPolicy');

        } catch (error) {
            console.error('Error loading export policies:', error);
            const exportSelect = document.getElementById('exportPolicy');
            exportSelect.innerHTML = '<option value="default">default</option>';
            this.setDropdownReady('exportPolicy');
        }
    }

    // Handle protocol change (NFS vs CIFS)
    handleProtocolChange() {
        const protocol = document.querySelector('input[name="protocol"]:checked').value;
        const nfsOptions = document.getElementById('nfsOptions');
        const cifsOptions = document.getElementById('cifsOptions');
        
        if (protocol === 'nfs') {
            nfsOptions.style.display = 'block';
            cifsOptions.style.display = 'none';
        } else {
            nfsOptions.style.display = 'none';
            cifsOptions.style.display = 'block';
        }
    }

    // Handle the main provisioning workflow
    async handleProvisioning() {
        try {
            const protocol = document.querySelector('input[name="protocol"]:checked').value;
            let volumeName = document.getElementById('volumeName').value;
            const volumeSize = document.getElementById('volumeSize').value;
            const svmName = document.getElementById('svmSelect').value;
            const aggregateName = document.getElementById('aggregateSelect').value;

            if (!volumeName || !volumeSize || !svmName || !aggregateName) {
                this.notifications.showError('Please fill in all required fields including aggregate');
                return;
            }

            // Sanitize volume name: ONTAP only allows alphanumeric and underscores
            const originalVolumeName = volumeName;
            volumeName = volumeName.replace(/[^a-zA-Z0-9_]/g, '_');
            
            if (originalVolumeName !== volumeName) {
                console.log(`Volume name sanitized: "${originalVolumeName}" -> "${volumeName}"`);
                this.notifications.showInfo(`Volume name adjusted to comply with ONTAP naming rules: "${volumeName}"`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Show message briefly
            }

            this.notifications.showInfo('Creating volume...');

            if (protocol === 'nfs') {
                await this.createNfsVolume(volumeName, volumeSize, svmName, aggregateName);
            } else {
                await this.createCifsVolume(volumeName, volumeSize, svmName, aggregateName);
            }

            // Create monitoring alerts if checkbox is enabled
            await this.createMonitoringAlerts(volumeName, svmName);

        } catch (error) {
            this.notifications.showError('Provisioning failed: ' + error.message);
        }
    }

    // Create NFS volume
    async createNfsVolume(volumeName, volumeSize, svmName, aggregateName) {
        const qosPolicy = document.getElementById('qosPolicy').value;
        
        const volumeParams = {
            cluster_name: this.demo.selectedCluster.name,
            svm_name: svmName,
            volume_name: volumeName,
            size: volumeSize,
            aggregate_name: aggregateName
        };
        
        // Add QoS policy if selected
        if (qosPolicy) {
            volumeParams.qos_policy = qosPolicy;
        }

        const response = await this.apiClient.callMcp('cluster_create_volume', volumeParams);

        // 🔍 DIAGNOSTIC LOGGING
        console.log('🔍 VOLUME CREATION RESPONSE (ProvisioningPanel):');
        console.log('  Type:', typeof response);
        console.log('  Length:', response?.length);
        console.log('  Full response:', response);
        console.log('  Includes "successfully"?', response?.includes('successfully'));
        console.log('  Includes "Error"?', response?.includes('Error'));
        console.log('  Includes "❌"?', response?.includes('❌'));

        // Response is now text from Streamable HTTP client
        if (response && typeof response === 'string' && response.includes('successfully')) {
            this.notifications.showSuccess(`NFS volume ${volumeName} created successfully${qosPolicy ? ` with QoS policy ${qosPolicy}` : ''}`);
            this.close();
        } else {
            throw new Error(typeof response === 'string' ? response : 'Failed to create volume');
        }
    }

    // Create CIFS volume with share
    async createCifsVolume(volumeName, volumeSize, svmName, aggregateName) {
        const shareName = document.getElementById('cifsShareName').value;
        const shareComment = document.getElementById('shareComment').value;
        const cifsUsers = document.getElementById('cifsUsers').value;
        const cifsPermissions = document.getElementById('cifsPermissions').value;
        const qosPolicy = document.getElementById('qosPolicy').value;

        if (!shareName) {
            throw new Error('CIFS share name is required');
        }

        if (!cifsUsers) {
            throw new Error('Users/Groups field is required');
        }

        const cifsShare = {
            share_name: shareName,
            comment: shareComment || undefined,
            access_control: [
                {
                    permission: cifsPermissions,
                    user_or_group: cifsUsers,
                    type: 'windows'
                }
            ]
        };

        const volumeParams = {
            cluster_name: this.demo.selectedCluster.name,
            svm_name: svmName,
            volume_name: volumeName,
            size: volumeSize,
            aggregate_name: aggregateName,
            cifs_share: cifsShare
        };
        
        // Add QoS policy if selected
        if (qosPolicy) {
            volumeParams.qos_policy = qosPolicy;
        }

        const response = await this.apiClient.callMcp('cluster_create_volume', volumeParams);

        // Response is now text from Streamable HTTP client
        if (response && typeof response === 'string' && response.includes('successfully')) {
            this.notifications.showSuccess(`CIFS volume ${volumeName} with share ${shareName} created successfully${qosPolicy ? ` with QoS policy ${qosPolicy}` : ''}`);
            this.close();
        } else {
            throw new Error(typeof response === 'string' ? response : 'Failed to create volume');
        }
    }

    // Create monitoring alerts in Harvest if checkbox is enabled
    async createMonitoringAlerts(volumeName, svmName) {
        const monitorCapacity = document.getElementById('monitorCapacity').checked;
        const monitorPerformance = document.getElementById('monitorPerformance').checked;
        const monitorDataProtection = document.getElementById('monitorDataProtection').checked;
        
        if (!monitorCapacity && !monitorPerformance && !monitorDataProtection) {
            return; // No monitoring requested
        }

        try {
            const clusterName = this.demo.selectedCluster.name;
            let allAlerts = [];
            
            // Generate capacity alerts if enabled
            if (monitorCapacity) {
                const capacityAlerts = this.alertRules.generateCapacityAlertRules(volumeName, svmName, clusterName);
                allAlerts.push(...capacityAlerts);
            }
            
            // Generate performance alerts if enabled
            if (monitorPerformance) {
                const qosPolicyName = document.getElementById('qosPolicy').value;
                if (qosPolicyName) {
                    const performanceAlerts = await this.alertRules.generatePerformanceAlertRules(volumeName, svmName, clusterName, qosPolicyName);
                    allAlerts.push(...performanceAlerts);
                }
            }
            
            // Generate data protection alerts if enabled
            if (monitorDataProtection) {
                const snapshotPolicySelect = document.getElementById('snapshotPolicy');
                if (!snapshotPolicySelect) {
                    console.warn('Snapshot policy select element not found - skipping data protection alerts');
                } else {
                    const snapshotPolicyName = snapshotPolicySelect.value;
                    if (snapshotPolicyName && snapshotPolicyName !== 'none') {
                        const dataProtectionAlerts = await this.alertRules.generateDataProtectionAlertRules(volumeName, svmName, clusterName, snapshotPolicyName);
                        allAlerts.push(...dataProtectionAlerts);
                    }
                }
            }
            
            if (allAlerts.length === 0) {
                return; // No alerts to create
            }
            
            this.notifications.showInfo('Creating monitoring alerts...');
            
            // Create alerts using centralized method
            const results = await this.alertRules.createMonitoringAlerts(allAlerts);
            
            if (results.success) {
                this.notifications.showSuccess(`Volume created with ${results.count} monitoring alert(s)`);
            } else {
                this.notifications.showWarning(`Volume created with ${results.count}/${allAlerts.length} alerts (${results.failed} failed)`);
            }
        } catch (error) {
            console.error('Failed to create monitoring alerts:', error);
            this.notifications.showWarning('Volume created but some alerts may have failed');
        }
    }

    // Load admin QoS policies (available across all SVMs)
    async loadAdminQosPolicies() {
        try {
            const response = await this.apiClient.callMcp('cluster_list_qos_policies', {
                cluster_name: this.demo.selectedCluster.name
                // Don't specify svm_name to get all policies including admin ones
            });

            const qosSelect = document.getElementById('qosPolicy');
            let policies = [];

            // Response is now text from Streamable HTTP client
            // Response is now text from Streamable HTTP client
            if (response && typeof response === 'string') {
                // Parse text response to extract policy names
                const lines = response.split('\n');
                for (const line of lines) {
                    // Look for lines with policy names, format: "🎛️ **policy_name** (uuid)"
                    const policyMatch = line.match(/🎛️\s+\*\*([^*]+)\*\*\s+\(/);
                    if (policyMatch) {
                        const policyName = policyMatch[1].trim();
                        if (policyName && policyName !== 'Unknown') {
                            // Extract SVM info if available
                            const svmMatch = line.match(/SVM:\s+([^\s\n]+)/);
                            const policySvm = svmMatch ? svmMatch[1] : 'cluster';
                            policies.push({ name: policyName, svm: policySvm });
                        }
                    }
                }
            }

            // Build dropdown options
            let options = '<option value="">No QoS Policy (Default)</option>';
            if (policies.length > 0) {
                // Group policies by type for better organization
                const adminPolicies = policies.filter(p => p.svm !== this.demo.selectedCluster.name && p.svm !== 'cluster');
                const clusterPolicies = policies.filter(p => p.svm === this.demo.selectedCluster.name || p.svm === 'cluster');
                
                if (clusterPolicies.length > 0) {
                    options += clusterPolicies.map(policy => 
                        `<option value="${policy.name}">${policy.name}</option>`
                    ).join('');
                }
                
                if (adminPolicies.length > 0) {
                    options += adminPolicies.map(policy => 
                        `<option value="${policy.name}">${policy.name} (${policy.svm})</option>`
                    ).join('');
                }
            }
            
            qosSelect.innerHTML = options;
            this.setDropdownReady('qosPolicy');
        } catch (error) {
            console.error('Error loading admin QoS policies:', error);
            const qosSelect = document.getElementById('qosPolicy');
            qosSelect.innerHTML = '<option value="">No QoS Policy (Default)</option>';
            this.setDropdownReady('qosPolicy');
        }
    }

    // Load QoS policies for a specific SVM and combine with cluster-wide policies
    async loadQosPoliciesForSvm(svmName) {
        try {
            // Load both cluster-wide policies and SVM-specific policies
            const [clusterResponse, svmResponse] = await Promise.all([
                this.apiClient.callMcp('cluster_list_qos_policies', {
                    cluster_name: this.demo.selectedCluster.name
                    // No svm_name filter to get all policies
                }),
                this.apiClient.callMcp('cluster_list_qos_policies', {
                    cluster_name: this.demo.selectedCluster.name,
                    svm_name: svmName
                })
            ]);

            const qosSelect = document.getElementById('qosPolicy');
            let allPolicies = [];

            // Parse cluster-wide policies (including admin policies)
            // Response is now text from Streamable HTTP client
            if (clusterResponse && typeof clusterResponse === 'string') {
                const lines = clusterResponse.split('\n');
                for (const line of lines) {
                    const policyMatch = line.match(/🎛️\s+\*\*([^*]+)\*\*\s+\(/);
                    if (policyMatch) {
                        const policyName = policyMatch[1].trim();
                        if (policyName && policyName !== 'Unknown') {
                            // Try to determine SVM from the line context, default to 'cluster'
                            const svmMatch = line.match(/SVM:\s+([^\s\n]+)/);
                            const policySvm = svmMatch ? svmMatch[1] : 'cluster';
                            allPolicies.push({ name: policyName, svm: policySvm });
                        }
                    }
                }
            }

            // Build dropdown options - avoid duplicates
            const uniquePolicies = [];
            const seenPolicies = new Set();
            
            allPolicies.forEach(policy => {
                if (!seenPolicies.has(policy.name)) {
                    seenPolicies.add(policy.name);
                    uniquePolicies.push(policy);
                }
            });

            let options = '<option value="">No QoS Policy (Default)</option>';
            
            if (uniquePolicies.length > 0) {
                options += uniquePolicies.map(policy => 
                    `<option value="${policy.name}">${policy.name}${policy.svm && policy.svm !== 'cluster' ? ` (${policy.svm})` : ''}</option>`
                ).join('');
            }
            
            qosSelect.innerHTML = options;
            this.setDropdownReady('qosPolicy');
        } catch (error) {
            console.error('Error loading QoS policies for SVM:', error);
            // Fall back to cluster-wide policies only
            this.loadAdminQosPolicies();
        }
    }

    // Generate capacity-specific alert rules for a volume
    generateCapacityAlertRules(volumeName, clusterName, svmName) {
        return [
            {
                alert: `${clusterName}_${svmName}_${volumeName}_capacity_breach`,
                expr: `volume_size_used_percent{volume="${volumeName}",cluster="${clusterName}",svm="${svmName}"} > 90`,
                for: '5m',
                labels: { severity: 'critical' },
                annotations: {
                    summary: `Volume [${volumeName}] on ${clusterName}/${svmName} capacity usage critical`,
                    description: `Volume [${volumeName}] on cluster ${clusterName}, SVM ${svmName} is using {{$value}}% of its capacity (threshold: 90%)`
                }
            },
            {
                alert: `${clusterName}_${svmName}_${volumeName}_offline`,
                expr: `volume_labels{volume="${volumeName}",cluster="${clusterName}",svm="${svmName}",state="offline"} == 1`,
                for: '5m',
                labels: { severity: 'critical' },
                annotations: {
                    summary: `Volume [${volumeName}] on ${clusterName}/${svmName} is offline`,
                    description: `Volume [${volumeName}] on cluster ${clusterName}, SVM ${svmName} has gone offline and is not accessible`
                }
            }
        ];
    }

    // Generate performance alert rules for QoS monitoring
    async generatePerformanceAlertRules(volumeName, svmName, clusterName, qosPolicyName) {
        try {
            // Fetch QoS policy details to get max throughput
            const policyDetails = await this.getQosPolicyDetails(qosPolicyName, svmName);
            
            if (!policyDetails || !policyDetails.maxThroughput) {
                console.warn('Could not retrieve QoS policy max throughput, skipping performance alerts');
                return [];
            }

            const maxThroughputValue = policyDetails.maxThroughput;
            const alerts = [];

            // Alert for QoS limit reached (95% of max throughput + high latency)
            alerts.push({
                alert: `${clusterName}_${svmName}_${volumeName}_qos_limit_reached`,
                expr: `(avg_over_time(qos_volume_iops{volume="${volumeName}",cluster="${clusterName}",svm="${svmName}"}[5m]) / ${maxThroughputValue}) > 0.95 and avg_over_time(qos_volume_latency{volume="${volumeName}",cluster="${clusterName}",svm="${svmName}"}[5m]) > 10`,
                for: '5m',
                labels: { severity: 'warning' },
                annotations: {
                    summary: `Volume [${volumeName}] on ${clusterName}/${svmName} approaching QoS limit`,
                    description: `Volume [${volumeName}] on cluster ${clusterName}, SVM ${svmName} is being rate-limited by QoS policy [${qosPolicyName}]. IOPS at {{$value | humanizePercentage}} of max (${maxThroughputValue}) with elevated latency.`
                }
            });

            return alerts;
        } catch (error) {
            console.error('Error generating performance alert rules:', error);
            return [];
        }
    }

    // Generate data protection alert rules for snapshot monitoring
    async generateDataProtectionAlertRules(volumeName, svmName, clusterName, snapshotPolicyName) {
        try {
            const alerts = [];

            // Alert 1: Snapshot space usage > 90%
            alerts.push({
                alert: `${clusterName}_${svmName}_${volumeName}_snapshot_space_low`,
                expr: `volume_snapshot_reserve_percent{volume="${volumeName}",cluster="${clusterName}",svm="${svmName}"} > 90`,
                for: '5m',
                labels: { severity: 'warning' },
                annotations: {
                    summary: `Volume [${volumeName}] on ${clusterName}/${svmName} snapshot space running low`,
                    description: `Volume [${volumeName}] on cluster ${clusterName}, SVM ${svmName} is using {{$value}}% of snapshot reserve space (threshold: 90%)`
                }
            });

            // Alert 2: Snapshot creation failures (EMS event)
            alerts.push({
                alert: `${clusterName}_${svmName}_${volumeName}_snapshot_create_fail`,
                expr: `increase(ems_events{event="wafl.snap.create.fail",volume="${volumeName}",cluster="${clusterName}",svm="${svmName}"}[5m]) > 0`,
                for: '1m',
                labels: { severity: 'critical' },
                annotations: {
                    summary: `Snapshot creation failed for volume [${volumeName}] on ${clusterName}/${svmName}`,
                    description: `Snapshot creation has failed for volume [${volumeName}] on cluster ${clusterName}, SVM ${svmName}. Check EMS logs for details (possible causes: full volume, quota issues).`
                }
            });

            // Alert 3: Snapshot deletion failures (EMS event)
            alerts.push({
                alert: `${clusterName}_${svmName}_${volumeName}_snapshot_delete_fail`,
                expr: `increase(ems_events{event="wafl.snap.delete.fail",volume="${volumeName}",cluster="${clusterName}",svm="${svmName}"}[5m]) > 0`,
                for: '1m',
                labels: { severity: 'warning' },
                annotations: {
                    summary: `Snapshot deletion failed for volume [${volumeName}] on ${clusterName}/${svmName}`,
                    description: `Snapshot deletion has failed for volume [${volumeName}] on cluster ${clusterName}, SVM ${svmName}. Possible permissions issue or snapshot in use.`
                }
            });

            // Alert 4: Snapshot creation skipped (EMS event)
            alerts.push({
                alert: `${clusterName}_${svmName}_${volumeName}_snapshot_create_skip`,
                expr: `increase(ems_events{event="wafl.snap.create.skip",volume="${volumeName}",cluster="${clusterName}",svm="${svmName}"}[5m]) > 0`,
                for: '1m',
                labels: { severity: 'warning' },
                annotations: {
                    summary: `Scheduled snapshot skipped for volume [${volumeName}] on ${clusterName}/${svmName}`,
                    description: `Scheduled snapshot was skipped for volume [${volumeName}] on cluster ${clusterName}, SVM ${svmName}. Possible causes: operation in progress, volume offline, or volume full.`
                }
            });

            // Alert 5: Snapshot age exceeds retention policy
            // We'll fetch the snapshot policy to determine the minimum retention period
            if (snapshotPolicyName && snapshotPolicyName !== 'none') {
                const policyDetails = await this.getSnapshotPolicyDetails(snapshotPolicyName, svmName);
                if (policyDetails && policyDetails.minRetentionHours) {
                    alerts.push({
                        alert: `${clusterName}_${svmName}_${volumeName}_snapshot_stale`,
                        expr: `(time() - volume_snapshot_created_time{volume="${volumeName}",cluster="${clusterName}",svm="${svmName}"}) > ${policyDetails.minRetentionHours * 3600}`,
                        for: '30m',
                        labels: { severity: 'warning' },
                        annotations: {
                            summary: `Stale snapshot detected for volume [${volumeName}] on ${clusterName}/${svmName}`,
                            description: `Volume [${volumeName}] on cluster ${clusterName}, SVM ${svmName} has a snapshot older than ${policyDetails.minRetentionHours}h (policy: ${snapshotPolicyName}). Snapshot schedule may not be running.`
                        }
                    });
                }
            }

            return alerts;
        } catch (error) {
            console.error('Error generating data protection alert rules:', error);
            return [];
        }
    }

    // Fetch snapshot policy details to determine minimum retention period
    async getSnapshotPolicyDetails(policyName, svmName) {
        try {
            // Try fetching policy - first without SVM (for cluster-level policies), then with SVM
            let response;
            
            // Try without SVM first (cluster-level policies)
            response = await this.apiClient.callMcp('get_snapshot_policy', {
                cluster_name: this.demo.selectedCluster.name,
                policy_name: policyName
                // Omit svm_name for cluster-level policies
            });

            // If not found or error, try with SVM specified
            if (!response || response.includes('not found') || response.includes('❌')) {
                console.log('Policy not found at cluster level, trying SVM-specific...');
                response = await this.apiClient.callMcp('get_snapshot_policy', {
                    cluster_name: this.demo.selectedCluster.name,
                    policy_name: policyName,
                    svm_name: svmName
                });
            }

            if (!response || typeof response !== 'string') {
                console.warn('Snapshot policy response is null or not a string:', response);
                return null;
            }

            console.log('Snapshot Policy Response:', response);

            // Parse the response to find the smallest schedule interval
            // Expected format includes schedule information like "hourly", "daily", "weekly"
            // We'll look for patterns like "Count: X" with "Schedule: Y"
            
            let minRetentionHours = null;
            const lines = response.split('\n');
            
            for (const line of lines) {
                // Look for schedule patterns: hourly = 1h, daily = 24h, weekly = 168h
                if (line.match(/hourly/i)) {
                    minRetentionHours = minRetentionHours ? Math.min(minRetentionHours, 1) : 1;
                } else if (line.match(/daily/i)) {
                    minRetentionHours = minRetentionHours ? Math.min(minRetentionHours, 24) : 24;
                } else if (line.match(/weekly/i)) {
                    minRetentionHours = minRetentionHours ? Math.min(minRetentionHours, 168) : 168;
                }
            }

            if (minRetentionHours) {
                console.log(`Parsed snapshot policy min retention: ${minRetentionHours}h`);
                return { minRetentionHours };
            }

            return null;
        } catch (error) {
            console.error('Error fetching snapshot policy details:', error);
            return null;
        }
    }

    // Fetch QoS policy details including max throughput
    async getQosPolicyDetails(policyName, svmName) {
        try {
            // Try fetching policy - first without SVM (for admin/cluster policies), then with SVM
            let response;
            
            // Try without SVM first (cluster-level/admin policies)
            response = await this.apiClient.callMcp('cluster_get_qos_policy', {
                cluster_name: this.demo.selectedCluster.name,
                policy_name: policyName
                // Omit svm_name for cluster-level policies
            });

            // If not found or error, try with SVM specified
            if (!response || response.includes('not found') || response.includes('❌')) {
                console.log('Policy not found at cluster level, trying SVM-specific...');
                response = await this.apiClient.callMcp('cluster_get_qos_policy', {
                    cluster_name: this.demo.selectedCluster.name,
                    policy_name: policyName,
                    svm_name: svmName
                });
            }

            if (!response || typeof response !== 'string') {
                console.warn('QoS policy response is null or not a string:', response);
                return null;
            }

            console.log('QoS Policy Response:', response);

            // Parse the response to extract max throughput
            // Try multiple patterns to match different response formats
            
            // Pattern 1: "Max Throughput: 5000 IOPS"
            let maxThroughputMatch = response.match(/Max[imum]*\s+Throughput:\s*(\d+(?:\.\d+)?)\s*(IOPS|iops|MB\/s|mb\/s|GB\/s|gb\/s)/i);
            
            // Pattern 2: "max_throughput: 5000iops" (JSON-like format)
            if (!maxThroughputMatch) {
                maxThroughputMatch = response.match(/max[_-]?throughput["\s:]*(\d+(?:\.\d+)?)\s*(iops|mb\/s|gb\/s)/i);
            }
            
            // Pattern 3: Look for any number followed by IOPS or MB/s
            if (!maxThroughputMatch) {
                maxThroughputMatch = response.match(/(\d+(?:\.\d+)?)\s*(IOPS|iops|MB\/s|mb\/s|GB\/s|gb\/s)/i);
            }
            
            if (maxThroughputMatch) {
                const value = parseFloat(maxThroughputMatch[1]);
                const unit = maxThroughputMatch[2].toLowerCase();
                
                console.log(`Parsed QoS max throughput: ${value} ${unit}`);
                
                // Convert to IOPS if needed (for simplicity, we'll use IOPS as base unit)
                let maxThroughput = value;
                if (unit.includes('mb/s') || unit.includes('gb/s')) {
                    // For throughput in MB/s or GB/s, we'll note it but use the value as-is
                    // In production, you might want to convert based on average IO size
                    maxThroughput = value;
                }
                
                return {
                    maxThroughput,
                    unit
                };
            }

            console.warn('Could not parse max throughput from QoS policy response:', response);
            return null;
        } catch (error) {
            console.error('Error fetching QoS policy details:', error);
            return null;
        }
    }

    // Show alert rules preview modal
    async showAlertRulesPreview(monitoringType) {
        const volumeName = document.getElementById('volumeName').value.trim();
        const svmSelect = document.getElementById('svmSelect');
        const svmName = svmSelect.value;
        const clusterName = this.demo.selectedCluster.name;

        if (!volumeName) {
            this.notifications.showError('Please enter a volume name first');
            return;
        }

        if (!svmName) {
            this.notifications.showError('Please select an SVM first');
            return;
        }

        let rules = [];
        let title = '';

        if (monitoringType === 'capacity') {
            rules = this.alertRules.generateCapacityAlertRules(volumeName, svmName, clusterName);
            title = 'Capacity Monitoring Alert Rules';
        } else if (monitoringType === 'performance') {
            const qosPolicyName = document.getElementById('qosPolicy').value;
            if (!qosPolicyName) {
                this.notifications.showError('Please select a QoS Policy first to preview performance alerts');
                return;
            }
            
            rules = await this.alertRules.generatePerformanceAlertRules(volumeName, svmName, clusterName, qosPolicyName);
            title = 'Performance Monitoring Alert Rules';
            
            if (rules.length === 0) {
                this.notifications.showWarning('Could not generate performance alerts. QoS policy details may be unavailable.');
            }
        } else if (monitoringType === 'dataprotection') {
            const snapshotPolicyName = document.getElementById('snapshotPolicy').value;
            if (!snapshotPolicyName || snapshotPolicyName === 'none') {
                this.notifications.showError('Please select a Snapshot Policy first to preview data protection alerts');
                return;
            }
            
            rules = await this.alertRules.generateDataProtectionAlertRules(volumeName, svmName, clusterName, snapshotPolicyName);
            title = 'Data Protection Monitoring Alert Rules';
            
            if (rules.length === 0) {
                this.notifications.showWarning('Could not generate data protection alerts. Snapshot policy details may be unavailable.');
            }
        }

        this.alertRules.showAlertRulesModal(rules, title);
    }

    // Display alert rules in a modal
    showAlertRulesModal(rules, title) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('alertRulesPreviewModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'alertRulesPreviewModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2 id="alertRulesModalTitle">${title}</h2>
                        <button class="modal-close" onclick="app.provisioningPanel.closeAlertRulesModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div id="alertRulesContent" style="max-height: 500px; overflow-y: auto;"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-primary" onclick="app.provisioningPanel.closeAlertRulesModal()">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Update content
        document.getElementById('alertRulesModalTitle').textContent = title;
        const content = document.getElementById('alertRulesContent');
        
        if (rules.length === 0) {
            content.innerHTML = '<p>No alert rules to display.</p>';
        } else {
            content.innerHTML = rules.map((rule, index) => `
                <div class="alert-rule-preview" style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 4px;">
                    <h4 style="margin-top: 0; color: #0067C5;">Rule ${index + 1}: ${rule.alert}</h4>
                    <div style="margin-bottom: 10px;">
                        <strong>Expression:</strong>
                        <pre style="background: white; padding: 10px; border-radius: 4px; overflow-x: auto;">${rule.expr}</pre>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <strong>Duration:</strong> ${rule.for}
                    </div>
                    <div style="margin-bottom: 10px;">
                        <strong>Severity:</strong> <span style="color: ${rule.labels.severity === 'critical' ? '#d32f2f' : '#ff9800'};">${rule.labels.severity}</span>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <strong>Summary:</strong> ${rule.annotations.summary}
                    </div>
                    <div>
                        <strong>Description:</strong> ${rule.annotations.description}
                    </div>
                </div>
            `).join('');
        }

        // Show modal
        modal.style.display = 'flex';
    }

    // Close alert rules preview modal
    closeAlertRulesModal() {
        const modal = document.getElementById('alertRulesPreviewModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Helper methods for dropdown management
    setDropdownLoading(elementId, message) {
        const select = document.getElementById(elementId);
        if (select) {
            select.innerHTML = `<option value="">${message}</option>`;
            select.disabled = true;
        }
    }

    setDropdownReady(elementId) {
        const select = document.getElementById(elementId);
        if (select) {
            select.disabled = false;
        }
    }
}

// Export for global access
window.ProvisioningPanel = ProvisioningPanel;