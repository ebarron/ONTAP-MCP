# ONTAP MCP Testing Framework

## Overview

This directory contains comprehensive testing for the NetApp ONTAP MCP (Model Context Protocol) server, including cluster configuration management, API validation, and end-to-end workflow testing.

## Test Objectives

1. **API Field Validation** - Ensure all field parameters are valid for ONTAP HTTP API
2. **Tool Functionality** - Verify each tool works correctly end-to-end  
3. **Error Handling** - Test error scenarios and edge cases
4. **Integration** - Validate multi-tool workflows (create policy → apply to volume)

## Test Categories

### 1. API Field Validation Tests
**Purpose:** Catch invalid field parameters that cause HTTP 400 errors

**Tools to Test:**
- `list_snapshot_policies` - ✅ Fixed to use copies field
- `get_snapshot_policy` - ✅ Fixed to use copies field  
- `list_export_policies` - ✅ Fixed rules field
- `get_export_policy` - ✅ Fixed rules field
- `get_volume_configuration` - ⚠️ Complex field string needs validation
- `list_export_rules` - ⚠️ Many fields need validation

**Test Command:**
```bash
node test-api-fields.js
```

### 2. Core Tool Functionality Tests
**Purpose:** Verify each tool performs its intended function

#### Snapshot Policy Management (7 tools)
- [ ] `list_snapshot_policies` - List all policies on cluster
- [ ] `get_snapshot_policy` - Get specific policy details
- [ ] `create_snapshot_policy` - Create new policy with copies configuration
- [ ] `update_snapshot_policy` - Modify existing policy
- [ ] `delete_snapshot_policy` - Remove unused policy
- [ ] `apply_snapshot_policy_to_volume` - Apply policy to volume
- [ ] `remove_snapshot_policy_from_volume` - Remove policy from volume

#### Export Policy Management (9 tools)  
- [ ] `list_export_policies` - List all export policies
- [ ] `get_export_policy` - Get specific policy with rules
- [ ] `create_export_policy` - Create new NFS export policy
- [ ] `delete_export_policy` - Remove unused policy
- [ ] `add_export_rule` - Add client access rule
- [ ] `update_export_rule` - Modify existing rule
- [ ] `delete_export_rule` - Remove specific rule
- [ ] `configure_volume_nfs_access` - Apply export policy to volume
- [ ] `disable_volume_nfs_access` - Remove NFS access

## Cluster Configuration Management

This section contains secure cluster configuration management for ONTAP MCP tests.

### Security Model

All test scripts use environment variables to configure ONTAP clusters, ensuring:
- ✅ No credentials are stored in source code
- ✅ No credentials are committed to git
- ✅ Users control their own cluster configurations
- ✅ Same configuration works for both development and testing

### Quick Setup Options

#### Option 1: Interactive Setup (Recommended)
```bash
./test/setup-test-env.sh
```
This guides you through configuring clusters and optionally sets environment variables for your current session.

#### Option 2: Manual clusters.json Configuration
```bash
# Copy template and edit with your cluster details
cp test/clusters.json.example test/clusters.json
# Edit test/clusters.json with actual cluster IPs, usernames, passwords
```

#### Option 3: Environment Variables
```bash
export ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"10.1.1.1","username":"admin","password":"pass"}]'
```

## Files

- **`clusters.json`** - External cluster configuration file used by test scripts (git-ignored)
- **`clusters.json.example`** - Template file showing the expected structure for clusters.json
- **`sync-clusters.js`** - Utility to sync clusters from VS Code mcp.json to clusters.json
- **`test-volume-lifecycle.js`** - Volume lifecycle test (now uses external clusters.json)

## Setup

### First Time Setup

1. Copy the example template to create your cluster configuration:
   ```bash
   cp test/clusters.json.example test/clusters.json
   ```

2. Edit `test/clusters.json` with your actual cluster details:
   - Replace IP addresses with your ONTAP cluster IPs
   - Update usernames and passwords 
   - Modify descriptions as needed

**Note**: The `clusters.json` file is git-ignored to prevent committing sensitive credentials.

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

# With HTTP mode
node test/test-volume-lifecycle.js http
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

## 🧪 Comprehensive Testing Guide

### Available Test Tools

| Test Tool | Purpose | Transport Mode | Type |
|-----------|---------|----------------|------|
| `test-volume-lifecycle.js` | Complete volume CRUD workflow | STDIO & HTTP | Core |
| `test-volume-lifecycle.sh` | Volume lifecycle via shell script | HTTP only | Core |
| `check-aggregates.js` | Cross-cluster aggregate verification | HTTP | Utility |
| `verify-tool-count.sh` | Tool registration validation | Local | Validation |
| `test-comprehensive.js` | Full feature testing suite | HTTP | Extended |
| `test-policy-management.sh` | Policy workflow testing | HTTP | Extended |
| `test-api-fields.js` | API field validation testing | HTTP | Debug |

### Quick Test Execution

```bash
# 1. Set up test environment
./test/setup-test-env.sh

# 2. Build project  
npm run build

# 3. Run core tests
node test/test-volume-lifecycle.js stdio    # Test STDIO transport
node test/test-volume-lifecycle.js http     # Test HTTP transport
./test/test-volume-lifecycle.sh             # Test HTTP transport via bash
node test/check-aggregates.js               # Check aggregates
./test/verify-tool-count.sh                 # Verify all tools registered
```

### Test Categories Coverage

#### Core Volume Operations (18 tools)
- Volume lifecycle: create, read, update, delete, resize
- Safe deletion workflow (offline → delete)
- Volume configuration and statistics
- UUID handling and resolution

#### Data Protection (11 tools)  
- Snapshot policies with flexible scheduling
- Snapshot schedules (cron and interval-based)
- Policy application to volumes
- Automated backup configuration

#### CIFS/SMB Integration (8 tools)
- Complete CIFS share management
- Access control lists with user/group permissions
- Share properties and security configuration

#### Multi-Cluster Management (12+ tools)
- Cluster registration and discovery
- Cross-cluster volume operations
- Centralized management interface

### Environment Configuration Examples

#### Option A: Object Format (Recommended)
```bash
export ONTAP_CLUSTERS='{
  "production": {
    "cluster_ip": "10.193.184.184",
    "username": "admin", 
    "password": "Netapp1!",
    "description": "Production cluster"
  }
}'
```

#### Option B: Array Format (Legacy)
```bash
export ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"10.1.1.1","username":"admin","password":"pass"}]'
```