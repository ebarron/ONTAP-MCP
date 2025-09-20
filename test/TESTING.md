# NetApp ONTAP MCP Server - Testing Guide

This comprehensive guide covers everything you need to test the NetApp ONTAP MCP Server, from environment setup to executing comprehensive test suites.

## 🎯 Quick Start

```bash
# 1. Set up test environment
./test/setup-test-env.sh

# 2. Build project  
npm run build

# 3. Run core tests
node test/test-volume-lifecycle.js stdio    # Test STDIO transport
node test/test-volume-lifecycle.js rest     # Test HTTP REST API
./test/test-volume-lifecycle.sh             # Test REST API via bash
node test/check-aggregates.js               # Check aggregates
./test/verify-tool-count.sh                 # Verify all 38 tools registered
```

## 📋 Test Coverage

### Available Test Tools

| Test Tool | Purpose | Transport Mode | Lines |
|-----------|---------|----------------|--------|
| `test-volume-lifecycle.js` | Complete volume CRUD workflow | STDIO & REST | Core test |
| `test-volume-lifecycle.sh` | Volume lifecycle via shell script | REST only | Core test |
| `check-aggregates.js` | Cross-cluster aggregate verification | REST | Utility |
| `verify-tool-count.sh` | Tool registration validation | Local | Validation |
| `test-comprehensive.js` | Full feature testing suite | REST | Extended |
| `test-policy-management.sh` | Policy workflow testing | REST | Extended |
| `setup-test-env.sh` | Interactive environment setup | Local | Setup |
| `test-api-fields.js` | API field validation testing | REST | Debug |
| `test-api-fixes.js` | API compatibility testing | REST | Debug |

### Tool Categories Tested (38 Total)

**Legacy Single-Cluster Tools (8)**
- `get_cluster_info`, `list_volumes`, `list_svms`, `list_aggregates` 
- `create_volume`, `get_volume_stats`, `offline_volume`, `delete_volume`

**Multi-Cluster Management (10)** 
- `add_cluster`, `list_registered_clusters`, `get_all_clusters_info`
- `cluster_list_*`, `cluster_create_volume`, `cluster_offline_volume`, etc.

**Snapshot Policy Management (7)**
- `list_snapshot_policies`, `get_snapshot_policy`, `create_snapshot_policy`
- `update_snapshot_policy`, `delete_snapshot_policy`, `apply_snapshot_policy_to_volume`

**Export Policy Management (9)**
- `list_export_policies`, `get_export_policy`, `create_export_policy`
- `add_export_rule`, `configure_volume_nfs_access`, etc.

**Volume Configuration/Updates (4)**
- `get_volume_configuration`, `update_volume_security_style`
- `resize_volume`, `update_volume_comment`

## 🔧 Environment Setup

### Security Model

All test scripts use environment variables to ensure:
- ✅ No credentials stored in source code
- ✅ No credentials committed to git  
- ✅ Users control their own cluster configurations
- ✅ Same configuration works for development and testing

### Option 1: Interactive Setup (Recommended)

```bash
./test/setup-test-env.sh
```

This script guides you through:
- Cluster configuration (IP, credentials, description)
- Environment variable setup
- Configuration format selection (new object vs legacy array)
- Automatic validation

### Option 2: Manual Configuration

**New Object Format (Recommended):**
```bash
export ONTAP_CLUSTERS='{
  "production": {
    "cluster_ip": "10.193.184.184",
    "username": "admin", 
    "password": "Netapp1!",
    "description": "Production cluster"
  },
  "development": {
    "cluster_ip": "10.193.184.185",
    "username": "admin",
    "password": "DevPassword123",
    "description": "Development cluster"
  }
}'
```

**Legacy Array Format (Still Supported):**
```bash
export ONTAP_CLUSTERS='[
  {
    "name": "production",
    "cluster_ip": "10.193.184.184",
    "username": "admin",
    "password": "Netapp1!",
    "description": "Production cluster"
  }
]'
```

**Optional Test Parameters:**
```bash
export TEST_SVM_NAME="vs0"              # Default SVM for testing
export TEST_AGGREGATE_NAME="aggr1_1"    # Default aggregate for testing
```

### VS Code MCP Configuration

For VS Code integration, add to your MCP settings:
```json
{
  "servers": {
    "netapp-ontap-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/ONTAP-MCP/build/index.js"],
      "env": {
        "ONTAP_CLUSTERS": {
          "production": {
            "cluster_ip": "10.193.184.184",
            "username": "admin",
            "password": "Netapp1!",
            "description": "Production cluster"
          }
        }
      }
    }
  }
}
```

## 🧪 Test Execution Strategy

### Phase 1: Core Functionality Tests

**Volume Lifecycle (Core)**
```bash
# Test both transport modes
node test/test-volume-lifecycle.js stdio
node test/test-volume-lifecycle.js rest

# Test via shell script
./test/test-volume-lifecycle.sh
```

**Tool Registration Validation**
```bash
./test/verify-tool-count.sh
```

**Multi-Cluster Operations**
```bash
node test/check-aggregates.js
```

### Phase 2: API Field Validation

**Purpose:** Catch invalid field parameters that cause HTTP 400 errors

**Critical API Issues Fixed:**
- ✅ `copies` field with nested schedule objects for snapshot policies
- ✅ `rules` field handling in export policies  
- ✅ Complex nested fields in volume configuration

**Test Commands:**
```bash
node test/test-api-fields.js      # API field validation
node test/test-api-fixes.js       # API compatibility
```

### Phase 3: Integration Workflow Tests

**Complete Provisioning Workflows:**

**Workflow 1: Volume with Data Protection**
```bash
# Create snapshot policy → Create volume → Apply policy → Verify protection
create_snapshot_policy → cluster_create_volume → apply_snapshot_policy_to_volume → get_volume_configuration
```

**Workflow 2: Volume with NFS Access**  
```bash
# Create export policy → Add rules → Create volume → Configure NFS access
create_export_policy → add_export_rule → cluster_create_volume → configure_volume_nfs_access
```

**Workflow 3: Multi-Cluster Operations**
```bash
# Register clusters → List resources → Create volumes across clusters
add_cluster → cluster_list_aggregates → cluster_create_volume
```

### Phase 4: Comprehensive Feature Testing

```bash
node test/test-comprehensive.js        # Full feature suite
./test/test-policy-management.sh       # Policy workflows
```

## 🛠️ Test Categories & Objectives

### 1. API Field Validation Tests
**Purpose:** Ensure all field parameters are valid for ONTAP REST API

**Tools to Test:**
- `list_snapshot_policies` - ✅ Fixed to use copies field
- `get_snapshot_policy` - ✅ Fixed to use copies field  
- `list_export_policies` - ✅ Fixed rules field
- `get_export_policy` - ✅ Fixed rules field
- `get_volume_configuration` - ⚠️ Complex field validation

### 2. Core Tool Functionality Tests
**Purpose:** Verify each tool performs its intended function

**Test Matrix:**
- [ ] All 8 legacy single-cluster tools  
- [ ] All 10 multi-cluster management tools
- [ ] All 7 snapshot policy management tools
- [ ] All 9 export policy management tools  
- [ ] All 4 volume configuration tools

### 3. Integration Workflow Tests
**Purpose:** Test complete end-to-end workflows

**Scenarios:**
- Volume provisioning with data protection
- NFS share creation with access control
- Multi-cluster resource management
- Policy lifecycle management

### 4. Error Handling Tests
**Purpose:** Validate error scenarios and edge cases

**Test Cases:**
- Invalid cluster credentials
- Non-existent resources
- Policy dependency violations
- Network connectivity issues
- Malformed input parameters

## 📊 Success Criteria

### API Validation Success:
- ✅ All 38 tools register correctly in VS Code MCP dropdown
- ✅ No HTTP 400 "invalid field" errors during tool execution
- ✅ Complex parameter structures (policies, rules) accepted by ONTAP API
- ✅ Consistent error handling across all tools

### Functional Success:
- ✅ Volume lifecycle: create → configure → offline → delete
- ✅ Policy management: create → apply → update → remove → delete
- ✅ Multi-cluster operations work seamlessly
- ✅ Both STDIO and REST transports function identically

### Integration Success:  
- ✅ Complete provisioning workflows execute without errors
- ✅ Policy dependencies respected (volumes offline before deletion)
- ✅ Cross-cluster operations maintain consistency
- ✅ Real-world use cases work end-to-end

## 🔍 Troubleshooting

### Common Issues

1. **Tool Count Mismatch**
   ```bash
   ./test/verify-tool-count.sh  # Should show 38 tools
   ```

2. **API Field Errors**
   ```bash
   node test/test-api-fields.js  # Validate field parameters
   ```

3. **Environment Configuration**
   ```bash
   ./test/setup-test-env.sh     # Reconfigure environment
   ```

4. **Transport Mode Issues**
   ```bash
   # Test both modes
   node test/test-volume-lifecycle.js stdio
   node test/test-volume-lifecycle.js rest
   ```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* node test/test-volume-lifecycle.js stdio
DEBUG=* node test/check-aggregates.js
```

### Test Environment Validation

```bash
# Verify environment
echo $ONTAP_CLUSTERS | jq .

# Test cluster connectivity  
node test/check-aggregates.js

# Validate tool registration
./test/verify-tool-count.sh
```

## 📝 Test Execution Checklist

### Pre-Test Setup
- [ ] ONTAP clusters accessible and credentials valid
- [ ] Environment variables configured (`ONTAP_CLUSTERS`)
- [ ] Project built successfully (`npm run build`)
- [ ] VS Code MCP integration configured (optional)

### Core Test Execution
- [ ] Tool count validation (`./test/verify-tool-count.sh`)
- [ ] Volume lifecycle STDIO (`node test/test-volume-lifecycle.js stdio`)
- [ ] Volume lifecycle REST (`node test/test-volume-lifecycle.js rest`)
- [ ] Shell script testing (`./test/test-volume-lifecycle.sh`)
- [ ] Aggregate verification (`node test/check-aggregates.js`)

### Extended Test Execution  
- [ ] API field validation (`node test/test-api-fields.js`)
- [ ] Comprehensive testing (`node test/test-comprehensive.js`)
- [ ] Policy workflows (`./test/test-policy-management.sh`)

### Post-Test Validation
- [ ] All tests passed without errors
- [ ] VS Code shows 38 tools in MCP dropdown
- [ ] No HTTP 400 errors during API calls
- [ ] Both transport modes work identically

## 🎯 Expected Outcomes

### Post-Enhancement Results:
- **Tool Count:** 38 tools across 5 categories (was 8 basic tools)
- **API Coverage:** Complete ONTAP storage management lifecycle  
- **Transport Support:** Both STDIO and HTTP REST API modes
- **Workflow Support:** End-to-end provisioning and management
- **Enterprise Ready:** Production-quality error handling and validation

### Performance Benchmarks:
- **Tool Registration:** < 2 seconds in VS Code
- **API Response:** < 5 seconds for standard operations
- **Volume Lifecycle:** Complete test < 30 seconds
- **Multi-Cluster:** Operations scale linearly with cluster count

---

## 📚 Related Documentation

- [ENHANCED_PROVISIONING.md](../ENHANCED_PROVISIONING.md) - Complete provisioning workflows
- [HTTP_CONFIG.md](../HTTP_CONFIG.md) - HTTP transport configuration
- [README.md](../README.md) - Project overview and setup

## 🏷️ Test Tags

`netapp` `ontap` `mcp` `testing` `volume-management` `policy-management` `multi-cluster` `integration-testing`