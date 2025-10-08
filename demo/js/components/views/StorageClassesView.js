/**
 * StorageClassesView Component
 * Manages the display of storage classes in the NetApp ONTAP demo
 */
class StorageClassesView {
    constructor() {
        this.containerId = 'storageClassesView';
    }

    // Render the complete Storage Classes view HTML
    render() {
        return `
            <!-- Storage Classes View -->
            <div id="${this.containerId}" class="view-container" style="display: none;">
                <div class="page-header">
                    <div role="heading" class="typography-module_h02__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw">My Storage Classes</div>
                    <p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">Configure and manage storage class provisioning policies.</p>
                </div>
                
                <div role="heading" class="typography-module_h03__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw typography-module_b__Mi4wLjYtaW50ZXJuYWw style_alerts-header-layout__8HFmd style_table-header-gap__xFIB7">
                    <div class="TableCounter-module_base__Mi4wLjYtaW50ZXJuYWw">
                        <span>My Storage Classes</span>
                    </div>
                    <div class="style_text-align-right__TD9Ez">
                        <!-- Future: Add search or other controls here -->
                    </div>
                </div>
                
                <div class="storage-classes-grid" id="storageClassesContainer">
                    <!-- Storage classes cards will be populated here -->
                </div>
                
                <!-- Provision Storage Button (below storage classes) -->
                <div style="margin-top: 16px;">
                    <button data-component="Button" type="button" class="buttons-module_text__Mi4wLjYtaW50ZXJuYWw TableCounter-module_reset__Mi4wLjYtaW50ZXJuYWw" id="provision-storage-btn" onclick="app.openStorageClassProvisioning()">Provision Storage</button>
                </div>
            </div>
        `;
    }

    // Show the view
    show() {
        const view = document.getElementById(this.containerId);
        if (view) {
            view.style.display = 'block';
        }
    }

    // Hide the view
    hide() {
        const view = document.getElementById(this.containerId);
        if (view) {
            view.style.display = 'none';
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

    // Render storage classes cards
    renderStorageClasses(storageClasses) {
        const container = document.getElementById('storageClassesContainer');
        if (!container) return;

        if (!storageClasses || storageClasses.length === 0) {
            container.innerHTML = '<p class="typography-module_body14__Mi4wLjYtaW50ZXJuYWw">No storage classes configured.</p>';
            return;
        }

        // Render storage class cards
        const cardsHTML = storageClasses.map(sc => `
            <div class="storage-class-card">
                <h3>${sc.name}</h3>
                <p>${sc.description || 'No description'}</p>
                <div class="storage-class-details">
                    <span>Type: ${sc.type || 'N/A'}</span>
                    <span>Policy: ${sc.policy || 'N/A'}</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = cardsHTML;
    }
}

// Create global instance
const storageClassesView = new StorageClassesView();
