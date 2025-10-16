# Go Rewrite Proposal: NetApp ONTAP MCP Server

**Version:** 1.0  
**Date:** October 16, 2025  
**Status:** Proposal  

## Executive Summary

This proposal outlines a comprehensive plan to rewrite the NetApp ONTAP MCP Server from TypeScript to Go, aligning with NetApp Harvest's code style and architecture while preserving existing test suites and demo functionality.

**Current State:**
- **Language:** TypeScript (Node.js)
- **Lines of Code:** ~10,210 lines
- **Source Files:** 28 TypeScript files
- **MCP Tools:** 51 tools across 9 tool modules
- **Test Suite:** 19 integration tests (JavaScript-based MCP client)
- **Demo:** Browser-based UI (HTML/CSS/JavaScript)
- **Transports:** Dual STDIO/HTTP (MCP Protocol 2025-06-18)

**Target State:**
- **Language:** Go 1.21+
- **Style Alignment:** NetApp Harvest code conventions
- **Architecture:** `cmd/pkg` standard layout
- **Preserved:** All 19 tests, demo UI, Docker support
- **Enhanced:** Performance, memory efficiency, single binary deployment

---

## 1. Strategic Rationale

### 1.1 Why Go?

**Alignment with NetApp Harvest:**
- Harvest is written in Go with ~171 stars, 45 forks, active development
- Shared ecosystem for ONTAP monitoring/management
- Consistent tooling, build processes, and deployment patterns
- Enables potential future integration between MCP and Harvest

**Technical Benefits:**
- **Performance:** Native compilation, lower memory footprint
- **Deployment:** Single static binary vs Node.js runtime dependency
- **Concurrency:** Native goroutines for handling multiple MCP sessions
- **Type Safety:** Compile-time validation (vs TypeScript runtime)
- **Standard Library:** Excellent HTTP, JSON, and crypto support built-in

**Operational Benefits:**
- **Docker Images:** Smaller images (~10MB vs ~100MB+ with Node.js)
- **Startup Time:** Faster cold starts
- **Resource Usage:** Lower memory consumption for long-running processes
- **Security:** Reduced attack surface (no npm supply chain risks)

### 1.2 Preservation Strategy

**What Stays Unchanged:**
1. **Test Suite (JavaScript):** All 19 tests remain as integration tests
   - Tests run against HTTP transport (language-agnostic)
   - Validates MCP protocol compliance
   - No rewrite needed - acts as acceptance criteria

2. **Demo UI (Browser):** HTML/CSS/JavaScript frontend unchanged
   - Consumes MCP HTTP/SSE endpoints
   - Language-agnostic client
   - Validates real-world usage patterns

3. **MCP Protocol:** Full compliance with spec 2025-06-18
   - STDIO transport for VS Code integration
   - HTTP transport for web/browser clients
   - JSON-RPC 2.0 message format

4. **Tool Functionality:** All 51 tools preserve exact behavior
   - Same input parameters (Zod → Go struct validation)
   - Same output formats
   - Same error handling patterns

---

## 2. Architecture Design

### 2.1 Directory Structure (Harvest-Aligned)

Following Harvest's `cmd/pkg` pattern:

```
ontap-mcp-go/
├── cmd/
│   └── ontap-mcp/
│       └── main.go                 # Entry point, CLI argument parsing
│
├── pkg/
│   ├── mcp/
│   │   ├── server.go              # MCP server implementation
│   │   ├── session.go             # Session management
│   │   ├── transport_stdio.go     # STDIO transport
│   │   └── transport_http.go      # HTTP/SSE transport
│   │
│   ├── ontap/
│   │   ├── client.go              # ONTAP REST API client
│   │   ├── cluster_manager.go     # Multi-cluster registry
│   │   ├── auth.go                # Authentication/TLS handling
│   │   └── errors.go              # ONTAP-specific error types
│   │
│   ├── tools/
│   │   ├── registry.go            # Tool registration system
│   │   ├── types.go               # Common tool types
│   │   ├── volume.go              # Volume management tools
│   │   ├── cifs.go                # CIFS share tools
│   │   ├── nfs.go                 # Export policy tools
│   │   ├── snapshot.go            # Snapshot policy tools
│   │   ├── qos.go                 # QoS policy tools
│   │   ├── cluster.go             # Cluster management tools
│   │   └── autosize.go            # Volume autosize tools
│   │
│   ├── config/
│   │   ├── config.go              # Configuration loading
│   │   └── clusters.go            # Cluster configuration types
│   │
│   └── util/
│       ├── logger.go              # Structured logging
│       ├── validator.go           # Input validation
│       └── http.go                # HTTP utilities
│
├── test/                          # PRESERVED: JavaScript test suite
│   ├── run-all-tests.sh          # Existing test runner
│   ├── mcp-test-client.js        # MCP SSE client
│   └── integration/              # 19 integration tests
│
├── demo/                          # PRESERVED: Web UI
│   ├── index.html
│   ├── app.js
│   └── js/
│
├── docker/
│   ├── Dockerfile                # Go multi-stage build
│   └── docker-compose.yml
│
├── docs/
│   ├── ARCHITECTURE.md           # Go architecture docs
│   └── MIGRATION.md              # TS → Go migration notes
│
├── go.mod                        # Go modules
├── go.sum
├── Makefile                      # Build automation (Harvest style)
├── .golangci.yml                 # Linter config (from Harvest)
└── README.md
```

### 2.2 Code Style Alignment with Harvest

**Follow Harvest Conventions:**

1. **Package Structure:**
   - `cmd/` for executables
   - `pkg/` for reusable packages
   - Flat package hierarchy (avoid deep nesting)

2. **Naming Conventions:**
   ```go
   // Harvest style: clear, concise names
   type ClusterManager struct {
       clusters map[string]*ClusterConfig
       mu       sync.RWMutex
   }
   
   // Methods: verb-first for actions
   func (cm *ClusterManager) AddCluster(cfg *ClusterConfig) error
   func (cm *ClusterManager) GetClient(name string) (*Client, error)
   ```

3. **Error Handling:**
   ```go
   // Harvest pattern: return errors, don't panic
   if err != nil {
       return fmt.Errorf("failed to create volume: %w", err)
   }
   ```

4. **Logging:**
   ```go
   // Use structured logging (likely zerolog or zap)
   log.Info().
       Str("cluster", clusterName).
       Str("volume", volumeName).
       Msg("Volume created successfully")
   ```

5. **Configuration:**
   ```go
   // Environment variables + config files (like Harvest)
   type Config struct {
       Clusters []ClusterConfig `yaml:"clusters"`
       Server   ServerConfig    `yaml:"server"`
   }
   ```

6. **Testing:**
   - Unit tests: `*_test.go` files alongside code
   - Table-driven tests for multiple scenarios
   - Integration tests: preserved JavaScript suite

### 2.3 MCP Protocol Implementation

**Go MCP SDK Options:**

1. **Option A: Port @modelcontextprotocol/sdk to Go**
   - Create `pkg/mcp/` package implementing MCP spec
   - JSON-RPC 2.0 message handling
   - STDIO and HTTP transports
   - Session management

2. **Option B: Use existing Go MCP library (if available)**
   - Research community Go MCP implementations
   - Evaluate maturity and spec compliance

**Recommended: Option A** (full control, aligned with Harvest's self-contained approach)

```go
// pkg/mcp/server.go
type Server struct {
    tools    *tools.Registry
    sessions *SessionManager
    config   *ServerConfig
}

func (s *Server) HandleRequest(ctx context.Context, req *JSONRPCRequest) (*JSONRPCResponse, error) {
    switch req.Method {
    case "initialize":
        return s.handleInitialize(ctx, req)
    case "tools/list":
        return s.listTools(ctx)
    case "tools/call":
        return s.callTool(ctx, req)
    default:
        return nil, ErrMethodNotFound
    }
}
```

---

## 3. Implementation Phases

### Phase 1: Foundation (2-3 weeks)

**Deliverables:**
- Go project structure with `cmd/pkg` layout
- MCP protocol implementation (STDIO + HTTP transports)
- Basic tool registry system
- Configuration loading (ONTAP_CLUSTERS env var)
- Logging infrastructure

**Validation:**
- `go build` produces working binary
- STDIO mode connects to VS Code MCP
- HTTP mode serves SSE endpoints
- Can register and list 1-2 sample tools

**Success Criteria:**
```bash
# Build
make build
./bin/ontap-mcp --version

# Run STDIO mode
./bin/ontap-mcp

# Run HTTP mode
./bin/ontap-mcp --http=3000
curl http://localhost:3000/mcp  # SSE stream
```

### Phase 2: ONTAP Client (2 weeks)

**Deliverables:**
- ONTAP REST API client (`pkg/ontap/client.go`)
- Multi-cluster manager (`pkg/ontap/cluster_manager.go`)
- HTTP client with TLS support
- Authentication handling
- Error mapping (ONTAP errors → MCP errors)

**Validation:**
- Can authenticate to real ONTAP cluster
- Can make basic API calls (GET /api/cluster)
- Multi-cluster registry works
- Error handling is robust

**Success Criteria:**
```bash
# Test ONTAP connectivity
export ONTAP_CLUSTERS='[{"name":"test","cluster_ip":"10.1.1.1","username":"admin","password":"pass"}]'
./bin/ontap-mcp --test-connection
```

### Phase 3: Core Tools (3-4 weeks)

**Deliverables:**
Implement all 51 tools across 9 modules:
- Cluster management (4 tools)
- Volume operations (18 tools)
- CIFS shares (8 tools)
- Export policies (9 tools)
- Snapshot policies (4 tools)
- Snapshot schedules (4 tools)
- QoS policies (5 tools)
- Volume autosize (2 tools)
- Volume snapshots (4 tools)

**Validation:**
- Each tool passes unit tests
- Tool definitions match TypeScript versions
- Parameter validation works (Go struct tags)

**Success Criteria:**
```bash
# Run integration tests against Go server
cd test
./run-all-tests.sh  # All 19 tests pass
```

### Phase 4: Integration & Testing (1-2 weeks)

**Deliverables:**
- All 19 JavaScript integration tests passing
- Demo UI working with Go backend
- Docker image built and tested
- Documentation updated

**Validation:**
- `./test/run-all-tests.sh` → 100% pass rate
- Demo UI functional at `http://localhost:8080`
- Docker container runs successfully
- VS Code MCP integration works

**Success Criteria:**
```bash
# Integration tests
cd test && ./run-all-tests.sh
# Expected: 19/19 tests passed

# Demo
./start-demo.sh
# Browser: http://localhost:8080 works

# Docker
docker build -t ontap-mcp-go .
docker run -e ONTAP_CLUSTERS='...' ontap-mcp-go --http=3000
```

### Phase 5: Optimization & Polish (1 week)

**Deliverables:**
- Performance tuning (connection pooling, caching)
- Memory optimization
- Comprehensive error messages
- Code documentation (GoDoc)
- Final linting with `.golangci.yml` from Harvest

**Validation:**
- golangci-lint passes
- go vet passes
- Benchmarks show performance improvement
- Memory profiling shows reduced footprint

---

## 4. Tool Migration Strategy

### 4.1 TypeScript → Go Mapping

**Example: Volume Creation Tool**

**TypeScript (current):**
```typescript
// src/tools/volume-tools.ts
const CreateVolumeSchema = z.object({
  cluster_name: z.string().optional(),
  cluster_ip: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  svm_name: z.string().describe("Name of the SVM"),
  volume_name: z.string().describe("Name of the new volume"),
  size: z.string().describe("Size (e.g., '100GB', '1TB')"),
  aggregate_name: z.string().optional(),
});

export async function handleClusterCreateVolume(
  args: any,
  clusterManager: OntapClusterManager
): Promise<any> {
  const validated = CreateVolumeSchema.parse(args);
  const client = getApiClient(clusterManager, validated.cluster_name, ...);
  
  const response = await client.createVolume({
    svm: validated.svm_name,
    name: validated.volume_name,
    size: validated.size,
    aggregate: validated.aggregate_name,
  });
  
  return {
    uuid: response.uuid,
    name: response.name,
    message: "Volume created successfully",
  };
}
```

**Go (target):**
```go
// pkg/tools/volume.go
type CreateVolumeRequest struct {
    ClusterName   string `json:"cluster_name,omitempty"`
    ClusterIP     string `json:"cluster_ip,omitempty"`
    Username      string `json:"username,omitempty"`
    Password      string `json:"password,omitempty"`
    SvmName       string `json:"svm_name" validate:"required"`
    VolumeName    string `json:"volume_name" validate:"required"`
    Size          string `json:"size" validate:"required"`
    AggregateName string `json:"aggregate_name,omitempty"`
}

func (t *VolumeTools) CreateVolume(ctx context.Context, req CreateVolumeRequest) (*mcp.ToolResponse, error) {
    // Validate input
    if err := validate.Struct(req); err != nil {
        return nil, fmt.Errorf("validation failed: %w", err)
    }
    
    // Get ONTAP client
    client, err := t.clusterMgr.GetClient(req.ClusterName, req.ClusterIP, req.Username, req.Password)
    if err != nil {
        return nil, fmt.Errorf("cluster connection failed: %w", err)
    }
    
    // Create volume
    params := &ontap.CreateVolumeParams{
        Svm:       req.SvmName,
        Name:      req.VolumeName,
        Size:      req.Size,
        Aggregate: req.AggregateName,
    }
    
    resp, err := client.CreateVolume(ctx, params)
    if err != nil {
        return nil, fmt.Errorf("volume creation failed: %w", err)
    }
    
    return &mcp.ToolResponse{
        Content: []mcp.Content{
            {
                Type: "text",
                Text: fmt.Sprintf("Volume created successfully\nUUID: %s\nName: %s", resp.UUID, resp.Name),
            },
        },
    }, nil
}

// Tool registration
func RegisterVolumeTools(registry *tools.Registry, clusterMgr *ontap.ClusterManager) {
    vt := &VolumeTools{clusterMgr: clusterMgr}
    
    registry.Register(&tools.Tool{
        Name:        "cluster_create_volume",
        Description: "Create a volume on a registered cluster by cluster name with optional CIFS share configuration",
        InputSchema: tools.GenerateSchema(CreateVolumeRequest{}),
        Handler:     vt.CreateVolume,
    })
}
```

### 4.2 Validation Strategy

**TypeScript uses Zod:**
```typescript
const schema = z.object({
  volume_name: z.string().min(1).max(255),
  size: z.string().regex(/^\d+[KMGT]B$/),
});
```

**Go options:**
1. **`go-playground/validator`** (recommended, matches Harvest style)
   ```go
   type Request struct {
       VolumeName string `validate:"required,min=1,max=255"`
       Size       string `validate:"required,size_format"`
   }
   ```

2. **Custom validation functions**
   ```go
   func validateVolumeSize(size string) error {
       matched, _ := regexp.MatchString(`^\d+[KMGT]B$`, size)
       if !matched {
           return fmt.Errorf("invalid size format: %s", size)
       }
       return nil
   }
   ```

### 4.3 JSON Schema Generation

**TypeScript:** Uses Zod's built-in schema generation
**Go:** Use struct tags + reflection

```go
// pkg/util/schema.go
func GenerateJSONSchema(v interface{}) map[string]interface{} {
    t := reflect.TypeOf(v)
    properties := make(map[string]interface{})
    required := []string{}
    
    for i := 0; i < t.NumField(); i++ {
        field := t.Field(i)
        jsonTag := field.Tag.Get("json")
        validateTag := field.Tag.Get("validate")
        
        if strings.Contains(validateTag, "required") {
            required = append(required, jsonTag)
        }
        
        properties[jsonTag] = map[string]interface{}{
            "type":        goTypeToJSONType(field.Type),
            "description": field.Tag.Get("description"),
        }
    }
    
    return map[string]interface{}{
        "type":       "object",
        "properties": properties,
        "required":   required,
    }
}
```

---

## 5. Docker Strategy

### 5.1 Multi-Stage Dockerfile (Go)

**Current (TypeScript):**
- Base: `node:20-alpine` (~100MB+)
- Build: npm install + TypeScript compilation
- Runtime: Full Node.js + node_modules

**Target (Go):**
```dockerfile
# Stage 1: Builder
FROM golang:1.21-alpine AS builder

WORKDIR /build

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o ontap-mcp ./cmd/ontap-mcp

# Stage 2: Runtime
FROM alpine:3.19

# Install CA certificates for HTTPS
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/ontap-mcp .

# Expose HTTP port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Run as non-root
RUN adduser -D -u 1000 ontap
USER ontap

ENTRYPOINT ["./ontap-mcp"]
CMD ["--http=3000"]
```

**Image Size Comparison:**
- TypeScript: ~120MB
- Go: ~15MB (93% reduction)

### 5.2 Docker Compose

**Minimal changes needed:**
```yaml
version: '3.8'

services:
  ontap-mcp:
    build: .
    image: ontap-mcp-go:latest
    container_name: ontap-mcp-server
    ports:
      - "3000:3000"
    environment:
      - ONTAP_CLUSTERS=${ONTAP_CLUSTERS}
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

---

## 6. Test Preservation Strategy

### 6.1 Integration Test Compatibility

**Current Test Suite:**
- **Language:** JavaScript (Node.js)
- **Test Count:** 19 integration tests
- **Transport:** HTTP/SSE (language-agnostic)
- **Validation:** MCP protocol compliance, tool functionality

**No Changes Needed:**
The test suite acts as acceptance criteria. As long as the Go server:
1. Implements MCP protocol correctly (HTTP/SSE transport)
2. Returns responses in the same format
3. Handles errors consistently

The tests will pass without modification.

**Test Runner Compatibility:**
```bash
# test/run-all-tests.sh
# Already language-agnostic - tests HTTP endpoints

# Before (TypeScript server):
npm run build
node build/index.js --http=3000 &
sleep 2
./test/run-all-tests.sh

# After (Go server):
go build -o bin/ontap-mcp ./cmd/ontap-mcp
./bin/ontap-mcp --http=3000 &
sleep 2
./test/run-all-tests.sh

# Same tests, same results
```

### 6.2 Demo Preservation

**Demo UI:** Pure HTML/CSS/JavaScript
- **Backend Dependency:** HTTP/SSE endpoints only
- **No Code Changes:** Demo consumes standard MCP protocol
- **Validation:** Visual testing, workflow testing

**Start Script Update:**
```bash
# start-demo.sh (minimal change)
#!/bin/bash

# Load clusters
export ONTAP_CLUSTERS="$(cat test/clusters.json)"

# Start Go MCP server (was: node build/index.js)
./bin/ontap-mcp --http=3000 &
MCP_PID=$!

# Start demo web server (unchanged)
cd demo && python3 -m http.server 8080 &
DEMO_PID=$!

echo "Demo ready at http://localhost:8080"
```

---

## 7. Migration Checklist

### 7.1 Pre-Migration Preparation

- [ ] Document current TypeScript architecture
- [ ] Baseline test coverage (19/19 passing)
- [ ] Baseline demo functionality
- [ ] Create Git branch: `go-rewrite`
- [ ] Set up Go development environment
- [ ] Clone Harvest repository for style reference

### 7.2 Development Milestones

**Phase 1: Foundation**
- [ ] Initialize Go modules (`go mod init`)
- [ ] Create `cmd/pkg` directory structure
- [ ] Implement MCP protocol (STDIO transport)
- [ ] Implement MCP protocol (HTTP transport)
- [ ] Session management
- [ ] Tool registry system
- [ ] Configuration loading
- [ ] Logging infrastructure
- [ ] VS Code MCP connection works

**Phase 2: ONTAP Client**
- [ ] REST API client implementation
- [ ] TLS/authentication handling
- [ ] Multi-cluster manager
- [ ] Error handling
- [ ] Connection pooling
- [ ] Test with real ONTAP cluster

**Phase 3: Tool Migration (51 tools)**

Cluster Management (4 tools):
- [ ] `add_cluster`
- [ ] `list_registered_clusters`
- [ ] `get_all_clusters_info`
- [ ] `cluster_list_svms`

Volume Tools (18 tools):
- [ ] `cluster_list_volumes`
- [ ] `cluster_create_volume`
- [ ] `cluster_delete_volume`
- [ ] `cluster_get_volume_stats`
- [ ] `get_volume_configuration`
- [ ] `update_volume_security_style`
- [ ] `resize_volume`
- [ ] `update_volume_comment`
- [ ] `configure_volume_nfs_access`
- [ ] `disable_volume_nfs_access`
- [ ] `update_volume`
- [ ] `cluster_update_volume`
- [ ] (+ 6 more volume tools)

CIFS Tools (8 tools):
- [ ] `list_cifs_shares`
- [ ] `get_cifs_share`
- [ ] `create_cifs_share`
- [ ] `update_cifs_share`
- [ ] `delete_cifs_share`
- [ ] `cluster_list_cifs_shares`
- [ ] `cluster_create_cifs_share`
- [ ] `cluster_delete_cifs_share`

Export Policy Tools (9 tools):
- [ ] `list_export_policies`
- [ ] `get_export_policy`
- [ ] `create_export_policy`
- [ ] `delete_export_policy`
- [ ] `add_export_rule`
- [ ] `update_export_rule`
- [ ] `delete_export_rule`
- [ ] (+ 2 more)

Snapshot Policy Tools (4 tools):
- [ ] `create_snapshot_policy`
- [ ] `list_snapshot_policies`
- [ ] `get_snapshot_policy`
- [ ] `delete_snapshot_policy`

QoS Policy Tools (5 tools):
- [ ] `cluster_list_qos_policies`
- [ ] `cluster_create_qos_policy`
- [ ] `cluster_get_qos_policy`
- [ ] `cluster_update_qos_policy`
- [ ] `cluster_delete_qos_policy`

Volume Autosize Tools (2 tools):
- [ ] `cluster_enable_volume_autosize`
- [ ] `cluster_get_volume_autosize_status`

Volume Snapshot Tools (4 tools):
- [ ] `cluster_list_volume_snapshots`
- [ ] `cluster_get_volume_snapshot_info`
- [ ] `cluster_delete_volume_snapshot`
- [ ] (+ 1 more)

Snapshot Schedule Tools (4 tools):
- [ ] `create_snapshot_schedule`
- [ ] `list_snapshot_schedules`
- [ ] `get_snapshot_schedule`
- [ ] `delete_snapshot_schedule`

**Phase 4: Integration**
- [ ] All 19 integration tests passing
- [ ] Demo UI functional
- [ ] Docker build successful
- [ ] VS Code integration working
- [ ] Documentation updated

**Phase 5: Optimization**
- [ ] golangci-lint passing (Harvest config)
- [ ] go vet passing
- [ ] Performance benchmarks
- [ ] Memory profiling
- [ ] Code review alignment with Harvest style

### 7.3 Validation Gates

Each phase must meet these criteria before proceeding:

**Gate 1 (Foundation):**
- [ ] `go build` succeeds
- [ ] Binary runs in STDIO mode
- [ ] Binary runs in HTTP mode
- [ ] SSE stream works
- [ ] At least 1 tool callable

**Gate 2 (ONTAP Client):**
- [ ] Connects to real ONTAP cluster
- [ ] Multi-cluster registry works
- [ ] Error handling validated
- [ ] Unit tests passing

**Gate 3 (Tools):**
- [ ] All 51 tools implemented
- [ ] Unit tests for each tool
- [ ] At least 10 integration tests passing

**Gate 4 (Integration):**
- [ ] **19/19 integration tests passing** (MANDATORY)
- [ ] Demo UI fully functional
- [ ] Docker image builds
- [ ] Image size < 20MB

**Gate 5 (Release):**
- [ ] All linters passing
- [ ] Performance improved vs TypeScript
- [ ] Documentation complete
- [ ] Release notes written

---

## 8. Risk Assessment & Mitigation

### 8.1 Technical Risks

**Risk 1: MCP Protocol Implementation Gaps**
- **Impact:** High - Core functionality broken
- **Probability:** Medium
- **Mitigation:**
  - Start with STDIO transport (simpler)
  - Reference MCP spec 2025-06-18 continuously
  - Test with real VS Code early
  - Run test suite frequently

**Risk 2: ONTAP API Compatibility Issues**
- **Impact:** High - Tools don't work
- **Probability:** Low (API well-documented)
- **Mitigation:**
  - Use existing TypeScript code as reference
  - Test against real ONTAP clusters
  - Validate error handling
  - Keep test cluster available

**Risk 3: Tool Parity Gaps**
- **Impact:** Medium - Missing functionality
- **Probability:** Low (TypeScript is reference)
- **Mitigation:**
  - Use integration tests as acceptance criteria
  - Implement tools in same order as tests
  - Check test results after each tool batch

**Risk 4: Performance Regressions**
- **Impact:** Low - Not expected, but possible
- **Probability:** Very Low
- **Mitigation:**
  - Benchmark against TypeScript version
  - Profile memory usage
  - Test with large datasets

### 8.2 Schedule Risks

**Risk 1: Underestimated Complexity**
- **Impact:** Medium - Delayed delivery
- **Probability:** Medium
- **Mitigation:**
  - Phased approach with validation gates
  - Start with MVP (core tools only)
  - Parallel work on independent tools
  - Buffer time in estimates (9-12 weeks vs 6-8 weeks)

**Risk 2: Test Suite Incompatibility**
- **Impact:** High - Can't validate
- **Probability:** Low
- **Mitigation:**
  - Test HTTP transport early
  - Validate SSE implementation
  - Run tests incrementally

### 8.3 Adoption Risks

**Risk 1: Developer Unfamiliarity with Go**
- **Impact:** Medium - Slower development
- **Probability:** Depends on team
- **Mitigation:**
  - Go training/resources
  - Code review process
  - Harvest as reference implementation
  - Pair programming sessions

**Risk 2: Ecosystem Differences**
- **Impact:** Low - Different tooling
- **Probability:** High (expected)
- **Mitigation:**
  - Document Go toolchain setup
  - Create Makefile for common tasks
  - Update CI/CD pipelines
  - Maintain parallel TypeScript version initially

---

## 9. Success Metrics

### 9.1 Functional Metrics

- [ ] **100% Test Coverage:** All 19 integration tests passing
- [ ] **100% Tool Parity:** All 51 tools implemented and working
- [ ] **Demo Compatibility:** Demo UI works without changes
- [ ] **Transport Parity:** STDIO and HTTP modes both functional
- [ ] **Docker Compatibility:** Container builds and runs

### 9.2 Performance Metrics

**Target Improvements:**
- **Binary Size:** < 20MB (vs ~120MB Docker image)
- **Startup Time:** < 100ms (vs ~1-2s Node.js)
- **Memory Usage:** < 50MB baseline (vs ~100MB Node.js)
- **Request Latency:** < 10ms overhead (vs ~20ms Node.js)

**Measurement:**
```bash
# Binary size
ls -lh bin/ontap-mcp

# Startup time
time ./bin/ontap-mcp --version

# Memory usage
docker stats ontap-mcp-go

# Request latency
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/mcp
```

### 9.3 Code Quality Metrics

- [ ] **Linting:** `golangci-lint` passes with Harvest config
- [ ] **Vetting:** `go vet ./...` passes
- [ ] **Test Coverage:** > 70% unit test coverage
- [ ] **Documentation:** GoDoc for all exported functions
- [ ] **Style:** Aligns with Harvest conventions

---

## 10. Resource Requirements

### 10.1 Development Environment

**Required:**
- Go 1.21+ installed
- Git repository access
- ONTAP test cluster (existing)
- Docker for image builds
- VS Code with Go extensions

**Nice to Have:**
- GoLand IDE
- Delve debugger
- Go benchmarking tools

### 10.2 Team Structure

**Recommended:**
- **Lead Developer (1):** Go expert, MCP protocol
- **ONTAP Developer (1):** ONTAP API knowledge
- **Tester (0.5):** Integration testing
- **DevOps (0.5):** Docker, CI/CD updates

**Total Effort:** ~12-16 person-weeks

### 10.3 Timeline

**Optimistic:** 6-8 weeks (1-2 developers)
**Realistic:** 9-12 weeks (with buffer)
**Pessimistic:** 14-16 weeks (if unforeseen issues)

**Breakdown:**
- Phase 1 (Foundation): 2-3 weeks
- Phase 2 (ONTAP Client): 2 weeks
- Phase 3 (Tools): 3-4 weeks
- Phase 4 (Integration): 1-2 weeks
- Phase 5 (Polish): 1 week

---

## 11. Go-Specific Implementation Details

### 11.1 Key Libraries

**MCP Protocol:**
- `encoding/json` - JSON-RPC 2.0 messages
- `net/http` - HTTP server
- `bufio` - STDIO transport
- Custom SSE implementation

**ONTAP Client:**
- `net/http` - REST API calls
- `crypto/tls` - TLS configuration
- `encoding/json` - Response parsing

**Validation:**
- `github.com/go-playground/validator/v10` - Input validation
- `reflect` - JSON schema generation

**Logging:**
- `github.com/rs/zerolog` (or `go.uber.org/zap`) - Structured logging

**Configuration:**
- `github.com/spf13/viper` - Config management (optional)
- `encoding/json` - Cluster config parsing

**Testing:**
- Standard library `testing`
- `github.com/stretchr/testify` - Assertions (optional)

### 11.2 Concurrency Model

**Session Management:**
```go
type SessionManager struct {
    sessions map[string]*Session
    mu       sync.RWMutex
}

func (sm *SessionManager) CreateSession(id string) *Session {
    sm.mu.Lock()
    defer sm.mu.Unlock()
    
    session := &Session{
        ID:      id,
        Created: time.Now(),
        ctx:     context.Background(),
    }
    sm.sessions[id] = session
    return session
}
```

**HTTP Server:**
```go
// Goroutine per HTTP request (standard Go HTTP server)
http.HandleFunc("/mcp", func(w http.ResponseWriter, r *http.Request) {
    // SSE stream - one goroutine per client
    go handleSSEClient(w, r)
})

http.HandleFunc("/messages", func(w http.ResponseWriter, r *http.Request) {
    // JSON-RPC request - synchronous handler
    handleJSONRPC(w, r)
})
```

**Connection Pooling:**
```go
// ONTAP client with connection pool
type Client struct {
    httpClient *http.Client // Reuses connections
    baseURL    string
    auth       string
}

func NewClient(config *ClusterConfig) *Client {
    return &Client{
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
            Transport: &http.Transport{
                MaxIdleConns:        100,
                MaxIdleConnsPerHost: 10,
                IdleConnTimeout:     90 * time.Second,
            },
        },
        baseURL: fmt.Sprintf("https://%s/api", config.ClusterIP),
        auth:    base64.StdEncoding.EncodeToString([]byte(config.Username + ":" + config.Password)),
    }
}
```

### 11.3 Error Handling Pattern

**Harvest-style error wrapping:**
```go
// pkg/ontap/errors.go
type OntapError struct {
    StatusCode int
    Message    string
    Code       string
    Err        error
}

func (e *OntapError) Error() string {
    return fmt.Sprintf("ONTAP API error (HTTP %d): %s [%s]", e.StatusCode, e.Message, e.Code)
}

func (e *OntapError) Unwrap() error {
    return e.Err
}

// Usage in tools
func (t *VolumeTools) CreateVolume(ctx context.Context, req CreateVolumeRequest) (*mcp.ToolResponse, error) {
    resp, err := t.client.CreateVolume(ctx, params)
    if err != nil {
        // Wrap ONTAP error with context
        return nil, fmt.Errorf("failed to create volume %s on SVM %s: %w", req.VolumeName, req.SvmName, err)
    }
    // ...
}
```

### 11.4 Configuration Management

**Environment-based (current approach):**
```go
// pkg/config/clusters.go
func LoadClustersFromEnv() ([]ClusterConfig, error) {
    clustersJSON := os.Getenv("ONTAP_CLUSTERS")
    if clustersJSON == "" {
        return nil, nil // No clusters configured
    }
    
    var clusters []ClusterConfig
    if err := json.Unmarshal([]byte(clustersJSON), &clusters); err != nil {
        return nil, fmt.Errorf("invalid ONTAP_CLUSTERS JSON: %w", err)
    }
    
    return clusters, nil
}
```

**File-based (optional enhancement):**
```go
// config.yaml
clusters:
  - name: prod
    cluster_ip: 10.1.1.1
    username: admin
    password: secret
    description: Production cluster
  - name: dev
    cluster_ip: 10.2.2.2
    username: admin
    password: secret
    description: Development cluster

server:
  port: 3000
  log_level: info
```

---

## 12. Documentation Updates

### 12.1 Required Documentation

**New Documents:**
- `docs/GO_ARCHITECTURE.md` - Go implementation details
- `docs/MIGRATION_GUIDE.md` - TypeScript → Go migration notes
- `docs/DEVELOPER_GUIDE.md` - Go development setup
- `CONTRIBUTING_GO.md` - Go contribution guidelines

**Updated Documents:**
- `README.md` - Build instructions, prerequisites
- `docs/DOCKER.md` - Go Docker build process
- `.github/copilot-instructions.md` - Go development patterns
- `demo/README.md` - No changes (demo unchanged)
- `test/README.md` - Go server startup instructions

### 12.2 README.md Updates

**Before (TypeScript):**
```markdown
## Prerequisites
- Node.js 20+
- npm

## Build
npm install
npm run build

## Run
npm start                 # STDIO mode
npm run start:http        # HTTP mode
```

**After (Go):**
```markdown
## Prerequisites
- Go 1.21+
- make (optional)

## Build
go mod download
go build -o bin/ontap-mcp ./cmd/ontap-mcp

# Or using Makefile
make build

## Run
./bin/ontap-mcp                 # STDIO mode
./bin/ontap-mcp --http=3000     # HTTP mode

## Development
make test        # Run unit tests
make lint        # Run linters
make docker      # Build Docker image
```

---

## 13. Rollout Strategy

### 13.1 Parallel Development

**Maintain TypeScript Version:**
- Keep TypeScript version in `main` branch
- Develop Go version in `go-rewrite` branch
- Run both in CI/CD during transition

**Benefits:**
- Zero disruption to current users
- TypeScript as fallback if issues arise
- Gradual migration path

### 13.2 Phased Rollout

**Phase 1: Internal Testing**
- Go version deployed to test environment
- Internal team validates functionality
- Integration tests confirm parity

**Phase 2: Beta Release**
- Go version available as opt-in Docker tag: `ontap-mcp:go-beta`
- TypeScript version remains default: `ontap-mcp:latest`
- Collect feedback, fix issues

**Phase 3: General Availability**
- Go version becomes default: `ontap-mcp:latest`
- TypeScript version archived: `ontap-mcp:ts-legacy`
- Documentation updated

**Phase 4: Deprecation**
- TypeScript version marked deprecated
- 6-month notice for users
- Eventually removed

### 13.3 Versioning

**Semantic Versioning:**
- TypeScript v1.x.x → Go v2.0.0 (major version bump)
- Reason: Implementation rewrite (breaking change in internals)
- API/protocol remains compatible (same tools, same behavior)

**Git Tags:**
```bash
# TypeScript final release
git tag v1.9.0

# Go initial release
git tag v2.0.0

# Go incremental releases
git tag v2.0.1
git tag v2.1.0
```

---

## 14. CI/CD Updates

### 14.1 GitHub Actions

**New Workflow: `.github/workflows/go.yml`**
```yaml
name: Go CI

on:
  push:
    branches: [ go-rewrite, main ]
  pull_request:
    branches: [ go-rewrite, main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      
      - name: Download dependencies
        run: go mod download
      
      - name: Run tests
        run: go test -v -race -coverprofile=coverage.out ./...
      
      - name: Run golangci-lint
        uses: golangci/golangci-lint-action@v4
        with:
          version: latest
          args: --config .golangci.yml
      
      - name: Build
        run: go build -o bin/ontap-mcp ./cmd/ontap-mcp
      
      - name: Integration Tests
        run: |
          ./bin/ontap-mcp --http=3000 &
          sleep 2
          cd test && ./run-all-tests.sh

  docker:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker build -t ontap-mcp-go:${{ github.sha }} .
      
      - name: Test Docker image
        run: |
          docker run -d -p 3000:3000 \
            -e ONTAP_CLUSTERS='[{"name":"test","cluster_ip":"10.1.1.1","username":"admin","password":"pass"}]' \
            ontap-mcp-go:${{ github.sha }} --http=3000
          sleep 2
          curl -f http://localhost:3000/health || exit 1
```

### 14.2 Makefile

**Harvest-style Makefile:**
```makefile
# Variables
BINARY_NAME=ontap-mcp
GO=go
GOFLAGS=-v
BUILD_DIR=bin
DOCKER_IMAGE=ontap-mcp-go

# Targets
.PHONY: all build test lint clean docker

all: lint test build

build:
	@echo "Building $(BINARY_NAME)..."
	$(GO) build $(GOFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/ontap-mcp

test:
	@echo "Running unit tests..."
	$(GO) test -v -race -coverprofile=coverage.out ./...

integration-test: build
	@echo "Running integration tests..."
	./$(BUILD_DIR)/$(BINARY_NAME) --http=3000 &
	sleep 2
	cd test && ./run-all-tests.sh
	pkill -f $(BINARY_NAME)

lint:
	@echo "Running linters..."
	golangci-lint run --config .golangci.yml

vet:
	@echo "Running go vet..."
	$(GO) vet ./...

clean:
	@echo "Cleaning..."
	rm -rf $(BUILD_DIR)
	rm -f coverage.out

docker:
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE):latest .

docker-test: docker
	@echo "Testing Docker image..."
	docker run -d -p 3000:3000 --name ontap-mcp-test \
		-e ONTAP_CLUSTERS='[{"name":"test","cluster_ip":"10.1.1.1","username":"admin","password":"pass"}]' \
		$(DOCKER_IMAGE):latest --http=3000
	sleep 2
	curl -f http://localhost:3000/health
	docker stop ontap-mcp-test
	docker rm ontap-mcp-test

install:
	@echo "Installing $(BINARY_NAME)..."
	$(GO) install ./cmd/ontap-mcp

run:
	@echo "Running $(BINARY_NAME)..."
	$(GO) run ./cmd/ontap-mcp

run-http:
	@echo "Running $(BINARY_NAME) in HTTP mode..."
	$(GO) run ./cmd/ontap-mcp --http=3000
```

---

## 15. Recommended Next Steps

### 15.1 Immediate Actions

1. **Review & Approve Proposal**
   - Technical review by team
   - Stakeholder approval
   - Budget/timeline sign-off

2. **Prepare Development Environment**
   - Set up Go 1.21+ on development machines
   - Install golangci-lint with Harvest config
   - Clone Harvest repository for reference

3. **Create Go Project Structure**
   - Initialize `go.mod`
   - Set up `cmd/pkg` directories
   - Create initial Makefile
   - Set up Git branch: `go-rewrite`

### 15.2 Week 1 Plan

**Day 1-2: Project Setup**
- [ ] Initialize Go modules
- [ ] Create directory structure
- [ ] Set up linting/formatting
- [ ] Create basic Makefile

**Day 3-5: MCP Foundation**
- [ ] Implement JSON-RPC 2.0 parser
- [ ] Implement STDIO transport
- [ ] Session management
- [ ] Tool registry skeleton
- [ ] Hello World tool for testing

**Validation:**
```bash
go build -o bin/ontap-mcp ./cmd/ontap-mcp
./bin/ontap-mcp  # STDIO mode
# Test with VS Code MCP
```

### 15.3 Decision Points

**Week 2:** HTTP transport working → Proceed to ONTAP client  
**Week 4:** ONTAP client validated → Proceed to tool migration  
**Week 8:** 50%+ tools implemented → Continue OR reassess timeline  
**Week 10:** All tests passing → Proceed to optimization  
**Week 12:** Release candidate ready → Deploy to beta

---

## 16. Conclusion

### 16.1 Summary

Rewriting the NetApp ONTAP MCP Server in Go offers significant benefits:
- **Performance:** Faster, more efficient
- **Deployment:** Smaller images, simpler deployment
- **Alignment:** Matches Harvest ecosystem
- **Maintainability:** Type safety, better tooling

The project is feasible with:
- **9-12 week timeline** (realistic estimate)
- **Preserved test suite** (19 JavaScript integration tests)
- **Preserved demo UI** (HTML/CSS/JavaScript)
- **Phased approach** with validation gates

### 16.2 Risks

**Manageable:**
- MCP protocol implementation (well-documented spec)
- Tool migration (TypeScript as reference)
- Testing (existing suite validates)

**Minimal:**
- ONTAP API compatibility (API is stable)
- Performance (Go should improve, not regress)

### 16.3 Recommendation

**Proceed with Go rewrite** under these conditions:
1. **Team has Go expertise** (or commits to learning)
2. **9-12 week timeline acceptable** (not urgent deadline)
3. **Harvest alignment valued** (ecosystem consistency)
4. **Performance/deployment benefits desired**

**Alternative: Stay with TypeScript** if:
1. Timeline is critical (< 4 weeks)
2. Team unfamiliar with Go (no training budget)
3. Current performance acceptable
4. Node.js ecosystem preferred

### 16.4 Success Criteria

The rewrite is successful when:
- ✅ All 19 integration tests passing
- ✅ All 51 tools working with exact parity
- ✅ Demo UI works without changes
- ✅ Docker image < 20MB
- ✅ Startup time < 100ms
- ✅ Code follows Harvest style
- ✅ Documentation complete
- ✅ Users experience no disruption

---

## Appendix A: Reference Materials

### A.1 Harvest GitHub
- **Repository:** https://github.com/NetApp/harvest
- **Architecture:** https://github.com/NetApp/harvest/blob/main/ARCHITECTURE.md
- **Style Guide:** Inferred from codebase
- **Linter Config:** `.golangci.yml`

### A.2 MCP Specification
- **Spec 2025-06-18:** https://spec.modelcontextprotocol.io/specification/2025-06-18/
- **JSON-RPC 2.0:** https://www.jsonrpc.org/specification
- **SSE Spec:** https://html.spec.whatwg.org/multipage/server-sent-events.html

### A.3 ONTAP REST API
- **Documentation:** https://docs.netapp.com/us-en/ontap-automation/
- **API Reference:** `/api/docs` on ONTAP cluster

### A.4 Go Resources
- **Effective Go:** https://go.dev/doc/effective_go
- **Go Modules:** https://go.dev/blog/using-go-modules
- **Testing:** https://go.dev/doc/tutorial/add-a-test
- **golangci-lint:** https://golangci-lint.run/

---

## Appendix B: Tool Migration Matrix

| Tool Module | Tool Count | TypeScript LOC | Est. Go LOC | Complexity |
|-------------|-----------|----------------|-------------|------------|
| cluster-management | 4 | ~250 | ~200 | Low |
| volume-tools | 18 | ~1500 | ~1200 | Medium |
| cifs-share-tools | 8 | ~800 | ~650 | Medium |
| export-policy-tools | 9 | ~900 | ~750 | Medium |
| snapshot-policy-tools | 4 | ~400 | ~320 | Low |
| snapshot-schedule-tools | 4 | ~350 | ~280 | Low |
| qos-policy-tools | 5 | ~600 | ~480 | Medium |
| volume-autosize-tools | 2 | ~200 | ~160 | Low |
| volume-snapshot-tools | 4 | ~350 | ~280 | Low |
| **TOTAL** | **51** | **~5350** | **~4320** | **Mixed** |

**Notes:**
- Go LOC typically 15-20% less than TypeScript (more concise)
- Complexity based on ONTAP API interactions and validation logic
- "Medium" complexity includes multi-step workflows, complex validation

---

## Appendix C: Timeline Gantt Chart

```
Week  | Phase 1: Foundation | Phase 2: ONTAP | Phase 3: Tools | Phase 4: Integration | Phase 5: Polish |
------|---------------------|----------------|----------------|---------------------|-----------------|
  1   | ████████████        |                |                |                     |                 |
  2   | ████████████        |                |                |                     |                 |
  3   | ████████            | ████████       |                |                     |                 |
  4   |                     | ████████████   |                |                     |                 |
  5   |                     | ████████       | ████████       |                     |                 |
  6   |                     |                | ████████████   |                     |                 |
  7   |                     |                | ████████████   |                     |                 |
  8   |                     |                | ████████████   |                     |                 |
  9   |                     |                | ████████       | ████████            |                 |
 10   |                     |                |                | ████████████        |                 |
 11   |                     |                |                | ████████            | ████████        |
 12   |                     |                |                |                     | ████████████    |
```

**Milestones:**
- ⚡ Week 3: STDIO transport working
- ⚡ Week 4: ONTAP client validated
- ⚡ Week 8: 50%+ tools implemented
- ⚡ Week 10: All tests passing
- ⚡ Week 12: Release candidate

---

**End of Proposal**

Ready to commit when you give permission.
