# MCP Tool Return Values: Analysis and Recommendations

## Executive Summary

This document analyzes the return value patterns across our NetApp ONTAP MCP server tools compared to best practices from the MCP specification and reference implementations. It addresses a critical architectural issue identified in `UNDO_ARCHITECTURE.md` where **text-based return values create fragility** in our Fix-It/Undo system.

**🎯 Critical Discovery**: Our own **Harvest metrics tools** (ported from NetApp's Harvest MCP server) already use **pure JSON returns** for all data-focused tools - and they work perfectly with LLMs! We don't need to invent a hybrid approach; we just need to **follow our own proven pattern**.

**Key Finding**: 
- ❌ Our ONTAP tools return formatted text strings
- ✅ Our Harvest tools return pure JSON (`JSON.stringify({ status, data })`)
- ✅ LLMs (Claude/ChatGPT) handle Harvest's JSON perfectly
- 🎯 **Solution**: Make ONTAP tools consistent with Harvest tools!

This design choice has cascading impacts on:
- Undo/reversibility detection (requires regex parsing → breaks easily)
- UI integration patterns (manual text extraction → fragile)
- Maintenance burden (hardcoded parameter mappings → doesn't scale)
- Type safety and error handling (string parsing → no validation)

**Recommendation**: Adopt Harvest's pure JSON pattern for configuration/state tools. This eliminates the fragility documented in `UNDO_ARCHITECTURE.md` while maintaining consistency with our own proven tools.

---

## Table of Contents

1. [MCP Protocol Specification](#mcp-protocol-specification)
2. [Current Implementation Analysis](#current-implementation-analysis)
3. [Comparison with Reference Implementations](#comparison-with-reference-implementations)
4. [Impact on Undo Architecture](#impact-on-undo-architecture)
5. [Recommendations](#recommendations)
6. [Migration Strategy](#migration-strategy)

---

## MCP Protocol Specification

### Tool Response Format (MCP 2025-06-18)

According to the MCP specification, tools return a `CallToolResult`:

```typescript
interface CallToolResult {
  content: Array<TextContent | ImageContent | EmbeddedResource>;
  isError?: boolean;
  _meta?: { [key: string]: unknown };
}

interface TextContent {
  type: "text";
  text: string;
}
```

**Key Points**:
1. ✅ **Text content is valid** - The spec allows `type: "text"` with a string value
2. ✅ **JSON is also valid** - The `text` field can contain JSON-serialized data
3. ✅ **Multiple content blocks** - Tools can return arrays of different content types
4. ⚠️ **No prescribed structure** - The spec doesn't mandate JSON over formatted text

**Critical Insight**: The MCP protocol is **content-agnostic**. Tools can return:
- Human-readable formatted text
- JSON-serialized structured data
- Mixed content (text + images + resources)

The choice depends on the **consumer** (LLM vs. programmatic API).

---

## Current Implementation Analysis

### Our Tool Return Patterns

#### Pattern 1: Formatted Markdown Text (Most Common)

```typescript
// src/tools/volume-tools.ts - handleListVolumes()
export async function handleListVolumes(args: any): Promise<any> {
  const volumes = await client.listVolumes(params.svm_name);
  
  let result = `📚 **Volumes on cluster ${params.cluster_ip}**\\n`;
  result += `📊 **Found ${volumes.length} volume(s):**\\n\\n`;
  
  volumes.forEach((volume, index) => {
    result += `${index + 1}. **${volume.name}**\\n`;
    result += `   • UUID: ${volume.uuid}\\n`;
    result += `   • SVM: ${volume.svm?.name}\\n`;
    result += `   • Size: ${formatBytes(volume.size)}\\n`;
    result += `   • State: ${volume.state}\\n`;
  });
  
  return result; // Returns plain text string
}
```

**Transport Layer Wrapping** (src/transports/streamable-http-transport.ts):
```typescript
const result = await handler(args || {}, clusterManager);

// Wrap result in MCP content format
return {
  content: [
    {
      type: 'text',
      text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    }
  ]
};
```

**Analysis**:
- ✅ **Human-readable** - Great for LLM consumption and chat interfaces
- ✅ **MCP compliant** - Wrapped correctly in `content` array
- ❌ **Not machine-parseable** - Requires regex to extract structured data
- ❌ **Display-coupled** - Changes to formatting break downstream parsers
- ❌ **No type safety** - String concatenation prone to bugs

#### Pattern 2: Formatted Text with Embedded JSON (Harvest Tools)

```typescript
// src/tools/harvest-metrics-tools.ts - handleGetActiveAlerts()
export async function handleGetActiveAlerts(): Promise<string> {
  const alerts = response.data?.alerts || [];
  
  let report = '## Prometheus Active Alerts\n\n';
  
  if (alerts.length === 0) {
    report += '✅ **No active alerts found**\n\n';
  } else {
    report += `🚨 **${alerts.length} active alerts found:**\n\n`;
    
    // Human-readable summary
    report += `🔴 **Critical**: ${criticalCount} alerts\n`;
    report += `🟡 **Warning**: ${warningCount} alerts\n`;
    
    // Raw JSON for programmatic use
    report += '\n### Alert Details:\n\n';
    report += '```json\n';
    report += JSON.stringify(alerts, null, 2);
    report += '\n```';
  }
  
  return report; // Hybrid: text summary + JSON block
}
```

**Analysis**:
- ✅ **Best of both worlds** - Human summary + machine-parseable data
- ✅ **Partial structure** - JSON embedded in markdown code block
- ⚠️ **Parsing required** - Still need to extract JSON from text
- ⚠️ **Format coupling** - Depends on markdown code block convention

#### Pattern 3: Configuration Retrieval (The Problematic Case)

```typescript
// src/tools/volume-tools.ts - handleGetVolumeConfiguration()
export async function handleGetVolumeConfiguration(args: any): Promise<any> {
  const response = await client.get(`/storage/volumes/${uuid}?fields=...`);
  
  // Returns formatted text via formatVolumeConfig()
  return formatVolumeConfig(response.data);
}

function formatVolumeConfig(volume: any): string {
  let result = `💾 **Volume: ${volume.name}** (${volume.uuid})\\n\\n`;
  result += `🏢 **SVM:** ${volume.svm?.name}\\n`;
  result += `📊 **Size:** ${formatBytes(volume.size)}\\n`;
  
  // Autosize configuration
  if (volume.autosize) {
    result += `\\n📏 **Autosize Configuration:**\\n`;
    result += `   • Mode: ${volume.autosize.mode || 'off'}\\n`;
    result += `   • Maximum Size: ${formatBytes(volume.autosize.maximum)}\\n`;
    result += `   • Minimum Size: ${formatBytes(volume.autosize.minimum)}\\n`;
    result += `   • Grow Threshold: ${volume.autosize.grow_threshold}%\\n`;
  }
  
  return result; // Pure formatted text
}
```

**The Problem** (from UNDO_ARCHITECTURE.md):

The demo UI must **parse this text with regex** to extract state for undo:

```javascript
// demo/js/core/UndoManager.js - parseVolumeState()
const autosizeMatch = text.match(/Mode:\s*(\w+)/);
if (autosizeMatch) {
    state.autosize_mode = autosizeMatch[1];  // Fragile!
}

const maxSizeMatch = text.match(/Maximum Size:\s*([0-9.]+\s*[KMGT]?B)/);
if (maxSizeMatch) {
    state.autosize_maximum = maxSizeMatch[1];  // Breaks if format changes!
}
```

**Critical Issues**:
1. **Parameter Name Mismatch**: Tool uses `mode`, state parsing creates `autosize_mode`
2. **Format Brittleness**: Any change to `formatVolumeConfig()` breaks parsing
3. **Remediation-Specific Code**: UndoManager has hardcoded parameter mappings
4. **No Schema Validation**: Runtime failures have no type safety

---

## Comparison with Reference Implementations

### How Do Other MCP Servers Handle This?

After analyzing our Harvest metrics tools (ported from the NetApp Harvest MCP server) and reviewing common MCP patterns, I identified three distinct approaches:

#### Pattern A: Pure Structured JSON (Harvest Metrics Tools - Our Baseline!)

**Example: Harvest `list_metrics`**
```typescript
// src/tools/harvest-metrics-tools.ts - handleListMetrics()
export async function handleListMetrics(args: ListMetricsArgs): Promise<string> {
  const response = await executeTSDBQuery(config, '/api/v1/label/__name__/values', params);
  
  const result = {
    status: 'success',
    data: {
      total_count: metrics.length,
      filtering: {
        server_side_matches: !!(args.matches && args.matches.length > 0),
        client_side_pattern: !!args.match,
        pattern_used: args.match || ''
      },
      descriptions_included: includeDescriptions,
      metrics: metricsArray  // Array of {name, description} objects
    }
  };
  
  return JSON.stringify(result, null, 2);  // Pure JSON!
}
```

**Use Case**: Data-focused tools where:
- ✅ LLMs can parse JSON for understanding
- ✅ UIs can directly consume structured data
- ✅ No regex parsing needed
- ✅ Type-safe with schemas

**Other Harvest Examples**:
- `metrics_query` → Returns full Prometheus JSON response
- `metrics_range_query` → Returns time-series JSON data
- `list_label_values` → Returns structured label enumeration
- `list_all_label_names` → Returns JSON array of labels

#### Pattern B: Hybrid Text + Embedded JSON (Harvest Alert Tools)

**Example: Harvest `get_active_alerts`**
```typescript
// src/tools/harvest-metrics-tools.ts - handleGetActiveAlerts()
export async function handleGetActiveAlerts(): Promise<string> {
  const alerts = response.data?.alerts || [];
  
  let report = '## Prometheus Active Alerts\n\n';
  
  if (alerts.length === 0) {
    report += '✅ **No active alerts found**\n\n';
  } else {
    report += `🚨 **${alerts.length} active alerts found:**\n\n`;
    
    // Human-readable summary
    report += `🔴 **Critical**: ${criticalCount} alerts\n`;
    report += `🟡 **Warning**: ${warningCount} alerts\n`;
    
    // Embedded JSON for programmatic use
    report += '\n### Alert Details:\n\n';
    report += '```json\n';
    report += JSON.stringify(alerts, null, 2);
    report += '\n```';
  }
  
  return report;  // Markdown + JSON block
}
```

**Use Case**: Alert/monitoring tools where:
- ✅ LLMs get context from summary
- ✅ Critical info highlighted (severity counts)
- ✅ Full JSON available for parsing
- ⚠️ Still requires extracting JSON from markdown

**Other Harvest Examples**:
- `infrastructure_health` → Returns health report with embedded metrics
- `search_metrics` → Returns formatted list with descriptions

#### Pattern C: Pure Human-Readable Text (Our Volume Tools - The Problem!)

**Example: Our `get_volume_configuration`**
```typescript
// src/tools/volume-tools.ts - handleGetVolumeConfiguration()
export async function handleGetVolumeConfiguration(args: any): Promise<any> {
  return formatVolumeConfig(response.data);
}

function formatVolumeConfig(volume: any): string {
  let result = `💾 **Volume: ${volume.name}** (${volume.uuid})\\n\\n`;
  result += `🏢 **SVM:** ${volume.svm?.name}\\n`;
  result += `📊 **Size:** ${formatBytes(volume.size)}\\n`;
  
  if (volume.autosize) {
    result += `\\n📏 **Autosize Configuration:**\\n`;
    result += `   • Mode: ${volume.autosize.mode || 'off'}\\n`;
    result += `   • Maximum Size: ${formatBytes(volume.autosize.maximum)}\\n`;
  }
  
  return result;  // Pure formatted text - no JSON!
}
```

**Use Case**: LLM-only consumption where:
- ✅ Human-readable summaries
- ✅ Great for chat interfaces
- ❌ Requires regex to extract data (fragile!)
- ❌ No programmatic API support

**Other Examples**:
- Simple time/weather MCP servers
- Informational tools with no structured output

### Where We Fit

**Critical Finding**: Looking at the **Harvest MCP server** we ported from, we discover:

🚨 **Harvest uses PURE JSON for all data-focused tools!**

- ✅ `list_metrics` → Returns `JSON.stringify({ status, data })`
- ✅ `list_label_values` → Returns `JSON.stringify({ label_name, label_values })`
- ✅ `metrics_query` → Returns raw Prometheus JSON
- ⚠️ `get_active_alerts` → Hybrid (text summary + embedded JSON)
- ⚠️ `infrastructure_health` → Hybrid (health report + status info)

**Our Current Pattern**: Mostly **Pattern C** (Pure Text)
- ✅ Great for chat-based interaction
- ✅ Human-readable outputs
- ❌ Poor for programmatic use (Fix-It actions, undo, UI integration)
- ❌ **Inconsistent with our own Harvest tools!**

**Our Actual Use Case**: Should be **Pattern A** (like Harvest) with occasional **Pattern B** (hybrid)
- We have **two consumers**:
  1. LLMs (ChatGPT assistant, general queries) → Can parse JSON
  2. Demo UI (provisioning forms, Fix-It actions, undo system) → Needs JSON
- Our **Harvest tools already prove JSON works for LLMs**
- Even Harvest's human-focused tools (alerts, health) embed JSON

**Mismatch Identified**: 
- ❌ We designed ONTAP tools for Pattern C (pure text)
- ✅ Our own Harvest tools use Pattern A (pure JSON)
- ✅ Harvest proves LLMs handle JSON perfectly well
- 🎯 **We should follow Harvest's lead!**

---

## Impact on Undo Architecture

### The Cascading Effect

```
Text-based tool returns
    ↓
Regex parsing required
    ↓  
Parameter name mismatches
    ↓
Hardcoded parameter mappings
    ↓
Remediation-specific code in UndoManager
    ↓
VIOLATES: "Keep alert-specific info out of codebase"
```

### Concrete Example: Volume Autosize Undo

**Current Flow**:
1. **Fix-It Action**: `cluster_enable_volume_autosize({ mode: 'grow', maximum_size: '200GB' })`
2. **State Capture**: `get_volume_configuration({ volume_uuid: 'xxx' })`
3. **Returns**: `"📏 Autosize Configuration:\n   • Mode: off\n   • Maximum Size: 190.00 MB"`
4. **Parsing**: Regex extracts `autosize_mode: 'off'`, `autosize_maximum: '190.00 MB'`
5. **Reversibility Check**: UndoManager maps `mode` → `autosize_mode` (hardcoded!)
6. **Undo Generation**: Maps back `autosize_mode` → `mode` for tool call

**Problems**:
- 🔴 **6 transformation steps** (each can fail)
- 🔴 **2 hardcoded mappings** (maintenance burden)
- 🔴 **Regex dependence** (format-coupled)
- 🔴 **No validation** (runtime failures)

**Proposed Flow with JSON Returns**:
1. **Fix-It Action**: `cluster_enable_volume_autosize({ mode: 'grow', maximum_size: '200GB' })`
2. **State Capture**: `get_volume_configuration({ volume_uuid: 'xxx' })`
3. **Returns**: `{ autosize: { mode: 'off', maximum_size: 190000000, ... } }`
4. **Reversibility Check**: Direct object property access (no mapping!)
5. **Undo Generation**: Extract values directly from `originalState.autosize.*`

**Benefits**:
- ✅ **2 transformation steps** (capture → restore)
- ✅ **Zero hardcoded mappings** (generic code)
- ✅ **No regex** (direct object access)
- ✅ **Schema validation** (TypeScript types)

---

## Recommendations

### 1. Follow Harvest's Lead - Use Pure JSON for Data Tools

**Critical Insight**: Our Harvest tools already demonstrate that **LLMs handle JSON perfectly**. We don't need human-formatted text for LLM consumption!

**Tools that should return pure JSON** (like Harvest):
- ✅ `get_volume_configuration` - State capture (matches Harvest's `list_metrics`)
- ✅ `get_volume_autosize_status` - Status info (matches Harvest's `list_label_values`)
- ✅ `cluster_list_volumes` - Volume enumeration (structured data like Harvest)
- ✅ `cluster_list_svms` - SVM enumeration
- ✅ `cluster_list_aggregates` - Aggregate enumeration
- ✅ `get_qos_policy` - Policy configuration
- ✅ `get_snapshot_policy` - Policy configuration
- ✅ `get_export_policy` - Policy configuration

**Tools that should use hybrid format** (like Harvest alerts):
- ⚠️ `infrastructure_health` - Already uses this! (ported from Harvest)
- ⚠️ Future alert/monitoring tools - Summary + embedded JSON

**Tools that are fine as pure text**:
- ✅ Action tools (create, update, delete) - Simple success messages
- ✅ Tools with no structured output

### 2. Implement Pure JSON Returns (Harvest Pattern)

Instead of the hybrid approach I initially suggested, **follow Harvest's simpler pattern**:

```typescript
// Harvest-style pure JSON return
export async function handleGetVolumeConfiguration(args: any): Promise<string> {
  const response = await client.get(`/storage/volumes/${uuid}?fields=...`);
  const volume = response.data;
  
  const result = {
    status: 'success',
    data: {
      volume: {
        uuid: volume.uuid,
        name: volume.name,
        size: volume.size,
        state: volume.state,
        comment: volume.comment || null
      },
      svm: {
        name: volume.svm?.name,
        uuid: volume.svm?.uuid
      },
      autosize: {
        // Use MCP parameter names directly (key insight!)
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
      }
    }
  };
  
  return JSON.stringify(result, null, 2);  // Just like Harvest!
}
```

**Why this is better than hybrid**:
- ✅ **Simpler** - No dual format complexity
- ✅ **Proven** - Harvest already validates this works with LLMs
- ✅ **Consistent** - Matches our existing Harvest tools
- ✅ **Parseable** - Direct `JSON.parse()` (no regex, no markdown extraction)
- ✅ **Type-safe** - Full TypeScript interface support

### 3. Update UndoManager to Parse JSON (Simple!)

```javascript
// demo/js/core/UndoManager.js

parseVolumeState(response) {
  // Response is already JSON from Harvest-style tools
  const parsed = JSON.parse(response);
  
  // Extract data section (Harvest-style { status, data } wrapper)
  const data = parsed.data || parsed;
  
  // Return flattened object with MCP parameter names
  return {
    // Volume basics
    uuid: data.volume?.uuid,
    name: data.volume?.name,
    size: data.volume?.size,
    state: data.volume?.state,
    comment: data.volume?.comment,
    
    // Autosize (parameter names match MCP tool exactly!)
    mode: data.autosize?.mode,
    maximum_size: data.autosize?.maximum_size,
    minimum_size: data.autosize?.minimum_size,
    grow_threshold_percent: data.autosize?.grow_threshold_percent,
    shrink_threshold_percent: data.autosize?.shrink_threshold_percent,
    
    // Policies
    snapshot_policy: data.snapshot_policy?.name,
    qos_policy: data.qos?.policy_name,
    export_policy: data.nfs?.export_policy
  };
}

// No need for parameter mappings - names already match!
// No need for regex parsing - it's pure JSON!
```

**Key Simplifications**:
- ❌ **Delete** hardcoded parameter mappings
- ❌ **Delete** regex parsing logic
- ❌ **Delete** format-specific text extraction
- ✅ **Simple** `JSON.parse()` and object access
- ✅ **Reliable** - format changes don't break parsing
- ✅ **Type-safe** - can add TypeScript interfaces later

### 4. Benefits of Following Harvest's Pattern

**Immediate Wins**:
1. ✅ **Eliminate parameter mappings** - No more `{ 'mode': 'autosize_mode' }`
2. ✅ **Eliminate regex fragility** - No text parsing at all
3. ✅ **Consistency with Harvest** - Same pattern across all tools
4. ✅ **Proven with LLMs** - Harvest tools show JSON works great
5. ✅ **Simpler transport layer** - Already handles JSON serialization

**Long-term Benefits**:
1. ✅ **Scalable undo** - Generic code for all Fix-It actions
2. ✅ **UI flexibility** - Tables, charts, forms all get clean JSON
3. ✅ **API reusability** - Same tools serve LLMs and UIs
4. ✅ **Maintenance reduction** - One data structure, no format coupling
5. ✅ **Better testing** - Mock JSON data vs. fragile text templates

**Comparison with Original Hybrid Proposal**:

| Aspect | Hybrid (summary+data) | Pure JSON (Harvest style) |
|--------|----------------------|---------------------------|
| **Complexity** | High (dual format) | Low (single format) |
| **Precedent** | No MCP examples | ✅ Harvest MCP server |
| **LLM Support** | Untested | ✅ Proven in Harvest |
| **Parsing** | Extract from object | Direct `JSON.parse()` |
| **Transport** | Custom logic | ✅ Already handles it |
| **Consistency** | New pattern | ✅ Matches our own tools |

**Winner**: **Pure JSON** (Harvest pattern) is simpler, proven, and already working in our codebase!

---

## Migration Strategy

### Phase 1: Pilot with Critical Tools (Week 1)

**Target**: Tools used by Fix-It/Undo system

1. ✅ Refactor `get_volume_configuration` to hybrid format
2. ✅ Update `UndoManager.parseVolumeState()` to handle JSON
3. ✅ Test undo functionality with both formats
4. ✅ Deploy to demo environment

**Success Criteria**:
- Undo buttons appear correctly
- No parameter mapping code needed
- Backwards compatibility maintained

### Phase 2: List Tools for UI Dropdowns (Week 2)

**Target**: Tools that populate form dropdowns

1. ✅ Refactor `cluster_list_volumes` to return JSON array
2. ✅ Refactor `cluster_list_svms` to return JSON array
3. ✅ Update demo UI dropdowns to parse JSON
4. ✅ Remove text parsing in `ProvisioningPanel.js`

**Benefits**:
- No more regex to extract volume names
- Direct array iteration for dropdowns
- Consistent data structure

### Phase 3: Status/Metrics Tools (Week 3)

**Target**: Tools that return current state

1. ✅ Refactor `get_volume_autosize_status` to JSON
2. ✅ Refactor `cluster_get_qos_policy` to JSON
3. ✅ Update any UI components using these tools

### Phase 4: Documentation & Best Practices (Week 4)

1. ✅ Update `CONTRIBUTING.md` with return value guidelines
2. ✅ Create return value schema templates
3. ✅ Add TypeScript interfaces for all tool responses
4. ✅ Document LLM vs. UI consumer patterns

---

## Conclusion

**Summary**:
- Our tools currently return formatted text (MCP-compliant but limiting)
- **Our own Harvest tools already use pure JSON** - and it works perfectly with LLMs!
- We have internal proof that Pattern A (pure JSON) works for both LLM and UI consumers
- The hybrid approach (Pattern C) is unnecessary complexity
- **Following Harvest's lead is the simplest, proven path forward**

**Key Discovery**:
🎯 **We already have the answer in our own codebase!** The Harvest MCP tools we ported demonstrate:
- ✅ Pure JSON works great for LLMs (Claude/ChatGPT parse it fine)
- ✅ Pure JSON is perfect for UIs (direct consumption)
- ✅ No need for dual formats or hybrid approaches
- ✅ Simpler code, proven pattern, internal consistency

**Recommendation**: **Adopt pure JSON returns** (Harvest pattern) for all configuration/state tools.

**Impact**:
- ✅ Solves UNDO_ARCHITECTURE.md fragility issues completely
- ✅ Enables generic, scalable undo system (no parameter mappings!)
- ✅ Improves UI integration (no regex parsing!)
- ✅ **Maintains consistency with our own Harvest tools**
- ✅ Reduces long-term maintenance (proven pattern)
- ✅ LLM compatibility already validated by Harvest

**The "Aha!" Moment**:
We were about to design a complex hybrid solution when the answer was already in our codebase. Harvest MCP server has been returning pure JSON all along, and LLMs handle it perfectly. We should just do the same for our ONTAP tools!

**Next Steps**:
1. Review this analysis with team
2. Acknowledge Harvest's pure JSON pattern as the model
3. Start Phase 1 pilot with `get_volume_configuration` (using Harvest pattern)
4. Measure impact on undo reliability
5. Roll out to other configuration tools
6. Achieve full consistency across all 55+ tools

---

## Appendix: Tool Return Value Guidelines

### When to Return Formatted Text

✅ **Use formatted text when**:
- Tool output is consumed only by LLMs
- Human-readable summaries are the primary value
- No programmatic parsing is needed
- Examples: `infrastructure_health`, alert summaries

### When to Return Structured JSON

✅ **Use structured JSON when**:
- Tool output drives UI components (dropdowns, tables, forms)
- Data needs validation or type checking
- Programmatic processing is required
- Examples: list tools, configuration retrieval

### When to Return Hybrid Format

✅ **Use hybrid format when**:
- Tool has both LLM and UI consumers
- Summary provides context for structured data
- Examples: state capture tools, complex queries

### Schema Definition Template

```typescript
// Define interface for structured response
interface ToolResult {
  summary?: string;  // Optional LLM-friendly text
  data: {            // Required structured data
    // Match MCP parameter names exactly!
    [key: string]: any;
  };
  metadata?: {       // Optional tool execution info
    timestamp?: string;
    duration_ms?: number;
    source?: string;
  };
}
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-14  
**Related Documents**: `UNDO_ARCHITECTURE.md`, `.github/copilot-instructions.md`
