/**
 * NetApp ONTAP MCP Demo Utilities
 * 
 * Shared utility functions used across components
 */
class DemoUtils {
    /**
     * Escape HTML to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Sanitize volume name for ONTAP compatibility
     * @param {string} volumeName - Original volume name
     * @returns {string} Sanitized volume name
     */
    static sanitizeVolumeName(volumeName) {
        // ONTAP only allows alphanumeric and underscores
        return volumeName.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    /**
     * Validate volume name
     * @param {string} volumeName - Volume name to validate
     * @returns {{valid: boolean, message?: string}} Validation result
     */
    static validateVolumeName(volumeName) {
        if (!volumeName || volumeName.trim() === '') {
            return { valid: false, message: 'Volume name is required' };
        }

        if (volumeName.length < 1 || volumeName.length > 203) {
            return { valid: false, message: 'Volume name must be between 1 and 203 characters' };
        }

        if (!/^[a-zA-Z0-9_]+$/.test(volumeName)) {
            return { valid: false, message: 'Volume name can only contain letters, numbers, and underscores' };
        }

        return { valid: true };
    }

    /**
     * Validate volume size
     * @param {string} size - Size string (e.g., "100GB", "1TB")
     * @returns {{valid: boolean, message?: string}} Validation result
     */
    static validateVolumeSize(size) {
        if (!size || size.trim() === '') {
            return { valid: false, message: 'Volume size is required' };
        }

        const sizePattern = /^(\d+(?:\.\d+)?)\s*(MB|GB|TB)$/i;
        if (!sizePattern.test(size)) {
            return { valid: false, message: 'Size must be in format like "100MB", "1GB", or "1TB"' };
        }

        const match = size.match(sizePattern);
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();

        // Convert to MB for validation
        let sizeInMB = value;
        if (unit === 'GB') sizeInMB *= 1024;
        if (unit === 'TB') sizeInMB *= 1024 * 1024;

        if (sizeInMB < 1) {
            return { valid: false, message: 'Volume size must be at least 1MB' };
        }

        return { valid: true };
    }

    /**
     * Validate IP address
     * @param {string} ip - IP address to validate
     * @returns {{valid: boolean, message?: string}} Validation result
     */
    static validateIpAddress(ip) {
        if (!ip || ip.trim() === '') {
            return { valid: false, message: 'IP address is required' };
        }

        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipPattern.test(ip)) {
            return { valid: false, message: 'Invalid IP address format' };
        }

        const parts = ip.split('.');
        for (const part of parts) {
            const num = parseInt(part);
            if (num < 0 || num > 255) {
                return { valid: false, message: 'IP address octets must be between 0 and 255' };
            }
        }

        return { valid: true };
    }

    /**
     * Generate a unique ID
     * @returns {string} Unique ID
     */
    static generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    /**
     * Format bytes to human readable size
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Wait for a specified amount of time
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise} Promise that resolves after the specified time
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Deep clone an object
     * @param {object} obj - Object to clone
     * @returns {object} Cloned object
     */
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Check if element exists in DOM
     * @param {string} selector - CSS selector
     * @returns {boolean} True if element exists
     */
    static elementExists(selector) {
        return document.querySelector(selector) !== null;
    }

    /**
     * Wait for element to exist in DOM
     * @param {string} selector - CSS selector
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Element>} Promise that resolves when element exists
     */
    static waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    /**
     * Create a loading spinner element
     * @param {string} message - Loading message
     * @returns {HTMLElement} Loading element
     */
    static createLoadingElement(message = 'Loading...') {
        const div = document.createElement('div');
        div.className = 'loading-row';
        div.innerHTML = `
            <div class="loading-spinner"></div>
            <span>${this.escapeHtml(message)}</span>
        `;
        return div;
    }

    /**
     * Emit a custom event
     * @param {string} eventName - Name of the event
     * @param {any} detail - Event detail data
     * @param {Element} target - Target element (default: document)
     */
    static emit(eventName, detail, target = document) {
        const event = new CustomEvent(eventName, { detail });
        target.dispatchEvent(event);
    }

    /**
     * Listen for custom events
     * @param {string} eventName - Name of the event
     * @param {Function} handler - Event handler
     * @param {Element} target - Target element (default: document)
     */
    static on(eventName, handler, target = document) {
        target.addEventListener(eventName, handler);
    }

    /**
     * Remove event listener
     * @param {string} eventName - Name of the event
     * @param {Function} handler - Event handler
     * @param {Element} target - Target element (default: document)
     */
    static off(eventName, handler, target = document) {
        target.removeEventListener(eventName, handler);
    }
}

// Export for use in other modules
window.DemoUtils = DemoUtils;