# Test Cluster Configuration

This directory contains cluster configuration management for ONTAP MCP tests.

## Files

- **`clusters.json`** - External cluster configuration file used by test scripts
- **`sync-clusters.js`** - Utility to sync clusters from VS Code mcp.json to clusters.json
- **`test-volume-lifecycle.js`** - Volume lifecycle test (now uses external clusters.json)

## Usage

### Updating Cluster Configuration

When you update your VS Code `mcp.json` file with new cluster definitions, run the sync script to update the test configuration:

```bash
node test/sync-clusters.js
```

This will:
1. Read your VS Code MCP configuration from `~/Library/Application Support/Code/User/mcp.json`
2. Extract the `ONTAP_CLUSTERS` configuration
3. Update `test/clusters.json` with the current cluster definitions
4. Display the clusters for verification

### Running Tests

Tests now automatically load clusters from `clusters.json`:

```bash
# Volume lifecycle test (uses karan-ontap-1 by default)
node test/test-volume-lifecycle.js

# With REST mode
node test/test-volume-lifecycle.js rest
```

### Cluster Selection

The volume lifecycle test is currently configured to use the `karan-ontap-1` cluster specifically. To change this, edit the `getTestConfig()` function in `test-volume-lifecycle.js`:

```javascript
// Find specific cluster
const karanCluster = clusters.find(c => c.name === 'karan-ontap-1');
```

### Environment Variable Override

You can override the MCP JSON path if needed:

```bash
MCP_JSON_PATH="/path/to/your/mcp.json" node test/sync-clusters.js
```

## Benefits

- ✅ **No more hard-coded clusters** in test scripts
- ✅ **Single source of truth** - clusters defined in your mcp.json
- ✅ **Easy maintenance** - update mcp.json, run sync script
- ✅ **Version control friendly** - clusters.json can be committed
- ✅ **Flexible** - tests can select different clusters as needed