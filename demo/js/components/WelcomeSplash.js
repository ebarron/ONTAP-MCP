// Welcome Splash Screen Component
// Displays architecture overview and MCP server capabilities on first load

class WelcomeSplash {
    constructor() {
        this.modalId = 'welcomeSplashModal';
        this.storageKey = 'hideSplashScreen';
    }

    // Create and inject the splash screen HTML
    createSplashScreen() {
        const splashHTML = `
            <div class="modal-overlay" id="${this.modalId}" style="display: flex;">
                <div class="modal-content splash-modal">
                    <div class="modal-header">
                        <h2>Welcome to NetApp Fleet Management Demo</h2>
                        <button class="modal-close" onclick="welcomeSplash.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="splash-description">
                            This demonstration showcases NetApp's Fleet Management capabilities built on the 
                            <strong>Model Context Protocol (MCP)</strong> architecture, integrating three powerful services:
                        </p>
                        
                        <!-- Architecture Diagram -->
                        <div class="architecture-diagram">
                            <svg viewBox="0 0 900 420" xmlns="http://www.w3.org/2000/svg">
                                <!-- Fleet Management Demo Box -->
                                <rect x="300" y="20" width="300" height="60" rx="8" fill="#0067C5" stroke="#004a8f" stroke-width="2"/>
                                <text x="450" y="55" font-family="'Open Sans', sans-serif" font-size="20" font-weight="600" fill="white" text-anchor="middle">Fleet Management Demo</text>
                                
                                <!-- Main divider line -->
                                <line x1="450" y1="80" x2="450" y2="130" stroke="#333" stroke-width="2"/>
                                <line x1="150" y1="130" x2="750" y2="130" stroke="#333" stroke-width="2"/>
                                
                                <!-- Left branch line (ONTAP) -->
                                <line x1="225" y1="130" x2="225" y2="160" stroke="#333" stroke-width="2"/>
                                
                                <!-- Center branch line (Harvest) -->
                                <line x1="450" y1="130" x2="450" y2="160" stroke="#333" stroke-width="2"/>
                                
                                <!-- Right branch line (Grafana) -->
                                <line x1="675" y1="130" x2="675" y2="160" stroke="#333" stroke-width="2"/>
                                
                                <!-- ONTAP MCP Box -->
                                <rect x="75" y="160" width="300" height="70" rx="8" fill="#7b2cbf" stroke="#5a1f8f" stroke-width="2"/>
                                <text x="225" y="195" font-family="'Open Sans', sans-serif" font-size="18" font-weight="600" fill="white" text-anchor="middle">ONTAP MCP Server</text>
                                <text x="225" y="218" font-family="'Open Sans', sans-serif" font-size="13" fill="white" text-anchor="middle">localhost:3000</text>
                                
                                <!-- Harvest MCP Box -->
                                <rect x="400" y="160" width="200" height="70" rx="8" fill="#00C18D" stroke="#009970" stroke-width="2"/>
                                <text x="500" y="195" font-family="'Open Sans', sans-serif" font-size="18" font-weight="600" fill="white" text-anchor="middle">Harvest MCP</text>
                                <text x="500" y="218" font-family="'Open Sans', sans-serif" font-size="13" fill="white" text-anchor="middle">Remote Metrics</text>
                                
                                <!-- Grafana MCP Box -->
                                <rect x="625" y="160" width="200" height="70" rx="8" fill="#FF6B35" stroke="#CC5529" stroke-width="2"/>
                                <text x="725" y="195" font-family="'Open Sans', sans-serif" font-size="18" font-weight="600" fill="white" text-anchor="middle">Grafana MCP</text>
                                <text x="725" y="218" font-family="'Open Sans', sans-serif" font-size="13" fill="white" text-anchor="middle">Visualization</text>
                                
                                <!-- ONTAP capabilities arrows -->
                                <line x1="125" y1="230" x2="125" y2="270" stroke="#7b2cbf" stroke-width="2" marker-end="url(#arrowPurple)"/>
                                <line x1="225" y1="230" x2="225" y2="270" stroke="#7b2cbf" stroke-width="2" marker-end="url(#arrowPurple)"/>
                                <line x1="325" y1="230" x2="325" y2="270" stroke="#7b2cbf" stroke-width="2" marker-end="url(#arrowPurple)"/>
                                
                                <!-- Harvest capabilities arrows -->
                                <line x1="450" y1="230" x2="450" y2="270" stroke="#00C18D" stroke-width="2" marker-end="url(#arrowGreen)"/>
                                <line x1="550" y1="230" x2="550" y2="270" stroke="#00C18D" stroke-width="2" marker-end="url(#arrowGreen)"/>
                                
                                <!-- Grafana capabilities arrows -->
                                <line x1="675" y1="230" x2="675" y2="270" stroke="#FF6B35" stroke-width="2" marker-end="url(#arrowOrange)"/>
                                <line x1="775" y1="230" x2="775" y2="270" stroke="#FF6B35" stroke-width="2" marker-end="url(#arrowOrange)"/>
                                
                                <!-- ONTAP Capabilities -->
                                <text x="125" y="295" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#7b2cbf" text-anchor="middle">Volume</text>
                                <text x="125" y="313" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#7b2cbf" text-anchor="middle">Provisioning</text>
                                
                                <text x="225" y="295" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#7b2cbf" text-anchor="middle">Storage Class</text>
                                <text x="225" y="313" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#7b2cbf" text-anchor="middle">Management</text>
                                
                                <text x="325" y="295" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#7b2cbf" text-anchor="middle">Day 2</text>
                                <text x="325" y="313" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#7b2cbf" text-anchor="middle">Operations</text>
                                
                                <!-- Harvest Capabilities -->
                                <text x="450" y="295" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#00C18D" text-anchor="middle">Performance</text>
                                <text x="450" y="313" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#00C18D" text-anchor="middle">Monitoring</text>
                                
                                <text x="550" y="295" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#00C18D" text-anchor="middle">Alerting &</text>
                                <text x="550" y="313" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#00C18D" text-anchor="middle">Notifications</text>
                                
                                <!-- Grafana Capabilities -->
                                <text x="675" y="295" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#FF6B35" text-anchor="middle">Custom</text>
                                <text x="675" y="313" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#FF6B35" text-anchor="middle">Dashboards</text>
                                
                                <text x="775" y="295" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#FF6B35" text-anchor="middle">Metrics</text>
                                <text x="775" y="313" font-family="'Open Sans', sans-serif" font-size="13" font-weight="600" fill="#FF6B35" text-anchor="middle">Visualization</text>
                                
                                <!-- Arrow markers -->
                                <defs>
                                    <marker id="arrowPurple" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                                        <polygon points="0 0, 10 5, 0 10" fill="#7b2cbf" />
                                    </marker>
                                    <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                                        <polygon points="0 0, 10 5, 0 10" fill="#00C18D" />
                                    </marker>
                                    <marker id="arrowOrange" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                                        <polygon points="0 0, 10 5, 0 10" fill="#FF6B35" />
                                    </marker>
                                </defs>
                            </svg>
                        </div>
                        
                        <div class="splash-features">
                            <div class="feature-column">
                                <h4>🔧 ONTAP MCP Server</h4>
                                <ul>
                                    <li>55+ storage management tools</li>
                                    <li>Multi-cluster fleet control</li>
                                    <li>Automated provisioning workflows</li>
                                    <li>QoS and snapshot policy management</li>
                                </ul>
                            </div>
                            <div class="feature-column">
                                <h4>📊 Harvest MCP Server</h4>
                                <ul>
                                    <li>Real-time configuration and performance metrics</li>
                                    <li>Prometheus/VictoriaMetrics integration</li>
                                    <li>Intelligent alerting system</li>
                                    <li>Infrastructure health assessment</li>
                                </ul>
                            </div>
                            <div class="feature-column">
                                <h4>📈 Grafana MCP Server</h4>
                                <ul>
                                    <li>Visualization of ONTAP storage systems</li>
                                    <li>Custom dashboard building</li>
                                    <li>On-the-fly metrics visualization</li>
                                    <li>Provisioned asset monitoring</li>
                                </ul>
                            </div>
                        </div>
                        
                        <p class="splash-footer">
                            Explore the demo to see how MCP servers enable AI-powered storage management at scale.
                        </p>
                    </div>
                    <div class="modal-footer">
                        <label class="checkbox-label">
                            <input type="checkbox" id="dontShowAgain">
                            Don't show this again
                        </label>
                        <button type="button" class="btn-primary" onclick="welcomeSplash.close()">Get Started</button>
                    </div>
                </div>
            </div>
        `;

        // Inject into DOM
        document.body.insertAdjacentHTML('beforeend', splashHTML);
    }

    // Check if splash should be shown
    shouldShow() {
        const dontShowAgain = localStorage.getItem(this.storageKey);
        return dontShowAgain !== 'true';
    }

    // Show the splash screen
    show() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // Close the splash screen
    close() {
        const dontShowCheckbox = document.getElementById('dontShowAgain');
        const modal = document.getElementById(this.modalId);
        
        if (dontShowCheckbox && dontShowCheckbox.checked) {
            localStorage.setItem(this.storageKey, 'true');
        }
        
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Initialize the splash screen
    init() {
        // Create the splash screen HTML
        this.createSplashScreen();
        
        // Show it if user hasn't dismissed it before
        if (this.shouldShow()) {
            this.show();
        } else {
            // Hide it immediately if user has dismissed before
            const modal = document.getElementById(this.modalId);
            if (modal) {
                modal.style.display = 'none';
            }
        }
    }
}

// Create global instance
const welcomeSplash = new WelcomeSplash();

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    welcomeSplash.init();
});
