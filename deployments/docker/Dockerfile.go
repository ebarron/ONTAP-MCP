package docker
# NetApp ONTAP MCP Server - Go Implementation
# Multi-stage build for minimal production image size
# Optimized for both STDIO and HTTP transport modes

# ============================================================================
# Stage 1: Builder - Compile Go binary
# ============================================================================
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates

WORKDIR /build

# Copy go module files
COPY go.mod go.sum ./

# Download dependencies (cached if go.mod/go.sum unchanged)
RUN go mod download

# Copy source code
COPY cmd/ ./cmd/
COPY pkg/ ./pkg/

# Build statically-linked binary for minimal runtime dependencies
# CGO_ENABLED=0 creates a fully static binary (no libc dependency)
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo \
    -ldflags '-extldflags "-static" -s -w' \
    -o ontap-mcp-server ./cmd/ontap-mcp

# ============================================================================
# Stage 2: Runtime - Minimal scratch image
# ============================================================================
FROM scratch

# Metadata labels
LABEL maintainer="NetApp ONTAP MCP"
LABEL description="NetApp ONTAP MCP Server (Go) - Model Context Protocol for ONTAP REST API"
LABEL version="1.0.0-go"

# Copy CA certificates for HTTPS connections to ONTAP clusters
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy compiled binary
COPY --from=builder /build/ontap-mcp-server /ontap-mcp-server

# Environment configuration
ENV PORT=3000

# Expose HTTP port (configurable via PORT env var)
EXPOSE ${PORT}

# Health check not available in scratch image
# Use docker-compose or Kubernetes liveness probes instead

# Start MCP server in HTTP mode
# To use STDIO mode, override ENTRYPOINT with: ["/ontap-mcp-server"]
ENTRYPOINT ["/ontap-mcp-server"]
CMD ["--http=3000"]

# Usage:
#   # HTTP mode (default):
#   docker run -p 3000:3000 -e ONTAP_CLUSTERS='[...]' ontap-mcp:go
#
#   # STDIO mode:
#   docker run -i ontap-mcp:go
#
#   # Custom port:
#   docker run -p 8080:8080 ontap-mcp:go --http=8080
