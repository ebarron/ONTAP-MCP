/**
 * TypeScript types for NetApp ONTAP Cluster management
 * These types correspond to ONTAP REST API v1/v2 cluster, SVM, and aggregate objects
 */

/**
 * Cluster state enumeration
 */
export type ClusterState = 'up' | 'down' | 'partial' | 'unknown';

/**
 * SVM state enumeration
 */
export type SvmState = 'running' | 'stopped' | 'starting' | 'stopping';

/**
 * SVM subtype enumeration
 */
export type SvmSubtype = 'default' | 'dp_destination' | 'data' | 'sync_source' | 'sync_destination';

/**
 * Aggregate state enumeration
 */
export type AggregateState = 'online' | 'offline' | 'degraded' | 'relocating' | 'restricted' | 'unknown';

/**
 * Cluster version information
 */
export interface ClusterVersion {
  /** Full version string (e.g., "NetApp Release 9.14.1P4: Thu May 02 18:19:50 UTC 2024") */
  full: string;
  /** Generation number */
  generation: number;
  /** Major version number */
  major: number;
  /** Minor version number */
  minor: number;
  /** Micro version number */
  micro?: number;
}

/**
 * Cluster node information
 */
export interface ClusterNode {
  /** Node UUID */
  uuid: string;
  /** Node name */
  name: string;
  /** Node model */
  model: string;
  /** Node serial number */
  serial_number: string;
  /** Node state */
  state: 'up' | 'down' | 'unknown';
  /** Node location */
  location?: string;
  /** Node vendor */
  vendor?: string;
}

/**
 * Main cluster information structure
 */
export interface ClusterInfo {
  /** Cluster UUID */
  uuid: string;
  /** Cluster name */
  name: string;
  /** Cluster version information */
  version: ClusterVersion;
  /** Array of cluster nodes */
  nodes: ClusterNode[];
  /** Cluster state */
  state?: ClusterState;
  /** Management network interfaces */
  management_interfaces?: {
    ip: {
      address: string;
      netmask: string;
    };
  }[];
  /** DNS domains */
  dns_domains?: string[];
  /** Name servers */
  name_servers?: string[];
  /** NTP servers */
  ntp_servers?: string[];
  /** Timezone */
  timezone?: {
    name: string;
  };
}

/**
 * Storage Virtual Machine (SVM) information
 */
export interface SvmInfo {
  /** SVM UUID */
  uuid: string;
  /** SVM name */
  name: string;
  /** SVM state */
  state: SvmState;
  /** SVM subtype */
  subtype: SvmSubtype;
  /** Comment/description */
  comment?: string;
  /** Language setting */
  language?: string;
  /** Aggregates assigned to this SVM */
  aggregates?: AggregateReference[];
  /** Maximum volumes allowed */
  max_volumes?: string;
  /** Snapshot policy */
  snapshot_policy?: {
    name: string;
    uuid?: string;
  };
  /** Is this the admin SVM? */
  is_admin?: boolean;
  /** IP interfaces */
  ip_interfaces?: {
    name: string;
    uuid: string;
    ip: {
      address: string;
      netmask: string;
    };
  }[];
}

/**
 * Aggregate reference (minimal info)
 */
export interface AggregateReference {
  /** Aggregate UUID */
  uuid: string;
  /** Aggregate name */
  name: string;
}

/**
 * Full aggregate information
 */
export interface AggregateInfo {
  /** Aggregate UUID */
  uuid: string;
  /** Aggregate name */
  name: string;
  /** Aggregate state */
  state: AggregateState;
  /** Total size in bytes */
  size: number;
  /** Available size in bytes */
  available_size: number;
  /** Used size in bytes */
  used_size: number;
  /** Usage percentage */
  percent_used?: number;
  /** Node that owns this aggregate */
  node: {
    name: string;
    uuid: string;
  };
  /** RAID type */
  raid_type?: string;
  /** RAID size */
  raid_size?: number;
  /** Number of disks */
  disk_count?: number;
  /** Home node */
  home_node?: {
    name: string;
    uuid: string;
  };
  /** Is this aggregate encrypted? */
  is_encrypted?: boolean;
  /** Snapshot reserve percentage */
  snapshot_reserve_percent?: number;
}

/**
 * Registered cluster configuration (for cluster manager)
 */
export interface RegisteredCluster {
  /** Unique cluster name in registry */
  name: string;
  /** Cluster IP address or FQDN */
  cluster_ip: string;
  /** Username for authentication */
  username: string;
  /** Password for authentication (stored securely) */
  password: string;
  /** Optional description */
  description?: string;
  /** Registration timestamp */
  registered_at?: Date;
  /** Last successful connection */
  last_connected?: Date;
  /** Connection status */
  status?: 'connected' | 'disconnected' | 'error';
}

/**
 * Cluster health status
 */
export interface ClusterHealth {
  /** Overall cluster health */
  status: 'ok' | 'warning' | 'error';
  /** Health messages */
  messages?: string[];
  /** Subsystem health */
  subsystems?: {
    [key: string]: {
      status: 'ok' | 'warning' | 'error';
      message?: string;
    };
  };
}

/**
 * Cluster statistics/metrics
 */
export interface ClusterMetrics {
  /** CPU utilization percentage */
  cpu_utilization?: number;
  /** Memory utilization percentage */
  memory_utilization?: number;
  /** Network throughput */
  network_throughput?: {
    in_bytes_per_second: number;
    out_bytes_per_second: number;
  };
  /** Storage throughput */
  storage_throughput?: {
    read_ops_per_second: number;
    write_ops_per_second: number;
    read_bytes_per_second: number;
    write_bytes_per_second: number;
  };
}

/**
 * API response wrapper for cluster operations
 */
export interface ClusterApiResponse<T = any> {
  /** Response data */
  data?: T;
  /** Number of records returned */
  num_records?: number;
  /** Error information if request failed */
  error?: {
    message: string;
    code: string;
    target?: string;
  };
  /** API version used */
  version?: string;
}