/**
 * TypeScript types for NetApp ONTAP QoS Policy Group management
 * These types correspond to ONTAP REST API /api/storage/qos/policies
 */

/**
 * QoS policy type - fixed or adaptive
 */
export type QosPolicyType = 'fixed' | 'adaptive';

/**
 * Throughput allocation method for adaptive QoS
 */
export type QosAllocation = 'used-space' | 'allocated-space';

/**
 * Base QoS policy information
 */
export interface QosPolicy {
  /** Unique identifier (UUID) */
  uuid?: string;
  /** Policy name (up to 127 characters, alphanumeric, underscore, hyphen) */
  name: string;
  /** SVM that owns this policy */
  svm: {
    name: string;
    uuid?: string;
  };
  /** Policy type - fixed limits or adaptive scaling */
  type?: QosPolicyType;
  /** Whether limits are shared across workloads or per-workload */
  is_shared?: boolean;
  /** Number of workloads using this policy */
  workload_count?: number;
}

/**
 * Fixed QoS policy with absolute throughput limits
 */
export interface FixedQosPolicy extends QosPolicy {
  type: 'fixed';
  /** Maximum throughput (e.g., "1000iops", "500MB/s") */
  max_throughput?: string;
  /** Minimum guaranteed throughput (e.g., "100iops", "50MB/s") */
  min_throughput?: string;
}

/**
 * Adaptive QoS policy with dynamic scaling based on size
 */
export interface AdaptiveQosPolicy extends QosPolicy {
  type: 'adaptive';
  /** Expected IOPS per TB/GB */
  expected_iops?: string;
  /** Peak IOPS per TB/GB */
  peak_iops?: string;
  /** How expected IOPS are calculated */
  expected_iops_allocation?: QosAllocation;
  /** How peak IOPS are calculated */
  peak_iops_allocation?: QosAllocation;
}

/**
 * Create fixed QoS policy request
 */
export interface CreateFixedQosPolicyRequest {
  /** Policy name */
  name: string;
  /** SVM name or UUID */
  svm: {
    name?: string;
    uuid?: string;
  };
  /** Maximum throughput */
  max_throughput?: string;
  /** Minimum throughput */
  min_throughput?: string;
  /** Whether limits are shared */
  is_shared?: boolean;
}

/**
 * Create adaptive QoS policy request
 */
export interface CreateAdaptiveQosPolicyRequest {
  /** Policy name */
  name: string;
  /** SVM name or UUID */
  svm: {
    name?: string;
    uuid?: string;
  };
  /** Expected IOPS per TB or GB */
  expected_iops?: string;
  /** Peak IOPS per TB or GB */
  peak_iops?: string;
  /** Expected IOPS allocation method */
  expected_iops_allocation?: QosAllocation;
  /** Peak IOPS allocation method */
  peak_iops_allocation?: QosAllocation;
}

/**
 * Update QoS policy request
 */
export interface UpdateQosPolicyRequest {
  /** New policy name */
  name?: string;
  /** New maximum throughput (fixed only) */
  max_throughput?: string;
  /** New minimum throughput (fixed only) */
  min_throughput?: string;
  /** New expected IOPS (adaptive only) */
  expected_iops?: string;
  /** New peak IOPS (adaptive only) */
  peak_iops?: string;
  /** New expected IOPS allocation (adaptive only) */
  expected_iops_allocation?: QosAllocation;
  /** New peak IOPS allocation (adaptive only) */
  peak_iops_allocation?: QosAllocation;
  /** New shared setting */
  is_shared?: boolean;
}

/**
 * List QoS policies query parameters
 */
export interface ListQosPoliciesParams {
  /** Filter by SVM name */
  'svm.name'?: string;
  /** Filter by SVM UUID */
  'svm.uuid'?: string;
  /** Filter by policy name pattern */
  'name'?: string;
  /** Filter by policy type */
  'type'?: QosPolicyType;
  /** Include additional fields in response */
  fields?: string;
  /** Maximum number of records to return */
  max_records?: number;
}

/**
 * QoS policy API response wrapper
 */
export interface QosPolicyResponse {
  /** Number of records returned */
  num_records: number;
  /** Array of QoS policies */
  records: (FixedQosPolicy | AdaptiveQosPolicy)[];
}

/**
 * Single QoS policy API response
 */
export interface SingleQosPolicyResponse extends QosPolicy {
  /** Fixed policy properties if applicable */
  fixed?: {
    max_throughput?: string;
    min_throughput?: string;
  };
  /** Adaptive policy properties if applicable */
  adaptive?: {
    expected_iops?: string;
    peak_iops?: string;
    expected_iops_allocation?: QosAllocation;
    peak_iops_allocation?: QosAllocation;
  };
}

/**
 * QoS policy list information (for hybrid format)
 * Simplified structure for UI dropdown population
 */
export interface QosPolicyListInfo {
  /** Policy UUID */
  uuid?: string;
  /** Policy name */
  name: string;
  /** SVM name */
  svm_name?: string;
  /** SVM UUID */
  svm_uuid?: string;
  /** Policy type (fixed or adaptive) */
  type?: QosPolicyType;
  /** Whether limits are shared across workloads */
  is_shared?: boolean;
  /** Number of workloads using this policy */
  workload_count?: number;
  /** Fixed policy limits */
  fixed?: {
    max_throughput?: string;
    min_throughput?: string;
  };
  /** Adaptive policy limits */
  adaptive?: {
    expected_iops?: string;
    peak_iops?: string;
    expected_iops_allocation?: QosAllocation;
    peak_iops_allocation?: QosAllocation;
  };
}

/**
 * QoS policy list result (hybrid format)
 * Returns both human-readable summary and structured data
 */
export interface QosPolicyListResult {
  /** Human-readable summary */
  summary: string;
  /** Structured array of QoS policies */
  data: QosPolicyListInfo[];
}