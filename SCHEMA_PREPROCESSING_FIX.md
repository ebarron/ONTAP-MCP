# Schema Preprocessing Fix for OpenAI Compatibility

## Problem
Multi-server MCP integration with Harvest tools was failing when using OpenAI's ChatGPT API due to schema validation errors:

```
Invalid schema for function 'get_active_alerts': 
In context=(), object schema missing properties.
```

## Root Cause Analysis

### MCP Protocol Specification
The MCP protocol (2025-06-18) **allows** tools with no parameters to have empty `properties`:
```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

### OpenAI API Requirements
OpenAI's Function Calling API **requires** at least one property when `type: "object"`:
```json
// ❌ REJECTED by OpenAI
{
  "type": "object",
  "properties": {}
}

// ✅ ACCEPTED by OpenAI
{
  "type": "object",
  "properties": {
    "param": { "type": "string" }
  }
}
```

### Why VS Code/GitHub Copilot Works
Investigation of VS Code logs revealed:
1. **VS Code logs warnings** for empty schemas: `Tool failed validation: schema must have a properties object`
2. **But tools still work** - VS Code preprocesses schemas before sending to LLM APIs
3. **GitHub's GPT-5 accepts them** - either relaxed validation or schema transformation
4. **Claude (Anthropic) accepts them** - more lenient than OpenAI

## Solution: Schema Preprocessing

Added preprocessing in `ChatbotAssistant.js` to match VS Code's behavior:

### 1. In `buildMCPTools()` (lines 462-534)
```javascript
// OpenAI requires at least one property when type='object'
// This preprocesses schemas to match GitHub Copilot's behavior
if (parameters.type === 'object' && 
    parameters.properties && 
    Object.keys(parameters.properties).length === 0) {
    
    // Add a dummy optional parameter to satisfy OpenAI's validation
    parameters = {
        type: 'object',
        properties: {
            _unused: {
                type: 'string',
                description: 'Optional parameter (not used by this tool)',
                optional: true
            }
        },
        required: []
    };
}
```

### 2. In `executeMCPTool()` (lines 649-660)
```javascript
// Strip out the dummy _unused parameter added for OpenAI compatibility
// This parameter was added in buildMCPTools() to satisfy OpenAI's validation
// but should not be sent to the actual MCP server
if (parsedArgs._unused !== undefined) {
    delete parsedArgs._unused;
}
```

## Testing

### Test Page
Run `demo/test/test-schema-fix.html` to verify:
1. Tool loading from both MCP servers (ONTAP + Harvest)
2. Schema preprocessing for tools with empty properties
3. OpenAI validation simulation (before/after)

### Expected Results
- **Before**: Harvest tools like `get_active_alerts` fail OpenAI validation
- **After**: All tools pass validation with `_unused` parameter added
- **Execution**: `_unused` parameter stripped before calling actual MCP tools

## Impact

### Fixed Tools
All Harvest MCP tools with no parameters now work with ChatGPT:
- `get_active_alerts`
- `infrastructure_health`
- `list_alert_rules`
- `list_all_label_names`
- `reload_prometheus_rules`
- `get_rules_config_help`

### Compatible With
- ✅ OpenAI GPT-4, GPT-4o, GPT-5 (public API)
- ✅ GitHub Copilot GPT-5 (already worked, now explicit)
- ✅ Anthropic Claude (already worked)
- ✅ MCP Protocol 2025-06-18 (spec-compliant)
- ✅ Multi-server architecture (ONTAP + Harvest)

## Implementation Details

### Why `_unused` Parameter?
1. **Minimal footprint**: Single optional string parameter
2. **Self-documenting**: Name and description make intent clear
3. **Non-invasive**: `optional: true` means ChatGPT won't require it
4. **Safe**: Stripped out before calling actual MCP tools

### Alternative Approaches Considered
1. **Filter out no-parameter tools**: Would lose Harvest functionality
2. **Switch to Claude**: Would require changing ChatGPT integration
3. **Report to Harvest team**: Would take time, affects all users
4. **Wait for OpenAI fix**: No guarantee they'll change validation

### Why This Approach?
- **Immediate solution**: Works now without upstream changes
- **Transparent**: Users don't see the workaround
- **Reversible**: Easy to remove if OpenAI/Harvest changes
- **Matches industry**: Same pattern as VS Code/GitHub Copilot

## References

- **MCP Specification**: https://spec.modelcontextprotocol.io/specification/2025-06-18/
- **OpenAI Function Calling**: https://platform.openai.com/docs/guides/function-calling
- **VS Code Logs**: `~/Library/Application Support/Code/logs/.../GitHub.copilot-chat/`
- **Harvest Source**: https://github.com/NetApp/harvest/tree/main/mcp

## Verification

Check VS Code logs to confirm the pattern:
```bash
cat ~/Library/Application\ Support/Code/logs/*/window*/exthost/GitHub.copilot-chat/GitHub\ Copilot\ Chat.log | grep "failed validation"
```

Expected output:
```
[warning] Tool mcp_harvest-remot_get_active_alerts failed validation: schema must have a properties object
[info] message 0 returned. finish reason: [tool_calls]  # But still works!
```

## Date
October 6, 2025

## Author
Schema preprocessing fix implemented after analyzing VS Code/GitHub Copilot behavior and comparing with direct OpenAI API requirements.
