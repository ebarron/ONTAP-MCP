/**
 * NetApp ONTAP MCP Volume Snapshot Management Tools
 * 
 * Provides volume snapshot management for space reclamation and data protection.
 * Use cases:
 * - Alert remediation: Delete old snapshots to reclaim space
 * - Capacity management: Identify and remove unnecessary snapshots
 * - Snapshot discovery: List and inspect volume snapshots
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OntapApiClient, OntapClusterManager } from '../ontap-client.js';
import type { VolumeSnapshot } from '../types/volume-snapshot-types.js';

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

const ClusterListVolumeSnapshotsSchema = z.object({
  cluster_name: z.string().optional().describe("Name of the registered cluster"),
  cluster_ip: z.string().optional().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().optional().describe("Username for authentication"),
  password: z.string().optional().describe("Password for authentication"),
  volume_uuid: z.string().describe("UUID of the volume"),
  volume_name: z.string().optional().describe("Volume name (will be resolved to UUID if provided)"),
  svm_name: z.string().optional().describe("SVM name (required if using volume_name)"),
  sort_by: z.enum(['create_time', 'size', 'name']).optional().describe("Sort snapshots by create_time (oldest/newest), size, or name"),
  order: z.enum(['asc', 'desc']).optional().describe("Sort order: 'asc' for ascending (oldest first when sorting by time), 'desc' for descending (newest first)")
});

const ClusterGetVolumeSnapshotInfoSchema = z.object({
  cluster_name: z.string().optional().describe("Name of the registered cluster"),
  cluster_ip: z.string().optional().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().optional().describe("Username for authentication"),
  password: z.string().optional().describe("Password for authentication"),
  volume_uuid: z.string().describe("UUID of the volume"),
  snapshot_uuid: z.string().optional().describe("UUID of the snapshot"),
  snapshot_name: z.string().optional().describe("Name of the snapshot (will be resolved to UUID if provided)")
});

const ClusterDeleteVolumeSnapshotSchema = z.object({
  cluster_name: z.string().optional().describe("Name of the registered cluster"),
  cluster_ip: z.string().optional().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().optional().describe("Username for authentication"),
  password: z.string().optional().describe("Password for authentication"),
  volume_uuid: z.string().describe("UUID of the volume"),
  snapshot_uuid: z.string().optional().describe("UUID of the snapshot to delete"),
  snapshot_name: z.string().optional().describe("Name of the snapshot to delete (will be resolved to UUID)")
});

// ================================
// Tool Handlers
// ================================

/**
 * List volume snapshots
 */
export async function handleClusterListVolumeSnapshots(
  args: any,
  clusterManager: OntapClusterManager
): Promise<string> {
  const validated = ClusterListVolumeSnapshotsSchema.parse(args);
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

  const snapshots = await client.listVolumeSnapshots({
    volume_uuid: volumeUuid,
    sort_by: validated.sort_by,
    order: validated.order
  });

  if (snapshots.length === 0) {
    return `No snapshots found for volume ${volumeUuid}`;
  }

  let result = `Volume Snapshots (${snapshots.length} total):\n\n`;
  snapshots.forEach((snap: any, index: number) => {
    result += `${index + 1}. ${snap.name}\n`;
    result += `   UUID: ${snap.uuid}\n`;
    result += `   Created: ${snap.create_time}\n`;
    result += `   Size: ${formatBytes(snap.size)}\n`;
    result += `\n`;
  });

  return result;
}

/**
 * Get detailed snapshot information
 */
export async function handleClusterGetVolumeSnapshotInfo(
  args: any,
  clusterManager: OntapClusterManager
): Promise<string> {
  const validated = ClusterGetVolumeSnapshotInfoSchema.parse(args);
  const client = getApiClient(clusterManager, validated.cluster_name, validated.cluster_ip, validated.username, validated.password);

  // Resolve snapshot UUID if name provided
  let snapshotUuid = validated.snapshot_uuid;
  if (!snapshotUuid && validated.snapshot_name) {
    const snapshot = await client.findSnapshotByName(validated.volume_uuid, validated.snapshot_name);
    snapshotUuid = snapshot.uuid;
  }

  if (!snapshotUuid) {
    throw new Error('Either snapshot_uuid or snapshot_name must be provided');
  }

  const snapshot = await client.getVolumeSnapshotInfo(validated.volume_uuid, snapshotUuid);

  return `Snapshot Details:

Name: ${snapshot.name}
UUID: ${snapshot.uuid}
Created: ${snapshot.create_time}
Size: ${formatBytes(snapshot.size)}
State: ${snapshot.state || 'N/A'}
Comment: ${snapshot.comment || 'None'}
Volume: ${snapshot.volume?.name || 'N/A'} (${snapshot.volume?.uuid || 'N/A'})`;
}

/**
 * Delete a volume snapshot
 */
export async function handleClusterDeleteVolumeSnapshot(
  args: any,
  clusterManager: OntapClusterManager
): Promise<string> {
  const validated = ClusterDeleteVolumeSnapshotSchema.parse(args);
  const client = getApiClient(clusterManager, validated.cluster_name, validated.cluster_ip, validated.username, validated.password);

  // Resolve snapshot UUID if name provided
  let snapshotUuid = validated.snapshot_uuid;
  let snapshotName = validated.snapshot_name;
  
  if (!snapshotUuid && snapshotName) {
    const snapshot = await client.findSnapshotByName(validated.volume_uuid, snapshotName);
    snapshotUuid = snapshot.uuid;
  }

  if (!snapshotUuid) {
    throw new Error('Either snapshot_uuid or snapshot_name must be provided');
  }

  // Get snapshot info before deleting for confirmation message
  if (!snapshotName) {
    const snapshot = await client.getVolumeSnapshotInfo(validated.volume_uuid, snapshotUuid);
    snapshotName = snapshot.name;
  }

  await client.deleteVolumeSnapshot(validated.volume_uuid, snapshotUuid);

  return `Successfully deleted snapshot '${snapshotName}' (UUID: ${snapshotUuid}) from volume ${validated.volume_uuid}`;
}

// ================================
// Tool Definition Creators
// ================================

export function createClusterListVolumeSnapshotsToolDefinition(): Tool {
  return {
    name: "cluster_list_volume_snapshots",
    description: "List all snapshots for a volume on a registered cluster. Snapshots can be sorted by creation time (to find oldest/newest), size, or name. Useful for identifying snapshots to delete when reclaiming space.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
        volume_name: { type: "string", description: "Volume name (alternative to volume_uuid)" },
        svm_name: { type: "string", description: "SVM name (required if using volume_name)" },
        sort_by: { type: "string", enum: ["create_time", "size", "name"], description: "Sort snapshots by: 'create_time' (find oldest/newest), 'size' (find largest), or 'name'" },
        order: { type: "string", enum: ["asc", "desc"], description: "Sort order: 'asc' for ascending (oldest first when sorting by time), 'desc' for descending (newest first)" }
      },
      required: ["cluster_name", "volume_uuid"]
    }
  };
}

export function createClusterGetVolumeSnapshotInfoToolDefinition(): Tool {
  return {
    name: "cluster_get_volume_snapshot_info",
    description: "Get detailed information about a specific volume snapshot on a registered cluster, including creation time, size, state, and any comments.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
        snapshot_uuid: { type: "string", description: "UUID of the snapshot" },
        snapshot_name: { type: "string", description: "Snapshot name (alternative to snapshot_uuid - will be resolved automatically)" }
      },
      required: ["cluster_name", "volume_uuid"]
    }
  };
}

export function createClusterDeleteVolumeSnapshotToolDefinition(): Tool {
  return {
    name: "cluster_delete_volume_snapshot",
    description: "Delete a volume snapshot on a registered cluster to reclaim space. WARNING: This permanently removes the snapshot and cannot be undone. Use cluster_list_volume_snapshots to find snapshots before deleting.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        volume_uuid: { type: "string", description: "UUID of the volume" },
        snapshot_uuid: { type: "string", description: "UUID of the snapshot to delete" },
        snapshot_name: { type: "string", description: "Snapshot name to delete (alternative to snapshot_uuid - will be resolved automatically)" }
      },
      required: ["cluster_name", "volume_uuid"]
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
