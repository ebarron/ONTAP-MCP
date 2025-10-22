/**
 * Grafana Dashboard Modal
 * 
 * Displays Grafana dashboards in a modal overlay using an iframe.
 * Provides a professional modal interface with close button and backdrop click-to-close.
 */
class GrafanaDashboardModal {
    constructor() {
        this.overlay = null;
        this.isOpen = false;
    }

    /**
     * Open a Grafana dashboard in modal overlay
     * @param {string} dashboardUrl - Full URL to the Grafana dashboard
     * @param {string} title - Optional title for the modal header
     */
    open(dashboardUrl, title = 'Grafana Dashboard') {
        // Close existing modal if open
        if (this.isOpen) {
            this.close();
        }

        // Create overlay backdrop
        this.overlay = document.createElement('div');
        this.overlay.className = 'grafana-modal-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease-in;
        `;

        // Create modal container
        const modalContainer = document.createElement('div');
        modalContainer.className = 'grafana-modal-container';
        modalContainer.style.cssText = `
            width: 90%;
            height: 90%;
            max-width: 1800px;
            max-height: 1200px;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: slideIn 0.3s ease-out;
        `;

        // Create modal header
        const modalHeader = document.createElement('div');
        modalHeader.className = 'grafana-modal-header';
        modalHeader.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            background: #f8f9fa;
            border-bottom: 1px solid #e1e5e9;
        `;

        // Create title
        const modalTitle = document.createElement('h3');
        modalTitle.textContent = title;
        modalTitle.style.cssText = `
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #333333;
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        // Add Grafana icon to title
        const grafanaIcon = document.createElement('img');
        grafanaIcon.src = 'grafana-icon.png';
        grafanaIcon.alt = 'Grafana';
        grafanaIcon.style.cssText = 'width: 24px; height: 24px;';
        modalTitle.insertBefore(grafanaIcon, modalTitle.firstChild);

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✕';
        closeButton.className = 'grafana-modal-close';
        closeButton.style.cssText = `
            background: transparent;
            border: none;
            font-size: 28px;
            color: #666666;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s ease;
        `;
        closeButton.onmouseover = () => {
            closeButton.style.background = '#e1e5e9';
            closeButton.style.color = '#333333';
        };
        closeButton.onmouseout = () => {
            closeButton.style.background = 'transparent';
            closeButton.style.color = '#666666';
        };
        closeButton.onclick = () => this.close();
        closeButton.title = 'Close (Esc)';

        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        // Create iframe container
        const iframeContainer = document.createElement('div');
        iframeContainer.className = 'grafana-modal-body';
        iframeContainer.style.cssText = `
            flex: 1;
            overflow: hidden;
            position: relative;
            background: #f8f9fa;
        `;

        // Create loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'grafana-modal-loading';
        loadingIndicator.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #666666;
            font-size: 14px;
        `;
        loadingIndicator.innerHTML = `
            <div style="margin-bottom: 12px;">
                <div style="width: 40px; height: 40px; border: 4px solid #e1e5e9; border-top-color: #0067C5; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
            Loading Grafana Dashboard...
        `;

        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.src = dashboardUrl;
        iframe.className = 'grafana-modal-iframe';
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            background: #ffffff;
            display: none;
        `;

        // Show iframe when loaded, hide loading indicator
        let iframeLoadedSuccessfully = false;
        iframe.onload = () => {
            // Don't hide loading yet - wait for timeout to verify it's not X-Frame-Options blocked
            setTimeout(() => {
                try {
                    // Try to access iframe content
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc && iframeDoc.body) {
                        // Successfully loaded
                        loadingIndicator.style.display = 'none';
                        iframe.style.display = 'block';
                        iframeLoadedSuccessfully = true;
                        console.log('✅ Grafana dashboard loaded in modal');
                    } else {
                        this.showEmbeddingError(loadingIndicator, dashboardUrl);
                    }
                } catch (e) {
                    // X-Frame-Options blocking detected
                    this.showEmbeddingError(loadingIndicator, dashboardUrl);
                }
            }, 500); // Short delay to let iframe content initialize
        };

        // Handle iframe load errors
        iframe.onerror = () => {
            this.showEmbeddingError(loadingIndicator, dashboardUrl);
        };
        
        // Final fallback: detect if still loading after 10 seconds
        setTimeout(() => {
            if (!iframeLoadedSuccessfully && loadingIndicator.style.display !== 'none') {
                this.showEmbeddingError(loadingIndicator, dashboardUrl);
            }
        }, 10000);

        iframeContainer.appendChild(loadingIndicator);
        iframeContainer.appendChild(iframe);

        // Assemble modal
        modalContainer.appendChild(modalHeader);
        modalContainer.appendChild(iframeContainer);
        this.overlay.appendChild(modalContainer);

        // Add click-outside-to-close handler
        this.overlay.onclick = (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        };

        // Add to DOM
        document.body.appendChild(this.overlay);
        this.isOpen = true;

        // Add ESC key handler
        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.escHandler);

        // Prevent body scrolling while modal is open
        document.body.style.overflow = 'hidden';

        console.log('📊 Grafana dashboard modal opened:', dashboardUrl);
    }

    /**
     * Show embedding error with option to open in new tab
     */
    showEmbeddingError(loadingIndicator, dashboardUrl) {
        loadingIndicator.innerHTML = `
            <div style="color: #dc3545; max-width: 500px;">
                <strong>⚠️ Dashboard Embedding Blocked</strong><br>
                <small style="color: #666; display: block; margin: 12px 0;">
                    Grafana is configured to prevent iframe embedding (X-Frame-Options: deny).<br>
                    To enable embedding, set <code>allow_embedding = true</code> in grafana.ini
                </small>
                <button id="openInNewTabBtn" style="
                    background: #0067C5;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    margin-top: 8px;
                ">
                    🔗 Open Dashboard in New Tab
                </button>
            </div>
        `;
        
        // Add click handler to button
        const openBtn = document.getElementById('openInNewTabBtn');
        if (openBtn) {
            openBtn.onclick = () => {
                window.open(dashboardUrl, '_blank');
                this.close();
            };
            openBtn.onmouseover = () => {
                openBtn.style.background = '#0056a3';
            };
            openBtn.onmouseout = () => {
                openBtn.style.background = '#0067C5';
            };
        }
    }

    /**
     * Close the modal
     */
    close() {
        if (!this.isOpen || !this.overlay) {
            return;
        }

        // Add fade-out animation
        this.overlay.style.animation = 'fadeOut 0.2s ease-out';
        
        // Remove after animation
        setTimeout(() => {
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            this.overlay = null;
            this.isOpen = false;

            // Restore body scrolling
            document.body.style.overflow = '';

            // Remove ESC key handler
            if (this.escHandler) {
                document.removeEventListener('keydown', this.escHandler);
                this.escHandler = null;
            }

            console.log('✅ Grafana dashboard modal closed');
        }, 200);
    }

    /**
     * Check if modal is currently open
     * @returns {boolean}
     */
    isModalOpen() {
        return this.isOpen;
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }

    @keyframes slideIn {
        from { 
            transform: translateY(-50px);
            opacity: 0;
        }
        to { 
            transform: translateY(0);
            opacity: 1;
        }
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Make globally available
window.GrafanaDashboardModal = GrafanaDashboardModal;
