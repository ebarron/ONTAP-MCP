// NetApp ONTAP MCP Demo Application
class OntapMcpDemo {
    constructor() {
        this.mcpUrl = 'http://localhost:3000';
        this.clusters = [];
        this.currentCluster = null;
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
            const response = await this.callMcp('list_registered_clusters');
            
            console.log('MCP Response:', response); // DEBUG
            
            if (response.success) {
                this.clusters = response.data || [];
                console.log('Parsed clusters:', this.clusters); // DEBUG
                
                if (!Array.isArray(this.clusters) && this.clusters) {
                    this.clusters = [];
                }
            } else {
                this.showError('Failed to load clusters: ' + (response.error || 'Unknown error'));
                this.clusters = [];
            }
        } catch (error) {
            console.error('Error loading clusters:', error);
            this.showError('Failed to load clusters. Make sure MCP server is running on ' + this.mcpUrl);
            this.clusters = [];
        } finally {
            this.showLoading(false);
            this.updateUI();
        }
    }

    async callMcp(toolName, params = {}) {
        try {
            const response = await fetch(`${this.mcpUrl}/api/tools/${toolName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message || 'MCP call failed');
            }

            return {
                success: true,
                data: this.parseMcpResponse(data.content)
            };
        } catch (error) {
            console.error('MCP call failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    parseMcpResponse(content) {
        if (!content || !Array.isArray(content)) return null;
        
        const textContent = content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('');

        console.log('Text content:', textContent); // DEBUG

        // Special handling for list_registered_clusters
        if (textContent.includes('Registered clusters')) {
            const clusters = this.parseClusterList(textContent);
            console.log('parseClusterList result:', clusters); // DEBUG
            return clusters;
        }

        // Try to parse as JSON for structured data
        try {
            if (textContent.includes('{') || textContent.includes('[')) {
                return JSON.parse(textContent);
            }
        } catch (e) {
            // Not JSON, return as text
        }

        return textContent;
    }

    parseClusterList(text) {
        const clusters = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            // Look for lines like: "- cluster-name: ip (description)"
            const match = line.match(/^-\s+([^:]+):\s+([^\s]+)\s+\(([^)]+)\)/);
            if (match) {
                clusters.push({
                    name: match[1].trim(),
                    cluster_ip: match[2].trim(),
                    description: match[3].trim(),
                    username: 'admin', // Default from test clusters
                    password: '***' // Hidden for security
                });
            }
        }
        
        return clusters;
    }

    async addCluster(clusterData) {
        try {
            const response = await this.callMcp('add_cluster', {
                name: clusterData.name,
                cluster_ip: clusterData.cluster_ip,
                username: clusterData.username,
                password: clusterData.password,
                description: clusterData.description
            });

            if (response.success) {
                await this.loadClusters();
                this.showSuccess('Cluster added successfully');
                return true;
            } else {
                this.showError(response.error || 'Failed to add cluster');
                return false;
            }
        } catch (error) {
            console.error('Error adding cluster:', error);
            this.showError('Failed to add cluster: ' + error.message);
            return false;
        }
    }

    async getClusterInfo(clusterName) {
        try {
            const response = await this.callMcp('cluster_list_svms', {
                cluster_name: clusterName
            });

            if (response.success) {
                return response.data;
            } else {
                console.error('Failed to get cluster info:', response.error);
                return null;
            }
        } catch (error) {
            console.error('Error getting cluster info:', error);
            return null;
        }
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
            this.showError('Please fill in all required fields');
            return;
        }

        // Check if cluster name already exists
        if (this.clusters.some(c => c.name === clusterData.name)) {
            this.showError('A cluster with this name already exists');
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
                <div class="table-cell" style="width: 25%;">
                    <span class="cluster-name" onclick="app.openClusterDetails(${JSON.stringify(cluster).replace(/"/g, '&quot;')})">
                        ${this.escapeHtml(cluster.name || 'Unnamed')}
                    </span>
                </div>
                <div class="table-cell" style="width: 20%;">
                    ${this.escapeHtml(cluster.cluster_ip || 'N/A')}
                </div>
                <div class="table-cell" style="width: 15%;">
                    ${this.escapeHtml(cluster.username || 'N/A')}
                </div>
                <div class="table-cell" style="width: 15%;">
                    <span class="password-masked">••••••••</span>
                </div>
                <div class="table-cell" style="width: 15%;">
                    <div class="status-indicator">
                        <div class="status-circle status-online"></div>
                        <span>Connected</span>
                    </div>
                </div>
                <div class="table-cell" style="width: 10%;">
                    <button class="action-button" onclick="app.testClusterConnection('${cluster.name}')">
                        Test
                    </button>
                </div>
            </div>
        `).join('');
    }

    async testClusterConnection(clusterName) {
        try {
            this.showInfo(`Testing connection to ${clusterName}...`);
            
            const response = await this.callMcp('cluster_list_svms', {
                cluster_name: clusterName
            });

            if (response.success) {
                this.showSuccess(`Connection to ${clusterName} successful`);
            } else {
                this.showError(`Connection to ${clusterName} failed: ${response.error}`);
            }
        } catch (error) {
            this.showError(`Connection test failed: ${error.message}`);
        }
    }

    // Service button handlers
    async openVolumes() {
        if (!this.currentCluster) return;
        
        try {
            const response = await this.callMcp('cluster_list_volumes', {
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
            const response = await this.callMcp('list_snapshot_policies', {
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
            const response = await this.callMcp('list_export_policies', {
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
            const response = await this.callMcp('cluster_list_cifs_shares', {
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
                <span>${this.escapeHtml(message)}</span>
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Toast notification styles (injected dynamically)
const toastStyles = `
    .toast-message {
        position: fixed;
        top: 80px;
        right: 24px;
        z-index: 3000;
        min-width: 300px;
        max-width: 500px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideInFromRight 0.3s ease-out;
    }

    .toast-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        gap: 12px;
    }

    .toast-close {
        font-size: 18px;
        color: inherit;
        opacity: 0.7;
        padding: 2px 6px;
        border-radius: 3px;
        transition: opacity 0.2s;
    }

    .toast-close:hover {
        opacity: 1;
    }

    .toast-error {
        background-color: var(--notification-error);
        color: white;
    }

    .toast-success {
        background-color: var(--notification-success);
        color: white;
    }

    .toast-warning {
        background-color: var(--notification-warning);
        color: white;
    }

    .toast-info {
        background-color: var(--notification-information);
        color: white;
    }

    @keyframes slideInFromRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;

// Inject toast styles
const styleSheet = document.createElement('style');
styleSheet.textContent = toastStyles;
document.head.appendChild(styleSheet);

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new OntapMcpDemo();
});

// Global service button handlers (called from HTML)
window.openVolumes = () => app.openVolumes();
window.openSnapshots = () => app.openSnapshots();
window.openExports = () => app.openExports();
window.openCifsShares = () => app.openCifsShares();