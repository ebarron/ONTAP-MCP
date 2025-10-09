// NetApp ONTAP MCP Demo Application
class OntapMcpDemo {
    constructor() {
        this.mcpConfig = new McpConfig();
        this.mcpUrl = null; // Will be set after config loads
        this.clusters = [];
        this.currentCluster = null;
        this.selectedCluster = null;
        this.harvestAvailable = false; // Track if Harvest tools are available
        
        // Storage Classes configuration
        this.storageClasses = [
            {
                name: 'Hospital EDR',
                qosPolicy: 'performance-fixed',
                snapshotPolicy: 'every-5-minutes',
                // Dummy metrics data - will be replaced with real data later
                usedAndReserved: '85.2 GiB',
                available: '14.8 GiB',
                usedPercent: 85,
                dataReduction: '2.4 to 1',
                logicalUsed: '204 GiB'
            },
            {
                name: 'HR Records',
                qosPolicy: 'value-fixed',
                snapshotPolicy: 'default',
                // Dummy metrics data - will be replaced with real data later
                usedAndReserved: '42.1 GiB',
                available: '57.9 GiB',
                usedPercent: 42,
                dataReduction: '1.8 to 1',
                logicalUsed: '76 GiB'
            },
            {
                name: 'Medical Images',
                qosPolicy: 'extreme-fixed',
                snapshotPolicy: 'default',
                // Dummy metrics data - will be replaced with real data later
                usedAndReserved: '156.7 GiB',
                available: '43.3 GiB',
                usedPercent: 78,
                dataReduction: '1.2 to 1',
                logicalUsed: '188 GiB'
            }
        ];
        
        // Core services will be initialized after config loads
        this.mcpConfig = new McpConfig();
        this.clientManager = null;  // Multi-server manager
        this.apiClient = null;      // Backward compatibility (will be default client)
        this.notifications = new ToastNotifications();
        
        // Components will be initialized after config loads
        this.provisioningPanel = null;
        this.storageClassProvisioningPanel = null;
        
        // Ready promise for components to wait on
        this.ready = this.init();
    }

    async init() {
        // Load MCP configuration first
        await this.mcpConfig.load();
        
        console.log('🚀 Initializing multi-server MCP support...');
        
        // Initialize client manager for all enabled servers
        this.clientManager = new McpClientManager(this.mcpConfig);
        await this.clientManager.initialize();
        
        // Backward compatibility: set apiClient to first connected server
        const connectedServers = this.clientManager.getConnectedServers();
        if (connectedServers.length > 0) {
            this.apiClient = this.clientManager.getClient(connectedServers[0]);
            console.log(`� Default client set to: ${connectedServers[0]}`);
        }
        
        // Log statistics
        const stats = this.clientManager.getStats();
        console.log(`📊 MCP Stats: ${stats.connectedServers} server(s), ${stats.totalTools} tool(s)`);
        stats.toolsByServer.forEach(s => {
            console.log(`   • ${s.server}: ${s.toolCount} tools`);
        });
        
        // Initialize components
        this.provisioningPanel = new ProvisioningPanel(this);
        this.storageClassProvisioningPanel = new StorageClassProvisioningPanel(this);
        
        this.bindEvents();
        
        // Auto-load clusters from demo/clusters.json into this session
        await this.loadClustersFromDemoConfig();
        
        // Then list clusters from the MCP session
        await this.loadClusters();
        
        // Check if Harvest tools are available
        await this.checkHarvestAvailability();
        
        this.updateUI();
    }

    /**
     * Load clusters from demo/clusters.json into the MCP session
     * This provides a seamless demo experience with automatic cluster configuration
     */
    async loadClustersFromDemoConfig() {
        try {
            console.log('📁 Loading clusters from demo/clusters.json...');
            
            // Fetch clusters.json from demo directory
            const response = await fetch('/clusters.json');
            
            if (response.status === 404) {
                console.warn('⚠️  clusters.json not found - copy clusters.json.example to get started');
                this.notifications.showInfo(
                    'No clusters.json found. Copy clusters.json.example or add clusters manually.'
                );
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            let clusterData = await response.json();
            
            // Handle both object format (test/clusters.json) and array format
            let clusters;
            if (Array.isArray(clusterData)) {
                // Array format: [{name: "...", cluster_ip: "...", ...}, ...]
                clusters = clusterData;
            } else if (typeof clusterData === 'object' && clusterData !== null) {
                // Object format: {"cluster-name": {cluster_ip: "...", ...}, ...}
                console.log('📋 Converting object format to array format...');
                clusters = Object.entries(clusterData).map(([name, config]) => ({
                    name: name,
                    ...config
                }));
            } else {
                throw new Error('clusters.json must be an array or object of cluster configurations');
            }
            
            if (clusters.length === 0) {
                console.warn('⚠️  clusters.json is empty');
                return;
            }
            
            console.log(`🔄 Adding ${clusters.length} cluster(s) to MCP session...`);
            
            // Add each cluster to the MCP session via add_cluster tool
            let successCount = 0;
            let failCount = 0;
            
            for (const cluster of clusters) {
                try {
                    // Validate cluster object
                    if (!cluster.name || !cluster.cluster_ip || !cluster.username || !cluster.password) {
                        console.error(`  ❌ Invalid cluster config (missing required fields):`, cluster);
                        failCount++;
                        continue;
                    }
                    
                    // Add to MCP session
                    const result = await this.apiClient.callMcp('add_cluster', {
                        name: cluster.name,
                        cluster_ip: cluster.cluster_ip,
                        username: cluster.username,
                        password: cluster.password,
                        description: cluster.description || `Auto-loaded from clusters.json`
                    });
                    
                    // Result is now text from Streamable HTTP client
                    if (result && result.includes('added successfully')) {
                        console.log(`  ✅ Added: ${cluster.name} (${cluster.cluster_ip})`);
                        successCount++;
                    } else {
                        console.error(`  ❌ Failed to add ${cluster.name}:`, result);
                        failCount++;
                    }
                } catch (error) {
                    console.error(`  ❌ Failed to add ${cluster.name}:`, error.message);
                    failCount++;
                }
            }
            
            // Show success notification if at least one cluster loaded
            if (successCount > 0) {
                this.notifications.showSuccess(
                    `Loaded ${successCount} cluster(s) from demo configuration`
                );
                console.log(`✅ Successfully loaded ${successCount} cluster(s) from demo config`);
            }
            
            if (failCount > 0) {
                console.warn(`⚠️  Failed to load ${failCount} cluster(s) from demo config`);
            }
            
        } catch (error) {
            console.error('Error loading clusters from demo config:', error);
            // Non-fatal - demo still works, just needs manual cluster addition
        }
    }

    /**
     * Check if Harvest monitoring tools are available
     */
    async checkHarvestAvailability() {
        try {
            // Check if metrics_query tool is available (from Harvest server)
            this.harvestAvailable = this.clientManager.isToolAvailable('metrics_query');
            
            // Hide/show IOPS column based on availability
            const iopsHeader = document.getElementById('iopsColumnHeader');
            if (iopsHeader) {
                iopsHeader.style.display = this.harvestAvailable ? '' : 'none';
            }
            
            if (this.harvestAvailable) {
                const servers = this.clientManager.getToolServers('metrics_query');
                console.log(`✅ Harvest monitoring tools available via: ${servers.join(', ')}`);
            } else {
                console.log('⚠️ Harvest monitoring tools not available');
            }
        } catch (error) {
            console.error('Error checking Harvest availability:', error);
            this.harvestAvailable = false;
            const iopsHeader = document.getElementById('iopsColumnHeader');
            if (iopsHeader) {
                iopsHeader.style.display = 'none';
            }
        }
    }

    bindEvents() {
        // Add cluster button (only if it exists - it's in ClustersView)
        const addClusterBtn = document.getElementById('addClusterBtn');
        if (addClusterBtn) {
            addClusterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openAddClusterModal();
            });
        }

        // Provision Storage link - note: event listener will be updated in updateProvisionButtonState
        // No direct event listener here since we need to handle disabled state

        // Modal close buttons (use event delegation since modals are added dynamically)
        document.addEventListener('click', (e) => {
            if (e.target.matches('.modal-close, .flyout-close')) {
                this.closeModals();
            }
        });

        // Modal overlay close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('flyout-overlay')) {
                this.closeModals();
            }
        });

        // Form submission (use event delegation)
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'addClusterForm') {
                e.preventDefault();
                this.handleAddCluster();
            }
        });
        
        // Cancel button in Add Cluster modal (use event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.id === 'cancelAdd') {
                this.closeModals();
                const form = document.getElementById('addClusterForm');
                if (form) form.reset();
            }
        });

        // Search functionality (only bind if element exists)
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterClusters(e.target.value);
            });
        }

        // Search functionality - table search widget
        const searchButton = document.querySelector('.search-widget .search-button');
        const searchWrapper = document.querySelector('.search-widget-wrapper');
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

    // View switching methods
    showClustersView() {
        console.log('Switching to clusters view');
        
        // Hide other views
        const storageClassesView = document.getElementById('storageClassesView');
        if (storageClassesView) storageClassesView.style.display = 'none';
        
        // Hide AlertsView using component
        if (typeof alertsView !== 'undefined') {
            alertsView.hide();
        } else {
            const alertsViewElement = document.getElementById('alertsView');
            if (alertsViewElement) alertsViewElement.style.display = 'none';
        }
        
        // Show ClustersView using component
        if (typeof clustersView !== 'undefined') {
            clustersView.show();
        } else {
            // Fallback to direct DOM manipulation
            const clustersViewElement = document.getElementById('clustersView');
            if (clustersViewElement) clustersViewElement.style.display = 'block';
        }
        
        // Show chatbot
        const chatbotContainer = document.getElementById('chatbot-container');
        if (chatbotContainer) {
            chatbotContainer.style.display = 'block';
        }
        
        // Update tab navigation
        this.updateTabNavigation('clusters');
        
        // Configure chatbot for clusters view
        if (this.chatbot) {
            this.chatbot.options = {
                pageType: 'default',
                skipWorkingEnvironment: false,
                useStorageClassProvisioning: false
            };
        }
    }

    showStorageClassesView() {
        console.log('Switching to storage classes view');
        
        // Hide ClustersView using component
        if (typeof clustersView !== 'undefined') {
            clustersView.hide();
        } else {
            const clustersViewElement = document.getElementById('clustersView');
            if (clustersViewElement) clustersViewElement.style.display = 'none';
        }
        
        // Show StorageClassesView using component
        if (typeof storageClassesView !== 'undefined') {
            storageClassesView.show();
        } else {
            const storageClassesViewElement = document.getElementById('storageClassesView');
            if (storageClassesViewElement) storageClassesViewElement.style.display = 'block';
        }
        
        // Hide AlertsView using component
        if (typeof alertsView !== 'undefined') {
            alertsView.hide();
        } else {
            const alertsViewElement = document.getElementById('alertsView');
            if (alertsViewElement) alertsViewElement.style.display = 'none';
        }
        
        // Show chatbot
        const chatbotContainer = document.getElementById('chatbot-container');
        if (chatbotContainer) {
            chatbotContainer.style.display = 'block';
        }
        
        // Update tab navigation
        this.updateTabNavigation('storage-classes');
        
        // Render storage classes if not already rendered
        this.renderStorageClasses();
        
        // Configure chatbot for storage classes view
        if (this.chatbot) {
            this.chatbot.options = {
                pageType: 'storage-classes',
                skipWorkingEnvironment: true,
                useStorageClassProvisioning: true
            };
        }
    }

    showAlertsView() {
        console.log('Switching to alerts view');
        
        // Hide other views
        const clustersView = document.getElementById('clustersView');
        const storageClassesView = document.getElementById('storageClassesView');
        
        if (clustersView) clustersView.style.display = 'none';
        if (storageClassesView) storageClassesView.style.display = 'none';
        
        // Show AlertsView using component (if available)
        if (typeof alertsView !== 'undefined') {
            alertsView.show();
            // Load alerts data from Harvest MCP
            alertsView.loadAlerts();
            console.log('Alerts view is now visible (via component)');
        } else {
            // Fallback to direct DOM manipulation
            const alertsViewElement = document.getElementById('alertsView');
            if (alertsViewElement) {
                alertsViewElement.style.display = 'block';
                console.log('Alerts view is now visible (fallback)');
            }
        }
        
        // Hide chatbot in alerts view
        const chatbotContainer = document.getElementById('chatbot-container');
        if (chatbotContainer) {
            chatbotContainer.style.display = 'none';
        }
        
        // Update tab navigation
        this.updateTabNavigation('alerts');
        
        // Future: Load alerts from Prometheus
        // await this.loadAlerts();
    }

    updateTabNavigation(activeView) {
        // Update tab link states
        const tabLinks = document.querySelectorAll('.tab-link');
        tabLinks.forEach(link => {
            link.classList.remove('tab-link-active');
            link.removeAttribute('aria-current');
        });
        
        // Set active tab
        const activeTabLink = document.querySelector(`[data-view="${activeView}"]`);
        if (activeTabLink) {
            activeTabLink.classList.add('tab-link-active');
            activeTabLink.setAttribute('aria-current', 'page');
        }
        
        // Update left nav using component if available
        if (typeof leftNavBar !== 'undefined' && leftNavBar.setActive) {
            leftNavBar.setActive(activeView);
        }
    }

    async loadClusters() {
        try {
            this.showLoading(true);
            const response = await this.apiClient.callMcp('list_registered_clusters');
            
            console.log('MCP Response:', response); // DEBUG
            
            // Parse text response from Streamable HTTP client
            if (response && typeof response === 'string') {
                this.clusters = this.parseClusterListFromText(response);
                console.log('Parsed clusters:', this.clusters); // DEBUG
            } else {
                this.notifications.showError('Failed to load clusters: Invalid response format');
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

    /**
     * Parse cluster list from MCP text response
     * Format: "- cluster-name: 10.1.1.1 (description)"
     */
    parseClusterListFromText(textContent) {
        const clusters = [];
        const lines = textContent.split('\n');
        
        for (const line of lines) {
            // Pattern: "- cluster-name: 10.1.1.1 (description)"
            const match = line.match(/^-\s+([^:]+):\s+([^\s]+)\s+\(([^)]+)\)/);
            if (match) {
                clusters.push({
                    name: match[1].trim(),
                    cluster_ip: match[2].trim(),
                    description: match[3].trim()
                });
            }
        }
        
        return clusters;
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
        document.getElementById('flyoutClusterName').textContent = cluster.name || 'Cluster Details';
        
        // Update cluster info
        document.getElementById('flyoutClusterIp').textContent = cluster.cluster_ip || 'N/A';
        document.getElementById('flyoutUsername').textContent = cluster.username || 'N/A';
        document.getElementById('flyoutDescription').textContent = cluster.description || 'No description';
        
        // Show flyout
        document.getElementById('clusterDetail').style.display = 'flex';
        
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
        const addClusterModal = document.getElementById('addClusterModal');
        const clusterFlyout = document.getElementById('clusterDetail');
        
        if (addClusterModal) {
            addClusterModal.style.display = 'none';
        }
        if (clusterFlyout) {
            clusterFlyout.style.display = 'none';
        }
        
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
        this.renderStorageClasses();
        this.renderClustersTable();
        this.updateClusterCount();
        this.updateProvisionButtonState();
    }

    renderStorageClasses() {
        console.log('renderStorageClasses called, storage classes:', this.storageClasses.length);
        const container = document.getElementById('storageClassesContainer');
        
        if (!container) {
            console.error('Storage classes container not found!');
            return;
        }

        console.log('Container found, rendering', this.storageClasses.length, 'storage classes');
        const html = this.storageClasses.map(storageClass => `
            <div class="storage-class-card">
                <div class="storage-class-card-header">
                    <h3 class="storage-class-card-title">${DemoUtils.escapeHtml(storageClass.name)}</h3>
                    <div class="storage-class-policies">
                        <div class="storage-class-policy">
                            <span class="storage-class-policy-label">Performance:</span>
                            <span>${DemoUtils.escapeHtml(storageClass.qosPolicy)}</span>
                        </div>
                        <div class="storage-class-policy">
                            <span class="storage-class-policy-label">Snapshot:</span>
                            <span>${DemoUtils.escapeHtml(storageClass.snapshotPolicy)}</span>
                        </div>
                        <div class="storage-class-policy">
                            <span class="storage-class-policy-label">Ransomware Protection:</span>
                            <span>Active</span>
                        </div>
                    </div>
                </div>
                <div class="storage-class-card-body">
                    <div class="storage-class-metrics">
                        <div class="storage-class-metric">
                            <div class="storage-class-metric-value">${DemoUtils.escapeHtml(storageClass.usedAndReserved)}</div>
                            <div class="storage-class-metric-label">Used and Reserved</div>
                        </div>
                        <div class="storage-class-metric">
                            <div class="storage-class-metric-value">${DemoUtils.escapeHtml(storageClass.available)}</div>
                            <div class="storage-class-metric-label">Available</div>
                        </div>
                    </div>
                    <div class="storage-class-bar-chart">
                        <div class="storage-class-bar">
                            <div class="storage-class-bar-fill" style="width: ${storageClass.usedPercent}%"></div>
                        </div>
                    </div>
                    <div class="storage-class-details">
                        <div class="storage-class-detail">
                            <span class="storage-class-detail-label">${DemoUtils.escapeHtml(storageClass.dataReduction)} data reduction</span>
                        </div>
                        <div class="storage-class-detail">
                            <span class="storage-class-detail-label">${DemoUtils.escapeHtml(storageClass.logicalUsed)} logical used</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
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

        tbody.innerHTML = this.clusters.map((cluster, index) => `
            <div class="table-row" data-cluster-index="${index}">
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
                <div class="table-cell iops-cell" style="flex: 1 0 120px; display: ${this.harvestAvailable ? '' : 'none'};" data-cluster-name="${DemoUtils.escapeHtml(cluster.name)}">
                    <span class="loading-spinner">⏳</span>
                </div>
                <div class="table-cell capacity-cell" style="flex: 1 0 120px;" data-cluster-name="${DemoUtils.escapeHtml(cluster.name)}">
                    <span class="loading-spinner">⏳</span>
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
        
        // Lazy load metrics for each cluster
        this.clusters.forEach((cluster, index) => {
            this.loadClusterMetrics(cluster.name, index);
        });
    }

    /**
     * Lazy load metrics (IOPS and capacity) for a specific cluster
     */
    async loadClusterMetrics(clusterName, clusterIndex) {
        // Load IOPS if Harvest is available
        if (this.harvestAvailable) {
            this.loadClusterIOPS(clusterName, clusterIndex);
        }
        
        // Load capacity
        this.loadClusterCapacity(clusterName, clusterIndex);
    }

    /**
     * Load cluster IOPS from Harvest
     */
    async loadClusterIOPS(clusterName, clusterIndex) {
        try {
            // Query average IOPS over last hour for this cluster
            const query = `avg_over_time(cluster_total_ops{cluster="${clusterName}"}[1h])`;
            const response = await this.clientManager.callTool('metrics_query', { query });
            
            // Parse response to get the metric value
            const iops = this.parsePrometheusValue(response);
            const formattedIOPS = iops !== null ? this.formatIOPS(iops) : '';
            
            // Update the cell
            const cell = document.querySelector(`.iops-cell[data-cluster-name="${clusterName}"]`);
            if (cell) {
                cell.innerHTML = formattedIOPS;
            }
        } catch (error) {
            console.error(`Failed to load IOPS for ${clusterName}:`, error);
            const cell = document.querySelector(`.iops-cell[data-cluster-name="${clusterName}"]`);
            if (cell) {
                cell.innerHTML = '';
            }
        }
    }

    /**
     * Load cluster free capacity from ONTAP
     */
    async loadClusterCapacity(clusterName, clusterIndex) {
        try {
            // Get aggregates for this cluster
            const response = await this.clientManager.callTool('cluster_list_aggregates', {
                cluster_name: clusterName
            });
            
            // Parse aggregate data and sum available space
            const totalAvailable = this.parseAggregateCapacity(response);
            const formattedCapacity = totalAvailable !== null ? this.formatCapacity(totalAvailable) : '';
            
            // Update the cell
            const cell = document.querySelector(`.capacity-cell[data-cluster-name="${clusterName}"]`);
            if (cell) {
                cell.innerHTML = formattedCapacity;
            }
        } catch (error) {
            console.error(`Failed to load capacity for ${clusterName}:`, error);
            const cell = document.querySelector(`.capacity-cell[data-cluster-name="${clusterName}"]`);
            if (cell) {
                cell.innerHTML = '';
            }
        }
    }

    /**
     * Parse Prometheus query response to extract numeric value
     */
    parsePrometheusValue(response) {
        try {
            // Response is JSON from Harvest MCP (full Prometheus API response)
            const data = JSON.parse(response);
            
            // Prometheus API structure: {status: "success", data: {resultType: "vector", result: [...]}}
            if (data.status === 'success' && data.data && data.data.result) {
                const results = data.data.result;
                
                // If no results, metric doesn't exist for this cluster
                if (results.length === 0) {
                    return null;
                }
                
                // Get first result's value: [timestamp, "value_as_string"]
                const firstResult = results[0];
                if (firstResult.value && Array.isArray(firstResult.value)) {
                    const valueStr = firstResult.value[1];
                    return parseFloat(valueStr);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error parsing Prometheus value:', error, 'Response:', response);
            return null;
        }
    }

    /**
     * Parse aggregate listing to calculate total available capacity
     */
    parseAggregateCapacity(response) {
        try {
            let totalAvailableBytes = 0;
            
            // Parse response - looking for "Available: XXX bytes" patterns
            const lines = response.split('\n');
            for (const line of lines) {
                // Match patterns like "Available: 1234567890 bytes" or "available: 1234567890"
                const match = line.match(/available:\s*([\d,]+)/i);
                if (match) {
                    const bytes = parseInt(match[1].replace(/,/g, ''));
                    if (!isNaN(bytes)) {
                        totalAvailableBytes += bytes;
                    }
                }
            }
            
            return totalAvailableBytes > 0 ? totalAvailableBytes : null;
        } catch (error) {
            console.error('Error parsing aggregate capacity:', error);
            return null;
        }
    }

    /**
     * Format IOPS value with K/M suffixes
     */
    formatIOPS(iops) {
        if (iops >= 1000000) {
            return `${(iops / 1000000).toFixed(1)}M IOPS`;
        } else if (iops >= 1000) {
            return `${(iops / 1000).toFixed(1)}K IOPS`;
        } else {
            return `${Math.round(iops)} IOPS`;
        }
    }

    /**
     * Format capacity in GiB
     */
    formatCapacity(bytes) {
        const gib = bytes / (1024 * 1024 * 1024);
        return `${gib.toFixed(2)} GiB`;
    }

    async testClusterConnection(clusterName) {
        try {
            this.notifications.showInfo(`Testing connection to ${clusterName}...`);
            
            const response = await this.apiClient.testClusterConnection(clusterName);

            // Response is now text from Streamable HTTP client
            if (response && typeof response === 'string' && response.includes('successful')) {
                this.notifications.showSuccess(`Connection to ${clusterName} successful`);
            } else {
                this.notifications.showError(`Connection to ${clusterName} failed: ${response || 'Unknown error'}`);
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
                this.provisioningPanel.show();
                return false;
            };
        } else {
            provisionLink.classList.add('disabled');
            provisionLink.onclick = () => false; // Disable click
        }
    }

    // Alias for chatbot compatibility
    openProvisionStorage() {
        this.provisioningPanel.show();
    }

    // Open storage class provisioning panel
    openStorageClassProvisioning() {
        this.storageClassProvisioningPanel.show();
    }

    // Service button handlers
    async openVolumes() {
        if (!this.currentCluster) return;
        
        try {
            const response = await this.apiClient.callMcp('cluster_list_volumes', {
                cluster_name: this.currentCluster.name
            });

            // Response is now text from Streamable HTTP client
            if (response && typeof response === 'string') {
                console.log('Volumes:', response);
                // Count volumes by counting lines that start with "- "
                const volumeCount = (response.match(/^-\s+/gm) || []).length;
                this.showInfo(`Found ${volumeCount} volumes`);
            } else {
                this.showError('Failed to load volumes');
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

            // Response is now text from Streamable HTTP client
            if (response && typeof response === 'string') {
                console.log('Snapshot policies:', response);
                this.showInfo('Snapshot policies loaded successfully');
            } else {
                this.showError('Failed to load snapshot policies');
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

            // Response is now text from Streamable HTTP client
            if (response && typeof response === 'string') {
                console.log('Export policies:', response);
                this.showInfo('Export policies loaded successfully');
            } else {
                this.showError('Failed to load export policies');
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

            // Response is now text from Streamable HTTP client
            if (response && typeof response === 'string') {
                console.log('CIFS shares:', response);
                this.showInfo('CIFS shares loaded successfully');
            } else {
                this.showError('Failed to load CIFS shares');
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
    window.app = app; // Make app globally accessible
    
    // Set up left navigation now that app exists
    if (typeof leftNavBar !== 'undefined' && leftNavBar.setupNavigation) {
        leftNavBar.setupNavigation();
    }
    
    // Initialize chatbot after app is ready
    setTimeout(() => {
        chatbot = new ChatbotAssistant(app);
        // Store reference to chatbot in app for view switching
        app.chatbot = chatbot;
    }, 1000);
});

// Global service button handlers (called from HTML)
window.openVolumes = () => app.openVolumes();
window.openSnapshots = () => app.openSnapshots();
window.openExports = () => app.openExports();
window.openCifsShares = () => app.openCifsShares();