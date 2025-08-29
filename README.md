# NetApp ONTAP MCP Server

A Model Context Protocol (MCP) server that provides comprehensive tools to interact with NetApp ONTAP storage systems via REST APIs. Supports both single-cluster and multi-cluster management with complete volume lifecycle operations.

## Overview

This MCP server enables AI assistants to manage NetApp ONTAP clusters through a standardized interface. It provides tools for cluster management, volume operations (including safe deletion workflows), and storage analytics across multiple ONTAP clusters. The server supports both STDIO and HTTP transport modes for maximum flexibility.

## 🚀 Key Features

### Transport Modes
- **STDIO Transport**: Perfect for VS Code MCP integration and direct AI assistant usage
- **HTTP REST API**: Ideal for web applications, external integrations, and testing
- **Dual Mode Support**: All tools available in both transport modes

### Volume Lifecycle Management
- **Complete CRUD Operations**: Create, read, update, and delete volumes
- **Safe Deletion Workflow**: Enforced offline-before-delete process for data protection
- **UUID Handling**: Automatic UUID resolution with fallback mechanisms
- **State Verification**: Real-time volume state checking and validation

### Multi-Cluster Support
- **Dynamic Cluster Registration**: Add/remove clusters at runtime
- **Environment Configuration**: Pre-configure clusters via environment variables
- **Unified Management**: Consistent API across all registered clusters

## Features

### Available Tools

#### Single-Cluster Tools (Legacy)
1. **get_cluster_info** - Get information about a NetApp ONTAP cluster
2. **list_volumes** - List all volumes in the cluster or a specific SVM
3. **list_svms** - List all Storage Virtual Machines (SVMs) in the cluster
4. **list_aggregates** - List all aggregates in the cluster
5. **create_volume** - Create a new volume in the specified SVM
6. **get_volume_stats** - Get performance statistics for a specific volume
7. **offline_volume** - Take a volume offline (required before deletion) ⚠️
8. **delete_volume** - Permanently delete a volume (must be offline first) ⚠️

#### Multi-Cluster Management Tools
1. **add_cluster** - Add a cluster to the registry for multi-cluster management
2. **list_registered_clusters** - List all registered clusters
3. **get_all_clusters_info** - Get cluster information for all registered clusters
4. **cluster_list_volumes** - List volumes from a registered cluster by name
5. **cluster_list_svms** - List SVMs from a registered cluster by name
6. **cluster_list_aggregates** - List aggregates from a registered cluster by name
7. **cluster_create_volume** - Create a volume on a registered cluster by name
8. **cluster_offline_volume** - Take a volume offline on a registered cluster ⚠️
9. **cluster_delete_volume** - Permanently delete a volume on a registered cluster ⚠️
10. **cluster_get_volume_stats** - Get volume statistics from a registered cluster by name

#### 🛡️ Safety Features
- **Offline-First Deletion**: Volumes must be taken offline before deletion
- **Safety Warnings**: Clear warnings for destructive operations
- **State Validation**: Automatic verification of volume states
- **Error Prevention**: Cannot delete online volumes

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

### As an MCP Server (STDIO Mode)

Configure the server in your MCP client (like VS Code with Copilot) by adding the following to your MCP configuration:

```json
{
  "servers": {
    "netapp-ontap-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["path/to/ontap-mcp/build/index.js"],
      "env": {
        "ONTAP_CLUSTERS": "[{\"name\":\"production\",\"cluster_ip\":\"10.193.184.184\",\"username\":\"admin\",\"password\":\"Netapp1!\",\"description\":\"Production cluster\"}]"
      }
    }
  }
}
```

### As an HTTP REST API Server

Start the server in HTTP mode for web applications and external integrations:

```bash
# Start HTTP server on default port 3000
npm run start:http

# Or specify a custom port
node build/index.js --http=3001
```

#### Available HTTP Endpoints

- **Health Check**: `GET http://localhost:3000/health`
- **MCP SSE**: `GET http://localhost:3000/sse` (Server-Sent Events)
- **REST API Tools**: `POST http://localhost:3000/api/tools/{toolName}`

#### Example REST API Usage

```bash
# Create a volume
curl -X POST http://localhost:3000/api/tools/cluster_create_volume \
  -H "Content-Type: application/json" \
  -d '{
    "cluster_name": "production",
    "svm_name": "vs0", 
    "volume_name": "test_volume",
    "size": "100GB"
  }'

# List volumes
curl -X POST http://localhost:3000/api/tools/cluster_list_volumes \
  -H "Content-Type: application/json" \
  -d '{"cluster_name": "production"}'
```

### Direct Execution (STDIO Mode)

You can also run the server directly:

```bash
npm start
```

### Development

For development with automatic rebuilding:

```bash
npm run dev

# For HTTP development mode
npm run dev:http
```

## Prerequisites

- Node.js 18 or higher
- TypeScript
- Access to a NetApp ONTAP cluster with REST API enabled
- Valid credentials for ONTAP cluster authentication

## 🧪 Testing

The project includes comprehensive testing tools for volume lifecycle operations:

### Volume Lifecycle Testing

Test the complete create → wait → offline → delete workflow:

```bash
# Test using Node.js (supports both STDIO and REST modes)
node test-volume-lifecycle.js stdio    # Test STDIO transport
node test-volume-lifecycle.js rest     # Test HTTP REST API

# Test using Bash script (REST API only)
./test-volume-lifecycle.sh
```

### Manual Testing Examples

```bash
# Test volume creation
echo "Create a 100MB volume named test_vol in SVM vs0 on cluster production"

# Test volume listing  
echo "List all volumes on cluster production"

# Test volume deletion (safe workflow)
echo "Offline volume test_vol on cluster production"
echo "Delete volume test_vol on cluster production"
```

## 🔄 Volume Lifecycle Management

The server implements a safe volume deletion workflow:

### Safe Deletion Process

1. **Create Volume**: `cluster_create_volume` - Creates a new volume
2. **Verify State**: Volume is automatically verified as online
3. **Offline Volume**: `cluster_offline_volume` - Takes volume offline (required for deletion)
4. **Delete Volume**: `cluster_delete_volume` - Permanently deletes the offline volume

### Safety Features

- **Offline Requirement**: Volumes must be offline before deletion
- **State Verification**: Automatic checking of volume states
- **Clear Warnings**: Destructive operations include prominent warnings
- **Error Prevention**: Cannot delete online volumes
- **UUID Handling**: Automatic UUID resolution with fallback mechanisms

## Cluster Registration

You have several options for registering ONTAP clusters with the MCP server:

### Method 1: Environment Variables (Recommended for Production)

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

### Method 2: Dynamic Registration

Use the MCP tools to register clusters at runtime:

```
Add a cluster named "production" with IP 10.193.184.184, username "admin", password "Netapp1!"
```

This uses the `add_cluster` tool. You can then:
- List registered clusters: "List all registered clusters"
- Get cluster info: "Get info for all clusters"
- Use cluster-specific tools: "List volumes on cluster production"

### Method 3: Code Pre-registration (Development)

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

### offline_volume
- `cluster_ip` (string): IP address or FQDN of the ONTAP cluster
- `username` (string): Username for authentication
- `password` (string): Password for authentication
- `volume_uuid` (string): UUID of the volume to take offline

### delete_volume
- `cluster_ip` (string): IP address or FQDN of the ONTAP cluster
- `username` (string): Username for authentication
- `password` (string): Password for authentication
- `volume_uuid` (string): UUID of the volume to delete (must be offline)

### cluster_offline_volume
- `cluster_name` (string): Name of the registered cluster
- `volume_uuid` (string): UUID of the volume to take offline

### cluster_delete_volume
- `cluster_name` (string): Name of the registered cluster
- `volume_uuid` (string): UUID of the volume to delete (must be offline)

## 🆕 Recent Improvements

### Version 2.0.0 Features
- **Dual Transport Support**: Both STDIO and HTTP REST API modes
- **Volume Lifecycle Management**: Complete create/offline/delete workflow with safety checks
- **Enhanced Testing**: Comprehensive test scripts for both transport modes
- **Improved Configuration**: Environment-based cluster configuration
- **Better Error Handling**: Clear warnings and error prevention for destructive operations
- **UUID Resolution**: Automatic UUID handling with fallback mechanisms
- **REST API Coverage**: All MCP tools available via HTTP endpoints

### Transport Architecture
- **Auto-Detection**: Server automatically detects transport mode from command line arguments
- **Consistent API**: Same tools and functionality across both transports
- **Production Ready**: HTTP mode suitable for web applications and external integrations

## API Compatibility

This MCP server is compatible with:
- NetApp ONTAP REST API v1 and v2
- ONTAP 9.6 and later versions
- Model Context Protocol (MCP) specification

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
├── index.ts          # Main MCP server implementation with dual transport
└── ontap-client.ts   # NetApp ONTAP REST API client

build/               # Compiled TypeScript output
test-volume-lifecycle.js   # Node.js volume lifecycle test
test-volume-lifecycle.sh   # Bash script for REST API testing
HTTP_CONFIG.md      # HTTP transport configuration guide
.github/            # GitHub and Copilot configuration
.vscode/            # VS Code configuration
```

### Adding New Tools

To add new ONTAP management tools:

1. Add the API method to `OntapApiClient` class in `ontap-client.ts`
2. Define input schema using Zod in `index.ts`
3. Add tool definition to the `ListToolsRequestSchema` handler
4. Implement tool logic in the `CallToolRequestSchema` handler
5. Add REST API case in the HTTP endpoint handler (for dual transport support)
6. Update tool tests in the test scripts

### TypeScript Configuration

The project uses modern TypeScript with:
- ES2022 target
- Node16 module resolution
- Strict type checking
- ESM module format

## License

ISC License

---

## 📚 Additional Resources

- [NetApp ONTAP REST API Documentation](https://docs.netapp.com/us-en/ontap-automation/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [VS Code MCP Extension](https://marketplace.visualstudio.com/items?itemName=ModelContextProtocol.mcp)
- [NetApp ONTAP 9 Documentation](https://docs.netapp.com/us-en/ontap/)

## 🏷️ Tags

`netapp` `ontap` `storage` `mcp` `model-context-protocol` `rest-api` `typescript` `volume-management` `cluster-management`

## Support

For issues related to:
- **MCP Server**: Create an issue in this repository
- **NetApp ONTAP**: Consult NetApp documentation or support
- **MCP Protocol**: Visit https://modelcontextprotocol.io/

### Troubleshooting

#### Common Issues

1. **Volume Deletion Fails**: Ensure volume is offline first using `cluster_offline_volume`
2. **HTTP Server Won't Start**: Check if port is already in use, try different port with `--http=3001`
3. **Authentication Errors**: Verify ONTAP credentials and cluster connectivity
4. **Transport Mode Issues**: Use `--http` flag for HTTP mode, no flag for STDIO mode

#### Debug Mode

Enable verbose logging:
```bash
# STDIO mode with debug
DEBUG=* node build/index.js

# HTTP mode with debug  
DEBUG=* node build/index.js --http=3000
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable (update test scripts)
5. Test both STDIO and HTTP transport modes
6. Submit a pull request

### Testing Your Changes

Before submitting:
```bash
# Build the project
npm run build

# Test STDIO transport
node test-volume-lifecycle.js stdio

# Test HTTP transport
./test-volume-lifecycle.sh

# Verify both transports work
npm start  # Test STDIO
npm run start:http  # Test HTTP
```
