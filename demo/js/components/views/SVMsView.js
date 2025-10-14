/**
 * SVMsView Component
 * Displays SVM (Storage Virtual Machine) inventory from Harvest MCP metrics
 */

class SVMsView {
    constructor() {
        this.containerId = 'svmsView';
        this.svmsData = [];
        this.svmCount = 0;
        this.autoRefreshInterval = null;
        this.REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
    }

    // Show the view
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
        }
    }

    // Hide the view
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }

    // Render the HTML structure
    render() {
        return `
            <div id="${this.containerId}" class="view-container" style="display: none;">
                <div class="view-header">
                    <div class="view-header-content">
                        <h1 class="view-title">
                            SVMs
                            <span id="svmCount" class="count-badge">(0)</span>
                        </h1>
                        <div class="view-subtitle">Storage Virtual Machines across your infrastructure</div>
                    </div>
                    <div class="view-actions">
                        <span id="svmsLastUpdated" class="last-updated">Last updated: Never</span>
                    </div>
                </div>

                <div class="content-area">
                    <!-- SVMs Table -->
                    <div class="table-card">
                        <div class="Table-module_table-wrapper__Mi4wLjYtaW50ZXJuYWw">
                            <!-- Table Headers -->
                            <div class="Table-module_headers-group-container__Mi4wLjYtaW50ZXJuYWw" style="top: 0px;">
                                <div class="Table-module_header-row__Mi4wLjYtaW50ZXJuYWw">
                                    <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 200px;">
                                        <span>SVM Name</span>
                                        <button class="Table-module_sort-button__Mi4wLjYtaW50ZXJuYWw" aria-label="Sort by SVM Name">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                <path d="M8 3l3 3H5l3-3zm0 10l-3-3h6l-3 3z"/>
                                            </svg>
                                        </button>
                                    </div>
                                    <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 120px;">
                                        <span>State</span>
                                        <button class="Table-module_sort-button__Mi4wLjYtaW50ZXJuYWw" aria-label="Sort by State">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                <path d="M8 3l3 3H5l3-3zm0 10l-3-3h6l-3 3z"/>
                                            </svg>
                                        </button>
                                    </div>
                                    <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 180px;">
                                        <span>Protocols</span>
                                        <button class="Table-module_sort-button__Mi4wLjYtaW50ZXJuYWw" aria-label="Sort by Protocols">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                <path d="M8 3l3 3H5l3-3zm0 10l-3-3h6l-3 3z"/>
                                            </svg>
                                        </button>
                                    </div>
                                    <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 180px;">
                                        <span>Allocated Capacity (GiB)</span>
                                        <button class="Table-module_sort-button__Mi4wLjYtaW50ZXJuYWw" aria-label="Sort by Allocated">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                <path d="M8 3l3 3H5l3-3zm0 10l-3-3h6l-3 3z"/>
                                            </svg>
                                        </button>
                                    </div>
                                    <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 180px;">
                                        <span>Available Capacity (GiB)</span>
                                        <button class="Table-module_sort-button__Mi4wLjYtaW50ZXJuYWw" aria-label="Sort by Available">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                <path d="M8 3l3 3H5l3-3zm0 10l-3-3h6l-3 3z"/>
                                            </svg>
                                        </button>
                                    </div>
                                    <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 130px;">
                                        <span>Volume Count</span>
                                        <button class="Table-module_sort-button__Mi4wLjYtaW50ZXJuYWw" aria-label="Sort by Volume Count">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                <path d="M8 3l3 3H5l3-3zm0 10l-3-3h6l-3 3z"/>
                                            </svg>
                                        </button>
                                    </div>
                                    <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 200px;">
                                        <span>Cluster Name</span>
                                        <button class="Table-module_sort-button__Mi4wLjYtaW50ZXJuYWw" aria-label="Sort by Cluster">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                <path d="M8 3l3 3H5l3-3zm0 10l-3-3h6l-3 3z"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Table Body -->
                            <div class="Table-module_rows-group-container__Mi4wLjYtaW50ZXJuYWw style_table-outer-layout__RLkyh style_tbl-height-wo-pager__qyc4B Table-module_fixed-height__Mi4wLjYtaW50ZXJuYWw">
                                <div id="svmsTableBody" class="Table-module_rows-group__Mi4wLjYtaW50ZXJuYWw">
                                    <!-- Rows will be inserted here -->
                                    <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw" style="padding: 20px; text-align: center;">
                                        <span class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Loading SVMs...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Initialize the view
    init(parentElement) {
        // Check if view already exists
        if (document.getElementById(this.containerId)) {
            console.log('SVMsView already initialized');
            return;
        }

        const viewHTML = this.render();
        // Insert at the beginning so it appears before chatbot
        parentElement.insertAdjacentHTML('afterbegin', viewHTML);
    }

    // Set up horizontal scroll synchronization
    setupScrollSync() {
        const tableBody = document.querySelector('#svmsView .Table-module_rows-group-container__Mi4wLjYtaW50ZXJuYWw');
        const tableHeader = document.querySelector('#svmsView .Table-module_headers-group-container__Mi4wLjYtaW50ZXJuYWw');
        
        if (tableBody && tableHeader) {
            // Enable horizontal scrolling on the header container
            tableHeader.style.overflowX = 'auto';
            tableHeader.style.overflowY = 'hidden';
            
            // Sync body scroll → header scroll
            tableBody.addEventListener('scroll', () => {
                tableHeader.scrollLeft = tableBody.scrollLeft;
            });
            
            // Sync header scroll → body scroll (bidirectional)
            tableHeader.addEventListener('scroll', () => {
                tableBody.scrollLeft = tableHeader.scrollLeft;
            });
        }
    }

    // Update SVM count
    updateSVMCount(count) {
        this.svmCount = count;
        const svmCountElement = document.getElementById('svmCount');
        if (svmCountElement) {
            svmCountElement.textContent = `(${count})`;
        }
    }

    // Format timestamp for display
    formatTimestamp() {
        const now = new Date();
        return now.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // Update last updated timestamp
    updateLastUpdated() {
        const element = document.getElementById('svmsLastUpdated');
        if (element) {
            element.textContent = `Last updated: ${this.formatTimestamp()}`;
        }
    }

    // Parse response (handles both objects and JSON strings)
    parseResponse(response) {
        if (typeof response === 'string') {
            try {
                return JSON.parse(response);
            } catch (e) {
                console.error('Failed to parse response:', e);
                return null;
            }
        }
        return response;
    }

    // Extract metric values from Harvest response
    extractMetrics(response) {
        const parsed = this.parseResponse(response);
        if (!parsed || !parsed.data || !parsed.data.result) {
            return [];
        }
        return parsed.data.result;
    }

    // Render a single SVM row
    renderSVMRow(svm, index) {
        const rowClass = index % 2 === 0 ? 
            'Table-module_row__Mi4wLjYtaW50ZXJuYWw' : 
            'Table-module_row__Mi4wLjYtaW50ZXJuYWw Table-module_stripe__Mi4wLjYtaW50ZXJuYWw';

        const svmName = svm.svm || 'Unknown';
        const state = svm.state || 'unknown';
        const protocols = svm.protocols || '-';
        const allocatedGiB = svm.allocated_bytes ? (svm.allocated_bytes / (1024**3)).toFixed(2) : '0.00';
        const availableGiB = svm.available_bytes ? (svm.available_bytes / (1024**3)).toFixed(2) : '0.00';
        const volumeCount = svm.volume_count || 0;
        const cluster = svm.cluster || 'Unknown';

        // State badge color
        const stateColor = state === 'running' ? '#00A300' : 
                          state === 'stopped' ? '#D32F2F' : '#757575';

        return `
            <div class="${rowClass}" data-testid="table-row">
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-SVMName" style="flex: 1 0 200px;">
                    ${svmName}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-State" style="flex: 1 0 120px;">
                    <span style="color: ${stateColor}; font-weight: 500;">${state}</span>
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Protocols" style="flex: 1 0 180px;">
                    ${protocols}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Allocated" style="flex: 1 0 180px;">
                    ${allocatedGiB} GiB
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Available" style="flex: 1 0 180px;">
                    ${availableGiB} GiB
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-VolumeCount" style="flex: 1 0 130px;">
                    ${volumeCount}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Cluster" style="flex: 1 0 200px;">
                    ${cluster}
                </div>
            </div>
        `;
    }

    // Store SVMs data
    storeSVMsData(svms) {
        this.svmsData = svms;
    }

    // Show error message
    showError(message) {
        const tableBody = document.getElementById('svmsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw" style="padding: 20px; text-align: center; color: var(--error-main);">
                    <span class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">${message}</span>
                </div>
            `;
        }
    }

    // Load SVMs from Harvest MCP
    async loadSVMs() {
        this.showLoadingState();

        try {
            // Check if app and client manager are available
            if (!window.app || !window.app.clientManager) {
                console.error('App or client manager not initialized');
                this.showErrorState('Application not ready. Please refresh the page.');
                return;
            }

            console.log('🔍 Loading SVMs from Harvest MCP...');
            
            // Use Harvest MCP client to query SVMs (same pattern as VolumesView)
            const harvestClient = window.app.clientManager.clients.get('harvest-remote');
            if (!harvestClient) {
                console.error('harvest-remote MCP client not available');
                this.showErrorState('Harvest monitoring not available.');
                return;
            }

            // Fetch SVM data from Harvest using MCP
            const svmLabelsPromise = harvestClient.callMcp('metrics_query', {
                query: 'svm_labels{type="data"}'  // Only data SVMs, not admin/node SVMs
            });

            const volumeCountPromise = harvestClient.callMcp('metrics_query', {
                query: 'count(volume_labels) by (svm, cluster)'
            });

            const allocatedCapacityPromise = harvestClient.callMcp('metrics_query', {
                query: 'sum(volume_size{svm!=""}) by (svm, cluster)'
            });

            const availableCapacityPromise = harvestClient.callMcp('metrics_query', {
                query: 'sum(volume_size_available{svm!=""}) by (svm, cluster)'
            });

            const [labelsResponse, volumeCountResponse, allocatedResponse, availableResponse] = await Promise.all([
                svmLabelsPromise,
                volumeCountPromise,
                allocatedCapacityPromise,
                availableCapacityPromise
            ]);

            const labelsData = this.parseResponse(labelsResponse);
            const volumeCountData = this.parseResponse(volumeCountResponse);
            const allocatedData = this.parseResponse(allocatedResponse);
            const availableData = this.parseResponse(availableResponse);

            console.log('SVM Labels data:', labelsData);
            console.log('Volume Count data:', volumeCountData);
            console.log('Allocated Capacity data:', allocatedData);
            console.log('Available Capacity data:', availableData);

            const svms = this.processSVMData(labelsData, volumeCountData, allocatedData, availableData);
            this.displaySVMs(svms);

        } catch (error) {
            console.error('Error loading SVMs:', error);
            this.showErrorState('Failed to load SVM data. Please try again.');
        }
    }

    // Process SVM data combining labels, volume count, and capacity
    processSVMData(labelsData, volumeCountData, allocatedData, availableData) {
        if (!labelsData || !labelsData.data || !labelsData.data.result) {
            return [];
        }

        // Create lookup maps for volume count and capacity data
        const volumeCountMap = new Map();
        if (volumeCountData && volumeCountData.data && volumeCountData.data.result) {
            volumeCountData.data.result.forEach(item => {
                const key = `${item.metric.cluster}:${item.metric.svm}`;
                volumeCountMap.set(key, parseInt(item.value[1]) || 0);
            });
        }

        const allocatedMap = new Map();
        if (allocatedData && allocatedData.data && allocatedData.data.result) {
            allocatedData.data.result.forEach(item => {
                const key = `${item.metric.cluster}:${item.metric.svm}`;
                allocatedMap.set(key, parseInt(item.value[1]) || 0);
            });
        }

        const availableMap = new Map();
        if (availableData && availableData.data && availableData.data.result) {
            availableData.data.result.forEach(item => {
                const key = `${item.metric.cluster}:${item.metric.svm}`;
                availableMap.set(key, parseInt(item.value[1]) || 0);
            });
        }

        const svms = labelsData.data.result.map(item => {
            const key = `${item.metric.cluster}:${item.metric.svm}`;
            const allocated_bytes = allocatedMap.get(key) || 0;
            const available_bytes = availableMap.get(key) || 0;

            return {
                svm: item.metric.svm || 'N/A',
                state: item.metric.state || 'unknown',
                protocols: this.extractProtocols(item.metric),
                allocated_bytes: allocated_bytes,
                available_bytes: available_bytes,
                volume_count: volumeCountMap.get(key) || 0,
                cluster: item.metric.cluster || 'N/A'
            };
        });

        console.log('Processed SVMs:', svms);
        return svms;
    }

    // Extract enabled protocols from SVM labels
    extractProtocols(metric) {
        const protocols = [];
        if (metric.nfs_protocol_enabled === 'true') protocols.push('NFS');
        if (metric.cifs_protocol_enabled === 'true') protocols.push('CIFS');
        if (metric.iscsi_service_enabled === 'true') protocols.push('iSCSI');
        if (metric.fcp_service_enabled === 'true') protocols.push('FCP');
        if (metric.nvme_service_enabled === 'true') protocols.push('NVMe');
        return protocols.length > 0 ? protocols.join(', ') : '-';
    }

    // Display SVMs (wrapper for populateSVMsTable)
    displaySVMs(svms) {
        this.storeSVMsData(svms);
        this.updateSVMCount(svms.length);
        this.populateSVMsTable(svms);
        this.updateLastUpdated();
        
        // Set up scroll sync after table is populated
        // Use requestAnimationFrame to ensure DOM is fully rendered
        requestAnimationFrame(() => {
            this.setupScrollSync();
        });
    }

    // Show loading state
    showLoadingState() {
        const tableBody = document.getElementById('svmsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw" style="padding: 20px; text-align: center;">
                    <span class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Loading SVMs...</span>
                </div>
            `;
        }
    }

    // Show error state
    showErrorState(message) {
        const tableBody = document.getElementById('svmsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw" style="padding: 20px; text-align: center; color: var(--error-main);">
                    <span class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">${message}</span>
                </div>
            `;
        }
    }

    // Populate SVMs table
    populateSVMsTable(svms) {
        const tableBody = document.getElementById('svmsTableBody');
        if (!tableBody) {
            console.error('SVMs table body not found');
            return;
        }

        if (svms.length === 0) {
            tableBody.innerHTML = `
                <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw" style="padding: 20px; text-align: center;">
                    <span class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">No SVMs found</span>
                </div>
            `;
            return;
        }

        // Render all SVM rows
        const rowsHTML = svms.map((svm, index) => this.renderSVMRow(svm, index)).join('');
        tableBody.innerHTML = rowsHTML;
    }

    // Start auto-refresh
    startAutoRefresh() {
        // Clear any existing interval
        this.stopAutoRefresh();
        
        // Set up new interval
        this.autoRefreshInterval = setInterval(() => {
            console.log('🔄 Auto-refreshing SVMs...');
            this.loadSVMs();
        }, this.REFRESH_INTERVAL);
        
        console.log(`✅ Auto-refresh enabled (every ${this.REFRESH_INTERVAL / 60000} minutes)`);
    }

    // Stop auto-refresh
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log('🛑 Auto-refresh disabled');
        }
    }
}

// Make it globally available
window.SVMsView = SVMsView;

// Create global instance
let svmsView = new SVMsView();
