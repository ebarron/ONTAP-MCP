# NetApp ONTAP MCP Server

A Model Context Protocol (MCP) server that provides comprehensive access to NetApp ONTAP storage systems via REST APIs. Supports both single-cluster and multi-cluster management with complete volume lifecycle operations, data protection policies, and NFS/CIFS access control.

**🎯 Major Refactoring Completed: 80% code reduction, 100% test compatibility, modular registry architecture**

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

#### Option A: VS Code MCP Integration
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

#### Option B: HTTP REST API
```bash
# Set cluster configuration
export ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"10.1.1.1","username":"admin","password":"password"}]'

# Start HTTP server
node build/index.js --http=3000

# Test API
curl http://localhost:3000/api/tools/list_registered_clusters
```

## 🛠️ MCP Capabilities

### 48 Storage Management Tools (Registry-Based Architecture)

#### Core Volume Operations (18 tools)
- Complete volume lifecycle: create, read, update, delete, resize
- NFS access control with export policies
- Safe deletion workflow (offline → delete)
- Volume configuration and statistics

#### Data Protection (11 tools)  
- Snapshot policies with flexible scheduling
- Snapshot schedules (cron and interval-based)
- Policy application to volumes
- Automated backup configuration

#### CIFS/SMB Integration (8 tools)
- Complete CIFS share management
- Access control lists with user/group permissions
- Share properties and security configuration
- Integration with volume provisioning

#### Multi-Cluster Management (11 tools)
- Cluster registration and discovery
- Cross-cluster volume operations
- Centralized management interface

### Architecture Highlights
- **Registry System**: All 48 tools managed via central registry (zero duplication)
- **Transport Abstraction**: STDIO and HTTP modes share identical tool implementations
- **Modular Design**: Clean separation of concerns across 7 core modules
- **100% Test Coverage**: 21/21 tests passing with comprehensive validation

### Transport Modes
- **STDIO**: Direct integration with VS Code MCP and AI assistants
- **HTTP REST API**: Web applications, testing, and external integrations
- **Dual Mode**: All 48 tools available in both transports with identical behavior
- **Registry-Based**: Zero duplication between transport implementations

## 📚 Documentation

### Quick Access
- **Demo Interface**: See `demo/README.md` for web interface guide
- **Testing**: See `test/README.md` for comprehensive testing framework
- **HTTP Configuration**: See `HTTP_CONFIG.md` for REST API examples
- **Development**: See `.github/copilot-instructions.md` for architecture details

### Key Features
- **Multi-cluster management** with dynamic registration
- **Complete volume provisioning** with NFS and CIFS support
- **Data protection policies** with automated snapshots
- **Safe deletion workflows** with offline-first requirements

## 🔧 Development

### Architecture Overview
- **Modular Design**: 80% code reduction through systematic refactoring
- **Registry Pattern**: Central tool registration eliminates all duplication
- **Transport Abstraction**: Clean separation between STDIO and HTTP implementations
- **Configuration Management**: Centralized cluster configuration parsing
- **100% Test Compatibility**: All 21 tests pass with new architecture

### Build & Test
```bash
npm run build              # Compile TypeScript (from 1,773 to 349 lines in main)
npm start                  # Test STDIO mode
npm run start:http         # Test HTTP mode
./test/run-all-tests.sh    # Run comprehensive test suite (21/21 passing)
```

## 🖥️ Demo Interface

A complete web-based demonstration interface is available that showcases all MCP capabilities through an authentic NetApp BlueXP-style interface. The demo provides end-to-end volume provisioning workflows including NFS/CIFS configuration, data protection policies, and real-time API validation.

See `demo/README.md` for setup instructions and detailed features.

### Project Structure
```
src/
├── index.ts               # Main server entry point (349 lines, 80% reduction)
├── ontap-client.ts        # ONTAP API client and cluster management
├── config/                # Configuration management
│   └── cluster-config.ts  # Centralized cluster configuration parsing
├── registry/              # Tool registration system
│   ├── tool-registry.ts   # Central tool registry (48 tools)
│   └── register-tools.ts  # Automated tool registration
├── transports/            # Transport layer abstraction
│   ├── base-transport.ts  # Common transport interface
│   ├── stdio-transport.ts # MCP STDIO implementation
│   └── http-transport.ts  # HTTP REST API implementation
├── tools/                 # MCP tool implementations (48 tools total)
│   ├── cluster-management-tools.ts  # Basic cluster operations
│   ├── volume-tools.ts              # Volume lifecycle management
│   ├── snapshot-policy-tools.ts     # Snapshot policy management
│   ├── snapshot-schedule-tools.ts   # Snapshot schedule management
│   ├── export-policy-tools.ts       # NFS export policy management
│   └── cifs-share-tools.ts          # CIFS/SMB share management
└── types/                 # TypeScript type definitions
demo/                      # Web-based demo interface
test/                      # Comprehensive testing framework (21 tests, 100% pass rate)
```

## 🌟 Use Cases

- **AI-Assisted Storage Management**: Direct integration with AI assistants via MCP
- **Automated Provisioning**: Complete volume and share creation workflows
- **Data Protection**: Automated snapshot policy management
- **Multi-Cluster Operations**: Centralized management across ONTAP clusters
- **Development & Testing**: Comprehensive REST API for external applications

## 📦 Examples

### Create Volume with CIFS Share
```javascript
// Via MCP tools
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

### Apply Data Protection
```javascript
// Create snapshot policy and apply to volume
await callTool('create_snapshot_policy', {
  policy_name: 'finance_backup',
  copies: [
    { count: 24, schedule: { name: 'hourly' } },
    { count: 7, schedule: { name: 'daily' } }
  ]
});

await callTool('apply_snapshot_policy_to_volume', {
  volume_uuid: 'volume-uuid',
  policy_name: 'finance_backup'
});
```

## 🤝 Contributing

This project follows NetApp's development standards with comprehensive testing and authentic demo interfaces. 

### Recent Major Improvements (September 2025)
- **80% Code Reduction**: Refactored monolithic 1,773-line index.ts into modular 349-line architecture
- **Registry System**: Eliminated all code duplication through central tool registry
- **Transport Abstraction**: Clean separation between STDIO and HTTP implementations
- **100% Test Compatibility**: All 21 comprehensive tests pass with new architecture
- **Modular Design**: 7 core modules with clear separation of concerns

See the detailed architecture documentation in `.github/copilot-instructions.md` for development patterns and guidelines.

## 📄 License

[Your License Here]