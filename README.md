# NetApp ONTAP MCP Server

A Model Context Protocol (MCP) server that provides comprehensive tools to ### 📸 Data Protection with Snapshot Policies
- **Automated Backups**: Create scheduled snapshots for point-in-time recovery
- **Flexible Retention**: Configure hourly, daily, weekly, or custom copy schedules  
- **Volume Integration**: Apply policies during volume creation or to existing volumes
- **Policy Management**: Full lifecycle management of snapshot policiesact with NetApp ONTAP storage systems via REST APIs. Supports both single-cluster and multi-cluster management with complete volume lifecycle operations, data protection policies, and NFS access control.

## Overview

This MCP server enables AI assistants to manage NetApp ONTAP clusters through a standardized interface. It provides tools for cluster management, volume operations (including safe deletion workflows), snapshot policy management, NFS export policy configuration, and storage analytics across multiple ONTAP clusters. The server supports both STDIO and HTTP transport modes for maximum flexibility.

## 🚀 Key Features

### Enhanced Volume Provisioning
- **Complete Data Protection**: Automated snapshot policies for backup and recovery
- **NFS Access Control**: Export policies for secure client access configuration
- **Policy Management**: Full lifecycle management of snapshot and export policies
- **Volume Updates**: Post-creation configuration changes and policy applications

### Transport Modes
- **STDIO Transport**: Perfect for VS Code MCP integration and direct AI assistant usage
- **HTTP REST API**: Ideal for web applications, external integrations, and testing
- **Dual Mode Support**: All tools available in both transport modes

### Volume Lifecycle Management
- **Complete CRUD Operations**: Create, read, update, and delete volumes
- **Safe Deletion Workflow**: Enforced offline-before-delete process for data protection
- **UUID Handling**: Automatic UUID resolution with fallback mechanisms
- **State Verification**: Real-time volume state checking and validation
- **Policy Integration**: Create volumes with snapshot and export policies applied

### Multi-Cluster Support
- **Dynamic Cluster Registration**: Add/remove clusters at runtime
- **Environment Configuration**: Pre-configure clusters via environment variables
- **Unified Management**: Consistent API across all registered clusters

## Features

### Available Tools (38 Total)

#### Core Volume Management (18 tools)
**Single-Cluster Tools (Legacy)**
1. **get_cluster_info** - Get information about a NetApp ONTAP cluster
2. **list_volumes** - List all volumes in the cluster or a specific SVM
3. **list_svms** - List all Storage Virtual Machines (SVMs) in the cluster
4. **list_aggregates** - List all aggregates in the cluster
5. **create_volume** - Create a new volume with optional policies
6. **get_volume_stats** - Get performance statistics for a specific volume
7. **offline_volume** - Take a volume offline (required before deletion) ⚠️
8. **delete_volume** - Permanently delete a volume (must be offline first) ⚠️

**Multi-Cluster Management Tools**
9. **add_cluster** - Add a cluster to the registry for multi-cluster management
10. **list_registered_clusters** - List all registered clusters
11. **get_all_clusters_info** - Get cluster information for all registered clusters
12. **cluster_list_volumes** - List volumes from a registered cluster by name
13. **cluster_list_svms** - List SVMs from a registered cluster by name
14. **cluster_list_aggregates** - List aggregates from a registered cluster by name
15. **cluster_create_volume** - Create a volume with policies on a registered cluster
16. **cluster_offline_volume** - Take a volume offline on a registered cluster ⚠️
17. **cluster_delete_volume** - Permanently delete a volume on a registered cluster ⚠️
18. **cluster_get_volume_stats** - Get volume statistics from a registered cluster

#### Snapshot Policy Management (7 tools)
19. **list_snapshot_policies** - List all snapshot policies with filtering
20. **get_snapshot_policy** - Get detailed policy information including copies configuration
21. **create_snapshot_policy** - Create new snapshot policies with custom copy schedules
22. **update_snapshot_policy** - Modify existing snapshot policies
23. **delete_snapshot_policy** - Remove unused snapshot policies
24. **apply_snapshot_policy_to_volume** - Apply data protection to volumes
25. **remove_snapshot_policy_from_volume** - Disable volume protection

#### NFS Export Policy Management (9 tools)
26. **list_export_policies** - List all export policies with SVM filtering
27. **get_export_policy** - Get detailed policy information with all rules
28. **create_export_policy** - Create new NFS export policies
29. **delete_export_policy** - Remove export policies (must not be in use)
30. **add_export_rule** - Add access rules to export policies
31. **update_export_rule** - Modify existing export rules
32. **delete_export_rule** - Remove rules from export policies
33. **configure_volume_nfs_access** - Apply export policies to volumes
34. **disable_volume_nfs_access** - Revert volumes to default export policy

#### Volume Configuration & Updates (6 tools)
35. **get_volume_configuration** - Get comprehensive volume configuration
36. **update_volume_security_style** - Change volume security style (unix/ntfs/mixed)
37. **resize_volume** - Increase volume size (ONTAP doesn't support shrinking)
38. **update_volume_comment** - Update volume description/documentation
39. **apply_snapshot_policy_to_volume** - Apply protection policies to existing volumes
40. **remove_snapshot_policy_from_volume** - Remove protection from volumes

#### Enhanced Features (0 separate tools)
- **Test Harness** - Comprehensive test script for all policy management features  
- **Documentation** - Complete workflow examples and best practices guide

#### 🛡️ Safety Features
- **Offline-First Deletion**: Volumes must be taken offline before deletion
- **Safety Warnings**: Clear warnings for destructive operations  
- **State Validation**: Automatic verification of volume states
- **Error Prevention**: Cannot delete online volumes

## 🎯 Enhanced Volume Provisioning Use Cases

The enhanced MCP server now supports complete infrastructure provisioning workflows:

### � Data Protection with Snapshot Policies
- **Automated Backups**: Create scheduled snapshots for point-in-time recovery
- **Flexible Retention**: Configure hourly, daily, weekly, or custom copy schedules  
- **Volume Integration**: Apply policies during volume creation or to existing volumes
- **Policy Management**: Full lifecycle management of snapshot policies

### 🌐 Network Access Control with Export Policies
- **Secure NFS Access**: Configure client access permissions and authentication
- **Granular Control**: Specify read-only, read-write, and superuser access
- **Network Segmentation**: Different policies for different network zones
- **Protocol Support**: NFSv3, NFSv4, and NFSv4.1 protocol configuration

### 📊 Complete Volume Management
- **Enhanced Creation**: Create volumes with data protection and access policies
- **Configuration Updates**: Modify security styles, resize volumes, update descriptions
- **Policy Application**: Apply or remove policies from existing volumes  
- **Comprehensive Monitoring**: Detailed volume configuration and statistics

### 🔄 Infrastructure as Code Workflows
- **Automation Ready**: All tools support programmatic usage via MCP protocol
- **Consistent API**: Unified interface across single and multi-cluster environments
- **Complete Lifecycle**: From initial provisioning to decommissioning
- **Best Practices**: Built-in validation and safety checks

See [ENHANCED_PROVISIONING.md](ENHANCED_PROVISIONING.md) for detailed workflow examples and best practices.

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

The project includes a comprehensive testing suite located in the `test/` directory with external cluster configuration for maximum maintainability.

### Comprehensive Test Runner

**Run all tests with a single command:**
```bash
# Build and run complete test suite (9 tests)
./test/run-all-tests.sh
```

### Core Testing Tools

| Test Tool | Purpose | Transport Mode |
|-----------|---------|----------------|
| `run-all-tests.sh` | **Complete regression test suite runner** | All modes |
| `test-volume-lifecycle.js` | Volume CRUD workflow testing | STDIO & REST |
| `test-volume-lifecycle.sh` | Volume lifecycle via shell with auto-discovery | REST only |
| `check-aggregates.js` | Cross-cluster aggregate verification | REST |
| `verify-tool-count.sh` | Tool registration validation | Local |
| `test-comprehensive.js` | Full feature testing suite | REST |
| `test-policy-management.sh` | Policy workflow testing | REST |
| `setup-test-env.sh` | Interactive environment setup | Local |

### Quick Testing

Test individual components or run the full suite:

```bash
# Build project
npm run build

# Run complete regression test suite (recommended)
./test/run-all-tests.sh

# Individual test examples:
node test/test-volume-lifecycle.js stdio    # Test STDIO transport
node test/test-volume-lifecycle.js rest     # Test HTTP REST API
./test/test-volume-lifecycle.sh             # Shell-based REST API testing
node test/check-aggregates.js               # Cross-cluster verification
./test/verify-tool-count.sh                 # Tool count validation
```

### External Cluster Configuration

Tests use an external `clusters.json` configuration file for maintainability:

- **Location**: `test/clusters.json`
- **Sync Tool**: `test/sync-clusters.js` - synchronizes from your VS Code MCP settings
- **Auto-Discovery**: Shell tests automatically discover available SVMs and aggregates

### How It Works

The test framework:
1. Uses external cluster configuration from `test/clusters.json`
2. Starts the MCP server in HTTP mode automatically
3. Performs comprehensive testing across all registered clusters
4. Provides detailed pass/fail reporting with timing
5. Automatically cleans up resources and stops servers

**Enhanced maintainability** - cluster configuration is externalized and can be synchronized from your VS Code MCP settings using the sync utility.

📋 **For comprehensive testing documentation, see [test/TESTING.md](test/TESTING.md)** - includes complete environment setup, test strategies, workflow validation, and troubleshooting guides.

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

### Method 1: VS Code MCP Configuration (Recommended)

Configure clusters directly in your VS Code MCP settings file:

**New Object Format (Recommended):**
```json
{
  "servers": {
    "netapp-ontap-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/ONTAP-MCP/build/index.js"],
      "env": {
        "ONTAP_CLUSTERS": {
          "production": {
            "cluster_ip": "10.193.184.184",
            "username": "admin",
            "password": "Netapp1!",
            "description": "Production cluster"
          },
          "development": {
            "cluster_ip": "10.193.184.185",
            "username": "admin",
            "password": "DevPassword123",
            "description": "Development cluster"
          }
        }
      }
    }
  }
}
```

**Legacy Array Format (Still Supported):**
```json
{
  "servers": {
    "netapp-ontap-mcp": {
      "type": "stdio",
      "command": "node", 
      "args": ["/path/to/ONTAP-MCP/build/index.js"],
      "env": {
        "ONTAP_CLUSTERS": "[{\"name\":\"production\",\"cluster_ip\":\"10.193.184.184\",\"username\":\"admin\",\"password\":\"Netapp1!\",\"description\":\"Production cluster\"}]"
      }
    }
  }
}
```

**Benefits of the New Object Format:**
- ✅ **Much More Readable**: Each cluster clearly separated and easy to identify
- ✅ **Easier to Edit**: Simple to add, remove, or modify cluster configurations
- ✅ **Better Organization**: Cluster names serve as clear identifiers
- ✅ **Self-Documenting**: Structure makes the configuration obvious
- ✅ **Backward Compatible**: Server handles both old and new formats automatically

This approach ensures:
- ✅ **Secure**: Credentials stored in your local VS Code configuration
- ✅ **Convenient**: Same clusters available to both VS Code and test scripts
- ✅ **Persistent**: Configuration survives VS Code restarts
- ✅ **Private**: Not committed to version control

### Method 2: Environment Variables (Production/CI)

**New Object Format:**
```bash
export ONTAP_CLUSTERS='{
  "production": {
    "cluster_ip": "10.193.184.184",
    "username": "admin",
    "password": "Netapp1!",
    "description": "Production cluster"
  },
  "development": {
    "cluster_ip": "10.193.184.185",
    "username": "admin",
    "password": "DevPassword123", 
    "description": "Development cluster"
  }
}'
```

**Legacy Array Format:**
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

### Method 3: Dynamic Registration (Runtime)

Use the MCP tools to register clusters at runtime:

```
Add a cluster named "production" with IP 10.193.184.184, username "admin", password "Netapp1!"
```

This uses the `add_cluster` tool. You can then:
- List registered clusters: "List all registered clusters"
- Get cluster info: "Get info for all clusters"
- Use cluster-specific tools: "List volumes on cluster production"

### Configuration Helper

Use the interactive setup script to generate properly formatted configuration:

```bash
./test/setup-test-env.sh
```

This script will guide you through configuring clusters and generate the correct JSON format for your environment.

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
```
src/
├── index.ts          # Main MCP server implementation with dual transport
├── ontap-client.ts   # NetApp ONTAP REST API client
└── tools/            # Tool implementations organized by category
    ├── export-policy-tools.ts    # NFS export policy management
    ├── snapshot-policy-tools.ts  # Snapshot policy lifecycle
    ├── snapshot-schedule-tools.ts # Snapshot scheduling
    └── volume-update-tools.ts     # Volume configuration updates

test/                    # Testing infrastructure and validation tools
├── TESTING.md                    # Comprehensive testing guide and documentation
├── run-all-tests.sh              # Complete regression test suite runner
├── clusters.json                 # External cluster configuration for tests
├── sync-clusters.js              # Synchronize clusters from VS Code MCP settings
├── test-volume-lifecycle.js      # Node.js volume lifecycle test (STDIO/REST)
├── test-volume-lifecycle.sh      # Bash script for REST API testing with auto-discovery
├── check-aggregates.js           # Cross-cluster aggregate verification
├── verify-tool-count.sh          # Tool registration validation
├── setup-test-env.sh             # Interactive environment configuration
├── test-comprehensive.js         # Complete feature testing suite
├── test-policy-management.sh     # Policy workflow testing
└── working-policy-format.js      # Policy format validation

build/                   # Compiled TypeScript output
HTTP_CONFIG.md          # HTTP transport configuration guide
.github/                # GitHub and Copilot configuration
.vscode/                # VS Code configuration
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

- [test/TESTING.md](test/TESTING.md) - Comprehensive testing guide and procedures
- [ENHANCED_PROVISIONING.md](ENHANCED_PROVISIONING.md) - Complete provisioning workflows
- [HTTP_CONFIG.md](HTTP_CONFIG.md) - HTTP transport configuration
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
node test/test-volume-lifecycle.js stdio

# Test HTTP transport
./test/test-volume-lifecycle.sh

# Verify both transports work
npm start  # Test STDIO
npm run start:http  # Test HTTP
```
