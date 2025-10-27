/**
 * Centralized Debug Logger
 * 
 * Controls debug output across the application.
 * Can be enabled/disabled via:
 * 1. localStorage.setItem('MCP_DEBUG', 'true')
 * 2. URL parameter: ?debug=true
 * 3. window.MCP_DEBUG = true
 */
class DebugLogger {
    constructor() {
        this.enabled = this.isDebugEnabled();
        
        // Expose globally for easy console toggling
        window.MCP_DEBUG = this.enabled;
        
        if (this.enabled) {
            console.log('🐛 Debug logging enabled');
            console.log('   To disable: localStorage.setItem("MCP_DEBUG", "false") or reload without ?debug');
        }
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugEnabled() {
        // Check URL parameter first
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('debug')) {
            const value = urlParams.get('debug');
            return value !== 'false' && value !== '0';
        }

        // Check localStorage
        const storedValue = localStorage.getItem('MCP_DEBUG');
        if (storedValue !== null) {
            return storedValue === 'true' || storedValue === '1';
        }

        // Check global window variable
        if (typeof window.MCP_DEBUG !== 'undefined') {
            return window.MCP_DEBUG === true;
        }

        // Default: disabled
        return false;
    }

    /**
     * Log a debug message (only if debug enabled)
     */
    log(...args) {
        if (this.enabled) {
            console.log(...args);
        }
    }

    /**
     * Log an info message (always shown)
     */
    info(...args) {
        console.log(...args);
    }

    /**
     * Log a warning message (always shown)
     */
    warn(...args) {
        console.warn(...args);
    }

    /**
     * Log an error message (always shown)
     */
    error(...args) {
        console.error(...args);
    }

    /**
     * Enable debug logging
     */
    enable() {
        this.enabled = true;
        window.MCP_DEBUG = true;
        localStorage.setItem('MCP_DEBUG', 'true');
        console.log('🐛 Debug logging enabled');
    }

    /**
     * Disable debug logging
     */
    disable() {
        this.enabled = false;
        window.MCP_DEBUG = false;
        localStorage.setItem('MCP_DEBUG', 'false');
        console.log('🐛 Debug logging disabled');
    }
}

// Create singleton instance
const debugLogger = new DebugLogger();

// Expose globally for console access
window.debugLogger = debugLogger;
