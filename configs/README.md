# Configuration Templates

This directory contains example configuration files and templates for the NetApp ONTAP MCP Server.

## Files

### `mcp-server.json.example`
Example MCP server configuration. Copy to project root as `mcp-config.json` and customize.

### `clusters.json.example`
Example ONTAP cluster configuration for testing. Copy to `test/clusters.json` and add your cluster details.

**⚠️ Security Note:** Never commit files containing real cluster credentials. The actual config files are gitignored.

### `env.example`
Example environment variables. Copy to `.env` and customize with your settings.

## Usage

```bash
# Set up test cluster configuration
cp configs/clusters.json.example test/clusters.json
# Edit test/clusters.json with your cluster details

# Set up environment variables
cp configs/env.example .env
# Edit .env with your settings

# Set up MCP server configuration (if needed)
cp configs/mcp-server.json.example mcp-config.json
# Edit mcp-config.json as needed
```

## Environment-Specific Configs

You can create additional configuration templates for different environments:
- `clusters.dev.json.example`
- `clusters.staging.json.example`
- `clusters.prod.json.example`
