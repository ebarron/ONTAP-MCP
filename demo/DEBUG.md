# Debug Logging

The demo application includes a centralized debug logging system that can be enabled/disabled to control console output verbosity.

## Enable Debug Mode

### Method 1: URL Parameter (Temporary)
Add `?debug=true` to the URL:
```
http://localhost:8080?debug=true
```

This enables debug logging for the current session only.

### Method 2: localStorage (Persistent)
Open browser console and run:
```javascript
localStorage.setItem('MCP_DEBUG', 'true');
```

Then refresh the page. Debug mode will remain enabled across page reloads.

### Method 3: Browser Console (Runtime)
```javascript
debugLogger.enable()
```

## Disable Debug Mode

### Via localStorage:
```javascript
localStorage.setItem('MCP_DEBUG', 'false');
// or
debugLogger.disable()
```

### Via URL:
Remove the `?debug=true` parameter or use `?debug=false`

## What Gets Logged

### Always Logged (Errors & Warnings):
- ❌ Error messages (`console.error`)
- ⚠️  Warning messages (`console.warn`)

### Debug Mode Only:
- 🔌 MCP session initialization
- 📞 MCP tool calls and responses
- 🔧 Component initialization
- 📊 Tool discovery and routing
- 🔄 Cluster loading and discovery
- 📋 Data parsing operations
- ✅ Success confirmations

## Default Behavior

**Debug mode is OFF by default** - the console will only show critical errors and warnings, providing a clean user experience.

## Example Usage

```javascript
// Check current debug state
console.log('Debug enabled:', debugLogger.enabled);

// Enable debug logging
debugLogger.enable();

// Your code here - will now log debug messages

// Disable debug logging
debugLogger.disable();
```

## Implementation Details

The debug logger is implemented in `/demo/js/core/DebugLogger.js` and is loaded before all other scripts to ensure availability throughout the application.

Components and services that produce debug output:
- `McpApiClient.js` - Tool call/response logging
- `McpClientManager.js` - Server connection and tool routing
- `McpConfig.js` - Configuration loading
- `OpenAIService.js` - AI service initialization
- `app.js` - Application initialization and cluster management
- `ChatbotAssistant.js` - Chatbot tool discovery
- `CorrectiveActionParser.js` - Corrective action parsing
- Various view components - Rendering and data operations
