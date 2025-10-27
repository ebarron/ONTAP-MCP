/**
 * ConfigureGrafanaMcpModal Component
 * Modal for configuring Grafana MCP server connection
 */
class ConfigureGrafanaMcpModal {
    constructor() {
        this.modalId = 'configureGrafanaMcpModal';
    }

    // Render the complete Grafana MCP configuration modal HTML
    render() {
        return `
            <!-- Configure Grafana MCP Modal -->
            <div class="modal-overlay" id="${this.modalId}" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Configure Grafana MCP Server</h2>
                        <button class="modal-close" onclick="window.configureGrafanaMcpModal.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="configureGrafanaMcpForm">
                            <div class="form-group">
                                <label for="grafanaMcpUrl">Server URL (MCP Endpoint)</label>
                                <input type="text" id="grafanaMcpUrl" name="url" placeholder="http://localhost:8001" required>
                                <small style="color: #666; font-size: 12px;">CORS proxy endpoint for Grafana MCP server</small>
                            </div>
                            <div class="form-group">
                                <label for="grafanaMcpViewerUrl">Viewer URL (Grafana UI)</label>
                                <input type="text" id="grafanaMcpViewerUrl" name="viewer_url" placeholder="http://localhost:3001" required>
                                <small style="color: #666; font-size: 12px;">Proxy endpoint for accessing Grafana dashboards</small>
                            </div>
                            <div class="form-group">
                                <label for="grafanaMcpDescription">Description (Optional)</label>
                                <textarea id="grafanaMcpDescription" name="description" rows="3" placeholder="Grafana MCP Server (Streamable HTTP via CORS proxy)"></textarea>
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="grafanaMcpEnabled" name="enabled" checked>
                                    Enable this server
                                </label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="button-secondary" onclick="window.configureGrafanaMcpModal.close()">Cancel</button>
                        <button type="submit" class="button-primary" onclick="window.configureGrafanaMcpModal.handleSave(); return false;">Save Configuration</button>
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
        const form = document.getElementById('configureGrafanaMcpForm');
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
        const config = window.app?.mcpConfig?.getServer('grafana-remote');
        if (config) {
            document.getElementById('grafanaMcpUrl').value = config.url || '';
            document.getElementById('grafanaMcpViewerUrl').value = config.viewer_url || '';
            document.getElementById('grafanaMcpDescription').value = config.description || '';
            document.getElementById('grafanaMcpEnabled').checked = config.enabled !== false;
        }
        
        modal.style.display = 'flex';
        document.getElementById('grafanaMcpUrl').focus();
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
        const formData = new FormData(document.getElementById('configureGrafanaMcpForm'));
        const newConfig = {
            type: 'http',
            url: formData.get('url').trim(),
            viewer_url: formData.get('viewer_url').trim(),
            description: formData.get('description').trim() || 'Grafana MCP Server (Streamable HTTP via CORS proxy)',
            enabled: formData.get('enabled') === 'on'
        };

        // Validation
        if (!newConfig.url) {
            window.app?.notifications?.showError('Server URL is required');
            return;
        }
        if (!newConfig.viewer_url) {
            window.app?.notifications?.showError('Viewer URL is required');
            return;
        }

        try {
            // Update configuration
            await window.app.mcpConfig.updateServerConfig('grafana-remote', newConfig);
            
            // Reconnect to MCP server
            await window.app.reconnectMcpServer('grafana-remote');
            
            window.app?.notifications?.showSuccess('Grafana MCP configuration updated');
            this.close();
        } catch (error) {
            console.error('Error updating Grafana MCP config:', error);
            window.app?.notifications?.showError('Failed to update configuration: ' + error.message);
        }
    }
}

// Create global instance and expose to window
const configureGrafanaMcpModal = new ConfigureGrafanaMcpModal();
window.configureGrafanaMcpModal = configureGrafanaMcpModal;
