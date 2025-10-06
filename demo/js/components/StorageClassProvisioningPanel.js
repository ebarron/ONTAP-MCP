// NetApp ONTAP Storage Class Provisioning Panel Component
// Handles storage class-based provisioning workflow

class StorageClassProvisioningPanel {
    constructor(demo) {
        this.demo = demo;
        this.apiClient = demo.apiClient;
        this.notifications = demo.notifications;
        this.selectedStorageClass = null;
    }

    // Main entry point to show the storage class provisioning panel
    show() {
        console.log('showStorageClassProvisioningPanel called');
        
        console.log('Creating/showing storage class provisioning panel...');
        // Create or show the right-side expansion panel
        let panel = document.getElementById('storageClassProvisioningPanel');
        if (!panel) {
            console.log('Creating new storage class provisioning panel');
            panel = this.createPanel();
            console.log('Panel created, appending to body...');
            document.body.appendChild(panel);
        } else {
            console.log('Using existing storage class provisioning panel');
        }
        
        // Trigger the expansion animation
        console.log('Making panel visible');
        panel.classList.add('visible');
        document.body.classList.add('panel-open');
        
        // Load initial data
        console.log('Loading storage class provisioning data');
        this.loadData();
    }

    // Create the HTML structure for the storage class provisioning panel
    createPanel() {
        console.log('createStorageClassProvisioningPanel called');
        const panel = document.createElement('div');
        panel.id = 'storageClassProvisioningPanel';
        panel.className = 'right-panel';
        panel.innerHTML = `
            <div class="panel-content">
                <div class="panel-header">
                    <h2>Provision Storage with Storage Class</h2>
                    <button class="panel-close" onclick="app.storageClassProvisioningPanel.close()">×</button>
                </div>
                <div class="panel-body">
                    
                    <!-- Storage Class Section -->
                    <div class="form-section">
                        <h3>Storage Class</h3>
                        <div class="form-group">
                            <label for="storageClassSelect">Storage Class</label>
                            <select id="storageClassSelect" name="storageClassSelect" required onchange="app.storageClassProvisioningPanel.handleStorageClassChange()">
                                <option value="">Select a Storage Class...</option>
                            </select>
                        </div>
                        <div id="storageClassDetails" class="storage-class-details-display" style="display: none;">
                            <div class="detail-row">
                                <span class="detail-label">QoS Policy:</span>
                                <span id="selectedQosPolicy">-</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Snapshot Policy:</span>
                                <span id="selectedSnapshotPolicy">-</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Target Cluster:</span>
                                <span id="selectedCluster">-</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Target SVM:</span>
                                <span id="selectedSvm">-</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Target Aggregate:</span>
                                <span id="selectedAggregate">-</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Details Section -->
                    <div class="form-section">
                        <h3>Details</h3>
                        <div class="form-group">
                            <label for="scVolumeName">Volume Name</label>
                            <input type="text" id="scVolumeName" name="scVolumeName" 
                                   placeholder="e.g., my_volume_name (alphanumeric and _ only)" 
                                   pattern="[a-zA-Z0-9_]+" 
                                   title="Only letters, numbers, and underscores allowed"
                                   required>
                        </div>
                        <div class="form-group">
                            <label for="scVolumeSize">Volume Size</label>
                            <input type="text" id="scVolumeSize" name="scVolumeSize" placeholder="e.g., 100GB" required>
                        </div>
                    </div>
                    
                    <!-- Protocol Section -->
                    <div class="form-section">
                        <h3>Protocol</h3>
                        <div class="form-group">
                            <label>Access Protocol</label>
                            <div class="radio-group">
                                <label>
                                    <input type="radio" name="scProtocol" id="scProtocolNfs" value="nfs" checked onchange="app.storageClassProvisioningPanel.handleProtocolChange()">
                                    NFS
                                </label>
                                <label>
                                    <input type="radio" name="scProtocol" id="scProtocolCifs" value="cifs" onchange="app.storageClassProvisioningPanel.handleProtocolChange()">
                                    CIFS/SMB
                                </label>
                            </div>
                        </div>
                        
                        <div id="scNfsOptions" class="protocol-options">
                            <div class="form-group">
                                <label for="scExportPolicy">Export Policy</label>
                                <select id="scExportPolicy" name="scExportPolicy">
                                    <option value="">Select Storage Class first...</option>
                                </select>
                            </div>
                        </div>
                        
                        <div id="scCifsOptions" class="protocol-options" style="display: none;">
                            <div class="form-group">
                                <label for="scCifsShareName">CIFS Share Name</label>
                                <input type="text" id="scCifsShareName" name="scCifsShareName">
                            </div>
                            <div class="form-group">
                                <label for="scShareComment">Share Comment (Optional)</label>
                                <input type="text" id="scShareComment" name="scShareComment">
                            </div>
                            <div class="form-group">
                                <label for="scCifsUsers">Users/Groups</label>
                                <input type="text" id="scCifsUsers" name="scCifsUsers" value="Everyone" placeholder="e.g., Everyone, DOMAIN\\username">
                            </div>
                            <div class="form-group">
                                <label for="scCifsPermissions">Permissions</label>
                                <select id="scCifsPermissions" name="scCifsPermissions">
                                    <option value="full_control" selected>Full Control</option>
                                    <option value="change">Change</option>
                                    <option value="read">Read</option>
                                    <option value="no_access">No Access</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="app.storageClassProvisioningPanel.close()">Cancel</button>
                        <button type="button" class="btn-primary" onclick="app.storageClassProvisioningPanel.handleProvisioning()">Create Volume</button>
                    </div>
                </div>
            </div>
        `;
        return panel;
    }

    // Close the storage class provisioning panel
    close() {
        const panel = document.getElementById('storageClassProvisioningPanel');
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

    // Load data for storage class provisioning
    async loadData() {
        try {
            await this.loadStorageClasses();
        } catch (error) {
            console.error('Failed to load storage class provisioning data:', error);
            this.notifications.showError('Failed to load storage class data');
        }
    }

    // Load available storage classes into dropdown
    async loadStorageClasses() {
        const storageClassSelect = document.getElementById('storageClassSelect');
        if (!storageClassSelect) return;

        // Clear existing options
        storageClassSelect.innerHTML = '<option value="">Select a Storage Class...</option>';

        // Add storage classes from the demo data
        this.demo.storageClasses.forEach(storageClass => {
            const option = document.createElement('option');
            option.value = storageClass.name;
            option.textContent = storageClass.name;
            option.dataset.qosPolicy = storageClass.qosPolicy;
            option.dataset.snapshotPolicy = storageClass.snapshotPolicy;
            storageClassSelect.appendChild(option);
        });

        console.log('Storage classes loaded:', this.demo.storageClasses.length);
    }

    // Handle storage class selection change
    handleStorageClassChange() {
        const storageClassSelect = document.getElementById('storageClassSelect');
        const selectedOption = storageClassSelect.selectedOptions[0];
        
        if (!selectedOption || !selectedOption.value) {
            this.selectedStorageClass = null;
            this.hideStorageClassDetails();
            this.clearExportPolicyDropdown();
            return;
        }

        // Find the selected storage class
        this.selectedStorageClass = this.demo.storageClasses.find(sc => sc.name === selectedOption.value);
        
        if (this.selectedStorageClass) {
            this.showStorageClassDetails();
            console.log('Storage class selected:', this.selectedStorageClass.name);
            
            // Load export policies for NFS if protocol is NFS
            const isNfsSelected = document.getElementById('scProtocolNfs')?.checked;
            if (isNfsSelected) {
                this.loadExportPolicies();
            }
        }
    }

    // Clear export policy dropdown
    clearExportPolicyDropdown() {
        const exportSelect = document.getElementById('scExportPolicy');
        if (exportSelect) {
            exportSelect.innerHTML = '<option value="">Select Storage Class first...</option>';
            exportSelect.disabled = true;
        }
    }

    // Load export policies for the storage class form
    async loadExportPolicies() {
        const exportSelect = document.getElementById('scExportPolicy');
        if (!exportSelect) return;

        try {
            // Set loading state
            exportSelect.innerHTML = '<option value="">Loading export policies...</option>';
            exportSelect.disabled = true;

            // Get cluster and SVM from the details (if available)
            const clusterSpan = document.getElementById('selectedCluster');
            const svmSpan = document.getElementById('selectedSvm');
            
            console.log('Export policy loading - Cluster element:', clusterSpan, 'content:', clusterSpan?.textContent);
            console.log('Export policy loading - SVM element:', svmSpan, 'content:', svmSpan?.textContent);
            
            if (clusterSpan && svmSpan && clusterSpan.textContent !== '-' && svmSpan.textContent !== '-') {
                const response = await this.apiClient.callMcp('list_export_policies', {
                    cluster_name: clusterSpan.textContent.trim(),
                    svm_name: svmSpan.textContent.trim()
                });
                
                console.log('Export policies API response:', typeof response, response);
                
                // Clear and populate dropdown
                exportSelect.innerHTML = '<option value="">Select an Export Policy...</option>';
                
                // Response is now text from Streamable HTTP client
                const textContent = (response && typeof response === 'string') ? response : '';
                
                console.log('Extracted text content:', textContent);
                
                if (textContent && (textContent.includes('export policies') || textContent.includes('Found'))) {
                    // Parse export policies from response text
                    const lines = textContent.split('\n');
                    let policiesFound = 0;
                    lines.forEach(line => {
                        // Look for policy name pattern in the formatted response
                        const boldMatch = line.match(/🔐\s+\*\*([^*]+)\*\*/);
                        if (boldMatch) {
                            const policyName = boldMatch[1].trim();
                            const option = document.createElement('option');
                            option.value = policyName;
                            option.textContent = policyName;
                            exportSelect.appendChild(option);
                            policiesFound++;
                            console.log('Added export policy option:', policyName);
                        }
                    });
                    console.log('Total export policies added to dropdown:', policiesFound);
                } else {
                    console.log('No export policies found in response text');
                }
                
                exportSelect.disabled = false;
            } else {
                exportSelect.innerHTML = '<option value="">Need cluster and SVM first...</option>';
            }
        } catch (error) {
            console.error('Failed to load export policies:', error);
            exportSelect.innerHTML = '<option value="">Failed to load policies</option>';
        }
    }

    // Show storage class details
    showStorageClassDetails() {
        const detailsDiv = document.getElementById('storageClassDetails');
        const qosPolicySpan = document.getElementById('selectedQosPolicy');
        const snapshotPolicySpan = document.getElementById('selectedSnapshotPolicy');
        const clusterSpan = document.getElementById('selectedCluster');
        const svmSpan = document.getElementById('selectedSvm');
        const aggregateSpan = document.getElementById('selectedAggregate');
        
        if (detailsDiv && qosPolicySpan && snapshotPolicySpan && this.selectedStorageClass) {
            // Show storage class policies
            qosPolicySpan.textContent = this.selectedStorageClass.qosPolicy;
            snapshotPolicySpan.textContent = this.selectedStorageClass.snapshotPolicy;
            
            // Show recommendation details if available
            if (this.currentRecommendations) {
                clusterSpan.textContent = this.currentRecommendations.cluster || '-';
                svmSpan.textContent = this.currentRecommendations.svm || '-';
                aggregateSpan.textContent = this.currentRecommendations.aggregate || '-';
            } else {
                clusterSpan.textContent = '-';
                svmSpan.textContent = '-';
                aggregateSpan.textContent = '-';
            }
            
            detailsDiv.style.display = 'block';
            
            // Trigger export policy loading if we have cluster/SVM and NFS is selected
            const isNfsSelected = document.getElementById('scProtocolNfs')?.checked;
            if (isNfsSelected && this.currentRecommendations && this.currentRecommendations.cluster) {
                this.loadExportPolicies();
            }
        }
    }

    // Hide storage class details
    hideStorageClassDetails() {
        const detailsDiv = document.getElementById('storageClassDetails');
        if (detailsDiv) {
            detailsDiv.style.display = 'none';
        }
    }

    // Handle protocol change (NFS vs CIFS)
    handleProtocolChange() {
        const nfsRadio = document.getElementById('scProtocolNfs');
        const nfsOptions = document.getElementById('scNfsOptions');
        const cifsOptions = document.getElementById('scCifsOptions');
        
        if (nfsRadio && nfsRadio.checked) {
            nfsOptions.style.display = 'block';
            cifsOptions.style.display = 'none';
            
            // Load export policies if we have cluster and storage class selected
            if (this.selectedStorageClass && this.currentRecommendations && this.currentRecommendations.cluster) {
                this.loadExportPolicies();
            }
        } else {
            nfsOptions.style.display = 'none';
            cifsOptions.style.display = 'block';
        }
    }

    // Handle the provisioning action
    async handleProvisioning() {
        try {
            console.log('Storage Class Provisioning - handleProvisioning called');
            
            if (!this.selectedStorageClass) {
                this.notifications.showError('Please select a storage class first');
                return;
            }

            // Get form data
            const protocol = document.querySelector('input[name="scProtocol"]:checked').value;
            let volumeName = document.getElementById('scVolumeName').value.trim();
            const volumeSize = document.getElementById('scVolumeSize').value.trim();
            
            // Get target details
            const clusterName = document.getElementById('selectedCluster').textContent.trim();
            const svmName = document.getElementById('selectedSvm').textContent.trim();
            const aggregateName = document.getElementById('selectedAggregate').textContent.trim();
            
            // Basic validation
            if (!volumeName || !volumeSize) {
                this.notifications.showError('Please fill in volume name and size');
                return;
            }
            
            if (!clusterName || clusterName === '-' || !svmName || svmName === '-' || !aggregateName || aggregateName === '-') {
                this.notifications.showError('Missing target cluster, SVM, or aggregate information');
                return;
            }

            // Protocol-specific validation
            if (protocol === 'nfs') {
                const exportPolicy = document.getElementById('scExportPolicy').value;
                if (!exportPolicy) {
                    this.notifications.showError('Please select an export policy for NFS volumes');
                    return;
                }
            }

            // Sanitize volume name: ONTAP only allows alphanumeric and underscores
            const originalVolumeName = volumeName;
            volumeName = volumeName.replace(/[^a-zA-Z0-9_]/g, '_');
            
            if (originalVolumeName !== volumeName) {
                console.log(`Volume name sanitized: "${originalVolumeName}" -> "${volumeName}"`);
                this.notifications.showInfo(`Volume name adjusted to comply with ONTAP naming rules: "${volumeName}"`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Show message briefly
            }

            this.notifications.showInfo(`Creating ${protocol.toUpperCase()} volume with ${this.selectedStorageClass.name} storage class...`);

            if (protocol === 'nfs') {
                await this.createNfsVolumeWithStorageClass(volumeName, volumeSize, clusterName, svmName, aggregateName);
            } else {
                await this.createCifsVolumeWithStorageClass(volumeName, volumeSize, clusterName, svmName, aggregateName);
            }

        } catch (error) {
            console.error('Storage class provisioning error:', error);
            this.notifications.showError('Provisioning failed: ' + error.message);
        }
    }

    // Create NFS volume with storage class settings
    async createNfsVolumeWithStorageClass(volumeName, volumeSize, clusterName, svmName, aggregateName) {
        const exportPolicy = document.getElementById('scExportPolicy').value;
        
        const volumeParams = {
            cluster_name: clusterName,
            svm_name: svmName,
            volume_name: volumeName,
            size: volumeSize,
            aggregate_name: aggregateName,
            nfs_export_policy: exportPolicy
        };
        
        // Apply storage class QoS and snapshot policies if available in currentRecommendations
        if (this.currentRecommendations) {
            if (this.currentRecommendations.qos_policy) {
                volumeParams.qos_policy = this.currentRecommendations.qos_policy;
            }
            if (this.currentRecommendations.snapshot_policy) {
                volumeParams.snapshot_policy = this.currentRecommendations.snapshot_policy;
            }
        }

        console.log('Creating NFS volume with params:', volumeParams);
        const response = await this.apiClient.callMcp('cluster_create_volume', volumeParams);

        // Response is now text from Streamable HTTP client
        if (response && typeof response === 'string' && response.includes('successfully')) {
            const successMsg = `NFS volume "${volumeName}" created successfully with ${this.selectedStorageClass.name} storage class` +
                (volumeParams.qos_policy ? ` and QoS policy "${volumeParams.qos_policy}"` : '') +
                (volumeParams.snapshot_policy ? ` and snapshot policy "${volumeParams.snapshot_policy}"` : '');
            this.notifications.showSuccess(successMsg);
            this.close();
        } else {
            throw new Error(typeof response === 'string' ? response : 'Volume creation failed');
        }
    }

    // Create CIFS volume with storage class settings  
    async createCifsVolumeWithStorageClass(volumeName, volumeSize, clusterName, svmName, aggregateName) {
        // For CIFS, we'd need additional form fields for share configuration
        // For now, create a basic CIFS volume with a default share
        const shareName = volumeName + '_share';
        
        const cifsShare = {
            share_name: shareName,
            comment: `Share for ${this.selectedStorageClass.name} storage class volume`,
            access_control: [
                {
                    permission: 'full_control',
                    user_or_group: 'Everyone',
                    type: 'windows'
                }
            ]
        };

        const volumeParams = {
            cluster_name: clusterName,
            svm_name: svmName,
            volume_name: volumeName,
            size: volumeSize,
            aggregate_name: aggregateName,
            cifs_share: cifsShare
        };
        
        // Apply storage class QoS and snapshot policies if available
        if (this.currentRecommendations) {
            if (this.currentRecommendations.qos_policy) {
                volumeParams.qos_policy = this.currentRecommendations.qos_policy;
            }
            if (this.currentRecommendations.snapshot_policy) {
                volumeParams.snapshot_policy = this.currentRecommendations.snapshot_policy;
            }
        }

        console.log('Creating CIFS volume with params:', volumeParams);
        const response = await this.apiClient.callMcp('cluster_create_volume', volumeParams);

        // Response is now text from Streamable HTTP client
        if (response && typeof response === 'string' && response.includes('successfully')) {
            const successMsg = `CIFS volume "${volumeName}" with share "${shareName}" created successfully with ${this.selectedStorageClass.name} storage class` +
                (volumeParams.qos_policy ? ` and QoS policy "${volumeParams.qos_policy}"` : '') +
                (volumeParams.snapshot_policy ? ` and snapshot policy "${volumeParams.snapshot_policy}"` : '');
            this.notifications.showSuccess(successMsg);
            this.close();
        } else {
            throw new Error(typeof response === 'string' ? response : 'Volume creation failed');
        }
    }
}