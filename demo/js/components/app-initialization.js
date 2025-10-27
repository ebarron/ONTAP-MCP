// Initialize export policy modal
let exportPolicyModal;

// Initialize corrective action components
let correctiveActionParser;
let fixItModal;
let parameterResolver;

// Initialize navigation components
let topNavBarComponent;
let leftNavBarComponent;

// Initialize view components
let clustersViewComponent;
let storageClassesViewComponent;
let alertsViewComponent;
let volumesViewComponent;
let svmsViewComponent;
let nfsSharesViewComponent;

// Initialize modal/flyout components
let chatbotSectionComponent;
let addClusterModalComponent;
let clusterDetailFlyoutComponent;
let configureOntapMcpModalComponent;
let configureHarvestMcpModalComponent;
let configureGrafanaMcpModalComponent;

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
    
    if (mainContent && typeof volumesView !== 'undefined') {
        volumesViewComponent = volumesView;
        volumesViewComponent.init(mainContent);
    }
    
    if (mainContent && typeof svmsView !== 'undefined') {
        svmsViewComponent = svmsView;
        svmsViewComponent.init(mainContent);
    }
    
    if (mainContent && typeof nfsSharesView !== 'undefined') {
        nfsSharesViewComponent = nfsSharesView;
        nfsSharesViewComponent.init(mainContent);
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
    
    if (typeof configureOntapMcpModal !== 'undefined') {
        configureOntapMcpModalComponent = configureOntapMcpModal;
        configureOntapMcpModalComponent.init(document.body);
    }
    
    if (typeof configureHarvestMcpModal !== 'undefined') {
        configureHarvestMcpModalComponent = configureHarvestMcpModal;
        configureHarvestMcpModalComponent.init(document.body);
    }
    
    if (typeof configureGrafanaMcpModal !== 'undefined') {
        configureGrafanaMcpModalComponent = configureGrafanaMcpModal;
        configureGrafanaMcpModalComponent.init(document.body);
    }
    
    // Initialize corrective action components (must happen after app.js loads)
    // Will be connected to alertsView when app initializes
    debugLogger.log('App initialization: Components ready, waiting for app.js to load...');
    
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