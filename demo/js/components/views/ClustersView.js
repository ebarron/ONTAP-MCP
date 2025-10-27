/**
 * ClustersView Component
 * Manages the Clusters view display and interactions
 */

class ClustersView {
    constructor() {
        this.containerId = 'clustersView';
        this.clusterCount = 0;
    }

    // Generate the complete ClustersView HTML
    render() {
        return `
            <!-- Clusters View -->
            <div id="clustersView" class="view-container">
                <div class="page-header">
                    <div role="heading" class="typography-module_h02__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_sub-heading-alerts__9dguW">My Fleet</div>
                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw style_alert-detail-sub-heading__Gccrb">Manage your ONTAP clusters and storage provisioning.</p>
                </div>
                
                <div role="heading" class="typography-module_h03__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_alerts-header-layout__8HFmd style_table-header-gap__xFIB7">
                    <div class="TableCounter-module_base__Mi4wLjYtaW50ZXJuYWw">
                        <span><span>Clusters&nbsp;</span><span id="clusterCount">(0)</span></span>
                        <button data-component="Button" type="button" class="buttons-module_outline__Mi4wLjYtaW50ZXJuYWw btn-compact" id="addClusterBtn">Add</button>
                    </div>
                    <div class="style_text-align-right__TD9Ez">
                        <input type="text" class="search-input-compact" placeholder="Search clusters..." id="searchInput">
                    </div>
                </div>
                
                <div class="Table-module_base__Mi4wLjYtaW50ZXJuYWw">
                    <div class="Table-module_headers-group-container__Mi4wLjYtaW50ZXJuYWw">
                        <div class="Table-module_header-row__Mi4wLjYtaW50ZXJuYWw">
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 60px;">
                                <span></span>
                            </div>
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 200px;">
                                <div class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Cluster Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="app.sortClusters('name')">
                                        <svg role="img" aria-labelledby="ic-table-sort-asc" xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5" fill="none">
                                            <desc id="ic-table-sort-asc">Sort ascending</desc>
                                            <path d="M4.59637 0.355413C4.79062 0.159127 5.10721 0.157483 5.30349 0.351742L9.13575 4.14463C9.45324 4.45885 9.23072 5 8.78402 5H1.19826C0.75406 5 0.530411 4.46402 0.842862 4.1483L4.59637 0.355413Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                        <svg role="img" aria-labelledby="ic-table-sort-desc" xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5" fill="none">
                                            <desc id="ic-table-sort-desc">Sort descending</desc>
                                            <path d="M5.35355 4.64645C5.15829 4.84171 4.84171 4.84171 4.64645 4.64645L0.853552 0.853552C0.538569 0.53857 0.761653 -1.30397e-07 1.20711 -1.70094e-07L8.79289 -8.46103e-07C9.23835 -8.85799e-07 9.46143 0.53857 9.14645 0.853553L5.35355 4.64645Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                    </button>
                                </div>
                                <div class="Table-module_header-handle__Mi4wLjYtaW50ZXJuYWw"></div>
                            </div>
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 150px;">
                                <div class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Cluster IP</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="app.sortClusters('ip')">
                                        <svg role="img" aria-labelledby="ic-table-sort-asc" xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5" fill="none">
                                            <desc id="ic-table-sort-asc">Sort ascending</desc>
                                            <path d="M4.59637 0.355413C4.79062 0.159127 5.10721 0.157483 5.30349 0.351742L9.13575 4.14463C9.45324 4.45885 9.23072 5 8.78402 5H1.19826C0.75406 5 0.530411 4.46402 0.842862 4.1483L4.59637 0.355413Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                        <svg role="img" aria-labelledby="ic-table-sort-desc" xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5" fill="none">
                                            <desc id="ic-table-sort-desc">Sort descending</desc>
                                            <path d="M5.35355 4.64645C5.15829 4.84171 4.84171 4.84171 4.64645 4.64645L0.853552 0.853552C0.538569 0.53857 0.761653 -1.30397e-07 1.20711 -1.70094e-07L8.79289 -8.46103e-07C9.23835 -8.85799e-07 9.46143 0.53857 9.14645 0.853553L5.35355 4.64645Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                    </button>
                                </div>
                                <div class="Table-module_header-handle__Mi4wLjYtaW50ZXJuYWw"></div>
                            </div>
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 120px;" id="iopsColumnHeader">
                                <div class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>IOPS (1h avg)</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="app.sortClusters('iops')">
                                        <svg role="img" aria-labelledby="ic-table-sort-asc" xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5" fill="none">
                                            <desc id="ic-table-sort-asc">Sort ascending</desc>
                                            <path d="M4.59637 0.355413C4.79062 0.159127 5.10721 0.157483 5.30349 0.351742L9.13575 4.14463C9.45324 4.45885 9.23072 5 8.78402 5H1.19826C0.75406 5 0.530411 4.46402 0.842862 4.1483L4.59637 0.355413Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                        <svg role="img" aria-labelledby="ic-table-sort-desc" xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5" fill="none">
                                            <desc id="ic-table-sort-desc">Sort descending</desc>
                                            <path d="M5.35355 4.64645C5.15829 4.84171 4.84171 4.84171 4.64645 4.64645L0.853552 0.853552C0.538569 0.53857 0.761653 -1.30397e-07 1.20711 -1.70094e-07L8.79289 -8.46103e-07C9.23835 -8.85799e-07 9.46143 0.53857 9.14645 0.853553L5.35355 4.64645Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                    </button>
                                </div>
                                <div class="Table-module_header-handle__Mi4wLjYtaW50ZXJuYWw"></div>
                            </div>
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 120px;">
                                <div class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Free Capacity</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="app.sortClusters('capacity')">
                                        <svg role="img" aria-labelledby="ic-table-sort-asc" xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5" fill="none">
                                            <desc id="ic-table-sort-asc">Sort ascending</desc>
                                            <path d="M4.59637 0.355413C4.79062 0.159127 5.10721 0.157483 5.30349 0.351742L9.13575 4.14463C9.45324 4.45885 9.23072 5 8.78402 5H1.19826C0.75406 5 0.530411 4.46402 0.842862 4.1483L4.59637 0.355413Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                        <svg role="img" aria-labelledby="ic-table-sort-desc" xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5" fill="none">
                                            <desc id="ic-table-sort-desc">Sort descending</desc>
                                            <path d="M5.35355 4.64645C5.15829 4.84171 4.84171 4.84171 4.64645 4.64645L0.853552 0.853552C0.538569 0.53857 0.761653 -1.30397e-07 1.20711 -1.70094e-07L8.79289 -8.46103e-07C9.23835 -8.85799e-07 9.46143 0.53857 9.14645 0.853553L5.35355 4.64645Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                    </button>
                                </div>
                                <div class="Table-module_header-handle__Mi4wLjYtaW50ZXJuYWw"></div>
                            </div>
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 150px;">
                                <span>Description</span>
                            </div>
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 120px;">
                                <div class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Status</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="app.sortClusters('status')">
                                        <svg role="img" aria-labelledby="ic-table-sort-asc" xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5" fill="none">
                                            <desc id="ic-table-sort-asc">Sort ascending</desc>
                                            <path d="M4.59637 0.355413C4.79062 0.159127 5.10721 0.157483 5.30349 0.351742L9.13575 4.14463C9.45324 4.45885 9.23072 5 8.78402 5H1.19826C0.75406 5 0.530411 4.46402 0.842862 4.1483L4.59637 0.355413Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                        <svg role="img" aria-labelledby="ic-table-sort-desc" xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5" fill="none">
                                            <desc id="ic-table-sort-desc">Sort descending</desc>
                                            <path d="M5.35355 4.64645C5.15829 4.84171 4.84171 4.84171 4.64645 4.64645L0.853552 0.853552C0.538569 0.53857 0.761653 -1.30397e-07 1.20711 -1.70094e-07L8.79289 -8.46103e-07C9.23835 -8.85799e-07 9.46143 0.53857 9.14645 0.853553L5.35355 4.64645Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                    </button>
                                </div>
                                <div class="Table-module_header-handle__Mi4wLjYtaW50ZXJuYWw"></div>
                            </div>
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 140px;">
                                <span>ONTAP MCP</span>
                            </div>
                        </div>
                    </div>
                    <div class="Table-module_body__Mi4wLjYtaW50ZXJuYWw" id="clustersTableBody">
                            <!-- Clusters will be populated here -->
                        </div>
                    </div>
                    
                    <!-- Provision Storage Button (below table) -->
                    <div style="margin-top: 16px;">
                        <button data-component="Button" type="button" class="buttons-module_text__Mi4wLjYtaW50ZXJuYWw TableCounter-module_reset__Mi4wLjYtaW50ZXJuYWw" id="provisionStorageLink">Provision Storage</button>
                    </div>
            </div>
        `;
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

    // Initialize the view (inject HTML into DOM)
    init(parentElement) {
        // Check if view already exists
        if (document.getElementById(this.containerId)) {
            return;
        }
        
        const viewHTML = this.render();
        // Insert at the beginning so it appears before chatbot
        parentElement.insertAdjacentHTML('afterbegin', viewHTML);
    }

    // Update cluster count
    updateClusterCount(count) {
        this.clusterCount = count;
        const clusterCountElement = document.getElementById('clusterCount');
        if (clusterCountElement) {
            clusterCountElement.textContent = `(${count})`;
        }
    }

    // Load clusters (placeholder - actual implementation in app.js)
    loadClusters() {
        // This will be called by app.js which has the MCP client
        console.log('ClustersView.loadClusters() - to be implemented by app.js');
    }
}

// Create global instance
const clustersView = new ClustersView();
