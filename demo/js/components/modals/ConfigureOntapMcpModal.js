/**
 * ConfigureOntapMcpModal Component
 * Modal for configuring ONTAP MCP server connection
 */
class ConfigureOntapMcpModal {
    constructor() {
        this.modalId = 'configureOntapMcpModal';
    }

    // Render the complete ONTAP MCP configuration modal HTML
    render() {
        return `
            <!-- Configure ONTAP MCP Modal -->
            <div class="modal-overlay" id="${this.modalId}" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Configure ONTAP MCP Server</h2>
                        <button class="modal-close" onclick="window.configureOntapMcpModal.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="configureOntapMcpForm">
                            <div class="form-group">
                                <label for="ontapMcpUrl">Server URL</label>
                                <input type="text" id="ontapMcpUrl" name="url" placeholder="http://localhost:3000" required>
                            </div>
                            <div class="form-group">
                                <label for="ontapMcpDescription">Description (Optional)</label>
                                <textarea id="ontapMcpDescription" name="description" rows="3" placeholder="NetApp ONTAP MCP Server"></textarea>
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="ontapMcpEnabled" name="enabled" checked>
                                    Enable this server
                                </label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="button-secondary" onclick="window.configureOntapMcpModal.close()">Cancel</button>
                        <button type="submit" class="button-primary" onclick="window.configureOntapMcpModal.handleSave(); return false;">Save Configuration</button>
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
        const form = document.getElementById('configureOntapMcpForm');
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
        const config = window.app?.mcpConfig?.getServer('netapp-ontap');
        if (config) {
            document.getElementById('ontapMcpUrl').value = config.url || '';
            document.getElementById('ontapMcpDescription').value = config.description || '';
            document.getElementById('ontapMcpEnabled').checked = config.enabled !== false;
        }
        
        modal.style.display = 'flex';
        document.getElementById('ontapMcpUrl').focus();
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
        const formData = new FormData(document.getElementById('configureOntapMcpForm'));
        const newConfig = {
            type: 'http',
            url: formData.get('url').trim(),
            description: formData.get('description').trim() || 'NetApp ONTAP MCP Server',
            enabled: formData.get('enabled') === 'on'
        };

        // Validation
        if (!newConfig.url) {
            window.app?.notifications?.showError('Server URL is required');
            return;
        }

        try {
            // Update configuration
            await window.app.mcpConfig.updateServerConfig('netapp-ontap', newConfig);
            
            // Reconnect to MCP server
            await window.app.reconnectMcpServer('netapp-ontap');
            
            window.app?.notifications?.showSuccess('ONTAP MCP configuration updated');
            this.close();
        } catch (error) {
            console.error('Error updating ONTAP MCP config:', error);
            window.app?.notifications?.showError('Failed to update configuration: ' + error.message);
        }
    }
}

// Create global instance and expose to window
const configureOntapMcpModal = new ConfigureOntapMcpModal();
window.configureOntapMcpModal = configureOntapMcpModal;
