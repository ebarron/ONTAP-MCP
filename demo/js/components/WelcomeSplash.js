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
                            <strong>Model Context Protocol (MCP)</strong> architecture, integrating two powerful services:
                        </p>
                        
                        <!-- Architecture Diagram -->
                        <div class="architecture-diagram">
                            <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
                                <!-- Fleet Management Demo Box -->
                                <rect x="250" y="20" width="300" height="60" rx="8" fill="#0067C5" stroke="#004a8f" stroke-width="2"/>
                                <text x="400" y="55" font-family="'Open Sans', sans-serif" font-size="20" font-weight="600" fill="white" text-anchor="middle">Fleet Management Demo</text>
                                
                                <!-- Main divider line -->
                                <line x1="400" y1="80" x2="400" y2="130" stroke="#333" stroke-width="2"/>
                                <line x1="200" y1="130" x2="600" y2="130" stroke="#333" stroke-width="2"/>
                                
                                <!-- Left branch line -->
                                <line x1="250" y1="130" x2="250" y2="160" stroke="#333" stroke-width="2"/>
                                
                                <!-- Right branch line -->
                                <line x1="550" y1="130" x2="550" y2="160" stroke="#333" stroke-width="2"/>
                                
                                <!-- ONTAP MCP Box -->
                                <rect x="100" y="160" width="300" height="70" rx="8" fill="#7b2cbf" stroke="#5a1f8f" stroke-width="2"/>
                                <text x="250" y="195" font-family="'Open Sans', sans-serif" font-size="18" font-weight="600" fill="white" text-anchor="middle">ONTAP MCP Server</text>
                                <text x="250" y="218" font-family="'Open Sans', sans-serif" font-size="13" fill="white" text-anchor="middle">localhost:3000</text>
                                
                                <!-- Harvest MCP Box -->
                                <rect x="400" y="160" width="300" height="70" rx="8" fill="#00C18D" stroke="#009970" stroke-width="2"/>
                                <text x="550" y="195" font-family="'Open Sans', sans-serif" font-size="18" font-weight="600" fill="white" text-anchor="middle">Harvest MCP Server</text>
                                <text x="550" y="218" font-family="'Open Sans', sans-serif" font-size="13" fill="white" text-anchor="middle">Remote Metrics & Monitoring</text>
                                
                                <!-- ONTAP capabilities arrows -->
                                <line x1="150" y1="230" x2="150" y2="270" stroke="#7b2cbf" stroke-width="2" marker-end="url(#arrowPurple)"/>
                                <line x1="250" y1="230" x2="250" y2="270" stroke="#7b2cbf" stroke-width="2" marker-end="url(#arrowPurple)"/>
                                <line x1="350" y1="230" x2="350" y2="270" stroke="#7b2cbf" stroke-width="2" marker-end="url(#arrowPurple)"/>
                                
                                <!-- Harvest capabilities arrows -->
                                <line x1="450" y1="230" x2="450" y2="270" stroke="#00C18D" stroke-width="2" marker-end="url(#arrowGreen)"/>
                                <line x1="550" y1="230" x2="550" y2="270" stroke="#00C18D" stroke-width="2" marker-end="url(#arrowGreen)"/>
                                <line x1="650" y1="230" x2="650" y2="270" stroke="#00C18D" stroke-width="2" marker-end="url(#arrowGreen)"/>
                                
                                <!-- ONTAP Capabilities -->
                                <text x="150" y="295" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#7b2cbf" text-anchor="middle">Volume</text>
                                <text x="150" y="313" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#7b2cbf" text-anchor="middle">Provisioning</text>
                                
                                <text x="250" y="295" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#7b2cbf" text-anchor="middle">Storage Class</text>
                                <text x="250" y="313" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#7b2cbf" text-anchor="middle">Management</text>
                                
                                <text x="350" y="295" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#7b2cbf" text-anchor="middle">Day 2</text>
                                <text x="350" y="313" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#7b2cbf" text-anchor="middle">Operations</text>
                                
                                <!-- Harvest Capabilities -->
                                <text x="450" y="295" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#00C18D" text-anchor="middle">Performance</text>
                                <text x="450" y="313" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#00C18D" text-anchor="middle">Monitoring</text>
                                
                                <text x="550" y="295" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#00C18D" text-anchor="middle">Alerting &</text>
                                <text x="550" y="313" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#00C18D" text-anchor="middle">Notifications</text>
                                
                                <text x="650" y="295" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#00C18D" text-anchor="middle">Estate</text>
                                <text x="650" y="313" font-family="'Open Sans', sans-serif" font-size="14" font-weight="600" fill="#00C18D" text-anchor="middle">Discovery</text>
                                
                                <!-- Arrow markers -->
                                <defs>
                                    <marker id="arrowPurple" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                                        <polygon points="0 0, 10 5, 0 10" fill="#7b2cbf" />
                                    </marker>
                                    <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                                        <polygon points="0 0, 10 5, 0 10" fill="#00C18D" />
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
