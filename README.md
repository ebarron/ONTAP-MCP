# NetApp ONTAP MCP Server

A Model Context Protocol (MCP) server that provides comprehensive access to NetApp ONTAP storage systems. Supports both STDIO and HTTP transports with multi-cluster management, complete volume lifecycle operations, data protection policies, and NFS/CIFS access control.

## 🏗️ Architecture

This MCP server uses a modern multi-cluster architecture with centralized credential management and unified tool interfaces. All tools operate through registered cluster configurations rather than requiring credentials for each API call, providing enhanced security and simplified multi-cluster workflows.

### MCP Protocol (2025-06-18)
- **STDIO Transport**: JSON-RPC over stdin/stdout for VS Code and AI assistants
- **HTTP Transport**: Streamable HTTP with SSE responses for browser and web applications
- **Dual Mode**: All 55 tools available in both transports with identical behavior

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ with npm
- NetApp ONTAP cluster(s) with admin credentials
- VS Code with MCP extension (for STDIO mode) OR web browser (for HTTP mode)

### 2. Installation & Setup
```bash
# Clone and build
git clone https://github.com/your-repo/ONTAP-MCP.git
cd ONTAP-MCP
npm install
npm run build

# Configure test clusters (optional)
cp test/clusters.json.example test/clusters.json
# Edit test/clusters.json with your cluster details
```

### 3. Quick Start Options

#### Option A: VS Code MCP Integration (STDIO)
```bash
# Add to your MCP configuration:
{
  "servers": {
    "netapp-ontap-mcp": {
      "type": "stdio", 
      "command": "node",
      "args": ["/path/to/ONTAP-MCP/build/index.js"],
      "env": {
        "ONTAP_CLUSTERS": "[{\"name\":\"cluster1\",\"cluster_ip\":\"10.1.1.1\",\"username\":\"admin\",\"password\":\"pass\"}]"
      }
    }
  }
}
```

#### Option B: HTTP Transport (Browser/Web Apps)
```bash
# Start HTTP server (no clusters pre-loaded for security)
node build/index.js --http=3000

# MCP endpoint available at:
# POST http://localhost:3000/mcp (Streamable HTTP with SSE responses)
```

**🔒 Session-Scoped Security:** HTTP mode uses isolated cluster registries per session. Clusters must be added via the `add_cluster` tool or MCP initialize options. See [Session Architecture](#session-architecture) below.

**For STDIO Mode:** Clusters are loaded globally from `ONTAP_CLUSTERS` env var (single-user context).
**For HTTP Mode:** Each session maintains isolated clusters (multi-tenant security).

## 🛠️ MCP Tools (55 Total)

### Core Volume Operations (18 tools)
- Complete volume lifecycle: create, read, update, delete, resize
- Comprehensive volume updates (multiple properties in single operation)  
- QoS policy and snapshot policy assignment
- NFS access control with export policies
- Safe deletion workflow (offline → delete)
- Volume configuration and statistics

### Data Protection (8 tools)  
- Snapshot policies with flexible scheduling
- Snapshot schedules (cron and interval-based)
- Policy application to volumes
- Automated backup configuration

### CIFS/SMB Integration (8 tools)
- Complete CIFS share management
- Access control lists with user/group permissions
- Share properties and security configuration
- Integration with volume provisioning

### NFS Export Policy Management (9 tools)
- Export policy creation and management
- Export rule configuration and updates
- Client access control and security
- Volume-to-policy association

### Performance Management (5 tools)
- QoS policy group management (create, list, get, update, delete)
- Fixed QoS policies with IOPS/bandwidth limits
- Adaptive QoS policies with dynamic scaling
- Performance allocation per workload/volume

### Multi-Cluster Management (4 tools)
- Cluster registration and discovery
- Cross-cluster volume operations
- Centralized management interface

### Additional Management (3 tools)
- Cluster information and health
- SVM and aggregate discovery
- Infrastructure health assessment

## 🌐 Transport Modes

### STDIO Transport
- Direct integration with VS Code MCP extension
- JSON-RPC 2.0 over stdin/stdout
- Automatic initialization handshake
- Perfect for AI assistants and IDE integration

### HTTP Transport  
- Streamable HTTP with Server-Sent Events (SSE) responses
- Browser-native EventSource API support
- Session-based JSON-RPC messaging
- Ideal for web applications and demos

**Note**: All 55 tools work identically in both transport modes.

## 🔒 Session Architecture

### STDIO Mode (Single-User)
- **Global Cluster Manager**: All clusters loaded from `ONTAP_CLUSTERS` env var at startup
- **Shared State**: Single cluster registry for the VS Code instance
- **Security**: Appropriate for single-user desktop environment

### HTTP Mode (Multi-Tenant)
- **Session-Scoped Cluster Managers**: Each HTTP session has isolated cluster registry
- **No Cross-Session Access**: Session A cannot see or access Session B's clusters
- **Automatic Cleanup**: Session expiration removes all cluster credentials from memory
- **Security**: Prevents unauthorized access in multi-user/browser scenarios

**How Clusters are Loaded:**

**STDIO Mode:**
```bash
# Clusters loaded globally at startup
export ONTAP_CLUSTERS='[{...}]'
node build/index.js
```

**HTTP Mode:**
```bash
# No clusters pre-loaded (security)
node build/index.js --http=3000

# Clusters must be added per session via:
# 1. MCP initialize with initializationOptions
# 2. add_cluster tool call
# 3. Demo auto-load from clusters.json (browser only)
```

**Session Lifecycle (HTTP Mode):**
1. Client connects → `POST /mcp` → Creates session with unique ID (via `Mcp-Session-Id` header)
2. Client adds clusters → `add_cluster` tool → Clusters stored in THIS session only
3. Client makes requests → Uses session ID → Accesses only session's clusters
4. Session expires → Server removes session + all cluster credentials

See `SESSION_ISOLATION_IMPLEMENTATION.md` for technical details.

## 📚 Documentation

### Quick Access
- **Demo Interface**: See `demo/README.md` for web interface guide
- **Testing**: See `test/README.md` for comprehensive testing framework (19 tests, 100% passing)
- **Development**: See `.github/copilot-instructions.md` for architecture details

### Key Features
- **MCP Protocol 2025-06-18**: Full protocol compliance with STDIO and HTTP transports
- **Multi-cluster management** with dynamic registration
- **Complete volume provisioning** with NFS and CIFS support
- **Data protection policies** with automated snapshots
- **Safe deletion workflows** with offline-first requirements
- **Dynamic resource discovery** (no hardcoded aggregates or SVMs)

## 🔧 Development

### Build & Test
```bash
npm run build              # Compile TypeScript
npm start                  # Test STDIO mode
npm run start:http         # Test HTTP mode
./test/run-all-tests.sh    # Run comprehensive test suite
```

## ⚙️ Configuration

### Environment Variables

#### Cluster Configuration
- **`ONTAP_CLUSTERS`** (STDIO mode only): JSON array of cluster configurations loaded at startup
  ```bash
  export ONTAP_CLUSTERS='[{
    "name": "prod-cluster",
    "cluster_ip": "10.1.1.1",
    "username": "admin",
    "password": "password",
    "description": "Production Cluster"
  }]'
  ```
  **Note:** HTTP mode does NOT use this env var. Clusters must be added per session via `add_cluster` tool for security.

#### Harvest Metrics Integration (Optional)
- **`HARVEST_TSDB_URL`** (optional): Prometheus/VictoriaMetrics URL for performance metrics
  ```bash
  export HARVEST_TSDB_URL='http://prometheus-server:9090'
  ```
  When set, enables 9 additional Prometheus metrics tools (56 total tools)

- **`HARVEST_TSDB_TIMEOUT`** (optional, default: `30s`): Query timeout for metrics requests
  ```bash
  export HARVEST_TSDB_TIMEOUT='60s'  # For slower systems
  ```

#### HTTP Session Management (HTTP Transport Only)
- **`MCP_SESSION_INACTIVITY_TIMEOUT`** (optional, default: `1200000` = 20 minutes): Session timeout in milliseconds after last activity
  ```bash
  export MCP_SESSION_INACTIVITY_TIMEOUT='1800000'  # 30 minutes
  ```

- **`MCP_SESSION_MAX_LIFETIME`** (optional, default: `86400000` = 24 hours): Maximum session lifetime in milliseconds
  ```bash
  export MCP_SESSION_MAX_LIFETIME='43200000'  # 12 hours
  ```

### Session Management Details

When running in HTTP mode, the server implements intelligent session management:

**Session Lifecycle:**
1. Client connects to `GET /mcp` → Creates SSE stream with unique session ID
2. Client uses session ID for all `POST /messages?sessionId=xxx` requests
3. Server tracks last activity timestamp for each session
4. Sessions expire based on:
   - **Inactivity timeout**: Session expires after N minutes of no requests (default: 20 minutes)
   - **Max lifetime**: Session expires after N hours regardless of activity (default: 24 hours)
5. Expired sessions are automatically cleaned up every 60 seconds

**Monitoring:**
- Session statistics available at `GET /health` endpoint
- Shows active session count and age distribution
- Displays current timeout configuration

**Best Practices:**
- Use shorter inactivity timeouts for public-facing deployments
- Increase max lifetime for long-running administrative sessions
- Monitor session counts to detect connection leaks

## 🖥️ Demo Interface

A complete web-based demonstration interface showcases all MCP capabilities through an authentic NetApp BlueXP-style interface. The demo uses the MCP SSE protocol and provides:

- End-to-end volume provisioning workflows
- NFS/CIFS configuration with export policies and access control
- Data protection policy management
- Real-time MCP API validation
- AI-powered provisioning assistant (optional ChatGPT integration)

Start the demo:
```bash
./start-demo.sh  # Starts both MCP server (port 3000) and demo UI (port 8080)
# Access at: http://localhost:8080
```

See `demo/README.md` for detailed features and configuration.

### Project Structure
```
src/
├── index.ts               # Main server entry point
├── ontap-client.ts        # ONTAP API client and cluster management
├── config/                # Configuration management
│   └── cluster-config.ts  # Cluster configuration parsing
├── registry/              # Tool registration system
│   ├── tool-registry.ts   # Central tool registry
│   └── register-tools.ts  # Tool registration
├── transports/            # Transport layer abstraction
│   ├── base-transport.ts  # Common transport interface
│   ├── stdio-transport.ts # MCP STDIO implementation
│   └── http-transport.ts  # HTTP transport implementation
├── tools/                 # MCP tool implementations (47 tools)
│   ├── cluster-management-tools.ts  # Basic cluster operations
│   ├── volume-tools.ts              # Volume lifecycle management
│   ├── snapshot-policy-tools.ts     # Snapshot policy management
│   ├── snapshot-schedule-tools.ts   # Snapshot schedule management
│   ├── export-policy-tools.ts       # NFS export policy management
│   ├── cifs-share-tools.ts          # CIFS/SMB share management
│   └── qos-policy-tools.ts          # QoS performance management
└── types/                 # TypeScript type definitions

demo/                      # Web-based demo interface (NetApp BlueXP style)
├── index.html             # Main application (352 lines, down from 660)
├── app.js                 # Core application logic
├── styles.css             # NetApp BlueXP design system
└── js/
    ├── components/
    │   ├── views/         # Modular view components
    │   │   ├── ClustersView.js        # Cluster management view
    │   │   ├── StorageClassesView.js  # Storage classes view
    │   │   └── AlertsView.js          # Alerts/monitoring view
    │   ├── ChatbotAssistant.js        # AI provisioning assistant
    │   ├── ProvisioningPanel.js       # Storage provisioning workflow
    │   ├── ExportPolicyModal.js       # NFS export policy management
    │   └── app-initialization.js      # Component initialization
    ├── core/
    │   ├── McpApiClient.js            # MCP SSE transport layer
    │   └── utils.js                   # Utility functions
    └── ui/
        └── ToastNotifications.js      # User feedback system

test/                      # Comprehensive testing framework
```

## 🌟 Use Cases

- **AI-Assisted Storage Management**: Direct integration with AI assistants via MCP
- **Automated Provisioning**: Complete volume and share creation workflows
- **Data Protection**: Automated snapshot policy management
- **Multi-Cluster Operations**: Centralized management across ONTAP clusters
- **Development & Testing**: HTTP transport for external applications

## 📦 Examples

### MCP Tool Usage (STDIO/HTTP)

#### Create Volume with CIFS Share
```javascript
// Works in both STDIO and HTTP/SSE modes
const result = await callTool('cluster_create_volume', {
  cluster_name: 'prod-cluster',
  svm_name: 'data-svm',
  volume_name: 'finance_data',
  size: '500GB',
  cifs_share: {
    share_name: 'finance',
    access_control: [
      { user_or_group: 'finance_team', permission: 'full_control' },
      { user_or_group: 'auditors', permission: 'read' }
    ]
  }
});
```

#### Apply Data Protection
```javascript
// Create snapshot policy
await callTool('create_snapshot_policy', {
  cluster_name: 'prod-cluster',
  svm_name: 'data-svm',
  policy_name: 'finance_backup',
  copies: [
    { count: 24, schedule: { name: 'hourly' } },
    { count: 7, schedule: { name: 'daily' } }
  ]
});

// Apply policy to volume
await callTool('cluster_update_volume', {
  cluster_name: 'prod-cluster',
  volume_uuid: 'volume-uuid-here',
  snapshot_policy: 'finance_backup'
});
```

#### Multi-Cluster Operations
```javascript
// Register a new cluster
await callTool('add_cluster', {
  name: 'dr-cluster',
  cluster_ip: '10.2.2.2',
  username: 'admin',
  password: 'password',
  description: 'Disaster Recovery Cluster'
});

// List all registered clusters
const clusters = await callTool('list_registered_clusters', {});
```

## 🤝 Contributing

This project follows NetApp's development standards with comprehensive testing and authentic demo interfaces. See the detailed architecture documentation in `.github/copilot-instructions.md` for development patterns and guidelines.

### Development Workflow
```bash
npm run build              # Compile TypeScript
npm start                  # Test STDIO mode
npm run start:http         # Test HTTP/SSE mode
./test/run-all-tests.sh    # Run all 19 tests (requires real ONTAP cluster)
```

### Testing Requirements
- All tests require access to a real NetApp ONTAP cluster
- Configure `test/clusters.json` with your cluster details
- Tests use dynamic resource discovery (no hardcoded aggregates/SVMs)
- 100% test coverage requirement: all 19 tests must pass

## 📄 License

[Your License Here]