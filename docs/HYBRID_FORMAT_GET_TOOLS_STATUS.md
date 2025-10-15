# Hybrid Format "Get" Tools Migration Status

## Current Status: Phase 1 - Initial Discovery Complete

**Date**: October 15, 2025  
**Progress**: 1/10 tools validated (10%)  
**Next Action**: Manual testing of Fix-It undo with hybrid format

---

## ✅ Completed

### Tool 1: `get_volume_configuration` - Already Hybrid! ✅

**Status**: Migration already completed in previous work!

**What We Found**:
- ✅ Server already returns hybrid format `{summary, data}`
- ✅ TypeScript interface `VolumeConfigurationResult` defined
- ✅ Structured data uses MCP parameter names directly
- ✅ UndoManager already has code to parse structured data
- ❌ **Bug Found**: UndoManager was calling `callMcp()` instead of `callMcpRaw()`

**Bug Fix Applied**:
- Changed `UndoManager.captureViaVolumeConfiguration()` to use `callMcpRaw()`
- This bypasses `parseContent()` which extracts only `.summary`
- Now gets full hybrid object with `.data` for programmatic use

**Files Changed**:
- `demo/js/core/UndoManager.js` - Use `callMcpRaw()` to preserve `.data`

**Testing Required**:
1. ✅ Build successful
2. ✅ Demo started
3. ⏳ **TODO**: Manual test - Execute Fix-It action and verify:
   - State is captured using `.data` (not text parsing)
   - Undo button appears
   - Undo executes successfully
   - Console shows "Detected hybrid format from get_volume_configuration"
   - Console shows structured data parsing (not text regex)

---

## 🔄 In Progress

### Understanding the Current State

**Key Finding**: `get_volume_configuration` was already migrated but the client-side code wasn't using it correctly!

**Root Cause**: The demo's `McpApiClient.callMcp()` method:
1. Calls `McpStreamableClient.callTool()`
2. Extracts text via `parseContent()`
3. `parseContent()` detects hybrid format and returns only `.summary`
4. Result: `.data` is lost!

**Solution**: Use `callMcpRaw()` which returns the full MCP response envelope:
```javascript
{
  content: [{
    type: "text",
    text: {
      summary: "...",  // For LLMs
      data: {...}      // For programmatic use
    }
  }]
}
```

---

## 📋 Tools Remaining (9 tools)

### Priority 1: Critical for Undo Support (5 tools)

2. **`cluster_get_qos_policy`** ⏳
   - Current: Returns `Promise<string>`
   - Need: Hybrid format with policy details
   - Used by: QoS policy Fix-It actions

3. **`get_export_policy`** ⏳
   - Current: Returns text with rules
   - Need: Hybrid format with rules array
   - Used by: NFS access control Fix-It actions

4. **`get_cifs_share`** ⏳
   - Current: Returns `Promise<string>`
   - Need: Hybrid format with share config & ACLs
   - Used by: CIFS share Fix-It actions

5. **`get_snapshot_policy`** ⏳
   - Current: Returns text with policy config
   - Need: Hybrid format with schedule details
   - Used by: Snapshot policy Fix-It actions

6. **`cluster_get_volume_snapshot_info`** ⏳
   - Current: Individual snapshot details (text)
   - Need: Hybrid format with snapshot properties
   - Used by: Snapshot management decisions

### Priority 2: Beneficial but Not Critical (4 tools)

7. **`get_volume_stats`** / **`cluster_get_volume_stats`** ⏳
   - Current: Likely already structured?
   - Benefit: Performance metrics for UI graphs

8. **`get_cluster_info`** ⏳
   - Current: Cluster health text
   - Benefit: Structured cluster properties

9. **`get_snapshot_schedule`** ⏳
   - Current: Schedule details (text)
   - Benefit: Programmatic schedule parsing

10. **`cluster_get_volume_autosize_status`** ✅
    - Status: Already hybrid format!
    - Type: `AutosizeStatusResult`

---

## Migration Pattern (Reference)

Based on `get_volume_configuration` implementation:

### 1. Define TypeScript Interface

```typescript
// src/types/{feature}-types.ts
export interface FeatureData {
  // Use MCP parameter names directly!
  param1: string;
  param2: number;
  // ...
}

export interface FeatureResult {
  summary: string;        // Human-readable text
  data: FeatureData;      // Structured data
}
```

### 2. Update Handler to Return Hybrid Format

```typescript
export async function handleGetFeature(args: any): Promise<FeatureResult> {
  // Fetch from ONTAP
  const response = await client.get(`/api/endpoint`);
  
  // Build structured data (MCP parameter names!)
  const data: FeatureData = {
    param1: response.param1,
    param2: response.param2,
    // ...
  };
  
  // Build summary (keep existing format!)
  const summary = formatFeature(response);
  
  // Return hybrid format
  return { summary, data };
}
```

### 3. Update Consumers to Use Structured Data

```javascript
// demo/js/core/SomeConsumer.js

// OLD: Text parsing
const result = await apiClient.callMcp('get_feature', params);
const match = result.match(/Param1:\s*(\w+)/);  // ❌ Fragile!

// NEW: Structured access
const response = await apiClient.callMcpRaw('get_feature', params);
const config = response.content[0].text;  // Extract from MCP envelope
const value = config.data.param1;  // ✅ Direct access!
```

### 4. Add Tests

```javascript
// test/tools/test-feature-get.js

describe('get_feature hybrid format', () => {
  it('should return summary and data', async () => {
    const result = await client.callTool('get_feature', params);
    
    // Check structure
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('data');
    expect(typeof result.summary).toBe('string');
    expect(typeof result.data).toBe('object');
  });
  
  it('should use MCP parameter names', async () => {
    const result = await client.callTool('get_feature', params);
    
    // Verify parameter names match MCP tools
    expect(result.data).toHaveProperty('param1');  // Not 'feature_param1'!
    expect(result.data).toHaveProperty('param2');
  });
});
```

---

## Next Steps

### Immediate (Today)

1. ✅ **Manual Testing** - Test Fix-It undo workflow:
   - Open demo at http://localhost:8080
   - Navigate to a volume with high utilization
   - Execute a Fix-It action to enable autosize
   - Verify console shows hybrid format detection
   - Verify undo button appears
   - Click undo and verify it restores original state

2. **Document Results** - Update this file with test results

3. **Create Test Suite** - Add automated test for `get_volume_configuration` hybrid format

### This Week

4. **Migrate Tool #2**: `cluster_get_qos_policy`
   - Define `QosPolicyData` interface
   - Update handler to return hybrid format
   - Test with QoS Fix-It actions

5. **Migrate Tool #3**: `get_export_policy`
   - Define `ExportPolicyData` interface
   - Update handler with rules array
   - Test with NFS Fix-It actions

### Success Criteria

For each migrated tool:

- ✅ TypeScript interface defined
- ✅ Handler returns `{summary, data}`
- ✅ Parameter names match MCP tools exactly
- ✅ Tests pass (27/27 for regression + new hybrid format tests)
- ✅ Demo UI works with structured data
- ✅ UndoManager uses structured data (no text parsing)
- ✅ Zero parameter mapping tables needed

---

## Benefits Achieved (After Full Migration)

### Technical

- ✅ Zero text parsing (no regex fragility)
- ✅ Zero parameter mapping tables (no remediation-specific code)
- ✅ Type safety via TypeScript interfaces
- ✅ Self-documenting data structures
- ✅ Future-proof architecture

### User Experience

- ✅ Reliable undo functionality
- ✅ Faster state capture (no parsing overhead)
- ✅ Better error messages (type validation)
- ✅ Consistent behavior across all Fix-It actions

### Maintainability

- ✅ One source of truth for parameter names (MCP tool definitions)
- ✅ Generic infrastructure (works for ANY tool)
- ✅ Easy to add new Fix-It actions (no UndoManager changes needed)
- ✅ Easy to test (structured data validation)

---

## Related Documentation

- `UNDO_ARCHITECTURE.md` - Problem analysis and solution design
- `HYBRID_FORMAT_GET_TOOLS_PLAN.md` - Complete migration plan
- `HYBRID_FORMAT_MIGRATION_STATUS.md` - List tools status (8/8 complete)
- Test files: `test/tools/test-*-lifecycle.js`

---

**Last Updated**: October 15, 2025  
**Status**: Phase 1 in progress - Manual testing required
