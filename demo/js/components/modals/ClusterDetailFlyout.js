/**
 * ClusterDetailFlyout Component
 * Flyout panel for displaying cluster details and operations
 */
class ClusterDetailFlyout {
    constructor() {
        this.flyoutId = 'clusterDetail';
    }

    // Render the complete cluster detail flyout HTML
    render() {
        return `
            <!-- Cluster Detail Flyout -->
            <div class="flyout-overlay" id="${this.flyoutId}" style="display: none;">
                <div class="flyout-content">
                    <div class="flyout-header">
                        <h2 id="flyoutClusterName">Cluster Details</h2>
                        <button class="flyout-close" id="closeFlyout">&times;</button>
                    </div>
                    <div class="flyout-body">
                        <div class="cluster-info">
                            <h3>Cluster Information</h3>
                            <div class="info-grid">
                                <div class="info-item">
                                    <label>IP Address:</label>
                                    <span id="flyoutClusterIp">-</span>
                                </div>
                                <div class="info-item">
                                    <label>Username:</label>
                                    <span id="flyoutUsername">-</span>
                                </div>
                                <div class="info-item">
                                    <label>Description:</label>
                                    <span id="flyoutDescription">-</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="cluster-services">
                            <h3>Available Operations</h3>
                            <div class="services-grid">
                                <button class="service-button" onclick="showVolumeOperations()">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="var(--icon-primary)" stroke-width="2" fill="none"/>
                                    </svg>
                                    Volume Management
                                </button>
                                <button class="service-button" onclick="showCifsOperations()">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M20 6L9 17L4 12" stroke="var(--icon-primary)" stroke-width="2" fill="none"/>
                                    </svg>
                                    CIFS Shares
                                </button>
                                <button class="service-button" onclick="showNfsOperations()">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 2L22 7L12 12L2 7L12 2Z" stroke="var(--icon-primary)" stroke-width="2" fill="none"/>
                                    </svg>
                                    NFS Exports
                                </button>
                                <button class="service-button" onclick="showSnapshotOperations()">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M21 16V8C21 6.89543 20.1046 6 19 6H5C3.89543 6 3 6.89543 3 8V16C3 17.1046 3.89543 18 5 18H19C20.1046 18 21 17.1046 21 16Z" stroke="var(--icon-primary)" stroke-width="2" fill="none"/>
                                    </svg>
                                    Snapshot Policies
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Initialize the component (inject HTML into DOM)
    init(parentElement) {
        // Check if flyout already exists
        if (document.getElementById(this.flyoutId)) {
            return;
        }
        
        const flyoutHTML = this.render();
        parentElement.insertAdjacentHTML('beforeend', flyoutHTML);
    }

    // Open the flyout with cluster data
    open(clusterData) {
        const flyout = document.getElementById(this.flyoutId);
        if (flyout) {
            // Populate cluster data
            document.getElementById('flyoutClusterName').textContent = clusterData.name || 'Cluster Details';
            document.getElementById('flyoutClusterIp').textContent = clusterData.cluster_ip || '-';
            document.getElementById('flyoutUsername').textContent = clusterData.username || '-';
            document.getElementById('flyoutDescription').textContent = clusterData.description || '-';
            
            flyout.style.display = 'flex';
        }
    }

    // Close the flyout
    close() {
        const flyout = document.getElementById(this.flyoutId);
        if (flyout) {
            flyout.style.display = 'none';
        }
    }
}

// Create global instance
const clusterDetailFlyout = new ClusterDetailFlyout();
