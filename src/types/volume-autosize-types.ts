/**
 * Type definitions for Volume Autosize Management
 */

export type AutosizeMode = 'off' | 'grow' | 'grow_shrink';

export interface EnableVolumeAutosizeParams {
  volume_uuid: string;
  mode: AutosizeMode;
  maximum_size?: string;
  minimum_size?: string;
  grow_threshold_percent?: number;
  shrink_threshold_percent?: number;
}

export interface VolumeAutosizeStatus {
  autosize: {
    mode: AutosizeMode;
    maximum?: number;
    minimum?: number;
    grow_threshold?: number;
    shrink_threshold?: number;
  };
  current_size: number;
  space: {
    used: number;
    available: number;
    used_percent?: number;
  };
}

/**
 * Structured volume autosize status data (MCP parameter names)
 */
export interface VolumeAutosizeStatusData {
  current_size: number;
  autosize: {
    mode: string;
    maximum?: number;
    minimum?: number;
    grow_threshold?: number;
    shrink_threshold?: number;
  };
  space: {
    used: number;
    available: number;
    used_percent?: number;
  };
}

/**
 * Hybrid format result for cluster_get_volume_autosize_status
 */
export interface VolumeAutosizeStatusResult {
  summary: string;
  data: VolumeAutosizeStatusData;
}
