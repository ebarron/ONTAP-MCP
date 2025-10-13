# NetApp ONTAP MCP - Remediation Architecture

**Document Purpose:** Complete architecture and data flow for the Alert Fix-It and Undo system  
**Date:** October 12, 2025  
**Status:** Design Review - Phase 5 Implementation

---

## Overview

The remediation system provides automated, LLM-powered corrective actions for ONTAP storage alerts with intelligent undo capabilities. The system is **data-driven**: new remediation options are added via YAML configuration files without writing code (assuming MCP tools exist).

### Key Design Principles

1. **Data-Driven:** Alert remediation rules defined in YAML, not code
2. **Zero Hardcoding:** Dynamic tool discovery and undo generation
3. **LLM-Powered:** Maps natural language + CLI commands → MCP tool calls
4. **State-Aware:** Captures original state for intelligent undo
5. **User Safety:** Confirms actions, shows CLI equivalents, offers undo

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     REMEDIATION DATA FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

1. ALERT SOURCE (Prometheus/Harvest)
   ├─ Active alerts from metrics
   └─ Matched against alert_rules.yml
        ↓
        
2. ALERT RULES (YAML Configuration)
   ┌────────────────────────────────────────┐
   │ alert_rules.yml                        │
   │ ─────────────────────                  │
   │ - alert: Volume state offline          │
   │   annotations:                         │
   │     corrective_action: |               │
   │       Natural language description     │
   │       CLI: volume online -vserver...   │
   └────────────────────────────────────────┘
        ↓
        
3. CORRECTIVE ACTION PARSER (LLM + Dynamic Tools)
   ┌──────────────────────────────────────────────────┐
   │ CorrectiveActionParser.js                        │
   │ ────────────────────────────                     │
   │ • Discovers 67 MCP tools dynamically             │
   │ • Extracts tool schemas and parameters           │
   │ • Sends to LLM with alert context                │
   │ • LLM maps CLI → MCP tool + params               │
   │                                                   │
   │ Input:  "volume online -vserver X -volume Y"     │
   │ Output: {                                        │
   │   mcp_tool: "cluster_update_volume",             │
   │   requires_params: ["volume_uuid", "state"],     │
   │   param_hints: { state: "online" }               │
   │ }                                                 │
   └──────────────────────────────────────────────────┘
        ↓
        
4. PARAMETER RESOLVER (UUID + Metrics Resolution)
   ┌──────────────────────────────────────────────────┐
   │ ParameterResolver.js                             │
   │ ────────────────────                             │
   │ • Resolves cluster_name → from alert             │
   │ • Resolves volume name → volume_uuid via MCP     │
   │ • Queries Prometheus for current metrics         │
   │ • Fills in param_hints (size calculations, etc)  │
   │                                                   │
   │ Input:  { volume: "vol_test" }                   │
   │ Output: { volume_uuid: "21d31324-..." }          │
   └──────────────────────────────────────────────────┘
        ↓
        
5. FIX-IT MODAL (Confirmation UI)
   ┌──────────────────────────────────────────────────┐
   │ FixItModal.js                                    │
   │ ─────────────                                    │
   │ Shows:                                           │
   │ • Action description                             │
   │ • CLI command equivalent (for manual execution)  │
   │ • Resolved parameters                            │
   │ • Warning messages (if any)                      │
   │                                                   │
   │ User clicks: [Execute Fix-It Action]             │
   └──────────────────────────────────────────────────┘
        ↓
        
6. STATE CAPTURE (Before Execution) ← NEW IN PHASE 5
   ┌──────────────────────────────────────────────────┐
   │ UndoManager.captureCurrentState()                │
   │ ─────────────────────────────────                │
   │ 1. Call get_volume_configuration(volume_uuid)    │
   │ 2. Extract current values:                       │
   │    • state: 'offline'                            │
   │    • size: '40GB'                                │
   │    • comment: 'Test volume'                      │
   │    • qos_policy: 'default'                       │
   │                                                   │
   │ 3. Fallback to ParameterResolver metrics if      │
   │    get_volume_configuration unavailable          │
   │                                                   │
   │ Returns: originalState snapshot                  │
   └──────────────────────────────────────────────────┘
        ↓
        
7. MCP TOOL EXECUTION
   ┌──────────────────────────────────────────────────┐
   │ McpApiClient.callMcp()                           │
   │ ──────────────────────                           │
   │ POST /messages?sessionId=xxx                     │
   │ {                                                 │
   │   method: "tools/call",                          │
   │   params: {                                      │
   │     name: "cluster_update_volume",               │
   │     arguments: {                                 │
   │       volume_uuid: "21d31324-...",               │
   │       state: "online"                            │
   │     }                                            │
   │   }                                              │
   │ }                                                 │
   │                                                   │
   │ ✅ Volume brought online                         │
   └──────────────────────────────────────────────────┘
        ↓
        
8. UNDO GENERATION (After Success) ← NEW IN PHASE 5
   ┌──────────────────────────────────────────────────┐
   │ UndoManager.generateUndoAction()                 │
   │ ────────────────────────────────                 │
   │ Analyzes executed action + original state:       │
   │                                                   │
   │ Executed: { state: 'online' }                    │
   │ Original: { state: 'offline' }                   │
   │                                                   │
   │ Generates inverse:                               │
   │ {                                                 │
   │   mcp_tool: "cluster_update_volume",             │
   │   params: { state: 'offline' },                  │
   │   label: "Set state to offline",                 │
   │   cliCommand: "volume offline -vserver ... "     │
   │   reversibility: {                               │
   │     reversible: true,                            │
   │     canRestore: ['state'],                       │
   │     cannotRestore: []                            │
   │   }                                              │
   │ }                                                 │
   └──────────────────────────────────────────────────┘
        ↓
        
9. UNDO STORAGE (Session Scope)
   ┌──────────────────────────────────────────────────┐
   │ UndoManager.storeUndoInfo()                      │
   │ ───────────────────────────                      │
   │ sessionStorage.setItem('lastFixItAction', {      │
   │   actionId: "uuid-...",                          │
   │   timestamp: 1760278441000,                      │
   │   alertFingerprint: "abc123",                    │
   │   executedAction: { ... },                       │
   │   originalState: { state: 'offline', ... },      │
   │   undoAction: { ... }                            │
   │ })                                               │
   │                                                   │
   │ Lifecycle: Until user leaves Alert Details view  │
   └──────────────────────────────────────────────────┘
        ↓
        
10. UNDO UI (Toast + Persistent Button)
    ┌─────────────────────────────────────────────────┐
    │ Toast Notification (5-10 seconds)               │
    │ ─────────────────────────────────               │
    │ ✅ Volume brought online                        │
    │    [Undo ↶]                                     │
    └─────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────┐
    │ Alert Details Panel (Persistent)                │
    │ ────────────────────────────────                │
    │ Corrective Actions:                             │
    │   Option 1: Bring Volume Online                 │
    │     [Fix-It ✓ Executed]  [Undo ↶]              │
    └─────────────────────────────────────────────────┘
        ↓
        
11. UNDO EXECUTION (User Confirms)
    ┌─────────────────────────────────────────────────┐
    │ FixItModal (isUndo: true)                       │
    │ ─────────────────────────                       │
    │ Shows:                                          │
    │ • "Undo: Set state to offline"                  │
    │ • CLI: volume offline -vserver ... -volume ...  │
    │ • Will restore: state                           │
    │                                                  │
    │ User clicks: [Execute Undo]                     │
    │   ↓                                             │
    │ Calls: cluster_update_volume(state='offline')   │
    │   ↓                                             │
    │ New undo created (becomes REDO)                 │
    └─────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Alert Rules (Data Source)

**File:** `demo/alert_rules.yml`

**Structure:**
```yaml
- alert: Volume state offline
  expr: volume_labels{state="offline"} == 1
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Volume {{ $labels.volume }} is offline"
    description: "Volume {{ $labels.volume }} on cluster {{ $labels.cluster }} is offline"
    corrective_action: |
      To bring a volume back online, you can use the following command:
      1. volume online -vserver <vserver_name> -volume <volume_name>
      
      This will make the volume accessible to clients again.
```

**Key Points:**
- Natural language description
- ONTAP CLI commands (for reference and LLM mapping)
- No MCP tool names (decoupled from implementation)

---

### 2. CorrectiveActionParser

**File:** `demo/js/components/CorrectiveActionParser.js`

**Responsibilities:**
1. **Dynamic Tool Discovery:** Query MCP for all available tools (67 tools)
2. **Schema Extraction:** Parse `inputSchema` for parameter types
3. **LLM System Prompt:** Build tool documentation from schemas
4. **CLI → MCP Mapping:** Send alert context + CLI to ChatGPT
5. **JSON Output:** Parse LLM response into structured actions

**Key Methods:**
```javascript
async discoverAvailableTools()
// Fetches tools from McpClientManager, caches schemas

buildSystemPrompt()
// Generates LLM prompt with tool documentation and mapping rules

async parseCorrectiveActions(correctiveActionText, alertContext)
// Sends to ChatGPT, returns structured remediation options
```

**Output Format:**
```javascript
{
  description: "Brief summary of issue and options",
  remediation_options: [
    {
      option_number: 1,
      option_title: "Bring Volume Online",
      option_description: "Change volume state from offline to online",
      solutions: [
        {
          solution_title: "Set Volume State to Online",
          solution_description: "Updates the volume state to 'online'...",
          mcp_tool: "cluster_update_volume",
          requires_params: ["cluster_name", "volume_uuid", "state"],
          param_hints: {
            state: "Set to 'online' to bring volume back online"
          }
        }
      ]
    }
  ]
}
```

---

### 3. ParameterResolver

**File:** `demo/js/core/ParameterResolver.js`

**Responsibilities:**
1. **Volume UUID Resolution:** cluster_name + volume_name → volume_uuid
2. **Metrics Queries:** Fetch current size, utilization from Prometheus
3. **Parameter Calculation:** Suggest new sizes based on current usage
4. **Fallback Handling:** Use alert labels if MCP queries fail

**Key Methods:**
```javascript
async resolveVolumeUuid(clusterName, svmName, volumeName)
// Calls cluster_list_volumes, searches for volume name, returns UUID

async getCurrentVolumeSize(clusterName, volumeName)
// Queries Prometheus: volume_size_total{cluster=X, volume=Y}

async getVolumeUsedPercent(clusterName, volumeName)
// Queries Prometheus: volume_size_used_percent{cluster=X, volume=Y}

async resolveParameters(action, alert)
// Main entry point: fills all required params
```

---

### 4. FixItModal

**File:** `demo/js/components/FixItModal.js`

**Responsibilities:**
1. **Action Confirmation:** Show details before execution
2. **CLI Display:** Show ONTAP CLI equivalent command
3. **Parameter Display:** Show resolved values (hidden by default)
4. **Warning Messages:** Display risks (e.g., volume offline warning)
5. **MCP Execution:** Call tool and handle response
6. **Success/Error Handling:** Show results, trigger undo storage

**Key Methods:**
```javascript
show(action, alert, resolvedParams)
// Opens modal with action details

async execute()
// Executes MCP tool, handles success/error

showSuccess(result)
// Displays success, stores undo, re-renders alert details
```

**Current Limitation (Phase 4):**
Hardcoded reversible actions dictionary - replaced in Phase 5 with UndoManager.

---

### 5. UndoManager (NEW - Phase 5)

**File:** `demo/js/core/UndoManager.js` (to be created)

**Responsibilities:**
1. **State Capture:** Query current volume config before execution
2. **Reversibility Detection:** Determine if action can be undone
3. **Undo Generation:** Create inverse action parameters
4. **CLI Generation:** Generate ONTAP CLI for undo action
5. **Storage Management:** Store/retrieve undo info in sessionStorage
6. **Partial Reversibility:** Handle multi-param changes where not all are reversible

**Key Methods:**

#### captureCurrentState()
```javascript
async captureCurrentState(alert, action, resolvedParams)
// 1. Try get_volume_configuration(volume_uuid)
// 2. Fallback to ParameterResolver.getCurrentMetrics()
// 3. Returns: { state, size, comment, qos_policy, ... }
```

#### determineReversibility()
```javascript
determineReversibility(action, originalState)
// Analyzes action + state
// Returns: { 
//   reversible: boolean,
//   reason: string,
//   canRestore: ['state', 'size'],
//   cannotRestore: ['comment']
// }
```

**Reversibility Rules:**
- ✅ **Reversible:**
  - State changes (online ↔ offline)
  - Boolean toggles (mode: grow ↔ off)
  - Value changes (size, comment) if original captured
  
- ❌ **Irreversible:**
  - Deletions (cluster_delete_volume, cluster_delete_volume_snapshot)
  - Missing original state data
  - Creation operations (undo = delete, separate logic)

#### generateUndoAction()
```javascript
generateUndoAction(action, originalState)
// Builds inverse parameter set
// Returns: {
//   mcp_tool: string,
//   params: object,
//   label: string,
//   cliCommand: string,
//   reversibility: { ... }
// }
```

**Inversion Logic:**
```javascript
// For each changed parameter
if (action.params.state && originalState.state) {
  undoParams.state = originalState.state;  // Simple reversal
}

if (action.params.size && originalState.size) {
  undoParams.size = originalState.size;  // Restore original
}

// Special case: autosize mode
if (action.mcp_tool === 'cluster_enable_volume_autosize') {
  if (action.params.mode === 'grow') {
    undoParams.mode = 'off';  // Turn off
  }
}
```

#### generateUndoCLI()
```javascript
async generateUndoCLI(undoAction, alertContext)
// Option 1: Ask LLM to reverse the original CLI command
// Option 2: Template-based generation from tool name + params
// Returns: "volume offline -vserver astra_vs2 -volume vol_test"
```

#### storeUndoInfo()
```javascript
storeUndoInfo(actionId, undoAction, originalState, executedAction)
// sessionStorage.setItem('lastFixItAction', JSON.stringify({
//   actionId: crypto.randomUUID(),
//   timestamp: Date.now(),
//   alertFingerprint: alert.fingerprint,
//   executedAction: { tool, params, result },
//   originalState: { state, size, ... },
//   undoAction: { tool, params, label, cliCommand },
//   reversibility: { reversible, canRestore, cannotRestore }
// }))
```

#### getUndoInfo()
```javascript
getUndoInfo(alertFingerprint)
// Retrieves from sessionStorage
// Returns null if expired or not found
```

#### clearUndoInfo()
```javascript
clearUndoInfo()
// Called when user navigates away from Alert Details
```

---

## Data Flow Examples

### Example 1: Volume Offline → Online (Full Reversibility)

**Step 1:** Alert fires
```yaml
alert: Volume state offline
cluster: umeng-aff300-05-06
volume: vol_test3
state: offline
```

**Step 2:** CorrectiveActionParser maps to MCP
```javascript
{
  mcp_tool: 'cluster_update_volume',
  requires_params: ['cluster_name', 'volume_uuid', 'state'],
  param_hints: { state: 'online' }
}
```

**Step 3:** ParameterResolver fills params
```javascript
{
  cluster_name: 'umeng-aff300-05-06',
  volume_uuid: '21d31324-0393-11ed-b077-00a098e24321',
  state: 'online'
}
```

**Step 4:** UndoManager captures current state
```javascript
originalState = {
  volume_uuid: '21d31324-...',
  state: 'offline',      // ← Current state
  size: '40GB',
  comment: 'Test volume'
}
```

**Step 5:** Execute Fix-It
```javascript
cluster_update_volume({
  volume_uuid: '21d31324-...',
  state: 'online'
})
// ✅ Success
```

**Step 6:** Generate undo
```javascript
undoAction = {
  mcp_tool: 'cluster_update_volume',
  params: { 
    volume_uuid: '21d31324-...',
    state: 'offline'  // ← Inverse
  },
  label: 'Set state to offline',
  cliCommand: 'volume offline -vserver astra_vs2 -volume vol_test3',
  reversibility: {
    reversible: true,
    canRestore: ['state'],
    cannotRestore: []
  }
}
```

**Step 7:** Store and display undo
- Toast shows [Undo ↶] button (5-10 sec)
- Alert Details shows persistent [Undo ↶] button

---

### Example 2: Volume Autosize Enable (Full Reversibility)

**Action:** Enable autosize with mode='grow', max='200GB'

**Original State:**
```javascript
{
  autosize_mode: 'off',  // ← Captured from get_volume_configuration
  autosize_maximum: null
}
```

**Undo Action:**
```javascript
{
  mcp_tool: 'cluster_enable_volume_autosize',
  params: {
    volume_uuid: '...',
    mode: 'off'  // ← Disable
  },
  label: 'Disable autosize',
  cliCommand: 'volume autosize -vserver X -volume Y -mode off'
}
```

---

### Example 3: Volume Size Change (Partial Reversibility)

**Action:** User changes both size and comment
```javascript
{
  mcp_tool: 'cluster_update_volume',
  params: {
    volume_uuid: '...',
    size: '100GB',
    comment: 'Increased for project X'
  }
}
```

**Original State Captured:**
```javascript
{
  size: '80GB',    // ← Captured successfully
  comment: ???     // ← NOT in get_volume_configuration response
}
```

**Undo Action (Partial):**
```javascript
{
  mcp_tool: 'cluster_update_volume',
  params: {
    volume_uuid: '...',
    size: '80GB'  // Can restore
    // comment: missing - cannot restore
  },
  label: 'Restore size to 80GB (Partial)',
  reversibility: {
    reversible: true,
    partial: true,
    canRestore: ['size'],
    cannotRestore: ['comment']
  }
}
```

**UI Display:**
```
[Undo ↶ (Partial)]

Tooltip: "Will restore size to 80GB. 
          Comment cannot be restored (original value not captured)."
```

---

### Example 4: Snapshot Deletion (Irreversible)

**Action:** Delete oldest snapshot

**Reversibility Check:**
```javascript
determineReversibility({
  mcp_tool: 'cluster_delete_volume_snapshot'
})
// Returns: {
//   reversible: false,
//   reason: 'Deletion is permanent - snapshot data cannot be recovered'
// }
```

**UI Display:**
```
[Fix-It ✓ Executed]  [Undo (grayed out)]

Tooltip: "Action is permanent - snapshot data cannot be recovered"
```

---

## UI/UX Specifications

### Undo Button States

#### 1. Fully Reversible
```html
<button class="undo-button" onclick="executeUndo()">
  <svg>↶</svg> Undo
</button>
```
- Green color scheme
- Tooltip: "Undo: Set state to offline"

#### 2. Partially Reversible
```html
<button class="undo-button partial" onclick="executeUndo()">
  <svg>↶</svg> Undo (Partial)
</button>
```
- Yellow/orange color scheme
- Tooltip: "Will restore: size. Cannot restore: comment"

#### 3. Irreversible
```html
<button class="undo-button disabled" disabled>
  <svg>↶</svg> Undo
</button>
```
- Gray (disabled)
- Tooltip: "Action is permanent"

### Undo Confirmation Modal

**Reuses FixItModal with `isUndo: true` flag**

```
┌────────────────────────────────────────┐
│ Confirm Undo Action              [×]   │
├────────────────────────────────────────┤
│                                        │
│ This will reverse the previous action: │
│                                        │
│ Undo: Set volume state to offline      │
│                                        │
│ CLI Command:                           │
│ ┌────────────────────────────────────┐ │
│ │ volume offline -vserver astra_vs2  │ │
│ │                -volume vol_test3   │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Will restore:                          │
│   • state: offline                     │
│                                        │
│ ⚠️ Warning: This will make the volume │
│    inaccessible to clients.            │
│                                        │
├────────────────────────────────────────┤
│         [Cancel]  [Execute Undo]       │
└────────────────────────────────────────┘
```

---

## Error Handling

### State Capture Failures

**Scenario:** `get_volume_configuration` fails (cluster offline, network error)

**Behavior:**
```javascript
try {
  originalState = await undoManager.captureCurrentState(...);
} catch (error) {
  console.warn('⚠️ Could not capture state for undo:', error);
  
  // Still execute Fix-It action
  result = await apiClient.callMcp(action.mcp_tool, params);
  
  // But disable undo
  showSuccess(result, { 
    reversible: false, 
    reason: 'Original state could not be captured' 
  });
}
```

**UI Result:**
- Fix-It executes successfully
- No undo button shown
- Success message: "Action completed (undo not available)"

### Undo Execution Failures

**Scenario:** Undo action fails (volume deleted, cluster offline)

**Behavior:**
```javascript
try {
  result = await apiClient.callMcp(undoAction.mcp_tool, undoAction.params);
  showSuccess('Undo completed successfully');
} catch (error) {
  showError(`Undo failed: ${error.message}`);
  // Keep undo info in sessionStorage (user can retry)
}
```

---

## Storage Strategy

### sessionStorage Schema

**Key:** `lastFixItAction`

**Value:**
```javascript
{
  actionId: "uuid-abc-123",
  timestamp: 1760278441000,
  alertFingerprint: "abc123...",
  
  executedAction: {
    mcp_tool: "cluster_update_volume",
    params: { volume_uuid: "...", state: "online" },
    result: "✅ Volume updated successfully!..."
  },
  
  originalState: {
    volume_uuid: "21d31324-...",
    state: "offline",
    size: "40GB",
    comment: "Test volume",
    qos_policy: "default",
    captureMethod: "get_volume_configuration"  // or "prometheus_metrics"
  },
  
  undoAction: {
    mcp_tool: "cluster_update_volume",
    params: { volume_uuid: "...", state: "offline" },
    label: "Set state to offline",
    cliCommand: "volume offline -vserver astra_vs2 -volume vol_test3"
  },
  
  reversibility: {
    reversible: true,
    partial: false,
    canRestore: ["state"],
    cannotRestore: [],
    reason: null
  }
}
```

### Lifecycle

**Created:** After successful Fix-It execution  
**Accessed:** When rendering Alert Details view  
**Cleared:** When user navigates away from Alert Details view  
**Expiry:** Tab close (sessionStorage clears automatically)

---

## Implementation Plan - Phase 5

### Phase 5.1: Create UndoManager Component
**Goal:** Extract undo logic from FixItModal into reusable component

**Tasks:**
1. Create `demo/js/core/UndoManager.js`
2. Implement `captureCurrentState()` with get_volume_configuration
3. Implement `determineReversibility()` with auto-detection
4. Implement `generateUndoAction()` with parameter inversion
5. Implement storage methods (store/get/clear)
6. Add unit tests (if test framework available)

**Deliverable:** Working UndoManager class with all methods

---

### Phase 5.2: Integrate UndoManager with FixItModal
**Goal:** Replace hardcoded dictionary with dynamic undo generation

**Tasks:**
1. Update `FixItModal.execute()` to call UndoManager
2. Add state capture before MCP execution
3. Update `showSuccess()` to handle reversibility info
4. Update `storeUndoInfo()` to use UndoManager
5. Test with volume state changes (online/offline)

**Deliverable:** Volume state changes show undo button

---

### Phase 5.3: CLI Command Generation
**Goal:** Show ONTAP CLI for undo actions

**Tasks:**
1. Implement `UndoManager.generateUndoCLI()`
2. Option A: Ask LLM to reverse original CLI
3. Option B: Template-based CLI generation
4. Add CLI display to undo confirmation modal
5. Test CLI accuracy with multiple action types

**Deliverable:** Undo modal shows accurate ONTAP CLI

---

### Phase 5.4: Partial Reversibility UI
**Goal:** Handle multi-parameter changes gracefully

**Tasks:**
1. Update UI to show "(Partial)" label
2. Add tooltips explaining what can/cannot be restored
3. Update confirmation modal to list restorable params
4. Test with size + comment changes
5. Test with missing original state scenarios

**Deliverable:** Users understand partial undo limitations

---

### Phase 5.5: Error Handling & Edge Cases
**Goal:** Robust handling of failures

**Tasks:**
1. Handle state capture failures (execute anyway, no undo)
2. Handle undo execution failures (show error, keep retry option)
3. Handle missing tools (get_volume_configuration unavailable)
4. Add fallback to ParameterResolver metrics
5. Test with offline clusters, network errors

**Deliverable:** System degrades gracefully on errors

---

## Testing Strategy

### Manual Test Cases

#### TC1: Volume State Change (Full Reversibility)
1. Find offline volume alert
2. Click Fix-It → "Bring Volume Online"
3. Verify state capture logs
4. Execute action
5. Verify undo button appears (toast + alert details)
6. Click undo
7. Verify volume goes back offline
8. Verify new undo appears (becomes redo)

#### TC2: Volume Autosize (Full Reversibility)
1. Find volume capacity alert
2. Click Fix-It → "Enable Autosize"
3. Execute with mode='grow'
4. Verify undo button: "Disable Autosize"
5. Click undo
6. Verify autosize disabled

#### TC3: Snapshot Delete (Irreversible)
1. Find snapshot-related Fix-It
2. Execute "Delete Oldest Snapshot"
3. Verify undo button grayed out
4. Tooltip: "Action is permanent"

#### TC4: State Capture Failure
1. Disconnect from cluster
2. Attempt Fix-It action
3. Verify action still executes
4. Verify no undo button (graceful degradation)

#### TC5: Partial Reversibility
1. Create action that changes size + comment
2. Ensure comment not in original state
3. Execute action
4. Verify undo shows "(Partial)"
5. Tooltip lists what can/cannot restore

---

## Future Enhancements (Beyond Phase 5)

### Multi-Level Undo Stack (Phase 6?)
- Support undo history (last 5 actions)
- Redo capability after undo
- Visual undo timeline

### Undo Recommendations
- LLM suggests when undo might be appropriate
- "This action is experimental - undo recommended after validation"

### Scheduled Undo
- Auto-undo after X minutes if not confirmed
- Use case: Testing changes with auto-rollback

### Undo Across Sessions
- Move from sessionStorage to localStorage with TTL
- Persist undo options for 24 hours

---

## Open Questions for Review

1. **Tool Availability:** Do we have `get_volume_configuration` or equivalent? Need to verify available tools for state capture.

2. **CLI Generation Method:** LLM-based or template-based? LLM more flexible but slower; templates faster but need maintenance.

3. **Undo on View Change:** Confirm undo clears when leaving Alert Details, even if user clicks away mid-action?

4. **Multiple Actions:** If user executes 2 Fix-Its on same alert, only last one gets undo button?

5. **Undo Validation:** Should we re-query state before undo to warn if state changed? (e.g., "Volume is now online, are you sure you want to offline it?")

---

## Glossary

**MCP Tool:** Model Context Protocol tool - server-side function exposed via JSON-RPC  
**Fix-It:** User-initiated corrective action from alert  
**Undo:** Reversal of previous Fix-It action  
**Redo:** Re-executing original Fix-It after undo (undo the undo)  
**Reversibility:** Ability to return to original state  
**Partial Reversibility:** Can restore some but not all changed parameters  
**State Capture:** Querying current configuration before making changes  
**Alert Fingerprint:** Unique identifier for alert instance  
**Session Scope:** Data lifetime tied to browser tab/window  

---

**Document Status:** ✅ Ready for Review  
**Next Step:** User approval → Begin Phase 5.1 implementation
