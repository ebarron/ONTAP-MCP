# Docker Build Conversion to Go

This document describes the Docker image conversion from TypeScript/Node.js to Go.

## Changes Made

### 1. Main Dockerfile (`deployments/docker/Dockerfile`)
**Before:** TypeScript/Node.js multi-stage build
- Stage 1: Install npm dependencies + compile TypeScript
- Stage 2: Run with Node.js runtime (node:20-alpine)
- Image size: ~200MB

**After:** Go multi-stage build
- Stage 1: Build static Go binary with golang:1.23-alpine
- Stage 2: Run with minimal alpine:latest runtime
- Image size: ~20MB (10x smaller!)
- Fully static binary with no external dependencies

### 2. Alternative Dockerfile (`deployments/docker/Dockerfile.go`)
Ultra-minimal scratch-based image:
- Uses `FROM scratch` (empty base image)
- Image size: ~12MB
- No health check support (scratch has no shell)
- For advanced users who want absolute minimum size

### 3. Docker Compose (`deployments/docker-compose.yml`)
**Changes:**
- Removed `NODE_ENV=production` environment variable
- Updated build context to point to repo root (`../..`)
- Updated dockerfile path to `deployments/docker/Dockerfile`
- Added `ONTAP_CLUSTERS` environment variable support
- Health check remains the same (uses wget)

### 4. Makefile Updates
**Changes:**
- Removed `--build-arg NODE_VERSION` (no longer needed)
- Updated Dockerfile path: `-f deployments/docker/Dockerfile`
- Updated description: "Build the MCP server Docker image (Go implementation)"

## Build Instructions

### Local Build
```bash
# Build Go binary first (optional, for local testing)
make build-go

# Build Docker image
make build

# Or manually:
docker build -t ontap-mcp:latest -f deployments/docker/Dockerfile .
```

### Docker Compose
```bash
# From project root
cd deployments
docker-compose up -d

# With cluster configuration
export ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"10.1.1.1","username":"admin","password":"pass"}]'
docker-compose up -d
```

### Direct Docker Run
```bash
# HTTP mode (default)
docker run -p 3000:3000 \
  -e ONTAP_CLUSTERS='[...]' \
  ontap-mcp:latest

# STDIO mode
docker run -i ontap-mcp:latest /opt/ontap-mcp/ontap-mcp-server

# Custom port
docker run -p 8080:8080 \
  -e PORT=8080 \
  ontap-mcp:latest
```

## Image Comparison

| Feature | TypeScript | Go (alpine) | Go (scratch) |
|---------|-----------|-------------|--------------|
| Base Image | node:20-alpine | alpine:latest | scratch |
| Image Size | ~200MB | ~20MB | ~12MB |
| Build Time | ~2-3 min | ~1-2 min | ~1-2 min |
| Runtime Deps | Node.js, libc | libc, ca-certs | None |
| Health Check | ✅ Yes | ✅ Yes | ❌ No |
| Shell Access | ✅ Yes | ✅ Yes | ❌ No |
| Security | Good | Better | Best |

## Benefits of Go Version

1. **10x Smaller Image**: 20MB vs 200MB (alpine) or 12MB (scratch)
2. **Faster Startup**: No Node.js runtime initialization
3. **Lower Memory**: Go binary uses ~20MB vs Node.js ~50MB base
4. **Static Binary**: No runtime dependencies (scratch version)
5. **Better Security**: Minimal attack surface with alpine/scratch
6. **Simpler Debugging**: Single binary, no node_modules complexity

## Migration Notes

- Health check endpoint remains at `/health`
- HTTP mode port remains at 3000 (configurable via PORT env var)
- STDIO mode still supported (override entrypoint)
- Cluster configuration via `ONTAP_CLUSTERS` environment variable
- No breaking changes to external API or behavior

## Testing

```bash
# Build and test locally
make build
docker run -d -p 3000:3000 --name test-mcp ontap-mcp:latest

# Test health endpoint
curl http://localhost:3000/health

# Test MCP protocol
curl http://localhost:3000/mcp

# View logs
docker logs test-mcp

# Clean up
docker stop test-mcp && docker rm test-mcp
```
