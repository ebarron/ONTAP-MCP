# NetApp ONTAP MCP Server

A Model Context Protocol (MCP) server that provides tools to interact with NetApp ONTAP storage systems via REST APIs. Supports both single-cluster and multi-cluster management.

## Overview

This MCP server enables AI assistants to manage NetApp ONTAP clusters through a standardized interface. It provides tools for cluster management, volume operations, and storage analytics across multiple ONTAP clusters.

## Features

### Available Tools

#### Single-Cluster Tools (Legacy)
1. **get_cluster_info** - Get information about a NetApp ONTAP cluster
2. **list_volumes** - List all volumes in the cluster or a specific SVM
3. **list_svms** - List all Storage Virtual Machines (SVMs) in the cluster
4. **list_aggregates** - List all aggregates in the cluster
5. **create_volume** - Create a new volume in the specified SVM
6. **get_volume_stats** - Get performance statistics for a specific volume

#### Multi-Cluster Management Tools
1. **add_cluster** - Add a cluster to the registry for multi-cluster management
2. **list_registered_clusters** - List all registered clusters
3. **get_all_clusters_info** - Get cluster information for all registered clusters
4. **cluster_list_volumes** - List volumes from a registered cluster by name
5. **cluster_list_svms** - List SVMs from a registered cluster by name
6. **cluster_list_aggregates** - List aggregates from a registered cluster by name
7. **cluster_create_volume** - Create a volume on a registered cluster by name
8. **cluster_get_volume_stats** - Get volume statistics from a registered cluster by name

## Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Usage

### As an MCP Server

Configure the server in your MCP client (like VS Code with Copilot) by adding the following to your MCP configuration:

```json
{
  "servers": {
    "netapp-ontap-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["path/to/ontap-mcp/build/index.js"]
    }
  }
}
```

### Direct Execution

You can also run the server directly:

```bash
npm start
```

### Development

For development with automatic rebuilding:

```bash
npm run dev
```

## Prerequisites

- Node.js 18 or higher
- TypeScript
- Access to a NetApp ONTAP cluster with REST API enabled
- Valid credentials for ONTAP cluster authentication

## Cluster Registration

You have several options for registering ONTAP clusters with the MCP server:

### Method 1: Dynamic Registration (Recommended)

Use the MCP tools to register clusters at runtime:

```
Add a cluster named "production" with IP 10.193.184.184, username "admin", password "Netapp1!"
```

This uses the `add_cluster` tool. You can then:
- List registered clusters: "List all registered clusters"
- Get cluster info: "Get info for all clusters"
- Use cluster-specific tools: "List volumes on cluster production"

### Method 2: Environment Variables (Production)

Set the `ONTAP_CLUSTERS` environment variable with a JSON array:

```bash
export ONTAP_CLUSTERS='[
  {
    "name": "production",
    "cluster_ip": "10.193.184.184", 
    "username": "admin",
    "password": "Netapp1!",
    "description": "Production cluster"
  },
  {
    "name": "development",
    "cluster_ip": "10.193.184.185",
    "username": "admin", 
    "password": "DevPassword123",
    "description": "Dev cluster"
  }
]'
```

Copy `.env.example` to `.env` and customize for your environment.

### Method 3: Code Pre-registration

Uncomment and modify the pre-registration code in `src/index.ts`:

```typescript
clusterManager.addCluster({
  name: "production",
  cluster_ip: "10.193.184.184",
  username: "admin",
  password: "Netapp1!",
  description: "Production ONTAP cluster"
});
```

## Authentication

The server supports ONTAP basic authentication. You'll need to provide:
- Cluster IP address or FQDN
- Username with appropriate privileges
- Password

**Security Note**: The server bypasses SSL certificate verification for ONTAP clusters (common with self-signed certificates). In production environments, consider implementing proper certificate validation.

## Tool Parameters

### get_cluster_info
- `cluster_ip` (string): IP address or FQDN of the ONTAP cluster
- `username` (string): Username for authentication
- `password` (string): Password for authentication

### list_volumes
- `cluster_ip` (string): IP address or FQDN of the ONTAP cluster
- `username` (string): Username for authentication
- `password` (string): Password for authentication
- `svm_name` (string, optional): Filter volumes by SVM name

### create_volume
- `cluster_ip` (string): IP address or FQDN of the ONTAP cluster
- `username` (string): Username for authentication
- `password` (string): Password for authentication
- `svm_name` (string): Name of the SVM where the volume will be created
- `volume_name` (string): Name of the new volume
- `size` (string): Size of the volume (e.g., '100GB', '1TB')
- `aggregate_name` (string, optional): Name of the aggregate to use

### get_volume_stats
- `cluster_ip` (string): IP address or FQDN of the ONTAP cluster
- `username` (string): Username for authentication
- `password` (string): Password for authentication
- `volume_uuid` (string): UUID of the volume to get statistics for

## API Compatibility

This MCP server is compatible with:
- NetApp ONTAP REST API v1 and v2
- ONTAP 9.6 and later versions

## Error Handling

The server includes comprehensive error handling for:
- Network connectivity issues
- Authentication failures
- Invalid parameters
- ONTAP API errors
- Rate limiting

## Development

### Project Structure

```
src/
├── index.ts          # Main MCP server implementation
└── ontap-client.ts   # NetApp ONTAP REST API client

build/               # Compiled TypeScript output
.github/            # GitHub and Copilot configuration
.vscode/            # VS Code configuration
```

### Adding New Tools

To add new ONTAP management tools:

1. Add the API method to `OntapApiClient` class in `ontap-client.ts`
2. Define input schema using Zod in `index.ts`
3. Add tool definition to the `ListToolsRequestSchema` handler
4. Implement tool logic in the `CallToolRequestSchema` handler

### TypeScript Configuration

The project uses modern TypeScript with:
- ES2022 target
- Node16 module resolution
- Strict type checking
- ESM module format

## License

ISC License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues related to:
- **MCP Server**: Create an issue in this repository
- **NetApp ONTAP**: Consult NetApp documentation or support
- **MCP Protocol**: Visit https://modelcontextprotocol.io/
