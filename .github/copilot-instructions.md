# Copilot Instructions for NetApp ONTAP MCP Server

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## 🚨 CRITICAL GIT RULES 🚨
- **NEVER use `git commit` without explicit user permission**
- **NEVER use `git push` without explicit user permission**  
- **User controls ALL commits and pushes - wait for explicit instructions**

This is an MCP (Model Context Protocol) server providing 53 tools for NetApp ONTAP storage management across multiple clusters.

## Architecture Overview

### Dual Transport Design
- **STDIO Mode**: Default for VS Code MCP integration (`npm start`)
- **HTTP Mode**: RESTful API server for web apps (`npm run start:http`)
- Transport detected by CLI args: `--http=3000` or `http 3000` activates HTTP mode
- All 53 tools available in both transports with identical functionality

### Multi-Cluster Management
- **OntapClusterManager**: Central registry for multiple ONTAP clusters
- **Dynamic Registration**: Add clusters at runtime via `add_cluster` tool
- **Environment Config**: Pre-load clusters via `ONTAP_CLUSTERS` JSON array
- **Dual Patterns**: Legacy single-cluster tools (`create_volume`) + new multi-cluster tools (`cluster_create_volume`)

### Tool Organization (src/tools/)
```
volume-tools.ts           # Volume lifecycle + NFS access (18 tools)
snapshot-policy-tools.ts  # Backup policies (4 tools)  
export-policy-tools.ts    # NFS security (9 tools)
snapshot-schedule-tools.ts # Cron schedules (5 tools)
cifs-share-tools.ts       # CIFS/SMB share management (8 tools)
cluster-management-tools.ts # Basic cluster operations (4 tools)
qos-policy-tools.ts       # QoS performance policies (5 tools)
```

## Development Patterns

### MCP Tool Creation Pattern
Every tool follows this structure:
```typescript
// 1. Zod schema for validation
const ToolSchema = z.object({
  cluster_name: z.string().describe("Name of registered cluster").optional(),
  cluster_ip: z.string().describe("IP address").optional(),
  // ... parameters
});

// 2. Tool definition factory
export function createToolDefinition(): Tool {
  return {
    name: "tool_name",
    description: "Clear description",
    inputSchema: zodToJsonSchema(ToolSchema)
  };
}

// 3. Handler function
export async function handleTool(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = ToolSchema.parse(args);
  const client = getApiClient(clusterManager, validated.cluster_name, validated.cluster_ip);
  // ... implementation
}
```

### API Client Helper Pattern
Use `getApiClient()` helper to support both cluster patterns:
```typescript
function getApiClient(clusterManager, clusterName?, clusterIp?, username?, password?) {
  if (clusterName) return clusterManager.getClient(clusterName);
  if (clusterIp && username && password) return new OntapApiClient(clusterIp, username, password);
  throw new Error("Either cluster_name or (cluster_ip + username + password) required");
}
```

### Safety-First Volume Operations
Volume deletion requires offline-first workflow:
```typescript
// 1. Take offline: cluster_offline_volume
// 2. Delete: cluster_delete_volume  
// Never delete online volumes - enforced by ONTAP API
```

## Build & Test Workflow

### Essential Commands
```bash
npm run build          # TypeScript compilation to build/
npm start              # STDIO mode testing  
npm run start:http     # HTTP mode testing
./test/setup-test-env.sh   # Interactive cluster config
node test/test-volume-lifecycle.js stdio  # Core STDIO test
node test/test-volume-lifecycle.js rest   # Core HTTP test
```

### Test Architecture
- **test/clusters.json**: Cluster configurations
- **test/test-volume-lifecycle.js**: Dual-transport volume CRUD test  
- **test/test-volume-lifecycle.sh**: Bash REST API test
- **test/check-aggregates.js**: Cross-cluster verification
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

### HTTP Mode Startup
Environment-based cluster loading in HTTP mode:
```bash
export ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"10.1.1.1",...}]'
node build/index.js --http=3000
```

## Git/Version Control Guidelines
- **🚨 CRITICAL: NEVER commit OR push without explicit user permission 🚨**
- **NEVER use git push unless user explicitly requests it**
- **NEVER use git commit unless user explicitly requests it**
- Always build and test both transport modes before changes
- Use test scripts to verify all 53 tools still register correctly
- Wait for explicit git instructions - user controls all commits and pushes
- Only stage changes (git add) and show status when making file changes

## NetApp ONTAP Specifics
- Uses ONTAP REST API v1/v2 with HTTPS
- Volume UUIDs are primary identifiers (auto-resolved from names)
- SVMs (Storage Virtual Machines) contain volumes
- Aggregates provide underlying storage for volumes
- Export policies control NFS access, snapshot policies handle backups
- CIFS shares provide SMB/Windows file access with user/group ACLs

## CIFS/SMB Integration
- **Volume Creation**: Can provision CIFS shares during volume creation
- **Access Control**: Supports Windows users/groups and permission levels (read/change/full_control)
- **Share Properties**: Configurable encryption, oplocks, offline files, security settings
- **Integration Pattern**: Follow same dual transport pattern as export policies

## Demo Web Interface Development

### Demo Architecture (demo/ directory)
The project includes a complete NetApp BlueXP-style demo interface for MCP REST API validation:

```
demo/
├── index.html          # Main demo interface (NetApp BlueXP styling)
├── styles.css          # Authentic BlueXP design system
├── app.js              # MCP API integration + UI interactions
├── README.md           # Demo documentation and setup
├── test-api.html       # Interactive API testing utility
└── test.html           # CSS/styling verification page
```

### Demo Startup Pattern
**Critical: Two-server architecture required**
```bash
# Method 1: Using convenience scripts (recommended)
./start-demo.sh    # Starts both MCP server and demo server
./stop-demo.sh     # Stops both servers cleanly

# Method 2: Manual startup
# Terminal 1: Start MCP HTTP server with clusters
cd /Users/ebarron/ONTAP-MCP
export ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"10.1.1.1","username":"admin","password":"pass"}]'
node build/index.js --http=3000

# Terminal 2: Start demo web server (from demo directory!)
cd /Users/ebarron/ONTAP-MCP/demo
python3 -m http.server 8080

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
// Standard MCP API call pattern used in demo
async function callMcp(toolName, params = {}) {
  const response = await fetch(`http://localhost:3000/api/tools/${toolName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const data = await response.json();
  
  // Extract text content from MCP response structure
  return data.content
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join('');
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

#### HTTP REST API Handler Issues
**Critical Pattern**: MCP tools work in VS Code (STDIO mode) but fail via browser (HTTP mode) with 500 errors.

**Root Cause**: HTTP REST API handler (`src/index.ts` line ~1172) uses a switch statement that must explicitly register each tool. Missing tools cause 500 Internal Server Error.

**Example Issues Encountered**:
```javascript
// ❌ BROKEN: HTTP handler calling client directly
case 'cluster_create_volume':
  const createClient = clusterManager.getClient(args.cluster_name);
  const createResult = await createClient.createVolume({...});

// ✅ FIXED: HTTP handler using proper tool function  
case 'cluster_create_volume':
  result = await handleClusterCreateVolume(args, clusterManager);
  break;
```

**Debugging Process**:
1. **Symptom**: `POST http://localhost:3000/api/tools/list_export_policies 500 (Internal Server Error)`
2. **Check**: Tool works via VS Code MCP → confirms tool logic is correct
3. **Root Cause**: Missing case in HTTP REST API switch statement
4. **Fix**: Add tool to switch statement: `case 'list_export_policies': result = await handleListExportPolicies(args, clusterManager); break;`
5. **Verify**: `npm run build` → restart server → test in browser

**Prevention Checklist**:
- [ ] Tool imports exist in `src/index.ts` (around line 89)
- [ ] Tool registered in MCP handler (around line 868)  
- [ ] Tool registered in HTTP REST API handler (around line 1192)
- [ ] Both handlers use same tool function (not client directly)
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
│   ├── ToastNotifications.js    # User feedback system
│   └── modals/
│       ├── VolumeModal.js       # Volume creation modal
│       └── ExportPolicyModal.js # NFS export policy management
├── core/
│   └── McpApiClient.js          # HTTP transport layer
└── ui/
    └── SearchWidget.js          # Expandable search functionality
```

### Demo Enhancement Patterns
- **Search Expansion**: Click-to-expand search functionality
- **Error Handling**: Graceful API failure messaging
- **Loading States**: Visual feedback during API calls
- **Responsive Design**: Mobile-friendly NetApp styling
- **Progressive Enhancement**: Core functionality without JavaScript

## Key Files to Reference
- `src/index.ts`: Transport detection and tool registration
- `src/ontap-client.ts`: ONTAP API communication and cluster management  
- `src/tools/cifs-share-tools.ts`: CIFS share management tools
- `src/types/cifs-types.ts`: CIFS type definitions
- `test/test-volume-lifecycle.js`: Example of dual-transport testing
- `test/test-cifs-simple.js`: CIFS tools registration verification
- `HTTP_CONFIG.md`: HTTP mode configuration examples
- `demo/CHATBOT_README.md`: AI assistant setup and configuration
- `demo/CHATBOT_STRUCTURED_FORMAT.md`: Chatbot integration specifications
