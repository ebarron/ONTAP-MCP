# Comprehensive Test Plan for Enhanced ONTAP MCP Server

## 🎯 Test Objectives

1. **API Field Validation** - Ensure all field parameters are valid for ONTAP REST API
2. **Tool Functionality** - Verify each tool works correctly end-to-end  
3. **Error Handling** - Test error scenarios and edge cases
4. **Integration** - Validate multi-tool workflows (create policy → apply to volume)

## 🧪 Test Categories

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

#### Volume Configuration (4 tools)
- [ ] `get_volume_configuration` - Get comprehensive volume info
- [ ] `update_volume_security_style` - Change volume security style
- [ ] `resize_volume` - Increase volume size
- [ ] `update_volume_comment` - Update volume description

### 3. Integration Workflow Tests
**Purpose:** Test complete provisioning scenarios

#### Workflow 1: Volume with Data Protection
1. Create volume
2. Create snapshot policy
3. Apply snapshot policy to volume
4. Verify policy is applied
5. Cleanup (remove policy, delete volume)

#### Workflow 2: Volume with NFS Access
1. Create volume  
2. Create export policy
3. Add export rules for specific clients
4. Apply export policy to volume
5. Verify NFS access configuration
6. Cleanup

#### Workflow 3: Multi-Cluster Operations
1. Add multiple clusters to registry
2. Create volumes on different clusters
3. Apply policies across clusters
4. Verify cross-cluster management

### 4. Error Handling Tests
**Purpose:** Ensure graceful error handling

- [ ] Invalid cluster credentials
- [ ] Non-existent volume/policy names
- [ ] Insufficient permissions
- [ ] Network connectivity issues
- [ ] Invalid parameter combinations

## 🛠️ Test Execution Plan

### Phase 1: API Field Fixes (In Progress)
- [x] Fix snapshot policy to use copies field
- [x] Fix export policy rules field  
- [ ] Validate volume configuration fields
- [ ] Test all field corrections

### Phase 2: Individual Tool Testing
- [ ] Test each tool with valid inputs
- [ ] Test error scenarios
- [ ] Document any remaining API issues

### Phase 3: Integration Testing
- [ ] Execute complete workflows
- [ ] Test multi-tool dependencies
- [ ] Validate end-to-end scenarios

### Phase 4: Performance & Reliability
- [ ] Test with large clusters
- [ ] Stress test with multiple concurrent operations
- [ ] Validate memory usage and cleanup

## 📋 Test Execution Checklist

### Pre-Test Setup
- [ ] ONTAP MCP server built and running
- [ ] Test cluster(s) accessible and registered
- [ ] Required permissions configured
- [ ] Test data prepared (volume names, policy names)

### Test Execution
- [ ] Run API field validation tests
- [ ] Execute individual tool tests
- [ ] Run integration workflow tests
- [ ] Document all failures and issues

### Post-Test Cleanup
- [ ] Remove test volumes and policies
- [ ] Clean up cluster registrations
- [ ] Document test results and fixes needed

## 🔧 Quick Test Commands

```bash
# API field validation
node test-api-fields.js

# Individual tool test
# Use VS Code MCP tools dropdown or HTTP API

# Integration test example
./test-volume-lifecycle.sh

# Full test suite (when created)
npm run test:all
```

## 📊 Success Criteria

- [ ] All API field validation tests pass
- [ ] All individual tools function correctly
- [ ] Integration workflows complete successfully  
- [ ] Error handling is graceful and informative
- [ ] Performance is acceptable for production use

## 🚨 Known Issues to Address

1. **API Field Issues** - Multiple endpoints using invalid field names
2. **Test Coverage Gap** - No automated tests for new tools
3. **Error Messaging** - Some tools may not provide clear error messages
4. **Documentation** - Tool parameters need better documentation

## 📝 Notes

- Tests should be run against both simulated and real ONTAP clusters
- All test data should be cleaned up automatically
- Failed tests should provide clear remediation steps
- Test results should be logged for trend analysis
