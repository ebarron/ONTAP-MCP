/**
 * NetApp ONTAP MCP Volume Autosize Management Tools
 * 
 * Provides volume autosize configuration for automatic volume growth/shrinkage.
 * Use cases:
 * - Alert remediation: Enable autosize when volumes approach capacity limits
 * - Proactive capacity management: Configure growth thresholds
 * - Dynamic storage allocation: Allow volumes to grow within defined limits
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OntapApiClient, OntapClusterManager } from '../ontap-client.js';
import type { AutosizeMode, VolumeAutosizeStatus, VolumeAutosizeStatusData, VolumeAutosizeStatusResult } from '../types/volume-autosize-types.js';

// ================================
// Helper Function for Client Resolution
// ================================

/**
 * Helper to get API client from either registered cluster or direct credentials
 */
function getApiClient(
  clusterManager: OntapClusterManager,
  cluster_name?: string,
  cluster_ip?: string,
  username?: string,
  password?: string
): OntapApiClient {
  if (cluster_name) {
    return clusterManager.getClient(cluster_name);
  }
  
  if (!cluster_ip || !username || !password) {
    throw new Error('Either cluster_name or (cluster_ip + username + password) must be provided');
  }
  
  return new OntapApiClient(cluster_ip, username, password);
}

// ================================
// Zod Schemas for Input Validation
// ================================

const ClusterEnableVolumeAutosizeSchema = z.object({
  cluster_name: z.string().optional().describe("Name of the registered cluster"),
  cluster_ip: z.string().optional().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().optional().describe("Username for authentication"),
  password: z.string().optional().describe("Password for authentication"),
  volume_uuid: z.string().describe("UUID of the volume"),
  volume_name: z.string().optional().describe("Volume name (will be resolved to UUID if provided)"),
  svm_name: z.string().optional().describe("SVM name (required if using volume_name)"),
  mode: z.enum(['off', 'grow', 'grow_shrink']).describe("Autosize mode: 'off' to disable, 'grow' for growth only, 'grow_shrink' for both"),
  maximum_size: z.string().optional().describe("Maximum size (e.g., '1TB', '500GB')"),
  minimum_size: z.string().optional().describe("Minimum size for grow_shrink mode (e.g., '100GB')"),
  grow_threshold_percent: z.number().min(1).max(100).optional().describe("Percentage full to trigger growth (default: 85)"),
  shrink_threshold_percent: z.number().min(1).max(100).optional().describe("Percentage full to trigger shrink (default: 50, only for grow_shrink mode)")
});

const ClusterGetVolumeAutosizeStatusSchema = z.object({
  cluster_name: z.string().optional().describe("Name of the registered cluster"),
  cluster_ip: z.string().optional().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().optional().describe("Username for authentication"),
  password: z.string().optional().describe("Password for authentication"),
  volume_uuid: z.string().describe("UUID of the volume"),
  volume_name: z.string().optional().describe("Volume name (will be resolved to UUID if provided)"),
  svm_name: z.string().optional().describe("SVM name (required if using volume_name)")
});

// ================================
// Tool Handlers
// ================================

/**
 * Enable or configure volume autosize
 */
export async function handleClusterEnableVolumeAutosize(
  args: any,
  clusterManager: OntapClusterManager
): Promise<string> {
  const validated = ClusterEnableVolumeAutosizeSchema.parse(args);
  const client = getApiClient(clusterManager, validated.cluster_name, validated.cluster_ip, validated.username, validated.password);

  // Resolve volume UUID if name provided
  let volumeUuid = validated.volume_uuid;
  if (validated.volume_name && validated.svm_name) {
    const volumes = await client.listVolumes(validated.svm_name);
    const volume = volumes.find((v: any) => v.name === validated.volume_name);
    if (!volume) {
      throw new Error(`Volume '${validated.volume_name}' not found in SVM '${validated.svm_name}'`);
    }
    volumeUuid = volume.uuid;
  }

  // Validate parameters based on mode
  if (validated.mode === 'grow_shrink' && !validated.minimum_size) {
    throw new Error('minimum_size is required when mode is grow_shrink');
  }

  if (validated.mode !== 'off' && !validated.maximum_size) {
    throw new Error('maximum_size is required when enabling autosize');
  }

  await client.enableVolumeAutosize({
    volume_uuid: volumeUuid,
    mode: validated.mode,
    maximum_size: validated.maximum_size,
    minimum_size: validated.minimum_size,
    grow_threshold_percent: validated.grow_threshold_percent,
    shrink_threshold_percent: validated.shrink_threshold_percent
  });

  const modeDesc = validated.mode === 'off' ? 'disabled' : 
                   validated.mode === 'grow' ? `enabled with grow mode (max: ${validated.maximum_size})` :
                   `enabled with grow_shrink mode (min: ${validated.minimum_size}, max: ${validated.maximum_size})`;

  return `Volume autosize ${modeDesc} for volume ${volumeUuid}`;
}

/**
 * Get volume autosize status
 */
export async function handleClusterGetVolumeAutosizeStatus(
  args: any,
  clusterManager: OntapClusterManager
): Promise<VolumeAutosizeStatusResult> {
  const validated = ClusterGetVolumeAutosizeStatusSchema.parse(args);
  const client = getApiClient(clusterManager, validated.cluster_name, validated.cluster_ip, validated.username, validated.password);

  // Resolve volume UUID if name provided
  let volumeUuid = validated.volume_uuid;
  if (validated.volume_name && validated.svm_name) {
    const volumes = await client.listVolumes(validated.svm_name);
    const volume = volumes.find((v: any) => v.name === validated.volume_name);
    if (!volume) {
      throw new Error(`Volume '${validated.volume_name}' not found in SVM '${validated.svm_name}'`);
    }
    volumeUuid = volume.uuid;
  }

  const status = await client.getVolumeAutosizeStatus(volumeUuid);

  // Build structured data with MCP parameter names
  const data: VolumeAutosizeStatusData = {
    current_size: status.current_size,
    autosize: status.autosize,
    space: status.space
  };

  // Build summary text
  const summary = `Volume Autosize Status:
  
Mode: ${status.autosize.mode}
Current Size: ${formatBytes(status.current_size)}
Maximum Size: ${status.autosize.maximum ? formatBytes(status.autosize.maximum) : 'Not set'}
Minimum Size: ${status.autosize.minimum ? formatBytes(status.autosize.minimum) : 'Not set'}
Grow Threshold: ${status.autosize.grow_threshold || 'Default (85%)'}%
Shrink Threshold: ${status.autosize.shrink_threshold || 'Default (50%)'}%

Space Usage:
  Used: ${formatBytes(status.space.used)}
  Available: ${formatBytes(status.space.available)}
  Percent Used: ${status.space.used_percent || 'N/A'}%`;

  return { summary, data };
}

// ================================
// Tool Definition Creators
// ================================

export function createClusterEnableVolumeAutosizeToolDefinition(): Tool {
  return {
    name: "cluster_enable_volume_autosize",
    description: "Enable or configure volume autosize on a registered cluster. Autosize automatically adjusts volume size based on utilization. Use 'grow' mode for automatic growth only, or 'grow_shrink' for both growth and shrinkage.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
        volume_name: { type: "string", description: "Volume name (alternative to volume_uuid)" },
        svm_name: { type: "string", description: "SVM name (required if using volume_name)" },
        mode: { type: "string", enum: ["off", "grow", "grow_shrink"], description: "Autosize mode: 'off' to disable, 'grow' for growth only, 'grow_shrink' for both" },
        maximum_size: { type: "string", description: "Maximum size (e.g., '1TB', '500GB') - required when mode is not 'off'" },
        minimum_size: { type: "string", description: "Minimum size for grow_shrink mode (e.g., '100GB')" },
        grow_threshold_percent: { type: "number", description: "Percentage full to trigger growth (default: 85, range: 1-100)" },
        shrink_threshold_percent: { type: "number", description: "Percentage full to trigger shrink (default: 50, range: 1-100, only for grow_shrink mode)" }
      },
      required: ["cluster_name", "mode"]
    }
  };
}

export function createClusterGetVolumeAutosizeStatusToolDefinition(): Tool {
  return {
    name: "cluster_get_volume_autosize_status",
    description: "Get the current autosize configuration and status for a volume on a registered cluster, including current size, limits, and space usage.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
        volume_name: { type: "string", description: "Volume name (alternative to volume_uuid)" },
        svm_name: { type: "string", description: "SVM name (required if using volume_name)" }
      },
      required: ["cluster_name"]
    }
  };
}

// ================================
// Utility Functions
// ================================

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
