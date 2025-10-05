# MCP Server Configuration

The demo uses an external `mcp.json` configuration file to manage connections to MCP servers. This allows for easy configuration of multiple MCP endpoints without modifying code.

## Configuration File: `demo/mcp.json`

### Structure

```json
{
  "servers": {
    "server-name": {
      "type": "http",
      "url": "http://hostname:port",
      "description": "Human-readable description",
      "enabled": true/false
    }
  },
  "default": "server-name"
}
```

### Example Configuration

```json
{
  "servers": {
    "netapp-ontap": {
      "type": "http",
      "url": "http://localhost:3000",
      "description": "NetApp ONTAP MCP Server",
      "enabled": true
    },
    "harvest-remote": {
      "type": "http",
      "url": "http://10.193.49.74:9119",
      "description": "NetApp Harvest Metrics Server",
      "enabled": false
    }
  },
  "default": "netapp-ontap"
}
```

## Configuration Properties

### Server Configuration

- **type**: Protocol type (currently only "http" is supported)
- **url**: Full URL to the MCP server endpoint
- **description**: Human-readable description of the server
- **enabled**: Whether this server is available for use

### Global Configuration

- **default**: Name of the default server to use when no specific server is requested

## Setup Instructions

1. **Copy the example configuration:**
   ```bash
   cd demo
   cp mcp.json.example mcp.json
   ```

2. **Edit `mcp.json` with your MCP server details:**
   - Update URLs to point to your MCP servers
   - Set `enabled: true` for servers you want to use
   - Configure the default server

3. **Start the demo:**
   ```bash
   # The demo will automatically load mcp.json on startup
   python3 -m http.server 8080
   ```

## Using Multiple MCP Servers

The configuration supports multiple MCP servers. The demo currently uses the default server specified in the configuration.

### Future Enhancements

To add server switching functionality:

```javascript
// In your application code
const mcpConfig = new McpConfig();
await mcpConfig.load();

// Switch to a different server
const harvestUrl = mcpConfig.getServerUrl('harvest-remote');
const harvestClient = new McpApiClient(harvestUrl);

// List all enabled servers
const servers = mcpConfig.getEnabledServers();
console.log('Available servers:', servers);
```

## Fallback Behavior

If `mcp.json` is not found or fails to load, the demo falls back to:
- Default URL: `http://localhost:3000`
- Default server name: `netapp-ontap`

This ensures the demo works out-of-the-box during development.

## Security Considerations

- **Do NOT commit** `mcp.json` with production credentials
- Use `mcp.json.example` as a template for documentation
- Add `mcp.json` to `.gitignore` if it contains sensitive information
- Consider using environment variables for production deployments

## Integration with ChatGPT Assistant

The ChatGPT assistant uses the configured MCP server through the `demo.apiClient` instance:

```javascript
// ChatbotAssistant.js
const result = await this.demo.apiClient.callMcp(toolName, args);
```

The MCP server URL is automatically loaded during app initialization and passed to all components.

## Troubleshooting

### Configuration Not Loading

**Symptom:** Demo still uses `http://localhost:3000` even after updating `mcp.json`

**Solutions:**
1. Check browser console for configuration load errors
2. Verify `mcp.json` is in the `demo/` directory
3. Ensure JSON syntax is valid (use a JSON validator)
4. Clear browser cache and reload

### Server Connection Errors

**Symptom:** `Failed to connect to MCP server`

**Solutions:**
1. Verify the MCP server is running: `curl http://localhost:3000/mcp`
2. Check the URL in `mcp.json` matches your MCP server
3. Ensure the server is enabled: `"enabled": true`
4. Check for CORS issues in browser console

### Multiple Servers Not Working

**Note:** Multi-server support is partially implemented. The demo currently uses only the default server. To add full multi-server switching:

1. Add UI controls for server selection
2. Create new `McpApiClient` instances per server
3. Implement server-aware tool routing

## Related Files

- `demo/mcp.json` - Main configuration file (create from example)
- `demo/mcp.json.example` - Example configuration template
- `demo/js/core/McpConfig.js` - Configuration loader
- `demo/js/core/McpApiClient.js` - MCP API client
- `demo/app.js` - Main application that uses the config
