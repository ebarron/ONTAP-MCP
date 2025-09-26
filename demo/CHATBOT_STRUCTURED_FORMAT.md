# Chatbot Structured Recommendations Format

## Overview
The ONTAP MCP demo chatbot now supports structured provisioning recommendations that trigger automatic form population. This prevents false positives where error messages or informational responses accidentally open the provisioning form.

## Structured Format for LLMs

When making provisioning recommendations, use this exact format:

```
## PROVISIONING_RECOMMENDATION
- **Cluster**: cluster-name
- **SVM**: svm-name  
- **Aggregate**: aggregate-name
- **Size**: 100MB (or GB/TB)
- **Protocol**: NFS (or CIFS)
- **Snapshot_Policy**: policy-name (optional)
- **Export_Policy**: policy-name (optional, for NFS volumes)
## END_PROVISIONING_RECOMMENDATION
```

## Required Fields
- **Cluster**: Must be a valid cluster name
- **SVM**: Must be a valid SVM name  
- **Aggregate**: Must be a valid aggregate name
- **Size**: Numeric value with unit (MB, GB, TB)

## Optional Fields
- **Protocol**: NFS or CIFS (defaults based on user request)
- **Snapshot_Policy**: Name of snapshot policy to apply
- **Export_Policy**: Name of export policy for NFS volumes

## Examples

### NFS Volume Provisioning
```
## PROVISIONING_RECOMMENDATION
- **Cluster**: greg-vsim-1
- **SVM**: vs0
- **Aggregate**: sti245_vsim_ocvs026b_aggr1
- **Size**: 100MB
- **Protocol**: NFS
- **Export_Policy**: vs0_nfs_policy
## END_PROVISIONING_RECOMMENDATION
```

### CIFS Volume Provisioning
```
## PROVISIONING_RECOMMENDATION
- **Cluster**: greg-vsim-2
- **SVM**: svm1
- **Aggregate**: storage_availability_zone_0
- **Size**: 500GB
- **Protocol**: CIFS
- **Snapshot_Policy**: daily_snapshots
## END_PROVISIONING_RECOMMENDATION
```

## Legacy Support
The system still supports the legacy format for backward compatibility:
- Must have `## Recommendation:` section
- Must have `Next Steps:` or similar action prompt
- Must have at least 2 strong provisioning indicators
- Will NOT trigger if error indicators are present

## Intent Detection Logic
The chatbot will only open the provisioning form when:
1. **Structured format detected**: Contains `## PROVISIONING_RECOMMENDATION` block
2. **Legacy format with strong indicators**: Multiple provisioning keywords + no error indicators

## Error Responses - Will NOT Trigger
These patterns will prevent form auto-opening:
- "unable to resolve"
- "failed to access" 
- "error accessing"
- "issue with cluster"
- "cannot connect"
- "connection failed"

## Benefits
- ✅ Explicit intent declaration
- ✅ Clean data extraction
- ✅ No false positives on error messages
- ✅ Future-proof for additional recommendation types
- ✅ Backward compatibility with existing responses