/**
 * Type definitions for Volume Snapshot Management
 */

export interface VolumeSnapshot {
  uuid: string;
  name: string;
  create_time: string;
  size: number;
  volume?: {
    uuid: string;
    name: string;
  };
  state?: string;
  comment?: string;
}

export interface ListVolumeSnapshotsParams {
  volume_uuid: string;
  sort_by?: 'create_time' | 'size' | 'name';
  order?: 'asc' | 'desc';
}

export interface VolumeSnapshotResponse {
  records: VolumeSnapshot[];
  num_records?: number;
}

// Hybrid format types for cluster_list_volume_snapshots
export interface SnapshotListInfo {
  uuid: string;
  name: string;
  create_time: string;
  size: number;
  volume_uuid: string;
  volume_name?: string;
  state?: string;
  comment?: string;
}

export interface SnapshotListResult {
  summary: string;  // For LLMs
  data: SnapshotListInfo[];  // For programmatic use
}
