// Initialize export policy modal
let exportPolicyModal;
document.addEventListener('DOMContentLoaded', () => {
    exportPolicyModal = new ExportPolicyModal();
    
    // Set up export policy dropdown listener using event delegation
    // This works for dynamically created elements
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'exportPolicy') {
            if (e.target.value === 'NEW_EXPORT_POLICY') {
                exportPolicyModal.open();
                // Reset to previous value while modal is open
                e.target.value = '';
            }
        }
    });
});

// Global service button handlers (called from HTML)
window.openVolumes = () => app.openVolumes();
window.openSnapshots = () => app.openSnapshots();
window.openExports = () => app.openExports();
window.openCifsShares = () => app.openCifsShares();