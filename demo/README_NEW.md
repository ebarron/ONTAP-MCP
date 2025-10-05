# NetApp ONTAP MCP Demo Interface

A web-based demonstration interface for the NetApp ONTAP MCP (Model Context Protocol) server, featuring authentic NetApp BlueXP styling and comprehensive storage provisioning workflows.

## Overview

This demo provides:
- **Visual Showcase**: NetApp BlueXP-style interface for MCP capabilities
- **End-to-End Testing**: Complete storage provisioning validation
- **AI Assistant**: ChatGPT-powered provisioning recommendations
- **Multi-Server Support**: Connect to multiple MCP servers simultaneously

## 🚀 Quick Start

### Prerequisites
- NetApp ONTAP MCP server built (`npm run build` from project root)
- Python 3 for web server
- Test clusters configured in `test/clusters.json`

### Start Demo (Automated)
```bash
# From ONTAP-MCP root directory
./start-demo.sh

# Access demo at: http://localhost:8080
# MCP API available at: http://localhost:3000
```

The startup script automatically:
- Builds the MCP server if needed
- Loads all clusters from `test/clusters.json`
- Starts MCP HTTP server on port 3000
- Starts demo web server on port 8080
- Validates both servers are responding

### Stop Demo
```bash
./stop-demo.sh
```

### Manual Setup (if needed)
```bash
# Terminal 1: Start MCP HTTP server with clusters
cd /path/to/ONTAP-MCP
export ONTAP_CLUSTERS="$(cat test/clusters.json)"
node build/index.js --http=3000

# Terminal 2: Start demo web server FROM DEMO DIRECTORY
cd demo
python3 -m http.server 8080
```

## Configuration

### MCP Server Configuration (`demo/mcp.json`)

Configure multiple MCP server endpoints without modifying code:

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
  }
}
```

**Setup:**
```bash
cd demo
cp mcp.json.example mcp.json
# Edit mcp.json with your MCP server endpoints
```

**Configuration Properties:**
- **type**: Protocol type (currently "http" only)
- **url**: Full URL to MCP server endpoint
- **description**: Human-readable server description
- **enabled**: Whether server is active

**Fallback**: If `mcp.json` is missing, defaults to `http://localhost:3000`

**Multi-Server Support**: The demo automatically discovers and uses all tools from all enabled servers. Tool routing is completely automatic - no configuration needed.

### ChatGPT Configuration (`demo/chatgpt-config.json`)

Enable AI-powered provisioning assistant:

```bash
cd demo
cp chatgpt-config.json.example chatgpt-config.json
# Add your OpenAI API key
```

**Optional**: Demo works without ChatGPT configuration (uses mock mode)

## Features

### Storage Provisioning Workflow
- **Volume Creation**: End-to-end NFS and CIFS volume provisioning
- **Export Policy Management**: NFS access control configuration
- **CIFS Share Creation**: SMB share setup with ACLs
- **Smart Forms**: SVM-dependent dropdowns with real-time validation
- **Multi-Cluster Support**: Provision across multiple ONTAP clusters

### AI Assistant (ChatGPT Integration)
- **Intelligent Recommendations**: Analyzes requirements and suggests optimal storage locations
- **Capacity Awareness**: Considers aggregate utilization and availability
- **Policy Validation**: Ensures required QoS and snapshot policies exist
- **Natural Language**: Conversational interface for complex provisioning decisions
- **All Tools Available**: Assistant has access to all 47+ ONTAP management tools

### Cluster Management
- **Multi-Cluster Registry**: View and manage multiple ONTAP clusters
- **Real-Time Data**: Live cluster information via MCP API
- **Search Functionality**: Filter clusters with expanding search widget

## Architecture

```
Browser (Demo UI) ↔ HTTP Server (8080) ↔ MCP Server (3000) ↔ ONTAP Clusters
                                      ↔ ChatGPT API (optional)
```

**Components:**
- **Demo UI**: HTML/CSS/JavaScript interface with NetApp BlueXP styling
- **MCP Server**: ONTAP management tools via HTTP API (47+ tools)
- **ChatGPT**: AI-powered provisioning recommendations (optional)
- **ONTAP Clusters**: Target NetApp storage systems

## Project Structure

```
demo/
├── index.html                    # Main interface
├── styles.css                    # NetApp BlueXP styling
├── app.js                        # Main application logic (legacy)
├── mcp.json                      # MCP server configuration
├── chatgpt-config.json          # ChatGPT API configuration
├── js/
│   ├── components/
│   │   ├── ChatbotAssistant.js      # AI provisioning assistant
│   │   ├── ProvisioningPanel.js     # Storage provisioning UI
│   │   └── ExportPolicyModal.js     # NFS policy management
│   ├── core/
│   │   ├── McpApiClient.js          # MCP HTTP client
│   │   ├── McpClientManager.js      # Multi-server manager
│   │   └── McpConfig.js             # Configuration loader
│   └── ui/
│       └── ToastNotifications.js    # User feedback system
└── test/
    ├── test-api.html                # Direct MCP API testing
    ├── run-demo-tests.sh            # Automated test suite
    └── README.md                    # Testing documentation
```

## MCP Tools Available

The demo provides access to 47+ ONTAP management tools:

**Cluster Management:**
- `list_registered_clusters`, `add_cluster`, `get_all_clusters_info`

**Storage Discovery:**
- `cluster_list_svms`, `cluster_list_aggregates`, `cluster_list_volumes`

**Volume Operations:**
- `cluster_create_volume`, `cluster_update_volume`, `cluster_delete_volume`
- `cluster_offline_volume`, `resize_volume`, `get_volume_configuration`

**Policy Management:**
- `list_snapshot_policies`, `list_export_policies`, `cluster_list_qos_policies`
- `create_export_policy`, `add_export_rule`, `cluster_create_qos_policy`

**CIFS/SMB:**
- `cluster_create_cifs_share`, `cluster_list_cifs_shares`, `update_cifs_share`

**And many more...** See [TESTING.md](TESTING.md) for comprehensive tool coverage.

## Documentation

- **[TESTING.md](TESTING.md)** - Comprehensive testing guide and validation procedures
- **[CHATBOT_README.md](CHATBOT_README.md)** - AI assistant setup and configuration
- **[CHATBOT_SYSTEM_PROMPT.md](CHATBOT_SYSTEM_PROMPT.md)** - ChatGPT prompt engineering
- **[AB_TEST_NOTES.md](AB_TEST_NOTES.md)** - A/B testing results and insights

## Development

### Extending the Demo

**Add new MCP tool integration:**
```javascript
// In app.js or component files
async function callNewTool(params) {
    return await this.clientManager.callTool('new_tool_name', params);
}
```

**Add new UI component:**
```javascript
// Create new file in js/components/
class NewComponent {
    constructor(demo) {
        this.demo = demo;
    }
    
    async initialize() {
        // Setup logic
    }
}
```

**Add new test scenario:**
See [TESTING.md](TESTING.md) for testing patterns and examples.

## License

Part of the NetApp ONTAP MCP Server project.
