# Copilot Instructions for NetApp ONTAP MCP Server

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is an MCP (Model Context Protocol) server providing 46 tools for NetApp ONTAP storage management across multiple clusters.

## Architecture Overview

### Dual Transport Design
- **STDIO Mode**: Default for VS Code MCP integration (`npm start`)
- **HTTP Mode**: RESTful API server for web apps (`npm run start:http`)
- Transport detected by CLI args: `--http=3000` or `http 3000` activates HTTP mode
- All 46 tools available in both transports with identical functionality

### Multi-Cluster Management
- **OntapClusterManager**: Central registry for multiple ONTAP clusters
- **Dynamic Registration**: Add clusters at runtime via `add_cluster` tool
- **Environment Config**: Pre-load clusters via `ONTAP_CLUSTERS` JSON array
- **Dual Patterns**: Legacy single-cluster tools (`create_volume`) + new multi-cluster tools (`cluster_create_volume`)

### Tool Organization (src/tools/)
```
volume-tools.ts           # Volume lifecycle + NFS access (18 tools)
snapshot-policy-tools.ts  # Backup policies (7 tools)  
export-policy-tools.ts    # NFS security (9 tools)
snapshot-schedule-tools.ts # Cron schedules (4 tools)
cifs-share-tools.ts       # CIFS/SMB share management (8 tools)
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
- **NEVER commit without explicit user permission**
- Always build and test both transport modes before changes
- Use test scripts to verify all 46 tools still register correctly
- Wait for explicit git instructions - user controls all commits

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

## Key Files to Reference
- `src/index.ts`: Transport detection and tool registration
- `src/ontap-client.ts`: ONTAP API communication and cluster management  
- `src/tools/cifs-share-tools.ts`: CIFS share management tools
- `src/types/cifs-types.ts`: CIFS type definitions
- `test/test-volume-lifecycle.js`: Example of dual-transport testing
- `test/test-cifs-simple.js`: CIFS tools registration verification
- `HTTP_CONFIG.md`: HTTP mode configuration examples
