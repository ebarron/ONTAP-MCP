/**
 * LeftNavBar Component
 * Service navigation sidebar with page links
 */
class LeftNavBar {
    constructor() {
        this.containerId = 'left-nav';
        this.activePageHandlers = {};
    }

    // Render the complete left navigation sidebar HTML
    render() {
        return `
        <!-- Left Navigation Sidebar -->
        <nav class="left-nav" id="${this.containerId}">
            <div class="service-navigation-container">
                <div class="service-header">Provisioning</div>
                <div class="service-links-container">
                    <a href="#" class="service-link active" data-page="clusters">
                        My Fleet
                    </a>
                    <a href="#" class="service-link" data-page="storage-classes">
                        My Storage Classes
                    </a>
                    <a href="#" class="service-link" data-page="alerts">
                        Alerts
                    </a>
                </div>
            </div>
        </nav>
        `;
    }

    // Initialize the component (inject HTML into DOM)
    init(parentElement) {
        // Check if left nav already exists
        if (document.getElementById(this.containerId)) {
            return;
        }
        
        const navHTML = this.render();
        parentElement.insertAdjacentHTML('beforeend', navHTML);
        
        // NOTE: setupNavigation() will be called later after app.js loads
        // This ensures window.app exists when click handlers run
    }

    // Set up navigation link click handlers
    setupNavigation() {
        const navLinks = document.querySelectorAll('.service-link');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                
                // Update active state on nav links
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // Trigger page change handler if registered
                if (this.activePageHandlers[page]) {
                    this.activePageHandlers[page]();
                } else if (window.app) {
                    // Call app view switching methods
                    if (page === 'clusters') {
                        window.app.showClustersView();
                    } else if (page === 'storage-classes') {
                        window.app.showStorageClassesView();
                    } else if (page === 'alerts') {
                        window.app.showAlertsView();
                    }
                } else {
                    console.warn('App not initialized yet, navigation handler not available');
                }
            });
        });
    }

    // Register handler for a specific page
    onPageChange(page, handler) {
        this.activePageHandlers[page] = handler;
    }

    // Set active navigation item
    setActive(page) {
        const navLinks = document.querySelectorAll('.service-link');
        navLinks.forEach(link => {
            if (link.dataset.page === page) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // Utility to capitalize strings
    capitalize(str) {
        return str.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join('');
    }
}

// Create global instance
const leftNavBar = new LeftNavBar();
