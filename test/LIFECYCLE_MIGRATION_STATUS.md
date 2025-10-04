# Lifecycle Test Migration Status

## Completed
✅ `test-volume-lifecycle.js` - Fully migrated to McpTestClient with --server-running support

## In Progress
⏳ `test-cifs-lifecycle.js` - Constructor updated, needs:
  - startHttpServer() / stopHttpServer() - add serverAlreadyRunning logic
  - Replace callMcpTool() references with McpTestClient 
  - Add extractText() helper
  - Update main() to accept --server-running flag
  - Replace all `result.content[0].text` with `this.extractText(result)`

⏳ `test-export-policy-lifecycle.js` - Needs full migration

⏳ `test-qos-lifecycle.js` - Needs full migration

## Pattern to Follow (from test-volume-lifecycle.js)

### 1. Imports
```javascript
import { McpTestClient } from './mcp-test-client.js';
```

### 2. Constructor
```javascript
constructor(mode = 'stdio', serverAlreadyRunning = false) {
  this.mode = mode;
  this.serverAlreadyRunning = serverAlreadyRunning;
  this.mcpClient = null;
  // ... other fields
}
```

### 3. HTTP Server Management
```javascript
async startHttpServer() {
  if (this.serverAlreadyRunning) {
    await this.log('Using pre-started HTTP server');
    // Verify server is responsive
    const response = await fetch(`http://localhost:${this.httpPort}/health`);
    if (!response.ok) throw new Error(`Server health check failed`);
    return;
  }
  // ... existing server start logic
}

async stopHttpServer() {
  if (this.serverAlreadyRunning) {
    await this.log('Leaving pre-started server running for next test');
    return;
  }
  // ... existing server stop logic
}
```

### 4. HTTP Tool Calling
```javascript
async callHttpTool(toolName, args) {
  if (!this.mcpClient) {
    this.mcpClient = new McpTestClient(`http://localhost:${this.httpPort}`);
    await this.mcpClient.initialize();
  }
  return await this.mcpClient.callTool(toolName, args);
}
```

### 5. Extract Text Helper
```javascript
extractText(result) {
  if (this.mode === 'stdio') {
    return result.content && result.content[0] ? result.content[0].text : '';
  } else {
    if (this.mcpClient) {
      return this.mcpClient.parseContent(result);
    }
    return result.content && result.content[0] ? result.content[0].text : '';
  }
}
```

### 6. Cleanup in runTest()
```javascript
finally {
  if (this.mcpClient) {
    await this.mcpClient.close();
    this.mcpClient = null;
  }
  if (this.mode === 'http') {
    await this.stopHttpServer();
  }
}
```

### 7. Main Function
```javascript
async function main() {
  const mode = process.argv[2] || 'stdio';
  const serverAlreadyRunning = process.argv.includes('--server-running');
  
  const test = new TestClass(mode, serverAlreadyRunning);
  // ... rest
}
```

## Next Steps
1. Update run-all-tests.sh to pre-start server and pass --server-running flag
2. Complete remaining 3 lifecycle tests
3. Test the full suite
