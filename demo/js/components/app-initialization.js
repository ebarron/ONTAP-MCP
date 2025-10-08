// Initialize export policy modal
let exportPolicyModal;

// Initialize navigation components
let topNavBarComponent;
let leftNavBarComponent;

// Initialize view components
let clustersViewComponent;
let storageClassesViewComponent;
let alertsViewComponent;

// Initialize modal/flyout components
let chatbotSectionComponent;
let addClusterModalComponent;
let clusterDetailFlyoutComponent;

document.addEventListener('DOMContentLoaded', () => {
    // Get parent containers
    const appBase = document.querySelector('.app-base');
    const mainContent = document.getElementById('main-content');
    
    // Initialize navigation components first (they create the layout structure)
    if (appBase && typeof topNavBar !== 'undefined') {
        topNavBarComponent = topNavBar;
        topNavBarComponent.init(appBase);
    }
    
    if (appBase && typeof leftNavBar !== 'undefined') {
        leftNavBarComponent = leftNavBar;
        leftNavBarComponent.init(appBase);
        
        // NOTE: Navigation event handlers will be set up after app.js loads
        // We'll call leftNavBarComponent.setupNavigation() from app.js
    }
    
    // Initialize view components (they populate the main content area)
    if (mainContent && typeof clustersView !== 'undefined') {
        clustersViewComponent = clustersView;
        clustersViewComponent.init(mainContent);
    }
    
    if (mainContent && typeof storageClassesView !== 'undefined') {
        storageClassesViewComponent = storageClassesView;
        storageClassesViewComponent.init(mainContent);
    }
    
    if (mainContent && typeof alertsView !== 'undefined') {
        alertsViewComponent = alertsView;
        alertsViewComponent.init(mainContent);
    }
    
    // Initialize chatbot section
    if (mainContent && typeof chatbotSection !== 'undefined') {
        chatbotSectionComponent = chatbotSection;
        chatbotSectionComponent.init(mainContent);
    }
    
    // Initialize modals and flyouts (append to body)
    if (typeof ExportPolicyModal !== 'undefined') {
        exportPolicyModal = new ExportPolicyModal();
        exportPolicyModal.init(document.body);
    }
    
    if (typeof addClusterModal !== 'undefined') {
        addClusterModalComponent = addClusterModal;
        addClusterModalComponent.init(document.body);
    }
    
    if (typeof clusterDetailFlyout !== 'undefined') {
        clusterDetailFlyoutComponent = clusterDetailFlyout;
        clusterDetailFlyoutComponent.init(document.body);
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