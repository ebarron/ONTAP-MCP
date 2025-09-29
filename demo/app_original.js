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
                                    <input type="radio" name="protocol" value="nfs" checked onchange="app.handleProtocolChange()">
                                    NFS
                                </label>
                                <label>
                                    <input type="radio" name="protocol" value="cifs" onchange="app.handleProtocolChange()">
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
                                <label for="shareName">CIFS Share Name</label>
                                <input type="text" id="shareName" name="shareName">
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
        const shareName = document.getElementById('shareName').value;
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
}

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

// Export Policy Modal Management
class ExportPolicyModal {
    constructor() {
        this.modal = document.getElementById('exportPolicyModal');
        this.form = document.getElementById('exportPolicyForm');
        this.rulesContainer = document.getElementById('rulesContainer');
        this.ruleCounter = 0;
        
        this.bindEvents();
        this.addInitialRule();
    }
    
    bindEvents() {
        // Modal close events
        document.getElementById('closeExportPolicyModal').addEventListener('click', () => this.close());
        document.getElementById('cancelExportPolicy').addEventListener('click', () => this.close());
        
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Add rule button
        document.getElementById('addExportRule').addEventListener('click', () => this.addRule());
        
        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
    }
    
    open() {
        this.modal.style.display = 'flex';
        this.reset();
        this.addInitialRule();
        
        // Focus on policy name input
        setTimeout(() => {
            document.getElementById('exportPolicyNameHeader').select();
        }, 100);
    }
    
    close() {
        this.modal.style.display = 'none';
        this.reset();
    }
    
    reset() {
        this.form.reset();
        document.getElementById('exportPolicyNameHeader').value = 'new_export_policy';
        this.rulesContainer.innerHTML = '';
        this.ruleCounter = 0;
    }
    
    addInitialRule() {
        this.addRule();
    }
    
    addRule() {
        this.ruleCounter++;
        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'rule-item';
        ruleDiv.innerHTML = `
            <div class="rule-header">
                <span class="rule-title">Rule ${this.ruleCounter}</span>
                <button type="button" class="rule-remove" onclick="app.exportPolicyModal.removeRule(this)">Remove</button>
            </div>
            <div class="rule-fields">
                <div class="rule-field">
                    <label>Client Specification (IP/Mask)</label>
                    <input type="text" name="clientSpec" placeholder="e.g., 192.168.1.0/24 or 0.0.0.0/0" required>
                    <div class="rule-validation-error" style="display: none;"></div>
                </div>
                <div class="rule-field">
                    <label>Access Control</label>
                    <select name="accessControl" required>
                        <option value="rw">Read/Write</option>
                        <option value="ro">Read Only</option>
                    </select>
                </div>
                <div class="rule-field">
                    <label>Super User Access</label>
                    <select name="superUser" required>
                        <option value="any">Yes</option>
                        <option value="none">No</option>
                    </select>
                </div>
                <div class="rule-field">
                    <label>NFS Protocols</label>
                    <select name="protocols" required>
                        <option value="any">All</option>
                        <option value="nfs3">NFSv3</option>
                        <option value="nfs4">NFSv4</option>
                        <option value="nfs41">NFSv4.1</option>
                    </select>
                </div>
            </div>
        `;
        
        this.rulesContainer.appendChild(ruleDiv);
        
        // Add validation to client spec input
        const clientInput = ruleDiv.querySelector('input[name="clientSpec"]');
        clientInput.addEventListener('input', () => this.validateClientSpec(clientInput));
    }
    
    removeRule(button) {
        const ruleItem = button.closest('.rule-item');
        if (this.rulesContainer.children.length > 1) {
            ruleItem.remove();
            this.updateRuleNumbers();
        } else {
            app.showError('At least one rule is required');
        }
    }
    
    updateRuleNumbers() {
        const rules = this.rulesContainer.querySelectorAll('.rule-item');
        rules.forEach((rule, index) => {
            rule.querySelector('.rule-title').textContent = `Rule ${index + 1}`;
        });
    }
    
    validateClientSpec(input) {
        const value = input.value.trim();
        const errorDiv = input.parentNode.querySelector('.rule-validation-error');
        
        if (!value) {
            this.showFieldError(input, errorDiv, '');
            return true;
        }
        
        // IPv4 CIDR validation
        const ipv4CidrPattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        if (!ipv4CidrPattern.test(value)) {
            this.showFieldError(input, errorDiv, 'Invalid format. Use IP/mask (e.g., 192.168.1.0/24)');
            return false;
        }
        
        // Validate IP parts and CIDR
        const [ip, cidr] = value.split('/');
        const ipParts = ip.split('.');
        const cidrNum = parseInt(cidr);
        
        if (ipParts.some(part => parseInt(part) > 255) || cidrNum > 32) {
            this.showFieldError(input, errorDiv, 'Invalid IP address or CIDR value');
            return false;
        }
        
        this.showFieldError(input, errorDiv, '');
        return true;
    }
    
    showFieldError(input, errorDiv, message) {
        if (message) {
            input.style.borderColor = 'var(--text-destructive)';
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        } else {
            input.style.borderColor = 'var(--field-border)';
            errorDiv.style.display = 'none';
        }
    }
    
    collectRules() {
        const rules = [];
        const ruleItems = this.rulesContainer.querySelectorAll('.rule-item');
        
        for (const ruleItem of ruleItems) {
            const clientSpec = ruleItem.querySelector('input[name="clientSpec"]').value.trim();
            const accessControl = ruleItem.querySelector('select[name="accessControl"]').value;
            const superUser = ruleItem.querySelector('select[name="superUser"]').value;
            const protocols = ruleItem.querySelector('select[name="protocols"]').value;
            
            if (!this.validateClientSpec(ruleItem.querySelector('input[name="clientSpec"]'))) {
                return null; // Validation failed
            }
            
            rules.push({
                clients: [{ match: clientSpec }],
                ro_rule: ['sys'],
                rw_rule: [accessControl === 'rw' ? 'sys' : 'none'],
                superuser: [superUser],
                protocols: [protocols]
            });
        }
        
        return rules;
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        const policyName = document.getElementById('exportPolicyNameHeader').value.trim();
        const description = document.getElementById('exportPolicyDescription').value.trim();
        const rules = this.collectRules();
        
        if (!rules) {
            app.showError('Please fix validation errors');
            return;
        }
        
        if (!policyName) {
            app.showError('Policy name is required');
            return;
        }
        
        try {
            const createBtn = document.getElementById('createExportPolicy');
            createBtn.disabled = true;
            createBtn.textContent = 'Creating...';
            
            await this.createPolicyWithRules(policyName, description, rules);
            
            app.showInfo('Export policy created successfully');
            this.close();
            
            // Refresh the export policy dropdown and select the new policy
            const svmSelect = document.getElementById('svmSelect');
            if (svmSelect && svmSelect.value) {
                await app.loadExportPoliciesForProvisioning();
                const exportPolicySelect = document.getElementById('exportPolicy');
                if (exportPolicySelect) {
                    exportPolicySelect.value = policyName;
                }
            }
            
        } catch (error) {
            console.error('Error creating export policy:', error);
            app.showError(`Failed to create export policy: ${error.message}`);
        } finally {
            const createBtn = document.getElementById('createExportPolicy');
            createBtn.disabled = false;
            createBtn.textContent = 'Create Policy';
        }
    }
    
    async createPolicyWithRules(policyName, description, rules) {
        const selectedCluster = app.selectedCluster?.name;
        const svmSelect = document.getElementById('svmSelect');
        const selectedSvm = svmSelect ? svmSelect.value : null;
        
        if (!selectedCluster || !selectedSvm) {
            throw new Error('Please select a cluster and SVM first');
        }
        
        let policyCreated = false;
        
        try {
            // Create the export policy
            const policyParams = {
                cluster_name: selectedCluster,
                policy_name: policyName,
                svm_name: selectedSvm
            };
            
            console.log('Creating export policy:', policyParams);
            await app.callMcp('create_export_policy', policyParams);
            policyCreated = true;
            
            // Add each rule
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                const ruleParams = {
                    cluster_name: selectedCluster,
                    policy_name: policyName,
                    svm_name: selectedSvm,
                    clients: rule.clients,
                    ro_rule: rule.ro_rule,
                    rw_rule: rule.rw_rule,
                    superuser: rule.superuser,
                    protocols: rule.protocols
                };
                
                await app.callMcp('add_export_rule', ruleParams);
            }
            
        } catch (error) {
            // If policy was created but rules failed, try to clean up
            if (policyCreated) {
                try {
                    console.log('Cleaning up failed policy:', policyName);
                    await app.callMcp('delete_export_policy', {
                        cluster_name: selectedCluster,
                        policy_name: policyName,
                        svm_name: selectedSvm
                    });
                } catch (cleanupError) {
                    console.error('Failed to cleanup policy:', cleanupError);
                }
            }
            throw error;
        }
    }
}

// =====================================================
// NetApp ONTAP Provisioning Assistant (Chatbot)
// =====================================================

class ChatbotAssistant {
    constructor(demo) {
        this.demo = demo;
        this.isInitialized = false;
        this.config = null;
        this.messages = [];
        this.availableTools = [];
        this.mockMode = false;
        this.isThinking = false;
        
        this.init();
    }

    async init() {
        // Load ChatGPT configuration
        await this.loadConfig();
        
        // Initialize UI elements
        this.initializeUI();
        
        // Discover available MCP tools
        await this.discoverTools();
        
        // Show welcome message
        this.showWelcomeMessage();
        
        this.isInitialized = true;
        this.updateStatus('Ready to help with ONTAP provisioning');
        this.enableInput();
    }

    async loadConfig() {
        try {
            const response = await fetch('./chatgpt-config.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.config = await response.json();
            
            // Validate API key
            if (!this.config.api_key || this.config.api_key === 'YOUR_CHATGPT_API_KEY_HERE') {
                throw new Error('No valid ChatGPT API key configured');
            }
            
            console.log('ChatGPT config loaded successfully');
        } catch (error) {
            console.warn('ChatGPT config load failed, enabling mock mode:', error.message);
            this.mockMode = true;
            this.config = {
                model: 'mock-gpt-5',
                max_completion_tokens: 2000
            };
        }
    }

    initializeUI() {
        // Toggle button
        const toggleBtn = document.getElementById('chatbotToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleChatbot());
        }

        // Input and send button
        const input = document.getElementById('chatbotInput');
        const sendBtn = document.getElementById('chatbotSend');

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            input.addEventListener('input', (e) => {
                this.toggleSendButton(e.target.value.trim().length > 0);
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Start collapsed
        document.querySelector('.chatbot-container').classList.add('collapsed');
    }

    async discoverTools() {
        try {
            this.updateStatus('Discovering available ONTAP tools...');
            
            // Call the MCP server's tools endpoint to get the real list
            const response = await fetch(`${this.demo.mcpUrl}/api/tools`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            if (data.tools && Array.isArray(data.tools)) {
                // Cache full tool definitions for OpenAI function calling
                this.toolDefinitions = data.tools;
                // Extract tool names from the full MCP tool definitions
                this.availableTools = data.tools.map(tool => tool.name);
                console.log(`Discovered ${this.availableTools.length} ONTAP tools:`, this.availableTools);
            } else {
                throw new Error('Invalid response format from tools endpoint');
            }
        } catch (error) {
            console.error('Tool discovery failed, using fallback list:', error);
            // Fallback to a minimal set of core tools
            this.availableTools = [
                'list_registered_clusters',
                'cluster_list_volumes',
                'cluster_list_aggregates', 
                'cluster_list_svms',
                'cluster_create_volume',
                'create_export_policy',
                'add_export_rule',
                'create_cifs_share',
                'list_snapshot_policies',
                'cluster_get_volume_stats'
            ];
            this.toolDefinitions = []; // Empty cache for fallback
        }
    }

    toggleChatbot() {
        const container = document.querySelector('.chatbot-container');
        container.classList.toggle('collapsed');
    }

    showWelcomeMessage() {
        const welcomeMsg = this.mockMode 
            ? "👋 Hello! I'm your NetApp ONTAP provisioning assistant (running in demo mode). I can help you find the best storage locations across your ONTAP clusters based on available capacity and best practices.\n\nTry asking me: \"Provision a 100mb NFS volume for a database workload\""
            : "👋 Hello! I'm your NetApp ONTAP provisioning assistant. I can help you find the best storage locations across your ONTAP clusters based on available capacity and best practices.\n\nTry asking me: \"Provision a 100mb NFS volume for a database workload\"";

        this.addMessage('assistant', welcomeMsg);
    }

    async sendMessage() {
        const input = document.getElementById('chatbotInput');
        const message = input.value.trim();
        
        if (!message || this.isThinking) return;

        // Add user message
        this.addMessage('user', message);
        input.value = '';
        this.toggleSendButton(false);

        // Show thinking state
        this.showThinking();

        try {
            let response;
            if (this.mockMode) {
                response = await this.getMockResponse(message);
            } else {
                response = await this.getChatGPTResponse(message);
            }
            
            this.hideThinking();
            this.addMessage('assistant', response.text, response.actions);

        } catch (error) {
            this.hideThinking();
            this.addMessage('assistant', `❌ Sorry, I encountered an error: ${error.message}`);
            console.error('Chat error:', error);
        }
    }

    async getMockResponse(message) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        const lowerMsg = message.toLowerCase();
        
        if (lowerMsg.includes('provision') && lowerMsg.includes('volume')) {
            return {
                text: "Based on your request for volume provisioning, I recommend creating a 100GB volume on **cluster-prod** in SVM **vs1** using aggregate **aggr1** which has the most available capacity.\n\nWould you like me to populate the provisioning form with these settings?",
                actions: [{
                    label: "Apply to Form",
                    action: "apply_volume_form",
                    data: {
                        cluster: "cluster-prod",
                        svm: "vs1", 
                        volume_name: "db_vol_001",
                        size: "100GB",
                        security_style: "unix",
                        export_policy: "default"
                    }
                }]
            };
        } else if (lowerMsg.includes('cifs') || lowerMsg.includes('smb')) {
            return {
                text: "For CIFS/SMB shares, I recommend **cluster-dev** with SVM **vs2** which has good capacity and is configured for Windows environments.\n\nShall I prepare a CIFS share configuration?",
                actions: [{
                    label: "Apply to Form",
                    action: "apply_cifs_form", 
                    data: {
                        cluster: "cluster-dev",
                        svm: "vs2",
                        volume_name: "shared_docs",
                        size: "500GB",
                        share_name: "Documents"
                    }
                }]
            };
        } else if (lowerMsg.includes('capacity') || lowerMsg.includes('space')) {
            return {
                text: "Here's the current capacity overview across your clusters:\n\n**cluster-prod**: 2.5TB available (65% utilized)\n**cluster-dev**: 1.8TB available (45% utilized)\n**cluster-test**: 800GB available (80% utilized)\n\ncluster-dev has the most available space for new workloads."
            };
        } else {
            return {
                text: "I'm here to help with ONTAP storage provisioning! I can:\n\n• Recommend optimal placement for new volumes\n• Suggest CIFS share configurations\n• Analyze cluster capacity\n• Apply settings to the provisioning form\n\nWhat storage task can I help you with?"
            };
        }
    }

    async getChatGPTResponse(message) {
        const systemPrompt = this.buildSystemPrompt();
        const conversationHistory = this.buildConversationHistory();

        // Build tools for ChatGPT function calling (newer format)
        const tools = this.buildMCPTools();

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...conversationHistory,
                    { role: 'user', content: message }
                ],
                max_completion_tokens: this.config.max_completion_tokens,
                tools: tools,
                tool_choice: 'auto' // Let ChatGPT decide when to use tools
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`ChatGPT API error: ${response.status} ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('ChatGPT API response:', data);
        
        const choice = data.choices?.[0];
        if (!choice) {
            throw new Error('No choices in ChatGPT response');
        }

        // Handle tool calls (newer format)
        if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
            console.log('Tool calls detected:', choice.message.tool_calls);
            return await this.handleToolCalls(message, choice.message.tool_calls, 0);
        }

        const aiResponse = choice.message?.content;
        if (!aiResponse || aiResponse.trim() === '') {
            console.error('No content in ChatGPT response:', data);
            
            const finishReason = choice.finish_reason;
            console.log('Finish reason:', finishReason);
            
            if (finishReason === 'content_filter') {
                throw new Error('Response was filtered by content policy. Please try rephrasing your request.');
            }
            
            throw new Error(`ChatGPT returned empty response (finish_reason: ${finishReason || 'unknown'})`);
        }

        console.log('ChatGPT response content:', aiResponse);
        return this.parseResponseActions(aiResponse);
    }

    buildSystemPrompt() {
        const selectedCluster = this.demo.selectedCluster;
        const clusterInfo = selectedCluster ? 
            `The user has selected cluster "${selectedCluster.name}" (${selectedCluster.cluster_ip})` : 
            'No specific cluster is currently selected';

        return `You are a NetApp ONTAP provisioning assistant. Your job is to help users provision storage across their ONTAP clusters by finding optimal locations based on available capacity and best practices.

CONTEXT:
- User has access to multiple ONTAP clusters through the NetApp ONTAP MCP
- ${clusterInfo}
- You have access to ALL ${this.availableTools.length} MCP functions covering:
  * Cluster management (list_registered_clusters, get_all_clusters_info)
  * Volume operations (cluster_create_volume, cluster_list_volumes, resize_volume, etc.)
  * CIFS/SMB shares (create_cifs_share, cluster_list_cifs_shares, update_cifs_share)
  * NFS exports (create_export_policy, add_export_rule, configure_volume_nfs_access)
  * Snapshot policies (create_snapshot_policy, list_snapshot_policies)
  * Aggregates and SVMs (cluster_list_aggregates, cluster_list_svms)
  * Performance monitoring (get_volume_stats, cluster_get_volume_stats)
- You can perform multi-step analysis and complete provisioning workflows

MANDATORY WORKFLOW FOR PROVISIONING REQUESTS:
1. ALWAYS call list_registered_clusters first to get all available clusters
2. For EACH cluster, call BOTH cluster_list_aggregates AND cluster_list_svms (not just one)
3. Analyze capacity and SVM availability across ALL clusters
4. Recommend specific: Cluster name, SVM name, Aggregate name, Size, Protocol
5. NEVER say "Please provide an SVM" - you must specify the exact SVM name from step 2

CRITICAL PROVISIONING REQUIREMENTS:
- ALWAYS use BOTH cluster_list_aggregates AND cluster_list_svms for EACH cluster before making recommendations
- For multi-cluster analysis, call cluster_list_aggregates AND cluster_list_svms for ALL clusters
- NEVER make recommendations without checking BOTH aggregates and SVMs for each cluster
- ALWAYS specify exact cluster name, SVM name, and aggregate name in recommendations
- Choose aggregates with sufficient available space and good utilization ratios
- Provide complete provisioning details: Cluster, SVM, Aggregate, Size, Protocol

CAPABILITIES:
- Query cluster capacity and aggregates using cluster functions
- Check SVM availability and volume placement
- Create volumes with CIFS shares or NFS exports in one operation
- Set up snapshot policies and schedules
- Perform comprehensive capacity analysis across all clusters
- Execute complete provisioning workflows from analysis to creation

GUIDELINES:
- When making recommendations, gather essential cluster information efficiently
- Use 1-3 targeted tool calls to get the information needed
- Provide specific cluster, SVM, and aggregate combinations based on actual data
- Focus on giving actionable recommendations rather than exhaustive analysis
- When user requests provisioning, execute the actual creation (don't just recommend)
- Ask for confirmation before making changes to production systems
- Be conversational but technically accurate

RESPONSE FORMAT FOR PROVISIONING:
When providing storage provisioning recommendations, ALWAYS use this exact structured format:

## PROVISIONING_RECOMMENDATION
- **Cluster**: [exact cluster name]
- **SVM**: [exact SVM name]
- **Aggregate**: [exact aggregate name]
- **Size**: [requested size with units like 100MB, 1GB, etc.]
- **Protocol**: [NFS or CIFS]
- **Snapshot_Policy**: [policy name - optional]
- **Export_Policy**: [policy name - optional for NFS]
## END_PROVISIONING_RECOMMENDATION

CRITICAL: This structured format is required for ALL provisioning recommendations. It enables automatic form population for the user.

EXAMPLE CORRECT FORMAT:
## PROVISIONING_RECOMMENDATION
- **Cluster**: greg-vsim-2
- **SVM**: svm1
- **Aggregate**: storage_availability_zone_0
- **Size**: 100MB
- **Protocol**: NFS
## END_PROVISIONING_RECOMMENDATION

After the structured recommendation block, you can add explanatory text about why you chose these settings.

RESPONSE STRATEGY:
- Make focused tool calls to gather specific information needed
- After 1-2 tool calls, provide recommendations based on the data collected
- Avoid excessive analysis - aim for actionable recommendations quickly`;
    }

    buildMCPTools() {
        // Convert ALL available MCP tools to OpenAI tools format using cached definitions
        const mcpTools = [];
        
        // Use cached tool definitions if available
        if (this.toolDefinitions && this.toolDefinitions.length > 0) {
            this.toolDefinitions.forEach(toolDef => {
                const openAITool = {
                    type: 'function',
                    function: {
                        name: toolDef.name,
                        description: toolDef.description,
                        parameters: toolDef.inputSchema || {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }
                };
                mcpTools.push(openAITool);
            });
        } else {
            // Fallback: create basic definitions for available tool names
            this.availableTools.forEach(toolName => {
                mcpTools.push({
                    type: 'function',
                    function: {
                        name: toolName,
                        description: `NetApp ONTAP ${toolName} operation`,
                        parameters: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }
                });
            });
        }

        return mcpTools;
    }

    async handleToolCalls(originalMessage, toolCalls, recursionDepth = 0) {
        const MAX_RECURSION_DEPTH = 3; // Allow 3 rounds of tool calls for complete analysis
        
        if (recursionDepth >= MAX_RECURSION_DEPTH) {
            console.warn('Maximum tool call recursion depth reached. Stopping tool execution.');
            return {
                text: '⚠️ I\'ve completed the initial analysis but reached the maximum number of tool executions. Based on the information gathered, I can see the available clusters. Please ask me for a specific recommendation like "recommend the best aggregate on greg-vsim-2 for a 100GB volume".',
                actions: []
            };
        }

        console.log(`Handling tool calls (depth: ${recursionDepth + 1}/${MAX_RECURSION_DEPTH}):`, toolCalls.map(t => t.function.name));

        // Execute all tool calls
        const toolResults = [];
        for (const toolCall of toolCalls) {
            try {
                const result = await this.executeMCPTool(toolCall);
                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: toolCall.function.name,
                    content: result
                });
            } catch (error) {
                console.error(`Failed to execute tool ${toolCall.function.name}:`, error);
                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: toolCall.function.name,
                    content: `Error executing tool: ${error.message}`
                });
            }
        }

        // Send results back to ChatGPT
        return await this.getChatGPTResponseWithToolResults(originalMessage, toolCalls, toolResults, recursionDepth + 1);
    }

    async executeMCPTool(toolCall) {
        const { function: func } = toolCall;
        const { name, arguments: args } = func;

        try {
            const parsedArgs = JSON.parse(args);
            const response = await fetch(`${this.demo.mcpUrl}/api/tools/${name}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(parsedArgs)
            });

            if (!response.ok) {
                throw new Error(`MCP API error: ${response.status}`);
            }

            const data = await response.json();

            // Extract text content from MCP response
            const textContent = data.content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('');

            return textContent;
        } catch (error) {
            console.error(`Error executing MCP tool ${name}:`, error);
            return `Error: Failed to execute ${name} - ${error.message}`;
        }
    }

    async getChatGPTResponseWithToolResults(originalMessage, toolCalls, toolResults, recursionDepth = 0) {
        const systemPrompt = this.buildSystemPrompt();
        const conversationHistory = this.buildConversationHistory();
        const tools = this.buildMCPTools();

        // Build the messages including the tool calls and results
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: originalMessage },
            { 
                role: 'assistant', 
                content: null,
                tool_calls: toolCalls
            },
            ...toolResults
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: messages,
                max_completion_tokens: this.config.max_completion_tokens,
                tools: tools,
                tool_choice: recursionDepth >= 2 ? 'none' : 'auto' // Force ChatGPT to respond without tools after 2 recursions
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`ChatGPT API error: ${response.status} ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        
        // Handle potential additional tool calls (multi-step workflows) only if not at max depth
        if (choice.message?.tool_calls && choice.message.tool_calls.length > 0 && recursionDepth < 2) {
            console.log(`Additional tool calls detected at depth ${recursionDepth}, continuing workflow...`);
            return await this.handleToolCalls(originalMessage, choice.message.tool_calls, recursionDepth);
        }

        const aiResponse = choice.message?.content;
        if (!aiResponse || aiResponse.trim() === '') {
            // If ChatGPT doesn't provide content, create a summary response
            const toolNames = toolCalls.map(tc => tc.function.name).join(', ');
            return this.parseResponseActions(`I've executed the following tools: ${toolNames}. Please let me know if you need specific information from these results or try a more specific question.`);
        }

        console.log('Final ChatGPT response:', aiResponse);
        return this.parseResponseActions(aiResponse);
    }

    buildConversationHistory() {
        return this.messages
            .filter(msg => msg.role !== 'system')
            .map(msg => ({
                role: msg.role,
                content: msg.content
            }))
            .slice(-10); // Keep last 10 messages for context
    }

    parseResponseActions(response) {
        const actions = [];
        let text = response;

        // Look for "Apply to Form" patterns
        const actionPattern = /Apply to Form:\s*(\w+)/gi;
        let match;

        while ((match = actionPattern.exec(response)) !== null) {
            actions.push({
                label: "Apply to Form",
                action: match[1].toLowerCase(),
                data: {} // Would be populated based on context
            });
        }

        // Auto-detect provisioning recommendations and populate form
        if (this.isProvisioningIntent(response)) {
            const recommendations = this.extractProvisioningRecommendations(response);
            if (recommendations) {
                // Automatically populate the form with the recommendations
                setTimeout(() => {
                    this.autoPopulateForm(recommendations);
                }, 1000);
            }
        }

        return { text, actions };
    }

    isProvisioningIntent(response) {
        // Check for structured provisioning recommendation format
        if (/## PROVISIONING_RECOMMENDATION/i.test(response)) {
            return true;
        }

        // Fallback: Check for strong provisioning indicators for backward compatibility
        const provisioningIndicators = [
            /## Recommendation:/i,
            /Would you like me to proceed with creating/i,
            /Would you like me to apply.*to.*form/i,
            /Next Steps:/i,
            /best option for provisioning/i,
            /recommend.*creating.*volume/i,
            /Given.*capacities.*best option/i
        ];

        // Check for error/informational indicators that should NOT trigger provisioning
        const nonProvisioningIndicators = [
            /unable to resolve/i,
            /failed to access/i,
            /error accessing/i,
            /issue.*cluster/i,
            /cannot connect/i,
            /connection.*failed/i
        ];

        // If we find error indicators, this is NOT a provisioning intent
        if (nonProvisioningIndicators.some(pattern => pattern.test(response))) {
            return false;
        }

        // Count positive indicators - need at least 2 for backward compatibility
        const positiveCount = provisioningIndicators.filter(pattern => pattern.test(response)).length;
        return positiveCount >= 2;
    }

    extractProvisioningRecommendations(response) {
        // First, check for structured recommendation format (preferred)
        const structuredMatch = response.match(/## PROVISIONING_RECOMMENDATION(.*?)## END_PROVISIONING_RECOMMENDATION/is);
        
        if (structuredMatch) {
            return this.parseStructuredRecommendation(structuredMatch[1]);
        }

        // Fallback to legacy pattern matching for backward compatibility
        return this.parseLegacyRecommendation(response);
    }

    parseStructuredRecommendation(content) {
        const recommendations = {};
        
        // Extract structured fields
        const patterns = {
            cluster: /-\s*\*\*Cluster\*\*[:\s]*([^\n\r]+)/i,
            svm: /-\s*\*\*SVM\*\*[:\s]*([^\n\r]+)/i,
            aggregate: /-\s*\*\*Aggregate\*\*[:\s]*([^\n\r]+)/i,
            size: /-\s*\*\*Size\*\*[:\s]*(\d+(?:\.\d+)?)\s*(MB|GB|TB)/i,
            protocol: /-\s*\*\*Protocol\*\*[:\s]*([^\n\r]+)/i,
            snapshot_policy: /-\s*\*\*Snapshot_Policy\*\*[:\s]*([^\n\r]+)/i,
            export_policy: /-\s*\*\*Export_Policy\*\*[:\s]*([^\n\r]+)/i
        };

        // Extract each field
        for (const [field, pattern] of Object.entries(patterns)) {
            const match = content.match(pattern);
            if (match) {
                if (field === 'size') {
                    recommendations.size = match[1];
                    recommendations.unit = match[2] || 'GB';
                } else {
                    // Clean up the value by removing backticks and trimming
                    recommendations[field] = match[1].replace(/[`'"]/g, '').trim();
                }
            }
        }

        console.log('Parsed structured recommendation:', recommendations);
        return Object.keys(recommendations).length > 0 ? recommendations : null;
    }

    parseLegacyRecommendation(response) {
        // Look for cluster/SVM/aggregate recommendations in various formats
        // Pattern: "- **Cluster**: `greg-vsim-2`" or "**Cluster**: `greg-vsim-2`"
        const clusterMatch = response.match(/-\s*\*\*Cluster\*\*[:\s]*`([^`]+)`/i) ||
                            response.match(/\*\*Cluster\*\*[:\s]*`([^`]+)`/i) ||
                            response.match(/\*\*Cluster[:\s]*\*\*[:\s]*`?([^`\s,\n"]+)`?/i) ||
                            response.match(/Cluster[:\s]+`([^`]+)`/i) ||
                            response.match(/(?:greg-vsim-[12]|julia-vsim-1|karan-ontap-1)/i);
                            
        // Pattern: "- **SVM**: `svm1`" or "**SVM**: `svm1`"  
        const svmMatch = response.match(/-\s*\*\*SVM\*\*[:\s]*`([^`]+)`/i) ||
                        response.match(/\*\*SVM\*\*[:\s]*`([^`]+)`/i) ||
                        response.match(/\*\*SVM[:\s]*\*\*[:\s]*`([^`]+)`/i) ||
                        response.match(/SVM[:\s]*`([^`]+)`/i) ||
                        // Added: SVM without backticks
                        response.match(/-\s*\*\*SVM\*\*[:\s]*([a-zA-Z0-9_][^\s,\n]*)/i) ||
                        response.match(/\*\*SVM\*\*[:\s]*([a-zA-Z0-9_][^\s,\n]*)/i) ||
                        response.match(/using\s+SVM\s+`([^`]+)`/i) ||
                        response.match(/SVMs?\s*Available[^:]*:\s*`?([^`\s,\n]+)`?/i);
                        
        // Pattern: "- **Aggregate**: `storage_availability_zone_0`" or "**Aggregate**: `storage_availability_zone_0`"
        const aggregateMatch = response.match(/-\s*\*\*Aggregate\*\*[:\s]*`([^`]+)`/i) ||
                              response.match(/\*\*Aggregate\*\*[:\s]*`([^`]+)`/i) ||
                              response.match(/\*\*Aggregate[:\s]*\*\*[:\s]*`?([^`\s,\n*]+)`?/i) ||
                              response.match(/Aggregate[:\s]*`([^`]+)`/i) ||
                              response.match(/aggregate[^:]*:\s*`([^`]+)`/i) ||
                              response.match(/aggregate[^:]*:\s*([a-zA-Z0-9_][^\s,\n]*)/i) ||
                              // Enhanced: Match aggregate names in narrative text like "using sti245_vsim_ocvs026b_aggr1"
                              response.match(/(?:use|using|recommend|recommended?)\s+(?:aggregate\s+)?`?([a-z0-9_]+_aggr[a-z0-9_]*)`?/i) ||
                              response.match(/`([a-z0-9_]+_aggr[a-z0-9_]*)`/i);
        
        // Enhanced size matching for "100 MB" or "100MB"
        const sizeMatch = response.match(/(\d+(?:\.\d+)?)\s*(MB|GB|TB)/i);
        
        // If we found a size match, let's see if we can find the original request size
        const requestSizeMatch = response.match(/provision\s+(?:a\s+)?(\d+(?:\.\d+)?)\s*(MB|GB|TB)/i);
        
        const volumeMatch = response.match(/(?:volume|Volume)(?:\s+name)?:\s*([^\s,\n]+)/i);

        // Fallback extraction for known values from the response structure
        let cluster, svm, aggregate;
        
        // Extract cluster names from the response text
        if (response.includes('greg-vsim-1')) cluster = 'greg-vsim-1';
        else if (response.includes('greg-vsim-2')) cluster = 'greg-vsim-2';
        else if (response.includes('karan-ontap-1')) cluster = 'karan-ontap-1';
        else if (response.includes('julia-vsim-1')) cluster = 'julia-vsim-1';
        
        // Extract SVM names - look for common patterns
        if (response.includes('vs0')) svm = 'vs0';
        else if (response.includes('svm1')) svm = 'svm1';  // Added this line
        else if (response.includes('vs123')) svm = 'vs123';
        else if (response.includes('svm143')) svm = 'svm143';
        
        // Extract aggregate names - look for specific aggregate patterns
        if (response.includes('sti245_vsim_ocvs026a_aggr1')) aggregate = 'sti245_vsim_ocvs026a_aggr1';
        else if (response.includes('sti245_vsim_ocvs026b_aggr1')) aggregate = 'sti245_vsim_ocvs026b_aggr1';
        else if (response.includes('sti248_vsim_ocvs076k_aggr1')) aggregate = 'sti248_vsim_ocvs076k_aggr1';
        else if (response.includes('sti248_vsim_ocvs076l_aggr1')) aggregate = 'sti248_vsim_ocvs076l_aggr1';
        else if (response.includes('storage_availability_zone_0')) aggregate = 'storage_availability_zone_0';
        
        // Enhanced aggregate detection - look for any aggregate-like names in backticks
        if (!aggregate) {
            const backtickedAggrMatch = response.match(/`([a-z0-9_]+(?:aggr|storage|zone)[a-z0-9_]*)`/gi);
            if (backtickedAggrMatch && backtickedAggrMatch.length > 0) {
                // Take the first found aggregate name
                aggregate = backtickedAggrMatch[0].replace(/`/g, '');
            }
        }
        
        // Generic aggregate matching - look for common aggregate naming patterns
        const genericAggregateMatch = response.match(/\b([a-zA-Z0-9_]+(?:aggr|aggregate|storage)[a-zA-Z0-9_]*)\b/i);
        if (!aggregate && genericAggregateMatch) {
            const foundAggregate = genericAggregateMatch[1];
            // Validate it's not just 'aggregate' or 'storage' by itself
            if (foundAggregate.length > 8 && !foundAggregate.match(/^(aggregate|storage)$/i)) {
                aggregate = foundAggregate;
            }
        }

        // Use regex matches if available, otherwise use fallback values
        const recommendations = {};
        
        // For cluster, prioritize specific known cluster names over generic regex matches
        if (cluster) {
            recommendations.cluster = cluster;
        } else if (clusterMatch && clusterMatch[1]) {
            // Clean up cluster name by removing quotes and validate it's a known cluster
            const cleanCluster = clusterMatch[1].replace(/['"]/g, '');
            if (['greg-vsim-1', 'greg-vsim-2', 'julia-vsim-1', 'karan-ontap-1'].includes(cleanCluster)) {
                recommendations.cluster = cleanCluster;
            }
        }
        
        if (svmMatch && svmMatch[1]) {
            recommendations.svm = svmMatch[1].replace(/['"]/g, '');
        } else if (svm) {
            recommendations.svm = svm;
        }
        
        if (aggregateMatch && aggregateMatch[1]) {
            const extractedAggregate = aggregateMatch[1].replace(/['"*]/g, '').trim();
            if (extractedAggregate && extractedAggregate.length > 2) { // Ignore very short matches like "**"
                recommendations.aggregate = extractedAggregate;
            }
        } else if (aggregate) {
            recommendations.aggregate = aggregate;
        }
        
        if (sizeMatch || requestSizeMatch) {
            // Prefer the request size over other size values in the response
            const preferredMatch = requestSizeMatch || sizeMatch;
            recommendations.size = preferredMatch[1];
            recommendations.unit = preferredMatch[2] || 'GB';
        }
        
        if (volumeMatch) recommendations.volume_name = volumeMatch[1];

        // Check if we have enough info for a recommendation
        if (recommendations.cluster || recommendations.svm || recommendations.aggregate) {
            return recommendations;
        }

        return null;
    }

    // Helper function to wait for an element to exist
    waitForElement(elementId, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkElement = () => {
                const element = document.getElementById(elementId);
                if (element) {
                    console.log(`Element ${elementId} found after ${Date.now() - startTime}ms`);
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    console.error(`Element ${elementId} not found within ${timeout}ms. Available elements:`, Array.from(document.querySelectorAll('[id]')).map(el => el.id));
                    reject(new Error(`Element ${elementId} not found within ${timeout}ms`));
                } else {
                    if ((Date.now() - startTime) % 1000 < 100) {
                        console.log(`Still waiting for element ${elementId}... (${Math.round((Date.now() - startTime)/1000)}s elapsed)`);
                    }
                    setTimeout(checkElement, 100);
                }
            };
            checkElement();
        });
    }

    // Helper function to wait for dropdown to have options
    waitForDropdownOptions(elementId, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkOptions = () => {
                const element = document.getElementById(elementId);
                if (element && element.options && element.options.length > 1) {
                    // Check that we have actual data options, not just loading/placeholder text
                    const hasRealOptions = Array.from(element.options).some(option => 
                        option.value && 
                        option.value !== '' && 
                        !option.text.includes('Loading') && 
                        !option.text.includes('Select SVM') &&
                        !option.text.includes('Error')
                    );
                    
                    if (hasRealOptions) {
                        console.log(`Dropdown ${elementId} populated with real options after ${Date.now() - startTime}ms`);
                        resolve(element);
                    } else if (Date.now() - startTime > timeout) {
                        console.log(`Dropdown ${elementId} options not loaded within ${timeout}ms`);
                        resolve(null); // Don't reject, just resolve with null
                    } else {
                        if ((Date.now() - startTime) % 2000 < 200) {
                            console.log(`Waiting for ${elementId} real options... Current options:`, Array.from(element.options).map(o => o.text));
                        }
                        setTimeout(checkOptions, 200);
                    }
                } else if (Date.now() - startTime > timeout) {
                    console.log(`Dropdown ${elementId} options not loaded within ${timeout}ms`);
                    resolve(null); // Don't reject, just resolve with null
                } else {
                    setTimeout(checkOptions, 200);
                }
            };
            checkOptions();
        });
    }

    async autoPopulateForm(recommendations) {
        // Ensure correct cluster is selected (update even if one is already selected)
        if (recommendations.cluster) {
            // Find the cluster object, not just set the name
            const clusterObj = this.demo.clusters.find(c => c.name === recommendations.cluster);
            if (clusterObj) {
                const previousCluster = this.demo.selectedCluster?.name;
                this.demo.selectedCluster = clusterObj;
                console.log('Cluster object found and set:', clusterObj);
                
                // Also update the radio button selection
                const radio = document.querySelector(`input[name="selectedCluster"][value="${recommendations.cluster}"]`);
                if (radio) {
                    radio.checked = true;
                    console.log('Radio button selected for cluster:', recommendations.cluster);
                } else {
                    console.warn('Radio button not found for cluster:', recommendations.cluster);
                }
                
                // If we switched clusters, we need to let the UI update before proceeding
                if (previousCluster !== recommendations.cluster) {
                    console.log('Cluster switched from', previousCluster, 'to', recommendations.cluster, '- waiting for UI update');
                    // Give the UI time to process the cluster change
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                console.warn('Cluster object not found for:', recommendations.cluster);
            }
        }
        
        // Show provisioning pane if not visible
        console.log('Attempting to open provisioning storage...');
        
        // Ensure we have proper cluster selection before opening panel
        if (!this.demo.selectedCluster) {
            console.error('No cluster selected, cannot open provisioning panel');
            this.addMessage('assistant', '⚠️ Cannot open provisioning form - no cluster is selected. Please select a cluster first.');
            return;
        }
        
        // Open the provisioning panel
        this.demo.openProvisionStorage();
        
        try {
            // Wait longer for provisioning pane to open and DOM to be ready
            console.log('Waiting for provisioning panel DOM elements...');
            await this.waitForElement('provisioningPanel', 3000);
            
            // Wait a bit more for the panel to fully render
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Now wait for the SVM select dropdown to be created
            await this.waitForElement('svmSelect', 5000);
            
            // If we switched clusters, force reload the provisioning data
            if (recommendations.cluster) {
                console.log('Forcing reload of provisioning data for cluster:', recommendations.cluster);
                await this.demo.loadProvisioningData();
                // Wait a bit longer for the fresh data to load
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            // Wait for SVM dropdown to be populated (not just loading state)  
            console.log('Waiting for SVM dropdown to be populated...');
            await this.waitForDropdownOptions('svmSelect', 15000); // Increased timeout for cluster switches
            
            let populated = false;
            
            // Step 1: Populate SVM first (this triggers loading of aggregates and export policies)
            if (recommendations.svm) {
                console.log('Populating SVM:', recommendations.svm);
                const svmSelect = document.getElementById('svmSelect');
                if (svmSelect && svmSelect.options.length > 0) {
                    console.log('Available SVM options:', Array.from(svmSelect.options).map(o => `"${o.value}"`));
                    for (let option of svmSelect.options) {
                        console.log('Checking SVM option:', `"${option.value}"`, 'against recommendation:', `"${recommendations.svm}"`);
                        if (option.value.toLowerCase() === recommendations.svm.toLowerCase()) {
                            svmSelect.value = option.value;
                            // Trigger change event to load aggregates, export policies, etc.
                            svmSelect.dispatchEvent(new Event('change'));
                            populated = true;
                            console.log('SVM matched and populated:', option.value);
                            break;
                        }
                    }
                } else {
                    console.log('SVM select not ready or has no options');
                }
                
                // Wait for aggregate dropdown to be populated after SVM change
                await this.waitForDropdownOptions('aggregateSelect', 3000);
            }
            
            // Step 2: Populate aggregate (must be specified by ChatGPT)
            if (recommendations.aggregate) {
                const aggregateSelect = document.getElementById('aggregateSelect');
                if (aggregateSelect && aggregateSelect.options.length > 0) {
                    let aggregateSet = false;
                    for (let option of aggregateSelect.options) {
                        // Skip empty option values (like "Select aggregate...")
                        if (!option.value || option.value.trim() === '') {
                            continue;
                        }
                        if (option.value.toLowerCase().includes(recommendations.aggregate.toLowerCase()) ||
                            recommendations.aggregate.toLowerCase().includes(option.value.toLowerCase())) {
                            aggregateSelect.value = option.value;
                            populated = true;
                            aggregateSet = true;
                            break;
                        }
                    }
                    if (!aggregateSet) {
                        // If ChatGPT provided a valid aggregate but it's not in the dropdown,
                        // add it to the dropdown and select it
                        if (recommendations.aggregate && recommendations.aggregate.length > 0) {
                            const newOption = document.createElement('option');
                            newOption.value = recommendations.aggregate;
                            newOption.text = recommendations.aggregate; // No extra text
                            aggregateSelect.appendChild(newOption);
                            aggregateSelect.value = recommendations.aggregate;
                            populated = true;
                        }
                    }
                }
            } else {
                // No aggregate specified in recommendations - user must select manually or ask ChatGPT for specific aggregate recommendation
            }
            
            // Step 3: Handle protocol-specific settings
            if (recommendations.protocol) {
                console.log('Setting protocol:', recommendations.protocol);
                const nfsRadio = document.getElementById('protocolNfs');
                const cifsRadio = document.getElementById('protocolCifs');
                
                if (recommendations.protocol.toLowerCase() === 'nfs' && nfsRadio) {
                    nfsRadio.checked = true;
                    nfsRadio.dispatchEvent(new Event('change'));
                    
                    // Wait for export policy dropdown to load after protocol change
                    await this.waitForDropdownOptions('exportPolicySelect', 2000);
                    
                    // Populate export policy if specified
                    if (recommendations.export_policy) {
                        const exportPolicySelect = document.getElementById('exportPolicySelect');
                        if (exportPolicySelect) {
                            for (let option of exportPolicySelect.options) {
                                if (option.value.toLowerCase().includes(recommendations.export_policy.toLowerCase())) {
                                    exportPolicySelect.value = option.value;
                                    populated = true;
                                    break;
                                }
                            }
                        }
                    }
                } else if (recommendations.protocol.toLowerCase() === 'cifs' && cifsRadio) {
                    cifsRadio.checked = true;
                    cifsRadio.dispatchEvent(new Event('change'));
                    populated = true;
                }
            }
            
            // Step 4: Handle snapshot policy if specified
            if (recommendations.snapshot_policy) {
                console.log('Setting snapshot policy:', recommendations.snapshot_policy);
                const snapshotPolicySelect = document.getElementById('snapshotPolicySelect');
                if (snapshotPolicySelect) {
                    // Wait for snapshot policy dropdown to be available
                    await this.waitForDropdownOptions('snapshotPolicySelect', 2000);
                    
                    for (let option of snapshotPolicySelect.options) {
                        if (option.value.toLowerCase().includes(recommendations.snapshot_policy.toLowerCase())) {
                            snapshotPolicySelect.value = option.value;
                            populated = true;
                            console.log('Snapshot policy populated:', option.value);
                            break;
                        }
                    }
                }
            }
            
            // Step 5: Populate volume name (or generate a default one)
            const nameInput = document.getElementById('volumeName');
            console.log('Volume name input element found:', !!nameInput);
            if (nameInput) {
                if (recommendations.volume_name) {
                    nameInput.value = recommendations.volume_name;
                    console.log('Volume name populated from recommendations:', recommendations.volume_name);
                } else {
                    // Generate a default volume name based on SVM and size
                    const svm = recommendations.svm || 'vol';
                    const size = recommendations.size || '100';
                    const unit = (recommendations.unit || 'GB').toLowerCase();
                    const timestamp = new Date().toISOString().slice(5, 16).replace(/[-:]/g, '');
                    const generatedName = `${svm}_vol_${size}${unit}_${timestamp}`;
                    nameInput.value = generatedName;
                    console.log('Generated volume name:', generatedName, 'with values:', {svm, size, unit, timestamp});
                }
                populated = true;
            } else {
                console.warn('Volume name input element not found - cannot populate volume name');
            }
            
            // Step 6: Populate size
            if (recommendations.size) {
                const sizeInput = document.getElementById('volumeSize');
                if (sizeInput) {
                    // Format the size properly (e.g., "100GB")
                    const sizeValue = recommendations.size + (recommendations.unit || 'GB');
                    sizeInput.value = sizeValue;
                    populated = true;
                }
            }
            
            // Show confirmation message if we populated anything
            if (populated) {
                this.addMessage('assistant', '✅ I\'ve automatically populated the provisioning form with my recommendations. Please review the settings and click "Create Volume" when ready!');
            } else {
                this.addMessage('assistant', '⚠️ I opened the provisioning form but couldn\'t auto-populate all fields. Please fill in the form manually based on my recommendations above.');
            }
            
        } catch (error) {
            console.error('Error auto-populating form:', error);
            
            // Check if the provisioning panel exists but elements are missing
            const panel = document.getElementById('provisioningPanel');
            if (panel) {
                console.log('Provisioning panel exists, but elements may not be ready');
                console.log('Available form elements:', Array.from(panel.querySelectorAll('[id]')).map(el => el.id));
                this.addMessage('assistant', '⚠️ I opened the provisioning form but the form elements weren\'t ready yet. Please fill in the form manually based on my recommendations above, or try asking again.');
            } else {
                console.log('Provisioning panel does not exist');
                this.addMessage('assistant', '⚠️ I couldn\'t open the provisioning form. Please ensure a cluster is selected and try again.');
            }
        }
    }

    addMessage(role, content, actions = []) {
        this.messages.push({ role, content, timestamp: new Date() });

        const messagesContainer = document.getElementById('chatbotMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chatbot-message ${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'chatbot-message-avatar';
        avatar.textContent = role === 'user' ? 'U' : 'AI';

        const messageContent = document.createElement('div');
        messageContent.className = 'chatbot-message-content';
        messageContent.innerHTML = this.formatMessage(content);

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);

        // Add action buttons
        if (actions && actions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'chatbot-message-actions';

            actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'chatbot-action-button';
                button.textContent = action.label;
                button.onclick = () => this.handleAction(action);
                actionsDiv.appendChild(button);
            });

            messageContent.appendChild(actionsDiv);
        }

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    formatMessage(content) {
        // Convert markdown-style formatting to HTML
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    handleAction(action) {
        switch (action.action) {
            case 'apply_volume_form':
                this.applyVolumeFormData(action.data);
                break;
            case 'apply_cifs_form':
                this.applyCifsFormData(action.data);
                break;
            default:
                console.warn('Unknown action:', action);
        }
    }

    applyVolumeFormData(data) {
        // Show provisioning pane if not visible
        this.demo.openProvisionStorage();
        
        // Populate form fields
        setTimeout(() => {
            if (data.cluster) {
                const clusterSelect = document.getElementById('targetCluster');
                if (clusterSelect) clusterSelect.value = data.cluster;
            }
            if (data.svm) {
                const svmSelect = document.getElementById('svm');
                if (svmSelect) svmSelect.value = data.svm;
            }
            if (data.volume_name) {
                const nameInput = document.getElementById('volumeName');
                if (nameInput) nameInput.value = data.volume_name;
            }
            if (data.size) {
                const sizeInput = document.getElementById('volumeSize');
                if (sizeInput) sizeInput.value = data.size.replace('GB', '');
                const unitSelect = document.getElementById('volumeUnit');
                if (unitSelect) unitSelect.value = 'GB';
            }
            
            this.addMessage('assistant', '✅ Form populated with recommended settings. Please review and submit when ready.');
        }, 500);
    }

    applyCifsFormData(data) {
        // Similar to volume form but for CIFS
        this.demo.openProvisionStorage();
        
        setTimeout(() => {
            // Switch to CIFS mode
            const cifsRadio = document.querySelector('input[value="cifs"]');
            if (cifsRadio) cifsRadio.click();
            
            // Populate CIFS-specific fields
            if (data.share_name) {
                const shareInput = document.getElementById('cifsShareName');
                if (shareInput) shareInput.value = data.share_name;
            }
            
            this.addMessage('assistant', '✅ CIFS share form populated with recommended settings. Please review and submit when ready.');
        }, 500);
    }

    showThinking() {
        this.isThinking = true;
        const thinkingMsg = document.createElement('div');
        thinkingMsg.className = 'chatbot-message assistant thinking';
        thinkingMsg.id = 'thinking-message';

        const avatar = document.createElement('div');
        avatar.className = 'chatbot-message-avatar';
        avatar.textContent = 'AI';

        const content = document.createElement('div');
        content.className = 'chatbot-message-content';
        content.innerHTML = `Thinking<span class="chatbot-thinking-dots"><span></span><span></span><span></span></span>`;

        thinkingMsg.appendChild(avatar);
        thinkingMsg.appendChild(content);

        const messagesContainer = document.getElementById('chatbotMessages');
        messagesContainer.appendChild(thinkingMsg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideThinking() {
        this.isThinking = false;
        const thinkingMsg = document.getElementById('thinking-message');
        if (thinkingMsg) {
            thinkingMsg.remove();
        }
    }

    toggleSendButton(enabled) {
        const sendBtn = document.getElementById('chatbotSend');
        if (sendBtn) {
            sendBtn.disabled = !enabled || this.isThinking;
        }
    }

    enableInput() {
        const input = document.getElementById('chatbotInput');
        const sendBtn = document.getElementById('chatbotSend');
        
        if (input) input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
    }

    updateStatus(message, isError = false) {
        const status = document.getElementById('chatbotStatus');
        if (status) {
            status.textContent = message;
            status.className = `chatbot-status ${isError ? 'error' : ''}`;
        }
    }
}

// Initialize export policy modal
let exportPolicyModal;
document.addEventListener('DOMContentLoaded', () => {
    exportPolicyModal = new ExportPolicyModal();
    
    // Set up export policy dropdown listener using event delegation
    // This works for dynamically created elements
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'exportPolicy') {
            if (e.target.value === 'NEW_EXPORT_POLICY') {
                exportPolicyModal.open();
                // Reset to previous value while modal is open
                e.target.value = '';
            }
        }
    });
});

// Global service button handlers (called from HTML)
window.openVolumes = () => app.openVolumes();
window.openSnapshots = () => app.openSnapshots();
window.openExports = () => app.openExports();
window.openCifsShares = () => app.openCifsShares();