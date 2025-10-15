/**
 * MCP Tools for NetApp ONTAP QoS Policy Group Management
 * These tools provide QoS policy CRUD operations for registered ONTAP clusters
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OntapClusterManager } from '../ontap-client.js';
import type { 
  QosPolicy,
  QosPolicyListInfo,
  QosPolicyListResult,
  QosPolicyData,
  QosPolicyResult,
  FixedQosPolicy,
  AdaptiveQosPolicy,
  CreateFixedQosPolicyRequest,
  CreateAdaptiveQosPolicyRequest,
  UpdateQosPolicyRequest,
  QosPolicyResponse,
  SingleQosPolicyResponse,
  QosPolicyType,
  QosAllocation
} from '../types/qos-types.js';

// ================================
// Zod Schemas for Input Validation
// ================================

const QosPolicyTypeSchema = z.enum(['fixed', 'adaptive']);
const QosAllocationSchema = z.enum(['used-space', 'allocated-space']);

// List QoS policies schema
const ClusterListQosPoliciesSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  svm_name: z.string().describe("Filter by SVM name").optional(),
  policy_name_pattern: z.string().describe("Filter by policy name pattern").optional(),
  policy_type: QosPolicyTypeSchema.describe("Filter by policy type (fixed or adaptive)").optional()
});

// Create QoS policy schema (supports both fixed and adaptive)
const ClusterCreateQosPolicySchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  policy_name: z.string()
    .min(1)
    .max(127)
    .regex(/^[a-zA-Z0-9_-]+$/, "Policy name must be alphanumeric with underscores and hyphens only")
    .describe("QoS policy name (1-127 chars, alphanumeric, underscore, hyphen)"),
  svm_name: z.string().describe("SVM name where policy will be created"),
  policy_type: QosPolicyTypeSchema.describe("Type of QoS policy: 'fixed' for absolute limits or 'adaptive' for scaling limits"),
  
  // Fixed policy parameters
  max_throughput: z.string()
    .regex(/^\d+(?:\.\d+)?(iops|IOPS|mb\/s|MB\/s|gb\/s|GB\/s)$/, "Format: number + unit (e.g., '1000iops', '500MB/s')")
    .describe("Maximum throughput (fixed policy only)")
    .optional(),
  min_throughput: z.string()
    .regex(/^\d+(?:\.\d+)?(iops|IOPS|mb\/s|MB\/s|gb\/s|GB\/s)$/, "Format: number + unit (e.g., '100iops', '50MB/s')")
    .describe("Minimum guaranteed throughput (fixed policy only)")
    .optional(),
  is_shared: z.boolean()
    .default(true)
    .describe("Whether limits apply to all workloads combined (true) or per workload (false)")
    .optional(),
  
  // Adaptive policy parameters  
  expected_iops: z.string()
    .regex(/^\d+(?:\.\d+)?iops\/(?:tb|TB|gb|GB)$/, "Format: number + 'iops/TB' or 'iops/GB'")
    .describe("Expected IOPS per TB/GB (adaptive policy only)")
    .optional(),
  peak_iops: z.string()
    .regex(/^\d+(?:\.\d+)?iops\/(?:tb|TB|gb|GB)$/, "Format: number + 'iops/TB' or 'iops/GB'")
    .describe("Peak IOPS per TB/GB (adaptive policy only)")
    .optional(),
  expected_iops_allocation: QosAllocationSchema
    .default('used-space')
    .describe("How expected IOPS are calculated: 'used-space' or 'allocated-space' (adaptive policy only)")
    .optional(),
  peak_iops_allocation: QosAllocationSchema
    .default('used-space')
    .describe("How peak IOPS are calculated: 'used-space' or 'allocated-space' (adaptive policy only)")
    .optional()
}).refine(data => {
  if (data.policy_type === 'fixed') {
    return data.max_throughput || data.min_throughput;
  } else if (data.policy_type === 'adaptive') {
    return data.expected_iops || data.peak_iops;
  }
  return true;
}, {
  message: "Fixed policies require at least one throughput limit; adaptive policies require at least one IOPS setting"
});

// Get QoS policy schema - using discriminated union for refine validation
const ClusterGetQosPolicySchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  policy_uuid: z.string()
    .uuid("Must be a valid UUID")
    .describe("UUID of the QoS policy")
    .optional(),
  policy_name: z.string()
    .describe("Name of the QoS policy")
    .optional(),
  svm_name: z.string().describe("SVM name to search within").optional()
}).refine(data => data.policy_uuid || data.policy_name, {
  message: "Either policy_uuid or policy_name must be provided"
});

// Update QoS policy schema
const ClusterUpdateQosPolicySchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  policy_uuid: z.string()
    .uuid("Must be a valid UUID")
    .describe("UUID of the QoS policy to update"),
  new_name: z.string()
    .min(1)
    .max(127)
    .regex(/^[a-zA-Z0-9_-]+$/, "Policy name must be alphanumeric with underscores and hyphens only")
    .describe("New policy name")
    .optional(),
  max_throughput: z.string()
    .regex(/^\d+(?:\.\d+)?(iops|IOPS|mb\/s|MB\/s|gb\/s|GB\/s)$/, "Format: number + unit")
    .describe("New maximum throughput (fixed policies only)")
    .optional(),
  min_throughput: z.string()
    .regex(/^\d+(?:\.\d+)?(iops|IOPS|mb\/s|MB\/s|gb\/s|GB\/s)$/, "Format: number + unit")
    .describe("New minimum throughput (fixed policies only)")
    .optional(),
  expected_iops: z.string()
    .regex(/^\d+(?:\.\d+)?iops\/(?:tb|TB|gb|GB)$/, "Format: number + 'iops/TB' or 'iops/GB'")
    .describe("New expected IOPS (adaptive policies only)")
    .optional(),
  peak_iops: z.string()
    .regex(/^\d+(?:\.\d+)?iops\/(?:tb|TB|gb|GB)$/, "Format: number + 'iops/TB' or 'iops/GB'")
    .describe("New peak IOPS (adaptive policies only)")
    .optional(),
  expected_iops_allocation: QosAllocationSchema
    .describe("New expected IOPS allocation method (adaptive policies only)")
    .optional(),
  peak_iops_allocation: QosAllocationSchema
    .describe("New peak IOPS allocation method (adaptive policies only)")
    .optional(),
  is_shared: z.boolean()
    .describe("New shared setting")
    .optional()
});

// Delete QoS policy schema
const ClusterDeleteQosPolicySchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  policy_uuid: z.string()
    .uuid("Must be a valid UUID")
    .describe("UUID of the QoS policy to delete")
});

// ================================
// Tool Definition Functions
// ================================

/**
 * List QoS policies on a registered cluster
 */
export function createClusterListQosPoliciesToolDefinition(): Tool {
  return {
    name: "cluster_list_qos_policies",
    description: "List QoS policy groups on a registered ONTAP cluster, optionally filtered by SVM or policy name pattern",
    inputSchema: {
      type: "object",
      properties: ClusterListQosPoliciesSchema.shape,
      required: ["cluster_name"],
      additionalProperties: false
    }
  };
}

/**
 * Create QoS policy on a registered cluster (supports both fixed and adaptive)
 */
export function createClusterCreateQosPolicyToolDefinition(): Tool {
  return {
    name: "cluster_create_qos_policy",
    description: "Create a QoS policy group (fixed or adaptive) on a registered cluster",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_name: { type: "string", pattern: "^[a-zA-Z0-9_-]+$", minLength: 1, maxLength: 127, description: "QoS policy name (1-127 chars, alphanumeric, underscore, hyphen)" },
        svm_name: { type: "string", description: "SVM name where policy will be created" },
        policy_type: { type: "string", enum: ["fixed", "adaptive"], description: "Type of QoS policy: 'fixed' for absolute limits or 'adaptive' for scaling limits" },
        max_throughput: { type: "string", pattern: "^\\d+(?:\\.\\d+)?(iops|IOPS|mb\\/s|MB\\/s|gb\\/s|GB\\/s)$", description: "Maximum throughput (fixed policy only)" },
        min_throughput: { type: "string", pattern: "^\\d+(?:\\.\\d+)?(iops|IOPS|mb\\/s|MB\\/s|gb\\/s|GB\\/s)$", description: "Minimum guaranteed throughput (fixed policy only)" },
        is_shared: { type: "boolean", default: true, description: "Whether limits apply to all workloads combined (true) or per workload (false)" },
        expected_iops: { type: "string", pattern: "^\\d+(?:\\.\\d+)?iops\\/(tb|TB|gb|GB)$", description: "Expected IOPS per TB/GB (adaptive policy only)" },
        peak_iops: { type: "string", pattern: "^\\d+(?:\\.\\d+)?iops\\/(tb|TB|gb|GB)$", description: "Peak IOPS per TB/GB (adaptive policy only)" },
        expected_iops_allocation: { type: "string", enum: ["used-space", "allocated-space"], default: "used-space", description: "How expected IOPS are calculated (adaptive policy only)" },
        peak_iops_allocation: { type: "string", enum: ["used-space", "allocated-space"], default: "used-space", description: "How peak IOPS are calculated (adaptive policy only)" }
      },
      required: ["cluster_name", "policy_name", "svm_name", "policy_type"],
      additionalProperties: false
    }
  };
}

/**
 * Get specific QoS policy details
 */
export function createClusterGetQosPolicyToolDefinition(): Tool {
  return {
    name: "cluster_get_qos_policy",
    description: "Get detailed information about a specific QoS policy group on a registered cluster",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_uuid: { type: "string", pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", description: "UUID of the QoS policy" },
        policy_name: { type: "string", description: "Name of the QoS policy" },
        svm_name: { type: "string", description: "SVM name to search within" }
      },
      required: ["cluster_name"],
      additionalProperties: false
    }
  };
}

/**
 * Update existing QoS policy
 */
export function createClusterUpdateQosPolicyToolDefinition(): Tool {
  return {
    name: "cluster_update_qos_policy",
    description: "Update an existing QoS policy group's name, limits, or allocation settings on a registered cluster",
    inputSchema: {
      type: "object",
      properties: ClusterUpdateQosPolicySchema.shape,
      required: ["cluster_name", "policy_uuid"],
      additionalProperties: false
    }
  };
}

/**
 * Delete QoS policy
 */
export function createClusterDeleteQosPolicyToolDefinition(): Tool {
  return {
    name: "cluster_delete_qos_policy",
    description: "Delete a QoS policy group from a registered cluster. WARNING: Policy must not be in use by any workloads.",
    inputSchema: {
      type: "object",
      properties: ClusterDeleteQosPolicySchema.shape,
      required: ["cluster_name", "policy_uuid"],
      additionalProperties: false
    }
  };
}

// ================================
// Tool Handler Functions
// ================================

/**
 * Handle listing QoS policies
 */
export async function handleClusterListQosPolicies(args: any, clusterManager: OntapClusterManager): Promise<QosPolicyListResult> {
  const validated = ClusterListQosPoliciesSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  try {
    const params: any = {};
    
    if (validated.svm_name) {
      params.svmName = validated.svm_name;
    }
    
    if (validated.policy_name_pattern) {
      params.policyNamePattern = validated.policy_name_pattern;
    }
    
    if (validated.policy_type) {
      params.policyType = validated.policy_type;
    }

    const policies = await client.listQosPolicies(params);

    // Build structured data array
    const data: QosPolicyListInfo[] = policies.map(policy => ({
      uuid: policy.uuid,
      name: policy.name || 'Unknown',
      svm_name: policy.svm?.name,
      svm_uuid: policy.svm?.uuid,
      type: policy.type,
      is_shared: policy.is_shared,
      workload_count: policy.workload_count,
      fixed: policy.fixed ? {
        max_throughput: policy.fixed.max_throughput,
        min_throughput: policy.fixed.min_throughput
      } : undefined,
      adaptive: policy.adaptive ? {
        expected_iops: policy.adaptive.expected_iops,
        peak_iops: policy.adaptive.peak_iops,
        expected_iops_allocation: policy.adaptive.expected_iops_allocation,
        peak_iops_allocation: policy.adaptive.peak_iops_allocation
      } : undefined
    }));

    // Build human-readable summary
    let summary = '';
    if (policies.length === 0) {
      summary = `No QoS policies found on cluster ${validated.cluster_name}${validated.svm_name ? ` in SVM ${validated.svm_name}` : ''}.`;
    } else {
      summary = `📊 **QoS Policies on ${validated.cluster_name}** (${policies.length} policies):\n\n`;

      policies.forEach(policy => {
        summary += `🎛️ **${policy.name || 'Unknown'}** (${policy.uuid || 'No UUID'})\n`;
        summary += `   • SVM: ${policy.svm?.name || 'Unknown'}\n`;
        summary += `   • Type: ${policy.type || 'unknown'}\n`;
        summary += `   • Shared: ${policy.is_shared ? 'Yes' : 'No'}\n`;
        summary += `   • Workloads: ${policy.workload_count || 0}\n`;

        if (policy.fixed) {
          if (policy.fixed.max_throughput) {
            summary += `   • Max Throughput: ${policy.fixed.max_throughput}\n`;
          }
          if (policy.fixed.min_throughput) {
            summary += `   • Min Throughput: ${policy.fixed.min_throughput}\n`;
          }
        }

        if (policy.adaptive) {
          if (policy.adaptive.expected_iops) {
            summary += `   • Expected IOPS: ${policy.adaptive.expected_iops}\n`;
          }
          if (policy.adaptive.peak_iops) {
            summary += `   • Peak IOPS: ${policy.adaptive.peak_iops}\n`;
          }
        }
        
        summary += '\n';
      });
    }

    return { summary, data };
  } catch (error: any) {
    throw new Error(`Failed to list QoS policies: ${error.message}`);
  }
}

/**
 * Handle creating QoS policy (both fixed and adaptive)
 */
export async function handleClusterCreateQosPolicy(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = ClusterCreateQosPolicySchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  try {
    let response: { uuid: string };

    if (validated.policy_type === 'fixed') {
      const params = {
        name: validated.policy_name,
        svmName: validated.svm_name,
        maxThroughput: validated.max_throughput,
        minThroughput: validated.min_throughput,
        isShared: validated.is_shared
      };

      response = await client.createFixedQosPolicy(params);

      return `✅ **Fixed QoS Policy Created Successfully**\n\n` +
             `🎛️ **Policy Details:**\n` +
             `   • Name: ${validated.policy_name}\n` +
             `   • UUID: ${response.uuid}\n` +
             `   • SVM: ${validated.svm_name}\n` +
             `   • Type: Fixed\n` +
             `   • Shared: ${validated.is_shared ? 'Yes' : 'No'}\n` +
             `${validated.max_throughput ? `   • Max Throughput: ${validated.max_throughput}\n` : ''}` +
             `${validated.min_throughput ? `   • Min Throughput: ${validated.min_throughput}\n` : ''}`;
    } else {
      // Adaptive policy
      const params = {
        name: validated.policy_name,
        svmName: validated.svm_name,
        expectedIops: validated.expected_iops,
        peakIops: validated.peak_iops,
        expectedIopsAllocation: validated.expected_iops_allocation,
        peakIopsAllocation: validated.peak_iops_allocation
      };

      response = await client.createAdaptiveQosPolicy(params);

      return `✅ **Adaptive QoS Policy Created Successfully**\n\n` +
             `🎛️ **Policy Details:**\n` +
             `   • Name: ${validated.policy_name}\n` +
             `   • UUID: ${response.uuid}\n` +
             `   • SVM: ${validated.svm_name}\n` +
             `   • Type: Adaptive\n` +
             `${validated.expected_iops ? `   • Expected IOPS: ${validated.expected_iops}\n` : ''}` +
             `${validated.peak_iops ? `   • Peak IOPS: ${validated.peak_iops}\n` : ''}` +
             `   • Expected IOPS Allocation: ${validated.expected_iops_allocation}\n` +
             `   • Peak IOPS Allocation: ${validated.peak_iops_allocation}\n`;
    }
  } catch (error: any) {
    throw new Error(`Failed to create ${validated.policy_type} QoS policy: ${error.message}`);
  }
}

/**
 * Handle getting QoS policy details
 */
export async function handleClusterGetQosPolicy(args: any, clusterManager: OntapClusterManager): Promise<QosPolicyResult> {
  const validated = ClusterGetQosPolicySchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  try {
    let policy: any;

    if (validated.policy_uuid) {
      policy = await client.getQosPolicy(validated.policy_uuid);
    } else {
      // Search by name
      policy = await client.getQosPolicyByName(validated.policy_name!, validated.svm_name);
    }

    // Build structured data with MCP parameter names
    const data: QosPolicyData = {
      uuid: policy.uuid,
      name: policy.name,
      svm: {
        name: policy.svm.name,
        uuid: policy.svm.uuid
      },
      type: policy.fixed ? 'fixed' : 'adaptive',
      is_shared: policy.is_shared !== undefined ? policy.is_shared : true,
      workload_count: policy.workload_count
    };

    // Add fixed QoS properties (with MCP parameter names)
    if (policy.fixed) {
      data.fixed = {
        max_throughput: policy.fixed.max_throughput,
        min_throughput: policy.fixed.min_throughput
      };
    }

    // Add adaptive QoS properties (with MCP parameter names)
    if (policy.adaptive) {
      data.adaptive = {
        expected_iops: policy.adaptive.expected_iops,
        peak_iops: policy.adaptive.peak_iops,
        expected_iops_allocation: policy.adaptive.expected_iops_allocation,
        peak_iops_allocation: policy.adaptive.peak_iops_allocation
      };
    }

    // Build human-readable summary (keep existing format)
    let summary = `📊 **QoS Policy Details**\n\n`;
    summary += `🎛️ **${policy.name}** (${policy.uuid})\n`;
    summary += `   • SVM: ${policy.svm.name} (${policy.svm.uuid})\n`;
    summary += `   • Type: ${data.type}\n`;
    summary += `   • Shared: ${data.is_shared ? 'Yes' : 'No'}\n`;
    summary += `   • Workloads Using Policy: ${data.workload_count || 0}\n\n`;

    if (data.fixed) {
      summary += `📈 **Fixed Limits:**\n`;
      if (data.fixed.max_throughput) {
        summary += `   • Maximum Throughput: ${data.fixed.max_throughput}\n`;
      }
      if (data.fixed.min_throughput) {
        summary += `   • Minimum Throughput: ${data.fixed.min_throughput}\n`;
      }
    }

    if (data.adaptive) {
      summary += `📊 **Adaptive Scaling:**\n`;
      if (data.adaptive.expected_iops) {
        summary += `   • Expected IOPS: ${data.adaptive.expected_iops}\n`;
      }
      if (data.adaptive.peak_iops) {
        summary += `   • Peak IOPS: ${data.adaptive.peak_iops}\n`;
      }
      if (data.adaptive.expected_iops_allocation) {
        summary += `   • Expected IOPS Allocation: ${data.adaptive.expected_iops_allocation}\n`;
      }
      if (data.adaptive.peak_iops_allocation) {
        summary += `   • Peak IOPS Allocation: ${data.adaptive.peak_iops_allocation}\n`;
      }
    }

    // Return hybrid format
    return { summary, data };
  } catch (error: any) {
    throw new Error(`Failed to get QoS policy: ${error.message}`);
  }
}

/**
 * Handle updating QoS policy
 */
export async function handleClusterUpdateQosPolicy(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = ClusterUpdateQosPolicySchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  try {
    const updates: any = {};

    if (validated.new_name) {
      updates.name = validated.new_name;
    }

    if (validated.max_throughput) {
      updates.maxThroughput = validated.max_throughput;
    }

    if (validated.min_throughput) {
      updates.minThroughput = validated.min_throughput;
    }

    if (validated.expected_iops) {
      updates.expectedIops = validated.expected_iops;
    }

    if (validated.peak_iops) {
      updates.peakIops = validated.peak_iops;
    }

    if (validated.expected_iops_allocation) {
      updates.expectedIopsAllocation = validated.expected_iops_allocation;
    }

    if (validated.peak_iops_allocation) {
      updates.peakIopsAllocation = validated.peak_iops_allocation;
    }

    if (validated.is_shared !== undefined) {
      updates.isShared = validated.is_shared;
    }

    if (Object.keys(updates).length === 0) {
      return `❌ No update parameters provided. Please specify at least one field to update.`;
    }

    await client.updateQosPolicy(validated.policy_uuid, updates);

    return `✅ **QoS Policy Updated Successfully**\n\n` +
           `🎛️ **Policy UUID:** ${validated.policy_uuid}\n` +
           `📝 **Updates Applied:**\n` +
           `${validated.new_name ? `   • New Name: ${validated.new_name}\n` : ''}` +
           `${validated.max_throughput ? `   • New Max Throughput: ${validated.max_throughput}\n` : ''}` +
           `${validated.min_throughput ? `   • New Min Throughput: ${validated.min_throughput}\n` : ''}` +
           `${validated.expected_iops ? `   • New Expected IOPS: ${validated.expected_iops}\n` : ''}` +
           `${validated.peak_iops ? `   • New Peak IOPS: ${validated.peak_iops}\n` : ''}` +
           `${validated.expected_iops_allocation ? `   • New Expected IOPS Allocation: ${validated.expected_iops_allocation}\n` : ''}` +
           `${validated.peak_iops_allocation ? `   • New Peak IOPS Allocation: ${validated.peak_iops_allocation}\n` : ''}` +
           `${validated.is_shared !== undefined ? `   • New Shared Setting: ${validated.is_shared ? 'Yes' : 'No'}\n` : ''}`;
  } catch (error: any) {
    throw new Error(`Failed to update QoS policy: ${error.message}`);
  }
}

/**
 * Handle deleting QoS policy
 */
export async function handleClusterDeleteQosPolicy(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = ClusterDeleteQosPolicySchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  try {
    await client.deleteQosPolicy(validated.policy_uuid);

    return `✅ **QoS Policy Deleted Successfully**\n\n` +
           `🗑️ **Deleted Policy UUID:** ${validated.policy_uuid}\n` +
           `⚠️  **Note:** Any workloads previously using this policy now have no QoS limits applied.`;
  } catch (error: any) {
    if (error.message.includes('policy is in use') || error.message.includes('cannot delete')) {
      throw new Error(`Cannot delete QoS policy: Policy is currently in use by one or more workloads. Remove the policy from all volumes/LUNs before deletion.`);
    }
    throw new Error(`Failed to delete QoS policy: ${error.message}`);
  }
}