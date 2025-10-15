# MCP Tool Implementation Best Practices

## Table of Contents

1. [Overview](#overview)
2. [Hybrid Return Format](#hybrid-return-format)
3. [Type Definitions](#type-definitions)
4. [Tool Registration](#tool-registration)
5. [Error Handling](#error-handling)
6. [Testing Requirements](#testing-requirements)
7. [Documentation Standards](#documentation-standards)
8. [Common Patterns](#common-patterns)
9. [Migration Checklist](#migration-checklist)

---

## Overview

This guide establishes best practices for implementing MCP (Model Context Protocol) tools in the NetApp ONTAP MCP Server. Our tools serve **two primary consumers**:

1. **🤖 AI Assistants (LLMs)**: Claude, ChatGPT, and other language models
2. **💻 Programmatic APIs**: Web UIs, automation scripts, and integration systems

To optimally serve both consumers, we use a **hybrid return format** that provides:
- **Human-readable summaries** for LLM context and understanding
- **Structured data objects** for reliable programmatic access

---

## Hybrid Return Format

### What is the Hybrid Format?

The hybrid format returns an object with two fields:

```typescript
interface HybridResponse<T> {
  summary: string;  // Human-readable text for LLMs
  data: T;          // Structured object for programmatic use
}
```

### When to Use Hybrid Format

✅ **USE hybrid format for:**
- **GET tools**: Retrieve configuration or state (e.g., `cluster_get_volume_autosize_status`)
- **LIST tools**: Enumerate resources (e.g., `cluster_list_volumes`)
- **Query tools**: Fetch data from systems (e.g., `get_qos_policy`)

❌ **DO NOT use hybrid format for:**
- **Action tools**: Create, update, delete operations (simple success messages are fine)
- **Tools with no structured output**: Tools that only return status messages

### Implementation Example

#### ❌ OLD: Text-Only Response (Fragile)

```typescript
export async function handleGetVolumeAutosizeStatus(args: any): Promise<string> {
  const volume = await client.get(`/storage/volumes/${uuid}?fields=autosize`);
  
  // Returns formatted text - requires regex parsing!
  return `
Volume Autosize Configuration:
  • Mode: ${volume.autosize.mode}
  • Maximum: ${formatBytes(volume.autosize.maximum)}
  • Current: ${formatBytes(volume.size)}
  `.trim();
}
```

**Problems:**
- Consumers must parse text with regex → Fragile!
- Format changes break parsing code
- No type safety
- Hard to extract specific fields

#### ✅ NEW: Hybrid Format (Resilient)

```typescript
import { VolumeAutosizeStatusResponse } from '../types/volume-autosize-types';

export async function handleGetVolumeAutosizeStatus(
  args: any
): Promise<VolumeAutosizeStatusResponse> {
  const volume = await client.get(`/storage/volumes/${uuid}?fields=autosize`);
  
  // Build structured data object
  const data = {
    volume: {
      uuid: volume.uuid,
      name: volume.name,
      size_bytes: volume.size
    },
    autosize: {
      mode: volume.autosize?.mode || 'off',
      maximum_size: volume.autosize?.maximum || null,
      minimum_size: volume.autosize?.minimum || null,
      grow_threshold_percent: volume.autosize?.grow_threshold || null,
      shrink_threshold_percent: volume.autosize?.shrink_threshold || null
    }
  };
  
  // Build human-readable summary for LLMs
  const summary = `
📊 **Volume Autosize Status: ${data.volume.name}**

**Current Configuration:**
  • Mode: ${data.autosize.mode}
  • Current Size: ${formatBytes(data.volume.size_bytes)}
  • Maximum Size: ${data.autosize.maximum_size ? formatBytes(data.autosize.maximum_size) : 'Not set'}
  • Grow Threshold: ${data.autosize.grow_threshold_percent || 'Default'}%
  `.trim();
  
  // Return hybrid format
  return { summary, data };
}
```

**Benefits:**
- ✅ LLMs get context from summary
- ✅ UIs directly access `result.data.autosize.mode` (no parsing!)
- ✅ Type-safe with TypeScript interfaces
- ✅ Resilient to format changes
- ✅ Undo/redo systems can reliably extract parameters

---

## Type Definitions

### Location and Naming

All type definitions belong in `src/types/`:

```
src/types/
  volume-types.ts           # Volume-related types
  volume-autosize-types.ts  # Autosize-specific types
  cifs-types.ts             # CIFS/SMB types
  qos-types.ts              # QoS policy types
  ...
```

### Type Definition Pattern

Each tool that returns hybrid format needs:

1. **Data interface**: Structure of the `.data` field
2. **Response interface**: The hybrid format wrapper

```typescript
// src/types/volume-autosize-types.ts

/**
 * Autosize configuration data
 */
export interface VolumeAutosizeStatusData {
  volume: {
    uuid: string;
    name: string;
    size_bytes: number;
  };
  autosize: {
    mode: 'off' | 'grow' | 'grow_shrink';
    maximum_size: number | null;
    minimum_size: number | null;
    grow_threshold_percent: number | null;
    shrink_threshold_percent: number | null;
  };
}

/**
 * Hybrid format response for volume autosize status
 */
export interface VolumeAutosizeStatusResponse {
  summary: string;
  data: VolumeAutosizeStatusData;
}
```

### Naming Conventions

- **Data types**: `{Tool}Data` (e.g., `VolumeListData`)
- **Response types**: `{Tool}Response` (e.g., `VolumeListResponse`)
- **Arrays**: Use `{Resource}[]` (e.g., `Volume[]`)

---

## Tool Registration

### Required Registration Points

Every tool must be registered in **THREE locations**:

#### 1. Tool Implementation (`src/tools/*.ts`)

```typescript
// src/tools/volume-autosize-tools.ts
export async function handleGetVolumeAutosizeStatus(
  args: any,
  clusterManager: OntapClusterManager
): Promise<VolumeAutosizeStatusResponse> {
  // ... implementation
}
```

#### 2. Tool Registry (`src/registry/register-tools.ts`)

```typescript
// src/registry/register-tools.ts
import { handleGetVolumeAutosizeStatus } from '../tools/volume-autosize-tools';

export function registerTools(
  registry: ToolRegistry,
  clusterManager: OntapClusterManager
): void {
  registry.registerTool({
    name: 'cluster_get_volume_autosize_status',
    description: 'Get autosize configuration for a volume',
    inputSchema: {
      type: 'object',
      properties: {
        cluster_name: { type: 'string', description: 'Cluster name' },
        volume_uuid: { type: 'string', description: 'Volume UUID' }
      },
      required: ['cluster_name', 'volume_uuid']
    },
    handler: async (args: any) => {
      return await handleGetVolumeAutosizeStatus(args, clusterManager);
    }
  });
}
```

#### 3. Type Exports (`src/types/{category}-types.ts`)

```typescript
// Ensure types are exported
export { VolumeAutosizeStatusResponse, VolumeAutosizeStatusData };
```

### Common Registration Mistakes

❌ **Missing in one location** → Tool doesn't work in some modes  
❌ **Wrong handler signature** → Runtime type errors  
❌ **Missing type exports** → Import errors  
❌ **Incorrect tool name** → LLM can't find tool

---

## Error Handling

### Standard Error Pattern

```typescript
export async function handleMyTool(
  args: any,
  clusterManager: OntapClusterManager
): Promise<MyToolResponse> {
  try {
    // Validate required parameters
    if (!args.cluster_name) {
      throw new Error('cluster_name is required');
    }
    
    // Get client and execute
    const client = getApiClient(clusterManager, args.cluster_name, ...);
    const result = await client.get('/api/endpoint');
    
    // Build and return hybrid response
    return {
      summary: buildSummary(result),
      data: buildDataObject(result)
    };
    
  } catch (error) {
    // Log for debugging
    console.error('Error in handleMyTool:', error);
    
    // Re-throw with context
    throw new Error(
      `Failed to execute my_tool: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
```

### Error Messages

- ✅ **DO**: Provide clear, actionable error messages
- ✅ **DO**: Include parameter values in errors (when safe)
- ✅ **DO**: Suggest solutions when possible
- ❌ **DON'T**: Expose sensitive data in error messages
- ❌ **DON'T**: Use generic "Error" messages

---

## Testing Requirements

### Unit Tests

Each tool needs a test in `test/tools/`:

```javascript
// test/tools/test-volume-autosize-tools.js
const { expect } = require('chai');

describe('Volume Autosize Tools', () => {
  it('should return hybrid format for get_volume_autosize_status', async () => {
    const result = await testClient.callMcp('cluster_get_volume_autosize_status', {
      cluster_name: 'test-cluster',
      volume_uuid: 'test-uuid'
    });
    
    // Verify hybrid format structure
    expect(result).to.have.property('summary');
    expect(result).to.have.property('data');
    expect(result.summary).to.be.a('string');
    expect(result.data).to.be.an('object');
    
    // Verify data structure
    expect(result.data).to.have.property('volume');
    expect(result.data).to.have.property('autosize');
    expect(result.data.autosize).to.have.property('mode');
  });
});
```

### Integration Tests

Integration tests verify end-to-end functionality:

```javascript
// test/integration/test-autosize-workflow.js
describe('Autosize Workflow', () => {
  it('should capture state, enable autosize, and verify', async () => {
    // 1. Get current state
    const before = await testClient.callMcp('cluster_get_volume_autosize_status', {...});
    expect(before.data.autosize.mode).to.equal('off');
    
    // 2. Enable autosize
    await testClient.callMcp('cluster_enable_volume_autosize', {
      mode: 'grow',
      maximum_size: '1TB'
    });
    
    // 3. Verify state changed
    const after = await testClient.callMcp('cluster_get_volume_autosize_status', {...});
    expect(after.data.autosize.mode).to.equal('grow');
  });
});
```

### Test Coverage Requirements

- ✅ **Required**: Every tool has unit test
- ✅ **Required**: Hybrid format structure verified
- ✅ **Required**: Error cases tested
- ✅ **Recommended**: Integration tests for workflows
- ✅ **Recommended**: Edge cases covered

---

## Documentation Standards

### Inline Documentation

```typescript
/**
 * Get volume autosize configuration and status
 * 
 * Returns current autosize settings including mode, thresholds, and size limits.
 * Useful for capturing state before making changes or implementing undo.
 * 
 * @param args - Tool arguments
 * @param args.cluster_name - Name of the registered cluster
 * @param args.volume_uuid - UUID of the volume
 * @param clusterManager - Cluster manager instance
 * @returns Hybrid format response with summary and structured data
 * 
 * @example
 * ```typescript
 * const result = await handleGetVolumeAutosizeStatus({
 *   cluster_name: 'prod-cluster',
 *   volume_uuid: 'abc-123-def'
 * }, clusterManager);
 * 
 * console.log(result.summary); // Human-readable text
 * console.log(result.data.autosize.mode); // Direct access to mode
 * ```
 */
export async function handleGetVolumeAutosizeStatus(
  args: any,
  clusterManager: OntapClusterManager
): Promise<VolumeAutosizeStatusResponse> {
  // ... implementation
}
```

### README Updates

When adding new tools, update `README.md`:

```markdown
### Volume Autosize Tools

- `cluster_get_volume_autosize_status` - Get autosize configuration (returns hybrid format)
- `cluster_enable_volume_autosize` - Enable or configure autosize
```

---

## Common Patterns

### Pattern 1: List Tools (Array of Objects)

```typescript
export async function handleListVolumes(
  args: any,
  clusterManager: OntapClusterManager
): Promise<VolumeListResponse> {
  const volumes = await client.listVolumes();
  
  const data = volumes.map(vol => ({
    uuid: vol.uuid,
    name: vol.name,
    svm: vol.svm?.name,
    size_bytes: vol.size,
    state: vol.state
  }));
  
  const summary = `
📚 **Volumes on cluster ${clusterName}**
📊 **Found ${data.length} volume(s):**

${data.map((v, i) => `${i+1}. **${v.name}** (${v.state})`).join('\n')}
  `.trim();
  
  return { summary, data };
}
```

### Pattern 2: Get Tools (Single Object)

```typescript
export async function handleGetQosPolicy(
  args: any,
  clusterManager: OntapClusterManager
): Promise<QosPolicyResponse> {
  const policy = await client.getQosPolicy(policyUuid);
  
  const data = {
    uuid: policy.uuid,
    name: policy.name,
    type: policy.fixed ? 'fixed' : 'adaptive',
    limits: {
      max_throughput: policy.fixed?.max_throughput_iops,
      min_throughput: policy.fixed?.min_throughput_iops
    }
  };
  
  const summary = `
📋 **QoS Policy: ${data.name}**
  • Type: ${data.type}
  • Max IOPS: ${data.limits.max_throughput || 'Unlimited'}
  `.trim();
  
  return { summary, data };
}
```

### Pattern 3: Action Tools (Simple Message)

```typescript
export async function handleEnableAutosize(
  args: any,
  clusterManager: OntapClusterManager
): Promise<string> {
  await client.patch(`/storage/volumes/${uuid}`, {
    autosize: {
      mode: args.mode,
      maximum: args.maximum_size
    }
  });
  
  // Action tools can return simple text
  return `✅ Successfully enabled autosize on volume ${args.volume_uuid}`;
}
```

---

## Migration Checklist

When migrating an existing tool to hybrid format:

### Phase 1: Preparation
- [ ] Read existing tool implementation
- [ ] Identify data structure to return
- [ ] Create type definitions in `src/types/`
- [ ] Write unit tests for new format

### Phase 2: Implementation
- [ ] Update tool function signature with response type
- [ ] Extract data building logic into separate function
- [ ] Create summary building function
- [ ] Return `{ summary, data }` object
- [ ] Add error handling

### Phase 3: Integration
- [ ] Verify tool registration in `register-tools.ts`
- [ ] Update consuming code to use `.data` field
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Update documentation

### Phase 4: Validation
- [ ] Test in STDIO mode (VS Code MCP)
- [ ] Test in HTTP mode (demo UI)
- [ ] Verify backward compatibility
- [ ] Check TypeScript compilation
- [ ] Review error messages

---

## Summary

**Key Takeaways:**

1. ✅ **Use hybrid format** for GET/LIST tools
2. ✅ **Define types** in `src/types/` directory
3. ✅ **Register tools** in all three locations
4. ✅ **Write tests** for hybrid format structure
5. ✅ **Document clearly** with JSDoc and examples
6. ✅ **Follow patterns** for consistency
7. ✅ **Validate thoroughly** in both modes

**Benefits of Following These Practices:**

- 🤖 **Better LLM Integration**: Summaries provide context
- 💻 **Reliable APIs**: Structured data prevents parsing errors
- 🔧 **Easier Maintenance**: Type safety catches issues early
- ♻️ **Undo/Redo Support**: Reliable state capture
- 📚 **Consistent Codebase**: Predictable patterns

---

## Questions?

For questions or suggestions about tool implementation:
- Review existing tools in `src/tools/` for examples
- Check type definitions in `src/types/`
- See tests in `test/tools/` for patterns
- Refer to `HYBRID_FORMAT_GET_TOOLS_PLAN.md` for migration strategy

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-15  
**Related Documents**: 
- `HYBRID_FORMAT_GET_TOOLS_PLAN.md`
- `TOOL_RETURN_VALUES_ANALYSIS.md`
- `.github/copilot-instructions.md`
