// NFSSharesView Component  
// Displays NFS shares/qtrees table with filters and sort functionality

class NFSSharesView {
    constructor() {
        this.containerId = 'nfsSharesView';
        this.shareCount = 0;
        this.sharesData = null;
        this.lastRefreshTime = null;
        this.refreshInterval = null;
        this.sortColumn = null;
        this.sortDirection = 'asc';
    }

    // Render the complete VolumesView HTML
    render() {
        return `
            <div id="${this.containerId}" class="view-container" style="display: none;">
                <div class="page-header">
                    <div role="heading" class="typography-module_h02__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_sub-heading-alerts__9dguW">NFS Shares</div>
                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw style_alert-detail-sub-heading__Gccrb">
                        NFS share inventory across all registered clusters. 
                        <span id="nfsSharesLastUpdate" style="margin-left: 10px; color: #666;"></span>
                    </p>
                </div>
                
                <div role="heading" class="typography-module_h03__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_alerts-header-layout__8HFmd style_table-header-gap__xFIB7">
                    <div class="TableCounter-module_base__Mi4wLjYtaW50ZXJuYWw">
                        <span><span>NFS Shares&nbsp;</span><span id="nfsShareCount">(0)</span></span>
                        <div class="TableCounter-module_divider__Mi4wLjYtaW50ZXJuYWw"></div>
                        <span>Filters applied (0)</span>
                        <button data-component="Button" type="button" class="buttons-module_text__Mi4wLjYtaW50ZXJuYWw TableCounter-module_reset__Mi4wLjYtaW50ZXJuYWw">Reset</button>
                    </div>
                    <div class="style_text-align-right__TD9Ez">
                        <span title="Download NFS shares">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="cursor: pointer;">
                                <desc id="-Download">Download</desc>
                                <g clip-path="url(#clip0_2_178)">
                                    <rect width="0.1" height="0.1" fill="white"></rect>
                                </g>
                                <path d="M11.7123 2C11.3152 2 10.9934 2.31382 10.9934 2.70094L10.9934 15.6076L7.72843 12.498C7.44831 12.2236 6.99311 12.2226 6.71173 12.4957C6.43034 12.7689 6.42931 13.2127 6.70943 13.487L11.0922 17.7934C11.2458 17.9438 11.452 18.012 11.6533 17.998C11.8546 18.0129 12.061 17.9455 12.2153 17.7958L16.4516 13.6693C16.733 13.3961 16.734 12.9523 16.4539 12.678C16.1738 12.4036 15.7186 12.4026 15.4372 12.6757L12.4312 15.6081L12.4312 2.70094C12.4312 2.31382 12.1093 2 11.7123 2Z" id="base-layer" fill="var(--icon-primary)"></path>
                                <path d="M2 21.75C2 21.3358 2.33579 21 2.75 21H21.25C21.6642 21 22 21.3358 22 21.75C22 22.1642 21.6642 22.5 21.25 22.5H2.75C2.33579 22.5 2 22.1642 2 21.75Z" id="base-layer" fill="var(--icon-primary)"></path>
                                <defs>
                                    <clippath id="clip0_2_178">
                                        <rect width="0.1" height="0.1" fill="white"></rect>
                                    </clippath>
                                </defs>
                            </svg>
                        </span>
                    </div>
                </div>
                
                <div class="Table-module_base__Mi4wLjYtaW50ZXJuYWw">
                    <div class="Table-module_headers-group-container__Mi4wLjYtaW50ZXJuYWw" style="top: 0px;">
                        <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw Table-module_blank__Mi4wLjYtaW50ZXJuYWw" style="min-width: 2370px;">
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 200px; min-width: 200px; max-width: 200px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 120px; min-width: 120px; max-width: 120px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 180px; min-width: 180px; max-width: 180px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 100px; min-width: 100px; max-width: 100px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 140px; min-width: 140px; max-width: 140px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 120px; min-width: 120px; max-width: 120px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 180px; min-width: 180px; max-width: 180px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 120px; min-width: 120px; max-width: 120px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 160px; min-width: 160px; max-width: 160px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 130px; min-width: 130px; max-width: 130px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 160px; min-width: 160px; max-width: 160px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 160px; min-width: 160px; max-width: 160px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;"><span></span></div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;"><span></span></div>
                        </div>
                        <div class="Table-module_header-row__Mi4wLjYtaW50ZXJuYWw" data-testid="table-header-row" style="min-width: 2370px;">
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-NFS Share" style="flex: 0 0 200px; min-width: 200px; max-width: 200px;">
                                <div id="NFS Share-nfsShare" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>NFS Share</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('nfsShare')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Export Status" style="flex: 0 0 120px; min-width: 120px; max-width: 120px;">
                                <div id="Export Status-exportStatus" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Export Status</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('exportStatus')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Mount Path" style="flex: 0 0 180px; min-width: 180px; max-width: 180px;">
                                <div id="Mount Path-mountPath" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Mount Path</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('mountPath')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Status" style="flex: 0 0 100px; min-width: 100px; max-width: 100px;">
                                <div id="Status-status" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Status</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('status')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Qtree Name" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;">
                                <div id="Qtree Name-qtreeName" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Qtree Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('qtreeName')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Volume Name" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;">
                                <div id="Volume Name-volumeName" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Volume Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('volumeName')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Security Style" style="flex: 0 0 140px; min-width: 140px; max-width: 140px;">
                                <div id="Security Style-securityStyle" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Security Style</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('securityStyle')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Unix Permissions" style="flex: 0 0 120px; min-width: 120px; max-width: 120px;">
                                <div id="Unix Permissions-unixPermissions" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Unix Permissions</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('unixPermissions')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Export Policy Name" style="flex: 0 0 180px; min-width: 180px; max-width: 180px;">
                                <div id="Export Policy Name-exportPolicyName" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Export Policy Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('exportPolicyName')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Rules Count" style="flex: 0 0 120px; min-width: 120px; max-width: 120px;">
                                <div id="Rules Count-rulesCount" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Rules Count</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('rulesCount')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Access Protocols" style="flex: 0 0 160px; min-width: 160px; max-width: 160px;">
                                <div id="Access Protocols-accessProtocols" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Access Protocols</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('accessProtocols')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Client IP" style="flex: 0 0 130px; min-width: 130px; max-width: 130px;">
                                <div id="Client IP-clientIp" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Client IP</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('clientIp')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Read Only Access" style="flex: 0 0 160px; min-width: 160px; max-width: 160px;">
                                <div id="Read Only Access-readOnlyAccess" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Read Only Access</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('readOnlyAccess')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Read Write Access" style="flex: 0 0 160px; min-width: 160px; max-width: 160px;">
                                <div id="Read Write Access-readWriteAccess" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Read Write Access</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('readWriteAccess')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-SVM Name" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;">
                                <div id="SVM Name-svmName" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>SVM Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('svmName')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Cluster Name" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;">
                                <div id="Cluster Name-clusterName" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Cluster Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="nfsSharesView.sortShares('clusterName')">
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
                        </div>
                    </div>
                    <div class="Table-module_rows-group-container__Mi4wLjYtaW50ZXJuYWw style_table-outer-layout__RLkyh style_tbl-height-wo-pager__qyc4B Table-module_fixed-height__Mi4wLjYtaW50ZXJuYWw">
                        <div style="max-height: 100%;" id="nfsSharesTableBody">
                            <!-- NFS share rows will be populated here -->
                        </div>
                    </div>
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
        
        // Start auto-refresh if not already running
        if (!this.refreshInterval) {
            this.startAutoRefresh();
        }
    }

    // Hide the view
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
        
        // Stop auto-refresh when view is hidden
        this.stopAutoRefresh();
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
    
    // Synchronize horizontal scrolling between header and body
    setupScrollSync() {
        const tableBody = document.querySelector('#nfsSharesView .Table-module_rows-group-container__Mi4wLjYtaW50ZXJuYWw');
        const tableHeader = document.querySelector('#nfsSharesView .Table-module_headers-group-container__Mi4wLjYtaW50ZXJuYWw');
        
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

    // Update share count
    updateShareCount(count) {
        this.shareCount = count;
        const shareCountElement = document.getElementById('nfsShareCount');
        if (shareCountElement) {
            shareCountElement.textContent = `(${count})`;
        }
    }

    // Update last refresh timestamp
    updateLastRefreshTime() {
        this.lastRefreshTime = new Date();
        const element = document.getElementById('nfsSharesLastUpdate');
        if (element) {
            const timeStr = this.lastRefreshTime.toLocaleTimeString();
            element.textContent = `Last updated: ${timeStr}`;
        }
    }

    // Render share row - 16 columns matching header (min-width 2370px)
    renderShareRow(share) {
        return `
            <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw" data-testid="table-row-${share.nfsShare}" style="min-width: 2370px;">
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 200px; min-width: 200px; max-width: 200px;">
                    <span class="style_truncate__kDoKg" title="${share.nfsShare}">${share.nfsShare}</span>
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 120px; min-width: 120px; max-width: 120px;">${share.exportStatus || '-'}</div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 180px; min-width: 180px; max-width: 180px;">
                    <span class="style_truncate__kDoKg" title="${share.mountPath}">${share.mountPath}</span>
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 100px; min-width: 100px; max-width: 100px;">${share.status}</div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;">
                    <span class="style_truncate__kDoKg" title="${share.qtreeName}">${share.qtreeName}</span>
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;">
                    <span class="style_truncate__kDoKg" title="${share.volumeName}">${share.volumeName}</span>
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 140px; min-width: 140px; max-width: 140px;">${share.securityStyle}</div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 120px; min-width: 120px; max-width: 120px;">${share.unixPermissions || '-'}</div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 180px; min-width: 180px; max-width: 180px;">
                    <span class="style_truncate__kDoKg" title="${share.exportPolicyName}">${share.exportPolicyName}</span>
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 120px; min-width: 120px; max-width: 120px;">${share.rulesCount || '-'}</div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 160px; min-width: 160px; max-width: 160px;">${share.accessProtocols || '-'}</div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 130px; min-width: 130px; max-width: 130px;">${share.clientIp || '-'}</div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 160px; min-width: 160px; max-width: 160px;">${share.readOnlyAccess || '-'}</div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 160px; min-width: 160px; max-width: 160px;">${share.readWriteAccess || '-'}</div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;">
                    <span class="style_truncate__kDoKg" title="${share.svmName}">${share.svmName}</span>
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 150px; min-width: 150px; max-width: 150px;">
                    <span class="style_truncate__kDoKg" title="${share.clusterName}">${share.clusterName}</span>
                </div>
            </div>
        `;
    }

    // Store shares data
    storeSharesData(shares) {
        this.sharesData = shares;
    }

    // Load NFS shares data from Harvest MCP
    async loadShares() {
        try {
            // Get global app instance
            if (!window.app || !window.app.clientManager) {
                console.error('App or client manager not initialized');
                return;
            }

            console.log('🔍 Loading NFS shares from Harvest MCP...');
            
            // Use Harvest MCP client to query qtrees
            const harvestClient = window.app.clientManager.clients.get('harvest-remote');
            if (!harvestClient) {
                console.error('harvest-remote MCP client not available');
                return;
            }
            
            // Fetch qtree labels
            const response = await harvestClient.callMcp('metrics_query', { query: 'qtree_labels' });
            
            console.log('✅ Fetched qtree metrics from Harvest');
            
            // Parse response if it's a string
            const parseResponse = (response) => {
                if (typeof response === 'string') {
                    try {
                        return JSON.parse(response);
                    } catch (e) {
                        console.error('Failed to parse response:', e);
                        return response;
                    }
                }
                return response;
            };
            
            const parsed = parseResponse(response);
            const qtrees = parsed?.data?.result || [];
            
            console.log(`📊 Extracted ${qtrees.length} qtrees`);
            
            // Convert qtree data to share format
            let sharesData = qtrees.map(qt => ({
                nfsShare: qt.metric.qtree || '-',
                exportStatus: '',  // Not available in Harvest
                mountPath: `/vol/${qt.metric.volume || '-'}/${qt.metric.qtree || ''}`,
                status: qt.metric.status || '-',
                qtreeName: qt.metric.qtree || '-',
                volumeName: qt.metric.volume || '-',
                securityStyle: qt.metric.security_style || '-',
                unixPermissions: '',  // Not available in Harvest
                exportPolicyName: qt.metric.export_policy || '-',
                rulesCount: '',  // Not available in Harvest
                accessProtocols: '',  // Not available in Harvest
                clientIp: '',  // Not available in Harvest
                readOnlyAccess: '',  // Not available in Harvest
                readWriteAccess: '',  // Not available in Harvest
                svmName: qt.metric.svm || '-',
                clusterName: qt.metric.cluster || '-'
            }));
            
            // Filter shares to only show registered clusters
            const registeredClusters = window.app?.clusters || [];
            const registeredClusterNames = registeredClusters.map(c => c.name);
            
            if (registeredClusterNames.length > 0) {
                const originalCount = sharesData.length;
                sharesData = sharesData.filter(share => {
                    return share.clusterName && registeredClusterNames.includes(share.clusterName);
                });
                console.log(`Filtered shares: ${originalCount} → ${sharesData.length} (only registered clusters: ${registeredClusterNames.join(', ')})`);
            }
            
            // Store shares data
            this.storeSharesData(sharesData);
            
            // Update share count
            this.updateShareCount(sharesData.length);
            
            // Update last refresh time
            this.updateLastRefreshTime();
            
            // Populate table
            this.populateSharesTable(sharesData);
            
            // Set up scroll sync after table is populated
            // Use requestAnimationFrame to ensure DOM is fully rendered
            requestAnimationFrame(() => {
                this.setupScrollSync();
            });
            
        } catch (error) {
            console.error('Error loading NFS shares:', error);
            this.showError('Failed to load NFS shares. Please try again.');
        }
    }

    // Populate shares table
    populateSharesTable(shares) {
        const tableBody = document.getElementById('nfsSharesTableBody');
        if (!tableBody) return;
        
        if (!shares || shares.length === 0) {
            tableBody.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #666;">
                    No NFS shares found for registered clusters.
                </div>
            `;
            return;
        }
        
        const rows = shares.map(share => this.renderShareRow(share)).join('');
        tableBody.innerHTML = rows;
    }

    // Sort shares
    sortShares(column) {
        if (!this.sharesData) return;
        
        // Toggle direction if same column, otherwise default to ascending
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        const sorted = [...this.sharesData].sort((a, b) => {
            const aVal = a[column] || '';
            const bVal = b[column] || '';
            
            if (this.sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
        
        this.populateSharesTable(sorted);
    }

    // Show error message
    showError(message) {
        const tableBody = document.getElementById('nfsSharesTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #d32f2f;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style="margin-bottom: 16px;">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#d32f2f"/>
                    </svg>
                    <div>${message}</div>
                </div>
            `;
        }
    }

    // Start auto-refresh (every 5 minutes)
    startAutoRefresh() {
        // Clear any existing interval
        this.stopAutoRefresh();
        
        // Set up 5-minute refresh
        this.refreshInterval = setInterval(() => {
            console.log('🔄 Auto-refreshing NFS shares...');
            this.loadShares();
        }, 5 * 60 * 1000); // 5 minutes in milliseconds
    }

    // Stop auto-refresh
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

// Create global instance
let nfsSharesView = new NFSSharesView();
