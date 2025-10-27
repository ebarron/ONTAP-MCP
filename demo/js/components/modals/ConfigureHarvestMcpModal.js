/**
 * ConfigureHarvestMcpModal Component
 * Modal for configuring Harvest MCP server connection
 */
class ConfigureHarvestMcpModal {
    constructor() {
        this.modalId = 'configureHarvestMcpModal';
    }

    // Render the complete Harvest MCP configuration modal HTML
    render() {
        return `
            <!-- Configure Harvest MCP Modal -->
            <div class="modal-overlay" id="${this.modalId}" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Configure Harvest MCP Server</h2>
                        <button class="modal-close" onclick="window.configureHarvestMcpModal.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="configureHarvestMcpForm">
                            <div class="form-group">
                                <label for="harvestMcpUrl">Server URL</label>
                                <input type="text" id="harvestMcpUrl" name="url" placeholder="http://10.193.49.74:9112" required>
                            </div>
                            <div class="form-group">
                                <label for="harvestMcpDescription">Description (Optional)</label>
                                <textarea id="harvestMcpDescription" name="description" rows="3" placeholder="NetApp Harvest Metrics Server"></textarea>
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="harvestMcpEnabled" name="enabled" checked>
                                    Enable this server
                                </label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="button-secondary" onclick="window.configureHarvestMcpModal.close()">Cancel</button>
                        <button type="submit" class="button-primary" onclick="window.configureHarvestMcpModal.handleSave(); return false;">Save Configuration</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Initialize the component (inject HTML into DOM)
    init(parentElement) {
        // Check if modal already exists
        if (document.getElementById(this.modalId)) {
            return;
        }
        
        const modalHTML = this.render();
        parentElement.insertAdjacentHTML('beforeend', modalHTML);
        
        // Bind form submission
        const form = document.getElementById('configureHarvestMcpForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSave();
            });
        }
    }

    // Open the modal and populate with current config
    open() {
        const modal = document.getElementById(this.modalId);
        if (!modal) return;
        
        // Load current configuration
        const config = window.app?.mcpConfig?.getServer('harvest-remote');
        if (config) {
            document.getElementById('harvestMcpUrl').value = config.url || '';
            document.getElementById('harvestMcpDescription').value = config.description || '';
            document.getElementById('harvestMcpEnabled').checked = config.enabled !== false;
        }
        
        modal.style.display = 'flex';
        document.getElementById('harvestMcpUrl').focus();
    }

    // Close the modal
    close() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Handle save configuration
    async handleSave() {
        const formData = new FormData(document.getElementById('configureHarvestMcpForm'));
        const newConfig = {
            type: 'http',
            url: formData.get('url').trim(),
            description: formData.get('description').trim() || 'NetApp Harvest Metrics Server',
            enabled: formData.get('enabled') === 'on'
        };

        // Validation
        if (!newConfig.url) {
            window.app?.notifications?.showError('Server URL is required');
            return;
        }

        try {
            // Update configuration
            await window.app.mcpConfig.updateServerConfig('harvest-remote', newConfig);
            
            // Reconnect to MCP server
            await window.app.reconnectMcpServer('harvest-remote');
            
            window.app?.notifications?.showSuccess('Harvest MCP configuration updated');
            this.close();
        } catch (error) {
            console.error('Error updating Harvest MCP config:', error);
            window.app?.notifications?.showError('Failed to update configuration: ' + error.message);
        }
    }
}

// Create global instance and expose to window
const configureHarvestMcpModal = new ConfigureHarvestMcpModal();
window.configureHarvestMcpModal = configureHarvestMcpModal;
