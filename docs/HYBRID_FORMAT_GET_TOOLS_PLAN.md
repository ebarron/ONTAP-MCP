# Hybrid Format Migration Plan: "Get" Tools for Undo/Reversibility

## Executive Summary

This document outlines the plan to migrate state capture "get" tools from text-based responses to hybrid format `{summary, data}`. This migration is **critical** for implementing proper undo/reversibility functionality as documented in `UNDO_ARCHITECTURE.md`.

**Goal**: Enable generic, maintainable undo support by providing structured state data that uses the same parameter names as MCP action tools.

## Why This Migration is Critical

From `UNDO_ARCHITECTURE.md`, the current text-based approach has severe problems:

### 🚨 Current Problems

1. **Text Parsing Brittleness**: Regex patterns break when display format changes
2. **Parameter Name Mismatches**: Display names ≠ MCP parameter names → requires hardcoded mapping tables
3. **Remediation-Specific Code**: Violates architecture principle of generic capabilities
4. **No Type Safety**: String parsing provides no guarantees
5. **Hidden Dependencies**: Changes anywhere in the chain break undo functionality
6. **Violation of DRY**: Parameter names defined 3+ times across codebase

### ✅ Hybrid Format Solution

```typescript
// Current (Fragile): Text-based
return `
Volume Configuration:
   • Autosize Mode: off
   • Maximum Size: 190.00 MB
`;

// Proposed (Robust): Hybrid format
return {
  summary: "Volume Configuration:\n   • Autosize Mode: off\n   • Maximum Size: 190.00 MB",
  data: {
    autosize: {
      mode: "off",                    // Matches MCP parameter name!
      maximum_size: "190.00 MB",      // Matches MCP parameter name!
      minimum_size: "50.00 MB",
      grow_threshold_percent: 85,
      shrink_threshold_percent: 50
    }
  }
};
```

**Benefits**:
- ✅ Direct property access (no parsing)
- ✅ Parameter names match MCP tools exactly
- ✅ Generic `findParameterInState()` works for ALL tools
- ✅ Type safety via TypeScript interfaces
- ✅ Future-proof: adding properties doesn't break code

## Tools to Migrate

### Priority 1: Critical for Undo Support (6 tools)

These tools capture state needed for reversibility of Fix-It actions:

1. **`get_volume_configuration`** (or `cluster_get_volume_configuration`)
   - **Current**: Returns `VolumeConfigurationResult` but **still text-based**!
   - **Used By**: Fix-It actions for volume state, autosize, QoS, snapshot policy
   - **Critical**: Already has type definition but needs hybrid format implementation
   - **MCP Tools Supported**: 
     - `cluster_enable_volume_autosize`
     - `cluster_update_volume` (size, comment, security_style, state)
     - QoS policy assignment
     - Snapshot policy assignment
     - NFS export policy assignment

2. **`cluster_get_qos_policy`**
   - **Current**: Returns `Promise<string>` (text only)
   - **Used By**: Fix-It actions that modify QoS policies
   - **Critical**: QoS policy changes need reversibility
   - **MCP Tools Supported**:
     - `cluster_create_qos_policy`
     - `cluster_update_qos_policy`

3. **`get_export_policy`**
   - **Current**: Returns text with policy rules
   - **Used By**: Fix-It actions for NFS access control
   - **Critical**: Export rule changes need reversibility
   - **MCP Tools Supported**:
     - `add_export_rule`
     - `update_export_rule`
     - `delete_export_rule`

4. **`get_cifs_share`**
   - **Current**: Returns `Promise<string>`
   - **Used By**: Fix-It actions for CIFS/SMB share configuration
   - **Critical**: Share ACL and property changes need reversibility
   - **MCP Tools Supported**:
     - `create_cifs_share`
     - `update_cifs_share`
     - `cluster_create_cifs_share`

5. **`get_snapshot_policy`**
   - **Current**: Returns text with policy configuration
   - **Used By**: Fix-It actions for backup/DR configuration
   - **Critical**: Snapshot schedule changes need reversibility
   - **MCP Tools Supported**:
     - `create_snapshot_policy`
     - `update_snapshot_policy`

6. **`cluster_get_volume_snapshot_info`**
   - **Current**: Individual snapshot details (text)
   - **Used By**: Snapshot deletion/restore decisions
   - **Benefit**: Structured data for snapshot properties
   - **MCP Tools Supported**:
     - `cluster_delete_volume_snapshot`

### Priority 2: Beneficial but Not Critical (4 tools)

These provide diagnostic/informational data:

7. **`get_volume_stats`** / **`cluster_get_volume_stats`**
   - **Current**: Performance metrics (likely already structured?)
   - **Benefit**: Structured access to IOPS, throughput, latency

8. **`get_cluster_info`**
   - **Current**: Cluster health information
   - **Benefit**: Structured cluster properties

9. **`get_snapshot_schedule`**
   - **Current**: Schedule details (cron/interval)
   - **Benefit**: Programmatic access to schedule configuration

10. **`cluster_get_volume_autosize_status`**
    - **Status**: ✅ **Already migrated to hybrid format!**
    - **Type**: `AutosizeStatusResult`
    - **Pattern**: Use as reference for other migrations

## Migration Pattern (Reference Implementation)

### Step 1: Define TypeScript Interface

```typescript
// src/types/volume-types.ts
export interface VolumeConfigurationData {
  volume: {
    uuid: string;
    name: string;
    size: string;           // e.g., "100GB"
    state: 'online' | 'offline' | 'restricted';
    type: string;
    comment?: string;
  };
  svm: {
    name: string;
    uuid: string;
  };
  autosize: {
    // Use MCP parameter names directly!
    mode: 'off' | 'grow' | 'grow_shrink';
    maximum_size?: string;
    minimum_size?: string;
    grow_threshold_percent?: number;
    shrink_threshold_percent?: number;
  };
  snapshot_policy?: {
    name: string;
  };
  qos?: {
    policy_name?: string;
  };
  nfs?: {
    export_policy?: string;
  };
  space?: {
    size: number;
    available: number;
    used: number;
    percent_used: number;
  };
  efficiency?: {
    compression?: string;
    dedupe?: string;
  };
}

export interface VolumeConfigurationResult {
  summary: string;                    // Human-readable text
  data: VolumeConfigurationData;      // Structured data
}
```

### Step 2: Implement Hybrid Format Response

```typescript
// src/tools/volume-tools.ts
export async function handleGetVolumeConfiguration(
  args: any, 
  clusterManager: OntapClusterManager
): Promise<VolumeConfigurationResult> {
  
  const client = getApiClient(/* ... */);
  
  // Fetch from ONTAP API
  const response = await client.get(`/storage/volumes/${uuid}?fields=...`);
  const volume = response.data;
  
  // Build structured data with MCP parameter names
  const data: VolumeConfigurationData = {
    volume: {
      uuid: volume.uuid,
      name: volume.name,
      size: formatBytes(volume.space?.size),
      state: volume.state,
      type: volume.type,
      comment: volume.comment || undefined
    },
    svm: {
      name: volume.svm.name,
      uuid: volume.svm.uuid
    },
    autosize: {
      mode: volume.autosize?.mode || 'off',
      maximum_size: volume.autosize?.maximum ? formatBytes(volume.autosize.maximum) : undefined,
      minimum_size: volume.autosize?.minimum ? formatBytes(volume.autosize.minimum) : undefined,
      grow_threshold_percent: volume.autosize?.grow_threshold,
      shrink_threshold_percent: volume.autosize?.shrink_threshold
    },
    snapshot_policy: volume.snapshot_policy?.name ? {
      name: volume.snapshot_policy.name
    } : undefined,
    qos: volume.qos?.policy?.name ? {
      policy_name: volume.qos.policy.name
    } : undefined,
    nfs: volume.nas?.export_policy?.name ? {
      export_policy: volume.nas.export_policy.name
    } : undefined,
    space: {
      size: volume.space?.size || 0,
      available: volume.space?.available || 0,
      used: volume.space?.used || 0,
      percent_used: volume.space?.size ? 
        Math.round((volume.space.used / volume.space.size) * 100) : 0
    },
    efficiency: {
      compression: volume.efficiency?.compression,
      dedupe: volume.efficiency?.dedupe
    }
  };
  
  // Build human-readable summary (keep existing format!)
  const summary = formatVolumeConfig(volume);
  
  // Return hybrid format
  return { summary, data };
}
```

### Step 3: Update UndoManager to Use Structured Data

```javascript
// demo/js/core/UndoManager.js

// ❌ DELETE: No more parameter mapping tables!
// const paramMapping = { ... };

// ✅ NEW: Generic parameter search
findParameterInState(paramName, state) {
  // Search in all sections of the state object
  for (const section of Object.keys(state)) {
    if (typeof state[section] === 'object' && state[section] !== null) {
      if (state[section][paramName] !== undefined) {
        return {
          section: section,
          value: state[section][paramName]
        };
      }
    }
  }
  return null;
}

// Generic reversibility detection (works for ANY tool!)
determineReversibility(action, originalState) {
  const canRestore = [];
  const cannotRestore = [];
  
  for (const param of paramsToCheck) {
    if (param === 'cluster_name' || param === 'volume_uuid') {
      continue;  // Skip identifiers
    }
    
    const found = this.findParameterInState(param, originalState.data);
    
    if (found && found.value !== undefined) {
      canRestore.push(param);
    } else {
      cannotRestore.push(param);
    }
  }
  
  return {
    reversible: cannotRestore.length === 0,
    canRestore,
    cannotRestore
  };
}
```

## Implementation Roadmap

### Phase 1: High-Priority State Capture Tools (Week 1)

**Goal**: Enable undo for volume autosize Fix-It actions (most common use case)

1. **Day 1-2: `get_volume_configuration`**
   - Define `VolumeConfigurationData` interface
   - Implement hybrid format response
   - Update UndoManager to use structured data
   - Test: Fix-It action → Undo button appears → Undo executes successfully
   - **Success Criteria**: No parameter mapping table needed

2. **Day 3: `cluster_get_qos_policy`**
   - Define `QosPolicyData` interface
   - Implement hybrid format response
   - Test: QoS policy modifications have undo support
   - **Success Criteria**: Generic `findParameterInState()` finds QoS params

3. **Day 4: Testing & Validation**
   - Run full test suite (expect 27/27 passing)
   - Manual testing of Fix-It undo workflows
   - Document parameter name conventions
   - **Success Criteria**: Zero remediation-specific code in UndoManager

### Phase 2: Additional State Capture Tools (Week 2)

4. **Day 5: `get_export_policy`**
   - Define `ExportPolicyData` interface
   - Implement hybrid format with rules array
   - Test: Export rule changes have undo support

5. **Day 6: `get_cifs_share`**
   - Define `CifsShareData` interface
   - Implement hybrid format with ACLs
   - Test: CIFS share modifications have undo support

6. **Day 7-8: `get_snapshot_policy`**
   - Define `SnapshotPolicyData` interface
   - Implement hybrid format with copies array
   - Test: Snapshot policy changes have undo support

7. **Day 9: `cluster_get_volume_snapshot_info`**
   - Define `VolumeSnapshotData` interface
   - Implement hybrid format
   - Verify alignment with `cluster_list_volume_snapshots`

### Phase 3: Diagnostic Tools (Week 3)

8. **Day 10-11: Remaining tools**
   - `get_volume_stats` / `cluster_get_volume_stats`
   - `get_cluster_info`
   - `get_snapshot_schedule`

9. **Day 12-14: Final Testing & Documentation**
   - Comprehensive test coverage
   - Update UNDO_ARCHITECTURE.md with "COMPLETED" status
   - Create migration guide for future tools
   - Performance benchmarking

## Testing Strategy

### Unit Tests

For each migrated tool:

```javascript
describe('get_volume_configuration hybrid format', () => {
  it('should return summary and data properties', async () => {
    const result = await mcpClient.callTool('get_volume_configuration', {
      cluster_name: 'test-cluster',
      volume_uuid: 'abc-123'
    });
    
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('data');
    expect(typeof result.summary).toBe('string');
    expect(typeof result.data).toBe('object');
  });
  
  it('should use MCP parameter names in data', async () => {
    const result = await mcpClient.callTool('get_volume_configuration', {
      cluster_name: 'test-cluster',
      volume_uuid: 'abc-123'
    });
    
    // Verify parameter names match MCP tool names
    expect(result.data.autosize).toHaveProperty('mode');
    expect(result.data.autosize).toHaveProperty('maximum_size');
    expect(result.data.autosize).toHaveProperty('minimum_size');
    expect(result.data.autosize).toHaveProperty('grow_threshold_percent');
  });
  
  it('should enable generic parameter search', async () => {
    const state = await mcpClient.callTool('get_volume_configuration', {
      cluster_name: 'test-cluster',
      volume_uuid: 'abc-123'
    });
    
    // Generic search should work
    const found = findParameterInState('mode', state.data);
    expect(found).toBeTruthy();
    expect(found.section).toBe('autosize');
    expect(found.value).toBeDefined();
  });
});
```

### Integration Tests

1. **Undo Workflow Test**:
   - Execute Fix-It action with state capture
   - Verify UndoManager detects reversibility
   - Execute undo action
   - Verify original state restored

2. **Cross-Tool Consistency Test**:
   - Verify parameter names match across get/set tool pairs
   - Verify data types match action parameter schemas

3. **HTTP vs STDIO Mode Test**:
   - Verify hybrid format works in both transport modes
   - Verify MCP envelope extraction works correctly

### Manual Testing Checklist

- [ ] Fix-It action shows undo button
- [ ] Undo button executes successfully
- [ ] UndoManager has zero parameter mapping tables
- [ ] LLM still receives readable summaries
- [ ] Demo UI can access structured data
- [ ] All 27+ tests passing

## Parameter Name Convention Guidelines

To ensure consistency and avoid future mapping issues:

### 1. Match MCP Tool Parameter Names Exactly

```typescript
// ✅ CORRECT: State uses same name as MCP tool
data.autosize.mode = "off";
// MCP tool: cluster_enable_volume_autosize(mode="off")

// ❌ INCORRECT: Different name requires mapping
data.autosize.autosize_mode = "off";
```

### 2. Use Nested Objects for Logical Grouping

```typescript
// ✅ CORRECT: Clear organization
data.autosize.maximum_size = "200GB";
data.qos.policy_name = "high-performance";
data.nfs.export_policy = "restrictive";

// ❌ INCORRECT: Flat structure loses context
data.maximum_size = "200GB";  // Maximum what?
data.policy_name = "high-performance";  // Which policy?
```

### 3. Use Consistent Data Types

```typescript
// ✅ CORRECT: Match MCP parameter types
mode: 'off' | 'grow' | 'grow_shrink';  // Enum string
grow_threshold_percent: number;         // Numeric
maximum_size: string;                   // Formatted string

// ❌ INCORRECT: Different type than MCP parameter
mode: 0 | 1 | 2;  // MCP expects string
grow_threshold_percent: "85%";  // MCP expects number
```

### 4. Handle Optional vs Required

```typescript
// ✅ CORRECT: Optional when disabled/unset
autosize: {
  mode: 'off',
  maximum_size: undefined,  // Optional when mode=off
  minimum_size: undefined
}

// ❌ INCORRECT: Returning null breaks type checking
maximum_size: null
```

## Success Metrics

### Quantitative

- ✅ 10 get tools migrated to hybrid format (100%)
- ✅ Zero parameter mapping tables in UndoManager
- ✅ All 30+ tests passing (including new undo tests)
- ✅ Zero remediation-specific code in infrastructure

### Qualitative

- ✅ UndoManager code is generic and reusable
- ✅ Adding new Fix-It actions requires zero UndoManager changes
- ✅ State capture is self-documenting via TypeScript interfaces
- ✅ LLMs still receive human-readable summaries
- ✅ Demo UI has programmatic access to all state data

## Risk Mitigation

### Risk 1: Breaking Existing Consumers

**Mitigation**: Hybrid format maintains backward compatibility
- LLMs use `.summary` (same text as before)
- Programmatic consumers use `.data` (new capability)
- Both can coexist

### Risk 2: Parameter Name Drift

**Mitigation**: 
- Document parameter naming convention
- Add TypeScript type checking
- Create validation tests for name consistency
- Code review checklist

### Risk 3: ONTAP API Response Changes

**Mitigation**:
- Add error handling for missing fields
- Use optional chaining (`?.`)
- Provide sensible defaults
- Log warnings for unexpected formats

### Risk 4: Test Coverage Gaps

**Mitigation**:
- Require tests for every migrated tool
- Automated undo workflow tests
- Cross-tool parameter name validation
- HTTP vs STDIO mode parity tests

## Documentation Updates Required

1. **UNDO_ARCHITECTURE.md**
   - Mark "Proper Solution" section as "IN PROGRESS" → "COMPLETED"
   - Document final implementation
   - Remove "temporary fix" warnings

2. **README.md**
   - Add section on hybrid format pattern
   - Document state capture tools
   - Explain undo/reversibility capabilities

3. **.github/copilot-instructions.md**
   - Add hybrid format pattern as standard practice
   - Document parameter naming conventions
   - Reference implementation examples

4. **New: HYBRID_FORMAT_GUIDE.md**
   - Complete guide for future tool development
   - Parameter naming standards
   - Type definition patterns
   - Testing requirements

## Future Enhancements

Once all get tools are migrated:

1. **JSON Schema Validation**
   - Define schemas for all data structures
   - Runtime validation of responses
   - Better error messages

2. **OpenAPI/AsyncAPI Specs**
   - Auto-generate API documentation
   - Client code generation
   - Type-safe SDKs

3. **GraphQL Layer** (Optional)
   - Query exactly the fields needed
   - Reduce over-fetching
   - Better for complex UIs

4. **State Diffing**
   - Compare before/after states
   - Show exactly what changed
   - Better undo UI feedback

## Conclusion

This migration is **essential** for maintainable, scalable undo/reversibility support. By using hybrid format for state capture tools, we:

- ✅ Eliminate fragile text parsing
- ✅ Remove remediation-specific code
- ✅ Enable generic infrastructure
- ✅ Maintain LLM-friendly responses
- ✅ Future-proof the architecture

**Estimated Effort**: 3 weeks (15 working days)
**Risk Level**: Low (backward compatible, well-tested pattern)
**Impact**: High (enables entire undo capability)

---

**Next Steps**: 
1. ✅ Review and approve this plan
2. ✅ Begin Phase 1 with `get_volume_configuration`
3. ✅ Create tracking issue with checklist
4. ✅ Set up automated testing for hybrid format validation
