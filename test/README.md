# ONTAP MCP Testing Framework# ONTAP MCP Testing Framework



## Overview## Overview



Comprehensive test suite for the NetApp ONTAP MCP (Model Context Protocol) server. Tests validate 55+ tools across STDIO and HTTP transport modes with 100% coverage.This directory contains comprehensive testing for the NetApp ONTAP MCP (Model Context Protocol) **server functionality**. For demo UI and chatbot testing, see `/demo/test/`.



## Directory Structure## Test Organization



```- **`/test`**: MCP server, tools, API, cluster management

test/- **`/demo/test`**: Demo interface, chatbot logic, UI behavior

├── tools/              # ONTAP tool functionality tests (10 files)

│   ├── test-volume-lifecycle.js## Test Objectives

│   ├── test-volume-autosize-lifecycle-v2.js

│   ├── test-volume-snapshot-lifecycle-v2.js1. **API Field Validation** - Ensure all field parameters are valid for ONTAP HTTP API

│   ├── test-export-policy-lifecycle.js2. **Tool Functionality** - Verify each tool works correctly end-to-end  

│   ├── test-cifs-lifecycle.js3. **Error Handling** - Test error scenarios and edge cases

│   ├── test-cifs-creation-acl.js4. **Integration** - Validate multi-tool workflows (create policy → apply to volume)

│   ├── test-qos-lifecycle.js

│   ├── test-snapshot-policy-formats.js## Test Categories

│   ├── test-cluster-info.js

│   └── test-user-scenario.js### 1. API Field Validation Tests

├── core/               # MCP infrastructure tests (11 files)**Purpose:** Catch invalid field parameters that cause HTTP 400 errors

│   ├── test-tool-discovery.js

│   ├── test-mcp-spec-compliance.js**Tools to Test:**

│   ├── test-mcp-jsonrpc.js- `list_snapshot_policies` - ✅ Fixed to use copies field

│   ├── test-streamable-http.js- `get_snapshot_policy` - ✅ Fixed to use copies field  

│   ├── test-session-management.js- `list_export_policies` - ✅ Fixed rules field

│   ├── test-session-isolation.js- `get_export_policy` - ✅ Fixed rules field

│   ├── test-response-format-validation.js- `get_volume_configuration` - ⚠️ Complex field string needs validation

│   ├── test-param-filtering.js- `list_export_rules` - ⚠️ Many fields need validation

│   └── dynamic-tool-count.js

├── integration/        # Comprehensive tests (2 files)**Test Command:**

│   ├── test-comprehensive.js```bash

│   └── test-policy-management.shnode test-api-fields.js

├── utils/              # Shared utilities (5 files)```

│   ├── mcp-test-client.js          # STDIO mode client

│   ├── mcp-streamable-client.js    # HTTP mode client### 2. Core Tool Functionality Tests

│   ├── setup-test-env.sh           # Interactive setup**Purpose:** Verify each tool performs its intended function

│   ├── sync-clusters.js            # Sync from VS Code config

│   └── clusters.json.example       # Configuration template#### Snapshot Policy Management (7 tools)

├── run-all-tests.sh    # Master test runner (25 tests)- [ ] `list_snapshot_policies` - List all policies on cluster

├── README.md           # This file- [ ] `get_snapshot_policy` - Get specific policy details

├── clusters.json       # Cluster configuration (git-ignored)- [ ] `create_snapshot_policy` - Create new policy with copies configuration

├── clusters.json.example- [ ] `update_snapshot_policy` - Modify existing policy

├── examine-qos.js      # Diagnostic utility- [ ] `delete_snapshot_policy` - Remove unused policy

├── check-aggregates.js # Diagnostic utility- [ ] `apply_snapshot_policy_to_volume` - Apply policy to volume

└── manual-mcp-test.js  # MCP protocol debugger- [ ] `remove_snapshot_policy_from_volume` - Remove policy from volume

```

#### Export Policy Management (9 tools)  

## Quick Start- [ ] `list_export_policies` - List all export policies

- [ ] `get_export_policy` - Get specific policy with rules

### 1. Setup Test Environment- [ ] `create_export_policy` - Create new NFS export policy

- [ ] `delete_export_policy` - Remove unused policy

**Option A: Interactive Setup (Recommended)**- [ ] `add_export_rule` - Add client access rule

```bash- [ ] `update_export_rule` - Modify existing rule

./test/utils/setup-test-env.sh- [ ] `delete_export_rule` - Remove specific rule

```- [ ] `configure_volume_nfs_access` - Apply export policy to volume

- [ ] `disable_volume_nfs_access` - Remove NFS access

**Option B: Manual Configuration**

```bash## Cluster Configuration Management

cp test/clusters.json.example test/clusters.json

# Edit test/clusters.json with your cluster detailsThis section contains secure cluster configuration management for ONTAP MCP tests.

```

### Security Model

**Option C: Environment Variable**

```bashAll test scripts use environment variables to configure ONTAP clusters, ensuring:

export ONTAP_CLUSTERS='[- ✅ No credentials are stored in source code

  {- ✅ No credentials are committed to git

    "name": "cluster1",- ✅ Users control their own cluster configurations

    "cluster_ip": "10.1.1.1",- ✅ Same configuration works for both development and testing

    "username": "admin",

    "password": "Netapp1!"### Quick Setup Options

  }

]'#### Option 1: Interactive Setup (Recommended)

``````bash

./test/setup-test-env.sh

### 2. Build and Run Tests```

This guides you through configuring clusters and optionally sets environment variables for your current session.

```bash

# Build the project#### Option 2: Manual clusters.json Configuration

npm run build```bash

# Copy template and edit with your cluster details

# Run all 25 tests (STDIO + HTTP modes)cp test/clusters.json.example test/clusters.json

./test/run-all-tests.sh# Edit test/clusters.json with actual cluster IPs, usernames, passwords

```

# Run specific test in STDIO mode

node test/tools/test-volume-lifecycle.js stdio#### Option 3: Environment Variables

```bash

# Run specific test in HTTP modeexport ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"10.1.1.1","username":"admin","password":"pass"}]'

node test/tools/test-volume-lifecycle.js http```

```

## Files

## Test Coverage

- **`clusters.json`** - External cluster configuration file used by test scripts (git-ignored)

### Transport Mode Testing- **`clusters.json.example`** - Template file showing the expected structure for clusters.json

- **`sync-clusters.js`** - Utility to sync clusters from VS Code mcp.json to clusters.json

All tests run in **both STDIO and HTTP modes** to ensure complete transport compatibility:- **`test-volume-lifecycle.js`** - Volume lifecycle test (now uses external clusters.json)



- **STDIO Mode**: Direct JSON-RPC communication via stdin/stdout## Setup

- **HTTP Mode**: Streamable HTTP transport with SSE (Server-Sent Events)

### First Time Setup

**25 Total Tests:**

- 10 ONTAP tool functionality tests (STDIO + HTTP) = 20 tests1. Copy the example template to create your cluster configuration:

- 5 MCP infrastructure tests (STDIO + HTTP) = 10 tests   ```bash

- 2 Comprehensive integration tests = 2 tests   cp test/clusters.json.example test/clusters.json

- 3 Session management tests (HTTP only) = 3 tests   ```



### Tool Categories Covered2. Edit `test/clusters.json` with your actual cluster details:

   - Replace IP addresses with your ONTAP cluster IPs

#### Volume Management (18 tools)   - Update usernames and passwords 

- Volume lifecycle: create, list, update, delete, resize   - Modify descriptions as needed

- Volume configuration and statistics

- Volume offline/online operations**Note**: The `clusters.json` file is git-ignored to prevent committing sensitive credentials.

- UUID resolution and validation

## Usage

#### Data Protection (11 tools)

- Snapshot policies with cron/interval schedules### Updating Cluster Configuration

- Snapshot schedule management

- Policy application to volumesWhen you update your VS Code `mcp.json` file with new cluster definitions, run the sync script to update the test configuration:

- Volume snapshot operations

```bash

#### Export Policies (9 tools)node test/sync-clusters.js

- Export policy CRUD operations```

- Export rule management (add, update, delete)

- NFS access configurationThis will:

- Client access control1. Read your VS Code MCP configuration from `~/Library/Application Support/Code/User/mcp.json`

2. Extract the `ONTAP_CLUSTERS` configuration

#### CIFS/SMB (8 tools)3. Update `test/clusters.json` with the current cluster definitions

- CIFS share lifecycle4. Display the clusters for verification

- Access control lists (ACLs)

- User/group permissions### Running Tests

- Share properties (encryption, oplocks, etc.)

Tests now automatically load clusters from `clusters.json`:

#### QoS Policies (5 tools)

- Fixed and adaptive QoS policies```bash

- Throughput and IOPS limits# Volume lifecycle test (uses karan-ontap-1 by default)

- Policy application to volumesnode test/test-volume-lifecycle.js

- Workload management

# With HTTP mode

#### Multi-Cluster (12+ tools)node test/test-volume-lifecycle.js http

- Cluster registration and discovery```

- Cross-cluster operations

- Centralized management### Cluster Selection



## Test RunnerThe volume lifecycle test is currently configured to use the `karan-ontap-1` cluster specifically. To change this, edit the `getTestConfig()` function in `test-volume-lifecycle.js`:



The master test runner (`run-all-tests.sh`) provides:```javascript

- ✅ Automatic build before tests// Find specific cluster

- ✅ Shared HTTP server for efficiencyconst karanCluster = clusters.find(c => c.name === 'karan-ontap-1');

- ✅ Session isolation testing```

- ✅ Detailed pass/fail summary

- ✅ 100% success rate tracking### Environment Variable Override



```bashYou can override the MCP JSON path if needed:

./test/run-all-tests.sh

``````bash

MCP_JSON_PATH="/path/to/your/mcp.json" node test/sync-clusters.js

**Output:**```

```

🚀 Starting Comprehensive Regression Test Suite## Benefits

Building project first...

=== Starting Shared HTTP Server for Test Suite ===- ✅ **No more hard-coded clusters** in test scripts

✅ HTTP server is ready on port 3000- ✅ **Single source of truth** - clusters defined in your mcp.json

- ✅ **Easy maintenance** - update mcp.json, run sync script

✅ Test 1 PASSED: Volume Lifecycle (STDIO Mode)- ✅ **Version control friendly** - clusters.json can be committed

✅ Test 2 PASSED: Volume Lifecycle (HTTP Mode)- ✅ **Flexible** - tests can select different clusters as needed

...

✅ Test 25 PASSED: Session Isolation (HTTP Mode)## 🧪 Comprehensive Testing Guide



=== Test Summary ===### Available Test Tools

Total Tests: 25

✅ Passed: 25| Test Tool | Purpose | Transport Mode | Type |

❌ Failed: 0|-----------|---------|----------------|------|

Success Rate: 100%| `test-volume-lifecycle.js` | Complete volume CRUD workflow | STDIO & HTTP | Core |

✅ 🎉 ALL TESTS PASSED!| `test-volume-lifecycle.sh` | Volume lifecycle via shell script | HTTP only | Core |

```| `check-aggregates.js` | Cross-cluster aggregate verification | HTTP | Utility |

| `verify-tool-count.sh` | Tool registration validation | Local | Validation |

## Individual Test Execution| `test-comprehensive.js` | Full feature testing suite | HTTP | Extended |

| `test-policy-management.sh` | Policy workflow testing | HTTP | Extended |

### Tool Tests| `test-api-fields.js` | API field validation testing | HTTP | Debug |



```bash### Quick Test Execution

# Volume lifecycle (create → update → delete)

node test/tools/test-volume-lifecycle.js stdio```bash

node test/tools/test-volume-lifecycle.js http# 1. Set up test environment

./test/setup-test-env.sh

# Export policy management

node test/tools/test-export-policy-lifecycle.js stdio# 2. Build project  

node test/tools/test-export-policy-lifecycle.js httpnpm run build



# CIFS share management# 3. Run core tests

node test/tools/test-cifs-lifecycle.js stdionode test/test-volume-lifecycle.js stdio    # Test STDIO transport

node test/tools/test-cifs-lifecycle.js httpnode test/test-volume-lifecycle.js http     # Test HTTP transport

./test/test-volume-lifecycle.sh             # Test HTTP transport via bash

# QoS policy lifecyclenode test/check-aggregates.js               # Check aggregates

node test/tools/test-qos-lifecycle.js stdio./test/verify-tool-count.sh                 # Verify all tools registered

node test/tools/test-qos-lifecycle.js http```



# Volume autosize features### Test Categories Coverage

node test/tools/test-volume-autosize-lifecycle-v2.js stdio

node test/tools/test-volume-autosize-lifecycle-v2.js http#### Core Volume Operations (18 tools)

- Volume lifecycle: create, read, update, delete, resize

# Volume snapshot operations- Safe deletion workflow (offline → delete)

node test/tools/test-volume-snapshot-lifecycle-v2.js stdio- Volume configuration and statistics

node test/tools/test-volume-snapshot-lifecycle-v2.js http- UUID handling and resolution

```

#### Data Protection (11 tools)  

### Infrastructure Tests- Snapshot policies with flexible scheduling

- Snapshot schedules (cron and interval-based)

```bash- Policy application to volumes

# Verify all 55+ tools are registered- Automated backup configuration

node test/core/test-tool-discovery.js

#### CIFS/SMB Integration (8 tools)

# MCP protocol compliance- Complete CIFS share management

node test/core/test-mcp-spec-compliance.js- Access control lists with user/group permissions

- Share properties and security configuration

# Session management

node test/core/test-session-management.js#### Multi-Cluster Management (12+ tools)

- Cluster registration and discovery

# Session isolation- Cross-cluster volume operations

node test/core/test-session-isolation.js- Centralized management interface



# JSON-RPC 2.0 compliance### Environment Configuration Examples

node test/core/test-mcp-jsonrpc.js

#### Option A: Object Format (Recommended)

# Response format validation```bash

node test/core/test-response-format-validation.jsexport ONTAP_CLUSTERS='{

```  "production": {

    "cluster_ip": "10.193.184.184",

### Diagnostic Utilities    "username": "admin", 

    "password": "Netapp1!",

```bash    "description": "Production cluster"

# List aggregates across all clusters  }

node test/check-aggregates.js}'

```

# Examine QoS policies

node test/examine-qos.js#### Option B: Array Format (Legacy)

```bash

# Debug MCP protocolexport ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"10.1.1.1","username":"admin","password":"pass"}]'

node test/manual-mcp-test.js```
```

## Cluster Configuration

### Configuration File Format

**test/clusters.json** (git-ignored for security):
```json
{
  "cluster-name-1": {
    "cluster_ip": "10.1.1.1",
    "username": "admin",
    "password": "Netapp1!",
    "description": "Production cluster"
  },
  "cluster-name-2": {
    "cluster_ip": "10.1.1.2",
    "username": "admin",
    "password": "Netapp1!",
    "description": "Development cluster"
  }
}
```

### Sync from VS Code MCP Configuration

```bash
# Sync clusters from VS Code mcp.json to test/clusters.json
node test/utils/sync-clusters.js
```

## Test Development

### Adding New Tests

1. **Tool Tests**: Add to `test/tools/` with dual-mode support (STDIO + HTTP)
2. **Infrastructure Tests**: Add to `test/core/` for MCP protocol testing
3. **Integration Tests**: Add to `test/integration/` for multi-tool workflows
4. **Update test runner**: Add test to `test/run-all-tests.sh`

### Test Pattern

```javascript
#!/usr/bin/env node
import { McpTestClient } from '../utils/mcp-test-client.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const mode = process.argv[2] || 'stdio';

async function runTest() {
  const clustersPath = join(__dirname, '../clusters.json');
  const clustersData = JSON.parse(readFileSync(clustersPath, 'utf8'));
  
  const client = new McpTestClient(mode === 'http' ? 'http://localhost:3000' : null);
  await client.initialize();
  
  // Test logic here
  
  await client.close();
}

runTest().catch(console.error);
```

## Troubleshooting

### Test Failures

1. **Check cluster configuration**: Verify `test/clusters.json` has correct credentials
2. **Verify build**: Run `npm run build` before tests
3. **Check server**: Ensure no conflicting processes on port 3000
4. **View logs**: Check `/tmp/mcp-test-suite-server.log` for HTTP mode issues

### Common Issues

**Issue**: Tests can't find `clusters.json`
**Solution**: Copy `test/clusters.json.example` to `test/clusters.json` and configure

**Issue**: HTTP mode tests fail
**Solution**: Ensure port 3000 is available and MCP server starts properly

**Issue**: Permission denied on shell scripts
**Solution**: `chmod +x test/run-all-tests.sh test/utils/setup-test-env.sh`

## Test Architecture

### Client Utilities

- **`mcp-test-client.js`**: STDIO mode JSON-RPC client with session management
- **`mcp-streamable-client.js`**: HTTP/SSE mode client with Streamable HTTP transport

### Test Types

1. **Unit Tests**: Individual tool validation
2. **Lifecycle Tests**: Complete workflow testing (create → use → delete)
3. **Integration Tests**: Multi-tool scenario testing
4. **Protocol Tests**: MCP specification compliance
5. **Session Tests**: Multi-session isolation and management

### Safety Features

- ✅ All tests use timestamped resource names (e.g., `test_vol_20251013_142530`)
- ✅ Cleanup only deletes resources created by tests
- ✅ Dynamic discovery of aggregates/SVMs (no hardcoding)
- ✅ Safe volume deletion workflow (offline → delete)
- ✅ No production resources affected

## Success Metrics

**Current Status: 25/25 tests passing (100%)**

- ✅ All ONTAP tools tested in both transports
- ✅ MCP protocol compliance validated
- ✅ Session management verified
- ✅ Resource cleanup confirmed
- ✅ Zero false positives
- ✅ Complete coverage of 55+ tools
