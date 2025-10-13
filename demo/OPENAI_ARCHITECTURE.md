# OpenAI Integration Architecture

**Current Implementation - October 2025**

This document describes the centralized OpenAI service architecture used across all LLM-powered features in the NetApp ONTAP MCP Demo.

## Overview

All OpenAI API interactions are centralized through a singleton `OpenAIService` that provides:
- Single configuration load
- HTTP client reuse with connection pooling
- Global rate limiting (1 second between calls)
- Centralized error handling
- Request metrics and logging
- Consistent mock mode support

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   chatgpt-config.json                       │
│  { api_key, base_url, model, user, max_completion_tokens } │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Loaded once at initialization
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenAIService (Singleton)                       │
│                                                              │
│  • Config Management                                         │
│  • HTTP Client (connection reuse)                           │
│  • Global Rate Limiter (1 sec minimum)                      │
│  • Request Metrics (total, success, failed, duration)       │
│  • Mock Mode Detection                                       │
│                                                              │
│  callChatCompletion({                                        │
│    component, messages, temperature,                         │
│    max_completion_tokens, tools, tool_choice                │
│  })                                                          │
└───────┬──────────────────────┬──────────────────────────────┘
        │                      │
        │                      │
        ▼                      ▼
┌─────────────────┐    ┌──────────────────────┐    ┌────────────────────────┐
│ ChatbotAssistant│◄───│StorageClassProvisioning    │CorrectiveActionParser│
│                 │    │        Panel           │    │                      │
│ • Conversation  │    │                        │    │ • Alert parsing      │
│ • 67 MCP tools  │    │ • Uses chatbot         │    │ • Fix-It actions     │
│ • Function calls│    │ • Natural language     │    │ • JSON extraction    │
│ • Temp: 1.0     │    │ • Full tool access     │    │ • Temp: 0.1          │
│ • Max: 4000     │    │                        │    │ • Max: 2000          │
└────────┬────────┘    └────────────────────────┘    └──────────┬───────────┘
         │                                                       │
         └───────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  OpenAI API         │
                    │  (LLM Proxy)        │
                    │  gpt-4.1            │
                    └─────────────────────┘
```

## Component Details

### 1. OpenAIService (`demo/js/core/OpenAIService.js`)

**Role**: Central coordinator for all OpenAI API interactions

**Purpose**: Centralized singleton service for all OpenAI API interactions.

**Key Features**:
- **Single Config Load**: Loads `chatgpt-config.json` once at initialization
- **Connection Pooling**: Reuses HTTP connections via singleton pattern
- **Adaptive Rate Limiting**: Only enforces delays when rate limits are encountered
  - Disabled by default for maximum performance
  - Automatically enabled on first 429 (rate limit) response
  - Automatically disabled after 2 minutes without rate limits
  - 1-second minimum between calls when enabled
- **Request Tracking**: Maintains metrics for monitoring including rate limit hits
- **Error Handling**: Centralized error processing with specific rate-limit detection
- **Mock Mode**: Automatic fallback when no API key configured

**API**:
```javascript
// Initialize (called once at app startup)
await window.openAIService.initialize();

// Make API call
const response = await window.openAIService.callChatCompletion({
    component: 'ComponentName',      // For logging/metrics
    messages: [...],                 // OpenAI message format
    temperature: 0.7,                // 0-2 (default: 1.0)
    max_completion_tokens: 2000,     // Token budget
    tools: [...],                    // Optional: MCP tools for function calling
    tool_choice: 'auto',             // Optional: 'auto', 'none', or specific tool
    parallel_tool_calls: false       // Optional: allow parallel tool execution
});

// Get metrics
const metrics = window.openAIService.getMetrics();
// Returns: { totalRequests, successfulRequests, failedRequests, rateLimitHits,
//            totalDuration, averageDuration, successRate,
//            rateLimitEnabled, timeSinceLastRateLimit }
```

**Configuration Format** (`chatgpt-config.json`):
```json
{
  "api_key": "sk_...",
  "base_url": "https://llm-proxy-api.ai.openeng.netapp.com",
  "model": "gpt-4.1",
  "user": "username",
  "max_completion_tokens": 2000
}
```

### 2. ChatbotAssistant (`demo/js/components/ChatbotAssistant.js`)

**Purpose**: Interactive conversational AI assistant for ONTAP provisioning.

**OpenAI Integration**:
- **Usage Pattern**: Multi-turn conversations with function calling
- **Temperature**: 1.0 (creative, varied responses)
- **Max Tokens**: 4000 (generous budget for complex conversations)
- **Tools**: All 67 MCP tools (51 ONTAP + 16 Harvest) exposed via function calling
- **Tool Strategy**: Sequential execution (`parallel_tool_calls: false`)
- **Pass System**: Two-pass approach - Pass 1 for tool execution, Pass 2 for answer generation

**Key Methods**:
```javascript
// Initial user message
await getChatGPTResponse(message)

// After tool execution
await getChatGPTResponseWithToolResults(originalMessage, toolCalls, toolResults, depth)

// Force final answer (Pass 2)
await generateFinalAnswer(originalMessage)
```

**Conversation Management**:
- Maintains full conversation history (`conversationThread`)
- System prompt loaded from `CHATBOT_SYSTEM_PROMPT.md`
- Tracks tool call frequency to detect loops
- Maximum recursion depth: 25 tool calls

### 3. StorageClassProvisioningPanel (`demo/js/components/StorageClassProvisioningPanel.js`)

**Purpose**: Storage class-based provisioning with AI placement recommendations.

**OpenAI Integration**:
- **Usage Pattern**: Uses ChatbotAssistant delegation (via `chatbot.sendMessage()`)
- **Approach**: Natural language query with full MCP tool access
- **Prompt**: Simple question letting chatbot use its tools to investigate clusters

**Workflow**:
1. User selects storage class (bronze/silver/gold) and volume size
2. Clicks "Recommend..." button
3. Sends natural language query: "Where is the best place to provision a {size} {protocol} volume using my {storageClass} storage class?"
4. Chatbot uses MCP tools to query clusters, SVMs, aggregates, snapshot policies, etc.
5. Chatbot responds with JSON: `{ cluster, svm, aggregate, reasoning }`
6. Form auto-populated with recommended values
7. User sees reasoning in notification

**Key Methods**:
```javascript
async getRecommendation()
// Delegates to chatbot.sendMessage() with natural language prompt

parseRecommendation(response)
// Extracts { cluster, svm, aggregate, reasoning, qos_policy, snapshot_policy }
```

**Why Chatbot Integration**:
- **Smart**: Can query snapshot policies to find which cluster has the required policy
- **Complete**: Has access to all 67 MCP tools for intelligent placement
- **Contextual**: Knows cluster configurations, capacity, and policies
- **Flexible**: Adapts to changing cluster configurations automatically

### 4. CorrectiveActionParser (`demo/js/components/CorrectiveActionParser.js`)

**Purpose**: Parses alert corrective actions into structured Fix-It recommendations.

**OpenAI Integration**:
- **Usage Pattern**: Single-shot JSON extraction
- **Temperature**: 0.1 (consistent, deterministic parsing)
- **Max Tokens**: 2000 (sufficient for structured output)
- **Tools**: None (direct text-to-JSON conversion)
- **Approach**: One API call per alert with strict JSON schema prompt

**Key Method**:
```javascript
async parseCorrectiveActions(correctiveActionText, alertContext)
// Returns: { description, remediation_options: [...] }
```

**System Prompt Strategy**:
- Provides alert context (cluster, volume, metric values)
- Lists available MCP tools dynamically
- Enforces strict JSON schema for Fix-It UI compatibility
- Includes example outputs for consistency

## Initialization Sequence

```javascript
// 1. App startup (app.js)
document.addEventListener('DOMContentLoaded', async () => {
    const app = new OntapMcpDemo();
    await app.init();
});

// 2. Components initialize (parallel)
async init() {
    // OpenAI service auto-initializes on first use via singleton
    // ChatbotAssistant initialization
    chatbot = new ChatbotAssistant(app);
    // → calls window.openAIService.initialize() if not already initialized
    
    // CorrectiveActionParser initialization  
    window.correctiveActionParser = new CorrectiveActionParser();
    await window.correctiveActionParser.initWithConfig(clientManager);
    // → reuses window.openAIService (already initialized)
}
```

## Rate Limiting Strategy

**Adaptive Rate Limiting**: Disabled by default, enabled only when needed

**Why Adaptive?**
- **Performance First**: No artificial delays when using LLM Proxy (which typically doesn't rate limit)
- **Auto-Enable**: Activates on first 429 (rate limit) response
- **Auto-Disable**: Turns off after 2 minutes without rate limit errors
- **Shared Across Components**: All components benefit from coordinated rate limit management

**Behavior**:
- **Default**: Rate limiting OFF - maximum performance
- **On 429 Error**: Automatically enabled with 1-second minimum between calls
- **After 2 Minutes**: If no rate limits detected, disabled again for max performance
- **Prevents**: Multiple components from triggering rate limits simultaneously

**Implementation**:
```javascript
async _enforceRateLimit() {
    const now = Date.now();
    
    // Auto-disable if 2 minutes without rate limits
    if (this.rateLimitEnabled && this.lastRateLimitTime > 0) {
        const timeSinceLastRateLimit = now - this.lastRateLimitTime;
        if (timeSinceLastRateLimit > 120000) { // 2 minutes
            this.rateLimitEnabled = false;
            console.log('✅ No rate limits for 2 minutes - disabling for max performance');
        }
    }
    
    // Only enforce delay if rate limiting is enabled
    if (this.rateLimitEnabled) {
        const timeSinceLastCall = now - this.lastCallTime;
        if (timeSinceLastCall < this.minCallInterval) {
            const waitTime = this.minCallInterval - timeSinceLastCall;
            console.log(`⏱️ Adaptive rate limit: waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    
    this.lastCallTime = Date.now();
}

// Auto-enable on 429 response
if (response.status === 429) {
    this.lastRateLimitTime = Date.now();
    if (!this.rateLimitEnabled) {
        this.rateLimitEnabled = true;
        console.warn('⚠️ Rate limit detected - enabling adaptive rate limiting');
    }
}
```

## Request Tracking & Metrics

**Tracked Metrics**:
- `totalRequests`: All API calls attempted
- `successfulRequests`: HTTP 200 responses
- `failedRequests`: Errors (network, API, rate limits)
- `rateLimitHits`: Number of 429 responses received
- `totalDuration`: Cumulative response time
- `averageDuration`: Mean response time per request
- `successRate`: Percentage of successful calls
- `rateLimitEnabled`: Current adaptive rate limiting state (true/false)
- `timeSinceLastRateLimit`: Seconds since last 429 error (null if never)

**Console Logging**:
```
🔵 [OpenAIService] Request req_1234_xyz: {
  component: 'ChatbotAssistant',
  model: 'gpt-4.1',
  messageCount: 5,
  hasTools: true,
  toolCount: 67
}

🟢 [OpenAIService] Response req_1234_xyz: 1234ms {
  component: 'ChatbotAssistant',
  finishReason: 'tool_calls',
  toolCallCount: 2
}
```

**View Metrics**:
```javascript
// Console
window.openAIService.logMetrics();

// Programmatic
const metrics = window.openAIService.getMetrics();
```

## Mock Mode

**Triggered When**:
- No API key in `chatgpt-config.json`
- API key is placeholder value `YOUR_CHATGPT_API_KEY_HERE`
- Config file load fails

**Behavior**:
- Service initializes with mock configuration
- `isMockMode()` returns `true`
- API calls throw error: "OpenAI service is in mock mode"
- Components fall back to hardcoded responses (if implemented)

**Detection**:
```javascript
if (window.openAIService.isMockMode()) {
    console.warn('⚠️ Running in mock mode - no API key');
    // Use fallback logic
}
```

## Error Handling

**Rate Limit Errors (HTTP 429)**:
```javascript
if (response.status === 429) {
    throw new Error('Rate limit exceeded. Please wait a moment and try again.');
}
```

**Network/API Errors**:
```javascript
throw new Error(`OpenAI API error: ${response.status} ${errorMessage}`);
```

**Metrics Update**:
- Successful calls increment `successfulRequests`
- Failed calls increment `failedRequests`
- Both update `totalDuration` for timing analysis

## File Structure

```
demo/
├── js/
│   ├── core/
│   │   └── OpenAIService.js                     # Centralized singleton service
│   └── components/
│       ├── ChatbotAssistant.js                  # Conversational AI (direct use)
│       ├── CorrectiveActionParser.js            # Alert parsing (direct use)
│       └── StorageClassProvisioningPanel.js     # Storage classes (via chatbot)
├── chatgpt-config.json                          # LLM configuration
├── CHATBOT_SYSTEM_PROMPT.md                     # Chatbot instructions
└── test/
    └── test-openai-service.html                 # Service testing interface
```

## Testing

**Standalone Service Tests**: `http://localhost:8080/test/test-openai-service.html`

Tests cover:
1. Service initialization
2. Configuration loading (mock mode detection)
3. Simple API call (connectivity)
4. Rate limiting (3 sequential calls)
5. Metrics tracking (success rate, avg duration)

**Integration Testing**:
- **Chatbot**: Send message in main demo, verify tool calls in console
- **Fix-It**: Click Fix-It button on alert, verify corrective actions parse correctly

## Configuration Notes

**LLM Proxy vs Direct OpenAI**:
- Current: NetApp LLM Proxy (`https://llm-proxy-api.ai.openeng.netapp.com`)
- Model: `gpt-4.1` (NetApp-specific)
- Alternative: Set `base_url` to `https://api.openai.com/v1` for direct OpenAI access

**API Key Management**:
- Stored in `chatgpt-config.json` (gitignored)
- Never committed to repository
- User-specific configuration

**Model Selection**:
- Default: `gpt-4.1` (NetApp proxy)
- Alternative: `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`
- Configured per user in config file

## Benefits of Centralized Architecture

1. **Single Config Load**: One file read, shared across all components
2. **Connection Pooling**: HTTP client reuse reduces overhead
3. **Global Rate Limiting**: Prevents rate limit errors across components
4. **Unified Error Handling**: Consistent error messages and recovery
5. **Request Metrics**: Track API usage, performance, success rates
6. **Mock Mode Consistency**: All components handle missing API key uniformly
7. **Maintainability**: Changes to OpenAI integration in one place
8. **Debugging**: Centralized logging with request tracking

## Maintenance

**Adding New Components**:
1. Import and use `window.openAIService` (already initialized)
2. Call `callChatCompletion()` with component-specific parameters
3. Handle errors (service throws on API failures)
4. Mock mode handled automatically by service

**Updating Configuration**:
1. Edit `demo/chatgpt-config.json`
2. Reload demo page (config loaded at startup)
3. No code changes required

**Monitoring Usage**:
```javascript
// View current metrics
window.openAIService.getMetrics()

// Log to console
window.openAIService.logMetrics()
```

## Security Considerations

- API keys stored in local config file (not in code)
- Config file gitignored (never committed)
- API calls use HTTPS (TLS encryption)
- User identifier passed to OpenAI for audit trail
- Rate limiting prevents API quota abuse
