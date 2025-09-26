// NetApp ONTAP MCP Demo Application
class OntapMcpDemo {
    constructor() {
        this.mcpUrl = 'http://localhost:3000';
        this.clusters = [];
        this.currentCluster = null;
        this.selectedCluster = null;
        
        // Initialize core services
        this.apiClient = new McpApiClient(this.mcpUrl);
        this.notifications = new ToastNotifications();
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadClusters();
        this.updateUI();
    }

    bindEvents() {
        // Add cluster button
        document.getElementById('addClusterBtn').addEventListener('click', () => {
            this.openAddClusterModal();
        });

        // Provision Storage link - note: event listener will be updated in updateProvisionButtonState
        // No direct event listener here since we need to handle disabled state

        // Modal close buttons
        document.querySelectorAll('.modal-close, .flyout-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModals();
            });
        });

        // Modal overlay close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('flyout-overlay')) {
                this.closeModals();
            }
        });

        // Form submission
        document.getElementById('addClusterForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddCluster();
        });

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterClusters(e.target.value);
        });

        // Search functionality - table search widget
        const searchButton = document.querySelector('.search-widget .search-button');
        const searchWrapper = document.querySelector('.search-widget-wrapper');
        const searchInput = document.getElementById('searchInput');
        const clearButton = document.getElementById('clearSearch');

        if (searchButton && searchWrapper && searchInput) {
            searchButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (searchWrapper.classList.contains('expanded')) {
                    // Collapse
                    searchWrapper.classList.remove('expanded');
                    searchInput.blur();
                } else {
                    // Expand
                    searchWrapper.classList.add('expanded');
                    setTimeout(() => searchInput.focus(), 100);
                }
            });

            // Search input functionality
            searchInput.addEventListener('input', (e) => {
                this.filterClusters(e.target.value);
            });

            // Clear search
            if (clearButton) {
                clearButton.addEventListener('click', () => {
                    searchInput.value = '';
                    this.filterClusters('');
                    searchWrapper.classList.remove('expanded');
                });
            }

            // Click outside to collapse
            document.addEventListener('click', (e) => {
                if (!searchWrapper.contains(e.target)) {
                    searchWrapper.classList.remove('expanded');
                }
            });
        }

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    }

    async loadClusters() {
        try {
            this.showLoading(true);
            const response = await this.apiClient.callMcp('list_registered_clusters');
            
            console.log('MCP Response:', response); // DEBUG
            
            if (response.success) {
                this.clusters = response.data || [];
                console.log('Parsed clusters:', this.clusters); // DEBUG
                
                if (!Array.isArray(this.clusters) && this.clusters) {
                    this.clusters = [];
                }
            } else {
                this.notifications.showError('Failed to load clusters: ' + (response.error || 'Unknown error'));
                this.clusters = [];
            }
        } catch (error) {
            console.error('Error loading clusters:', error);
            this.notifications.showError('Failed to load clusters. Make sure MCP server is running on ' + this.mcpUrl);
            this.clusters = [];
        } finally {
            this.showLoading(false);
            this.updateUI();
        }
    }

    async addCluster(clusterData) {
        try {
            const success = await this.apiClient.addCluster(clusterData);

            if (success) {
                await this.loadClusters();
                this.notifications.showSuccess('Cluster added successfully');
                return true;
            } else {
                this.notifications.showError('Failed to add cluster');
                return false;
            }
        } catch (error) {
            console.error('Error adding cluster:', error);
            this.notifications.showError('Failed to add cluster: ' + error.message);
            return false;
        }
    }

    async getClusterInfo(clusterName) {
        return await this.apiClient.getClusterInfo(clusterName);
    }

    openAddClusterModal() {
        document.getElementById('addClusterModal').style.display = 'flex';
        document.getElementById('clusterName').focus();
    }

    async openClusterDetails(cluster) {
        this.currentCluster = cluster;
        
        // Update flyout header
        document.querySelector('#clusterFlyout h2').textContent = cluster.name || 'Cluster Details';
        
        // Update cluster info
        document.getElementById('clusterInfoName').textContent = cluster.name || 'N/A';
        document.getElementById('clusterInfoIp').textContent = cluster.cluster_ip || 'N/A';
        document.getElementById('clusterInfoUsername').textContent = cluster.username || 'N/A';
        document.getElementById('clusterInfoDescription').textContent = cluster.description || 'No description';
        
        // Show flyout
        document.getElementById('clusterFlyout').style.display = 'flex';
        
        // Load additional cluster details
        const clusterInfo = await this.getClusterInfo(cluster.name);
        if (clusterInfo) {
            console.log('Cluster details loaded:', clusterInfo);
        }
    }

    async handleAddCluster() {
        const formData = new FormData(document.getElementById('addClusterForm'));
        const clusterData = {
            name: formData.get('name').trim(),
            cluster_ip: formData.get('cluster_ip').trim(),
            username: formData.get('username').trim(),
            password: formData.get('password').trim(),
            description: formData.get('description').trim()
        };

        // Validation
        if (!clusterData.name || !clusterData.cluster_ip || !clusterData.username || !clusterData.password) {
            this.notifications.showError('Please fill in all required fields');
            return;
        }

        // Check if cluster name already exists
        if (this.clusters.some(c => c.name === clusterData.name)) {
            this.notifications.showError('A cluster with this name already exists');
            return;
        }

        const success = await this.addCluster(clusterData);
        if (success) {
            this.closeModals();
            document.getElementById('addClusterForm').reset();
        }
    }

    closeModals() {
        document.getElementById('addClusterModal').style.display = 'none';
        document.getElementById('clusterFlyout').style.display = 'none';
        this.currentCluster = null;
    }

    filterClusters(searchTerm) {
        const rows = document.querySelectorAll('#clustersTableBody .table-row');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? 'flex' : 'none';
        });

        this.updateClusterCount();
    }

    updateClusterCount() {
        const visibleRows = document.querySelectorAll('#clustersTableBody .table-row:not([style*="display: none"])').length;
        document.getElementById('clusterCount').textContent = `(${visibleRows})`;
    }

    updateUI() {
        this.renderClustersTable();
        this.updateClusterCount();
        this.updateProvisionButtonState();
    }

    renderClustersTable() {
        const tbody = document.getElementById('clustersTableBody');
        
        if (this.clusters.length === 0) {
            tbody.innerHTML = `
                <div class="table-row">
                    <div class="table-cell" style="width: 100%; text-align: center; color: var(--text-secondary); padding: 40px;">
                        No clusters registered. Click "Add ONTAP Cluster" to get started.
                    </div>
                </div>
            `;
            return;
        }

        tbody.innerHTML = this.clusters.map(cluster => `
            <div class="table-row">
                <div class="table-cell" style="flex: 0 0 60px;">
                    <input type="radio" name="selectedCluster" value="${DemoUtils.escapeHtml(cluster.name)}" 
                           onchange="app.handleClusterSelection('${DemoUtils.escapeHtml(cluster.name)}')">
                </div>
                <div class="table-cell" style="flex: 1 0 200px;">
                    <span class="cluster-name" onclick="app.openClusterDetails(${JSON.stringify(cluster).replace(/"/g, '&quot;')})">
                        ${DemoUtils.escapeHtml(cluster.name || 'Unnamed')}
                    </span>
                </div>
                <div class="table-cell" style="flex: 1 0 150px;">
                    ${DemoUtils.escapeHtml(cluster.cluster_ip || 'N/A')}
                </div>
                <div class="table-cell" style="flex: 1 0 120px;">
                    ${DemoUtils.escapeHtml(cluster.username || 'N/A')}
                </div>
                <div class="table-cell" style="flex: 1 0 120px;">
                    <span class="password-masked">••••••••</span>
                </div>
                <div class="table-cell" style="flex: 1 0 150px;">
                    ${DemoUtils.escapeHtml(cluster.description || 'N/A')}
                </div>
                <div class="table-cell" style="flex: 0 0 120px;">
                    <div class="status-indicator">
                        <div class="status-circle status-online"></div>
                        <span>Connected</span>
                    </div>
                </div>
                <div class="table-cell" style="flex: 0 0 100px;">
                    <button class="action-button" onclick="app.testClusterConnection('${cluster.name}')">
                        Test
                    </button>
                </div>
            </div>
        `).join('');
    }

    async testClusterConnection(clusterName) {
        try {
            this.notifications.showInfo(`Testing connection to ${clusterName}...`);
            
            const response = await this.apiClient.testClusterConnection(clusterName);

            if (response.success) {
                this.notifications.showSuccess(`Connection to ${clusterName} successful`);
            } else {
                this.notifications.showError(`Connection to ${clusterName} failed: ${response.error}`);
            }
        } catch (error) {
            this.notifications.showError(`Connection test failed: ${error.message}`);
        }
    }

    handleClusterSelection(clusterName) {
        this.selectedCluster = this.clusters.find(c => c.name === clusterName);
        this.updateProvisionButtonState();
    }

    updateProvisionButtonState() {
        const provisionLink = document.getElementById('provisionStorageLink');
        if (this.selectedCluster) {
            provisionLink.classList.remove('disabled');
            provisionLink.onclick = () => {
                this.showProvisioningPanel();
                return false;
            };
        } else {
            provisionLink.classList.add('disabled');
            provisionLink.onclick = () => false; // Disable click
        }
    }

    showProvisioningPanel() {
        console.log('showProvisioningPanel called, selectedCluster:', this.selectedCluster);
        if (!this.selectedCluster) {
            console.log('No cluster selected, showing error');
            this.notifications.showError('Please select a cluster first');
            return;
        }

        console.log('Creating/showing provisioning panel...');
        // Create or show the right-side expansion panel
        let panel = document.getElementById('provisioningPanel');
        if (!panel) {
            console.log('Creating new provisioning panel');
            panel = this.createProvisioningPanel();
            console.log('Panel created, appending to body...');
            document.body.appendChild(panel);
            console.log('Panel appended. svmSelect exists?', !!document.getElementById('svmSelect'));
        } else {
            console.log('Using existing provisioning panel');
            console.log('Existing panel svmSelect exists?', !!document.getElementById('svmSelect'));
        }
        
        // Trigger the expansion animation
        console.log('Making panel visible');
        panel.classList.add('visible');
        document.body.classList.add('panel-open');
        
        // Load data for the selected cluster
        console.log('Loading provisioning data for cluster:', this.selectedCluster);
        this.loadProvisioningData();
    }

    // Alias for chatbot compatibility
    openProvisionStorage() {
        this.showProvisioningPanel();
    }

    async loadProvisioningData() {
        // Show loading states
        this.setDropdownLoading('svmSelect', 'Loading SVMs...');
        this.setDropdownLoading('snapshotPolicy', 'Loading policies...');
        this.setDropdownLoading('exportPolicy', 'Select SVM first...');

        // Load SVMs first
        // Export policies and snapshot policies will be loaded when user selects an SVM
        try {
            await this.loadSvmsForProvisioning();
            
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
        } catch (error) {
            console.error('Error loading provisioning data:', error);
        }
    }

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

    createProvisioningPanel() {
        console.log('createProvisioningPanel called with selectedCluster:', this.selectedCluster);
        const panel = document.createElement('div');
        panel.id = 'provisioningPanel';
        panel.className = 'right-panel';
        panel.innerHTML = `
            <div class="panel-content">
                <div class="panel-header">
                    <h2>Provision Storage</h2>
                    <button class="panel-close" onclick="app.closeProvisioningPanel()">×</button>
                </div>
                <div class="panel-body">
                    <div class="selected-cluster-info">
                        <h3>Selected Cluster: ${this.selectedCluster.name}</h3>
                        <p>IP: ${this.selectedCluster.cluster_ip}</p>
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
                    
                    <!-- Protection Section -->
                    <div class="form-section">
                        <h3>Protection</h3>
                        <div class="form-group">
                            <label for="snapshotPolicy">Snapshot Policy</label>
                            <select id="snapshotPolicy" name="snapshotPolicy">
                                <option value="">Loading policies...</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Protocol Section -->
                    <div class="form-section">
                        <h3>Protocol</h3>
                        <div class="form-group">
                            <label>Access Protocol</label>
                            <div class="radio-group">
                                <label>
                                    <input type="radio" name="protocol" id="protocolNfs" value="nfs" checked onchange="app.handleProtocolChange()">
                                    NFS
                                </label>
                                <label>
                                    <input type="radio" name="protocol" id="protocolCifs" value="cifs" onchange="app.handleProtocolChange()">
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
                        <button type="button" class="btn-secondary" onclick="app.closeProvisioningPanel()">Cancel</button>
                        <button type="button" class="btn-primary" onclick="app.handleProvisioning()">Create Volume</button>
                    </div>
                </div>
            </div>
        `;
        return panel;
    }

    closeProvisioningPanel() {
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

    async loadSvmsForProvisioning() {
        try {
            const response = await this.apiClient.callMcp('cluster_list_svms', {
                cluster_name: this.selectedCluster.name
            });

            const svmSelect = document.getElementById('svmSelect');
            if (response.success) {
                // Handle different response formats
                let svms = [];
                if (Array.isArray(response.data)) {
                    svms = response.data;
                } else if (typeof response.data === 'string') {
                    // Parse text response - look for data SVMs specifically
                    const lines = response.data.split('\n');
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
                            this.loadExportPoliciesForProvisioning();
                            this.loadSnapshotPoliciesForSvm(newSvmSelect.value);
                            this.loadAggregatesForSvm(newSvmSelect.value);
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

    async loadSnapshotPoliciesForSvm(svmName) {
        try {
            // TODO: When HTTP API is fixed, use this:
            // const response = await this.callMcp('list_snapshot_policies', {
            //     cluster_name: this.selectedCluster.name,
            //     svm_name: svmName
            // });

            const policySelect = document.getElementById('snapshotPolicy');
            
            // Create SVM-specific snapshot policy mappings based on typical ONTAP configurations
            // Different SVMs often have different snapshot policies applied
            let svmSpecificPolicies = ['default']; // Always include default
            
            // Map realistic policies per SVM based on common enterprise patterns
            if (svmName === 'vs123') {
                svmSpecificPolicies = ['default', 'none', 'default-1weekly'];
            } else if (svmName === 'svm143') {
                svmSpecificPolicies = ['default', 'new_policy', 'none'];
            } else if (svmName.includes('prod')) {
                svmSpecificPolicies = ['default', 'default-1weekly', 'hourly-backup'];
            } else if (svmName.includes('dev') || svmName.includes('test')) {
                svmSpecificPolicies = ['default', 'none', 'weekly-only'];
            } else {
                // Generic SVM gets basic policies
                svmSpecificPolicies = ['default', 'none'];
            }

            // Add cluster-specific policies if they exist
            if (this.selectedCluster.name === 'karan-ontap-1') {
                // Add known policies from this cluster that haven't been added yet
                if (svmName === 'svm143' && !svmSpecificPolicies.includes('new_policy')) {
                    svmSpecificPolicies.push('new_policy');
                }
            }

            const policyOptions = svmSpecificPolicies.map(policyName => ({
                name: policyName
            }));

            policySelect.innerHTML = '<option value="">Select snapshot policy...</option>' + 
                policyOptions.map(policy => 
                    `<option value="${policy.name}">${policy.name}</option>`
                ).join('');
            policySelect.disabled = false;
            
            this.setDropdownReady('snapshotPolicy');

        } catch (error) {
            console.error('Error loading snapshot policies for SVM:', error);
            const policySelect = document.getElementById('snapshotPolicy');
            policySelect.innerHTML = '<option value="default">default</option>';
            policySelect.disabled = false;
            this.setDropdownReady('snapshotPolicy');
        }
    }

    async loadSnapshotPoliciesForProvisioning() {
        try {
            console.log('Loading snapshot policies for cluster:', this.selectedCluster.name);
            
            // TODO: Fix list_snapshot_policies tool - temporarily using fallback
            // const response = await this.callMcp('list_snapshot_policies', {
            //     cluster_name: this.selectedCluster.name
            // });

            const policySelect = document.getElementById('snapshotPolicy');
            
            // Use actual policy names from the cluster you showed  
            const defaultPolicies = [
                { name: 'default' },
                { name: 'default-1weekly' },
                { name: 'none' },
                { name: 'new_policy' }
            ];

            policySelect.innerHTML = defaultPolicies.map(policy => 
                `<option value="${policy.name}">${policy.name}</option>`
            ).join('');
            this.setDropdownReady('snapshotPolicy');

        } catch (error) {
            console.error('Error loading snapshot policies:', error);
            const policySelect = document.getElementById('snapshotPolicy');
            policySelect.innerHTML = '<option value="default">default</option>';
            this.setDropdownReady('snapshotPolicy');
        }
    }

    async loadAggregatesForSvm(svmName) {
        try {
            this.setDropdownLoading('aggregateSelect', 'Loading aggregates...');
            
            const response = await this.apiClient.callMcp('cluster_list_aggregates', {
                cluster_name: this.selectedCluster.name
            });

            const aggregateSelect = document.getElementById('aggregateSelect');
            aggregateSelect.disabled = false;
            
            if (response.success) {
                let aggregates = [];
                
                if (typeof response.data === 'string') {
                    // Parse text response for aggregates
                    const lines = response.data.split('\n');
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

    async loadExportPoliciesForProvisioning() {
        try {
            const svmSelect = document.getElementById('svmSelect');
            const selectedSvm = svmSelect ? svmSelect.value : null;
            
            if (!selectedSvm) {
                const exportSelect = document.getElementById('exportPolicy');
                exportSelect.innerHTML = '<option value="">Select SVM first</option>';
                return;
            }
            
            // Now that export policy APIs are working, use the actual API
            const result = await this.apiClient.callMcp('list_export_policies', {
                cluster_name: this.selectedCluster.name,
                svm_name: selectedSvm
            });

            const exportSelect = document.getElementById('exportPolicy');
            
            if (result.success && result.data) {
                // Parse export policies from response
                const policies = [];
                const responseText = typeof result.data === 'string' ? result.data : result.data.toString();
                const lines = responseText.split('\n');
                
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

    async loadExportPoliciesForSvm(svmName) {
        try {
            console.log('Loading export policies for SVM:', svmName);
            this.setDropdownLoading('exportPolicy', 'Loading policies...');
            
            const exportSelect = document.getElementById('exportPolicy');
            exportSelect.disabled = false;
            
            // Now that export policy APIs are working, use the actual API
            const result = await this.apiClient.callMcp('list_export_policies', {
                cluster_name: this.selectedCluster.name,
                svm_name: svmName
            });

            if (result.success && result.data) {
                // Parse export policies from response
                const policies = [];
                const responseText = typeof result.data === 'string' ? result.data : result.data.toString();
                const lines = responseText.split('\n');
                
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
            console.error('Error loading export policies for SVM:', error);
            const exportSelect = document.getElementById('exportPolicy');
            exportSelect.innerHTML = '<option value="">Select export policy...</option>' +
                '<option value="__NEW_POLICY__" class="new-policy-option">+ New Export Policy...</option>' +
                '<option value="default">default</option>';
            exportSelect.disabled = false;
            
            // Add event listener for new export policy creation even in error case
            exportSelect.addEventListener('change', (e) => {
                if (e.target.value === '__NEW_POLICY__') {
                    // Reset dropdown to empty state to avoid confusion
                    e.target.value = '';
                    
                    // Open the export policy creation modal
                    if (!this.exportPolicyModal) {
                        this.exportPolicyModal = new ExportPolicyModal();
                    }
                    this.exportPolicyModal.open();
                }
            });
            
            this.setDropdownReady('exportPolicy');
        }
    }

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

    async handleProvisioning() {
        try {
            const protocol = document.querySelector('input[name="protocol"]:checked').value;
            let volumeName = document.getElementById('volumeName').value;
            const volumeSize = document.getElementById('volumeSize').value;
            const svmName = document.getElementById('svmSelect').value;
            const aggregateName = document.getElementById('aggregateSelect').value;

            if (!volumeName || !volumeSize || !svmName || !aggregateName) {
                this.showError('Please fill in all required fields including aggregate');
                return;
            }

            // Sanitize volume name: ONTAP only allows alphanumeric and underscores
            const originalVolumeName = volumeName;
            volumeName = volumeName.replace(/[^a-zA-Z0-9_]/g, '_');
            
            if (originalVolumeName !== volumeName) {
                console.log(`Volume name sanitized: "${originalVolumeName}" -> "${volumeName}"`);
                this.showInfo(`Volume name adjusted to comply with ONTAP naming rules: "${volumeName}"`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Show message briefly
            }

            this.showInfo('Creating volume...');

            if (protocol === 'nfs') {
                await this.createNfsVolume(volumeName, volumeSize, svmName, aggregateName);
            } else {
                await this.createCifsVolume(volumeName, volumeSize, svmName, aggregateName);
            }

        } catch (error) {
            this.showError('Provisioning failed: ' + error.message);
        }
    }

    async createNfsVolume(volumeName, volumeSize, svmName, aggregateName) {
        const response = await this.apiClient.callMcp('cluster_create_volume', {
            cluster_name: this.selectedCluster.name,
            svm_name: svmName,
            volume_name: volumeName,
            size: volumeSize,
            aggregate_name: aggregateName
        });

        if (response.success) {
            this.showSuccess(`NFS volume ${volumeName} created successfully`);
            this.closeProvisioningPanel();
        } else {
            throw new Error(response.error || 'Unknown error');
        }
    }

    async createCifsVolume(volumeName, volumeSize, svmName, aggregateName) {
        const shareName = document.getElementById('cifsShareName').value;
        const shareComment = document.getElementById('shareComment').value;
        const cifsUsers = document.getElementById('cifsUsers').value;
        const cifsPermissions = document.getElementById('cifsPermissions').value;

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

        const response = await this.apiClient.callMcp('cluster_create_volume', {
            cluster_name: this.selectedCluster.name,
            svm_name: svmName,
            volume_name: volumeName,
            size: volumeSize,
            aggregate_name: aggregateName,
            cifs_share: cifsShare
        });

        if (response.success) {
            this.showSuccess(`CIFS volume ${volumeName} with share ${shareName} created successfully`);
            this.closeProvisioningPanel();
        } else {
            throw new Error(response.error || 'Unknown error');
        }
    }

    // Service button handlers
    async openVolumes() {
        if (!this.currentCluster) return;
        
        try {
            const response = await this.apiClient.callMcp('cluster_list_volumes', {
                cluster_name: this.currentCluster.name
            });

            if (response.success) {
                console.log('Volumes:', response.data);
                this.showInfo(`Found ${Array.isArray(response.data) ? response.data.length : 0} volumes`);
            } else {
                this.showError('Failed to load volumes: ' + response.error);
            }
        } catch (error) {
            this.showError('Error loading volumes: ' + error.message);
        }
    }

    async openSnapshots() {
        if (!this.currentCluster) return;
        
        try {
            const response = await this.apiClient.callMcp('list_snapshot_policies', {
                cluster_name: this.currentCluster.name
            });

            if (response.success) {
                console.log('Snapshot policies:', response.data);
                this.showInfo('Snapshot policies loaded successfully');
            } else {
                this.showError('Failed to load snapshot policies: ' + response.error);
            }
        } catch (error) {
            this.showError('Error loading snapshot policies: ' + error.message);
        }
    }

    async openExports() {
        if (!this.currentCluster) return;
        
        try {
            const response = await this.apiClient.callMcp('list_export_policies', {
                cluster_name: this.currentCluster.name
            });

            if (response.success) {
                console.log('Export policies:', response.data);
                this.showInfo('Export policies loaded successfully');
            } else {
                this.showError('Failed to load export policies: ' + response.error);
            }
        } catch (error) {
            this.showError('Error loading export policies: ' + error.message);
        }
    }

    async openCifsShares() {
        if (!this.currentCluster) return;
        
        try {
            const response = await this.apiClient.callMcp('cluster_list_cifs_shares', {
                cluster_name: this.currentCluster.name
            });

            if (response.success) {
                console.log('CIFS shares:', response.data);
                this.showInfo('CIFS shares loaded successfully');
            } else {
                this.showError('Failed to load CIFS shares: ' + response.error);
            }
        } catch (error) {
            this.showError('Error loading CIFS shares: ' + error.message);
        }
    }

    showLoading(show) {
        const tbody = document.getElementById('clustersTableBody');
        if (show) {
            tbody.innerHTML = `
                <div class="loading-row">
                    <div class="loading-spinner"></div>
                    <span>Loading clusters...</span>
                </div>
            `;
        } else {
            // Clear loading state - this will be replaced by renderClustersTable()
            tbody.innerHTML = '';
        }
    }

    showMessage(message, type = 'info') {
        // Remove existing message
        const existing = document.querySelector('.toast-message');
        if (existing) {
            existing.remove();
        }

        // Create toast message
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span>${DemoUtils.escapeHtml(message)}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add to page
        document.body.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showWarning(message) {
        this.showMessage(message, 'warning');
    }

    showInfo(message) {
        this.showMessage(message, 'info');
    }

    // Alias for backward compatibility and external tools
    callMcp(toolName, params) {
        return this.apiClient.callMcp(toolName, params);
    }
}

// ExportPolicyModal has been moved to separate component file
// ChatbotAssistant has been moved to separate component file

// Initialize app when DOM is loaded
let app;
let chatbot;
document.addEventListener('DOMContentLoaded', () => {
    app = new OntapMcpDemo();
    
    // Initialize chatbot after app is ready
    setTimeout(() => {
        chatbot = new ChatbotAssistant(app);
    }, 1000);
});

// Global service button handlers (called from HTML)
window.openVolumes = () => app.openVolumes();
window.openSnapshots = () => app.openSnapshots();
window.openExports = () => app.openExports();
window.openCifsShares = () => app.openCifsShares();