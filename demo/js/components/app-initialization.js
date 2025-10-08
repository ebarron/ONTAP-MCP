// Initialize export policy modal
let exportPolicyModal;

// Initialize view components
let clustersViewComponent;
let storageClassesViewComponent;
let alertsViewComponent;

document.addEventListener('DOMContentLoaded', () => {
    exportPolicyModal = new ExportPolicyModal();
    
    // Initialize view components
    const mainContent = document.getElementById('main-content');
    
    // Initialize Clusters View
    if (mainContent && typeof clustersView !== 'undefined') {
        clustersViewComponent = clustersView;
        clustersViewComponent.init(mainContent);
    }
    
    // Initialize Storage Classes View
    if (mainContent && typeof storageClassesView !== 'undefined') {
        storageClassesViewComponent = storageClassesView;
        storageClassesViewComponent.init(mainContent);
    }
    
    // Initialize Alerts View
    if (mainContent && typeof alertsView !== 'undefined') {
        alertsViewComponent = alertsView;
        alertsViewComponent.init(mainContent);
    }
    
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