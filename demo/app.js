// NetApp ONTAP MCP Demo Application
class OntapMcpDemo {
    constructor() {
        this.mcpConfig = new McpConfig();
        this.mcpUrl = null; // Will be set after config loads
        this.clusters = [];
        this.currentCluster = null;
        this.selectedCluster = null;
        this.harvestAvailable = false; // Track if Harvest tools are available
        this.mcpLoadedClusters = new Set(); // Track clusters loaded into ONTAP MCP
        
        // Cluster table sorting state
        this.sortColumn = null;
        this.sortDirection = 'asc';
        
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
        
        // Expose toast notifications globally for Fix-It modal and other components
        window.toastNotifications = this.notifications;
        
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
        
        // Expose Harvest client separately for views that need it
        this.harvestApiClient = this.clientManager.getClient('harvest-remote');
        if (this.harvestApiClient) {
            console.log('✅ Harvest monitoring tools available via: harvest-remote');
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
        
        // Initialize corrective action components for Fix-It functionality
        await this.initializeCorrectiveActionComponents();
        
        this.bindEvents();
        
        // Auto-load clusters from demo/clusters.json into this session
        await this.loadClustersFromDemoConfig();
        
        // Then list clusters from the MCP session
        await this.loadClusters();
        
        // Check if Harvest tools are available
        await this.checkHarvestAvailability();
        
        // Discover and merge Harvest clusters
        await this.discoverHarvestClusters();
        
        this.updateUI();
    }

    /**
     * Initialize corrective action components for Fix-It functionality
     */
    async initializeCorrectiveActionComponents() {
        try {
            console.log('🔧 Initializing Fix-It components...');
            
            // Initialize ParameterResolver (from Phase 1)
            // Need both ONTAP client (for volume ops) and Harvest client (for metrics)
            if (typeof ParameterResolver !== 'undefined') {
                const ontapClient = this.clientManager.getClient('netapp-ontap');
                const harvestClient = this.clientManager.getClient('harvest-remote');
                window.parameterResolver = new ParameterResolver(ontapClient, harvestClient);
                console.log('  ✅ ParameterResolver initialized with ONTAP + Harvest clients');
            } else {
                console.warn('  ⚠️  ParameterResolver not found');
            }
            
            // Initialize CorrectiveActionParser - uses centralized OpenAI service
            if (typeof CorrectiveActionParser !== 'undefined') {
                window.correctiveActionParser = new CorrectiveActionParser();
                
                // Initialize with MCP client manager (config from OpenAI service)
                await window.correctiveActionParser.initWithConfig(this.clientManager);
                console.log('  ✅ CorrectiveActionParser initialized (centralized OpenAI service + MCP tools)');
            } else {
                console.warn('  ⚠️  CorrectiveActionParser not found');
            }
            
            // Initialize UndoManager (PHASE 5.1)
            if (typeof UndoManager !== 'undefined' && window.parameterResolver) {
                window.undoManager = new UndoManager(this.apiClient, window.parameterResolver);
                console.log('  ✅ UndoManager initialized');
            } else {
                console.warn('  ⚠️  UndoManager not initialized (missing dependencies)');
            }
            
            // Initialize FixItModal
            if (typeof FixItModal !== 'undefined' && window.parameterResolver && window.undoManager) {
                window.fixItModal = new FixItModal(this.apiClient, window.parameterResolver, window.undoManager);
                console.log('  ✅ FixItModal initialized (with UndoManager)');
            } else {
                console.warn('  ⚠️  FixItModal not initialized (missing dependencies)');
            }
            
            // Wire up components to AlertsView
            if (typeof alertsView !== 'undefined') {
                alertsView.correctiveActionParser = window.correctiveActionParser;
                alertsView.fixItModal = window.fixItModal;
                alertsView.parameterResolver = window.parameterResolver;
                console.log('  ✅ Fix-It components connected to AlertsView');
            } else {
                console.warn('  ⚠️  AlertsView not found - Fix-It components not connected');
            }
            
            console.log('✅ Fix-It components ready');
            
        } catch (error) {
            console.error('❌ Failed to initialize Fix-It components:', error);
        }
    }

    /**
     * Load clusters from demo/clusters.json into the MCP session
     * This provides a seamless demo experience with automatic cluster configuration
     */
    async loadClustersFromDemoConfig() {
        try {
            console.log('📁 Loading clusters from demo/clusters.json...');
            
            // Fetch clusters.json from demo directory with cache-busting parameter
            const response = await fetch('/clusters.json?v=' + Date.now());
            
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
                        this.mcpLoadedClusters.add(cluster.name); // Track as MCP-loaded
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
     * Discover clusters from Harvest metrics and merge with existing clusters
     */
    async discoverHarvestClusters() {
        try {
            console.log('🔍 Discovering clusters from Harvest metrics...');
            console.log('  📋 Current clusters in ONTAP MCP:', this.clusters.map(c => c.name).join(', '));
            
            // Get Harvest client
            const harvestClient = this.clientManager.clients.get('harvest-remote');
            if (!harvestClient) {
                console.log('  ℹ️  Harvest client not available, skipping cluster discovery');
                return;
            }
            
            console.log('  ✅ Harvest client available, querying metrics...');
            
            // Query Harvest for volume metrics to extract cluster labels
            const response = await harvestClient.callMcp('metrics_query', { 
                query: 'volume_labels' 
            });
            
            console.log('  📦 Received Harvest response, parsing...');
            
            // Parse response
            const parseResponse = (response) => {
                if (typeof response === 'string') {
                    try {
                        return JSON.parse(response);
                    } catch (e) {
                        console.error('Failed to parse Harvest response:', e);
                        return null;
                    }
                }
                return response;
            };
            
            const parsed = parseResponse(response);
            const volumeLabels = parsed?.data?.result || [];
            
            console.log(`  📊 Found ${volumeLabels.length} volume metric entries`);
            
            // Extract unique cluster names from metrics
            const harvestClusters = new Set();
            volumeLabels.forEach(vol => {
                if (vol.metric && vol.metric.cluster) {
                    harvestClusters.add(vol.metric.cluster);
                }
            });
            
            if (harvestClusters.size === 0) {
                console.log('  ℹ️  No clusters found in Harvest metrics');
                return;
            }
            
            console.log(`  ✅ Found ${harvestClusters.size} cluster(s) in Harvest: ${Array.from(harvestClusters).join(', ')}`);
            
            // Merge with existing clusters (avoid duplicates)
            const existingClusterNames = new Set(this.clusters.map(c => c.name));
            console.log('  🔄 Checking for new clusters not in ONTAP MCP...');
            let addedCount = 0;
            
            for (const clusterName of harvestClusters) {
                if (!existingClusterNames.has(clusterName)) {
                    // Add Harvest-only cluster (no credentials, just metadata)
                    this.clusters.push({
                        name: clusterName,
                        cluster_ip: 'N/A',
                        description: 'Discovered from Harvest (monitoring only)',
                        source: 'harvest' // Mark as Harvest-discovered
                    });
                    addedCount++;
                    console.log(`    ➕ Added Harvest-only cluster: ${clusterName}`);
                } else {
                    console.log(`    ✓ Cluster already in ONTAP MCP: ${clusterName}`);
                }
            }
            
            if (addedCount > 0) {
                console.log(`  ✅ Added ${addedCount} Harvest-only cluster(s) to fleet table`);
                this.notifications.showInfo(`Discovered ${addedCount} additional cluster(s) from Harvest monitoring`);
            } else {
                console.log('  ℹ️  All Harvest clusters already in ONTAP MCP');
            }
            
        } catch (error) {
            console.error('Error discovering Harvest clusters:', error);
            // Non-fatal - just means Harvest integration not available
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
        
        // Hide volumes view if present
        if (typeof volumesView !== 'undefined') {
            volumesView.hide();
        }
        
        // Hide SVMs view if present
        if (typeof svmsView !== 'undefined') {
            svmsView.hide();
        }
        
        // Hide NFS shares view if present
        if (typeof nfsSharesView !== 'undefined') {
            nfsSharesView.hide();
        }
        
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

    showVolumesView() {
        console.log('Switching to volumes view');
        
        // Hide other views
        const clustersView = document.getElementById('clustersView');
        const storageClassesView = document.getElementById('storageClassesView');
        
        if (clustersView) clustersView.style.display = 'none';
        if (storageClassesView) storageClassesView.style.display = 'none';
        
        // Hide alerts view if present
        if (typeof alertsView !== 'undefined') {
            alertsView.hide();
        }
        
        // Hide SVMs view if present
        if (typeof svmsView !== 'undefined') {
            svmsView.hide();
        }
        
        // Hide NFS shares view if present
        if (typeof nfsSharesView !== 'undefined') {
            nfsSharesView.hide();
        }
        
        // Show VolumesView using component (if available)
        if (typeof volumesView !== 'undefined') {
            volumesView.show();
            // Load volumes data from Harvest MCP
            volumesView.loadVolumes();
            console.log('Volumes view is now visible (via component)');
        } else {
            // Fallback to direct DOM manipulation
            const volumesViewElement = document.getElementById('volumesView');
            if (volumesViewElement) {
                volumesViewElement.style.display = 'block';
                console.log('Volumes view is now visible (fallback)');
            }
        }
        
        // Hide chatbot in volumes view
        const chatbotContainer = document.getElementById('chatbot-container');
        if (chatbotContainer) {
            chatbotContainer.style.display = 'none';
        }
        
        // Update tab navigation
        this.updateTabNavigation('volumes');
    }

    showSVMsView() {
        console.log('Switching to SVMs view');
        
        // Hide other views
        const clustersView = document.getElementById('clustersView');
        const storageClassesView = document.getElementById('storageClassesView');
        
        if (clustersView) clustersView.style.display = 'none';
        if (storageClassesView) storageClassesView.style.display = 'none';
        
        // Hide alerts view if present
        if (typeof alertsView !== 'undefined') {
            alertsView.hide();
        }
        
        // Hide volumes view if present
        if (typeof volumesView !== 'undefined') {
            volumesView.hide();
        }
        
        // Hide NFS shares view if present
        if (typeof nfsSharesView !== 'undefined') {
            nfsSharesView.hide();
        }
        
        // Show SVMsView using component (if available)
        if (typeof svmsView !== 'undefined') {
            svmsView.show();
            // Load SVMs data from Harvest MCP
            svmsView.loadSVMs();
            console.log('SVMs view is now visible (via component)');
        } else {
            // Fallback to direct DOM manipulation
            const svmsViewElement = document.getElementById('svmsView');
            if (svmsViewElement) {
                svmsViewElement.style.display = 'block';
                console.log('SVMs view is now visible (fallback)');
            }
        }
        
        // Hide chatbot in SVMs view
        const chatbotContainer = document.getElementById('chatbot-container');
        if (chatbotContainer) {
            chatbotContainer.style.display = 'none';
        }
        
        // Update tab navigation
        this.updateTabNavigation('svms');
    }

    showNFSSharesView() {
        console.log('Switching to NFS Shares view');
        
        // Hide other views
        const clustersView = document.getElementById('clustersView');
        const storageClassesView = document.getElementById('storageClassesView');
        
        if (clustersView) clustersView.style.display = 'none';
        if (storageClassesView) storageClassesView.style.display = 'none';
        
        // Hide alerts view if present
        if (typeof alertsView !== 'undefined') {
            alertsView.hide();
        }
        
        // Hide volumes view if present
        if (typeof volumesView !== 'undefined') {
            volumesView.hide();
        }
        
        // Hide SVMs view if present
        if (typeof svmsView !== 'undefined') {
            svmsView.hide();
        }
        
        // Show NFS Shares view using component (if available)
        if (typeof nfsSharesView !== 'undefined') {
            nfsSharesView.show();
            // Load NFS shares data from Harvest MCP
            nfsSharesView.loadShares();
            console.log('NFS Shares view is now visible (via component)');
        } else {
            // Fallback to direct DOM manipulation
            const nfsSharesViewElement = document.getElementById('nfs-shares-view');
            if (nfsSharesViewElement) {
                nfsSharesViewElement.style.display = 'block';
                console.log('NFS Shares view is now visible (fallback)');
            }
        }
        
        // Hide chatbot in NFS Shares view
        const chatbotContainer = document.getElementById('chatbot-container');
        if (chatbotContainer) {
            chatbotContainer.style.display = 'none';
        }
        
        // Update tab navigation
        this.updateTabNavigation('nfs-shares');
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
            
            // Parse text response from Streamable HTTP client
            if (response && typeof response === 'string') {
                this.clusters = this.parseClusterListFromText(response);
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
                this.mcpLoadedClusters.add(clusterData.name); // Track as MCP-loaded
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
        // Call the MCP tool to get all clusters info
        const response = await this.apiClient.callMcp('get_all_clusters_info', {});
        
        // Parse the text response to find the specific cluster
        const lines = response.split('\n');
        const clusterSection = [];
        let inCluster = false;
        
        for (const line of lines) {
            if (line.includes(`Cluster: ${clusterName}`)) {
                inCluster = true;
            }
            if (inCluster) {
                clusterSection.push(line);
                // Stop at the next cluster or end
                if (line.startsWith('---') && clusterSection.length > 1) {
                    break;
                }
            }
        }
        
        // Return the cluster info section
        return clusterSection.join('\n');
    }

    openAddClusterModal(preFillData = null) {
        const modal = document.getElementById('addClusterModal');
        if (!modal) return;
        
        // Reset form first
        const form = document.getElementById('addClusterForm');
        if (form) form.reset();
        
        // Reset cluster name field to editable by default
        const nameField = document.getElementById('clusterName');
        if (nameField) {
            nameField.removeAttribute('readonly');
            nameField.style.backgroundColor = '';
        }
        
        // Pre-fill form if data provided
        if (preFillData) {
            if (preFillData.name) {
                if (nameField) {
                    nameField.value = preFillData.name;
                    // Make cluster name read-only when updating existing Harvest cluster
                    nameField.setAttribute('readonly', 'readonly');
                    nameField.style.backgroundColor = '#f5f5f5';
                }
            }
            if (preFillData.cluster_ip && preFillData.cluster_ip !== 'N/A') {
                const ipField = document.getElementById('clusterIp');
                if (ipField) ipField.value = preFillData.cluster_ip;
            }
            if (preFillData.description) {
                const descField = document.getElementById('description');
                if (descField) descField.value = preFillData.description;
            }
        }
        
        modal.style.display = 'flex';
        
        // Focus on first editable field
        if (preFillData && preFillData.name) {
            // If name is pre-filled, focus on IP field
            const ipField = document.getElementById('clusterIp');
            if (ipField) ipField.focus();
        } else {
            // Otherwise focus on name field
            if (nameField) nameField.focus();
        }
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
        const existingCluster = this.clusters.find(c => c.name === clusterData.name);
        if (existingCluster) {
            // If it's a Harvest-only cluster (no credentials), update it
            const isHarvestOnly = existingCluster.source === 'harvest' || 
                                  !existingCluster.username || 
                                  !existingCluster.password;
            
            if (isHarvestOnly) {
                // Update existing Harvest-only cluster with credentials
                existingCluster.cluster_ip = clusterData.cluster_ip;
                existingCluster.username = clusterData.username;
                existingCluster.password = clusterData.password;
                existingCluster.description = clusterData.description;
                delete existingCluster.source; // Remove Harvest-only marker
                
                // Add to MCP
                const success = await this.addCluster(clusterData);
                if (success) {
                    this.closeModals();
                    document.getElementById('addClusterForm').reset();
                    this.notifications.showSuccess(`Updated ${clusterData.name} with credentials and added to ONTAP MCP`);
                }
            } else {
                this.notifications.showError('A cluster with this name already exists in ONTAP MCP');
                return;
            }
        } else {
            // New cluster - add normally
            const success = await this.addCluster(clusterData);
            if (success) {
                this.closeModals();
                document.getElementById('addClusterForm').reset();
            }
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
                <div class="table-cell status-cell" style="flex: 0 0 120px;" data-cluster-name="${DemoUtils.escapeHtml(cluster.name)}">
                    <div class="status-indicator">
                        <div class="status-circle status-checking"></div>
                        <span>Checking...</span>
                    </div>
                </div>
                <div class="table-cell" style="flex: 0 0 140px;">
                    <div class="mcp-toggle-container">
                        <span class="mcp-toggle-label">ONTAP MCP</span>
                        <label class="mcp-toggle-switch">
                            <input type="checkbox" 
                                   ${this.mcpLoadedClusters.has(cluster.name) ? 'checked' : ''} 
                                   onchange="app.handleMcpToggle('${DemoUtils.escapeHtml(cluster.name)}', this.checked)"
                                   data-cluster-name="${DemoUtils.escapeHtml(cluster.name)}">
                            <span class="mcp-toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Lazy load metrics and status for each cluster
        this.clusters.forEach((cluster, index) => {
            this.loadClusterMetrics(cluster.name, index);
            this.checkClusterStatus(cluster.name);
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
     * Check cluster connectivity status
     */
    async checkClusterStatus(clusterName) {
        const statusCell = document.querySelector(`.status-cell[data-cluster-name="${clusterName}"]`);
        if (!statusCell) return;

        // Find cluster object to check if it's Harvest-only
        const cluster = this.clusters.find(c => c.name === clusterName);
        if (cluster && cluster.source === 'harvest') {
            // Harvest-only cluster - show monitoring status instead
            statusCell.innerHTML = `
                <div class="status-indicator">
                    <div class="status-circle status-online"></div>
                    <span>Monitoring</span>
                </div>
            `;
            return;
        }

        try {
            // Try a lightweight API call to test connectivity
            const response = await this.clientManager.callTool('cluster_list_svms', {
                cluster_name: clusterName
            });
            
            // Check if response indicates success (not an error)
            const isOnline = response && typeof response === 'string' && 
                           !response.toLowerCase().includes('failed') &&
                           !response.toLowerCase().includes('unreachable') &&
                           !response.toLowerCase().includes('error');
            
            if (isOnline) {
                statusCell.innerHTML = `
                    <div class="status-indicator">
                        <div class="status-circle status-online"></div>
                        <span>Connected</span>
                    </div>
                `;
            } else {
                statusCell.innerHTML = `
                    <div class="status-indicator">
                        <div class="status-circle status-offline"></div>
                        <span>Offline</span>
                    </div>
                `;
            }
        } catch (error) {
            // Network error or API failure
            statusCell.innerHTML = `
                <div class="status-indicator">
                    <div class="status-circle status-offline"></div>
                    <span>Offline</span>
                </div>
            `;
        }
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
        const cell = document.querySelector(`.capacity-cell[data-cluster-name="${clusterName}"]`);
        if (!cell) return;
        
        try {
            // Find cluster object to check if it's Harvest-only
            const cluster = this.clusters.find(c => c.name === clusterName);
            if (cluster && cluster.source === 'harvest') {
                // Harvest-only cluster - try to get capacity from Harvest metrics
                if (this.harvestAvailable) {
                    await this.loadClusterCapacityFromHarvest(clusterName);
                } else {
                    cell.innerHTML = 'N/A';
                }
                return;
            }
            
            // Get aggregates for this cluster via ONTAP MCP
            const response = await this.clientManager.callTool('cluster_list_aggregates', {
                cluster_name: clusterName
            });
            
            // Parse aggregate data and sum available space
            const totalAvailable = this.parseAggregateCapacity(response);
            const formattedCapacity = totalAvailable !== null ? this.formatCapacity(totalAvailable) : '';
            
            // Update the cell
            cell.innerHTML = formattedCapacity;
        } catch (error) {
            console.error(`Failed to load capacity for ${clusterName}:`, error);
            cell.innerHTML = '';
        }
    }

    /**
     * Load cluster capacity from Harvest metrics (for Harvest-only clusters)
     */
    async loadClusterCapacityFromHarvest(clusterName) {
        const cell = document.querySelector(`.capacity-cell[data-cluster-name="${clusterName}"]`);
        if (!cell) return;
        
        try {
            const harvestClient = this.clientManager.clients.get('harvest-remote');
            if (!harvestClient) {
                cell.innerHTML = 'N/A';
                return;
            }
            
            // Query aggregate space metrics for this cluster
            const response = await harvestClient.callMcp('metrics_query', {
                query: `aggr_space_available{cluster="${clusterName}"}`
            });
            
            const parsed = typeof response === 'string' ? JSON.parse(response) : response;
            const results = parsed?.data?.result || [];
            
            if (results.length === 0) {
                cell.innerHTML = 'N/A';
                return;
            }
            
            // Sum available space across all aggregates
            let totalAvailableBytes = 0;
            results.forEach(result => {
                if (result.value && Array.isArray(result.value)) {
                    const bytes = parseFloat(result.value[1]);
                    if (!isNaN(bytes)) {
                        totalAvailableBytes += bytes;
                    }
                }
            });
            
            const formattedCapacity = totalAvailableBytes > 0 ? this.formatCapacity(totalAvailableBytes) : 'N/A';
            cell.innerHTML = formattedCapacity;
        } catch (error) {
            console.error(`Failed to load Harvest capacity for ${clusterName}:`, error);
            cell.innerHTML = 'N/A';
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
        const statusCell = document.querySelector(`.status-cell[data-cluster-name="${clusterName}"]`);
        
        try {
            this.notifications.showInfo(`Testing connection to ${clusterName}...`);
            
            // Update status to checking
            if (statusCell) {
                statusCell.innerHTML = `
                    <div class="status-indicator">
                        <div class="status-circle status-checking"></div>
                        <span>Testing...</span>
                    </div>
                `;
            }
            
            const response = await this.apiClient.testClusterConnection(clusterName);

            // Response is now text from Streamable HTTP client
            if (response && typeof response === 'string' && response.includes('successful')) {
                this.notifications.showSuccess(`Connection to ${clusterName} successful`);
                
                // Update status to online
                if (statusCell) {
                    statusCell.innerHTML = `
                        <div class="status-indicator">
                            <div class="status-circle status-online"></div>
                            <span>Connected</span>
                        </div>
                    `;
                }
            } else {
                this.notifications.showError(`Connection to ${clusterName} failed: ${response || 'Unknown error'}`);
                
                // Update status to offline
                if (statusCell) {
                    statusCell.innerHTML = `
                        <div class="status-indicator">
                            <div class="status-circle status-offline"></div>
                            <span>Offline</span>
                        </div>
                    `;
                }
            }
        } catch (error) {
            this.notifications.showError(`Connection test failed: ${error.message}`);
            
            // Update status to offline
            if (statusCell) {
                statusCell.innerHTML = `
                    <div class="status-indicator">
                        <div class="status-circle status-offline"></div>
                        <span>Offline</span>
                    </div>
                `;
            }
        }
    }

    /**
     * Sort clusters table by column
     */
    sortClusters(column) {
        if (!this.clusters || this.clusters.length === 0) return;
        
        // Toggle direction if same column, otherwise default to ascending
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        // Helper function to extract numeric values from formatted strings
        const parseNumeric = (value) => {
            if (!value || value === 'N/A' || value === '') return 0;
            // Remove units and commas, parse as float
            const numStr = value.toString().replace(/[^0-9.-]/g, '');
            return parseFloat(numStr) || 0;
        };
        
        // Get cell values for sorting (capacity and IOPS from DOM)
        const getCapacity = (clusterName) => {
            const cell = document.querySelector(`.capacity-cell[data-cluster-name="${clusterName}"]`);
            return cell ? cell.textContent.trim() : '';
        };
        
        const getIOPS = (clusterName) => {
            const cell = document.querySelector(`.iops-cell[data-cluster-name="${clusterName}"]`);
            return cell ? cell.textContent.trim() : '';
        };
        
        const getStatus = (clusterName) => {
            const cell = document.querySelector(`.status-cell[data-cluster-name="${clusterName}"] span`);
            const status = cell ? cell.textContent.trim() : 'Unknown';
            // Map status to sortable order: Connected=1, Monitoring=2, Checking=3, Offline=4
            const statusOrder = {
                'Connected': 1,
                'Monitoring': 2,
                'Checking...': 3,
                'Offline': 4
            };
            return statusOrder[status] || 5;
        };
        
        // Map column names to sort functions
        const columnMappings = {
            'name': cluster => cluster.name || '',
            'ip': cluster => cluster.cluster_ip || '',
            'iops': cluster => parseNumeric(getIOPS(cluster.name)),
            'capacity': cluster => parseNumeric(getCapacity(cluster.name)),
            'status': cluster => getStatus(cluster.name)
        };
        
        const getValueFn = columnMappings[column];
        if (!getValueFn) {
            console.warn(`Unknown sort column: ${column}`);
            return;
        }
        
        // Sort clusters array
        const sorted = [...this.clusters].sort((a, b) => {
            const aVal = getValueFn(a);
            const bVal = getValueFn(b);
            
            // Handle numeric sorting for IOPS, capacity, and status
            if (column === 'iops' || column === 'capacity' || column === 'status') {
                return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }
            
            // Handle string sorting for name and IP
            if (this.sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
        
        // Update clusters array with sorted order
        this.clusters = sorted;
        
        // Re-render table
        this.renderClustersTable();
    }

    async handleMcpToggle(clusterName, isEnabled) {
        const cluster = this.clusters.find(c => c.name === clusterName);
        if (!cluster) {
            this.notifications.showError(`Cluster ${clusterName} not found`);
            return;
        }

        if (isEnabled) {
            // Check if cluster has credentials (not a Harvest-only cluster)
            const hasCredentials = cluster.username && cluster.password && 
                                   cluster.cluster_ip && cluster.cluster_ip !== 'N/A';
            
            if (!hasCredentials) {
                // This is a Harvest-only cluster - need credentials
                this.notifications.showInfo(`Please provide credentials for ${clusterName}`);
                
                // Revert toggle immediately
                const toggle = document.querySelector(`input[data-cluster-name="${clusterName}"]`);
                if (toggle) toggle.checked = false;
                
                // Open Add Cluster modal with pre-filled data
                this.openAddClusterModal({
                    name: cluster.name,
                    cluster_ip: cluster.cluster_ip,
                    description: cluster.description
                });
                
                return;
            }
            
            // Add cluster to MCP (has credentials)
            try {
                this.notifications.showInfo(`Adding ${clusterName} to ONTAP MCP...`);
                
                const response = await this.apiClient.callMcp('add_cluster', {
                    name: cluster.name,
                    cluster_ip: cluster.cluster_ip,
                    username: cluster.username,
                    password: cluster.password,
                    description: cluster.description || `Added via MCP toggle`
                });

                if (response && response.includes('added successfully')) {
                    this.mcpLoadedClusters.add(clusterName);
                    this.notifications.showSuccess(`${clusterName} added to ONTAP MCP`);
                    // Refresh status check
                    this.checkClusterStatus(clusterName);
                } else {
                    this.notifications.showError(`Failed to add ${clusterName} to MCP: ${response}`);
                    // Revert toggle
                    const toggle = document.querySelector(`input[data-cluster-name="${clusterName}"]`);
                    if (toggle) toggle.checked = false;
                }
            } catch (error) {
                this.notifications.showError(`Failed to add ${clusterName} to MCP: ${error.message}`);
                // Revert toggle
                const toggle = document.querySelector(`input[data-cluster-name="${clusterName}"]`);
                if (toggle) toggle.checked = false;
            }
        } else {
            // Note: Removing from MCP is not currently implemented in the MCP server
            // For now, we'll just update the UI tracking
            this.notifications.showWarning(`Note: ${clusterName} remains in MCP session. Cluster removal not yet implemented.`);
            this.mcpLoadedClusters.delete(clusterName);
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
    setTimeout(async () => {
        chatbot = new ChatbotAssistant(app);
        // Store reference to chatbot in app for view switching
        app.chatbot = chatbot;
        
        // Wait for chatbot initialization to complete
        console.log('⏳ Waiting for ChatbotAssistant initialization...');
        const waitForInit = setInterval(async () => {
            if (chatbot.isInitialized) {
                clearInterval(waitForInit);
                console.log('✅ ChatbotAssistant initialized');
                
                // CorrectiveActionParser already uses centralized OpenAI service
                // Just verify it's properly initialized
                console.log('✅ CorrectiveActionParser using centralized OpenAI service');
                if (!chatbot.mockMode) {
                    console.log('   OpenAI service active and shared across all components');
                } else {
                    console.log('   ⚠️ ChatbotAssistant in mock mode - no API key configured');
                }
            }
        }, 100); // Check every 100ms
    }, 1000);
});

// Global service button handlers (called from HTML)
window.openVolumes = () => app.openVolumes();
window.openSnapshots = () => app.openSnapshots();
window.openExports = () => app.openExports();
window.openCifsShares = () => app.openCifsShares();