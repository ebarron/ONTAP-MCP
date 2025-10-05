# NetApp ONTAP MCP Demo Interface

## 🚀 Quick Start

### Prerequisites
- NetApp ONTAP MCP server built (`npm run build`)
- ONTAP cluster credentials configured in `demo/clusters.json`
- Python 3 for web server

### Demo Setup

#### 1. Configure Clusters

Copy the example configuration and edit with your cluster credentials:

```bash
cd demo
cp clusters.json.example clusters.json
```

Edit `clusters.json` with your ONTAP cluster details:

```json
[
  {
    "name": "my-cluster",
    "cluster_ip": "10.193.49.74",
    "username": "admin",
    "password": "Netapp1!",
    "description": "Demo ONTAP Cluster"
  }
]
```

**⚠️ Security Note:** `clusters.json` contains plaintext credentials and is served as a static file. **Only use demo/lab credentials**. This file is gitignored to prevent accidental credential commits.

#### 2. Start Demo

From the ONTAP-MCP root directory:

```bash
./start-demo.sh
```

This automatically:
- Builds the MCP server if needed
- Starts MCP HTTP server on port 3000 with **session-scoped security**
- Starts demo web server on port 8080
- Browser loads clusters from `clusters.json` into your session automatically

Access demo at: **http://localhost:8080**

#### 3. Stop Demo

```bash
./stop-demo.sh
```

### Manual Setup (if needed)

```bash
# Terminal 1: Start MCP HTTP server (NO clusters pre-loaded)
cd /Users/ebarron/ONTAP-MCP
npm run build
node build/index.js --http=3000

# Terminal 2: Start demo web server FROM demo directory
cd /Users/ebarron/ONTAP-MCP/demo  
python3 -m http.server 8080

# Browser: http://localhost:8080
# Clusters auto-load from demo/clusters.json into your session
```

## Overview

This demo provides a web-based NetApp BlueXP-style interface for the ONTAP MCP server, showcasing complete storage provisioning workflows with **session-scoped security isolation**.

## Key Features

### 🔒 Session-Scoped Security

- **Isolated Sessions**: Each browser session maintains its own cluster registry
- **No Cross-Session Access**: Session A cannot access clusters from Session B
- **Automatic Cleanup**: Session expiration removes all cluster credentials
- **Demo Convenience**: Clusters auto-load from `clusters.json` on each page refresh

### 📦 Storage Provisioning

- **Volume Creation**: Complete volume provisioning with NFS and CIFS support
- **Export Policy Management**: NFS export policy configuration and assignment
- **CIFS Share Creation**: SMB shares with ACLs and user/group permissions
- **Smart Forms**: Dynamic dropdowns for SVMs, aggregates, and policies
- **Real-time Validation**: ONTAP-compatible naming and size validation

### 🎨 NetApp BlueXP Design

- **Authentic Styling**: Official NetApp colors, typography, and layout patterns
- **Responsive Design**: Mobile-friendly interface
- **Toast Notifications**: User feedback for all operations
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

The demo supports multi-server MCP configurations. See `MCP_CONFIG_README.md` for details on configuring additional MCP servers (e.g., Harvest metrics).

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
