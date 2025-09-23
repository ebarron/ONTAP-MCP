# NetApp ONTAP MCP Server

A Model Context Protocol (MCP) server that provides comprehensive access to NetApp ONTAP storage systems via REST APIs. Supports both single-cluster and multi-cluster management with complete volume lifecycle operations, data protection policies, and NFS/CIFS access control.

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

#### Option A: Demo Interface (Recommended)
```bash
# Automated startup - loads test clusters and starts both servers
./start-demo.sh

# Access demo at: http://localhost:8080
# MCP API available at: http://localhost:3000
```

#### Option B: VS Code MCP Integration
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

#### Option C: HTTP REST API
```bash
# Set cluster configuration
export ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"10.1.1.1","username":"admin","password":"password"}]'

# Start HTTP server
node build/index.js --http=3000

# Test API
curl http://localhost:3000/api/tools/list_registered_clusters
```

## 🛠️ MCP Capabilities

### 49 Storage Management Tools

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

#### Multi-Cluster Management (12+ tools)
- Cluster registration and discovery
- Cross-cluster volume operations
- Centralized management interface

### Transport Modes
- **STDIO**: Direct integration with VS Code MCP and AI assistants
- **HTTP REST API**: Web applications, testing, and external integrations
- **Dual Mode**: All 49 tools available in both transports

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
- **Real-time validation** through authentic NetApp BlueXP demo interface

## 🔧 Development

### Build & Test
```bash
npm run build              # Compile TypeScript
npm start                  # Test STDIO mode
npm run start:http         # Test HTTP mode
./test/run-all-tests.sh    # Run comprehensive test suite
```

### Project Structure
```
src/
├── index.ts               # Main server and transport detection
├── ontap-client.ts        # ONTAP API client and cluster management
├── tools/                 # MCP tool implementations (46 tools)
├── types/                 # TypeScript type definitions
demo/                      # Web-based demo interface
test/                      # Comprehensive testing framework
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

This project follows NetApp's development standards with comprehensive testing and authentic demo interfaces. See the detailed architecture documentation in `.github/copilot-instructions.md` for development patterns and guidelines.

## 📄 License

[Your License Here]