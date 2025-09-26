/**
 * NetApp ONTAP MCP Demo Toast Notifications
 * 
 * Handles all toast notification display and management
 */
class ToastNotifications {
    constructor() {
        this.injectStyles();
    }

    /**
     * Inject toast notification styles
     */
    injectStyles() {
        // Check if styles are already injected
        if (document.getElementById('toast-styles')) return;

        const toastStyles = `
            .toast-message {
                position: fixed;
                top: 80px;
                right: 24px;
                z-index: 3000;
                min-width: 300px;
                max-width: 500px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: slideInFromRight 0.3s ease-out;
            }

            .toast-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                gap: 12px;
            }

            .toast-close {
                font-size: 18px;
                color: inherit;
                opacity: 0.7;
                padding: 2px 6px;
                border-radius: 3px;
                transition: opacity 0.2s;
                cursor: pointer;
                border: none;
                background: none;
            }

            .toast-close:hover {
                opacity: 1;
            }

            .toast-error {
                background-color: var(--notification-error);
                color: white;
            }

            .toast-success {
                background-color: var(--notification-success);
                color: white;
            }

            .toast-warning {
                background-color: var(--notification-warning);
                color: white;
            }

            .toast-info {
                background-color: var(--notification-information);
                color: white;
            }

            @keyframes slideInFromRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutToRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            .toast-message.removing {
                animation: slideOutToRight 0.3s ease-in;
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.id = 'toast-styles';
        styleSheet.textContent = toastStyles;
        document.head.appendChild(styleSheet);
    }

    /**
     * Show a toast message
     * @param {string} message - Message to display
     * @param {string} type - Type of message (info, success, warning, error)
     * @param {number} duration - Duration in milliseconds (0 = no auto-close)
     */
    showMessage(message, type = 'info', duration = 5000) {
        // Remove existing message
        const existing = document.querySelector('.toast-message');
        if (existing) {
            this.removeToast(existing);
        }

        // Create toast message
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span>${DemoUtils.escapeHtml(message)}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add close button functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeToast(toast);
        });

        // Add click to dismiss
        toast.addEventListener('click', () => {
            this.removeToast(toast);
        });

        // Add to page
        document.body.appendChild(toast);

        // Auto remove after specified duration
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    this.removeToast(toast);
                }
            }, duration);
        }

        return toast;
    }

    /**
     * Remove a toast with animation
     * @param {HTMLElement} toast - Toast element to remove
     */
    removeToast(toast) {
        if (!toast || !toast.parentElement) return;

        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300); // Match animation duration
    }

    /**
     * Show an error message
     * @param {string} message - Error message
     * @param {number} duration - Duration in milliseconds
     */
    showError(message, duration = 7000) {
        return this.showMessage(message, 'error', duration);
    }

    /**
     * Show a success message
     * @param {string} message - Success message
     * @param {number} duration - Duration in milliseconds
     */
    showSuccess(message, duration = 5000) {
        return this.showMessage(message, 'success', duration);
    }

    /**
     * Show a warning message
     * @param {string} message - Warning message
     * @param {number} duration - Duration in milliseconds
     */
    showWarning(message, duration = 6000) {
        return this.showMessage(message, 'warning', duration);
    }

    /**
     * Show an info message
     * @param {string} message - Info message
     * @param {number} duration - Duration in milliseconds
     */
    showInfo(message, duration = 4000) {
        return this.showMessage(message, 'info', duration);
    }

    /**
     * Clear all toast messages
     */
    clearAll() {
        const toasts = document.querySelectorAll('.toast-message');
        toasts.forEach(toast => this.removeToast(toast));
    }

    /**
     * Show a loading message (no auto-close)
     * @param {string} message - Loading message
     * @returns {HTMLElement} Toast element (call removeToast to close)
     */
    showLoading(message) {
        return this.showMessage(message, 'info', 0);
    }

    /**
     * Show a persistent message (no auto-close)
     * @param {string} message - Message to display
     * @param {string} type - Type of message
     * @returns {HTMLElement} Toast element (call removeToast to close)
     */
    showPersistent(message, type = 'info') {
        return this.showMessage(message, type, 0);
    }
}

// Export for use in other modules
window.ToastNotifications = ToastNotifications;