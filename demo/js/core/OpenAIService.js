/**
 * Centralized OpenAI Service
 * 
 * Provides a unified interface for all OpenAI API interactions across the demo.
 * Features:
 * - Single config load from chatgpt-config.json
 * - HTTP client singleton with connection reuse
 * - Adaptive rate limiting (only when needed)
 * - Centralized error handling
 * - Request metrics and logging
 * - Mock mode support for testing without API keys
 */
class OpenAIService {
    constructor() {
        this.config = null;
        this.mockMode = false;
        this.lastCallTime = 0;
        this.minCallInterval = 1000; // 1 second when rate limiting is enabled
        this.rateLimitEnabled = false; // Disabled by default - only enable when we get 429s
        this.lastRateLimitTime = 0; // Track when we last got rate limited
        this.rateLimitDisableDelay = 120000; // Disable after 2 minutes without rate limits
        this.requestMetrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalDuration: 0,
            rateLimitHits: 0
        };
    }

    /**
     * Initialize the service by loading configuration
     */
    async initialize() {
        try {
            const configUrl = `./chatgpt-config.json?v=${Date.now()}`;
            console.log('🔍 [OpenAIService] Loading config from:', configUrl);
            
            const response = await fetch(configUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const rawConfig = await response.json();
            
            // Support both formats: {api_key: ...} and {OPENAI_API_KEY: ...}
            const apiKey = rawConfig.api_key || rawConfig.OPENAI_API_KEY;
            const baseURL = rawConfig.base_url || rawConfig.OPENAI_API_BASE_URL || 'https://api.openai.com/v1';
            const model = rawConfig.model || rawConfig.NETAPP_MODEL || 'gpt-4o';
            const user = rawConfig.NETAPP_USER || rawConfig.user || 'anonymous';
            
            // Validate API key
            if (!apiKey || apiKey === 'YOUR_CHATGPT_API_KEY_HERE') {
                throw new Error('No valid ChatGPT API key configured');
            }
            
            // Normalize config to internal format
            this.config = {
                api_key: apiKey,
                base_url: baseURL,
                model: model,
                user: user,
                max_completion_tokens: rawConfig.max_completion_tokens || 2000
            };
            
            this.mockMode = false;
            console.log('✅ [OpenAIService] Initialized successfully');
            console.log(`   Base URL: ${this.config.base_url}`);
            console.log(`   Model: ${this.config.model}`);
            console.log(`   User: ${this.config.user}`);
            
        } catch (error) {
            console.warn('⚠️ [OpenAIService] Config load failed, enabling mock mode:', error.message);
            this.mockMode = true;
            this.config = {
                api_key: 'mock-key',
                base_url: 'https://api.openai.com/v1',
                model: 'mock-gpt-4o',
                user: 'anonymous',
                max_completion_tokens: 2000
            };
        }
    }

    /**
     * Call OpenAI Chat Completions API
     * 
     * @param {Object} options - Request options
     * @param {string} options.component - Component name for logging/metrics
     * @param {Array} options.messages - Array of message objects {role, content}
     * @param {string} [options.model] - Model to use (defaults to config model)
     * @param {number} [options.max_completion_tokens] - Max tokens in response
     * @param {number} [options.temperature] - Temperature (0-2)
     * @param {Array} [options.tools] - Array of tool definitions for function calling
     * @param {string|Object} [options.tool_choice] - Tool choice strategy ('auto', 'none', or specific tool)
     * @param {boolean} [options.parallel_tool_calls] - Allow parallel tool calls
     * @param {Object} [options.extra] - Additional parameters to pass through
     * @returns {Promise<Object>} OpenAI API response
     */
    async callChatCompletion(options) {
        if (this.mockMode) {
            throw new Error('OpenAI service is in mock mode - no API key configured');
        }

        const requestId = this._generateRequestId();
        const component = options.component || 'unknown';
        
        // Enforce global rate limit
        await this._enforceRateLimit();
        
        // Build request payload
        const payload = {
            model: options.model || this.config.model,
            user: this.config.user,
            messages: options.messages,
            max_completion_tokens: options.max_completion_tokens || this.config.max_completion_tokens,
            temperature: options.temperature !== undefined ? options.temperature : 1.0,
            ...options.extra
        };

        // Add tools if provided (for function calling)
        if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
            payload.tools = options.tools;
            payload.tool_choice = options.tool_choice || 'auto';
            if (options.parallel_tool_calls !== undefined) {
                payload.parallel_tool_calls = options.parallel_tool_calls;
            }
        }

        // Log request
        console.log(`🔵 [OpenAIService] Request ${requestId}:`, {
            component,
            model: payload.model,
            messageCount: payload.messages.length,
            hasTools: !!payload.tools,
            toolCount: payload.tools?.length || 0,
            maxTokens: payload.max_completion_tokens,
            temperature: payload.temperature
        });

        const startTime = performance.now();
        this.requestMetrics.totalRequests++;

        try {
            const response = await fetch(`${this.config.base_url}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.api_key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const duration = performance.now() - startTime;

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // Handle rate limit errors specifically
                if (response.status === 429) {
                    this.requestMetrics.failedRequests++;
                    this.requestMetrics.rateLimitHits++;
                    this.lastRateLimitTime = Date.now();
                    
                    // Enable adaptive rate limiting
                    if (!this.rateLimitEnabled) {
                        this.rateLimitEnabled = true;
                        console.warn('⚠️ [OpenAIService] Rate limit detected - enabling adaptive rate limiting (1 sec between calls)');
                    }
                    
                    throw new Error(`Rate limit exceeded. Please wait a moment and try again. The system made too many requests to OpenAI in a short time.`);
                }
                
                this.requestMetrics.failedRequests++;
                throw new Error(`OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            
            this.requestMetrics.successfulRequests++;
            this.requestMetrics.totalDuration += duration;

            console.log(`🟢 [OpenAIService] Response ${requestId}: ${duration.toFixed(0)}ms`, {
                component,
                finishReason: data.choices?.[0]?.finish_reason,
                hasToolCalls: !!data.choices?.[0]?.message?.tool_calls,
                toolCallCount: data.choices?.[0]?.message?.tool_calls?.length || 0
            });

            return data;

        } catch (error) {
            const duration = performance.now() - startTime;
            console.error(`🔴 [OpenAIService] Error ${requestId} (${duration.toFixed(0)}ms):`, error.message);
            throw error;
        }
    }

    /**
     * Enforce adaptive rate limiting across all components
     * 
     * Rate limiting is disabled by default for maximum performance.
     * It's automatically enabled when we receive a 429 (rate limit) response.
     * It's automatically disabled after 2 minutes without any rate limit errors.
     */
    async _enforceRateLimit() {
        const now = Date.now();
        
        // Check if we should disable rate limiting (2 minutes without rate limits)
        if (this.rateLimitEnabled && this.lastRateLimitTime > 0) {
            const timeSinceLastRateLimit = now - this.lastRateLimitTime;
            if (timeSinceLastRateLimit > this.rateLimitDisableDelay) {
                this.rateLimitEnabled = false;
                console.log('✅ [OpenAIService] No rate limits for 2 minutes - disabling rate limiting for max performance');
            }
        }
        
        // Only enforce delay if rate limiting is enabled
        if (this.rateLimitEnabled) {
            const timeSinceLastCall = now - this.lastCallTime;
            
            if (timeSinceLastCall < this.minCallInterval) {
                const waitTime = this.minCallInterval - timeSinceLastCall;
                console.log(`⏱️ [OpenAIService] Adaptive rate limit: waiting ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        this.lastCallTime = Date.now();
    }

    /**
     * Generate unique request ID for tracking
     */
    _generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if service is in mock mode
     */
    isMockMode() {
        return this.mockMode;
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return this.config;
    }

    /**
     * Get request metrics
     */
    getMetrics() {
        return {
            ...this.requestMetrics,
            averageDuration: this.requestMetrics.totalRequests > 0 
                ? this.requestMetrics.totalDuration / this.requestMetrics.totalRequests 
                : 0,
            successRate: this.requestMetrics.totalRequests > 0
                ? (this.requestMetrics.successfulRequests / this.requestMetrics.totalRequests) * 100
                : 0,
            rateLimitEnabled: this.rateLimitEnabled,
            timeSinceLastRateLimit: this.lastRateLimitTime > 0 
                ? Math.round((Date.now() - this.lastRateLimitTime) / 1000)
                : null
        };
    }

    /**
     * Log current metrics (useful for debugging)
     */
    logMetrics() {
        const metrics = this.getMetrics();
        console.log('📊 [OpenAIService] Metrics:', {
            total: metrics.totalRequests,
            successful: metrics.successfulRequests,
            failed: metrics.failedRequests,
            rateLimitHits: metrics.rateLimitHits,
            avgDuration: `${metrics.averageDuration.toFixed(0)}ms`,
            successRate: `${metrics.successRate.toFixed(1)}%`,
            rateLimitEnabled: metrics.rateLimitEnabled,
            timeSinceLastRateLimit: metrics.timeSinceLastRateLimit ? `${metrics.timeSinceLastRateLimit}s ago` : 'never'
        });
    }
}

// Create singleton instance
if (!window.openAIService) {
    window.openAIService = new OpenAIService();
    console.log('🔧 [OpenAIService] Singleton instance created');
}
