// NetApp ONTAP Storage Class Provisioning Panel Component
// Handles storage class-based provisioning workflow

class StorageClassProvisioningPanel {
    constructor(demo) {
        this.demo = demo;
        this.apiClient = demo.apiClient;
        this.notifications = demo.notifications;
        this.selectedStorageClass = null;
        this.alertRules = new ProvisioningAlertRules(demo);
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
                        <div id="storageClassDetails" class="storage-class-details-display" style="display: none;">
                            <div class="detail-row">
                                <span class="detail-label">QoS Policy:</span>
                                <span id="selectedQosPolicy">-</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Snapshot Policy:</span>
                                <span id="selectedSnapshotPolicy">-</span>
                            </div>
                            <div class="storage-class-targets-container">
                                <div class="storage-class-targets">
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
                                <button type="button" class="recommend-btn" onclick="app.storageClassProvisioningPanel.getRecommendation()" id="scRecommendBtn">
                                    Recommend...
                                </button>
                            </div>
                        </div>
                        <div class="form-group checkbox-group">
                            <label>
                                <input type="checkbox" id="scMonitorCompliance" name="scMonitorCompliance" checked>
                                Monitor Volume's Storage Class Compliance
                                <span class="alert-preview-icon" onclick="event.preventDefault(); app.storageClassProvisioningPanel.showAlertRulesPreview();" title="Preview Alert Rules">
                                    <svg role="img" aria-labelledby="ic_compliance_info" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <desc id="ic_compliance_info">Preview storage class compliance alert rules</desc>
                                        <path fill-rule="evenodd" clip-rule="evenodd" d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM7.01621 7.09091V11.8175C7.04077 12.0615 7.15313 12.2883 7.3324 12.4556C7.51167 12.623 7.74563 12.7195 7.99075 12.7273C8.24007 12.7347 8.48224 12.6434 8.6645 12.4731C8.84677 12.3028 8.95436 12.0674 8.96384 11.8182V7.09091C8.93915 6.84727 8.82692 6.62085 8.64797 6.45367C8.46903 6.28649 8.23551 6.1899 7.99075 6.18182C7.74119 6.17396 7.49864 6.26513 7.31606 6.43545C7.13348 6.60577 7.02569 6.8414 7.01621 7.09091ZM7.22882 3.22861C7.02423 3.4332 6.9093 3.71067 6.9093 4C6.90323 4.14488 6.9273 4.28944 6.97998 4.42454C7.03266 4.55964 7.1128 4.68234 7.21533 4.78487C7.31787 4.88741 7.44057 4.96755 7.57567 5.02023C7.71077 5.07291 7.85533 5.09697 8.00021 5.09091C8.14509 5.09697 8.28965 5.07291 8.42475 5.02023C8.55985 4.96755 8.68255 4.88741 8.78508 4.78487C8.88762 4.68234 8.96776 4.55964 9.02043 4.42454C9.07311 4.28944 9.09718 4.14488 9.09112 4C9.09112 3.71067 8.97618 3.4332 8.7716 3.22861C8.56701 3.02403 8.28953 2.90909 8.00021 2.90909C7.71088 2.90909 7.4334 3.02403 7.22882 3.22861Z"/>
                                    </svg>
                                </span>
                            </label>
                        </div>
                        <div class="form-group checkbox-group">
                            <label>
                                <input type="checkbox" id="scCreateGrafanaDashboard" name="scCreateGrafanaDashboard" checked>
                                Create a Grafana Dashboard for this volume?
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

        // 🔍 DIAGNOSTIC LOGGING
        console.log('🔍 VOLUME CREATION RESPONSE:');
        console.log('  Type:', typeof response);
        console.log('  Length:', response?.length);
        console.log('  Full response:', response);
        console.log('  Includes "successfully"?', response?.includes('successfully'));
        console.log('  Includes "Error"?', response?.includes('Error'));
        console.log('  Includes "❌"?', response?.includes('❌'));

        // Response is now text from Streamable HTTP client
        if (response && typeof response === 'string' && response.includes('successfully')) {
            // Create monitoring alerts if checkbox is enabled
            await this.createStorageClassMonitoringAlerts(volumeName, svmName, clusterName, volumeParams.qos_policy, volumeParams.snapshot_policy);
            
            // Create Grafana dashboard if checkbox is enabled
            await this.createVolumeGrafanaDashboard(volumeName, svmName, clusterName);
            
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
            // Create monitoring alerts if checkbox is enabled
            await this.createStorageClassMonitoringAlerts(volumeName, svmName, clusterName, volumeParams.qos_policy, volumeParams.snapshot_policy);
            
            // Create Grafana dashboard if checkbox is enabled
            await this.createVolumeGrafanaDashboard(volumeName, svmName, clusterName);
            
            const successMsg = `CIFS volume "${volumeName}" with share "${shareName}" created successfully with ${this.selectedStorageClass.name} storage class` +
                (volumeParams.qos_policy ? ` and QoS policy "${volumeParams.qos_policy}"` : '') +
                (volumeParams.snapshot_policy ? ` and snapshot policy "${volumeParams.snapshot_policy}"` : '');
            this.notifications.showSuccess(successMsg);
            this.close();
        } else {
            throw new Error(typeof response === 'string' ? response : 'Volume creation failed');
        }
    }

    // Create monitoring alerts for storage class compliance
    async createStorageClassMonitoringAlerts(volumeName, svmName, clusterName, qosPolicyName, snapshotPolicyName) {
        const monitorCompliance = document.getElementById('scMonitorCompliance').checked;
        
        if (!monitorCompliance) {
            return; // Monitoring not requested
        }

        try {
            let allAlerts = [];
            
            // Always generate capacity alerts
            const capacityAlerts = this.alertRules.generateCapacityAlertRules(volumeName, svmName, clusterName);
            allAlerts.push(...capacityAlerts);
            
            // Generate performance alerts if QoS policy is set
            if (qosPolicyName) {
                const performanceAlerts = await this.alertRules.generatePerformanceAlertRules(volumeName, svmName, clusterName, qosPolicyName);
                allAlerts.push(...performanceAlerts);
            }
            
            // Generate data protection alerts if snapshot policy is set
            if (snapshotPolicyName && snapshotPolicyName !== 'none') {
                const dataProtectionAlerts = await this.alertRules.generateDataProtectionAlertRules(volumeName, svmName, clusterName, snapshotPolicyName);
                allAlerts.push(...dataProtectionAlerts);
            }
            
            if (allAlerts.length === 0) {
                return; // No alerts to create
            }
            
            this.notifications.showInfo('Creating storage class compliance monitoring alerts...');
            
            // Create alerts using centralized method
            const results = await this.alertRules.createMonitoringAlerts(allAlerts);
            
            if (results.success) {
                console.log(`✅ Created ${results.count} storage class compliance alerts`);
            } else {
                console.warn(`⚠️  Created ${results.count}/${allAlerts.length} alerts (${results.failed} failed)`);
            }
        } catch (error) {
            console.error('Failed to create storage class monitoring alerts:', error);
            // Don't block volume creation on alert failure
        }
    }

    // Create Grafana dashboard for volume monitoring
    async createVolumeGrafanaDashboard(volumeName, svmName, clusterName) {
        const createDashboard = document.getElementById('scCreateGrafanaDashboard').checked;
        
        if (!createDashboard) {
            return; // Dashboard creation not requested
        }

        try {
            // Generate deterministic dashboard UID using hash function (max 40 chars for Grafana)
            const dashboardUid = DemoUtils.generateDashboardUid(clusterName, svmName, volumeName);
            const dashboardTitle = `Volume Compliance: ${volumeName}`;
            
            console.log(`📊 Generated dashboard UID: ${dashboardUid} (${dashboardUid.length} chars)`);
            this.notifications.showInfo('Creating Grafana dashboard for volume...');
            
            // Dashboard definition based on the medical_images template
            const dashboard = {
                dashboard: {
                    uid: dashboardUid,
                    title: dashboardTitle,
                    tags: ['ontap', 'volume', 'compliance', 'fleet-demo'],
                    timezone: 'browser',
                    schemaVersion: 38,
                    refresh: '30s',
                    panels: [
                        // Row 1: Overview Stats
                        {
                            id: 1,
                            type: 'stat',
                            title: 'Volume State',
                            gridPos: { x: 0, y: 0, w: 6, h: 4 },
                            targets: [{
                                expr: `volume_new_status{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"}`,
                                refId: 'A',
                                datasource: { type: 'prometheus', uid: 'prometheus' }
                            }],
                            options: {
                                reduceOptions: { values: false, calcs: ['lastNotNull'] },
                                text: { titleSize: 16, valueSize: 24 }
                            },
                            fieldConfig: {
                                defaults: {
                                    mappings: [
                                        { type: 'value', value: '1', text: 'Online', color: 'green' },
                                        { type: 'value', value: '0', text: 'Offline', color: 'red' }
                                    ]
                                }
                            }
                        },
                        {
                            id: 2,
                            type: 'stat',
                            title: 'Total Capacity',
                            gridPos: { x: 6, y: 0, w: 6, h: 4 },
                            targets: [{
                                expr: `volume_size{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"} / 1024 / 1024 / 1024`,
                                refId: 'A',
                                datasource: { type: 'prometheus', uid: 'prometheus' }
                            }],
                            options: {
                                reduceOptions: { values: false, calcs: ['lastNotNull'] },
                                text: { titleSize: 16, valueSize: 24 }
                            },
                            fieldConfig: {
                                defaults: { unit: 'decgbytes', decimals: 2 }
                            }
                        },
                        {
                            id: 3,
                            type: 'stat',
                            title: 'Used Capacity %',
                            gridPos: { x: 12, y: 0, w: 6, h: 4 },
                            targets: [{
                                expr: `volume_size_used_percent{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"}`,
                                refId: 'A',
                                datasource: { type: 'prometheus', uid: 'prometheus' }
                            }],
                            options: {
                                reduceOptions: { values: false, calcs: ['lastNotNull'] },
                                text: { titleSize: 16, valueSize: 24 }
                            },
                            fieldConfig: {
                                defaults: {
                                    unit: 'percent',
                                    thresholds: {
                                        mode: 'absolute',
                                        steps: [
                                            { value: 0, color: 'green' },
                                            { value: 75, color: 'yellow' },
                                            { value: 90, color: 'red' }
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            id: 4,
                            type: 'stat',
                            title: 'Available Space',
                            gridPos: { x: 18, y: 0, w: 6, h: 4 },
                            targets: [{
                                expr: `volume_size_available{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"} / 1024 / 1024 / 1024`,
                                refId: 'A',
                                datasource: { type: 'prometheus', uid: 'prometheus' }
                            }],
                            options: {
                                reduceOptions: { values: false, calcs: ['lastNotNull'] },
                                text: { titleSize: 16, valueSize: 24 }
                            },
                            fieldConfig: {
                                defaults: { unit: 'decgbytes', decimals: 2 }
                            }
                        },
                        // Row 2: Capacity Trends
                        {
                            id: 5,
                            type: 'timeseries',
                            title: 'Capacity Usage Trend',
                            gridPos: { x: 0, y: 4, w: 12, h: 8 },
                            targets: [
                                {
                                    expr: `volume_size_used{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"} / 1024 / 1024 / 1024`,
                                    refId: 'A',
                                    legendFormat: 'Used (GB)',
                                    datasource: { type: 'prometheus', uid: 'prometheus' }
                                },
                                {
                                    expr: `volume_size_available{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"} / 1024 / 1024 / 1024`,
                                    refId: 'B',
                                    legendFormat: 'Available (GB)',
                                    datasource: { type: 'prometheus', uid: 'prometheus' }
                                }
                            ],
                            fieldConfig: {
                                defaults: { unit: 'decgbytes' }
                            }
                        },
                        {
                            id: 6,
                            type: 'timeseries',
                            title: 'Capacity Utilization %',
                            gridPos: { x: 12, y: 4, w: 12, h: 8 },
                            targets: [{
                                expr: `volume_size_used_percent{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"}`,
                                refId: 'A',
                                legendFormat: 'Used %',
                                datasource: { type: 'prometheus', uid: 'prometheus' }
                            }],
                            fieldConfig: {
                                defaults: {
                                    unit: 'percent',
                                    thresholds: {
                                        mode: 'absolute',
                                        steps: [
                                            { value: 0, color: 'green' },
                                            { value: 75, color: 'yellow' },
                                            { value: 90, color: 'red' }
                                        ]
                                    }
                                }
                            }
                        },
                        // Row 3: Snapshot Reserve
                        {
                            id: 7,
                            type: 'gauge',
                            title: 'Snapshot Reserve %',
                            gridPos: { x: 0, y: 12, w: 8, h: 6 },
                            targets: [{
                                expr: `volume_snapshot_reserve_percent{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"}`,
                                refId: 'A',
                                datasource: { type: 'prometheus', uid: 'prometheus' }
                            }],
                            fieldConfig: {
                                defaults: {
                                    unit: 'percent',
                                    thresholds: {
                                        mode: 'absolute',
                                        steps: [
                                            { value: 0, color: 'green' },
                                            { value: 15, color: 'yellow' },
                                            { value: 25, color: 'red' }
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            id: 8,
                            type: 'timeseries',
                            title: 'Snapshot Reserve Over Time',
                            gridPos: { x: 8, y: 12, w: 16, h: 6 },
                            targets: [{
                                expr: `volume_snapshot_reserve_percent{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"}`,
                                refId: 'A',
                                legendFormat: 'Snapshot Reserve %',
                                datasource: { type: 'prometheus', uid: 'prometheus' }
                            }],
                            fieldConfig: {
                                defaults: { unit: 'percent' }
                            }
                        },
                        // Row 4: EMS Events
                        {
                            id: 9,
                            type: 'timeseries',
                            title: 'EMS Events',
                            gridPos: { x: 0, y: 18, w: 24, h: 6 },
                            targets: [{
                                expr: `sum by (severity, message) (ems_events{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"})`,
                                refId: 'A',
                                legendFormat: '{{severity}}: {{message}}',
                                datasource: { type: 'prometheus', uid: 'prometheus' }
                            }],
                            fieldConfig: {
                                defaults: { unit: 'short' }
                            }
                        }
                    ]
                },
                folderUid: 'cf1tgl2iim2gwd', // Fleet-Demo folder
                overwrite: false,
                message: `Created by Storage Class Provisioning for volume ${volumeName}`
            };
            
            // Create dashboard using Grafana MCP
            const grafanaClient = window.app?.clientManager?.getClient('grafana-remote');
            if (!grafanaClient) {
                console.warn('⚠️  Grafana MCP client not available, skipping dashboard creation');
                return;
            }
            
            const response = await grafanaClient.callMcp('update_dashboard', dashboard);
            
            if (response) {
                // Get Grafana viewer URL from config
                const grafanaUrl = this.demo.mcpConfig.getGrafanaViewerUrl();
                const dashboardUrl = `${grafanaUrl}/d/${dashboardUid}`;
                
                console.log(`✅ Created Grafana dashboard: ${dashboardUrl}`);
                this.notifications.showSuccess(`Grafana dashboard created successfully`);
            }
        } catch (error) {
            console.error('Failed to create Grafana dashboard:', error);
            // Don't block volume creation on dashboard failure
            this.notifications.showWarning('Volume created, but dashboard creation failed');
        }
    }

    // Show alert rules preview modal for storage class
    async showAlertRulesPreview() {
        const volumeName = document.getElementById('scVolumeName').value.trim();
        
        if (!volumeName) {
            this.notifications.showError('Please enter a volume name first');
            return;
        }

        if (!this.selectedStorageClass) {
            this.notifications.showError('Please select a storage class first');
            return;
        }

        // Check if we have a recommendation (cluster/SVM/aggregate)
        if (!this.currentRecommendations || !this.currentRecommendations.cluster || !this.currentRecommendations.svm) {
            this.notifications.showError('Please click "Recommend..." to get placement details before previewing alerts');
            return;
        }

        // Get QoS and snapshot policy from the selected storage class
        const qosPolicyName = this.selectedStorageClass.qosPolicy;
        const snapshotPolicyName = this.selectedStorageClass.snapshotPolicy;

        // Use cluster and SVM from recommendations
        const clusterName = this.currentRecommendations.cluster;
        const svmName = this.currentRecommendations.svm;

        let allAlerts = [];
        
        // Always include capacity alerts
        const capacityAlerts = this.alertRules.generateCapacityAlertRules(volumeName, svmName, clusterName);
        allAlerts.push(...capacityAlerts);
        
        // Include performance alerts if QoS policy is set
        if (qosPolicyName) {
            const performanceAlerts = await this.alertRules.generatePerformanceAlertRules(volumeName, svmName, clusterName, qosPolicyName);
            allAlerts.push(...performanceAlerts);
        }
        
        // Include data protection alerts if snapshot policy is set
        if (snapshotPolicyName && snapshotPolicyName !== 'none') {
            const dataProtectionAlerts = await this.alertRules.generateDataProtectionAlertRules(volumeName, svmName, clusterName, snapshotPolicyName);
            allAlerts.push(...dataProtectionAlerts);
        }

        const title = `Storage Class Compliance Monitoring Alert Rules (${allAlerts.length} total)`;
        this.alertRules.showAlertRulesModal(allAlerts, title);
    }
    // Get LLM recommendation for cluster/SVM/aggregate placement
    async getRecommendation() {
        if (!this.selectedStorageClass) {
            this.notifications.showError('Please select a storage class first');
            return;
        }

        const volumeSize = document.getElementById('scVolumeSize').value.trim();
        if (!volumeSize) {
            this.notifications.showError('Please enter a volume size first');
            return;
        }

        const protocol = document.querySelector('input[name="scProtocol"]:checked').value;
        const protocolName = protocol === 'nfs' ? 'NFS' : 'CIFS';

        const recommendBtn = document.getElementById('scRecommendBtn');
        recommendBtn.disabled = true;
        recommendBtn.textContent = 'Recommending...';

        try {
            this.notifications.showInfo('Getting placement recommendation from AI...');

            // Use the chatbot to get recommendation (it has access to all MCP tools and cluster context)
            const chatbot = this.demo.chatbot;
            if (!chatbot) {
                throw new Error('AI assistant not available');
            }

            // Build the prompt for the LLM - keep it simple and let the chatbot use its tools
            const prompt = `Where is the best place to provision a ${volumeSize} ${protocolName} volume using my ${this.selectedStorageClass.name} storage class?`;

            // Send the message and wait for response
            const response = await chatbot.sendMessage(prompt);
            console.log('AI Recommendation response:', response);

            // The chatbot should return a structured recommendation
            // Parse it from the response
            if (response && typeof response === 'string') {
                // Look for the structured recommendation format
                const recommendation = this.parseRecommendation(response);
                
                if (recommendation) {
                    // Update the UI with recommendation
                    this.currentRecommendations = recommendation;
                    this.showStorageClassDetails(); // This will populate the cluster/SVM/aggregate
                    
                    // Show reasoning if available
                    if (recommendation.reasoning) {
                        this.notifications.showSuccess(`Recommendation: ${recommendation.reasoning}`);
                    } else {
                        this.notifications.showSuccess('Placement recommendation received');
                    }
                } else {
                    this.notifications.showWarning('Could not parse recommendation. Please try again.');
                }
            }
        } catch (error) {
            console.error('Failed to get recommendation:', error);
            
            // Better error messages
            if (error.message.includes('mock mode') || error.message.includes('API key')) {
                this.notifications.showError('AI recommendations require ChatGPT API key configuration');
            } else if (error.message.includes('Rate limit')) {
                this.notifications.showError('Too many requests. Please wait a moment and try again.');
            } else {
                this.notifications.showError('Failed to get recommendation: ' + error.message);
            }
        } finally {
            recommendBtn.disabled = false;
            recommendBtn.textContent = 'Recommend...';
        }
    }

    // Parse LLM recommendation response
    parseRecommendation(response) {
        try {
            // The chatbot should return structured JSON in the response
            // Look for the structured format: {"cluster": "...", "svm": "...", "aggregate": "...", ...}
            
            // Try to find JSON block in response (remove markdown code blocks if present)
            const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const jsonMatch = cleanedResponse.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
                const recommendation = JSON.parse(jsonMatch[0]);
                
                // Validate required fields
                if (recommendation.cluster && recommendation.svm && recommendation.aggregate) {
                    return {
                        cluster: recommendation.cluster,
                        svm: recommendation.svm,
                        aggregate: recommendation.aggregate,
                        reasoning: recommendation.reasoning, // Capture reasoning for user feedback
                        qos_policy: recommendation.qos_policy || this.selectedStorageClass.qosPolicy,
                        snapshot_policy: recommendation.snapshot_policy || this.selectedStorageClass.snapshotPolicy
                    };
                }
            }

            // Fallback: try to parse from text format
            const clusterMatch = response.match(/cluster[:\s]+([^\s,\n]+)/i);
            const svmMatch = response.match(/svm[:\s]+([^\s,\n]+)/i);
            const aggregateMatch = response.match(/aggregate[:\s]+([^\s,\n]+)/i);

            if (clusterMatch && svmMatch && aggregateMatch) {
                return {
                    cluster: clusterMatch[1],
                    svm: svmMatch[1],
                    aggregate: aggregateMatch[1],
                    qos_policy: this.selectedStorageClass.qosPolicy,
                    snapshot_policy: this.selectedStorageClass.snapshotPolicy
                };
            }

            return null;
        } catch (error) {
            console.error('Error parsing recommendation:', error);
            return null;
        }
    }
}
