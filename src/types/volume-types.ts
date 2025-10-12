/**
 * TypeScript types for NetApp ONTAP Volume management
 * These types correspond to ONTAP REST API v1/v2 volume objects
 */

/**
 * Volume state enumeration
 */
export type VolumeState = 'online' | 'offline' | 'restricted' | 'mixed';

/**
 * Volume type enumeration
 */
export type VolumeType = 'rw' | 'dp' | 'ls';

/**
 * Volume security style enumeration
 */
export type VolumeSecurityStyle = 'unix' | 'ntfs' | 'mixed' | 'unified';

/**
 * Storage Virtual Machine (SVM) reference
 */
export interface SvmReference {
  /** SVM UUID */
  uuid: string;
  /** SVM name */
  name: string;
}

/**
 * Aggregate reference
 */
export interface AggregateReference {
  /** Aggregate UUID */
  uuid: string;
  /** Aggregate name */
  name: string;
}

/**
 * Export policy reference
 */
export interface ExportPolicyReference {
  /** Export policy name */
  name: string;
  /** Export policy ID */
  id?: number;
}

/**
 * Snapshot policy reference
 */
export interface SnapshotPolicyReference {
  /** Snapshot policy name */
  name: string;
  /** Snapshot policy UUID */
  uuid?: string;
}

/**
 * QoS policy reference
 */
export interface QosPolicyReference {
  /** QoS policy name */
  name: string;
  /** QoS policy UUID */
  uuid?: string;
}

/**
 * Volume NAS configuration
 */
export interface VolumeNasConfig {
  /** Security style for the volume */
  security_style?: VolumeSecurityStyle;
  /** Export policy configuration */
  export_policy?: ExportPolicyReference;
}

/**
 * Volume efficiency settings
 */
export interface VolumeEfficiency {
  /** Compression setting */
  compression?: string;
  /** Deduplication setting */
  dedupe?: string;
}

/**
 * Volume space information
 */
export interface VolumeSpace {
  /** Used space in bytes */
  used: number;
  /** Available space in bytes */
  available: number;
  /** Total space in bytes */
  total: number;
}

/**
 * Volume IOPS metrics
 */
export interface VolumeIops {
  /** Read IOPS */
  read: number;
  /** Write IOPS */
  write: number;
  /** Other IOPS */
  other: number;
  /** Total IOPS */
  total: number;
}

/**
 * Volume throughput metrics
 */
export interface VolumeThroughput {
  /** Read throughput in bytes/sec */
  read: number;
  /** Write throughput in bytes/sec */
  write: number;
  /** Other throughput in bytes/sec */
  other: number;
  /** Total throughput in bytes/sec */
  total: number;
}

/**
 * Volume latency metrics
 */
export interface VolumeLatency {
  /** Read latency in microseconds */
  read: number;
  /** Write latency in microseconds */
  write: number;
  /** Other latency in microseconds */
  other: number;
  /** Total latency in microseconds */
  total: number;
}

/**
 * Complete volume information
 */
export interface VolumeInfo {
  /** Volume UUID */
  uuid: string;
  /** Volume name */
  name: string;
  /** Volume size in bytes */
  size: number;
  /** Volume state */
  state: VolumeState;
  /** Volume type */
  type: VolumeType;
  /** Optional volume description/comment */
  comment?: string;
  /** SVM that owns this volume */
  svm?: SvmReference;
  /** Aggregates hosting this volume */
  aggregates?: AggregateReference[];
  /** NAS configuration */
  nas?: VolumeNasConfig;
  /** Snapshot policy */
  snapshot_policy?: SnapshotPolicyReference;
  /** Efficiency settings */
  efficiency?: VolumeEfficiency;
}

/**
 * Volume performance statistics
 */
export interface VolumeStats {
  /** Volume UUID */
  uuid: string;
  /** IOPS metrics */
  iops?: VolumeIops;
  /** Throughput metrics */
  throughput?: VolumeThroughput;
  /** Latency metrics */
  latency?: VolumeLatency;
  /** Space utilization */
  space?: VolumeSpace;
}

/**
 * Parameters for creating a new volume
 */
export interface CreateVolumeParams {
  /** SVM name where volume will be created */
  svm_name: string;
  /** New volume name */
  volume_name: string;
  /** Volume size (e.g., '100GB', '1TB') */
  size: string;
  /** Optional aggregate name */
  aggregate_name?: string;
  /** Optional snapshot policy name */
  snapshot_policy?: string;
  /** Optional NFS export policy name */
  nfs_export_policy?: string;
  /** Optional QoS policy name (can be from volume's SVM or admin SVM) */
  qos_policy?: string;
  /** Optional CIFS share configuration */
  cifs_share?: VolumeCifsConfig;
}

/**
 * Response from volume creation
 */
export interface CreateVolumeResponse {
  /** Created volume UUID */
  uuid: string;
  /** Optional job information for async operations */
  job?: {
    /** Job UUID */
    uuid: string;
    /** Job description */
    description?: string;
  };
}

/**
 * Volume resize parameters
 */
export interface ResizeVolumeParams {
  /** Volume UUID */
  volume_uuid: string;
  /** New size (e.g., '500GB', '2TB') */
  new_size: string;
}

/**
 * Volume comment update parameters
 */
export interface UpdateVolumeCommentParams {
  /** Volume UUID */
  volume_uuid: string;
  /** New comment/description */
  comment: string;
}

/**
 * Volume security style update parameters
 */
export interface UpdateVolumeSecurityStyleParams {
  /** Volume UUID */
  volume_uuid: string;
  /** New security style */
  security_style: VolumeSecurityStyle;
}

/**
 * Comprehensive volume update parameters
 */
export interface UpdateVolumeParams {
  /** Volume UUID */
  volume_uuid: string;
  /** New volume size (e.g., '500GB', '2TB') - can only increase */
  size?: string;
  /** New comment/description */
  comment?: string;
  /** New security style */
  security_style?: VolumeSecurityStyle;
  /** Volume state: 'online' for normal access, 'offline' to make inaccessible (required before deletion), 'restricted' for admin-only access */
  state?: 'online' | 'offline' | 'restricted';
  /** New QoS policy name (can be from volume's SVM or admin SVM, or empty string to remove) */
  qos_policy?: string;
  /** New snapshot policy name */
  snapshot_policy?: string;
  /** New NFS export policy name */
  nfs_export_policy?: string;
}

/**
 * Volume NFS access configuration
 */
export interface VolumeNfsConfig {
  /** Volume UUID */
  volume_uuid: string;
  /** Export policy to apply */
  export_policy: ExportPolicyReference;
  /** Whether NFS access is enabled */
  enabled?: boolean;
}

/**
 * Volume snapshot policy configuration
 */
export interface VolumeSnapshotConfig {
  /** Volume UUID */
  volume_uuid: string;
  /** Snapshot policy to apply */
  snapshot_policy: SnapshotPolicyReference;
}

/**
 * Volume CIFS configuration for volume creation
 */
export interface VolumeCifsConfig {
  /** CIFS share name */
  share_name: string;
  /** Optional share comment */
  comment?: string;
  /** Share properties */
  properties?: {
    /** Enable access-based enumeration */
    access_based_enumeration?: boolean;
    /** Enable encryption */
    encryption?: boolean;
    /** Offline files policy */
    offline_files?: 'none' | 'manual' | 'documents' | 'programs';
    /** Oplocks */
    oplocks?: boolean;
  };
  /** Access control entries */
  access_control?: Array<{
    /** Permission level */
    permission: 'no_access' | 'read' | 'change' | 'full_control';
    /** User or group name */
    user_or_group: string;
    /** Type of user/group */
    type?: 'windows' | 'unix_user' | 'unix_group';
  }>;
}

/**
 * Volume list query parameters
 */
export interface VolumeListParams {
  /** Optional SVM name filter */
  svm_name?: string;
  /** Optional volume name pattern */
  name_pattern?: string;
  /** Optional state filter */
  state?: VolumeState;
  /** Optional type filter */
  type?: VolumeType;
  /** Maximum number of records to return */
  max_records?: number;
  /** Sort order */
  order_by?: string;
}

/**
 * Volume operation result
 */
export interface VolumeOperationResult {
  /** Operation success status */
  success: boolean;
  /** Result message */
  message: string;
  /** Volume UUID if applicable */
  volume_uuid?: string;
  /** Job UUID for async operations */
  job_uuid?: string;
}