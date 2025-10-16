# NetApp ONTAP MCP Demo# NetApp ONTAP MCP Demo Interface



Web-based interface showcasing NetApp ONTAP MCP capabilities with BlueXP-style UI.## 🚀 Quick Start



## Quick Start### Prerequisites

- NetApp ONTAP MCP server built (`npm run build`)

```bash- ONTAP cluster credentials configured in `demo/clusters.json`

# From project root- Python 3 for web server

./start-demo.sh

### Demo Setup

# Access at http://localhost:8080

# MCP server runs on http://localhost:3000#### 1. Configure Clusters

```

Copy the example configuration and edit with your cluster credentials:

## Prerequisites

```bash

- Node.js and npmcd demo

- Python 3 (for web server)cp clusters.json.example clusters.json

- ONTAP cluster credentials in `test/clusters.json````



## What's IncludedEdit `clusters.json` with your ONTAP cluster details:



- **Storage Provisioning**: Create volumes with NFS/CIFS, set QoS policies, manage snapshots```json

- **Alert Monitoring**: View and remediate 900+ Prometheus alerts with Fix-It actions[

- **AI Assistant**: ChatGPT-powered provisioning recommendations  {

- **Multi-Cluster**: Manage multiple ONTAP clusters from single interface    "name": "my-cluster",

    "cluster_ip": "10.193.49.74",

## Configuration    "username": "admin",

    "password": "Netapp1!",

### Clusters    "description": "Demo ONTAP Cluster"

Uses `test/clusters.json` (shared with test suite):  }

```bash]

cp test/clusters.json.example test/clusters.json```

# Edit with your cluster credentials

```**⚠️ Security Note:** `clusters.json` contains plaintext credentials and is served as a static file. **Only use demo/lab credentials**. This file is gitignored to prevent accidental credential commits.



### ChatGPT (Optional)#### 2. Start Demo

For AI assistant features:

```bashFrom the ONTAP-MCP root directory:

cp demo/chatgpt-config.json.example demo/chatgpt-config.json

# Add your OpenAI API key```bash

```./start-demo.sh

```

## Directory Structure

This automatically:

```- Builds the MCP server if needed

demo/- Starts MCP HTTP server on port 3000 with **session-scoped security**

├── index.html              # Main UI- Starts demo web server on port 8080

├── app.js                  # Application logic- Browser loads clusters from `clusters.json` into your session automatically

├── alert_rules.yml         # Alert remediation rules

├── js/Access demo at: **http://localhost:8080**

│   ├── components/         # UI components (AlertsView, FixItModal, ChatbotAssistant, etc.)

│   ├── core/               # MCP client, parameter resolver, utilities#### 3. Stop Demo

│   └── ui/                 # Toast notifications

└── test/                   # API and integration tests```bash

```./stop-demo.sh

```

## Key Features

### Fix-It Actions

- **Dynamic Tool Discovery**: Auto-discovers all 51 ONTAP MCP tools

- **Parameter Resolution**: Automatically resolves volume UUIDs and cluster names

- **Smart Mapping**: Maps ONTAP CLI commands to MCP tools via LLM

- **Undo Support**: Reversible actions with one-click rollback



## Testing# Browser: http://localhost:8080

# Clusters auto-load from demo/clusters.json into your session

```bash```

# Test MCP tools directly

node test/mcp-test-client.js cluster_list_volumes '{"cluster_name":"my-cluster"}'## Overview



# Interactive API testingThis demo provides a web-based NetApp BlueXP-style interface for the ONTAP MCP server, showcasing complete storage provisioning workflows with **session-scoped security isolation**.

open demo/test/test-api.html

```## Key Features



## Troubleshooting### 🔒 Session-Scoped Security



**Demo won't start:**- **Isolated Sessions**: Each browser session maintains its own cluster registry

- Check ports 3000 and 8080 are available- **No Cross-Session Access**: Session A cannot access clusters from Session B

- Ensure MCP server built: `npm run build`- **Automatic Cleanup**: Session expiration removes all cluster credentials

- Check logs: `tail -f mcp-server.log demo-server.log`- **Demo Convenience**: Clusters auto-load from `clusters.json` on each page refresh



**No clusters shown:**### 📦 Storage Provisioning

- Verify `test/clusters.json` exists and has valid credentials

- Check browser console for connection errors- **Volume Creation**: Complete volume provisioning with NFS and CIFS support

- **Export Policy Management**: NFS export policy configuration and assignment

**Fix-It buttons not working:**- **CIFS Share Creation**: SMB shares with ACLs and user/group permissions

- **Smart Forms**: Dynamic dropdowns for SVMs, aggregates, and policies

- Check MCP server logs for tool execution errors

- **Real-time Validation**: ONTAP-compatible naming and size validation



## Documentation### 🎨 NetApp BlueXP Design



- `CHATBOT_README.md` - AI assistant setup- **Authentic Styling**: Official NetApp colors, typography, and layout patterns

- `MCP_CONFIG_README.md` - MCP server configuration- **Responsive Design**: Mobile-friendly interface

- `../README.md` - Main project documentation- **Toast Notifications**: User feedback for all operations

- **Loading States**: Visual feedback during API calls

## Architecture

### Session Isolation

**Browser Session Flow:**
1. Browser connects → Creates SSE session → Gets unique `sessionId`
2. Browser fetches `clusters.json` → Calls `add_cluster` for each → Adds to **this session only**
3. Browser refresh → New `sessionId` → Repeats step 2 (seamless UX)
4. Session expires → Cluster credentials automatically removed

**Security Model:**
- MCP server: Session-scoped cluster managers (secure)
- Demo browser: Loads from `clusters.json` (insecure, but isolated to demo)
- Production clients: Must use `add_cluster` API (no static file loading)

### File Structure

```
demo/
├── index.html              # Main interface
├── styles.css              # NetApp BlueXP styling
├── app.js                  # Demo application logic
├── clusters.json           # Cluster configs (gitignored, auto-loads)
├── clusters.json.example   # Template for users
├── mcp.json                # MCP server configuration (optional)
├── mcp.json.example        # MCP config template
└── js/
    ├── components/         # UI components (provisioning, chatbot, etc.)
    ├── core/               # MCP API client
    └── ui/                 # Notifications and utilities
```

## Demo vs Production

| Aspect | Demo (Browser) | Production (MCP Clients) |
|--------|---------------|--------------------------|
| Cluster Loading | Auto-loads from `clusters.json` | Must use `add_cluster` API |
| Security | Credentials in static file | Credentials never in files |
| Session Isolation | ✅ Enforced by server | ✅ Enforced by server |
| Use Case | Local testing, demos | Production integrations |

## MCP Server Configuration

The demo supports multi-server MCP configurations. See `MCP_CONFIG_README.md` for details on configuring additional MCP servers.

## Development

### Testing Changes

```bash
# Make changes to demo files
# Rebuild if TypeScript changed
npm run build

# Restart demo
./stop-demo.sh && ./start-demo.sh
```

### Cluster Configuration Tips

- **Multiple Clusters**: Add multiple entries to `clusters.json` array
- **Test Clusters**: Use same format as `test/clusters.json`
- **Credentials**: Keep lab/demo credentials separate from production
- **Git Safety**: `clusters.json` is gitignored automatically

## Troubleshooting

### Clusters Not Loading

1. Check `clusters.json` exists in `demo/` directory
2. Verify JSON syntax is valid: `cat demo/clusters.json | jq`
3. Check browser console for errors
4. Verify MCP server is running: `curl http://localhost:3000/health`

### Session Issues

- Sessions expire after 20 minutes of inactivity
- Browser refresh creates new session (clusters auto-reload)
- Clear browser cache if seeing stale data

### Port Conflicts

- MCP server: Port 3000 (change with `--http=PORT`)
- Demo web server: Port 8080 (change with `python3 -m http.server PORT`)

## Security Considerations

**Demo Environment Only:**
- `clusters.json` served as static file with plaintext credentials
- Acceptable for localhost demo with lab credentials
- **DO NOT** use production credentials or deploy publicly

**Production Clients:**
- Use `add_cluster` API with encrypted transport
- Implement proper authentication and session management
- Never store credentials in static files

## Next Steps

- See main `README.md` for complete MCP server documentation
- See `CHATBOT_README.md` for AI assistant integration
- See `test/` directory for automated testing examples

## License

Same as parent ONTAP-MCP project.
