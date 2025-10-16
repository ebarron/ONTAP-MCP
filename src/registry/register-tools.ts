/**
 * Tool Registration System
 * Automatically registers all tools in the central registry
 */

import { 
  registerTool, 
  ToolCategory 
} from "./tool-registry.js";

// Import cluster management tools
import {
  createAddClusterToolDefinition,
  handleAddCluster,
  createListRegisteredClustersToolDefinition,
  handleListRegisteredClusters,
  createGetAllClustersInfoToolDefinition,
  handleGetAllClustersInfo,
  createClusterListSvmsToolDefinition,
  handleClusterListSvms,
  createClusterListAggregatesToolDefinition,
  handleClusterListAggregates,
  createClusterListVolumesToolDefinition,
  handleClusterListVolumes,
} from "../tools/cluster-management-tools.js";

// Import existing tool modules
import {
  createCreateSnapshotPolicyToolDefinition,
  handleCreateSnapshotPolicy,
  createListSnapshotPoliciesToolDefinition,
  handleListSnapshotPolicies,
  createGetSnapshotPolicyToolDefinition,
  handleGetSnapshotPolicy,
  createDeleteSnapshotPolicyToolDefinition,
  handleDeleteSnapshotPolicy
} from "../tools/snapshot-policy-tools.js";

import {
  createListExportPoliciesToolDefinition,
  handleListExportPolicies,
  createGetExportPolicyToolDefinition,
  handleGetExportPolicy,
  createCreateExportPolicyToolDefinition,
  handleCreateExportPolicy,
  createDeleteExportPolicyToolDefinition,
  handleDeleteExportPolicy,
  createAddExportRuleToolDefinition,
  handleAddExportRule,
  createUpdateExportRuleToolDefinition,
  handleUpdateExportRule,
  createDeleteExportRuleToolDefinition,
  handleDeleteExportRule
} from "../tools/export-policy-tools.js";

import {
  createListCifsSharesToolDefinition,
  handleListCifsShares,
  createGetCifsShareToolDefinition,
  handleGetCifsShare,
  createCreateCifsShareToolDefinition,
  handleCreateCifsShare,
  createUpdateCifsShareToolDefinition,
  handleUpdateCifsShare,
  createDeleteCifsShareToolDefinition,
  handleDeleteCifsShare,
  createClusterListCifsSharesToolDefinition,
  handleClusterListCifsShares,
  createClusterCreateCifsShareToolDefinition,
  handleClusterCreateCifsShare,
  createClusterDeleteCifsShareToolDefinition,
  handleClusterDeleteCifsShare
} from "../tools/cifs-share-tools.js";

import {
  createClusterListVolumesToolDefinition as createClusterListVolumesVolumeToolDefinition,
  handleClusterListVolumes as handleClusterListVolumesVolumeTool,
  createClusterCreateVolumeToolDefinition,
  handleClusterCreateVolume,
  createClusterDeleteVolumeToolDefinition,
  handleClusterDeleteVolume,
  createClusterGetVolumeStatsToolDefinition,
  handleClusterGetVolumeStats,
  
  createGetVolumeConfigurationToolDefinition,
  handleGetVolumeConfiguration,
  createUpdateVolumeSecurityStyleToolDefinition,
  handleUpdateVolumeSecurityStyle,
  createResizeVolumeToolDefinition,
  handleResizeVolume,
  createUpdateVolumeCommentToolDefinition,
  handleUpdateVolumeComment,
  
  // Comprehensive volume update tools
  createUpdateVolumeToolDefinition,
  handleUpdateVolume,
  createClusterUpdateVolumeToolDefinition,
  handleClusterUpdateVolume,
  
  createConfigureVolumeNfsAccessToolDefinition,
  handleConfigureVolumeNfsAccess,
  createDisableVolumeNfsAccessToolDefinition,
  handleDisableVolumeNfsAccess
} from "../tools/volume-tools.js";

import {
  createListSnapshotSchedulesToolDefinition,
  handleListSnapshotSchedules,
  createGetSnapshotScheduleToolDefinition,
  handleGetSnapshotSchedule,
  createCreateSnapshotScheduleToolDefinition,
  handleCreateSnapshotSchedule,
  createUpdateSnapshotScheduleToolDefinition,
  handleUpdateSnapshotSchedule,
  createDeleteSnapshotScheduleToolDefinition,
  handleDeleteSnapshotSchedule
} from "../tools/snapshot-schedule-tools.js";

import {
  createClusterListQosPoliciesToolDefinition,
  handleClusterListQosPolicies,
  createClusterCreateQosPolicyToolDefinition,
  handleClusterCreateQosPolicy,
  createClusterGetQosPolicyToolDefinition,
  handleClusterGetQosPolicy,
  createClusterUpdateQosPolicyToolDefinition,
  handleClusterUpdateQosPolicy,
  createClusterDeleteQosPolicyToolDefinition,
  handleClusterDeleteQosPolicy
} from "../tools/qos-policy-tools.js";

import {
  handleClusterEnableVolumeAutosize,
  handleClusterGetVolumeAutosizeStatus,
  createClusterEnableVolumeAutosizeToolDefinition,
  createClusterGetVolumeAutosizeStatusToolDefinition
} from "../tools/volume-autosize-tools.js";

import {
  handleClusterListVolumeSnapshots,
  handleClusterGetVolumeSnapshotInfo,
  handleClusterDeleteVolumeSnapshot,
  createClusterListVolumeSnapshotsToolDefinition,
  createClusterGetVolumeSnapshotInfoToolDefinition,
  createClusterDeleteVolumeSnapshotToolDefinition
} from "../tools/volume-snapshot-tools.js";

/**
 * Register all tools in the central registry
 * This function is called once at startup to populate the registry
 */
export function registerAllTools(): void {
  // Multi-cluster management tools
  registerTool({
    name: "add_cluster",
    category: ToolCategory.CLUSTER_MANAGEMENT,
    definition: createAddClusterToolDefinition,
    handler: handleAddCluster
  });

  registerTool({
    name: "list_registered_clusters",
    category: ToolCategory.CLUSTER_MANAGEMENT,
    definition: createListRegisteredClustersToolDefinition,
    handler: handleListRegisteredClusters
  });

  registerTool({
    name: "get_all_clusters_info",
    category: ToolCategory.CLUSTER_MANAGEMENT,
    definition: createGetAllClustersInfoToolDefinition,
    handler: handleGetAllClustersInfo
  });

  registerTool({
    name: "cluster_list_svms",
    category: ToolCategory.CLUSTER_MANAGEMENT,
    definition: createClusterListSvmsToolDefinition,
    handler: handleClusterListSvms
  });

  registerTool({
    name: "cluster_list_aggregates",
    category: ToolCategory.CLUSTER_MANAGEMENT,
    definition: createClusterListAggregatesToolDefinition,
    handler: handleClusterListAggregates
  });

  registerTool({
    name: "cluster_list_volumes",
    category: ToolCategory.CLUSTER_MANAGEMENT,
    definition: createClusterListVolumesToolDefinition,
    handler: handleClusterListVolumes
  });

  registerTool({
    name: "cluster_create_volume",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createClusterCreateVolumeToolDefinition,
    handler: handleClusterCreateVolume
  });

  registerTool({
    name: "cluster_delete_volume",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createClusterDeleteVolumeToolDefinition,
    handler: handleClusterDeleteVolume
  });

  registerTool({
    name: "cluster_get_volume_stats",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createClusterGetVolumeStatsToolDefinition,
    handler: handleClusterGetVolumeStats
  });

  // Volume configuration tools
  registerTool({
    name: "get_volume_configuration",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createGetVolumeConfigurationToolDefinition,
    handler: handleGetVolumeConfiguration
  });

  registerTool({
    name: "update_volume_security_style",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createUpdateVolumeSecurityStyleToolDefinition,
    handler: handleUpdateVolumeSecurityStyle
  });

  registerTool({
    name: "resize_volume",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createResizeVolumeToolDefinition,
    handler: handleResizeVolume
  });

  registerTool({
    name: "update_volume_comment",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createUpdateVolumeCommentToolDefinition,
    handler: handleUpdateVolumeComment
  });

  // Comprehensive volume update tools
  registerTool({
    name: "update_volume",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createUpdateVolumeToolDefinition,
    handler: handleUpdateVolume
  });

  registerTool({
    name: "cluster_update_volume",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createClusterUpdateVolumeToolDefinition,
    handler: handleClusterUpdateVolume
  });

  // Volume NFS access tools
  registerTool({
    name: "configure_volume_nfs_access",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createConfigureVolumeNfsAccessToolDefinition,
    handler: handleConfigureVolumeNfsAccess
  });

  registerTool({
    name: "disable_volume_nfs_access",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createDisableVolumeNfsAccessToolDefinition,
    handler: handleDisableVolumeNfsAccess
  });

  // Snapshot policy tools
  registerTool({
    name: "list_snapshot_policies",
    category: ToolCategory.SNAPSHOT_POLICIES,
    definition: createListSnapshotPoliciesToolDefinition,
    handler: handleListSnapshotPolicies
  });

  registerTool({
    name: "get_snapshot_policy",
    category: ToolCategory.SNAPSHOT_POLICIES,
    definition: createGetSnapshotPolicyToolDefinition,
    handler: handleGetSnapshotPolicy
  });

  registerTool({
    name: "create_snapshot_policy",
    category: ToolCategory.SNAPSHOT_POLICIES,
    definition: createCreateSnapshotPolicyToolDefinition,
    handler: handleCreateSnapshotPolicy
  });

  registerTool({
    name: "delete_snapshot_policy",
    category: ToolCategory.SNAPSHOT_POLICIES,
    definition: createDeleteSnapshotPolicyToolDefinition,
    handler: handleDeleteSnapshotPolicy
  });

  // Export policy tools
  registerTool({
    name: "list_export_policies",
    category: ToolCategory.EXPORT_POLICIES,
    definition: createListExportPoliciesToolDefinition,
    handler: handleListExportPolicies
  });

  registerTool({
    name: "get_export_policy",
    category: ToolCategory.EXPORT_POLICIES,
    definition: createGetExportPolicyToolDefinition,
    handler: handleGetExportPolicy
  });

  registerTool({
    name: "create_export_policy",
    category: ToolCategory.EXPORT_POLICIES,
    definition: createCreateExportPolicyToolDefinition,
    handler: handleCreateExportPolicy
  });

  registerTool({
    name: "delete_export_policy",
    category: ToolCategory.EXPORT_POLICIES,
    definition: createDeleteExportPolicyToolDefinition,
    handler: handleDeleteExportPolicy
  });

  registerTool({
    name: "add_export_rule",
    category: ToolCategory.EXPORT_POLICIES,
    definition: createAddExportRuleToolDefinition,
    handler: handleAddExportRule
  });

  registerTool({
    name: "update_export_rule",
    category: ToolCategory.EXPORT_POLICIES,
    definition: createUpdateExportRuleToolDefinition,
    handler: handleUpdateExportRule
  });

  registerTool({
    name: "delete_export_rule",
    category: ToolCategory.EXPORT_POLICIES,
    definition: createDeleteExportRuleToolDefinition,
    handler: handleDeleteExportRule
  });

  // CIFS share tools
  registerTool({
    name: "list_cifs_shares",
    category: ToolCategory.CIFS_SHARES,
    definition: createListCifsSharesToolDefinition,
    handler: handleListCifsShares
  });

  registerTool({
    name: "get_cifs_share",
    category: ToolCategory.CIFS_SHARES,
    definition: createGetCifsShareToolDefinition,
    handler: handleGetCifsShare
  });

  registerTool({
    name: "create_cifs_share",
    category: ToolCategory.CIFS_SHARES,
    definition: createCreateCifsShareToolDefinition,
    handler: handleCreateCifsShare
  });

  registerTool({
    name: "update_cifs_share",
    category: ToolCategory.CIFS_SHARES,
    definition: createUpdateCifsShareToolDefinition,
    handler: handleUpdateCifsShare
  });

  registerTool({
    name: "delete_cifs_share",
    category: ToolCategory.CIFS_SHARES,
    definition: createDeleteCifsShareToolDefinition,
    handler: handleDeleteCifsShare
  });

  registerTool({
    name: "cluster_list_cifs_shares",
    category: ToolCategory.CIFS_SHARES,
    definition: createClusterListCifsSharesToolDefinition,
    handler: handleClusterListCifsShares
  });

  registerTool({
    name: "cluster_create_cifs_share",
    category: ToolCategory.CIFS_SHARES,
    definition: createClusterCreateCifsShareToolDefinition,
    handler: handleClusterCreateCifsShare
  });

  registerTool({
    name: "cluster_delete_cifs_share",
    category: ToolCategory.CIFS_SHARES,
    definition: createClusterDeleteCifsShareToolDefinition,
    handler: handleClusterDeleteCifsShare
  });

  // Snapshot schedule tools
  registerTool({
    name: "list_snapshot_schedules",
    category: ToolCategory.SNAPSHOT_SCHEDULES,
    definition: createListSnapshotSchedulesToolDefinition,
    handler: handleListSnapshotSchedules
  });

  registerTool({
    name: "get_snapshot_schedule",
    category: ToolCategory.SNAPSHOT_SCHEDULES,
    definition: createGetSnapshotScheduleToolDefinition,
    handler: handleGetSnapshotSchedule
  });

  registerTool({
    name: "create_snapshot_schedule",
    category: ToolCategory.SNAPSHOT_SCHEDULES,
    definition: createCreateSnapshotScheduleToolDefinition,
    handler: handleCreateSnapshotSchedule
  });

  registerTool({
    name: "update_snapshot_schedule",
    category: ToolCategory.SNAPSHOT_SCHEDULES,
    definition: createUpdateSnapshotScheduleToolDefinition,
    handler: handleUpdateSnapshotSchedule
  });

  registerTool({
    name: "delete_snapshot_schedule",
    category: ToolCategory.SNAPSHOT_SCHEDULES,
    definition: createDeleteSnapshotScheduleToolDefinition,
    handler: handleDeleteSnapshotSchedule
  });

  // QoS policy tools
  registerTool({
    name: "cluster_list_qos_policies",
    category: ToolCategory.QOS_POLICIES,
    definition: createClusterListQosPoliciesToolDefinition,
    handler: handleClusterListQosPolicies
  });

  registerTool({
    name: "cluster_create_qos_policy",
    category: ToolCategory.QOS_POLICIES,
    definition: createClusterCreateQosPolicyToolDefinition,
    handler: handleClusterCreateQosPolicy
  });

  registerTool({
    name: "cluster_get_qos_policy",
    category: ToolCategory.QOS_POLICIES,
    definition: createClusterGetQosPolicyToolDefinition,
    handler: handleClusterGetQosPolicy
  });

  registerTool({
    name: "cluster_update_qos_policy",
    category: ToolCategory.QOS_POLICIES,
    definition: createClusterUpdateQosPolicyToolDefinition,
    handler: handleClusterUpdateQosPolicy
  });

  registerTool({
    name: "cluster_delete_qos_policy",
    category: ToolCategory.QOS_POLICIES,
    definition: createClusterDeleteQosPolicyToolDefinition,
    handler: handleClusterDeleteQosPolicy
  });

  // Volume Autosize Tools
  registerTool({
    name: "cluster_enable_volume_autosize",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createClusterEnableVolumeAutosizeToolDefinition,
    handler: handleClusterEnableVolumeAutosize
  });

  registerTool({
    name: "cluster_get_volume_autosize_status",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createClusterGetVolumeAutosizeStatusToolDefinition,
    handler: handleClusterGetVolumeAutosizeStatus
  });

  // Volume Snapshot Management Tools
  registerTool({
    name: "cluster_list_volume_snapshots",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createClusterListVolumeSnapshotsToolDefinition,
    handler: handleClusterListVolumeSnapshots
  });

  registerTool({
    name: "cluster_get_volume_snapshot_info",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createClusterGetVolumeSnapshotInfoToolDefinition,
    handler: handleClusterGetVolumeSnapshotInfo
  });

  registerTool({
    name: "cluster_delete_volume_snapshot",
    category: ToolCategory.VOLUME_MANAGEMENT,
    definition: createClusterDeleteVolumeSnapshotToolDefinition,
    handler: handleClusterDeleteVolumeSnapshot
  });
}