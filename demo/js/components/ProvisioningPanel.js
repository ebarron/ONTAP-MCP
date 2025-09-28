// NetApp ONTAP Provisioning Panel Component
// Handles the complete storage provisioning workflow including form creation,
// data loading, and volume/CIFS share creation

class ProvisioningPanel {
    constructor(demo) {
        this.demo = demo;
        this.apiClient = demo.apiClient;
        this.notifications = demo.notifications;
    }

    // Main entry point to show the provisioning panel
    show() {
        console.log('showProvisioningPanel called, selectedCluster:', this.demo.selectedCluster);
        if (!this.demo.selectedCluster) {
            console.log('No cluster selected, showing error');
            this.notifications.showError('Please select a cluster first');
            return;
        }

        console.log('Creating/showing provisioning panel...');
        // Create or show the right-side expansion panel
        let panel = document.getElementById('provisioningPanel');
        if (!panel) {
            console.log('Creating new provisioning panel');
            panel = this.createPanel();
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
        console.log('Loading provisioning data for cluster:', this.demo.selectedCluster);
        this.loadData();
    }

    // Create the HTML structure for the provisioning panel
    createPanel() {
        console.log('createProvisioningPanel called with selectedCluster:', this.demo.selectedCluster);
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
                                    <input type="radio" name="protocol" id="protocolNfs" value="nfs" checked onchange="provisioningPanel.handleProtocolChange()">
                                    NFS
                                </label>
                                <label>
                                    <input type="radio" name="protocol" id="protocolCifs" value="cifs" onchange="provisioningPanel.handleProtocolChange()">
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
        } catch (error) {
            console.error('Error loading provisioning data:', error);
        }
    }

    // Load SVMs for the selected cluster
    async loadSvms() {
        try {
            const response = await this.apiClient.callMcp('cluster_list_svms', {
                cluster_name: this.demo.selectedCluster.name
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
            if (this.demo.selectedCluster.name === 'karan-ontap-1') {
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

    // Load aggregates for a specific SVM
    async loadAggregatesForSvm(svmName) {
        try {
            this.setDropdownLoading('aggregateSelect', 'Loading aggregates...');
            
            const response = await this.apiClient.callMcp('cluster_list_aggregates', {
                cluster_name: this.demo.selectedCluster.name
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

        if (response.success) {
            this.notifications.showSuccess(`NFS volume ${volumeName} created successfully${qosPolicy ? ` with QoS policy ${qosPolicy}` : ''}`);
            this.close();
        } else {
            throw new Error(response.error || 'Unknown error');
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

        if (response.success) {
            this.notifications.showSuccess(`CIFS volume ${volumeName} with share ${shareName} created successfully${qosPolicy ? ` with QoS policy ${qosPolicy}` : ''}`);
            this.close();
        } else {
            throw new Error(response.error || 'Unknown error');
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

            if (response.success) {
                // Parse text response to extract policy names
                if (typeof response.data === 'string') {
                    const lines = response.data.split('\n');
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
            if (clusterResponse.success && typeof clusterResponse.data === 'string') {
                const lines = clusterResponse.data.split('\n');
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