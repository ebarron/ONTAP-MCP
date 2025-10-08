// AlertsView Component
// Displays alerts table with filters and sort functionality

class AlertsView {
    constructor() {
        this.containerId = 'alertsView';
        this.alertCount = 0;
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
                        <span><span>Alerts&nbsp;</span><span id="alertCount">(0)</span></span><span>&nbsp; &nbsp;<div class="TableCounter-module_divider__Mi4wLjYtaW50ZXJuYWw"></div>&nbsp; &nbsp;Filters applied (0)</span>
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
                            <div class="Table-module_header-cell__Mi4wLjYtaW50ZXJuYWw" data-testid="table-column-header-Source name" style="flex: 1 0 230px;">
                                <div id="Source name-alertObjectName" class="Table-module_header-label__Mi4wLjYtaW50ZXJuYWw">
                                    <span>Source name</span>
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

    // Update alert count
    updateAlertCount(count) {
        this.alertCount = count;
        const alertCountElement = document.getElementById('alertCount');
        if (alertCountElement) {
            alertCountElement.textContent = `(${count})`;
        }
    }

    // Load alerts data (placeholder for future implementation)
    async loadAlerts() {
        // TODO: Integrate with Harvest MCP to load actual alerts
        // For now, just update count to 0
        this.updateAlertCount(0);
    }
}

// Create global instance
const alertsView = new AlertsView();
