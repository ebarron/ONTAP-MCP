# Test Script Conversion to MCP JSON-RPC 2.0

## Conversion Status

### ✅ Completed Conversions
1. **test-volume-lifecycle.js** - Full conversion complete
   - Added `callMcpTool()` method alongside existing `callRestTool()`  
   - Modified `callTool()` to use JSON-RPC by default
   - Improved UUID extraction regex for formatted responses
   - ✅ **TESTED & WORKING** - Volume create/offline/delete cycle successful

2. **test-cifs-simple.js** - Partial conversion complete
   - Added `callMcpTool()` helper function
   - Converted fetch() calls to use JSON-RPC
   - Updated error handling for ONTAP vs tool errors
   - ✅ **TESTED & WORKING** - Tool registration verification successful

### 🔄 Remaining Files to Convert

Based on grep search, these files contain REST API calls (`/api/tools`) that need conversion:

#### Core Test Files
- `test-comprehensive.js` - Main integration test suite
- `test-cluster-info.js` - Cluster information testing  
- `test-user-scenario.js` - End-to-end user workflows

#### Feature-Specific Tests
- `test-cifs-lifecycle.js` - CIFS share CRUD operations
- `test-export-policy-lifecycle.js` - NFS export policy management
- `test-cifs-creation-acl.js` - CIFS ACL testing

#### Debugging/Development Tools
- `debug-cifs-acl.js` - CIFS ACL debugging
- `debug-cifs-creation.js` - CIFS creation debugging
- `debug-rest-cifs.js` - REST API debugging
- `test-api-fixes.js` - API fix validation
- `test-api-fields.js` - Field validation testing

#### Shell Scripts  
- `test-volume-lifecycle.sh` - Bash version (needs curl → JSON-RPC conversion)
- `test-policy-management.sh` - Policy management bash tests

## Conversion Patterns

### 1. Add MCP Helper Function
Add this function to any test file that needs JSON-RPC calls:

```javascript
// MCP JSON-RPC 2.0 helper function
async function callMcpTool(toolName, args, httpPort = 3000) {
  const url = `http://localhost:${httpPort}/mcp`;
  
  const jsonrpcRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    },
    id: Date.now()
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jsonrpcRequest),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const jsonrpcResponse = await response.json();
  
  // Handle JSON-RPC errors
  if (jsonrpcResponse.error) {
    throw new Error(`JSON-RPC Error ${jsonrpcResponse.error.code}: ${jsonrpcResponse.error.message}${jsonrpcResponse.error.data ? ` - ${jsonrpcResponse.error.data}` : ''}`);
  }

  // Return the result in the same format as REST API for compatibility
  return jsonrpcResponse.result;
}
```

### 2. Replace fetch() Calls

**Before (REST API):**
```javascript
const response = await fetch(`http://localhost:${httpPort}/api/tools/${toolName}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(args),
});

const result = await response.json();
```

**After (JSON-RPC):**
```javascript
const result = await callMcpTool(toolName, args, httpPort);
```

### 3. Update Error Handling

JSON-RPC provides structured error responses with error codes:
- `-32700` Parse error
- `-32600` Invalid Request  
- `-32601` Method not found
- `-32602` Invalid params
- `-32603` Internal error

## Testing Approach

### For Each Converted File:
1. **Build the project:** `npm run build`
2. **Test STDIO mode:** `node test/filename.js stdio` (if supported)
3. **Test REST/HTTP mode:** `node test/filename.js rest` 
4. **Verify tool registration:** Check that tools are found and callable
5. **Handle expected ONTAP errors:** Tool working but cluster/SVM not found is OK

### Success Criteria:
- ✅ Tools are registered and discoverable
- ✅ JSON-RPC calls complete without protocol errors  
- ✅ ONTAP business logic errors (cluster not found, etc.) are handled gracefully
- ✅ Core workflows (create → verify → delete) complete successfully

## Next Steps

1. **Priority 1:** Convert `test-comprehensive.js` (main integration test)
2. **Priority 2:** Convert feature-specific tests (`test-cifs-lifecycle.js`, etc.)
3. **Priority 3:** Convert debugging/development tools  
4. **Priority 4:** Convert shell scripts to use JSON-RPC (curl with proper JSON payload)

After test conversion, we'll tackle **Step 2: Demo Conversion** to update the web interface from REST API to JSON-RPC.