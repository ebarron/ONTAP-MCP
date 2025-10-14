# Docker Deployment Guide

This guide covers deploying the NetApp ONTAP MCP Server as a containerized HTTP service using Docker.

## 🐳 Overview

The ONTAP MCP Server provides Docker images for:
- **MCP Server** (`ontap-mcp`): HTTP transport mode for browser/web applications
- **Demo UI** (`ontap-mcp-demo`): Optional web interface for testing and demonstration

**Key Features:**
- Multi-stage builds for minimal image size (~150MB for MCP server)
- Health check endpoints for container orchestration
- Configurable port via `PORT` environment variable
- Session-isolated cluster management (no credentials baked in)
- Production-ready with non-root user execution

## 🚀 Quick Start

### Using Make (Recommended)

```bash
# Build and run MCP server only
make run

# Build and run full stack (MCP + Demo UI)
make run-demo

# View help for all targets
make help
```

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Using Docker CLI

```bash
# Build image
docker build -t ontap-mcp:latest .

# Run container
docker run -p 3000:3000 ontap-mcp:latest

# Check health
curl http://localhost:3000/health
```

## 📋 Makefile Targets

The `Makefile` provides build automation similar to NetApp Harvest:

| Target | Description |
|--------|-------------|
| `make build` | Build MCP server Docker image |
| `make build-demo` | Build demo UI Docker image |
| `make build-all` | Build both images |
| `make run` | Build and run MCP server |
| `make run-demo` | Build and run full stack with docker-compose |
| `make test` | Build image and run health checks |
| `make logs` | View logs from all services |
| `make logs-mcp` | View MCP server logs only |
| `make stop` | Stop all running containers |
| `make clean` | Remove built images |
| `make health` | Check health of running services |
| `make help` | Show all available targets |

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `production` | Node.js environment |

### Custom Port Example

```bash
# Using Docker CLI
docker run -p 8080:8080 -e PORT=8080 ontap-mcp:latest

# Using docker-compose.yml
environment:
  - PORT=8080
ports:
  - "8080:8080"
```

## 🔐 Cluster Management

**Security Note:** The Docker image does NOT support `ONTAP_CLUSTERS` environment variable for HTTP mode. Clusters must be registered dynamically via the MCP API for session isolation.

### Adding Clusters via MCP API

```javascript
// Connect to MCP SSE endpoint
GET http://localhost:3000/mcp

// Add cluster via tool call
POST http://localhost:3000/messages?sessionId=<session-id>
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "add_cluster",
    "arguments": {
      "name": "cluster1",
      "cluster_ip": "10.1.1.1",
      "username": "admin",
      "password": "password",
      "description": "Production cluster"
    }
  }
}
```

### Session Isolation

Each MCP session maintains an isolated cluster registry:
- Sessions identified by unique `sessionId` 
- Clusters registered in one session are NOT visible to other sessions
- Session cleanup removes all associated cluster credentials
- Supports multi-tenant deployments

## 🏗️ Docker Compose Architecture

The `docker-compose.yml` defines a complete deployment:

```yaml
services:
  ontap-mcp:      # MCP Server on port 3000
  demo-ui:        # Demo UI on port 8080 (depends on ontap-mcp)
```

**Features:**
- Health checks for both services
- Service dependencies (demo waits for MCP to be healthy)
- Automatic restart on failure
- Isolated network for service communication

### Demo Cluster Auto-Loading

The demo UI automatically loads clusters from `demo/clusters.json` if it exists:

1. **Create clusters configuration:**
   ```bash
   # Copy example and edit with your clusters
   cp demo/clusters.json.example demo/clusters.json
   # Edit demo/clusters.json with your cluster details
   ```

2. **Start with make:**
   ```bash
   make run-demo
   # Demo UI will auto-load clusters from demo/clusters.json
   ```

3. **Volume mounting:**
   - `docker-compose.yml` mounts `./demo/clusters.json` into the container (read-only)
   - If file doesn't exist, demo falls back gracefully (no clusters pre-loaded)
   - Clusters can still be added manually via the demo UI

**Security Note:** `clusters.json` contains credentials and is git-ignored. The volume mount keeps credentials out of the Docker image while allowing convenient auto-loading.
- Isolated network for service communication

## 📊 Health Checks

### MCP Server Health Endpoint

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "server": "NetApp ONTAP MCP Server",
  "version": "2.0.0",
  "transport": "Streamable HTTP (2025-06-18)",
  "clusters": 2,
  "sessions": {
    "active": 3,
    "distribution": {
      "< 5min": 2,
      "5-30min": 1
    }
  },
  "sessionConfig": {
    "inactivityTimeoutMinutes": 30,
    "maxLifetimeHours": 24
  }
}
```

### Container Health Checks

Docker health checks run automatically:
- Interval: 30 seconds
- Timeout: 3 seconds
- Start period: 5 seconds (allows startup time)
- Retries: 3 attempts before marking unhealthy

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs ontap-mcp-server

# Or with docker-compose
docker-compose logs ontap-mcp
```

### Health Check Failing

```bash
# Verify health endpoint
docker exec ontap-mcp-server wget --spider http://localhost:3000/health

# Check if port is exposed
docker port ontap-mcp-server
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Or change port
docker run -p 3001:3001 -e PORT=3001 ontap-mcp:latest
```

### Demo UI Can't Reach MCP Server

```bash
# Verify both containers are on same network
docker network inspect ontap-mcp_mcp-network

# Test connectivity
docker exec ontap-mcp-demo wget http://ontap-mcp:3000/health
```

## 🚢 Registry Publishing (Future)

To publish images to GitHub Container Registry:

```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build and push with registry tags
make DOCKER_REGISTRY=ghcr.io/ebarron push
```

**Note:** Registry publishing is not yet active. Images currently built locally only.

## 📝 Production Considerations

### Resource Limits

Add resource constraints in docker-compose.yml:

```yaml
services:
  ontap-mcp:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Logging

View structured logs:

```bash
# Follow logs in real-time
docker-compose logs -f ontap-mcp

# Filter by severity (if structured logging enabled)
docker-compose logs ontap-mcp | grep ERROR
```

### Persistent Sessions (Optional)

For session persistence across restarts, mount a volume:

```yaml
services:
  ontap-mcp:
    volumes:
      - session-data:/opt/ontap-mcp/data
```

**Security Warning:** This would persist cluster credentials. Only use in controlled single-tenant environments.

## 🔗 Related Documentation

- [README.md](../README.md) - Main project documentation
- [demo/README.md](../demo/README.md) - Demo UI setup guide
- [MCP Protocol Spec](https://spec.modelcontextprotocol.io/specification/2025-06-18/) - MCP specification

## 🆘 Support

For issues or questions:
- GitHub Issues: [ONTAP-MCP Issues](https://github.com/ebarron/ONTAP-MCP/issues)
- Check logs: `make logs`
- Health status: `make health`
