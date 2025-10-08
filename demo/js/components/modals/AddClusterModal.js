/**
 * AddClusterModal Component
 * Modal dialog for adding new ONTAP clusters
 */
class AddClusterModal {
    constructor() {
        this.modalId = 'addClusterModal';
    }

    // Render the complete add cluster modal HTML
    render() {
        return `
            <!-- Add Cluster Modal -->
            <div class="modal-overlay" id="${this.modalId}" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Add ONTAP Cluster</h2>
                        <button class="modal-close" id="closeModal">&times;</button>
                    </div>
                    <form id="addClusterForm">
                        <div class="form-group">
                            <label for="clusterName">Cluster Name</label>
                            <input type="text" id="clusterName" name="name" required>
                        </div>
                        <div class="form-group">
                            <label for="clusterIp">Cluster IP Address</label>
                            <input type="text" id="clusterIp" name="cluster_ip" required>
                        </div>
                        <div class="form-group">
                            <label for="username">Username</label>
                            <input type="text" id="username" name="username" required>
                        </div>
                        <div class="form-group">
                            <label for="password">Password</label>
                            <input type="password" id="password" name="password" required>
                        </div>
                        <div class="form-group">
                            <label for="description">Description (Optional)</label>
                            <textarea id="description" name="description" rows="3"></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" id="cancelAdd">Cancel</button>
                            <button type="submit" class="btn-primary">Add Cluster</button>
                        </div>
                    </form>
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
    }

    // Open the modal
    open() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // Close the modal
    close() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = 'none';
            // Reset form
            const form = document.getElementById('addClusterForm');
            if (form) form.reset();
        }
    }
}

// Create global instance
const addClusterModal = new AddClusterModal();
