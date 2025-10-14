// AlertsView Component
// Displays alerts table with filters and sort functionality

class AlertsView {
    constructor() {
        this.containerId = 'alertsView';
        this.alertCount = 0;
        this.alertRulesCache = null; // Cache alert rules with corrective actions
        
        // Initialize corrective action components (will be set when app initializes)
        this.correctiveActionParser = null;
        this.fixItModal = null;
        this.parameterResolver = null;
    }

    // Render the complete AlertsView HTML
    render() {
        return `
            <div id="${this.containerId}" class="view-container" style="display: none;">
                <div class="page-header">
                    <div role="heading" class="typography-module_h02__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_sub-heading-alerts__9dguW">Alerts</div>
                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw style_alert-detail-sub-heading__Gccrb">This feature currently supports on-premises ONTAP alerts.</p>
                </div>
                
                <div role="heading" class="typography-module_h03__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_alerts-header-layout__8HFmd style_table-header-gap__xFIB7">
                    <div class="TableCounter-module_base__Mi4wLjYtaW50ZXJuYWw">
                        <span><span>Alerts&nbsp;</span><span id="alertCount">(0)</span></span>
                        <div class="TableCounter-module_divider__Mi4wLjYtaW50ZXJuYWw"></div>
                        <span>Filters applied (0)</span>
                        <button data-component="Button" type="button" class="buttons-module_text__Mi4wLjYtaW50ZXJuYWw TableCounter-module_reset__Mi4wLjYtaW50ZXJuYWw">Reset</button>
                    </div>
                    <div class="style_text-align-right__TD9Ez">
                        <span title="Download alerts">
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
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 240px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 170px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 130px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 300px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 170px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 230px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 1 0 170px;">
                                <span></span>
                            </div>
                            <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" style="flex: 0 0 60px;">
                                <span></span>
                            </div>
                        </div>
                        <div class="Table-module_header-row__Mi4wLjYtaW50ZXJuYWw" data-testid="table-header-row">
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Triggered time" style="flex: 1 0 240px;">
                                <div id="Triggered time-raisedOn" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Triggered time</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Severity" style="flex: 1 0 170px;">
                                <div id="Severity-severity" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Severity</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <span class="InternalTableFilterStyles-module_internal-filter-button__Mi4wLjYtaW50ZXJuYWw" data-component="InternalFilterTrigger">
                                        <svg role="img" aria-labelledby="ic-table-filter" width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <desc id="ic-table-filter">Filter</desc>
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9992 1.45002C12.0086 1.69165 11.9221 1.92718 11.7585 2.10505C11.595 2.28292 11.3677 2.38863 11.1264 2.39902H0.889053C0.648096 2.38336 0.422121 2.27645 0.257004 2.10002C0.091886 1.92358 0 1.69083 0 1.44902C0 1.20721 0.091886 0.974466 0.257004 0.798029C0.422121 0.621592 0.648096 0.514689 0.889053 0.499023H11.1264C11.2461 0.504039 11.3636 0.532621 11.4722 0.583136C11.5809 0.63365 11.6785 0.705108 11.7596 0.793425C11.8406 0.881742 11.9035 0.985187 11.9446 1.09785C11.9857 1.21051 12.0043 1.33018 11.9992 1.45002ZM10.4253 4.99995C10.4319 5.1181 10.4152 5.23639 10.3761 5.34806C10.337 5.45973 10.2763 5.56258 10.1975 5.65073C10.1186 5.73888 10.0232 5.81059 9.91665 5.86176C9.81011 5.91293 9.69453 5.94256 9.57654 5.94895H2.43874C2.20216 5.92718 1.98225 5.81769 1.82213 5.64193C1.66201 5.46618 1.57324 5.23686 1.57324 4.99895C1.57324 4.76104 1.66201 4.53172 1.82213 4.35596C1.98225 4.18021 2.20216 4.07071 2.43874 4.04895H9.57654C9.69471 4.05533 9.81046 4.08503 9.91714 4.13633C10.0238 4.18762 10.1193 4.25952 10.1982 4.34788C10.2771 4.43624 10.3377 4.53933 10.3767 4.65123C10.4157 4.76313 10.4322 4.88164 10.4253 4.99995ZM8.30062 9.22299C8.47833 9.04502 8.57818 8.80364 8.57818 8.55195C8.57857 8.4272 8.55438 8.30361 8.50698 8.18825C8.45958 8.07288 8.38992 7.96802 8.30197 7.87967C8.21403 7.79132 8.10954 7.72123 7.99449 7.6734C7.87944 7.62557 7.7561 7.60095 7.63153 7.60095H4.38517C4.13357 7.60095 3.89228 7.70104 3.71437 7.8792C3.53647 8.05736 3.43652 8.29899 3.43652 8.55095C3.43652 8.80291 3.53647 9.04454 3.71437 9.2227C3.89228 9.40086 4.13357 9.50095 4.38517 9.50095H7.63053C7.88186 9.50095 8.1229 9.40096 8.30062 9.22299Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                    </span>
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Status" style="flex: 1 0 130px;">
                                <div id="Status-status" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Status</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <span class="InternalTableFilterStyles-module_internal-filter-button__Mi4wLjYtaW50ZXJuYWw" data-component="InternalFilterTrigger">
                                        <svg role="img" aria-labelledby="ic-table-filter" width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <desc id="ic-table-filter">Filter</desc>
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9992 1.45002C12.0086 1.69165 11.9221 1.92718 11.7585 2.10505C11.595 2.28292 11.3677 2.38863 11.1264 2.39902H0.889053C0.648096 2.38336 0.422121 2.27645 0.257004 2.10002C0.091886 1.92358 0 1.69083 0 1.44902C0 1.20721 0.091886 0.974466 0.257004 0.798029C0.422121 0.621592 0.648096 0.514689 0.889053 0.499023H11.1264C11.2461 0.504039 11.3636 0.532621 11.4722 0.583136C11.5809 0.63365 11.6785 0.705108 11.7596 0.793425C11.8406 0.881742 11.9035 0.985187 11.9446 1.09785C11.9857 1.21051 12.0043 1.33018 11.9992 1.45002ZM10.4253 4.99995C10.4319 5.1181 10.4152 5.23639 10.3761 5.34806C10.337 5.45973 10.2763 5.56258 10.1975 5.65073C10.1186 5.73888 10.0232 5.81059 9.91665 5.86176C9.81011 5.91293 9.69453 5.94256 9.57654 5.94895H2.43874C2.20216 5.92718 1.98225 5.81769 1.82213 5.64193C1.66201 5.46618 1.57324 5.23686 1.57324 4.99895C1.57324 4.76104 1.66201 4.53172 1.82213 4.35596C1.98225 4.18021 2.20216 4.07071 2.43874 4.04895H9.57654C9.69471 4.05533 9.81046 4.08503 9.91714 4.13633C10.0238 4.18762 10.1193 4.25952 10.1982 4.34788C10.2771 4.43624 10.3377 4.53933 10.3767 4.65123C10.4157 4.76313 10.4322 4.88164 10.4253 4.99995ZM8.30062 9.22299C8.47833 9.04502 8.57818 8.80364 8.57818 8.55195C8.57857 8.4272 8.55438 8.30361 8.50698 8.18825C8.45958 8.07288 8.38992 7.96802 8.30197 7.87967C8.21403 7.79132 8.10954 7.72123 7.99449 7.6734C7.87944 7.62557 7.7561 7.60095 7.63153 7.60095H4.38517C4.13357 7.60095 3.89228 7.70104 3.71437 7.8792C3.53647 8.05736 3.43652 8.29899 3.43652 8.55095C3.43652 8.80291 3.43652 9.04454 3.71437 9.2227C3.89228 9.40086 4.13357 9.50095 4.38517 9.50095H7.63053C7.88186 9.50095 8.1229 9.40096 8.30062 9.22299Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                    </span>
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Name" style="flex: 1 0 300px;">
                                <div id="Name-name" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Source type" style="flex: 1 0 170px;">
                                <div id="Source type-alertObjectType" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Source type</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <span class="InternalTableFilterStyles-module_internal-filter-button__Mi4wLjYtaW50ZXJuYWw" data-component="InternalFilterTrigger">
                                        <svg role="img" aria-labelledby="ic-table-filter" width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <desc id="ic-table-filter">Filter</desc>
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9992 1.45002C12.0086 1.69165 11.9221 1.92718 11.7585 2.10505C11.595 2.28292 11.3677 2.38863 11.1264 2.39902H0.889053C0.648096 2.38336 0.422121 2.27645 0.257004 2.10002C0.091886 1.92358 0 1.69083 0 1.44902C0 1.20721 0.091886 0.974466 0.257004 0.798029C0.422121 0.621592 0.648096 0.514689 0.889053 0.499023H11.1264C11.2461 0.504039 11.3636 0.532621 11.4722 0.583136C11.5809 0.63365 11.6785 0.705108 11.7596 0.793425C11.8406 0.881742 11.9035 0.985187 11.9446 1.09785C11.9857 1.21051 12.0043 1.33018 11.9992 1.45002ZM10.4253 4.99995C10.4319 5.1181 10.4152 5.23639 10.3761 5.34806C10.337 5.45973 10.2763 5.56258 10.1975 5.65073C10.1186 5.73888 10.0232 5.81059 9.91665 5.86176C9.81011 5.91293 9.69453 5.94256 9.57654 5.94895H2.43874C2.20216 5.92718 1.98225 5.81769 1.82213 5.64193C1.66201 5.46618 1.57324 5.23686 1.57324 4.99895C1.57324 4.76104 1.66201 4.53172 1.82213 4.35596C1.98225 4.18021 2.20216 4.07071 2.43874 4.04895H9.57654C9.69471 4.05533 9.81046 4.08503 9.91714 4.13633C10.0238 4.18762 10.1193 4.25952 10.1982 4.34788C10.2771 4.43624 10.3377 4.53933 10.3767 4.65123C10.4157 4.76313 10.4322 4.88164 10.4253 4.99995ZM8.30062 9.22299C8.47833 9.04502 8.57818 8.80364 8.57818 8.55195C8.57857 8.4272 8.55438 8.30361 8.50698 8.18825C8.45958 8.07288 8.38992 7.96802 8.30197 7.87967C8.21403 7.79132 8.10954 7.72123 7.99449 7.6734C7.87944 7.62557 7.7561 7.60095 7.63153 7.60095H4.38517C4.13357 7.60095 3.89228 7.70104 3.71437 7.8792C3.53647 8.05736 3.43652 8.29899 3.43652 8.55095C3.43652 8.80291 3.43652 9.04454 3.71437 9.2227C3.89228 9.40086 4.13357 9.50095 4.38517 9.50095H7.63053C7.88186 9.50095 8.1229 9.40096 8.30062 9.22299Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                    </span>
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Cluster" style="flex: 1 0 180px;">
                                <div id="Cluster-cluster" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Cluster</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Source Name" style="flex: 1 0 230px;">
                                <div id="Source Name-alertObjectName" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Source Name</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Impact Area" style="flex: 1 0 170px;">
                                <div id="Impact Area-impactArea" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Impact Area</span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw">
                                    <span class="InternalTableFilterStyles-module_internal-filter-button__Mi4wLjYtaW50ZXJuYWw" data-component="InternalFilterTrigger">
                                        <svg role="img" aria-labelledby="ic-table-filter" width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <desc id="ic-table-filter">Filter</desc>
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9992 1.45002C12.0086 1.69165 11.9221 1.92718 11.7585 2.10505C11.595 2.28292 11.3677 2.38863 11.1264 2.39902H0.889053C0.648096 2.38336 0.422121 2.27645 0.257004 2.10002C0.091886 1.92358 0 1.69083 0 1.44902C0 1.20721 0.091886 0.974466 0.257004 0.798029C0.422121 0.621592 0.648096 0.514689 0.889053 0.499023H11.1264C11.2461 0.504039 11.3636 0.532621 11.4722 0.583136C11.5809 0.63365 11.6785 0.705108 11.7596 0.793425C11.8406 0.881742 11.9035 0.985187 11.9446 1.09785C11.9857 1.21051 12.0043 1.33018 11.9992 1.45002ZM10.4253 4.99995C10.4319 5.1181 10.4152 5.23639 10.3761 5.34806C10.337 5.45973 10.2763 5.56258 10.1975 5.65073C10.1186 5.73888 10.0232 5.81059 9.91665 5.86176C9.81011 5.91293 9.69453 5.94256 9.57654 5.94895H2.43874C2.20216 5.92718 1.98225 5.81769 1.82213 5.64193C1.66201 5.46618 1.57324 5.23686 1.57324 4.99895C1.57324 4.76104 1.66201 4.53172 1.82213 4.35596C1.98225 4.18021 2.20216 4.07071 2.43874 4.04895H9.57654C9.69471 4.05533 9.81046 4.08503 9.91714 4.13633C10.0238 4.18762 10.1193 4.25952 10.1982 4.34788C10.2771 4.43624 10.3377 4.53933 10.3767 4.65123C10.4157 4.76313 10.4322 4.88164 10.4253 4.99995ZM8.30062 9.22299C8.47833 9.04502 8.57818 8.80364 8.57818 8.55195C8.57857 8.4272 8.55438 8.30361 8.50698 8.18825C8.45958 8.07288 8.38992 7.96802 8.30197 7.87967C8.21403 7.79132 8.10954 7.72123 7.99449 7.6734C7.87944 7.62557 7.7561 7.60095 7.63153 7.60095H4.38517C4.13357 7.60095 3.89228 7.70104 3.71437 7.8792C3.53647 8.05736 3.43652 8.29899 3.43652 8.55095C3.43652 8.80291 3.43652 9.04454 3.71437 9.2227C3.89228 9.40086 4.13357 9.50095 4.38517 9.50095H7.63053C7.88186 9.50095 8.1229 9.40096 8.30062 9.22299Z" fill="var(--icon-primary)"></path>
                                        </svg>
                                    </span>
                                    <button class="Table-module_sort-icons__Mi4wLjYtaW50ZXJuYWw">
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-empty_id" style="flex: 0 0 60px;">
                                <div id="-empty_id" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span></span>
                                </div>
                                <div class="Table-module_widgets__Mi4wLjYtaW50ZXJuYWw"></div>
                                <div class="Table-module_header-handle__Mi4wLjYtaW50ZXJuYWw"></div>
                            </div>
                        </div>
                    </div>
                    <div class="Table-module_rows-group-container__Mi4wLjYtaW50ZXJuYWw style_table-outer-layout__RLkyh style_tbl-height-wo-pager__qyc4B Table-module_fixed-height__Mi4wLjYtaW50ZXJuYWw">
                        <div style="max-height: 100%;" id="alertsTableBody">
                            <!-- Alert rows will be populated here -->
                        </div>
                    </div>
                </div>
                
                <!-- Alert Details View (initially hidden) -->
                <div id="alertDetailsView" style="display: none;">
                    <!-- Breadcrumb -->
                    <div class="Breadcrumbs-module_base__Mi4wLjYtaW50ZXJuYWw style_breadcrumbs__WQB5P">
                        <a href="#" onclick="alertsView.backToList(); return false;">Alerts</a>
                        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="--icon-primary: var(--icon-secondary);">
                            <path d="M13.9905 11.9429C13.9791 11.8551 13.9415 11.7728 13.8827 11.7069L10.7027 8.15186C10.6696 8.10771 10.6274 8.07131 10.5788 8.0452C10.5303 8.01909 10.4766 8.00389 10.4216 8.00065C10.3666 7.99742 10.3116 8.00622 10.2603 8.02646C10.2091 8.04671 10.1628 8.07789 10.1248 8.11786C10.0447 8.20131 10 8.31259 10 8.42836C10 8.54413 10.0447 8.6554 10.1248 8.73886L13.0443 12.0009L10.1278 15.2629C10.048 15.3463 10.0035 15.4573 10.0035 15.5729C10.0035 15.6884 10.048 15.7995 10.1278 15.8829C10.1663 15.923 10.2129 15.9542 10.2647 15.9744C10.3164 15.9946 10.3718 16.0033 10.4272 15.9999C10.4822 15.9962 10.5357 15.9808 10.5842 15.9548C10.6328 15.9287 10.6752 15.8926 10.7087 15.8489L13.8887 12.2939C13.9305 12.2464 13.9617 12.1905 13.9803 12.13C13.9989 12.0695 14.0044 12.0057 13.9965 11.9429H13.9905Z" fill="var(--icon-primary)"></path>
                        </svg>
                        <div class="Breadcrumbs-module_last-crumb__Mi4wLjYtaW50ZXJuYWw">
                            <div class="style_truncate__kDoKg style_max-w-450__SdO+C" id="alertDetailsBreadcrumb" title="">Alert Details</div>
                        </div>
                    </div>
                    
                    <!-- Alert Details Content -->
                    <section class="Layout-module_container__Mi4wLjYtaW50ZXJuYWw">
                        <div class="Layout-module_default__Mi4wLjYtaW50ZXJuYWw Layout-module_grid__Mi4wLjYtaW50ZXJuYWw Layout-module_center-content__Mi4wLjYtaW50ZXJuYWw">
                            <div class="Layout-module_grid-item__Mi4wLjYtaW50ZXJuYWw Layout-module_lg-12__Mi4wLjYtaW50ZXJuYWw">
                                <div role="heading" class="typography-module_h02__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_sub-heading-alerts__9dguW" id="alertDetailsName">Alert Details</div>
                                <div class="style_alert-detail-sub-heading__Gccrb" id="alertDetailsSubheading">
                                    <!-- Source info will be populated here -->
                                </div>
                                
                                <!-- Alert Overview Card -->
                                <div class="Card-module_base__Mi4wLjYtaW50ZXJuYWw style_card__KdEtT">
                                    <div class="Layout-module_default__Mi4wLjYtaW50ZXJuYWw Layout-module_grid__Mi4wLjYtaW50ZXJuYWw">
                                        <div class="Layout-module_grid-item__Mi4wLjYtaW50ZXJuYWw Layout-module_lg-3__Mi4wLjYtaW50ZXJuYWw">
                                            <div id="alertDetailsSeverity">
                                                <!-- Severity badge will be populated here -->
                                            </div>
                                        </div>
                                        <div class="Layout-module_grid-item__Mi4wLjYtaW50ZXJuYWw Layout-module_lg-3__Mi4wLjYtaW50ZXJuYWw">
                                            <div class="style_alert-details-header-item__Bnj+3">
                                                <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw">Active</p>
                                                <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Status</p>
                                            </div>
                                        </div>
                                        <div class="Layout-module_grid-item__Mi4wLjYtaW50ZXJuYWw Layout-module_lg-3__Mi4wLjYtaW50ZXJuYWw">
                                            <div class="style_alert-details-header-item__Bnj+3" id="alertDetailsImpact">
                                                <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw">-</p>
                                                <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Impact Area</p>
                                            </div>
                                        </div>
                                        <div class="Layout-module_grid-item__Mi4wLjYtaW50ZXJuYWw Layout-module_lg-3__Mi4wLjYtaW50ZXJuYWw">
                                            <div class="style_alert-details-header-item__Bnj+3" id="alertDetailsTriggered">
                                                <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw">-</p>
                                                <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Triggered time</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Description Card -->
                                <div class="Card-module_base__Mi4wLjYtaW50ZXJuYWw style_card__KdEtT">
                                    <div class="Layout-module_default__Mi4wLjYtaW50ZXJuYWw Layout-module_grid__Mi4wLjYtaW50ZXJuYWw">
                                        <div class="Layout-module_grid-item__Mi4wLjYtaW50ZXJuYWw Layout-module_lg-12__Mi4wLjYtaW50ZXJuYWw">
                                            <div>
                                                <div>
                                                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw">Description</p>
                                                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw" id="alertDetailsDescription">-</p>
                                                </div>
                                                <div class="style_mt-40__MznSA">
                                                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw">Details</p>
                                                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw" id="alertDetailsSummary">-</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Corrective Actions Card (optional, shown if corrective actions exist) -->
                                <div id="alertDetailsCorrectiveActions" style="display: none;" class="Card-module_base__Mi4wLjYtaW50ZXJuYWw style_corrective-actions__2-E4a">
                                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_mb-10__O6CMZ">Corrective actions to fix the issue</p>
                                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw style_corrective-actions-text__auArK" id="alertDetailsCorrectiveActionsText"></p>
                                </div>
                            </div>
                        </div>
                    </section>
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
    
    // Synchronize horizontal scrolling between header and body
    setupScrollSync() {
        const tableBody = document.querySelector('#alertsView .Table-module_rows-group-container__Mi4wLjYtaW50ZXJuYWw');
        const tableHeader = document.querySelector('#alertsView .Table-module_headers-group-container__Mi4wLjYtaW50ZXJuYWw');
        
        console.log('AlertsView - setupScrollSync: tableBody =', tableBody, 'tableHeader =', tableHeader);
        
        if (tableBody && tableHeader) {
            tableBody.addEventListener('scroll', () => {
                tableHeader.scrollLeft = tableBody.scrollLeft;
            });
            console.log('AlertsView - Scroll sync enabled successfully');
        } else {
            console.error('AlertsView - Failed to setup scroll sync: missing elements');
        }
    }

    // Update alert count
    updateAlertCount(count) {
        this.alertCount = count;
        const alertCountElement = document.getElementById('alertCount');
        if (alertCountElement) {
            alertCountElement.textContent = `(${count})`;
        }
    }

    // Format timestamp for display
    formatTimestamp(isoString) {
        const date = new Date(isoString);
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        };
        return date.toLocaleString('en-US', options);
    }

    // Get severity icon and styling
    getSeverityBadge(severity) {
        const severityLower = severity?.toLowerCase() || 'info';
        
        const badges = {
            critical: {
                class: 'InlineNotification-module_error__Mi4wLjYtaW50ZXJuYWw',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="InlineNotification-module_icon__Mi4wLjYtaW50ZXJuYWw">
                    <desc id="-Error">Error</desc>
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 21.5C17.2467 21.5 21.5 17.2467 21.5 12C21.5 6.75329 17.2467 2.5 12 2.5C6.75329 2.5 2.5 6.75329 2.5 12C2.5 17.2467 6.75329 21.5 12 21.5ZM12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23Z" id="base-layer" fill="var(--icon-primary)"></path>
                    <path d="M16.2549 8.78033C16.5478 8.48743 16.5478 8.01256 16.2549 7.71967C15.962 7.42677 15.4872 7.42678 15.1943 7.71967L12.0123 10.9017L8.83038 7.71979C8.53748 7.4269 8.06261 7.4269 7.76971 7.7198C7.47682 8.01269 7.47683 8.48757 7.76972 8.78046L10.9517 11.9623L7.76971 15.1444C7.47682 15.4373 7.47683 15.9121 7.76972 16.205C8.06262 16.4979 8.53749 16.4979 8.83038 16.205L12.0123 13.023L15.1944 16.205C15.4873 16.4979 15.9622 16.4979 16.2551 16.205C16.548 15.9121 16.548 15.4372 16.2551 15.1443L13.073 11.9623L16.2549 8.78033Z" id="base-layer" fill="var(--icon-primary)"></path>
                </svg>`,
                label: 'Critical'
            },
            warning: {
                class: 'InlineNotification-module_warning__Mi4wLjYtaW50ZXJuYWw',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="InlineNotification-module_icon__Mi4wLjYtaW50ZXJuYWw">
                    <desc id="-Notice-triangle">Notice triangle</desc>
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M2.56766 20.582H21.8206L12.2809 3.14119L2.56766 20.582ZM22.6728 22.0884H1.70806C0.935022 22.0884 0.44507 21.2692 0.817804 20.5999L11.3946 1.6084C11.7824 0.912039 12.7963 0.915832 13.1788 1.61508L23.5668 20.6066C23.9327 21.2757 23.4425 22.0884 22.6728 22.0884ZM13.2151 9.60086V14.2483C13.2151 14.4987 13.1171 14.7388 12.9427 14.9158C12.7683 15.0929 12.5317 15.1923 12.285 15.1923C12.0383 15.1923 11.8018 15.0929 11.6273 14.9158C11.4529 14.7388 11.3549 14.4987 11.3549 14.2483V9.60086C11.3549 9.3505 11.4529 9.11039 11.6273 8.93336C11.8018 8.75633 12.0383 8.65688 12.285 8.65688C12.5317 8.65688 12.7683 8.75633 12.9427 8.93336C13.1171 9.11039 13.2151 9.3505 13.2151 9.60086ZM12.2854 16.2222C12.544 16.2223 12.7945 16.3135 12.9943 16.4801C13.1941 16.6468 13.3308 16.8785 13.3811 17.136C13.4314 17.3934 13.3922 17.6606 13.2702 17.892C13.1481 18.1234 12.9508 18.3047 12.7119 18.405C12.4729 18.5053 12.2071 18.5184 11.9596 18.4421C11.7122 18.3658 11.4985 18.2047 11.3549 17.9864C11.2114 17.7681 11.1468 17.5061 11.1723 17.2449C11.1978 16.9837 11.3117 16.7396 11.4946 16.5541C11.5985 16.4487 11.7218 16.3652 11.8575 16.3083C11.9932 16.2513 12.1386 16.2221 12.2854 16.2222Z" id="base-layer" fill="var(--icon-primary)"></path>
                </svg>`,
                label: 'Warning'
            },
            info: {
                class: 'InlineNotification-module_info__Mi4wLjYtaW50ZXJuYWw',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="InlineNotification-module_icon__Mi4wLjYtaW50ZXJuYWw">
                    <desc id="-Info">Info</desc>
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 21.5C17.2467 21.5 21.5 17.2467 21.5 12C21.5 6.75329 17.2467 2.5 12 2.5C6.75329 2.5 2.5 6.75329 2.5 12C2.5 17.2467 6.75329 21.5 12 21.5ZM12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23Z" id="base-layer" fill="var(--icon-primary)"></path>
                    <path d="M12 10C11.4477 10 11 10.4477 11 11V16C11 16.5523 11.4477 17 12 17C12.5523 17 13 16.5523 13 16V11C13 10.4477 12.5523 10 12 10Z" id="base-layer" fill="var(--icon-primary)"></path>
                    <path d="M12 9C12.5523 9 13 8.55228 13 8C13 7.44772 12.5523 7 12 7C11.4477 7 11 7.44772 11 8C11 8.55228 11.4477 9 12 9Z" id="base-layer" fill="var(--icon-primary)"></path>
                </svg>`,
                label: 'Info'
            }
        };

        return badges[severityLower] || badges.info;
    }

    // Render alert row
    renderAlertRow(alert, index) {
        const severity = this.getSeverityBadge(alert.labels.severity);
        const triggeredTime = this.formatTimestamp(alert.activeAt);
        const alertName = alert.labels.alertname || 'Unknown Alert';
        const impactArea = alert.annotations?.impact || '-';
        const cluster = alert.labels.cluster || '-';
        
        // Determine source type and name from labels
        let sourceType = '-';
        let sourceName = '-';
        
        if (alert.labels.volume) {
            sourceType = 'Volume';
            sourceName = alert.labels.volume;
        }
        
        return `
            <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw Table-module_clickable__Mi4wLjYtaW50ZXJuYWw" data-testid="table-row-${alert.labels.alertname}" style="width: 100%;">
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Triggered time" style="flex: 1 0 240px;">
                    ${triggeredTime}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Severity" style="flex: 1 0 170px;">
                    <div class="InlineNotification-module_base__Mi4wLjYtaW50ZXJuYWw ${severity.class}" style="width: 100%;">
                        ${severity.icon}
                        <span class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">${severity.label}</span>
                    </div>
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Status" style="flex: 1 0 130px;">
                    Active
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Name" style="flex: 1 0 300px;">
                    <a href="#" class="style_alerts-name-link__uXpO0 style_truncate__kDoKg" title="${alertName}" onclick="alertsView.showAlertDetailsByIndex(${index}); return false;">${alertName}</a>
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Source type" style="flex: 1 0 170px;">
                    ${sourceType}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Cluster" style="flex: 1 0 180px;">
                    ${cluster}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Source Name" style="flex: 1 0 230px;">
                    ${sourceName}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-Impact Area" style="flex: 1 0 170px;">
                    ${impactArea}
                </div>
                <div class="Table-module_cell__Mi4wLjYtaW50ZXJuYWw Table-module_cell-base__Mi4wLjYtaW50ZXJuYWw" data-testid="table-cell-column-empty_id" style="flex: 0 0 60px;"></div>
            </div>
        `;
    }

    // Store alerts data for detail view
    storeAlertsData(alerts) {
        this.alertsData = alerts;
    }

    // Fetch and cache alert rules with corrective actions from MCP tool
    async fetchAndCacheAlertRules() {
        if (this.alertRulesCache) {
            console.log('🔍 Alert rules already cached');
            return;
        }

        try {
            // Call MCP list_alert_rules tool using RAW mode to get JSON directly
            // This avoids the parseContent() text formatting that loses structure
            console.log('🔍 Fetching alert rules from MCP (raw JSON mode)...');
            
            // Get the harvest-remote client
            const harvestClient = window.app.clientManager.clients.get('harvest-remote');
            if (!harvestClient) {
                console.error('🔍 harvest-remote MCP client not available');
                return;
            }
            
            // Call with callMcpRaw() to get structured data instead of formatted text
            const rawResult = await harvestClient.callMcpRaw('list_alert_rules', {});
            
            // MCP can return data in two places:
            // 1. structuredContent - parsed JSON objects
            // 2. content array - text that needs parsing
            let rulesJson = null;
            
            // Try structuredContent first (preferred - already parsed)
            if (rawResult?.structuredContent) {
                if (rawResult.structuredContent.alert_rules) {
                    rulesJson = rawResult.structuredContent;
                }
            }
            
            // Fallback to content array if needed
            if (!rulesJson && rawResult?.content && Array.isArray(rawResult.content)) {
                for (const item of rawResult.content) {
                    if (item.type === 'text' && item.text) {
                        try {
                            rulesJson = JSON.parse(item.text);
                            break;
                        } catch (e) {
                            // Not JSON, skip
                        }
                    }
                }
            }
            
            if (!rulesJson || !rulesJson.alert_rules) {
                console.error('🔍 No alert_rules found in MCP response');
                console.error('🔍 Full raw result:', JSON.stringify(rawResult, null, 2));
                return;
            }
            
            // Build a map of alert name → rule data with full annotations
            const rulesMap = new Map();
            
            rulesJson.alert_rules.forEach(rule => {
                if (rule.alert) {
                    rulesMap.set(rule.alert, {
                        annotations: rule.annotations || {},
                        labels: rule.labels || {},
                        expr: rule.expr,
                        duration: rule.for,
                        group: rule.group,
                        file: rule.file
                    });
                }
            });
            
            this.alertRulesCache = rulesMap;
            console.log(`✅ Cached ${rulesMap.size} alert rules with full annotations`);
            
        } catch (error) {
            console.error('Error fetching alert rules:', error);
        }
    }

    // Show alert details by array index (unique identifier)
    async showAlertDetailsByIndex(index) {
        if (!this.alertsData) {
            console.error('No alerts data available');
            return;
        }

        const alert = this.alertsData[index];
        if (!alert) {
            console.error(`Alert not found at index: ${index}`);
            return;
        }

        // Store current alert index AND unique identifier for re-rendering after undo
        this.currentAlertIndex = index;
        
        // Store unique identifier to find this alert after alerts reload
        this.currentAlertIdentifier = {
            fingerprint: alert.fingerprint,
            cluster: alert.labels?.cluster,
            volume: alert.labels?.volume,
            alertname: alert.labels?.alertname
        };

        // Hide the alerts list
        const alertsTable = document.querySelector('#alertsView > .Table-module_base__Mi4wLjYtaW50ZXJuYWw');
        const alertsHeader = document.querySelector('#alertsView > .page-header');
        const alertsToolbar = document.querySelector('#alertsView > .typography-module_h03__Mi4wLjYtaW50ZXJuYWw');
        
        if (alertsTable) alertsTable.style.display = 'none';
        if (alertsHeader) alertsHeader.style.display = 'none';
        if (alertsToolbar) alertsToolbar.style.display = 'none';

        // Show details view
        const detailsView = document.getElementById('alertDetailsView');
        if (detailsView) {
            detailsView.style.display = 'block';
        }

        // Populate details (async to fetch rule data)
        await this.populateAlertDetails(alert);
    }

    // Show alert details view (legacy - finds first match by name)
    async showAlertDetails(alertName) {
        // Find the alert in stored data
        if (!this.alertsData) {
            console.error('No alerts data available');
            return;
        }

        const alert = this.alertsData.find(a => a.labels.alertname === alertName);
        if (!alert) {
            console.error(`Alert not found: ${alertName}`);
            return;
        }

        // Hide the alerts list
        const alertsTable = document.querySelector('#alertsView > .Table-module_base__Mi4wLjYtaW50ZXJuYWw');
        const alertsHeader = document.querySelector('#alertsView > .page-header');
        const alertsToolbar = document.querySelector('#alertsView > .typography-module_h03__Mi4wLjYtaW50ZXJuYWw');
        
        if (alertsTable) alertsTable.style.display = 'none';
        if (alertsHeader) alertsHeader.style.display = 'none';
        if (alertsToolbar) alertsToolbar.style.display = 'none';

        // Show details view
        const detailsView = document.getElementById('alertDetailsView');
        if (detailsView) {
            detailsView.style.display = 'block';
        }

        // Populate details (async to fetch rule data)
        await this.populateAlertDetails(alert);
    }

    /**
     * Find the current alert index after alerts have been reloaded
     * Uses the stored identifier to match the alert
     */
    findCurrentAlertIndex() {
        if (!this.currentAlertIdentifier || !this.alertsData) {
            return undefined;
        }

        const identifier = this.currentAlertIdentifier;
        
        // Try to find by fingerprint first (most reliable)
        if (identifier.fingerprint) {
            const index = this.alertsData.findIndex(alert => alert.fingerprint === identifier.fingerprint);
            if (index !== -1) {
                console.log(`🔍 Found alert by fingerprint at index ${index}`);
                return index;
            }
        }
        
        // Fallback: Find by cluster + volume + alertname
        const index = this.alertsData.findIndex(alert => 
            alert.labels?.cluster === identifier.cluster &&
            alert.labels?.volume === identifier.volume &&
            alert.labels?.alertname === identifier.alertname
        );
        
        if (index !== -1) {
            console.log(`🔍 Found alert by labels at index ${index}`);
            return index;
        }
        
        // Alert not found - likely resolved (this is good!)
        console.log('✅ Alert not found after reload - may have been resolved');
        return undefined;
    }

    // Populate alert details (with rule data from cache)
    async populateAlertDetails(alert) {
        // Get rule definition from cache for corrective actions
        let ruleData = null;
        if (this.alertRulesCache && alert.labels.alertname) {
            console.log('🔍 Looking up alert rule:', alert.labels.alertname);
            console.log('🔍 Cache has', this.alertRulesCache.size, 'rules:', Array.from(this.alertRulesCache.keys()));
            ruleData = this.alertRulesCache.get(alert.labels.alertname);
            console.log('🔍 Rule found:', ruleData ? 'YES' : 'NO');
            if (ruleData) {
                console.log('🔍 Rule data:', ruleData);
                console.log('🔍 Rule annotations:', ruleData.annotations);
                console.log('🔍 Annotation keys:', Object.keys(ruleData.annotations || {}));
                console.log('🔍 Rule has corrective_action:', !!ruleData.annotations?.corrective_action);
            }
        }

        // Breadcrumb and title
        document.getElementById('alertDetailsBreadcrumb').textContent = alert.labels.alertname || 'Alert Details';
        document.getElementById('alertDetailsBreadcrumb').title = alert.labels.alertname || '';
        document.getElementById('alertDetailsName').textContent = alert.labels.alertname || 'Alert Details';

        // Subheading with source info
        const subheading = document.getElementById('alertDetailsSubheading');
        let subheadingHTML = '';
        
        if (alert.labels.svm) {
            subheadingHTML += `<p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Storage VM:</p> `;
            subheadingHTML += `<a class="style_alerts-link__tC-il style_max-w-150__7Hbel style_truncate__kDoKg" title="${alert.labels.svm}" alt="SVM link" href="#">${alert.labels.svm}</a>`;
            subheadingHTML += `<span class="style_pipe-separator__nsN6y"></span>`;
        }
        
        if (alert.labels.cluster) {
            subheadingHTML += `<p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Cluster:</p> `;
            subheadingHTML += `<a class="style_alerts-link__tC-il style_max-w-150__7Hbel style_truncate__kDoKg" title="${alert.labels.cluster}" alt="CLUSTER link" href="#">${alert.labels.cluster}</a>`;
        }
        
        subheading.innerHTML = subheadingHTML;

        // Severity badge
        const severity = this.getSeverityBadge(alert.labels.severity);
        document.getElementById('alertDetailsSeverity').innerHTML = `
            <div>
                <div>
                    <div class="InlineNotification-module_base__Mi4wLjYtaW50ZXJuYWw ${severity.class}">
                        ${severity.icon}
                        <span class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">
                            <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw">${severity.label}</p>
                        </span>
                    </div>
                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Severity</p>
                </div>
            </div>
        `;

        // Impact Area
        const impactArea = alert.annotations?.impact || '-';
        document.getElementById('alertDetailsImpact').innerHTML = `
            <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw">${impactArea}</p>
            <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Impact Area</p>
        `;

        // Triggered time
        const triggeredTime = this.formatTimestamp(alert.activeAt);
        document.getElementById('alertDetailsTriggered').innerHTML = `
            <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw">${triggeredTime}</p>
            <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Triggered time</p>
        `;

        // Description
        const description = alert.annotations?.description || 'No description available';
        document.getElementById('alertDetailsDescription').textContent = description;

        // Details/Summary
        const summary = alert.annotations?.summary || 'No additional details available';
        document.getElementById('alertDetailsSummary').textContent = summary;

        // Corrective Actions (check both active alert and rule definition)
        let correctiveActions = alert.annotations?.corrective_actions || alert.annotations?.corrective_action;
        console.log('🔍 Corrective actions from alert:', correctiveActions ? 'FOUND' : 'NOT FOUND');
        
        // If not found in active alert, try the rule definition
        if (!correctiveActions && ruleData) {
            console.log('🔍 Checking rule definition for corrective_action...');
            correctiveActions = ruleData.annotations?.corrective_action || ruleData.annotations?.corrective_actions;
            console.log('🔍 Corrective actions from rule:', correctiveActions ? 'FOUND' : 'NOT FOUND');
            if (correctiveActions) {
                console.log('🔍 Corrective action text length:', correctiveActions.length);
            }
        }
        
        const correctiveActionsCard = document.getElementById('alertDetailsCorrectiveActions');
        
        console.log('🔍 Final decision - show corrective actions?', !!correctiveActions);
        
        if (correctiveActions) {
            // Parse corrective actions and render Fix-It UI
            await this.renderCorrectiveActions(correctiveActions, alert);
            correctiveActionsCard.style.display = 'block';
        } else {
            correctiveActionsCard.style.display = 'none';
        }
    }

    /**
     * Render corrective actions with Fix-It buttons
     */
    async renderCorrectiveActions(correctiveActionText, alert) {
        const container = document.getElementById('alertDetailsCorrectiveActionsText');
        
        // Show loading state
        container.innerHTML = '<p style="color: #666;">Parsing corrective actions...</p>';
        
        try {
            // Parse corrective actions using LLM
            const alertContext = {
                alertname: alert.labels?.alertname,
                severity: alert.labels?.severity,
                volume: alert.labels?.volume,
                cluster: alert.labels?.cluster,
                svm: alert.labels?.svm,
                value: alert.annotations?.summary?.match(/\[([0-9.]+)%\]/)?.[1] || alert.value
            };
            
            // Safety check: ensure parser is initialized
            if (!this.correctiveActionParser) {
                console.warn('⚠️ CorrectiveActionParser not initialized - showing raw text');
                return `<div class="corrective-actions-raw">
                    <pre>${correctiveActionText}</pre>
                </div>`;
            }
            
            const parsed = await this.correctiveActionParser.parseCorrectiveActions(
                correctiveActionText,
                alertContext
            );
            
            console.log('📋 Parsed corrective actions:', parsed);
            console.log('📋 Number of remediation options:', parsed.remediation_options?.length);
            
            // Render parsed actions with Fix-It buttons
            let html = `<div class="corrective-actions-parsed">`;
            
            // Overall description
            if (parsed.description) {
                html += `<p class="corrective-actions-description">${parsed.description}</p>`;
            }
            
            // Remediation options
            if (parsed.remediation_options && parsed.remediation_options.length > 0) {
                html += `<div class="remediation-options">`;
                
                for (const option of parsed.remediation_options) {
                    console.log(`📋 Option ${option.option_number}: ${option.option_title} (${option.solutions?.length || 0} solutions)`);
                    
                    html += `
                        <div class="remediation-option">
                            <h4 class="option-title">
                                <span class="option-number">Option ${option.option_number}:</span>
                                ${option.option_title}
                            </h4>
                            <p class="option-description">${option.option_description}</p>
                    `;
                    
                    // Solutions (Fix-It buttons)
                    if (option.solutions && option.solutions.length > 0) {
                        html += `<div class="solution-buttons">`;
                        
                        for (const solution of option.solutions) {
                            const solutionIndex = option.solutions.indexOf(solution);
                            const buttonId = `fixItBtn_${option.option_number}_${solutionIndex}`;
                            
                            // Store solution and alert data as base64 to avoid escaping issues
                            const solutionData = btoa(JSON.stringify(solution));
                            console.log('🔍 Alert before encoding:', alert);
                            console.log('🔍 Alert fingerprint:', alert.fingerprint);
                            const alertData = btoa(JSON.stringify(alert));
                            
                            // Check if there's undo info for this action
                            // Note: We should only mark as "executed" if the undo info represents
                            // the OPPOSITE state. For example, if alert says "volume offline" and
                            // we have undo info for "bring online", the volume is already offline
                            // so the undo is not applicable.
                            const undoInfo = this.getUndoInfoForAction(solution.mcp_tool, alert);
                            
                            // Check if undo represents the opposite state
                            const isActuallyExecuted = this.isActionCurrentlyApplied(undoInfo, solution, alert);
                            const isExecuted = isActuallyExecuted;
                            
                            html += `
                                <button 
                                    id="${buttonId}" 
                                    class="fix-it-button ${isExecuted ? 'fix-it-button-executed' : ''}"
                                    data-solution="${solutionData}"
                                    data-alert="${alertData}"
                                    onclick="alertsView.handleFixItClick(this)"
                                    ${isExecuted ? 'disabled' : ''}
                                >
                                    <span class="fix-it-icon">${isExecuted ? '✓' : '🔧'}</span>
                                    ${solution.solution_title}${isExecuted ? ' (Applied)' : ''}
                                </button>
                            `;
                            
                            // Show undo button if action was executed
                            if (isExecuted) {
                                html += `
                                    <button 
                                        class="undo-button"
                                        onclick="alertsView.handleUndoClick('${alert.fingerprint}')"
                                        title="Undo last action"
                                    >
                                        <span class="undo-icon">⏪</span>
                                        Undo
                                    </button>
                                `;
                            }
                        }
                        
                        html += `</div>`; // solution-buttons
                    }
                    
                    html += `</div>`; // remediation-option
                }
                
                html += `</div>`; // remediation-options
            }
            
            html += `</div>`; // corrective-actions-parsed
            
            // Add styles
            html += this.getCorrectiveActionsStyles();
            
            container.innerHTML = html;
            
        } catch (error) {
            console.error('Error rendering corrective actions:', error);
            // Fallback to plain text display
            container.textContent = correctiveActionText;
            container.style.whiteSpace = 'pre-wrap';
        }
    }

    /**
     * Get CSS styles for corrective actions UI
     */
    getCorrectiveActionsStyles() {
        return `
            <style>
                .corrective-actions-parsed {
                    font-size: 14px;
                    line-height: 1.5;
                }
                
                .corrective-actions-description {
                    margin: 0 0 20px 0;
                    color: #333;
                    font-size: 14px;
                }
                
                .remediation-options {
                    margin-top: 16px;
                }
                
                .remediation-option {
                    margin-bottom: 24px;
                    padding-bottom: 24px;
                    border-bottom: 1px solid #e1e5e9;
                }
                
                .remediation-option:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                    padding-bottom: 0;
                }
                
                .option-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: #333;
                    margin: 0 0 8px 0;
                }
                
                .option-number {
                    color: #0067C5;
                }
                
                .option-description {
                    margin: 0 0 16px 0;
                    color: #666;
                    font-size: 13px;
                }
                
                .solution-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                }
                
                .fix-it-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    background: #0067C5;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .fix-it-button:hover {
                    background: #0056a3;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 103, 197, 0.3);
                }
                
                .fix-it-button-executed {
                    background: #9e9e9e;
                    color: #fff;
                    cursor: not-allowed;
                    opacity: 0.7;
                }
                
                .fix-it-button-executed:hover {
                    background: #9e9e9e;
                    transform: none;
                    box-shadow: none;
                }
                
                .fix-it-icon {
                    font-size: 16px;
                }
                
                .undo-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 16px;
                    background: #f5f5f5;
                    color: #333;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .undo-button:hover {
                    background: #e8e8e8;
                    border-color: #ccc;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
                }
                
                .undo-icon {
                    font-size: 14px;
                }
            </style>
        `;
    }

    /**
     * Handle Fix-It button click
     */
    handleFixItClick(button) {
        try {
            // Decode base64-encoded data from button attributes
            const solutionData = JSON.parse(atob(button.getAttribute('data-solution')));
            const alertData = JSON.parse(atob(button.getAttribute('data-alert')));
            
            console.log('Fix-It button clicked:', solutionData.solution_title);
            console.log('🔍 Decoded alert:', alertData);
            console.log('🔍 Decoded alert fingerprint:', alertData.fingerprint);
            
            // Show Fix-It modal
            if (this.fixItModal) {
                this.fixItModal.show(solutionData, alertData);
            } else {
                console.error('FixItModal not initialized');
                window.alert('Fix-It modal is not available');
            }
        } catch (error) {
            console.error('Error handling Fix-It click:', error);
            window.alert('Failed to open Fix-It dialog: ' + error.message);
        }
    }

    /**
     * Get undo info for a specific action on an alert (if exists)
     */
    getUndoInfoForAction(mcpTool, alert) {
        try {
            // Use UndoManager to check for undo info
            if (!this.fixItModal || !this.fixItModal.undoManager) {
                return null;
            }
            
            const undoInfo = this.fixItModal.undoManager.getUndoInfo(alert.fingerprint);
            
            if (!undoInfo) return null;
            
            // Check if the executed action matches this tool
            if (undoInfo.executedAction && undoInfo.executedAction.mcp_tool === mcpTool) {
                return undoInfo;
            }
            
            return null;
        } catch (error) {
            console.error('Error checking undo info:', error);
            return null;
        }
    }

    /**
     * Check if an action is currently applied (i.e., the state change is active)
     * For example, if we executed "bring online" and the volume is now online,
     * the action is "currently applied". If the volume went back offline, it's not.
     */
    isActionCurrentlyApplied(undoInfo, solution, alert) {
        if (!undoInfo) return false;
        
        // For state changes, check if the NEW state matches what we executed
        // For example: If we executed "set to online" (undoInfo.executedAction has state: 'online')
        // and the alert is "volume offline", then the action is NOT currently applied
        // (volume went back to offline)
        
        const executedAction = undoInfo.executedAction;
        if (!executedAction) return false;
        
        // Check if this is a state change action
        if (executedAction.mcp_params && executedAction.mcp_params.state) {
            const executedState = executedAction.mcp_params.state;
            
            // If alert exists for "offline", the current state is offline
            // If we executed "online", then action is NOT currently applied
            if (alert.labels?.alertname === 'VolumeOffline') {
                return executedState === 'offline'; // Only true if we set it offline
            }
            
            // For other state-based alerts, you'd add similar logic
        }
        
        // For non-state actions (like resize), assume they're still applied
        // unless we have more sophisticated state tracking
        return true;
    }

    /**
     * Handle undo button click
     */
    handleUndoClick(alertFingerprint) {
        try {
            // Get undo info from UndoManager using alert fingerprint
            if (!this.fixItModal || !this.fixItModal.undoManager) {
                window.alert('Undo functionality is not available');
                return;
            }
            
            const undoInfo = this.fixItModal.undoManager.getUndoInfo(alertFingerprint);
            if (!undoInfo) {
                window.alert('No undo information available for this alert');
                return;
            }
            
            // Execute undo via FixItModal
            if (this.fixItModal.executeUndo) {
                this.fixItModal.executeUndo(undoInfo);
            } else {
                console.error('FixItModal undo not available');
                window.alert('Undo functionality is not available');
            }
        } catch (error) {
            console.error('Error handling undo click:', error);
            window.alert('Failed to execute undo: ' + error.message);
        }
    }

    // Navigate back to alerts list
    backToList() {
        // Hide details view
        const detailsView = document.getElementById('alertDetailsView');
        if (detailsView) {
            detailsView.style.display = 'none';
        }

        // Show alerts list
        const alertsTable = document.querySelector('#alertsView > .Table-module_base__Mi4wLjYtaW50ZXJuYWw');
        const alertsHeader = document.querySelector('#alertsView > .page-header');
        const alertsToolbar = document.querySelector('#alertsView > .typography-module_h03__Mi4wLjYtaW50ZXJuYWw');
        
        if (alertsTable) alertsTable.style.display = '';
        if (alertsHeader) alertsHeader.style.display = '';
        if (alertsToolbar) alertsToolbar.style.display = '';
    }


    // Load alerts data from Harvest MCP
    async loadAlerts() {
        try {
            // Get global app instance
            if (!window.app || !window.app.clientManager) {
                console.error('App or client manager not initialized');
                return;
            }

            // Call Harvest MCP get_active_alerts tool (routes to harvest-remote server)
            const response = await window.app.clientManager.callTool('get_active_alerts', {});
            
            console.log('Raw alerts response:', response.substring(0, 500) + '...');
            
            // Response is a text string with markdown formatting
            // Extract JSON from markdown code block
            let alertsData = [];
            
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
            if (!jsonMatch || !jsonMatch[1]) {
                console.error('Could not find JSON block in response');
                throw new Error('Invalid response format from get_active_alerts');
            }
            
            // Parse the JSON
            const parsedData = JSON.parse(jsonMatch[1]);
            
            // Extract alerts array from the response structure
            // Response format: { status: "success", data: { alerts: [...] } }
            if (parsedData.data && parsedData.data.alerts) {
                alertsData = parsedData.data.alerts;
            } else if (Array.isArray(parsedData)) {
                // Fallback: if it's already an array
                alertsData = parsedData;
            } else {
                console.error('Unexpected response structure:', parsedData);
                throw new Error('Could not extract alerts from response');
            }
            
            console.log(`Loaded ${alertsData.length} alerts`);
            
            // Debug: Check if alerts have fingerprints
            if (alertsData.length > 0) {
                console.log('🔍 Sample alert object:', alertsData[0]);
                console.log('🔍 Sample alert keys:', Object.keys(alertsData[0]));
                console.log('🔍 Sample alert fingerprint:', alertsData[0].fingerprint);
            }
            
            // Add fingerprints if missing (generate from labels)
            alertsData = alertsData.map(alert => {
                if (!alert.fingerprint) {
                    // Generate a simple fingerprint from alert labels
                    const labelStr = JSON.stringify(alert.labels || {});
                    alert.fingerprint = this.hashCode(labelStr);
                }
                return alert;
            });
            
            // Filter alerts to only show registered clusters
            const registeredClusters = window.app?.clusters || [];
            const registeredClusterNames = registeredClusters.map(c => c.name);
            
            if (registeredClusterNames.length > 0) {
                const originalCount = alertsData.length;
                alertsData = alertsData.filter(alert => {
                    const clusterName = alert.labels?.cluster;
                    return clusterName && registeredClusterNames.includes(clusterName);
                });
                console.log(`Filtered alerts: ${originalCount} → ${alertsData.length} (only registered clusters: ${registeredClusterNames.join(', ')})`);
            }

            // Store alerts data for detail view
            this.storeAlertsData(alertsData);
            
            // Fetch and cache alert rules for corrective actions
            await this.fetchAndCacheAlertRules();

            // Update alert count
            this.updateAlertCount(alertsData.length);

            // Render table rows
            const tableBody = document.getElementById('alertsTableBody');
            if (tableBody && alertsData.length > 0) {
                tableBody.innerHTML = alertsData.map((alert, index) => this.renderAlertRow(alert, index)).join('');
            } else if (tableBody) {
                tableBody.innerHTML = `
                    <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw" style="padding: 20px; text-align: center;">
                        <span class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">No active alerts found</span>
                    </div>
                `;
            }

            // Setup scroll synchronization after table is populated
            // Use requestAnimationFrame to ensure DOM is fully rendered
            requestAnimationFrame(() => {
                this.setupScrollSync();
            });

        } catch (error) {
            console.error('Error loading alerts:', error);
            this.updateAlertCount(0);
            
            const tableBody = document.getElementById('alertsTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <div class="Table-module_row__Mi4wLjYtaW50ZXJuYWw" style="padding: 20px; text-align: center; color: var(--error-main);">
                        <span class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Error loading alerts: ${error.message}</span>
                    </div>
                `;
            }
        }
    }
    
    /**
     * Generate a simple hash code from a string (for fingerprint generation)
     */
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16); // Return as hex string
    }
}

// Create global instance
const alertsView = new AlertsView();
