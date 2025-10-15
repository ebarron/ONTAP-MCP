/**
 * TypeScript types for NetApp ONTAP Snapshot Policy management
 * These types correspond to ONTAP REST API v1/v2 snapshot policy objects
 */

/**
 * Snapshot copy configuration for ONTAP snapshot policies
 */
export interface SnapshotCopy {
  /** Number of snapshots to keep for this schedule */
  count: number;
  /** Schedule configuration */
  schedule: {
    /** Schedule name reference */
    name: string;
  };
  /** Optional prefix for snapshot names */
  prefix?: string;
  /** Retention period in ISO 8601 duration format (e.g., 'P30D' for 30 days) */
  retention?: string;
}

/**
 * Legacy interface for backward compatibility
 * @deprecated Use SnapshotCopy instead
 */
export interface SnapshotSchedule {
  /** Number of snapshots to keep for this schedule */
  count: number;
  /** Schedule name reference */
  schedule: string;
  /** Optional prefix for snapshot names */
  prefix?: string;
  /** Retention period in ISO 8601 duration format (e.g., 'P30D' for 30 days) */
  retention?: string;
}

/**
 * Snapshot policy definition
 */
export interface SnapshotPolicy {
  /** Unique identifier for the snapshot policy */
  uuid?: string;
  /** Policy name */
  name: string;
  /** Optional policy description/comment */
  comment?: string;
  /** Array of snapshot copies within this policy */
  copies?: SnapshotCopy[];
  /** SVM information */
  svm?: {
    uuid?: string;
    name?: string;
  };
  /** Whether this policy is enabled */
  enabled?: boolean;
  /** Scope of the policy (cluster or svm) */
  scope?: 'cluster' | 'svm';
}

/**
 * Request body for creating a snapshot policy
 */
export interface CreateSnapshotPolicyRequest {
  /** Policy name (required) */
  name: string;
  /** Optional policy description */
  comment?: string;
  /** Array of snapshot copies for the policy */
  copies?: SnapshotCopy[];
  /** SVM scope - if not provided, policy applies to cluster */
  svm?: {
    name: string;
  };
  /** Whether policy should be enabled (default: true) */
  enabled?: boolean;
}

/**
 * Request body for updating a snapshot policy
 */
export interface UpdateSnapshotPolicyRequest {
  /** Updated policy name */
  name?: string;
  /** Updated policy description */
  comment?: string;
  /** Updated copies array */
  copies?: SnapshotCopy[];
  /** Whether policy should be enabled */
  enabled?: boolean;
}

/**
 * Response from ONTAP API for snapshot policy operations
 */
export interface SnapshotPolicyResponse {
  /** Records array containing snapshot policies */
  records?: SnapshotPolicy[];
  /** Total number of records */
  num_records?: number;
  /** Links for pagination */
  _links?: {
    self: { href: string };
    next?: { href: string };
  };
}

/**
 * Parameters for listing snapshot policies
 */
export interface ListSnapshotPoliciesParams {
  /** Filter by policy name pattern */
  'name'?: string;
  /** Filter by SVM name */
  'svm.name'?: string;
  /** Filter by enabled status */
  'enabled'?: boolean;
  /** Fields to include in response */
  'fields'?: string;
  /** Maximum number of records to return */
  'max_records'?: number;
  /** Starting point for pagination */
  'order_by'?: string;
}

/**
 * Snapshot policy list response
 */
export interface SnapshotPolicyListResponse {
  /** Array of policies returned by list operations */
  policies?: SnapshotPolicy[];
}
/**
 * Structured snapshot policy data (MCP parameter names)
 * Used for undo/reversibility support
 */
export interface SnapshotPolicyData {
  /** Policy UUID */
  uuid: string;
  /** Policy name */
  name: string;
  /** Policy description */
  comment?: string;
  /** Enabled status */
  enabled: boolean;
  /** Scope (svm or cluster) */
  scope?: string;
  /** SVM information */
  svm?: {
    name: string;
    uuid: string;
  };
  /** Snapshot copies configuration */
  copies?: Array<{
    /** Schedule reference */
    schedule: {
      name: string;
    };
    /** Number of snapshots to keep */
    count: number;
    /** Snapshot name prefix */
    prefix?: string;
    /** Retention period */
    retention?: string;
  }>;
}

/**
 * Hybrid format result for get_snapshot_policy
 */
export interface SnapshotPolicyResult {
  /** Formatted text summary for LLM consumption */
  summary: string;
  /** Structured data for programmatic use */
  data: SnapshotPolicyData;
}
