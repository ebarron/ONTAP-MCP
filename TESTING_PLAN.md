# NetApp ONTAP MCP Enhanced Tools - Testing Plan

## Overview
Comprehensive testing strategy for the 38 NetApp ONTAP MCP tools, with focus on the 22 newly added policy management and provisioning tools.

## Test Categories

### 1. API Field Validation Tests
**Purpose**: Ensure all API endpoints use correct field parameters
**Priority**: HIGH (blocking issues found)

#### Tools to Test:
- ✅ **Snapshot Policy Management** (7 tools)
  - `list_snapshot_policies` 
  - `get_snapshot_policy`
  - `create_snapshot_policy`
  - `update_snapshot_policy` 
  - `delete_snapshot_policy`
  - `apply_snapshot_policy_to_volume`
  - `remove_snapshot_policy_from_volume`

- ✅ **Export Policy Management** (9 tools)
  - `list_export_policies`
  - `get_export_policy`
  - `create_export_policy`
  - `delete_export_policy`
  - `add_export_rule`
  - `update_export_rule`
  - `delete_export_rule`
  - `configure_volume_nfs_access`
  - `disable_volume_nfs_access`

- ✅ **Volume Configuration** (4 tools)
  - `get_volume_configuration`
  - `update_volume_security_style`
  - `resize_volume`
  - `update_volume_comment`

#### Common API Issues Found:
- ✅ `copies` field with nested schedule objects is the correct format for snapshot policies  
- ❌ `rules` field not supported in export policies endpoint  
- ❌ Complex nested fields may cause issues in volume configuration

### 2. Integration Testing
**Purpose**: Test complete workflows end-to-end

#### Test Scenarios:
1. **Volume Provisioning Workflow**
   ```
   create_volume → get_volume_configuration → 
   apply_snapshot_policy_to_volume → configure_volume_nfs_access
   ```

2. **Policy Management Workflow**  
   ```
   create_snapshot_policy → apply_snapshot_policy_to_volume →
   create_export_policy → add_export_rule → configure_volume_nfs_access
   ```

3. **Multi-Cluster Operations**
   ```
   add_cluster → cluster_list_volumes → cluster_create_volume
   ```

### 3. Error Handling Tests
**Purpose**: Validate proper error responses and messages

#### Test Cases:
- Invalid cluster credentials
- Non-existent resources (volumes, policies)
- Malformed input parameters
- Network connectivity issues
- API rate limiting

### 4. Regression Testing  
**Purpose**: Ensure original 18 tools still work correctly

#### Legacy Tools to Verify:
- Basic cluster operations (8 tools)
- Multi-cluster management (10 tools)

## Test Implementation

### Quick API Validation Script
```bash
# Test critical API endpoints
node test-api-fields.js
```

### Comprehensive Integration Tests
```bash
# Full workflow testing
node test-enhanced-workflows.js
```

### Manual Testing Checklist
- [ ] Restart MCP server after fixes
- [ ] Test snapshot policies on julia-vsim-1
- [ ] Test export policies on julia-vsim-1  
- [ ] Verify tool count shows 38 in VS Code
- [ ] Test complete provisioning workflow

## Expected Outcomes

### Post-Fix Results:
- ✅ All 38 tools appear in VS Code MCP dropdown
- ✅ Snapshot policy tools work without field errors
- ✅ Export policy tools work without field errors
- ✅ Volume configuration tools return proper data
- ✅ No regression in original 18 tools

### Success Criteria:
- Zero HTTP 400 field validation errors
- All tools return properly formatted responses
- Complete workflows execute successfully
- Error messages are clear and actionable

## Development Process Improvements

### Root Cause Analysis:
- API field parameters were assumed rather than validated
- Insufficient integration testing during development
- Missing validation against real ONTAP clusters

### Recommended Changes:
1. **API-First Development**: Validate all endpoints against ONTAP documentation
2. **Continuous Testing**: Run API validation on every build
3. **Real Cluster Testing**: Test against live ONTAP systems during development
4. **Incremental Delivery**: Test each tool individually before adding to collection

## Next Steps

1. **Immediate** (Fix blocking issues)
   - ✅ Fix all API field parameters
   - ✅ Rebuild and restart MCP server
   - ⏳ Test critical tools (snapshot/export policies)

2. **Short Term** (Validate functionality)
   - Create comprehensive test suite
   - Test all 22 new tools individually  
   - Validate complete provisioning workflows

3. **Long Term** (Process improvements)
   - Implement automated API validation
   - Add CI/CD testing against test clusters
   - Create tool documentation with examples

---

**Status**: API field fixes completed, ready for testing after MCP server restart