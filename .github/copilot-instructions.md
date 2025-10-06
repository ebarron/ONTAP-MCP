# Copilot Instructions for NetApp ONTAP MCP Server

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## 🚨 CRITICAL GIT RULES 🚨
- **NEVER use `git commit` without explicit user permission**
- **NEVER use `git push` without explicit user permission**  
- **User controls ALL commits and pushes - wait for explicit instructions**

## 🔧 MCP PROTOCOL VERSIONS 🔧
- **Current MCP Specification**: 2025-06-18 (https://spec.modelcontextprotocol.io/specification/2025-06-18/)
- **Deprecated Spec**: 2024-11-05 (old spec, phasing out)
- **Current SDK Version**: @modelcontextprotocol/sdk@1.19.1
- **Protocol Evolution**: 
  - Old (2024-11-05): HTTP+SSE transport, session ID via SSE event body
  - New (2025-06-18): Streamable HTTP transport, session ID via `Mcp-Session-Id` HTTP header
  - Spec Section 2.8: Recommends supporting both transports for backwards compatibility
- **Always verify against current spec before making protocol-level decisions**

This is an MCP (Model Context Protocol) server providing 55+ tools for NetApp ONTAP storage management across multiple clusters. The server supports dual transports (STDIO/HTTP) and manages complete storage lifecycles including volumes, snapshots, NFS/CIFS access, and performance policies.

## Core Architecture

### Dual Transport Pattern
- **STDIO Mode**: VS Code MCP integration (`npm start`)
- **HTTP Mode**: Web API server (`npm run start:http` or `--http=3000`)
- **Transport Detection**: CLI args determine mode automatically
- **Critical**: All 55+ tools must be registered in BOTH STDIO and HTTP handlers in `src/index.ts`

### Multi-Cluster Management
- **OntapClusterManager**: Central registry in `src/ontap-client.ts`
- **Environment Loading**: `ONTAP_CLUSTERS='[{"name":"...","cluster_ip":"..."}]'`
- **Dual Tool Patterns**: Legacy single-cluster + new multi-cluster (`cluster_*`) tools
- **Client Resolution**: Use `getApiClient()` helper to support both patterns

### Storage Tool Organization
```
src/tools/
├── volume-tools.ts           # Volume lifecycle + NFS (18 tools)
├── cifs-share-tools.ts       # CIFS/SMB management (8 tools)
├── snapshot-policy-tools.ts  # Data protection (4 tools)
├── export-policy-tools.ts    # NFS security (9 tools)
├── qos-policy-tools.ts       # Performance policies (5 tools)
└── cluster-management-tools.ts # Basic cluster ops (4 tools)
```

## Critical Development Patterns

### MCP Tool Registration (Most Common Issue)
**Problem**: Tool works in VS Code but fails HTTP mode with undefined/not found error
**Root Cause**: Missing registration in tool registry or transport handlers

**Required Registration Points** (all in appropriate files):
1. Tool implementation in `src/tools/*.ts`
2. Import and register in `src/registry/register-tools.ts`
3. Verify both STDIO and HTTP transports recognize the tool

### MCP Tool Creation Pattern
```typescript
// 1. Zod schema with dual cluster support
const Schema = z.object({
  cluster_name: z.string().optional(),
  cluster_ip: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  // ... other params
});

// 2. Handler using getApiClient helper
export async function handleTool(args: any, clusterManager: OntapClusterManager) {
  const validated = Schema.parse(args);
  const client = getApiClient(clusterManager, validated.cluster_name, validated.cluster_ip, validated.username, validated.password);
  // ... implementation
}
```

### NetApp ONTAP Safety Patterns
- **Volume Deletion**: Must offline first (`cluster_offline_volume` → `cluster_delete_volume`)
- **Volume UUIDs**: Primary identifiers (auto-resolved from names)
- **SVM Scoping**: Most operations are SVM-scoped, not cluster-wide

## Build & Test Workflow

### Essential Commands
```bash
npm run build          # TypeScript compilation to build/
npm start              # STDIO mode testing  
npm run start:http     # HTTP/SSE mode testing
./test/setup-test-env.sh   # Interactive cluster config
./test/run-all-tests.sh    # Run all 19 tests (100% passing required)
```

### Test Architecture
- **test/clusters.json**: Cluster configurations (required for all tests)
- **test/mcp-test-client.js**: MCP SSE client for HTTP mode testing
- **test/run-all-tests.sh**: Master test suite (19 tests, all must pass)
- **Dynamic discovery**: Tests query ONTAP for aggregates/SVMs (no hardcoding)
- **Safe cleanup**: Tests only delete resources they create (timestamped names)
- All tests require real ONTAP clusters (no mocking)

## Integration Points

### MCP Configuration (VS Code)
```json
{
  "servers": {
    "netapp-ontap-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/ONTAP-MCP/build/index.js"],
      "env": {
        "ONTAP_CLUSTERS": "[{\"name\":\"prod\",\"cluster_ip\":\"10.1.1.1\",\"username\":\"admin\",\"password\":\"pass\"}]"
      }
    }
  }
}
```

### HTTP/SSE Mode Startup
Environment-based cluster loading in HTTP mode:
```bash
export ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"10.1.1.1",...}]'
node build/index.js --http=3000

# MCP JSON-RPC 2.0 endpoints:
# GET http://localhost:3000/mcp (SSE stream)
# POST http://localhost:3000/messages?sessionId=xxx (JSON-RPC requests)
```

## Git/Version Control Guidelines
- **🚨🚨🚨 STOP! READ THIS FIRST! 🚨🚨🚨**
- **NEVER EVER use `git commit` without user saying "commit this" or "check it in"**
- **NEVER EVER use `git push` without user saying "push this" or "push to github"**
- **When staging files (git add), ALWAYS end by saying: "Ready to commit when you give permission"**
- **If you even THINK about committing, STOP and ask first**
- Always build and test both transport modes before changes
- Use test scripts to verify all 55 tools still register correctly
- Only stage changes (git add) and show status when making file changes
- User controls ALL commits and pushes - no exceptions, no assumptions

## NetApp ONTAP Specifics
- Uses ONTAP REST API v1/v2 with HTTPS
- Volume UUIDs are primary identifiers (auto-resolved from names)
- SVMs (Storage Virtual Machines) contain volumes
- Aggregates provide underlying storage for volumes
- Export policies control NFS access, snapshot policies handle backups
- CIFS shares provide SMB/Windows file access with user/group ACLs

## Demo Web Interface Development

### Demo Architecture (demo/ directory)
The project includes a complete NetApp BlueXP-style demo interface using MCP SSE protocol:

```
demo/
├── index.html              # Main demo interface (NetApp BlueXP styling)
├── styles.css              # Authentic BlueXP design system
├── app.js                  # MCP API integration + UI interactions
├── README.md               # Demo documentation and setup
├── CHATBOT_README.md       # AI assistant setup guide
├── CHATBOT_STRUCTURED_FORMAT.md # Chatbot integration specs
├── js/
│   ├── components/
│   │   ├── ChatbotAssistant.js      # AI provisioning assistant
│   │   ├── ProvisioningPanel.js     # Storage provisioning workflow
│   │   ├── ExportPolicyModal.js     # NFS export policy management
│   │   └── app-initialization.js    # App initialization logic
│   ├── core/
│   │   ├── McpApiClient.js          # MCP SSE transport layer
│   │   └── utils.js                 # Utility functions
│   └── ui/
│       └── ToastNotifications.js    # User feedback system
└── test/
    ├── test-api.html            # Interactive API testing utility
    ├── debug.html               # CSS/styling verification
    ├── debug-test.html          # Debug testing interface
    └── run-demo-tests.sh        # Demo test automation
```

### Demo Startup Pattern
**Critical: Two-server architecture required**
```bash
# Method 1: Using convenience scripts (recommended)
# Run in background to avoid blocking terminal
nohup ./start-demo.sh > demo-startup.log 2>&1 &

# Wait for full startup (both MCP and web servers)
sleep 8 && echo "Demo should be ready at http://localhost:8080"

# Check status
tail -f demo-startup.log

# To stop
./stop-demo.sh

# Method 2: Manual startup (clusters MUST be sourced from test/clusters.json)
# Load clusters directly from clusters.json (MCP server supports object format)
export ONTAP_CLUSTERS="$(cat test/clusters.json)"

# Start MCP HTTP server in background
nohup node build/index.js --http=3000 > mcp-server.log 2>&1 &

# Start demo web server from demo directory in background
cd demo && nohup python3 -m http.server 8080 > ../demo-server.log 2>&1 &

# Access: http://localhost:8080
```

### CORS Configuration
MCP HTTP mode includes CORS headers for browser compatibility:
```javascript
// Built into HTTP mode - no additional config needed
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### MCP API Integration Pattern
```javascript
// MCP SSE protocol used in demo (via McpApiClient)
async function callMcpTool(toolName, params = {}) {
  // McpApiClient handles:
  // 1. SSE connection to GET /mcp
  // 2. Session ID extraction from 'endpoint' event
  // 3. JSON-RPC 2.0 request via POST /messages?sessionId=xxx
  // 4. Response matching via SSE 'message' events
  
  return await apiClient.callMcp(toolName, params);
}
```

### NetApp BlueXP Design System
**Authentic styling patterns used:**
```css
/* Core NetApp Colors */
--netapp-blue: #0067C5;
--netapp-purple: #7b2cbf;
--netapp-text: #333333;

/* BlueXP Header Pattern */
.header {
  height: 48px;           /* Compact header */
  background: #ffffff;
  border-bottom: 1px solid #e1e5e9;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Demo Tag Pattern */
.demo-tag {
  background-color: #7b2cbf;  /* NetApp purple */
  color: #ffffff;
  padding: 6px 16px;
  border-radius: 16px;        /* Oval shape */
  font-size: 12px;
  font-weight: 600;
}
```

### Data Parsing Patterns
**Cluster list parsing from MCP responses:**
```javascript
function parseClusterList(textContent) {
  const clusters = [];
  const lines = textContent.split('\n');
  
  for (const line of lines) {
    // Pattern: "- cluster-name: 10.1.1.1 (description)"
    const match = line.match(/^-\s+([^:]+):\s+([^\s]+)\s+\(([^)]+)\)/);
    if (match) {
      clusters.push({
        name: match[1].trim(),
        cluster_ip: match[2].trim(),
        description: match[3].trim()
      });
    }
  }
  return clusters;
}
```

### Demo Testing Strategy
1. **API Testing**: Use `demo/test-api.html` for direct MCP tool testing
2. **Visual Testing**: Use `demo/test.html` for CSS/styling verification
3. **Integration Testing**: Use main `demo/index.html` for full workflow testing
4. **Dual Mode Testing**: Verify STDIO vs HTTP mode consistency

### Common Demo Pitfalls
1. **Wrong Server Directory**: Python server must start from `/demo` directory
2. **Missing Clusters**: MCP server needs `ONTAP_CLUSTERS` environment variable
3. **CORS Issues**: Use HTTP mode (not STDIO) for browser compatibility
4. **Port Conflicts**: Check for existing processes on ports 3000/8080
5. **Build State**: Always `npm run build` after TypeScript changes

### Demo Enhancement Patterns
- **Search Expansion**: Click-to-expand search functionality
- **Error Handling**: Graceful API failure messaging
- **Loading States**: Visual feedback during API calls
- **Responsive Design**: Mobile-friendly NetApp styling
- **Progressive Enhancement**: Core functionality without JavaScript

### Demo Debugging Lessons Learned

#### MCP Tool Registration Issues
**Critical Pattern**: MCP tools work in VS Code (STDIO mode) but fail via browser (HTTP mode) with errors.

**Root Cause**: Tool not properly registered in tool registry (`src/registry/register-tools.ts`).

**Example Issues Encountered**:
```typescript
// ❌ BROKEN: Tool function exists but not registered
// src/tools/export-policy-tools.ts has handleListExportPolicies()
// But missing from register-tools.ts

// ✅ FIXED: Tool properly registered
// src/registry/register-tools.ts:
registry.registerTool({
  name: 'list_export_policies',
  handler: async (args: any) => await handleListExportPolicies(args, clusterManager)
});
```

**Debugging Process**:
1. **Symptom**: Tool call fails with "Tool not found" error in browser
2. **Check**: Tool works via VS Code MCP → confirms tool logic is correct
3. **Root Cause**: Missing registration in tool registry
4. **Fix**: Add tool to `src/registry/register-tools.ts`
5. **Verify**: `npm run build` → restart server → test in browser

**Prevention Checklist**:
- [ ] Tool implementation exists in `src/tools/*.ts`
- [ ] Tool imported in `src/registry/register-tools.ts`
- [ ] Tool registered with correct name and handler
- [ ] Build and restart server after changes
- [ ] Test both VS Code MCP and browser HTTP modes

#### Data Parsing Issues
**Pattern**: MCP responses are text-based and require careful parsing for UI dropdowns.

**SVM Parsing Example**:
```javascript
// ❌ BROKEN: Expected simple list format
const svms = textContent.split('\n').filter(line => line.trim());

// ✅ FIXED: Parse actual format "- vs123 (uuid) - State: running"
const svm_match = line.match(/^-\s+([^\s(]+)\s*\(/);
if (svm_match) svms.push(svm_match[1].trim());
```

**Export Policy Dependencies**:
- Export policies are SVM-specific (not cluster-wide)
- UI must load export policies AFTER user selects SVM
- Use event listeners: `svmSelect.addEventListener('change', loadExportPoliciesForSvm)`

#### State Management Debugging
**Form Reset Issues**: When switching between NFS/CIFS radio buttons, ensure dependent dropdowns reset properly.

**Loading State Management**: Show loading indicators during API calls to prevent user confusion.

**Error Recovery**: Graceful handling when API calls fail (cluster offline, network issues).

#### AI Assistant Integration (ChatbotAssistant)
**Component Architecture**: The demo includes a sophisticated AI chatbot component for intelligent storage provisioning:

```javascript
// Initialization pattern
let chatbot;
document.addEventListener('DOMContentLoaded', () => {
    const app = new OntapMcpDemo();
    app.ready.then(() => {
        chatbot = new ChatbotAssistant(app);
    });
});
```

**Configuration Requirements**:
- `CHATGPT_API_KEY` environment variable for ChatGPT integration
- Graceful degradation to mock mode when API unavailable
- See `demo/CHATBOT_README.md` for complete setup guide

**Structured Response Format**: The chatbot uses structured JSON responses for form population:
- `demo/CHATBOT_STRUCTURED_FORMAT.md` documents the recommendation format
- Prevents false positives from triggering automatic form population
- Enables seamless integration between chat recommendations and provisioning forms

#### Component Files Architecture
```
demo/js/
├── components/
│   ├── ChatbotAssistant.js      # AI provisioning assistant (1040+ lines)
│   ├── ProvisioningPanel.js     # Storage provisioning workflow
│   ├── ExportPolicyModal.js     # NFS export policy management
│   └── app-initialization.js    # App initialization logic
├── core/
│   ├── McpApiClient.js          # HTTP transport layer
│   └── utils.js                 # Utility functions
└── ui/
    └── ToastNotifications.js    # User feedback system
```

## Key Files to Reference
- `src/index.ts`: Transport detection and server initialization
- `src/registry/register-tools.ts`: Central tool registration (all 55 tools)
- `src/registry/tool-registry.ts`: Tool registry implementation
- `src/ontap-client.ts`: ONTAP API communication and cluster management  
- `src/tools/cifs-share-tools.ts`: CIFS share management tools
- `src/types/cifs-types.ts`: CIFS type definitions
- `test/test-volume-lifecycle.js`: Example of dual-transport testing
- `test/mcp-test-client.js`: MCP SSE client for HTTP mode testing
- `demo/CHATBOT_README.md`: AI assistant setup and configuration
- `demo/CHATBOT_STRUCTURED_FORMAT.md`: Chatbot integration specifications

## 🚨 FINAL REMINDER: GIT WORKFLOW 🚨
**AFTER making code changes, ALWAYS:**
1. ✅ Stage files with `git add`
2. ✅ Show status with `git status`
3. ✅ Say: "Ready to commit when you give permission"
4. 🛑 **WAIT for user to say "commit" or "push"**
5. 🛑 **NEVER commit or push on your own**
- `demo/CHATBOT_STRUCTURED_FORMAT.md`: Chatbot integration specifications
