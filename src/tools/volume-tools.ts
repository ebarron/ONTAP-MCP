/**
 * NetApp ONTAP MCP Volume Management Tools
 * 
 * This module provides comprehensive volume management functionality including:
 * - Volume lifecycle management (create, list, get stats, offline, delete)
 * - Volume configuration and updates (security style, resize, comments)
 * - Volume NFS access control (configure/disable export policies)
 * - Both single-cluster and multi-cluster operations
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OntapApiClient, OntapClusterManager } from '../ontap-client.js';
import type { 
  VolumeInfo, 
  VolumeStats, 
  CreateVolumeParams, 
  CreateVolumeResponse,
  UpdateVolumeParams,
  VolumeSecurityStyle,
  ResizeVolumeParams,
  UpdateVolumeCommentParams,
  UpdateVolumeSecurityStyleParams,
  VolumeNfsConfig,
  VolumeConfigurationResult,
  VolumeConfigurationData
} from '../types/volume-types.js';

// ================================
// Zod Schemas for Input Validation
// ================================

// CIFS share configuration schema
const CifsShareConfigSchema = z.object({
  share_name: z.string().describe("CIFS share name"),
  comment: z.string().optional().describe("Optional share comment"),
  properties: z.object({
    access_based_enumeration: z.boolean().optional().describe("Enable access-based enumeration"),
    encryption: z.boolean().optional().describe("Enable encryption"),
    offline_files: z.enum(['none', 'manual', 'documents', 'programs']).optional().describe("Offline files policy"),
    oplocks: z.boolean().optional().describe("Oplocks")
  }).optional().describe("Share properties"),
  access_control: z.array(z.object({
    permission: z.enum(['no_access', 'read', 'change', 'full_control']).describe("Permission level"),
    user_or_group: z.string().describe("User or group name"),
    type: z.enum(['windows', 'unix_user', 'unix_group']).optional().describe("Type of user/group")
  })).optional().describe("Access control entries")
});

// Legacy single-cluster schemas
const ListVolumesSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  svm_name: z.string().describe("Optional: Filter volumes by SVM name").optional(),
});

const CreateVolumeSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  svm_name: z.string().describe("Name of the SVM where the volume will be created"),
  volume_name: z.string().describe("Name of the new volume"),
  size: z.string().describe("Size of the volume (e.g., '100GB', '1TB')"),
  aggregate_name: z.string().describe("Optional: Name of the aggregate to use").optional(),
  qos_policy: z.string().describe("Optional: QoS policy name (can be from volume's SVM or admin SVM)").optional(),
  cifs_share: CifsShareConfigSchema.optional().describe("Optional CIFS share configuration")
});

const GetVolumeStatsSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  volume_uuid: z.string().describe("UUID of the volume to get statistics for"),
});

const OfflineVolumeSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  volume_uuid: z.string().describe("UUID of the volume to take offline"),
});

const DeleteVolumeSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  volume_uuid: z.string().describe("UUID of the volume to delete"),
});

// Multi-cluster schemas
const ClusterListVolumesSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  svm_name: z.string().describe("Optional: Filter volumes by SVM name").optional(),
});

const ClusterCreateVolumeSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  svm_name: z.string().describe("Name of the SVM where the volume will be created"),
  volume_name: z.string().describe("Name of the new volume"),
  size: z.string().describe("Size of the volume (e.g., '100GB', '1TB')"),
  aggregate_name: z.string().describe("Optional: Name of the aggregate to use").optional(),
  qos_policy: z.string().describe("Optional: QoS policy name (can be from volume's SVM or admin SVM)").optional(),
  cifs_share: CifsShareConfigSchema.optional().describe("Optional CIFS share configuration")
});

const ClusterVolumeUuidSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  volume_uuid: z.string().describe("UUID of the volume"),
});

// Volume configuration and update schemas  
const GetVolumeConfigurationSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  volume_uuid: z.string().describe("UUID of the volume")
});

const UpdateVolumeSecurityStyleSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  volume_uuid: z.string().describe("UUID of the volume"),
  security_style: z.enum(['unix', 'ntfs', 'mixed', 'unified']).describe("New security style for the volume")
});

const ResizeVolumeSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  volume_uuid: z.string().describe("UUID of the volume"),
  new_size: z.string().describe("New size for the volume (e.g., '500GB', '2TB')")
});

const UpdateVolumeCommentSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  volume_uuid: z.string().describe("UUID of the volume"),
  comment: z.string().describe("New comment/description for the volume").optional()
});

// Comprehensive volume update schemas (legacy single-cluster)
const UpdateVolumeSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  volume_uuid: z.string().describe("UUID of the volume to update"),
  size: z.string().describe("New size (e.g., '500GB', '2TB') - can only increase").optional(),
  comment: z.string().describe("New comment/description").optional(),
  security_style: z.enum(['unix', 'ntfs', 'mixed', 'unified']).describe("New security style").optional(),
  state: z.enum(['online', 'offline', 'restricted']).describe("Volume state: 'online' for normal access, 'offline' to make inaccessible (required before deletion), 'restricted' for admin-only access").optional(),
  qos_policy: z.string().describe("New QoS policy name (can be from volume's SVM or admin SVM, empty string to remove)").optional(),
  snapshot_policy: z.string().describe("New snapshot policy name").optional(),
  nfs_export_policy: z.string().describe("New NFS export policy name").optional()
});

// Comprehensive volume update schemas (multi-cluster)
const ClusterUpdateVolumeSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  volume_uuid: z.string().describe("UUID of the volume to update"),
  size: z.string().describe("New size (e.g., '500GB', '2TB') - can only increase").optional(),
  comment: z.string().describe("New comment/description").optional(),
  security_style: z.enum(['unix', 'ntfs', 'mixed', 'unified']).describe("New security style").optional(),
  state: z.enum(['online', 'offline', 'restricted']).describe("Volume state: 'online' for normal access, 'offline' to make inaccessible (required before deletion), 'restricted' for admin-only access").optional(),
  qos_policy: z.string().describe("New QoS policy name (can be from volume's SVM or admin SVM, empty string to remove)").optional(),
  snapshot_policy: z.string().describe("New snapshot policy name").optional(),
  nfs_export_policy: z.string().describe("New NFS export policy name").optional()
});

const ConfigureVolumeNfsAccessSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  volume_uuid: z.string().describe("UUID of the volume"),
  export_policy_name: z.string().describe("Name of the export policy to apply")
});

const DisableVolumeNfsAccessSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  volume_uuid: z.string().describe("UUID of the volume")
});

// ================================
// Helper Functions
// ================================

/**
 * Get API client from either cluster credentials or cluster registry
 */
function getApiClient(
  clusterManager: OntapClusterManager,
  clusterName?: string,
  clusterIp?: string,
  username?: string,
  password?: string
): OntapApiClient {
  if (clusterName) {
    return clusterManager.getClient(clusterName);
  } else if (clusterIp && username && password) {
    return new OntapApiClient(clusterIp, username, password);
  } else {
    throw new Error("Either cluster_name or (cluster_ip, username, password) must be provided");
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format volume configuration for display
 */
function formatVolumeConfig(volume: any): string {
  let result = `💾 **Volume: ${volume.name}** (${volume.uuid})\\n\\n`;
  result += `🏢 **SVM:** ${volume.svm?.name}\\n`;
  result += `📊 **Size:** ${formatBytes(volume.size)}\\n`;
  result += `📁 **Aggregate:** ${volume.aggregates?.[0]?.name || 'Unknown'}\\n`;
  result += `🔒 **Security Style:** ${volume.nas?.security_style || 'Unknown'}\\n`;
  result += `📈 **State:** ${volume.state}\\n`;
  if (volume.comment) result += `💬 **Comment:** ${volume.comment}\\n`;

  // Snapshot policy
  if (volume.snapshot_policy?.name) {
    result += `\\n📸 **Snapshot Policy:** ${volume.snapshot_policy.name}\\n`;
  } else {
    result += `\\n📸 **Snapshot Policy:** None (default)\\n`;
  }

  // Export policy
  if (volume.nas?.export_policy?.name) {
    result += `🔐 **Export Policy:** ${volume.nas.export_policy.name}\\n`;
  } else {
    result += `🔐 **Export Policy:** default\\n`;
  }

  // Volume efficiency
  if (volume.efficiency?.compression) {
    result += `\\n🗜️ **Compression:** ${volume.efficiency.compression}\\n`;
  }
  if (volume.efficiency?.dedupe) {
    result += `📦 **Deduplication:** ${volume.efficiency.dedupe}\\n`;
  }

  // Autosize configuration
  if (volume.autosize) {
    result += `\\n📏 **Autosize Configuration:**\\n`;
    result += `   • Mode: ${volume.autosize.mode || 'off'}\\n`;
    if (volume.autosize.maximum) {
      result += `   • Maximum Size: ${formatBytes(volume.autosize.maximum)}\\n`;
    }
    if (volume.autosize.minimum) {
      result += `   • Minimum Size: ${formatBytes(volume.autosize.minimum)}\\n`;
    }
    if (volume.autosize.grow_threshold) {
      result += `   • Grow Threshold: ${volume.autosize.grow_threshold}%\\n`;
    }
    if (volume.autosize.shrink_threshold) {
      result += `   • Shrink Threshold: ${volume.autosize.shrink_threshold}%\\n`;
    }
  } else {
    result += `\\n📏 **Autosize:** Disabled\\n`;
  }

  return result;
}

/**
 * Format volume statistics for display
 */
function formatVolumeStats(stats: VolumeStats): string {
  let result = `📊 **Volume Performance Statistics**\\n\\n`;
  result += `🔗 **Volume UUID:** ${stats.uuid}\\n\\n`;
  
  if (stats.iops) {
    result += `⚡ **IOPS:**\\n`;
    result += `   • Read: ${stats.iops.read}\\n`;
    result += `   • Write: ${stats.iops.write}\\n`;
    result += `   • Other: ${stats.iops.other}\\n`;
    result += `   • Total: ${stats.iops.total}\\n\\n`;
  }
  
  if (stats.throughput) {
    result += `📈 **Throughput (bytes/sec):**\\n`;
    result += `   • Read: ${formatBytes(stats.throughput.read)}/s\\n`;
    result += `   • Write: ${formatBytes(stats.throughput.write)}/s\\n`;
    result += `   • Other: ${formatBytes(stats.throughput.other)}/s\\n`;
    result += `   • Total: ${formatBytes(stats.throughput.total)}/s\\n\\n`;
  }
  
  if (stats.latency) {
    result += `⏱️ **Latency (microseconds):**\\n`;
    result += `   • Read: ${stats.latency.read}μs\\n`;
    result += `   • Write: ${stats.latency.write}μs\\n`;
    result += `   • Other: ${stats.latency.other}μs\\n`;
    result += `   • Total: ${stats.latency.total}μs\\n\\n`;
  }
  
  if (stats.space) {
    result += `💿 **Space Usage:**\\n`;
    result += `   • Used: ${formatBytes(stats.space.used)}\\n`;
    result += `   • Available: ${formatBytes(stats.space.available)}\\n`;
    result += `   • Total: ${formatBytes(stats.space.total)}\\n`;
    const utilization = ((stats.space.used / stats.space.total) * 100).toFixed(1);
    result += `   • Utilization: ${utilization}%\\n`;
  }
  
  return result;
}

// ================================
// Legacy Single-Cluster Volume Tools
// ================================

export function createListVolumesToolDefinition(): Tool {
  return {
    name: "list_volumes",
    description: "List all volumes in the cluster or a specific SVM",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        svm_name: { type: "string", description: "Optional: Filter volumes by SVM name" },
      },
      required: ["cluster_ip", "username", "password"],
    },
  };
}

export async function handleListVolumes(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = ListVolumesSchema.parse(args);
  const client = new OntapApiClient(params.cluster_ip, params.username, params.password);
  
      const volumes = await client.listVolumes(params.svm_name);
    
    if (volumes.length === 0) {
      return params.svm_name 
        ? `No volumes found in SVM "${params.svm_name}"`
        : "No volumes found in cluster";
    }
    
    let result = `📚 **Volumes on cluster ${params.cluster_ip}**\\n`;
    if (params.svm_name) {
      result += `🏢 **SVM Filter:** ${params.svm_name}\\n`;
    }
    result += `\\n📊 **Found ${volumes.length} volume(s):**\\n\\n`;
    
    volumes.forEach((volume, index) => {
      result += `${index + 1}. **${volume.name}**\\n`;
      result += `   • UUID: ${volume.uuid}\\n`;
      result += `   • SVM: ${volume.svm?.name}\\n`;
      result += `   • Size: ${formatBytes(volume.size)}\\n`;
      result += `   • State: ${volume.state}\\n`;
      if (volume.comment) {
        result += `   • Comment: ${volume.comment}\\n`;
      }
      result += `\\n`;
    });
    
    return result;

}

export function createCreateVolumeToolDefinition(): Tool {
  return {
    name: "create_volume",
    description: "Create a new volume in the specified SVM with optional CIFS share configuration",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        svm_name: { type: "string", description: "Name of the SVM where the volume will be created" },
        volume_name: { type: "string", description: "Name of the new volume" },
        size: { type: "string", description: "Size of the volume (e.g., '100GB', '1TB')" },
        aggregate_name: { type: "string", description: "Optional: Name of the aggregate to use" },
        cifs_share: {
          type: "object",
          properties: {
            share_name: { type: "string", description: "CIFS share name" },
            comment: { type: "string", description: "Optional share comment" },
            properties: {
              type: "object",
              properties: {
                access_based_enumeration: { type: "boolean", description: "Enable access-based enumeration" },
                encryption: { type: "boolean", description: "Enable encryption" },
                offline_files: { type: "string", enum: ["none", "manual", "documents", "programs"], description: "Offline files policy" },
                oplocks: { type: "boolean", description: "Oplocks" }
              },
              description: "Share properties"
            },
            access_control: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  permission: { type: "string", enum: ["no_access", "read", "change", "full_control"], description: "Permission level" },
                  user_or_group: { type: "string", description: "User or group name" },
                  type: { type: "string", enum: ["windows", "unix_user", "unix_group"], description: "Type of user/group" }
                },
                required: ["permission", "user_or_group"]
              },
              description: "Access control entries"
            }
          },
          required: ["share_name"],
          description: "Optional CIFS share configuration"
        }
      },
      required: ["cluster_ip", "username", "password", "svm_name", "volume_name", "size"],
    },
  };
}

export async function handleCreateVolume(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = CreateVolumeSchema.parse(args);
  const client = new OntapApiClient(params.cluster_ip, params.username, params.password);
  
  const createParams: CreateVolumeParams = {
    svm_name: params.svm_name,
    volume_name: params.volume_name,
    size: params.size,
    aggregate_name: params.aggregate_name,
    qos_policy: params.qos_policy,
    cifs_share: params.cifs_share
  };
  
  const result = await client.createVolume(createParams);
  
  let response = `✅ **Volume created successfully!**\n\n` +
         `📦 **Volume Name:** ${params.volume_name}\n` +
         `🆔 **UUID:** ${result.uuid}\n` +
         `🏢 **SVM:** ${params.svm_name}\n` +
         `📊 **Size:** ${params.size}\n` +
         `${params.aggregate_name ? `📁 **Aggregate:** ${params.aggregate_name}\n` : ''}` +
         `${params.qos_policy ? `🎯 **QoS Policy:** ${params.qos_policy}\n` : ''}` +
         `${result.job ? `🔄 **Job UUID:** ${result.job.uuid}\n` : ''}`;
  
  // Add CIFS share information if configured
  if (params.cifs_share) {
    response += `\n📁 **CIFS Share:** ${params.cifs_share.share_name}\n`;
    response += `   Path: /vol/${params.volume_name}\n`;
    if (params.cifs_share.comment) {
      response += `   Comment: ${params.cifs_share.comment}\n`;
    }
    if (params.cifs_share.access_control && params.cifs_share.access_control.length > 0) {
      response += `   Access Control:\n`;
      params.cifs_share.access_control.forEach(ace => {
        response += `   - ${ace.user_or_group}: ${ace.permission}\n`;
      });
    }
    response += `   📋 **Share Status:** Available for client access`;
  }
  
  return response;
}

export function createGetVolumeStatsToolDefinition(): Tool {
  return {
    name: "get_volume_stats",
    description: "Get performance statistics for a specific volume",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        volume_uuid: { type: "string", description: "UUID of the volume to get statistics for" },
      },
      required: ["cluster_ip", "username", "password", "volume_uuid"],
    },
  };
}

export async function handleGetVolumeStats(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = GetVolumeStatsSchema.parse(args);
  const client = new OntapApiClient(params.cluster_ip, params.username, params.password);
  
      const stats = await client.getVolumeStats(params.volume_uuid);
    
    return formatVolumeStats(stats);

}

export function createOfflineVolumeToolDefinition(): Tool {
  return {
    name: "offline_volume",
    description: "Take a volume offline (required before deletion). WARNING: This will make the volume inaccessible.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        volume_uuid: { type: "string", description: "UUID of the volume to take offline" },
      },
      required: ["cluster_ip", "username", "password", "volume_uuid"],
    },
  };
}

export async function handleOfflineVolume(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = OfflineVolumeSchema.parse(args);
  const client = new OntapApiClient(params.cluster_ip, params.username, params.password);
  
      await client.offlineVolume(params.volume_uuid);
    
    return `⚠️ **Volume taken offline successfully**\\n\\n` +
           `🆔 **Volume UUID:** ${params.volume_uuid}\\n` +
           `📴 **Status:** Offline\\n\\n` +
           `⚠️ **Warning:** The volume is now inaccessible. You can now safely delete it if needed.`;

}

export function createDeleteVolumeToolDefinition(): Tool {
  return {
    name: "delete_volume",
    description: "Delete a volume (must be offline first). WARNING: This action is irreversible and will permanently destroy all data.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        volume_uuid: { type: "string", description: "UUID of the volume to delete" },
      },
      required: ["cluster_ip", "username", "password", "volume_uuid"],
    },
  };
}

export async function handleDeleteVolume(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = DeleteVolumeSchema.parse(args);
  const client = new OntapApiClient(params.cluster_ip, params.username, params.password);
  
  await client.deleteVolume(params.volume_uuid);
  
  return `✅ **Volume deleted successfully**\\n\\n` +
         `🆔 **Volume UUID:** ${params.volume_uuid}\\n` +
         `🗑️ **Status:** Permanently deleted\\n\\n` +
         `⚠️ **Note:** This action was irreversible. All data has been permanently destroyed.`;
}

// ================================
// Multi-Cluster Volume Tools
// ================================

export function createClusterListVolumesToolDefinition(): Tool {
  return {
    name: "cluster_list_volumes",
    description: "List volumes from a registered cluster by cluster name",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        svm_name: { type: "string", description: "Optional: Filter volumes by SVM name" },
      },
      required: ["cluster_name"],
    },
  };
}

export async function handleClusterListVolumes(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = ClusterListVolumesSchema.parse(args);
  
      const client = clusterManager.getClient(params.cluster_name);
    const volumes = await client.listVolumes(params.svm_name);
    
    if (volumes.length === 0) {
      return params.svm_name 
        ? `No volumes found in SVM "${params.svm_name}" on cluster "${params.cluster_name}"`
        : `No volumes found on cluster "${params.cluster_name}"`;
    }
    
    let result = `📚 **Volumes on cluster ${params.cluster_name}**\\n`;
    if (params.svm_name) {
      result += `🏢 **SVM Filter:** ${params.svm_name}\\n`;
    }
    result += `\\n📊 **Found ${volumes.length} volume(s):**\\n\\n`;
    
    volumes.forEach((volume, index) => {
      result += `${index + 1}. **${volume.name}**\\n`;
      result += `   • UUID: ${volume.uuid}\\n`;
      result += `   • SVM: ${volume.svm?.name}\\n`;
      result += `   • Size: ${formatBytes(volume.size)}\\n`;
      result += `   • State: ${volume.state}\\n`;
      if (volume.comment) {
        result += `   • Comment: ${volume.comment}\\n`;
      }
      result += `\\n`;
    });
    
    return result;

}

export function createClusterCreateVolumeToolDefinition(): Tool {
  return {
    name: "cluster_create_volume",
    description: "Create a volume on a registered cluster by cluster name with optional CIFS share configuration",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        svm_name: { type: "string", description: "Name of the SVM where the volume will be created" },
        volume_name: { type: "string", description: "Name of the new volume" },
        size: { type: "string", description: "Size of the volume (e.g., '100GB', '1TB')" },
        aggregate_name: { type: "string", description: "Optional: Name of the aggregate to use" },
        cifs_share: {
          type: "object",
          properties: {
            share_name: { type: "string", description: "CIFS share name" },
            comment: { type: "string", description: "Optional share comment" },
            properties: {
              type: "object",
              properties: {
                access_based_enumeration: { type: "boolean", description: "Enable access-based enumeration" },
                encryption: { type: "boolean", description: "Enable encryption" },
                offline_files: { type: "string", enum: ["none", "manual", "documents", "programs"], description: "Offline files policy" },
                oplocks: { type: "boolean", description: "Oplocks" }
              },
              description: "Share properties"
            },
            access_control: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  permission: { type: "string", enum: ["no_access", "read", "change", "full_control"], description: "Permission level" },
                  user_or_group: { type: "string", description: "User or group name" },
                  type: { type: "string", enum: ["windows", "unix_user", "unix_group"], description: "Type of user/group" }
                },
                required: ["permission", "user_or_group"]
              },
              description: "Access control entries"
            }
          },
          required: ["share_name"],
          description: "Optional CIFS share configuration"
        }
      },
      required: ["cluster_name", "svm_name", "volume_name", "size"],
    },
  };
}

export async function handleClusterCreateVolume(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = ClusterCreateVolumeSchema.parse(args);
  
  const client = clusterManager.getClient(params.cluster_name);
  
  const createParams: CreateVolumeParams = {
    svm_name: params.svm_name,
    volume_name: params.volume_name,
    size: params.size,
    aggregate_name: params.aggregate_name,
    qos_policy: params.qos_policy,
    cifs_share: params.cifs_share
  };
  
  const result = await client.createVolume(createParams);
  
  let response = `✅ **Volume created successfully!**\\n\\n` +
         `🎯 **Cluster:** ${params.cluster_name}\\n` +
         `📦 **Volume Name:** ${params.volume_name}\\n` +
         `🆔 **UUID:** ${result.uuid}\\n` +
         `🏢 **SVM:** ${params.svm_name}\\n` +
         `📊 **Size:** ${params.size}\\n` +
         `${params.aggregate_name ? `📁 **Aggregate:** ${params.aggregate_name}\\n` : ''}` +
         `${params.qos_policy ? `🎯 **QoS Policy:** ${params.qos_policy}\\n` : ''}` +
         `${result.job ? `🔄 **Job UUID:** ${result.job.uuid}\\n` : ''}`;
  
  // Add CIFS share information if configured
  if (params.cifs_share) {
    response += `\\n📁 **CIFS Share:** ${params.cifs_share.share_name}\\n`;
    response += `   Path: /vol/${params.volume_name}\\n`;
    if (params.cifs_share.comment) {
      response += `   Comment: ${params.cifs_share.comment}\\n`;
    }
    if (params.cifs_share.access_control && params.cifs_share.access_control.length > 0) {
      response += `   Access Control:\\n`;
      params.cifs_share.access_control.forEach(ace => {
        response += `   - ${ace.user_or_group}: ${ace.permission}\\n`;
      });
    }
    response += `   📋 **Share Status:** Available for client access`;
  }
  
  return response;
}

export function createClusterDeleteVolumeToolDefinition(): Tool {
  return {
    name: "cluster_delete_volume",
    description: "Delete a volume on a registered cluster by cluster name (must be offline first). WARNING: This action is irreversible and will permanently destroy all data.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume to delete" },
      },
      required: ["cluster_name", "volume_uuid"],
    },
  };
}

export async function handleClusterDeleteVolume(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = ClusterVolumeUuidSchema.parse(args);
  
  const client = clusterManager.getClient(params.cluster_name);
  await client.deleteVolume(params.volume_uuid);
  
  return `✅ **Volume deleted successfully**\\n\\n` +
         `🎯 **Cluster:** ${params.cluster_name}\\n` +
         `🆔 **Volume UUID:** ${params.volume_uuid}\\n` +
         `🗑️ **Status:** Permanently deleted\\n\\n` +
         `⚠️ **Note:** This action was irreversible. All data has been permanently destroyed.`;
}

export function createClusterGetVolumeStatsToolDefinition(): Tool {
  return {
    name: "cluster_get_volume_stats",
    description: "Get volume statistics from a registered cluster by cluster name",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume to get statistics for" },
      },
      required: ["cluster_name", "volume_uuid"],
    },
  };
}

export async function handleClusterGetVolumeStats(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = ClusterVolumeUuidSchema.parse(args);
  
      const client = clusterManager.getClient(params.cluster_name);
    const stats = await client.getVolumeStats(params.volume_uuid);
    
    let result = `🎯 **Cluster:** ${params.cluster_name}\\n\\n`;
    result += formatVolumeStats(stats);
    
    return result;

}

// ================================
// Volume Configuration and Update Tools
// ================================

export function createGetVolumeConfigurationToolDefinition(): Tool {
  return {
    name: "get_volume_configuration",
    description: "Get comprehensive configuration information for a volume including policies, security, and efficiency settings",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
      },
      required: ["volume_uuid"],
    },
  };
}

export async function handleGetVolumeConfiguration(args: any, clusterManager: OntapClusterManager): Promise<VolumeConfigurationResult> {
  const params = GetVolumeConfigurationSchema.parse(args);
  
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);
  
  // Get detailed volume information with all fields including autosize
  const endpoint = `/storage/volumes/${params.volume_uuid}?fields=uuid,name,size,state,type,comment,svm,aggregates,nas,snapshot_policy,efficiency,space,autosize,qos`;
  const volume = await (client as any).makeRequest(endpoint);
  
  // Build structured data with MCP parameter names
  const data: VolumeConfigurationData = {
    volume: {
      uuid: volume.uuid,
      name: volume.name,
      size: volume.size,
      state: volume.state,
      type: volume.type,
      comment: volume.comment || undefined
    },
    svm: {
      name: volume.svm?.name || '',
      uuid: volume.svm?.uuid || ''
    },
    aggregate: volume.aggregates && volume.aggregates.length > 0 ? {
      name: volume.aggregates[0].name,
      uuid: volume.aggregates[0].uuid
    } : undefined,
    autosize: {
      mode: volume.autosize?.mode || 'off',
      maximum_size: volume.autosize?.maximum,
      minimum_size: volume.autosize?.minimum,
      grow_threshold_percent: volume.autosize?.grow_threshold,
      shrink_threshold_percent: volume.autosize?.shrink_threshold
    },
    snapshot_policy: {
      name: volume.snapshot_policy?.name,
      uuid: volume.snapshot_policy?.uuid
    },
    qos: {
      policy_name: volume.qos?.policy?.name,
      policy_uuid: volume.qos?.policy?.uuid
    },
    nfs: {
      export_policy: volume.nas?.export_policy?.name,
      security_style: volume.nas?.security_style
    },
    space: volume.space ? {
      size: volume.space.size,
      available: volume.space.available,
      used: volume.space.used,
      used_percent: volume.space.used && volume.space.size ? 
        Math.round((volume.space.used / volume.space.size) * 100) : undefined
    } : undefined,
    efficiency: {
      compression: volume.efficiency?.compression,
      dedupe: volume.efficiency?.dedupe
    }
  };
  
  // Generate human-readable summary (for LLM consumption)
  const summary = formatVolumeConfig(volume);
  
  // Return hybrid format
  return {
    summary,
    data
  };
}

export function createUpdateVolumeSecurityStyleToolDefinition(): Tool {
  return {
    name: "update_volume_security_style",
    description: "Update the security style of a volume (unix, ntfs, mixed, unified)",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
        security_style: { type: "string", enum: ["unix", "ntfs", "mixed", "unified"], description: "New security style for the volume" },
      },
      required: ["volume_uuid", "security_style"],
    },
  };
}

export async function handleUpdateVolumeSecurityStyle(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = UpdateVolumeSecurityStyleSchema.parse(args);
  
      const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);
    await client.updateVolumeSecurityStyle(params.volume_uuid, params.security_style);
    
    return `✅ **Volume security style updated successfully**\\n\\n` +
           `🆔 **Volume UUID:** ${params.volume_uuid}\\n` +
           `🔒 **New Security Style:** ${params.security_style}\\n\\n` +
           `💡 **Note:** The security style change may affect how permissions are handled for this volume.`;

}

export function createResizeVolumeToolDefinition(): Tool {
  return {
    name: "resize_volume",
    description: "Resize a volume to a new size. Can only increase size (ONTAP doesn't support shrinking volumes with data)",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
        new_size: { type: "string", description: "New size for the volume (e.g., '500GB', '2TB')" },
      },
      required: ["volume_uuid", "new_size"],
    },
  };
}

export async function handleResizeVolume(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = ResizeVolumeSchema.parse(args);
  
      const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);
    await client.resizeVolume(params.volume_uuid, params.new_size);
    
    return `✅ **Volume resized successfully**\\n\\n` +
           `🆔 **Volume UUID:** ${params.volume_uuid}\\n` +
           `📊 **New Size:** ${params.new_size}\\n\\n` +
           `💡 **Note:** The volume has been expanded. ONTAP does not support shrinking volumes with data.`;

}

export function createUpdateVolumeCommentToolDefinition(): Tool {
  return {
    name: "update_volume_comment",
    description: "Update the comment/description field of a volume for better documentation",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
        comment: { type: "string", description: "New comment/description for the volume (or empty to clear)" },
      },
      required: ["volume_uuid"],
    },
  };
}

export async function handleUpdateVolumeComment(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = UpdateVolumeCommentSchema.parse(args);
  
      const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);
    const comment = params.comment || "";
    await client.updateVolumeComment(params.volume_uuid, comment);
    
    return `✅ **Volume comment updated successfully**\\n\\n` +
           `🆔 **Volume UUID:** ${params.volume_uuid}\\n` +
           `💬 **New Comment:** ${comment || "(cleared)"}\\n\\n` +
           `📝 **Note:** The volume description has been updated for better documentation.`;

}

// ================================
// Volume NFS Access Control Tools
// ================================

export function createConfigureVolumeNfsAccessToolDefinition(): Tool {
  return {
    name: "configure_volume_nfs_access",
    description: "Configure NFS access for a volume by applying an export policy",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
        export_policy_name: { type: "string", description: "Name of the export policy to apply" },
      },
      required: ["volume_uuid", "export_policy_name"],
    },
  };
}

export async function handleConfigureVolumeNfsAccess(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const params = ConfigureVolumeNfsAccessSchema.parse(args);
  
      const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);
    await client.configureVolumeNfsAccess(params.volume_uuid, params.export_policy_name);
    
    return `✅ **NFS access configured successfully**\n\n` +
           `🆔 **Volume UUID:** ${params.volume_uuid}\n` +
           `🔐 **Export Policy:** ${params.export_policy_name}\n\n` +
           `🌐 **Note:** The volume is now accessible via NFS according to the rules defined in the export policy.`;

}

export function createDisableVolumeNfsAccessToolDefinition(): Tool {
  return {
    name: "disable_volume_nfs_access",
    description: "Disable NFS access for a volume (reverts to default export policy)",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
      },
      required: ["volume_uuid"],
    },
  };
}

export async function handleDisableVolumeNfsAccess(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = DisableVolumeNfsAccessSchema.parse(args);
  
      const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);
    await client.disableVolumeNfsAccess(params.volume_uuid);
    
    return `✅ **NFS access disabled successfully**\\n\\n` +
           `🆔 **Volume UUID:** ${params.volume_uuid}\\n` +
           `🔐 **Export Policy:** default (restrictive)\\n\\n` +
           `⚠️ **Note:** The volume has been reverted to the default export policy, which may restrict NFS access.`;

}

// ================================
// Comprehensive Volume Update Tools
// ================================

export function createUpdateVolumeToolDefinition(): Tool {
  return {
    name: "update_volume",
    description: "Update multiple volume properties in a single operation including size, comment, security style, state, QoS policy, snapshot policy, and NFS export policy. QoS policies can be from the volume's SVM or admin SVM.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        volume_uuid: { type: "string", description: "UUID of the volume to update" },
        size: { type: "string", description: "New size (e.g., '500GB', '2TB') - can only increase" },
        comment: { type: "string", description: "New comment/description" },
        security_style: { type: "string", enum: ["unix", "ntfs", "mixed", "unified"], description: "New security style" },
        state: { type: "string", enum: ["online", "offline", "restricted"], description: "Volume state: 'online' for normal access, 'offline' to make inaccessible (required before deletion), 'restricted' for admin-only access" },
        qos_policy: { type: "string", description: "New QoS policy name (can be from volume's SVM or admin SVM, empty string to remove)" },
        snapshot_policy: { type: "string", description: "New snapshot policy name" },
        nfs_export_policy: { type: "string", description: "New NFS export policy name" }
      },
      required: ["cluster_ip", "username", "password", "volume_uuid"],
    },
  };
}

export async function handleUpdateVolume(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = UpdateVolumeSchema.parse(args);
  const client = new OntapApiClient(params.cluster_ip, params.username, params.password);
  
      const updateParams: UpdateVolumeParams = {
      volume_uuid: params.volume_uuid,
      size: params.size,
      comment: params.comment,
      security_style: params.security_style,
      state: params.state,
      qos_policy: params.qos_policy,
      snapshot_policy: params.snapshot_policy,
      nfs_export_policy: params.nfs_export_policy
    };
    
    await client.updateVolume(updateParams);
    
    let response = `✅ **Volume updated successfully!**\\n\\n` +
           `🆔 **Volume UUID:** ${params.volume_uuid}\\n\\n` +
           `🔄 **Updated Properties:**\\n`;
    
    if (params.size) response += `   📊 Size: ${params.size}\\n`;
    if (params.comment !== undefined) response += `   💬 Comment: ${params.comment || '(cleared)'}\\n`;
    if (params.security_style) response += `   🔒 Security Style: ${params.security_style}\\n`;
    if (params.state) {
      response += `   📈 State: ${params.state}\\n`;
      if (params.state === 'offline') {
        response += `\\n⚠️ **Warning:** The volume is now inaccessible. Required before deletion.\\n`;
      } else if (params.state === 'online') {
        response += `\\n✅ **Info:** The volume is now accessible.\\n`;
      } else if (params.state === 'restricted') {
        response += `\\n🔒 **Info:** The volume is in restricted mode (admin-only access).\\n`;
      }
    }
    if (params.qos_policy !== undefined) response += `   🎯 QoS Policy: ${params.qos_policy || '(removed)'}\\n`;
    if (params.snapshot_policy) response += `   📸 Snapshot Policy: ${params.snapshot_policy}\\n`;
    if (params.nfs_export_policy) response += `   🔐 Export Policy: ${params.nfs_export_policy}\\n`;
    
    response += `\\n💡 **Note:** All specified properties have been updated. QoS policies can be from the volume's SVM or admin SVM.`;
    
    return response;

}

export function createClusterUpdateVolumeToolDefinition(): Tool {
  return {
    name: "cluster_update_volume",
    description: "Update multiple volume properties on a registered cluster including size, comment, security style, state, QoS policy, snapshot policy, and NFS export policy. QoS policies can be from the volume's SVM or admin SVM.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume to update" },
        size: { type: "string", description: "New size (e.g., '500GB', '2TB') - can only increase" },
        comment: { type: "string", description: "New comment/description" },
        security_style: { type: "string", enum: ["unix", "ntfs", "mixed", "unified"], description: "New security style" },
        state: { type: "string", enum: ["online", "offline", "restricted"], description: "Volume state: 'online' for normal access, 'offline' to make inaccessible (required before deletion), 'restricted' for admin-only access" },
        qos_policy: { type: "string", description: "New QoS policy name (can be from volume's SVM or admin SVM, empty string to remove)" },
        snapshot_policy: { type: "string", description: "New snapshot policy name" },
        nfs_export_policy: { type: "string", description: "New NFS export policy name" }
      },
      required: ["cluster_name", "volume_uuid"],
    },
  };
}

export async function handleClusterUpdateVolume(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const params = ClusterUpdateVolumeSchema.parse(args);
  
      const client = clusterManager.getClient(params.cluster_name);
    
    const updateParams: UpdateVolumeParams = {
      volume_uuid: params.volume_uuid,
      size: params.size,
      comment: params.comment,
      security_style: params.security_style,
      state: params.state,
      qos_policy: params.qos_policy,
      snapshot_policy: params.snapshot_policy,
      nfs_export_policy: params.nfs_export_policy
    };
    
    await client.updateVolume(updateParams);
    
    let response = `✅ **Volume updated successfully!**\\n\\n` +
           `🎯 **Cluster:** ${params.cluster_name}\\n` +
           `🆔 **Volume UUID:** ${params.volume_uuid}\\n\\n` +
           `🔄 **Updated Properties:**\\n`;
    
    if (params.size) response += `   📊 Size: ${params.size}\\n`;
    if (params.comment !== undefined) response += `   💬 Comment: ${params.comment || '(cleared)'}\\n`;
    if (params.security_style) response += `   🔒 Security Style: ${params.security_style}\\n`;
    if (params.state) {
      response += `   📈 State: ${params.state}\\n`;
      if (params.state === 'offline') {
        response += `\\n⚠️ **Warning:** The volume is now inaccessible. Required before deletion.\\n`;
      } else if (params.state === 'online') {
        response += `\\n✅ **Info:** The volume is now accessible.\\n`;
      } else if (params.state === 'restricted') {
        response += `\\n🔒 **Info:** The volume is in restricted mode (admin-only access).\\n`;
      }
    }
    if (params.qos_policy !== undefined) response += `   🎯 QoS Policy: ${params.qos_policy || '(removed)'}\\n`;
    if (params.snapshot_policy) response += `   📸 Snapshot Policy: ${params.snapshot_policy}\\n`;
    if (params.nfs_export_policy) response += `   🔐 Export Policy: ${params.nfs_export_policy}\\n`;
    
    response += `\\n💡 **Note:** All specified properties have been updated. QoS policies can be from the volume's SVM or admin SVM.`;
    
    return response;

}