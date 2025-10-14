# Docker Quick Reference

## 🚀 Quick Commands

```bash
# Copy cluster config (optional - enables auto-load)
cp demo/clusters.json.example demo/clusters.json
# Edit demo/clusters.json with your cluster details

# Build and run everything
make run-demo

# View all available commands
make help

# Stop all services
make stop

# View logs
make logs
```

## 📊 Service Access

| Service | URL | Purpose |
|---------|-----|---------|
| MCP Server | http://localhost:3000/mcp | MCP protocol endpoint |
| Health Check | http://localhost:3000/health | Container health status |
| Demo UI | http://localhost:8080 | Web interface for testing |

## 🏗️ What Gets Built

### MCP Server Image (`ontap-mcp:latest`)
- **Base**: Node.js 20 Alpine (~150MB total)
- **Features**: HTTP transport, health checks, session management
- **Security**: Runs as non-root user, no credentials baked in
- **Port**: 3000 (configurable via `PORT` env var)

### Demo UI Image (`ontap-mcp-demo:latest`)
- **Base**: Nginx Alpine (~50MB total)
- **Features**: Static file server, CORS enabled
- **Port**: 8080

## 🔧 Common Tasks

### Development

```bash
# Build TypeScript without Docker
make npm-build

# Install dependencies locally
make npm-install
```

### Testing

```bash
# Build and test health endpoint
make test

# Check running service health
make health
```

### Deployment

```bash
# Full stack with docker-compose (with cluster auto-loading)
cp demo/clusters.json.example demo/clusters.json  # Optional
docker-compose up -d

# MCP server only
docker run -p 3000:3000 ontap-mcp:latest

# Custom port
docker run -p 8080:8080 -e PORT=8080 ontap-mcp:latest
```

**Cluster Auto-Loading:**  
If `demo/clusters.json` exists when you run `make run-demo` or `docker-compose up`, the demo UI will automatically load those clusters into the MCP session on page load. If the file doesn't exist, the demo works normally but starts with no clusters.

### Troubleshooting

```bash
# View MCP server logs
make logs-mcp

# View demo UI logs
make logs-demo

# Open shell in container
make shell

# Check health status
curl http://localhost:3000/health | jq
```

## 📦 Image Registry (Future)

When ready to publish to GitHub Container Registry:

```bash
# Set registry and push
make DOCKER_REGISTRY=ghcr.io/ebarron push
```

## 📝 File Structure

```
ONTAP-MCP/
├── Dockerfile              # MCP server image
├── .dockerignore          # Build exclusions
├── docker-compose.yml     # Multi-service deployment
├── Makefile              # Build automation (like Harvest)
├── demo/
│   └── Dockerfile        # Demo UI image
└── docs/
    └── DOCKER.md         # Complete deployment guide
```

## 🔐 Security Notes

**No Credentials in Container:**
- HTTP mode does NOT support `ONTAP_CLUSTERS` env var
- Clusters must be added via `add_cluster` MCP tool
- Each session has isolated cluster registry
- Sessions auto-expire after inactivity

**For VS Code STDIO mode:**
- Use native Node.js installation (not Docker)
- Credentials in MCP config file (single-user context)

## 📚 Additional Resources

- [Complete Docker Guide](./DOCKER.md)
- [Main README](../README.md)
- [Demo UI Guide](../demo/README.md)
- [MCP Protocol Spec](https://spec.modelcontextprotocol.io/)
