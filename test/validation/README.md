# Hybrid Format Validation Framework

## Overview

This framework validates that the Go MCP server implementation returns **exactly the same data structures** as the TypeScript implementation for all 14 tools that use hybrid format `{summary, data}`.

This is critical for:
- **Fix-It undo button functionality** - requires exact parameter names
- **API contract preservation** - ensures Go doesn't break existing clients
- **Migration confidence** - validates TypeScript → Go parity before sunset

## The 14 Hybrid Format Tools

1. `cluster_list_volumes` - List volumes with structured data
2. `cluster_list_aggregates` - List aggregates with node info
3. `cluster_list_svms` - List SVMs with state
4. `get_cifs_share` - Get CIFS share with properties
5. `cluster_list_cifs_shares` - List CIFS shares
6. `list_export_policies` - List NFS export policies
7. `get_export_policy` - Get export policy with rules
8. `cluster_list_qos_policies` - List QoS policies
9. `cluster_get_qos_policy` - Get QoS policy details
10. `list_snapshot_policies` - List snapshot policies
11. `get_snapshot_policy` - Get snapshot policy details
12. `get_snapshot_schedule` - Get snapshot schedule
13. `cluster_get_volume_autosize_status` - Get autosize config (**critical for undo!**)
14. `cluster_list_volume_snapshots` - List volume snapshots
15. `cluster_get_volume_snapshot_info` - Get snapshot details

## Workflow

### One-Time: Before Merging go-rewrite Branch

#### Step 1: Capture Golden Responses from TypeScript

```bash
# Start TypeScript MCP server
npm run build
./start-demo.sh  # or: node build/index.js --http=3000

# Capture responses (in another terminal)
node test/utils/capture-golden-responses.js

# Output: test/fixtures/hybrid-golden/*.json
# These are the "golden" fixtures that define the API contract
```

#### Step 2: Validate Go Matches TypeScript

```bash
# Stop TypeScript, start Go
./stop-demo.sh
./start-demo-go.sh  # or: go run cmd/ontap-mcp --http=3000

# Run validation
node test/validation/test-hybrid-format-validation.js

# Expected output:
# ✅ cluster_list_volumes: PASSED
# ✅ cluster_list_aggregates: PASSED
# ❌ get_volume_configuration: FAILED
#    Errors:
#      1. [missing_field] data.autosize.maximum_size
#         Field exists in TypeScript but missing in Go
```

#### Step 3: Fix Any Mismatches

If validation fails:
1. Review the error report (shows exact field/path that's wrong)
2. Fix the Go implementation to match TypeScript
3. Re-run validation until all tools pass
4. Commit fixes to go-rewrite branch

#### Step 4: Merge with Confidence

Once all validations pass:
```bash
# All 14 tools validated ✅
# Golden fixtures committed to git
# Merge go-rewrite → main
# Remove TypeScript code
```

### Ongoing: After TypeScript Removal

Golden fixtures become **regression tests**:

```bash
# Regular testing (Go-only)
./start-demo-go.sh
npm test  # Includes hybrid format validation

# If validation fails, either:
# a) Bug introduced - fix the Go code
# b) Intentional API change - update golden fixture manually
```

## Files

```
test/
├── fixtures/
│   └── hybrid-golden/              # Golden fixtures (committed to git)
│       ├── cluster_list_volumes.json
│       ├── get_volume_configuration.json
│       └── ... (14 total)
│
├── utils/
│   ├── capture-golden-responses.js   # Capture from TypeScript
│   └── hybrid-format-validator.js    # Validation logic
│
└── validation/
    └── test-hybrid-format-validation.js  # Main validation test
```

## What Gets Validated

### Structure (Required)
- ✅ Field names match exactly
- ✅ Field types match (string, number, object, array)
- ✅ Nested object structure matches
- ✅ Required fields present

### Values (Ignored)
- ⏭️ UUIDs differ (expected - different clusters/volumes)
- ⏭️ Timestamps differ (expected - captured at different times)
- ⏭️ Array lengths differ (expected - cluster state changes)
- ⏭️ Specific values differ (only structure matters)

## Example Golden Fixture

```json
{
  "metadata": {
    "tool": "cluster_get_volume_autosize_status",
    "category": "volume-autosize",
    "capturedAt": "2025-10-17T18:30:00.000Z",
    "cluster": "julia-vsim-1",
    "params": {
      "cluster_name": "julia-vsim-1",
      "volume_uuid": "a1b2c3d4-..."
    },
    "implementation": "typescript"
  },
  "response": {
    "content": [{
      "type": "text",
      "text": "{\"summary\":\"...\",\"data\":{\"mode\":\"grow\",\"maximum_size\":107374182400,\"minimum_size\":20971520,\"grow_threshold_percent\":85}}"
    }]
  }
}
```

## Critical Field Names (For Undo Button)

These field names **must match exactly** for Fix-It undo to work:

```javascript
// Volume Autosize
data.autosize.maximum_size       // NOT "maximum"
data.autosize.minimum_size       // NOT "minimum"
data.autosize.grow_threshold_percent  // NOT "grow_threshold"

// QoS Policies
data.fixed.max_throughput        // NOT "max_throughput_iops"
data.fixed.min_throughput        // NOT "min_throughput_iops"
data.adaptive.peak_iops          // NOT "peak_iops_per_tb"
```

## Troubleshooting

### "Golden fixture not found"
Run capture script first: `node test/utils/capture-golden-responses.js`

### "No clusters registered"
Configure clusters in `test/clusters.json`

### "Unable to discover required resources"
Some tools need existing resources (volumes, policies). The test auto-discovers them, but if none exist, the tool is skipped.

### Validation fails after intentional API change
1. Update Go implementation
2. Manually update golden fixture: `test/fixtures/hybrid-golden/{tool}.json`
3. Document why in git commit message
4. Re-run validation to confirm

## Integration with Test Suite

Add to `test/run-all-tests.sh`:

```bash
# Test 21: Hybrid Format Validation (Go vs TypeScript golden fixtures)
run_test "Hybrid Format Validation" "node test/validation/test-hybrid-format-validation.js"
```

This ensures every test run validates Go still matches the original TypeScript API contract.
