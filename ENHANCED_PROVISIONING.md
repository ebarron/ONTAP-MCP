# NetApp ONTAP MCP Server - Enhanced Volume Provisioning

This document describes the enhanced volume provisioning capabilities added to the NetApp ONTAP MCP Server, including snapshot policy management and NFS export policy management.

## Overview

The enhanced MCP server now supports complete volume provisioning workflows that include:

- **Data Protection**: Automated snapshot policies for backup and recovery
- **Network Access Control**: NFS export policies for secure client access
- **Volume Configuration Management**: Post-creation volume updates and policy applications

## New Tool Categories

### 1. Snapshot Policy Management (7 tools)

| Tool Name | Description | Use Case |
|-----------|-------------|----------|
| `list_snapshot_policies` | List all snapshot policies | Policy discovery and inventory |
| `get_snapshot_policy` | Get detailed policy information | Policy review and validation |
| `create_snapshot_policy` | Create new snapshot policies | Data protection setup |
| `update_snapshot_policy` | Modify existing policies | Policy maintenance |
| `delete_snapshot_policy` | Remove unused policies | Policy cleanup |
| `apply_snapshot_policy_to_volume` | Apply policy to volume | Volume protection |
| `remove_snapshot_policy_from_volume` | Remove policy from volume | Disable protection |

### 2. NFS Export Policy Management (9 tools)

| Tool Name | Description | Use Case |
|-----------|-------------|----------|
| `list_export_policies` | List all export policies | Policy inventory |
| `get_export_policy` | Get policy with all rules | Policy review |
| `create_export_policy` | Create new export policy | Access control setup |
| `delete_export_policy` | Remove export policy | Policy cleanup |
| `add_export_rule` | Add rule to policy | Grant access |
| `update_export_rule` | Modify existing rule | Change permissions |
| `delete_export_rule` | Remove rule from policy | Revoke access |
| `configure_volume_nfs_access` | Apply export policy to volume | Enable NFS access |
| `disable_volume_nfs_access` | Revert to default policy | Disable custom access |

### 3. Volume Configuration & Updates (6 tools)

| Tool Name | Description | Use Case |
|-----------|-------------|----------|
| `get_volume_configuration` | Get comprehensive volume info | Configuration review |
| `update_volume_security_style` | Change security style | Security model updates |
| `resize_volume` | Increase volume size | Capacity management |
| `update_volume_comment` | Update volume description | Documentation |
| `apply_snapshot_policy_to_volume` | Apply snapshot policy | Enable protection |
| `remove_snapshot_policy_from_volume` | Remove snapshot policy | Disable protection |

## Enhanced Volume Creation

The existing `create_volume` and `cluster_create_volume` tools now support optional policy parameters:

```json
{
  "cluster_name": "my-cluster",
  "svm_name": "VS1", 
  "volume_name": "app-data",
  "size": "500GB",
  "snapshot_policy": "daily-7day-retention",
  "nfs_export_policy": "app-servers-readonly"
}
```

## Complete Workflow Examples

### 1. Application Data Volume with Protection

```bash
# 1. Create snapshot policy
create_snapshot_policy:
{
  "cluster_name": "prod-cluster",
  "policy_name": "app-data-protection",
  "comment": "Hourly + daily snapshots for app data",
  "copies": [
    {"schedule": {"name": "hourly"}, "count": 24, "prefix": "hourly"},
    {"schedule": {"name": "daily"}, "count": 7, "prefix": "daily"}
  ]
}

# 2. Create NFS export policy  
create_export_policy:
{
  "cluster_name": "prod-cluster",
  "policy_name": "app-servers-access",
  "svm_name": "VS1",
  "comment": "Application servers access policy"
}

# 3. Add export rule for app servers
add_export_rule:
{
  "cluster_name": "prod-cluster",
  "policy_name": "app-servers-access",
  "svm_name": "VS1",
  "clients": [{"match": "10.1.100.0/24"}],
  "protocols": ["nfs4"],
  "ro_rule": ["sys"],
  "rw_rule": ["sys"],
  "superuser": ["none"]
}

# 4. Create volume with both policies
cluster_create_volume:
{
  "cluster_name": "prod-cluster",
  "svm_name": "VS1",
  "volume_name": "app-data-vol",
  "size": "1TB",
  "snapshot_policy": "app-data-protection",
  "nfs_export_policy": "app-servers-access"
}
```

### 2. Development Environment with Flexible Access

```bash
# 1. Create export policy for development
create_export_policy:
{
  "cluster_name": "dev-cluster",
  "policy_name": "dev-team-access",
  "svm_name": "dev-svm",
  "comment": "Development team flexible access"
}

# 2. Add rule for dev subnet (read-write)
add_export_rule:
{
  "cluster_name": "dev-cluster", 
  "policy_name": "dev-team-access",
  "svm_name": "dev-svm",
  "clients": [{"match": "192.168.10.0/24"}],
  "protocols": ["nfs3", "nfs4"],
  "ro_rule": ["sys"],
  "rw_rule": ["sys"],
  "superuser": ["sys"]
}

# 3. Add rule for CI/CD systems (read-only)
add_export_rule:
{
  "cluster_name": "dev-cluster",
  "policy_name": "dev-team-access", 
  "svm_name": "dev-svm",
  "clients": [{"match": "cicd.company.com"}],
  "protocols": ["nfs4"],
  "ro_rule": ["sys"],
  "rw_rule": ["none"],
  "superuser": ["none"]
}
```

### 3. Post-Creation Volume Management

```bash
# 1. Check current configuration
get_volume_configuration:
{
  "cluster_name": "my-cluster",
  "volume_uuid": "12345678-1234-5678-9abc-123456789012"
}

# 2. Apply snapshot policy to existing volume
apply_snapshot_policy_to_volume:
{
  "cluster_name": "my-cluster",
  "volume_uuid": "12345678-1234-5678-9abc-123456789012",
  "snapshot_policy_name": "daily-backups"
}

# 3. Configure NFS access
configure_volume_nfs_access:
{
  "cluster_name": "my-cluster", 
  "volume_uuid": "12345678-1234-5678-9abc-123456789012",
  "export_policy_name": "secure-access"
}

# 4. Resize if needed
resize_volume:
{
  "cluster_name": "my-cluster",
  "volume_uuid": "12345678-1234-5678-9abc-123456789012", 
  "new_size": "2TB"
}
```

## Policy Management Best Practices

### Snapshot Policies

1. **Naming Convention**: Use descriptive names indicating frequency and retention
   - `hourly-24h-daily-7d` - 24 hourly + 7 daily snapshots
   - `app-critical-protection` - Critical application protection scheme

2. **Schedule Planning**: 
   - **Frequent**: Every 15 minutes for critical data
   - **Hourly**: For active development environments 
   - **Daily**: For production data with daily change cycles
   - **Weekly**: For archival or slowly changing data

3. **Retention Management**: Balance protection vs. storage consumption
   - High-frequency, short retention for recent recovery
   - Low-frequency, long retention for historical recovery

### Export Policies

1. **Principle of Least Privilege**: Grant minimum required access
   - Use `ro_rule: ["sys"]` and `rw_rule: ["none"]` for read-only access
   - Avoid `superuser: ["any"]` unless absolutely necessary

2. **Network Segmentation**: Create policies per network zone
   - Separate policies for DMZ, internal, and management networks
   - Use specific IP ranges rather than broad subnets when possible

3. **Protocol Selection**: Choose appropriate NFS versions
   - NFSv4 for modern environments (better security, performance)
   - NFSv3 for legacy application compatibility

## Security Considerations

### Authentication Methods

- **`sys`**: Standard UNIX authentication (most common)
- **`krb5`**: Kerberos authentication only
- **`krb5i`**: Kerberos with integrity checking
- **`krb5p`**: Kerberos with privacy (encryption)
- **`none`**: No authentication required
- **`never`**: Explicitly deny access

### Client Matching Patterns

- **IP Address**: `192.168.1.100`
- **Subnet**: `192.168.1.0/24` 
- **Hostname**: `server.company.com`
- **Domain**: `.company.com`
- **Netgroup**: `@engineering-team`

## Troubleshooting Guide

### Common Issues

1. **"Policy is in use" when deleting**
   - Find volumes using the policy: `list_volumes` 
   - Change volume policies or delete volumes first

2. **"Volume not accessible via NFS"**
   - Check export policy rules: `get_export_policy`
   - Verify client IP matches rule patterns
   - Confirm NFS service is enabled on SVM

3. **"Snapshots not being created"**
   - Verify policy application: `get_volume_configuration`
   - Check policy copies: `get_snapshot_policy`  
   - Confirm policy is enabled

### Validation Steps

1. **After creating policies**: Use `get_snapshot_policy` or `get_export_policy`
2. **After applying to volumes**: Use `get_volume_configuration`
3. **For access issues**: Check ONTAP System Manager → NFS exports
4. **For snapshot issues**: Check ONTAP System Manager → Snapshot policies

## Integration with Automation

The enhanced MCP tools enable complete infrastructure-as-code workflows:

```python
# Example Python automation
def provision_application_volume(cluster, svm, app_name, size, client_subnet):
    # Create snapshot policy
    snap_policy = f"{app_name}-snapshots"
    create_snapshot_policy(cluster, snap_policy, hourly_daily_schedule)
    
    # Create export policy  
    export_policy = f"{app_name}-access"
    create_export_policy(cluster, export_policy, svm)
    add_export_rule(cluster, export_policy, client_subnet, "rw")
    
    # Create volume with policies
    volume = create_volume(
        cluster=cluster,
        svm=svm, 
        name=f"{app_name}-data",
        size=size,
        snapshot_policy=snap_policy,
        nfs_export_policy=export_policy
    )
    
    return volume
```

This enables complete volume provisioning with data protection and access control in a single operation, supporting modern DevOps and infrastructure automation requirements.