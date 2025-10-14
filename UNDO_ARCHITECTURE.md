# Undo Functionality Architecture: Problems and Solutions

## Executive Summary

This document describes the architectural challenges encountered when implementing undo functionality for Fix-It remediation actions in the NetApp ONTAP MCP Demo interface. It outlines the **temporary fix** currently in place, the **root cause** of the fragility, and the **proper long-term solution** that aligns with our architectural philosophy of capability-level infrastructure.

**TL;DR**: We currently have remediation-specific code that hardcodes knowledge about parameter mappings. This violates our goal of keeping alert-specific information out of the codebase. The proper solution is to refactor state capture tools to return structured JSON instead of formatted text.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Current Implementation (Temporary Fix)](#current-implementation-temporary-fix)
4. [Why This Is Fragile](#why-this-is-fragile)
5. [The Proper Solution](#the-proper-solution)
6. [Architectural Philosophy](#architectural-philosophy)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Examples](#examples)

---

## The Problem

### Symptom

When users execute a Fix-It action to enable volume autosize, the **undo button does not appear** in the UI. This prevents users from reverting the change if needed.

### User Story

```
1. Alert fires: "Volume vol1 is 95% full"
2. User clicks Fix-It: "Enable autosize (grow to 200GB)"
3. Action executes successfully
4. Expected: Undo button appears to revert autosize settings
5. Actual: No undo button (reversibility detection fails)
```

### Investigation Findings

Through debugging, we discovered:

1. ✅ **Action executes correctly**: `cluster_enable_volume_autosize` successfully changes volume settings
2. ✅ **State capture works**: `get_volume_configuration` retrieves current volume configuration
3. ❌ **Reversibility detection fails**: `UndoManager.determineReversibility()` reports "cannot restore" for autosize parameters

The console logs revealed the issue:

```javascript
// What we're checking:
paramsToCheck: ['mode', 'maximum_size', 'minimum_size']

// What we have in captured state:
originalState keys: [..., 'autosize_mode', 'autosize_maximum', 'autosize_minimum', ...]
```

**The parameter names don't match!**

---

## Root Cause Analysis

### Layer 1: Parameter Name Mismatch

The MCP tool `cluster_enable_volume_autosize` uses parameter names:
- `mode`
- `maximum_size`
- `minimum_size`
- `grow_threshold_percent`
- `shrink_threshold_percent`

The captured state from `get_volume_configuration` uses different names:
- `autosize_mode`
- `autosize_maximum`
- `autosize_minimum`
- `autosize_grow_threshold`
- `autosize_shrink_threshold`

### Layer 2: Text-Based State Representation

`get_volume_configuration` returns **formatted Markdown text**, not structured data:

```
Volume Configuration for vol1:
Basic Information:
   • UUID: ccbbfc6f-a84a-11f0-b21b-005056bd74cc
   • Size: 100.00 MB
   • State: online

Autosize Configuration:
   • Mode: off
   • Maximum Size: 190.00 MB
   • Minimum Size: 50.00 MB
   • Grow Threshold: 85%
   • Shrink Threshold: 50%
```

The `UndoManager` then **parses this text with regex** to extract values:

```javascript
// Parsing autosize mode
const autosizeMatch = text.match(/Mode:\s*(\w+)/);
if (autosizeMatch) {
    state.autosize_mode = autosizeMatch[1];  // Note: "autosize_mode" name
}

// Parsing maximum size
const maxSizeMatch = text.match(/Maximum Size:\s*([0-9.]+\s*[KMGT]?B)/);
if (maxSizeMatch) {
    state.autosize_maximum = maxSizeMatch[1];  // Note: "autosize_maximum" name
}
```

### Layer 3: Tight Coupling to Display Format

The reversibility detection depends on:
1. The exact text format of `get_volume_configuration` output
2. The specific regex patterns used to parse it
3. The chosen property names when storing parsed values
4. Manual knowledge of which MCP parameter maps to which parsed property

**Any change to the display format breaks the entire chain.**

### Layer 4: Remediation-Specific Code

To fix the immediate problem, we added **hardcoded parameter mapping** in `UndoManager.js`:

```javascript
const paramMapping = {
    'mode': 'autosize_mode',              // Hardcoded autosize knowledge
    'maximum_size': 'autosize_maximum',   // Hardcoded autosize knowledge
    'minimum_size': 'autosize_minimum',   // Hardcoded autosize knowledge
    'grow_threshold': 'autosize_grow_threshold',
    'shrink_threshold': 'autosize_shrink_threshold'
};
```

**This violates our architectural principle**: "Keep alert_rule specific information out of our code base."

---

## Current Implementation (Temporary Fix)

### Files Modified

1. **`src/tools/volume-tools.ts`** (commit: 84f7f43)
   - Added `autosize` to ONTAP API fields query
   - Enhanced `formatVolumeConfig()` to display autosize settings

2. **`demo/js/core/UndoManager.js`** (commit: 84f7f43)
   - Added parameter mapping dictionary
   - Modified `determineReversibility()` to use mapping
   - Modified `generateUndoAction()` to use mapping
   - Added debug logging to troubleshoot issues

### How It Works

```javascript
// In determineReversibility()
for (const param of paramsToCheck) {
    // Map action parameter name to state parameter name
    const stateParamName = paramMapping[param] || param;
    
    // Check if we have the original value (using mapped name)
    if (originalState[stateParamName] !== undefined) {
        canRestore.push(param);  // We can undo this parameter
    } else {
        cannotRestore.push(param);  // Cannot undo
    }
}

// In generateUndoAction()
for (const key in action.mcp_params) {
    // Map action parameter name to state parameter name
    const stateParamName = paramMapping[key] || key;
    
    // Restore original value using mapped name
    if (originalState[stateParamName] !== undefined) {
        undoParams[key] = originalState[stateParamName];
    }
}
```

### Result

✅ **Undo button now appears** for volume autosize Fix-It actions  
✅ **Undo executes successfully** - restores original autosize settings  
⚠️ **Technical debt incurred** - hardcoded remediation-specific knowledge

---

## Why This Is Fragile

### 1. Remediation-Specific Code

Every new Fix-It action that needs undo support requires:

- ❌ Adding parameter mappings to `UndoManager.js`
- ❌ Understanding both the MCP tool's parameter names AND the state capture's property names
- ❌ Manual maintenance when either side changes naming conventions
- ❌ Testing to ensure mapping is correct

**This doesn't scale.** Imagine adding 20 more Fix-It actions for different ONTAP capabilities (QoS policies, snapshot policies, export rules, etc.). We'd have a massive mapping table.

### 2. Text Parsing Brittleness

If `formatVolumeConfig()` changes its display format:

```javascript
// Old format (works):
"Mode: off"

// New format (breaks):
"Autosize Mode: disabled"

// Regex no longer matches:
const match = text.match(/Mode:\s*(\w+)/);  // Fails to find "Mode:"
```

Similarly, any change to:
- Indentation
- Label text ("Maximum Size" → "Max Size")
- Value format ("190.00 MB" → "190MB")
- Section headers

...will break state capture and undo functionality.

### 3. No Type Safety

JavaScript string parsing provides no guarantees:

```javascript
// What if the format changes?
state.autosize_maximum = maxSizeMatch[1];  // Could be undefined

// What if the value format changes?
// "190.00 MB" vs "190MB" vs "200000000" (bytes)

// No schema validation
// No compile-time checks
// No runtime type enforcement
```

### 4. Hidden Dependencies

The undo system has **implicit dependencies** not visible in the code:

```
UndoManager.js
    ↓ depends on
formatVolumeConfig() display format
    ↓ depends on
ONTAP REST API response structure
    ↓ depends on
ONTAP version and feature availability
```

A change **anywhere** in this chain can break undo functionality with no obvious error.

### 5. Violation of DRY Principle

We define parameter names **three times**:

1. In the MCP tool definition (`cluster_enable_volume_autosize`)
2. In the state parsing logic (`formatVolumeConfig()`)
3. In the parameter mapping table (`UndoManager.js`)

**Any change requires updating all three locations.**

---

## The Proper Solution

### High-Level Approach

**Replace text-based state representation with structured JSON.**

### Refactor `get_volume_configuration`

#### Current (Fragile)

```typescript
// src/tools/volume-tools.ts
export async function handleGetVolumeConfiguration(args: any) {
    const response = await client.get(`/storage/volumes/${uuid}?fields=...`);
    
    // Returns formatted text
    return formatVolumeConfig(response.data);
}

function formatVolumeConfig(volume: any): string {
    return `
Volume Configuration for ${volume.name}:
Autosize Configuration:
   • Mode: ${volume.autosize.mode}
   • Maximum Size: ${volume.autosize.maximum}
    `;
}
```

#### Proposed (Robust)

```typescript
// src/tools/volume-tools.ts
export async function handleGetVolumeConfiguration(args: any) {
    const response = await client.get(`/storage/volumes/${uuid}?fields=...`);
    
    // Returns structured JSON matching MCP parameter names
    return {
        volume: {
            uuid: volume.uuid,
            name: volume.name,
            size: volume.size,
            state: volume.state,
            type: volume.type,
            comment: volume.comment || null
        },
        svm: {
            name: volume.svm.name,
            uuid: volume.svm.uuid
        },
        autosize: {
            // Use MCP parameter names directly
            mode: volume.autosize?.mode || 'off',
            maximum_size: volume.autosize?.maximum || null,
            minimum_size: volume.autosize?.minimum || null,
            grow_threshold_percent: volume.autosize?.grow_threshold || null,
            shrink_threshold_percent: volume.autosize?.shrink_threshold || null
        },
        snapshot_policy: {
            name: volume.snapshot_policy?.name || null
        },
        qos: {
            policy_name: volume.qos?.policy?.name || null
        },
        nfs: {
            export_policy: volume.nas?.export_policy?.name || null
        },
        space: {
            size: volume.space?.size || null,
            available: volume.space?.available || null,
            used: volume.space?.used || null
        },
        efficiency: {
            compression: volume.efficiency?.compression || null,
            dedupe: volume.efficiency?.dedupe || null
        }
    };
}
```

### Update `UndoManager` to Use Structured Data

#### Remove Parameter Mapping

```javascript
// demo/js/core/UndoManager.js

// ❌ DELETE THIS (no longer needed):
const paramMapping = {
    'mode': 'autosize_mode',
    'maximum_size': 'autosize_maximum',
    // ...
};

// ✅ NEW APPROACH (generic):
determineReversibility(action, originalState) {
    const canRestore = [];
    const cannotRestore = [];
    
    for (const param of paramsToCheck) {
        // Skip identifiers
        if (param === 'cluster_name' || param === 'volume_uuid') {
            continue;
        }
        
        // Search for parameter in state (any section)
        const found = this.findParameterInState(param, originalState);
        
        if (found && found.value !== undefined) {
            canRestore.push(param);
        } else {
            cannotRestore.push(param);
        }
    }
    
    // Return reversibility assessment
    return {
        reversible: cannotRestore.length === 0,
        partial: canRestore.length > 0 && cannotRestore.length > 0,
        canRestore,
        cannotRestore
    };
}

// Generic search across all state sections
findParameterInState(paramName, state) {
    // Search in autosize section
    if (state.autosize && state.autosize[paramName] !== undefined) {
        return { section: 'autosize', value: state.autosize[paramName] };
    }
    
    // Search in QoS section
    if (state.qos && state.qos[paramName] !== undefined) {
        return { section: 'qos', value: state.qos[paramName] };
    }
    
    // Search in top-level volume properties
    if (state.volume && state.volume[paramName] !== undefined) {
        return { section: 'volume', value: state.volume[paramName] };
    }
    
    // Search in NFS section
    if (state.nfs && state.nfs[paramName] !== undefined) {
        return { section: 'nfs', value: state.nfs[paramName] };
    }
    
    return null;  // Not found
}
```

#### Simplified Undo Action Generation

```javascript
generateUndoAction(action, originalState, resolvedParams) {
    const undoParams = {
        cluster_name: resolvedParams.cluster_name,
        volume_uuid: resolvedParams.volume_uuid
    };
    
    const changedParams = [];
    
    // For each parameter in the action
    for (const key in action.mcp_params) {
        // Skip identifiers
        if (key === 'cluster_name' || key === 'volume_uuid') {
            continue;
        }
        
        // Find the original value (using generic search)
        const found = this.findParameterInState(key, originalState);
        
        if (found && found.value !== undefined) {
            undoParams[key] = found.value;  // Restore original value
            changedParams.push(key);
        }
    }
    
    // Return undo action
    return {
        mcp_tool: action.mcp_tool,  // Same tool, different params
        params: undoParams,
        label: `Restore ${changedParams.length} parameter(s)`,
        changedParams
    };
}
```

### Benefits of This Approach

✅ **No parameter mapping needed** - state uses same names as MCP actions  
✅ **No text parsing** - direct object property access  
✅ **Type safety possible** - can add JSON schema validation  
✅ **Generic/reusable** - works for ANY MCP tool without modification  
✅ **Self-describing** - JSON structure reveals available properties  
✅ **Future-proof** - adding new properties doesn't break existing code  
✅ **Testable** - can validate JSON structure with schema  
✅ **Maintainable** - parameter names defined in ONE place (MCP tool)  

---

## Architectural Philosophy

### Core Principle: Capability-Level Infrastructure

**Goal**: Build infrastructure that provides **generic capabilities**, not remediation-specific implementations.

#### What We Want

The system should provide:

1. **"Here's the current state"** → Structured JSON with consistent naming
2. **"Here's what you changed"** → MCP action parameters
3. **"Can I reverse it?"** → Generic comparison algorithm
4. **"Execute the reversal"** → Call same MCP tool with original values

#### What We Don't Want

The system should NOT provide:

1. ❌ "I know about autosize specifically"
2. ❌ "I know how to parse autosize text format"
3. ❌ "I have a mapping table for autosize parameters"
4. ❌ "I have special logic for QoS policies"
5. ❌ "I have special logic for snapshot policies"

### Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│ Alert Rules (External Configuration)                        │
│ • Define thresholds, conditions, remediation actions        │
│ • Reference MCP tools by name                               │
│ • Specify parameter values                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ MCP Tools (Generic Capabilities)                            │
│ • Expose ONTAP operations                                   │
│ • Define parameter schemas                                  │
│ • Consistent naming conventions                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ State Capture (Structured Data)                             │
│ • Return JSON matching MCP parameter names                  │
│ • Complete, queryable object structure                      │
│ • No formatting, just data                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Undo Manager (Generic Reversibility Logic)                  │
│ • Compare action params against captured state              │
│ • Generate inverse action                                   │
│ • NO knowledge of specific remediation types                │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight**: Each layer operates on **generic contracts** (JSON schemas, parameter names), not specific remediation knowledge.

### The Data Flow

```javascript
// 1. Alert rule (external config) defines action
{
    "name": "enable_autosize",
    "mcp_tool": "cluster_enable_volume_autosize",
    "mcp_params": {
        "mode": "grow",
        "maximum_size": "200GB"
    }
}

// 2. Before executing, capture current state
const originalState = await apiClient.callMcp('get_volume_configuration', {
    cluster_name: "C1",
    volume_uuid: "abc-123"
});

// Returns:
{
    "autosize": {
        "mode": "off",              // Same name as MCP param!
        "maximum_size": "100GB"     // Same name as MCP param!
    }
}

// 3. Execute action
await apiClient.callMcp('cluster_enable_volume_autosize', {
    cluster_name: "C1",
    volume_uuid: "abc-123",
    mode: "grow",
    maximum_size: "200GB"
});

// 4. Determine reversibility (generic algorithm)
function canUndo(action, originalState) {
    // For each param in action.mcp_params:
    //   Does originalState have this param?
    //   If yes → can restore
    //   If no → cannot restore
    
    // NO hardcoded knowledge needed!
    return action.mcp_params.every(param =>
        findParamInState(param, originalState) !== undefined
    );
}

// 5. Generate undo action (generic algorithm)
function generateUndo(action, originalState) {
    const undoParams = { ...identifiers };
    
    for (const param in action.mcp_params) {
        const originalValue = findParamInState(param, originalState);
        if (originalValue !== undefined) {
            undoParams[param] = originalValue;
        }
    }
    
    return {
        mcp_tool: action.mcp_tool,  // Same tool!
        mcp_params: undoParams       // Original values
    };
}
```

**Notice**: No knowledge of "autosize" specifically. Works for ANY MCP tool.

### Why This Matters

1. **Scalability**: Adding 100 new Fix-It actions requires **zero changes** to undo logic
2. **Maintainability**: Parameter names defined once (in MCP tool schema)
3. **Testability**: Can validate with JSON schemas
4. **Flexibility**: Alert rules can reference any MCP tool without code changes
5. **Separation**: Alert-specific logic stays in configuration, not code

---

## Implementation Roadmap

### Phase 1: Refactor State Capture (High Priority)

**Goal**: Make `get_volume_configuration` return structured JSON.

**Tasks**:
1. ✅ Identify all state capture tools:
   - `get_volume_configuration`
   - `cluster_get_volume_autosize_status`
   - `cluster_get_qos_policy`
   - Others that return formatted text

2. ✅ Define JSON response schemas for each:
   ```typescript
   interface VolumeConfiguration {
       volume: {
           uuid: string;
           name: string;
           size: string;
           state: 'online' | 'offline' | 'restricted';
           type: string;
           comment?: string;
       };
       autosize: {
           mode: 'off' | 'grow' | 'grow_shrink';
           maximum_size?: string;
           minimum_size?: string;
           grow_threshold_percent?: number;
           shrink_threshold_percent?: number;
       };
       // ... other sections
   }
   ```

3. ✅ Update tool implementations to return JSON
4. ✅ Ensure parameter names match MCP tool parameter names
5. ✅ Add TypeScript types for compile-time safety
6. ✅ Add JSON schema validation for runtime safety

**Files to modify**:
- `src/tools/volume-tools.ts`
- `src/tools/volume-autosize-tools.ts`
- `src/tools/qos-policy-tools.ts`
- `src/types/*.ts` (add response type definitions)

### Phase 2: Update UndoManager (High Priority)

**Goal**: Remove parameter mapping and use structured state.

**Tasks**:
1. ✅ Remove `paramMapping` dictionary
2. ✅ Implement `findParameterInState()` generic search
3. ✅ Update `determineReversibility()` to use generic search
4. ✅ Update `generateUndoAction()` to use generic search
5. ✅ Remove debug logging (no longer needed)
6. ✅ Add unit tests for generic undo logic

**Files to modify**:
- `demo/js/core/UndoManager.js`

### Phase 3: Standardize MCP Parameter Naming (Medium Priority)

**Goal**: Ensure consistent naming conventions across all MCP tools.

**Tasks**:
1. ✅ Audit all MCP tools for parameter naming
2. ✅ Define naming convention standard:
   - Use snake_case for all parameters
   - Use consistent suffixes (`_percent`, `_size`, etc.)
   - Avoid prefixes when possible (use sections instead)
3. ✅ Refactor tool schemas to match convention
4. ✅ Update documentation

**Files to modify**:
- All `src/tools/*.ts` files
- `src/types/*.ts` files

### Phase 4: Add Schema Validation (Medium Priority)

**Goal**: Runtime validation of state capture responses.

**Tasks**:
1. ✅ Define JSON schemas for all state capture responses
2. ✅ Add validation library (e.g., Ajv, Zod)
3. ✅ Validate responses before returning to clients
4. ✅ Add helpful error messages for schema violations

**Files to create**:
- `src/schemas/volume-configuration.schema.json`
- `src/schemas/qos-policy.schema.json`
- Others as needed

### Phase 5: Add Display Formatting Layer (Low Priority)

**Goal**: Separate data from presentation.

**Tasks**:
1. ✅ Create UI formatting utilities in demo
2. ✅ Move formatting logic from MCP tools to UI layer
3. ✅ MCP tools return only data, UI handles display

**Files to create**:
- `demo/js/utils/formatters.js`

---

## Examples

### Example 1: Volume Autosize (Current Problem)

#### Before (Fragile - Current Implementation)

```javascript
// MCP tool returns formatted text
const config = await callMcp('get_volume_configuration', { ... });
// Returns: "Autosize Configuration:\n   • Mode: off\n   • Maximum Size: 190.00 MB"

// Parse with regex
const modeMatch = config.match(/Mode:\s*(\w+)/);
const state = {
    autosize_mode: modeMatch[1]  // Different name!
};

// Hardcoded mapping to bridge names
const paramMapping = {
    'mode': 'autosize_mode'  // Must maintain this manually
};

// Check reversibility using mapping
const stateParamName = paramMapping['mode'];
const canRestore = state[stateParamName] !== undefined;
```

#### After (Robust - Proposed Implementation)

```javascript
// MCP tool returns structured JSON
const config = await callMcp('get_volume_configuration', { ... });
// Returns: { autosize: { mode: "off", maximum_size: "190.00 MB" } }

// Direct property access (no mapping needed)
const canRestore = config.autosize.mode !== undefined;

// Generic search works for ANY parameter
function canUndo(param, state) {
    return findParameterInState(param, state) !== undefined;
}
```

### Example 2: QoS Policy Changes

#### Scenario

Alert rule wants to change QoS policy from "bronze" to "gold":

```javascript
{
    "mcp_tool": "cluster_update_volume",
    "mcp_params": {
        "qos_policy": "gold"
    }
}
```

#### Before (Would Require New Mapping)

```javascript
// Would need to add to paramMapping:
const paramMapping = {
    'mode': 'autosize_mode',
    'maximum_size': 'autosize_maximum',
    'qos_policy': 'qos_policy_name'  // New hardcoded mapping!
};

// Parse text to extract QoS policy
const qosMatch = config.match(/QoS Policy:\s*(\w+)/);
state.qos_policy_name = qosMatch[1];

// Use mapping
const stateParamName = paramMapping['qos_policy'];
const originalValue = state[stateParamName];
```

#### After (Works Automatically)

```javascript
// No changes to UndoManager needed!
const config = await callMcp('get_volume_configuration', { ... });
// Returns: { qos: { policy_name: "bronze" } }

// Generic search finds it automatically
const found = findParameterInState('qos_policy', config);
// Returns: { section: 'qos', value: 'bronze' }

// Generate undo automatically
const undoParams = {
    qos_policy: found.value  // "bronze"
};
```

### Example 3: Snapshot Policy Changes

#### Scenario

Alert rule wants to change snapshot policy:

```javascript
{
    "mcp_tool": "cluster_update_volume",
    "mcp_params": {
        "snapshot_policy": "daily"
    }
}
```

#### Before (Would Require New Mapping)

```javascript
// Would need ANOTHER hardcoded mapping:
const paramMapping = {
    'mode': 'autosize_mode',
    'maximum_size': 'autosize_maximum',
    'qos_policy': 'qos_policy_name',
    'snapshot_policy': 'snapshot_policy_name'  // Growing mapping table!
};
```

#### After (Works Automatically)

```javascript
// Still no changes to UndoManager needed!
const config = await callMcp('get_volume_configuration', { ... });
// Returns: { snapshot_policy: { name: "default" } }

// Generic search finds it
const found = findParameterInState('snapshot_policy', config);
// Returns: { section: 'snapshot_policy', value: 'default' }

// Undo generated automatically
```

**Key Insight**: With structured JSON, we can add 100 new Fix-It actions without changing UndoManager code!

---

## Conclusion

### Current State

We have a **working but fragile** undo system that:
- ✅ Solves the immediate problem (autosize undo works)
- ⚠️ Introduces technical debt (hardcoded mappings)
- ⚠️ Doesn't scale (requires code changes for each new action)
- ⚠️ Violates architectural principles (remediation-specific code)

### Future State

We need a **robust and scalable** undo system that:
- ✅ Uses structured JSON for state capture
- ✅ Consistent parameter naming across MCP tools
- ✅ Generic reversibility detection (no hardcoded knowledge)
- ✅ Self-documenting with JSON schemas
- ✅ Scales to hundreds of Fix-It actions without code changes

### The Path Forward

1. **Short term**: Current implementation provides undo functionality (commit: 84f7f43)
2. **Medium term**: Refactor state capture to return JSON (Phase 1)
3. **Long term**: Remove all remediation-specific code from UndoManager (Phase 2-5)

### Philosophy

> **"Build capabilities, not solutions. Provide infrastructure, not implementations."**

The best architecture is one where adding new features requires **configuration changes**, not **code changes**. By separating data from presentation, and keeping business logic out of infrastructure code, we create a system that scales effortlessly.

---

## References

- **Commit**: 84f7f43 - "Fix undo button for volume autosize Fix-It actions"
- **Files Modified**:
  - `src/tools/volume-tools.ts`
  - `demo/js/core/UndoManager.js`
- **Related Discussions**: Copilot conversation 2025-10-14

---

**Document Status**: Living document, will be updated as implementation progresses  
**Last Updated**: October 14, 2025  
**Authors**: NetApp ONTAP MCP Development Team
