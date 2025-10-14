// VolumesView Component  
// Displays volumes table with filters and sort functionality

class VolumesView {
    constructor() {
        this.containerId = 'volumesView';
        this.volumeCount = 0;
        this.volumesData = null;
        this.lastRefreshTime = null;
        this.refreshInterval = null;
    }

    // Render the complete VolumesView HTML
    render() {
        return `
            <div id="${this.containerId}" class="view-container" style="display: none;">
                <div class="page-header">
                    <div role="heading" class="typography-module_h02__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_sub-heading-alerts__9dguW">Volumes</div>
                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw style_alert-detail-sub-heading__Gccrb">
                        Volume inventory across all registered clusters. 
                        <span id="volumesLastUpdate" style="margin-left: 10px; color: #666;"></span>
                    </p>
                </div>
                
                <div role="heading" class="typography-module_h03__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_alerts-header-layout__8HFmd style_table-header-gap__xFIB7">
                    <div class="TableCounter-module_base__Mi4wLjYtaW50ZXJuYWw">
                        <span><span>Volumes&nbsp;</span><span id="volumeCount">(0)</span></span>
                        <div class="TableCounter-module_divider__Mi4wLjYtaW50ZXJuYWw"></div>
                        <span>Filters applied (0)</span>
                        <button data-component="Button" type="button" class="buttons-module_text__Mi4wLjYtaW50ZXJuYWw TableCounter-module_reset__Mi4wLjYtaW50ZXJuYWw">Reset</button>
                    </div>
                    <div class="style_text-align-right__TD9Ez">
                        <span title="Download volumes">
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
                        <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw Table-module_blank__Mi4wLjYtaW50ZXJuYWw">
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 220px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 100px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 120px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 150px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 150px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 180px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 170px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 170px;">
                                <span></span>
                            </div>
                        </div>
                        <div class="Table-module_header-row__Mi4wLjYtaW50ZXJuYWw" data-testid="table-header-row">
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Volume Name" style="flex: 1 0 220px;">
                                <div id="Volume Name-volumeName" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Volume Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="volumesView.sortVolumes('name')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-State" style="flex: 1 0 100px;">
                                <div id="State-state" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>State</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="volumesView.sortVolumes('state')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Size" style="flex: 1 0 120px;">
                                <div id="Size-size" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Size (GiB)</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="volumesView.sortVolumes('size')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Available" style="flex: 1 0 150px;">
                                <div id="Available-available" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Available Capacity</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="volumesView.sortVolumes('available')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Used" style="flex: 1 0 150px;">
                                <div id="Used-used" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Used Capacity</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="volumesView.sortVolumes('used')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Protection" style="flex: 1 0 180px;">
                                <div id="Protection-protection" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Protection Role</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="volumesView.sortVolumes('protection')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Cluster" style="flex: 1 0 170px;">
                                <div id="Cluster-cluster" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Cluster Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="volumesView.sortVolumes('cluster')">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Vserver" style="flex: 1 0 170px;">
                                <div id="Vserver-vserver" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Vserver Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw" onclick="volumesView.sortVolumes('vserver')">
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
                        <div style="max-height: 100%;" id="volumesTableBody">
                            <!-- Volume rows will be populated here -->
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
        const tableBody = document.querySelector('#volumesView .Table-module_rows-group-container__Mi4wLjYtaW50ZXJuYWw');
        const tableHeader = document.querySelector('#volumesView .Table-module_headers-group-container__Mi4wLjYtaW50ZXJuYWw');
        
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

    // Update volume count
    updateVolumeCount(count) {
        this.volumeCount = count;
        const volumeCountElement = document.getElementById('volumeCount');
        if (volumeCountElement) {
            volumeCountElement.textContent = `(${count})`;
        }
    }

    // Update last refresh timestamp
    updateLastRefreshTime() {
        this.lastRefreshTime = new Date();
        const element = document.getElementById('volumesLastUpdate');
        if (element) {
            const timeStr = this.lastRefreshTime.toLocaleTimeString();
            element.textContent = `Last updated: ${timeStr}`;
        }
    }

    // Convert bytes to GiB
    bytesToGiB(bytes) {
        if (!bytes || bytes === 0) return '0.00';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2);
    }

    // Determine protection role
    getProtectionRole(volume) {
        const labels = volume.metric;
        
        // Check for SnapMirror relationship
        if (labels.isProtected === 'true' && labels.isDestinationOntap === 'true') {
            return 'SnapMirror Destination';
        }
        
        if (labels.isProtected === 'true' && labels.isDestinationCloud === 'true') {
            return 'SnapMirror to Cloud';
        }
        
        if (labels.isProtected === 'true') {
            return 'SnapMirror Protected';
        }
        
        // Check for snapshot policy
        if (labels.snapshot_policy && labels.snapshot_policy !== 'none') {
            return 'Protected (Snapshots)';
        }
        
        // Unprotected
        return 'Unprotected';
    }

    // Render volume row
    renderVolumeRow(volume) {
        const labels = volume.metric;
        const volumeName = labels.volume || '-';
        const state = labels.state || '-';
        const cluster = labels.cluster || '-';
        const svm = labels.svm || '-';
        const protection = this.getProtectionRole(volume);
        
        // Convert bytes to GiB and calculate percentages
        const sizeGiB = volume.size ? this.bytesToGiB(volume.size) : '0.00';
        const availableGiB = volume.available ? this.bytesToGiB(volume.available) : '0.00';
        const usedGiB = volume.used ? this.bytesToGiB(volume.used) : '0.00';
        
        // Calculate used percentage
        let usedPercent = '0';
        if (volume.size && volume.size > 0) {
            usedPercent = ((volume.used / volume.size) * 100).toFixed(1);
        }
        
        // Calculate available percentage
        let availablePercent = '0';
        if (volume.size && volume.size > 0) {
            availablePercent = ((volume.available / volume.size) * 100).toFixed(1);
        }
        
        return `
            <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw" data-testid="table-row-${volumeName}" style="width: 100%;">
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Volume Name" style="flex: 1 0 220px;">
                    <span class="style_truncate__kDoKg" title="${volumeName}">${volumeName}</span>
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-State" style="flex: 1 0 100px;">
                    ${state}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Size" style="flex: 1 0 120px;">
                    ${sizeGiB} GiB
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Available" style="flex: 1 0 150px;">
                    ${availableGiB} GiB (${availablePercent}%)
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Used" style="flex: 1 0 150px;">
                    ${usedGiB} GiB (${usedPercent}%)
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Protection" style="flex: 1 0 180px;">
                    ${protection}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Cluster" style="flex: 1 0 170px;">
                    ${cluster}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Vserver" style="flex: 1 0 170px;">
                    ${svm}
                </div>
            </div>
        `;
    }

    // Store volumes data
    storeVolumesData(volumes) {
        this.volumesData = volumes;
    }

    // Load volumes data from Harvest MCP
    async loadVolumes() {
        try {
            // Get global app instance
            if (!window.app || !window.app.clientManager) {
                console.error('App or client manager not initialized');
                return;
            }

            console.log('🔍 Loading volumes from Harvest MCP...');
            
            // Use Harvest MCP client to query volumes
            const harvestClient = window.app.clientManager.clients.get('harvest-remote');
            if (!harvestClient) {
                console.error('harvest-remote MCP client not available');
                return;
            }
            
            // Fetch volume labels and size metrics in parallel
            const [labelsResponse, sizeResponse, availableResponse, usedResponse] = await Promise.all([
                harvestClient.callMcp('metrics_query', { query: 'volume_labels' }),
                harvestClient.callMcp('metrics_query', { query: 'volume_size' }),
                harvestClient.callMcp('metrics_query', { query: 'volume_size_available' }),
                harvestClient.callMcp('metrics_query', { query: 'volume_size_used' })
            ]);
            
            console.log('✅ Fetched volume metrics from Harvest');
            
            // Parse responses if they are strings
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
            
            const parsedLabels = parseResponse(labelsResponse);
            const parsedSizes = parseResponse(sizeResponse);
            const parsedAvailable = parseResponse(availableResponse);
            const parsedUsed = parseResponse(usedResponse);
            
            // Extract volume data from responses
            const volumeLabels = parsedLabels?.data?.result || [];
            const volumeSizes = parsedSizes?.data?.result || [];
            const volumeAvailable = parsedAvailable?.data?.result || [];
            const volumeUsed = parsedUsed?.data?.result || [];
            
            console.log(`📊 Extracted arrays: labels=${volumeLabels.length}, sizes=${volumeSizes.length}, available=${volumeAvailable.length}, used=${volumeUsed.length}`);
            
            // Debug: Check what clusters are in the data
            if (volumeLabels.length > 0) {
                const harvestClusters = [...new Set(volumeLabels.map(v => v.metric?.cluster).filter(Boolean))];
                console.log(`📊 Harvest cluster names: ${harvestClusters.join(', ')}`);
            }
            
            // Create a map for quick lookup by volume key (cluster:svm:volume)
            const sizeMap = new Map();
            const availableMap = new Map();
            const usedMap = new Map();
            
            volumeSizes.forEach(item => {
                const key = `${item.metric.cluster}:${item.metric.svm}:${item.metric.volume}`;
                sizeMap.set(key, parseFloat(item.value[1]));
            });
            
            volumeAvailable.forEach(item => {
                const key = `${item.metric.cluster}:${item.metric.svm}:${item.metric.volume}`;
                availableMap.set(key, parseFloat(item.value[1]));
            });
            
            volumeUsed.forEach(item => {
                const key = `${item.metric.cluster}:${item.metric.svm}:${item.metric.volume}`;
                usedMap.set(key, parseFloat(item.value[1]));
            });
            
            // Combine labels with size metrics
            let volumesData = volumeLabels.map(vol => {
                const key = `${vol.metric.cluster}:${vol.metric.svm}:${vol.metric.volume}`;
                return {
                    metric: vol.metric,
                    size: sizeMap.get(key) || 0,
                    available: availableMap.get(key) || 0,
                    used: usedMap.get(key) || 0
                };
            });
            
            console.log(`✅ Combined data for ${volumesData.length} volumes`);
            
            // Filter volumes to only show registered clusters
            const registeredClusters = window.app?.clusters || [];
            const registeredClusterNames = registeredClusters.map(c => c.name);
            
            if (registeredClusterNames.length > 0) {
                const originalCount = volumesData.length;
                volumesData = volumesData.filter(vol => {
                    const clusterName = vol.metric?.cluster;
                    return clusterName && registeredClusterNames.includes(clusterName);
                });
                console.log(`Filtered volumes: ${originalCount} → ${volumesData.length} (only registered clusters: ${registeredClusterNames.join(', ')})`);
            }
            
            // Store volumes data
            this.storeVolumesData(volumesData);
            
            // Update volume count
            this.updateVolumeCount(volumesData.length);
            
            // Update last refresh time
            this.updateLastRefreshTime();
            
            // Populate table
            this.populateVolumesTable(volumesData);
            
            // Set up scroll sync after table is populated
            // Use requestAnimationFrame to ensure DOM is fully rendered
            requestAnimationFrame(() => {
                this.setupScrollSync();
            });
            
        } catch (error) {
            console.error('Error loading volumes:', error);
            this.showError('Failed to load volumes. Please try again.');
        }
    }

    // Populate volumes table
    populateVolumesTable(volumes) {
        const tableBody = document.getElementById('volumesTableBody');
        if (!tableBody) return;
        
        if (!volumes || volumes.length === 0) {
            tableBody.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #666;">
                    No volumes found for registered clusters.
                </div>
            `;
            return;
        }
        
        const rows = volumes.map(vol => this.renderVolumeRow(vol)).join('');
        tableBody.innerHTML = rows;
    }

    // Sort volumes
    sortVolumes(column) {
        if (!this.volumesData) return;
        
        // TODO: Implement sorting logic
        console.log(`Sorting by ${column}`);
    }

    // Show error message
    showError(message) {
        const tableBody = document.getElementById('volumesTableBody');
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
            console.log('🔄 Auto-refreshing volumes...');
            this.loadVolumes();
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
let volumesView = new VolumesView();
