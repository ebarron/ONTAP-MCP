# Session Architecture Documentation

## Overview

This document describes the session isolation architecture in the ONTAP MCP Server, explaining how sessions are managed, how they interact with the MCP Go SDK, and the relationships between various components.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          HTTP Request Flow                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  HTTP Server (ServeHTTPWithSDK)                                         │
│  • Port: 3000 (configurable)                                            │
│  • CORS enabled for browser access                                      │
│  • Endpoints: /mcp, /health                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SDK StreamableHTTPHandler                                              │
│  • Manages HTTP transport per MCP spec (2025-06-18)                     │
│  • Extracts/generates session IDs via Mcp-Session-Id header             │
│  • Calls getServer(r *http.Request) for each request                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────┴───────────────┐
                    │  Extract Mcp-Session-Id       │
                    │  from Request Header          │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SessionManager.GetOrCreateSession(sessionID)                           │
│  • Manages map[sessionID]*SessionData                                   │
│  • Creates new SessionData with isolated ClusterManager per session     │
│  • Tracks session lifecycle (created, last activity)                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SessionData                                                            │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ ClusterManager: *ontap.ClusterManager (SESSION-SPECIFIC)          │ │
│  │   • Isolated cluster registry for this session                    │ │
│  │   • Clusters: map[string]*OntapCluster                            │ │
│  │   • Methods: AddCluster(), GetCluster(), ListClusters()           │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ CreatedAt: time.Time                                              │ │
│  │ LastActivityAt: time.Time                                         │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  createMCPServerForSession(sessionID, clusterManager)                   │
│  • Creates NEW sdk.Server instance for this session                     │
│  • Registers all tools with session's ClusterManager                    │
│  • SDK caches this server internally per session                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  sdk.Server (MCP Go SDK)                                                │
│  • Implementation: {name: "ontap-mcp-server", version: "2.0.0"}         │
│  • ServerOptions: {Instructions: "NetApp ONTAP MCP Server..."}          │
│  • Tools registered via sdk.AddTool()                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  registerToolsWithSDKForSession(mcpServer, clusterManager)              │
│  • Creates temporary tools.Registry with session's ClusterManager       │
│  • Registers all 55+ tools (volumes, CIFS, NFS, QoS, snapshots, etc.)   │
│  • Tool handlers capture session's ClusterManager in closures           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Tool Execution Flow                                                    │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 1. SDK receives CallToolRequest from client                       │ │
│  │ 2. SDK routes to registered tool handler                          │ │
│  │ 3. Handler executes: sessionRegistry.ExecuteTool(toolName, args)  │ │
│  │ 4. Registry looks up tool and calls its handler                   │ │
│  │ 5. Tool handler uses session's ClusterManager (from closure)      │ │
│  │ 6. ClusterManager.GetCluster(name) returns session-specific data  │ │
│  │ 7. ONTAP API client makes REST API calls to cluster               │ │
│  │ 8. Result returned to client via SDK                              │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Session Creation Flow (Context-Based Approach)

This diagram shows how new sessions are created when a previously unseen session ID arrives:

```
1. Client sends first request (initialize) - NO session ID yet
   ↓
2. HTTP → ServeHTTPWithSDK → SDK StreamableHTTPHandler
   ↓
3. SDK generates new session ID (e.g., "ABC123")
   ↓
4. SDK calls server.Connect(req.Context(), transport, ...)
   ↓
   Session ID is in HTTP header but NOT yet in context
   
5. Client sends second request (add_cluster) WITH session ID "ABC123"
   ↓
6. HTTP Request arrives with Mcp-Session-Id: ABC123 header
   ↓
7. SESSION MIDDLEWARE intercepts request:
   ┌─────────────────────────────────────────────────────────┐
   │ sessionID := r.Header.Get("Mcp-Session-Id")             │
   │ if sessionID != "" {                                    │
   │     ctx := context.WithValue(r.Context(),               │
   │                              sessionIDKey, sessionID)   │
   │     r = r.WithContext(ctx)                              │
   │ }                                                       │
   │ next.ServeHTTP(w, r)  // Pass to SDK                   │
   └─────────────────────────────────────────────────────────┘
   ↓
8. SDK handler receives request with enriched context
   ↓
9. SDK: server.Connect(req.Context(), ...)
   ↓
   Context now contains: sessionID = "ABC123"
   ↓
10. Tool handler called: handler(ctx, req, args)
    ↓
11. Tool extracts session ID from context:
    sessionID := ctx.Value(sessionIDKey).(string)  // "ABC123"
    ↓
12. Tool calls: SessionManager.GetOrCreateSession("ABC123")
    ↓
13. SessionManager checks: sessions["ABC123"] exists?
    ├─ NO → Create new SessionData with new ClusterManager
    └─ YES → Return existing SessionData
    ↓
14. Tool uses: sessionData.ClusterManager to access clusters
```

## Tool Execution with Session-Specific Data

This diagram shows how a tool call accesses its session-specific cluster data:

```
Client → POST /mcp (add_cluster tool call)
Headers: Mcp-Session-Id: ABC123

         ↓

┌────────────────────────────────────────────────────────────────┐
│ HTTP Middleware (Session Context Injector)                     │
├────────────────────────────────────────────────────────────────┤
│ 1. Extract sessionID from Mcp-Session-Id header                │
│ 2. Inject into context:                                        │
│    ctx = context.WithValue(req.Context(),                      │
│                            sessionIDKey, "ABC123")             │
│ 3. Pass to SDK handler                                         │
└────────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────────┐
│ SDK StreamableHTTPHandler                                      │
├────────────────────────────────────────────────────────────────┤
│ 1. Receives request with enriched context                      │
│ 2. Routes to appropriate tool handler                          │
│ 3. Calls: handler(ctx, req, args)                              │
│    - ctx contains sessionID = "ABC123"                         │
└────────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────────┐
│ Tool Handler (e.g., add_cluster)                               │
├────────────────────────────────────────────────────────────────┤
│ func handler(ctx context.Context, req, args) {                 │
│   // Extract session ID from context                           │
│   sessionID := ctx.Value(sessionIDKey).(string) // "ABC123"    │
│                                                                 │
│   // Get or create session data                                │
│   sessionData := sessionManager.GetOrCreateSession(sessionID)  │
│   //                          ↑                                │
│   //                   First time? Creates new!                │
│   //                   Seen before? Returns existing!          │
│                                                                 │
│   // Use session-specific cluster manager                      │
│   clusterManager := sessionData.ClusterManager                 │
│   //                                   ↑                       │
│   //              Isolated to this session only!               │
│                                                                 │
│   // Add cluster to THIS session's registry                    │
│   clusterManager.AddCluster(clusterConfig)                     │
│   //                                                            │
│   // Session ABC123's clusters != Session XYZ789's clusters    │
│ }                                                               │
└────────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────────┐
│ SessionManager                                                  │
├────────────────────────────────────────────────────────────────┤
│ sessions: map[string]*SessionData                               │
│   "ABC123" → SessionData {                                      │
│       ClusterManager: 0x123456  ← Isolated instance             │
│       clusters: {                                               │
│         "cluster-a": {...}                                      │
│       }                                                         │
│   }                                                             │
│   "XYZ789" → SessionData {                                      │
│       ClusterManager: 0x789ABC  ← Different instance!           │
│       clusters: {                                               │
│         "cluster-b": {...}                                      │
│       }                                                         │
│   }                                                             │
└────────────────────────────────────────────────────────────────┘

Key Insight: Each tool execution dynamically looks up its session's
data at runtime, rather than being pre-bound to a specific
ClusterManager during registration.
```

**Critical Implementation Details:**

1. **Single MCP Server**: Only ONE `sdk.Server` instance, registered once
2. **Tools registered once**: All tools registered at startup with references to `SessionManager`
3. **Runtime session lookup**: Tools extract session ID from context and lookup session data
4. **Lazy session creation**: `GetOrCreateSession()` creates new sessions on first access
5. **No pre-binding**: Tools are NOT bound to specific ClusterManagers at registration time

**Why this works:**
- Context propagation: Go's `context.Context` flows from HTTP → SDK → Tools
- Middleware injection: We control the context before SDK sees it
- Dynamic lookup: Tools determine their session at execution time, not registration time

## Session Instance Hierarchy

The following diagram shows the relationship between the single Server instance, single SessionManager instance, and multiple SessionData instances with their isolated ClusterManagers:

```
Server (1 instance)
  └── SessionManager (1 instance)
       └── sessions: map[string]*SessionData
            ├── "ABC123" → SessionData {ClusterManager: 0x123456, ...}
            ├── "XYZ789" → SessionData {ClusterManager: 0x789ABC, ...}
            └── "DEF456" → SessionData {ClusterManager: 0xDEF012, ...}
                                         ↑
                                         Each has different memory address
                                         = isolated cluster registry
```

**Key Points:**
- **ONE Server**: Created at startup, lives for entire server lifetime
- **ONE SessionManager**: Created by Server, manages all sessions
- **MANY SessionData**: One per HTTP session, indexed by session ID
- **MANY ClusterManagers**: Each SessionData has its own isolated instance

This architecture ensures that:
1. Session A's clusters are stored in ClusterManager at address 0x123456
2. Session B's clusters are stored in ClusterManager at address 0x789ABC
3. Sessions cannot see each other's clusters because they use different ClusterManager instances

## Component Relationships

### 1. Server (`pkg/mcp/server.go`)

The main MCP server struct that coordinates all components:

```go
type Server struct {
    registry       *tools.Registry          // Global tool definitions
    clusterManager *ontap.ClusterManager    // Global clusters (STDIO mode)
    sessionManager *SessionManager          // Session isolation (HTTP mode)
    logger         *util.Logger
    version        string
}
```

**Responsibilities:**
- Initialize and coordinate SessionManager
- Handle both STDIO mode (single global ClusterManager) and HTTP mode (per-session ClusterManagers)
- Create MCP SDK servers for each session
- Register tools with session-specific cluster managers

### 2. SessionManager (`pkg/mcp/session_manager.go`)

Manages the lifecycle of HTTP sessions and their isolated resources:

```go
type SessionManager struct {
    mu       sync.RWMutex
    sessions map[string]*SessionData  // sessionID -> SessionData
    logger   *util.Logger
}
```

**Responsibilities:**
- Create new sessions with isolated ClusterManagers
- Track session activity timestamps
- Provide thread-safe access to session data
- Cleanup expired sessions (future enhancement)

**Key Methods:**
- `GetOrCreateSession(sessionID string) *SessionData`: Returns existing or creates new session
- `GetSession(sessionID string) (*SessionData, bool)`: Retrieves existing session
- `DeleteSession(sessionID string)`: Removes session and cleans up resources

### 3. SessionData (`pkg/mcp/session_manager.go`)

Per-session state and resources:

```go
type SessionData struct {
    ClusterManager *ontap.ClusterManager  // Isolated cluster registry
    CreatedAt      time.Time
    LastActivityAt time.Time
}
```

**Responsibilities:**
- Hold session-specific ClusterManager instance
- Track session lifecycle timing
- Provide session metadata

**Key Property:**
- `ClusterManager`: Each session gets its own `ontap.ClusterManager` instance with an isolated `map[string]*OntapCluster`

### 4. MCP Go SDK Integration

The official MCP Go SDK (`github.com/modelcontextprotocol/go-sdk/mcp`) provides:

#### StreamableHTTPHandler
```go
handler := sdk.NewStreamableHTTPHandler(
    func(r *http.Request) *sdk.Server {
        // Called for each request
        // Extract session ID from Mcp-Session-Id header
        // Return session-specific sdk.Server
    },
    nil // options
)
```

**SDK Behavior:**
- Automatically generates session IDs if not present in request
- Sends session ID to client via `Mcp-Session-Id` HTTP header
- Manages session state internally (transport connections, keepalive)
- Routes requests to correct sdk.Server based on session
- Handles MCP protocol (JSON-RPC 2.0 over HTTP with SSE)

#### sdk.Server

Each session gets its own sdk.Server instance:

```go
mcpServer := sdk.NewServer(
    &sdk.Implementation{Name: "ontap-mcp-server", Version: "2.0.0"},
    &sdk.ServerOptions{Instructions: "..."}
)
```

**Server Responsibilities:**
- Handle MCP protocol methods (initialize, tools/call, tools/list, etc.)
- Route tool calls to registered handlers
- Manage server capabilities and initialization

## Session Isolation Flow

### Session Creation Flow

```
1. Client sends first request (no Mcp-Session-Id header)
   ↓
2. SDK generates new session ID (e.g., "LQILWCKNEWPU7RLP6GW54QUNVI")
   ↓
3. SDK calls getServer(r) with Mcp-Session-Id in header
   ↓
4. Server extracts sessionID from r.Header.Get("Mcp-Session-Id")
   ↓
5. SessionManager.GetOrCreateSession(sessionID) called
   ↓
6. SessionManager creates new SessionData with:
      - ClusterManager: ontap.NewClusterManager(logger)
      - CreatedAt: time.Now()
      - LastActivityAt: time.Now()
   ↓
7. createMCPServerForSession(sessionID, sessionData.ClusterManager)
   ↓
8. New sdk.Server created and tools registered with session's ClusterManager
   ↓
9. SDK caches this server internally (mapped to session ID)
   ↓
10. SDK returns Mcp-Session-Id header to client
```

### Subsequent Request Flow

```
1. Client sends request with Mcp-Session-Id header
   ↓
2. SDK looks up existing session transport
   ↓
3. SDK calls getServer(r) with session ID in header
   ↓
4. Server extracts sessionID
   ↓
5. SessionManager.GetOrCreateSession(sessionID) returns EXISTING SessionData
   ↓
6. Session's LastActivityAt updated to time.Now()
   ↓
7. createMCPServerForSession creates NEW sdk.Server (but SDK might cache)
   ↓
8. Request processed with session's ClusterManager
```

### Tool Execution with Session Isolation

```
Client: tools/call {name: "add_cluster", arguments: {...}}
   ↓
SDK: Routes to session's sdk.Server
   ↓
sdk.Server: Calls registered tool handler
   ↓
Tool Handler Closure:
   - Captured: sessionRegistry (with session's ClusterManager)
   - Executes: sessionRegistry.ExecuteTool(ctx, toolName, args)
   ↓
Registry.ExecuteTool:
   - Looks up tool definition
   - Calls tool.Handler(ctx, args, clusterManager)
   ↓
Tool Handler (e.g., handleAddCluster):
   - Uses clusterManager parameter
   - clusterManager.AddCluster(name, clusterInfo)
   - Adds to SESSION-SPECIFIC map[string]*OntapCluster
   ↓
Result returned through SDK to client
```

## Critical Design Patterns

### 1. Closure Capture Pattern

When registering tools with the SDK, the handler closure captures the session's registry:

```go
// Inside registerToolsWithSDKForSession:
sessionRegistry := tools.NewRegistry(s.logger)
tools.RegisterAllTools(sessionRegistry, clusterManager) // Session's ClusterManager!

for _, toolDef := range sessionRegistry.ListTools() {
    currentToolName := toolDef.Name
    
    handler := func(ctx context.Context, req *sdk.CallToolRequest, 
                    args map[string]interface{}) (*sdk.CallToolResult, any, error) {
        // This closure captures sessionRegistry which has the session's ClusterManager
        result, err := sessionRegistry.ExecuteTool(ctx, currentToolName, args)
        // ...
    }
    
    sdk.AddTool(mcpServer, &sdk.Tool{...}, handler)
}
```

**Why this works:**
- Each session gets its own `sessionRegistry` instance
- The registry is created with the session's `ClusterManager`
- The handler closure captures this specific registry
- When the tool executes, it uses the captured registry's ClusterManager

### 2. SDK Server Creation Pattern

**Current Implementation:**
```go
// Called for EVERY request - SDK handles caching
func(r *http.Request) *sdk.Server {
    sessionID := r.Header.Get("Mcp-Session-Id")
    sessionData := s.sessionManager.GetOrCreateSession(sessionID)
    return s.createMCPServerForSession(sessionID, sessionData.ClusterManager)
}
```

**Why we don't cache ourselves:**
- The SDK's `StreamableHTTPHandler` manages its own internal caching
- It maps session IDs to transport connections
- We return a fresh server each time, but SDK reuses connections
- This ensures session isolation while letting SDK handle lifecycle

### 3. Two-Level ClusterManager Pattern

```
Global Level (STDIO mode):
    Server.clusterManager → Used for STDIO transport
    
Session Level (HTTP mode):
    SessionManager.sessions[sessionID].ClusterManager → Used for HTTP transport
```

**Why both exist:**
- STDIO mode: Single client connection, global ClusterManager is sufficient
- HTTP mode: Multiple concurrent clients, need session-specific ClusterManagers
- Both transports can coexist (start server with --http=3000 for HTTP, default for STDIO)

## Session Lifecycle Management

### Creation
```go
func (sm *SessionManager) GetOrCreateSession(sessionID string) *SessionData {
    sm.mu.Lock()
    defer sm.mu.Unlock()
    
    if session, ok := sm.sessions[sessionID]; ok {
        session.LastActivityAt = time.Now() // Update activity
        return session
    }
    
    // Create new session with isolated ClusterManager
    session := &SessionData{
        ClusterManager: ontap.NewClusterManager(sm.logger),
        CreatedAt:      time.Now(),
        LastActivityAt: time.Now(),
    }
    
    sm.sessions[sessionID] = session
    return session
}
```

### Activity Tracking
- Every `GetOrCreateSession` call updates `LastActivityAt`
- Used for future session expiration/cleanup
- Helps identify stale sessions

### Cleanup (Future Enhancement)
```go
// Not yet implemented - future enhancement
func (sm *SessionManager) CleanupExpiredSessions(maxAge time.Duration) {
    sm.mu.Lock()
    defer sm.mu.Unlock()
    
    now := time.Now()
    for id, session := range sm.sessions {
        if now.Sub(session.LastActivityAt) > maxAge {
            delete(sm.sessions, id)
            // Could add cleanup hooks for resources
        }
    }
}
```

## Transport Modes Comparison

### STDIO Mode
```
Client (VS Code) ↔ STDIO ↔ Server.clusterManager (global)
                            ↓
                         All tools use same ClusterManager
```

**Characteristics:**
- Single client connection
- No session concept needed
- Uses global `Server.clusterManager`
- Simpler lifecycle management

### HTTP Mode (Streamable HTTP Transport)
```
Client A ↔ HTTP ↔ Session A → SessionData → ClusterManager A
                                               ↓
                                            Clusters for A only

Client B ↔ HTTP ↔ Session B → SessionData → ClusterManager B
                                               ↓
                                            Clusters for B only
```

**Characteristics:**
- Multiple concurrent clients
- Each client gets unique session ID
- Session-specific ClusterManagers provide isolation
- More complex lifecycle (creation, activity tracking, cleanup)

## Thread Safety

### SessionManager
```go
type SessionManager struct {
    mu       sync.RWMutex              // Protects sessions map
    sessions map[string]*SessionData
    logger   *util.Logger
}
```

**Thread-safe operations:**
- `GetOrCreateSession`: Uses `sync.Mutex` for write access
- `GetSession`: Uses `sync.RWMutex` for read access
- `DeleteSession`: Uses `sync.Mutex` for write access

### ClusterManager
```go
type ClusterManager struct {
    mu       sync.RWMutex              // Protects clusters map
    clusters map[string]*OntapCluster
    logger   *util.Logger
}
```

**Thread-safe operations:**
- `AddCluster`: Write lock
- `GetCluster`: Read lock
- `ListClusters`: Read lock
- `RemoveCluster`: Write lock

## Testing Session Isolation

The test suite (`test/integration/test-session-isolation.js`) verifies:

1. **Session Creation**: Two independent sessions can be created
2. **Cluster Isolation**: 
   - Session A adds cluster → Only Session A sees it
   - Session B adds cluster → Only Session B sees it
   - Sessions cannot see each other's clusters
3. **Operation Isolation**:
   - Session B cannot perform operations on Session A's clusters
   - Session A cannot perform operations on Session B's clusters
4. **Session Persistence**: Session state maintained across multiple requests

### Example Test Flow
```javascript
// Create two sessions
const sessionA = await createSession();  // ID: ABC123
const sessionB = await createSession();  // ID: XYZ789

// Session A adds cluster
await callTool(sessionA.id, 'add_cluster', {
    name: 'cluster-a',
    cluster_ip: '10.1.1.1',
    username: 'admin',
    password: 'pass'
});

// Verify isolation
const aClusters = await callTool(sessionA.id, 'list_registered_clusters');
// Returns: ['cluster-a']

const bClusters = await callTool(sessionB.id, 'list_registered_clusters');
// Returns: [] (empty - should NOT see Session A's cluster)
```

## Known Issues and Current Status

### ⚠️ Current Test Failure (Test 27)

The session isolation test is currently **failing** with this symptom:

```
Session B sees 1 cluster(s):
  - session-a-test-1760793851580

✅ Session B CANNOT see Session A's cluster: false  ← FAIL!
```

**Problem:** Session B can see Session A's clusters, indicating sessions are NOT properly isolated.

**Suspected Causes:**
1. ~~SDK caching servers incorrectly~~ (eliminated by removing our own cache)
2. ~~ClusterManager shared between sessions~~ (verified each session gets new ClusterManager)
3. **Current Investigation**: Tool handler closures may be capturing wrong ClusterManager
4. **Possibility**: SDK's internal session management might be routing requests incorrectly

**Next Steps for Debugging:**
1. Add extensive logging in `createMCPServerForSession` to verify unique ClusterManager instances
2. Log pointer addresses of ClusterManagers to confirm they're different per session
3. Add logging in tool handlers to show which ClusterManager they're using
4. Verify SDK's session routing is working correctly

## Future Enhancements

1. **Session Expiration**: Implement cleanup of inactive sessions
2. **Session Persistence**: Option to save/restore session state
3. **Session Metrics**: Track session count, activity, cluster counts per session
4. **Session Events**: Hooks for session creation/destruction
5. **Resource Limits**: Maximum clusters per session, maximum sessions per server
6. **Admin API**: Endpoints to list/inspect/delete sessions

## Related Files

- `pkg/mcp/server.go`: Main server struct and initialization
- `pkg/mcp/session_manager.go`: Session lifecycle management
- `pkg/mcp/transport_http_sdk.go`: HTTP transport with SDK integration
- `pkg/mcp/transport_stdio.go`: STDIO transport (no sessions needed)
- `pkg/ontap/client.go`: ClusterManager implementation
- `test/integration/test-session-isolation.js`: Session isolation tests

## MCP Specification References

- [MCP Specification 2025-06-18](https://spec.modelcontextprotocol.io/specification/2025-06-18/)
- [Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http)
- Session ID Header: `Mcp-Session-Id` (§2.8 of spec)
- Transport Types: STDIO, HTTP/SSE, Streamable HTTP

---

**Last Updated:** October 18, 2025  
**Status:** In Development - Session isolation not fully working yet  
**Test Coverage:** 26/27 tests passing (96%) - Session isolation test failing
