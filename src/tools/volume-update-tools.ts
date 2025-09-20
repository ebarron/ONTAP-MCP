/**
 * MCP Tools for updating existing volumes with snapshot policies and NFS export policies
 * These tools complement the volume creation and policy management tools
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OntapApiClient, OntapClusterManager } from '../ontap-client.js';

// ================================
// Zod Schemas for Input Validation
// ================================

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
 * Format volume configuration for display
 */
function formatVolumeConfig(volume: any): string {
  let result = `💾 **Volume: ${volume.name}** (${volume.uuid})\n\n`;
  result += `🏢 **SVM:** ${volume.svm?.name}\n`;
  result += `📊 **Size:** ${formatBytes(volume.size)}\n`;
  result += `📁 **Aggregate:** ${volume.aggregates?.[0]?.name || 'Unknown'}\n`;
  result += `🔒 **Security Style:** ${volume.nas?.security_style || 'Unknown'}\n`;
  result += `📈 **State:** ${volume.state}\n`;
  if (volume.comment) result += `💬 **Comment:** ${volume.comment}\n`;

  // Snapshot policy
  if (volume.snapshot_policy?.name) {
    result += `\n📸 **Snapshot Policy:** ${volume.snapshot_policy.name}\n`;
  } else {
    result += `\n📸 **Snapshot Policy:** None (default)\n`;
  }

  // Export policy
  if (volume.nas?.export_policy?.name) {
    result += `🔐 **Export Policy:** ${volume.nas.export_policy.name}\n`;
  } else {
    result += `🔐 **Export Policy:** default\n`;
  }

  // Volume efficiency
  if (volume.efficiency?.compression) {
    result += `\n🗜️ **Compression:** ${volume.efficiency.compression}\n`;
  }
  if (volume.efficiency?.dedupe) {
    result += `📦 **Deduplication:** ${volume.efficiency.dedupe}\n`;
  }

  return result;
}

/**
 * Format bytes to human readable string
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

// ================================
// MCP Tool Implementations
// ================================

/**
 * Get comprehensive volume configuration information
 */
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
        volume_uuid: { type: "string", description: "UUID of the volume" }
      },
      required: ["volume_uuid"]
    }
  };
}

export async function handleGetVolumeConfiguration(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = GetVolumeConfigurationSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    const volume = await client.getVolumeInfo(params.volume_uuid);
    return formatVolumeConfig(volume);
  } catch (error) {
    return `❌ Error retrieving volume configuration: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Update volume security style
 */
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
        security_style: { 
          type: "string", 
          enum: ["unix", "ntfs", "mixed", "unified"],
          description: "New security style for the volume" 
        }
      },
      required: ["volume_uuid", "security_style"]
    }
  };
}

export async function handleUpdateVolumeSecurityStyle(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = UpdateVolumeSecurityStyleSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    // Get volume info first
    const volumeInfo = await client.getVolumeInfo(params.volume_uuid);
    const currentStyle = volumeInfo.nas?.security_style || 'unknown';
    
    await client.updateVolumeSecurityStyle(params.volume_uuid, params.security_style);

    let result = `✅ **Volume security style updated successfully!**\n\n`;
    result += `💾 **Volume:** ${volumeInfo.name} (${params.volume_uuid})\n`;
    result += `🏢 **SVM:** ${volumeInfo.svm?.name}\n`;
    result += `🔒 **Previous Style:** ${currentStyle}\n`;
    result += `🔒 **New Style:** ${params.security_style}\n\n`;
    result += `💡 **Security Style Reference:**\n`;
    result += `   • **unix:** UNIX-style permissions (for NFS/Linux)\n`;
    result += `   • **ntfs:** Windows NTFS permissions (for CIFS/Windows)\n`;
    result += `   • **mixed:** Both UNIX and NTFS (file-by-file basis)\n`;
    result += `   • **unified:** Unified permissions model\n`;

    return result;
  } catch (error) {
    return `❌ Error updating volume security style: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Resize a volume
 */
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
        new_size: { type: "string", description: "New size for the volume (e.g., '500GB', '2TB')" }
      },
      required: ["volume_uuid", "new_size"]
    }
  };
}

export async function handleResizeVolume(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = ResizeVolumeSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    // Get volume info first to show before/after
    const volumeInfo = await client.getVolumeInfo(params.volume_uuid);
    const oldSize = volumeInfo.size;
    
    await client.resizeVolume(params.volume_uuid, params.new_size);
    
    // Get updated info
    const updatedVolumeInfo = await client.getVolumeInfo(params.volume_uuid);
    const newSize = updatedVolumeInfo.size;

    let result = `✅ **Volume resized successfully!**\n\n`;
    result += `💾 **Volume:** ${volumeInfo.name} (${params.volume_uuid})\n`;
    result += `🏢 **SVM:** ${volumeInfo.svm?.name}\n`;
    result += `📊 **Previous Size:** ${formatBytes(oldSize)}\n`;
    result += `📊 **New Size:** ${formatBytes(newSize)}\n`;
    result += `📈 **Size Increase:** ${formatBytes(newSize - oldSize)}\n\n`;
    result += `💡 **Note:** The resize operation is immediate. Make sure the underlying aggregate has sufficient space.`;

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('cannot be decreased') || errorMsg.includes('shrink')) {
      return `❌ **Cannot resize volume**\n\n🚫 **Reason:** ONTAP volumes cannot be shrunk once they contain data.\n\n💡 **Alternative:** Create a new smaller volume and migrate the data.`;
    }
    return `❌ Error resizing volume: ${errorMsg}`;
  }
}

/**
 * Update volume comment/description
 */
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
        comment: { type: "string", description: "New comment/description for the volume (or empty to clear)" }
      },
      required: ["volume_uuid"]
    }
  };
}

export async function handleUpdateVolumeComment(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = UpdateVolumeCommentSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    // Get volume info first
    const volumeInfo = await client.getVolumeInfo(params.volume_uuid);
    const oldComment = volumeInfo.comment || '(none)';
    
    await client.updateVolumeComment(params.volume_uuid, params.comment || '');

    let result = `✅ **Volume comment updated successfully!**\n\n`;
    result += `💾 **Volume:** ${volumeInfo.name} (${params.volume_uuid})\n`;
    result += `🏢 **SVM:** ${volumeInfo.svm?.name}\n`;
    result += `💬 **Previous Comment:** ${oldComment}\n`;
    result += `💬 **New Comment:** ${params.comment || '(none)'}\n\n`;
    result += `💡 Comments help document the purpose and usage of volumes for easier management.`;

    return result;
  } catch (error) {
    return `❌ Error updating volume comment: ${error instanceof Error ? error.message : String(error)}`;
  }
}