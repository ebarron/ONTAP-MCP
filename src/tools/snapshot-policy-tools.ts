/**
 * MCP Tools for NetApp ONTAP Snapshot Policy Management
 * These tools provide snapshot policy CRUD operations for ONTAP clusters
 * 
 * Author: Ed Barron
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OntapApiClient, OntapClusterManager } from '../ontap-client.js';

// ================================
// Zod Schemas for Input Validation
// ================================

const SnapshotCopySchema = z.object({
  count: z.number().min(0).max(1023).describe("Number of snapshots to keep"),
  schedule: z.object({
    name: z.string().describe("Schedule name reference")
  }).describe("Schedule configuration"),
  prefix: z.string().optional().describe("Optional prefix for snapshot names"),
  retention: z.string().optional().describe("Retention period in ISO 8601 duration format (e.g., 'P30D' for 30 days)")
});

const CreateSnapshotPolicySchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  policy_name: z.string().describe("Name for the snapshot policy"),
  comment: z.string().describe("Optional description for the policy").optional(),
  svm_name: z.string().describe("SVM name where policy will be created").optional(),
  copies: z.array(SnapshotCopySchema).describe("Array of snapshot copies with schedule references").optional(),
  enabled: z.boolean().default(true).describe("Whether the policy should be enabled")
});

const ListSnapshotPoliciesSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  svm_name: z.string().describe("Filter by SVM name").optional(),
  policy_name_pattern: z.string().describe("Filter by policy name pattern").optional(),
  enabled: z.boolean().describe("Filter by enabled status").optional()
});

const GetSnapshotPolicySchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  policy_name: z.string().describe("Name or UUID of the snapshot policy"),
  svm_name: z.string().describe("SVM name to search within").optional()
});

const DeleteSnapshotPolicySchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  policy_name: z.string().describe("Name or UUID of the snapshot policy to delete"),
  svm_name: z.string().describe("SVM name where policy exists").optional()
});

// Helper function
function getApiClient(
  clusterManager: OntapClusterManager,
  clusterName?: string,
  clusterIp?: string,
  username?: string,
  password?: string
): OntapApiClient {
  if (clusterName) {
    return clusterManager.getClient(clusterName);
  }
  
  if (clusterIp && username && password) {
    return new OntapApiClient(clusterIp, username, password);
  }
  
  throw new Error("Either cluster_name or (cluster_ip + username + password) must be provided");
}


// Tool definition
export function createCreateSnapshotPolicyToolDefinition(): Tool {
  return {
    name: "create_snapshot_policy",
    description: "Create a new snapshot policy with specified copies configuration",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_name: { type: "string", description: "Name for the snapshot policy" },
        comment: { type: "string", description: "Optional description for the policy" },
        svm_name: { type: "string", description: "SVM name where policy will be created" },
        copies: {
          type: "array",
          description: "Array of snapshot copies with schedule references",
          items: {
            type: "object",
            properties: {
              count: { type: "number", description: "Number of snapshots to keep" },
              schedule: {
                type: "object",
                description: "Schedule configuration",
                properties: {
                  name: { type: "string", description: "Schedule name reference" }
                },
                required: ["name"]
              },
              prefix: { type: "string", description: "Optional snapshot name prefix" },
              retention: { type: "string", description: "Retention period" }
            },
            required: ["count", "schedule"]
          }
        },
        enabled: { type: "boolean", description: "Whether the policy should be enabled" }
      },
      required: ["policy_name"]
    }
  };
}

/**
 * List all snapshot policies on an ONTAP cluster
 */
export function createListSnapshotPoliciesToolDefinition(): Tool {
  return {
    name: "list_snapshot_policies",
    description: "List all snapshot policies on an ONTAP cluster, optionally filtered by SVM or name pattern",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: {
          type: "string",
          description: "Name of the registered cluster"
        },
        cluster_ip: {
          type: "string",
          description: "IP address or FQDN of the ONTAP cluster"
        },
        username: {
          type: "string",
          description: "Username for authentication"
        },
        password: {
          type: "string",
          description: "Password for authentication"
        },
        svm_name: {
          type: "string",
          description: "Filter by SVM name"
        },
        policy_name_pattern: {
          type: "string",
          description: "Filter by policy name pattern"
        },
        enabled: {
          type: "boolean",
          description: "Filter by enabled status"
        }
      },
      required: ["cluster_name"]
    }
  };
}

/**
 * Get detailed information about a specific snapshot policy
 */
export function createGetSnapshotPolicyToolDefinition(): Tool {
  return {
    name: "get_snapshot_policy",
    description: "Get detailed information about a specific snapshot policy by name or UUID",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_name: { type: "string", description: "Name or UUID of the snapshot policy" },
        svm_name: { type: "string", description: "SVM name to search within" }
      },
      required: ["policy_name"]
    }
  };
}

/**
 * Delete a snapshot policy
 */
export function createDeleteSnapshotPolicyToolDefinition(): Tool {
  return {
    name: "delete_snapshot_policy",
    description: "Delete a snapshot policy. WARNING: Policy must not be in use by any volumes.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_name: { type: "string", description: "Name or UUID of the snapshot policy to delete" },
        svm_name: { type: "string", description: "SVM name where policy exists" }
      },
      required: ["policy_name"]
    }
  };
}


// Handler function
export async function handleCreateSnapshotPolicy(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = CreateSnapshotPolicySchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    // Create policy request with the correct ONTAP format
    const policyRequest: any = {
      name: params.policy_name,
      enabled: params.enabled || true
    };

    // Add optional fields only if provided
    if (params.comment) {
      policyRequest.comment = params.comment;
    }
    if (params.svm_name) {
      policyRequest.svm = { name: params.svm_name };
    }

    // Use the copies format (this is the working format)
    if (params.copies && params.copies.length > 0) {
      policyRequest.copies = params.copies.map(copy => ({
        schedule: {
          name: copy.schedule.name
        },
        count: copy.count.toString(), // ONTAP expects string
        ...(copy.prefix && { prefix: copy.prefix })
      }));
    }

    console.error(`🔍 Debug: Policy request being sent:`, JSON.stringify(policyRequest, null, 2));

    const response = await client.createSnapshotPolicy(policyRequest);

    let result = `✅ **Snapshot policy '${params.policy_name}' created successfully!**\n\n`;
    result += `🆔 UUID: ${response.uuid}\n`;
    result += `📋 Name: ${params.policy_name}\n`;
    if (params.comment) result += `📝 Description: ${params.comment}\n`;
    if (params.svm_name) result += `🏢 SVM: ${params.svm_name}\n`;
    result += `⚡ Enabled: ${params.enabled ? '✅ Yes' : '❌ No'}\n\n`;
    
    if (policyRequest.copies && policyRequest.copies.length > 0) {
      result += `📅 **Copies configured:**\n`;
      policyRequest.copies.forEach((copy: any, index: number) => {
        result += `   ${index + 1}. Schedule: ${copy.schedule.name}, Count: ${copy.count}`;
        if (copy.prefix) result += `, Prefix: ${copy.prefix}`;
        result += `\n`;
      });
    } else {
      result += `📅 **Copies:** None (basic policy created)\n`;
    }

    result += `\n🚀 **Next Steps:**\n`;
    result += `   • Apply to volumes using: apply_snapshot_policy_to_volume\n`;
    result += `   • View policy details using: get_snapshot_policy\n`;

    return result;
  } catch (error) {
    return `❌ Error creating snapshot policy: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function handleListSnapshotPolicies(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = ListSnapshotPoliciesSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  // Filter out MCP-specific parameters and only pass ONTAP API parameters
  const apiParams: any = {};
  if (params.svm_name) apiParams['svm.name'] = params.svm_name;
  if (params.policy_name_pattern) apiParams['name'] = params.policy_name_pattern;
  if (params.enabled !== undefined) apiParams['enabled'] = params.enabled;

  try {
    const policies = await client.listSnapshotPolicies(apiParams);

    if (!policies || policies.length === 0) {
      return "📭 **No snapshot policies found** matching the specified criteria.";
    }

    let result = `📋 **Found ${policies.length} snapshot policies:**\n\n`;

    policies.forEach((policy, index) => {
      result += `**${index + 1}. ${policy.name}**\n`;
      result += `   🆔 UUID: ${policy.uuid}\n`;
      if (policy.comment) result += `   📝 Description: ${policy.comment}\n`;
      if (policy.svm?.name) result += `   🏢 SVM: ${policy.svm.name}\n`;
      result += `   ⚡ Enabled: ${policy.enabled ? '✅ Yes' : '❌ No'}\n`;
      
      if (policy.copies && policy.copies.length > 0) {
        result += `   📅 Copies: ${policy.copies.length} configured\n`;
      } else {
        result += `   📅 Copies: None configured\n`;
      }
      result += `\n`;
    });

    result += `📖 **Usage:**\n`;
    result += `   • View details: get_snapshot_policy\n`;
    result += `   • Apply to volume: apply_snapshot_policy_to_volume\n`;
    result += `   • Update policy: update_snapshot_policy\n`;

    return result;
  } catch (error) {
    return `❌ Error listing snapshot policies: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function handleGetSnapshotPolicy(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = GetSnapshotPolicySchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    const policy = await client.getSnapshotPolicy(params.policy_name, params.svm_name);

    let result = `📋 **Snapshot Policy Details: ${policy.name}**\n\n`;
    result += `🆔 **UUID:** ${policy.uuid}\n`;
    result += `📝 **Description:** ${policy.comment || 'None'}\n`;
    if (policy.svm?.name) result += `🏢 **SVM:** ${policy.svm.name}\n`;
    result += `⚡ **Enabled:** ${policy.enabled ? '✅ Yes' : '❌ No'}\n`;
    result += `🔄 **Scope:** ${policy.scope || 'svm'}\n\n`;

    if (policy.copies && policy.copies.length > 0) {
      result += `📅 **Copies (${policy.copies.length} configured):**\n`;
      policy.copies.forEach((copy, index) => {
        result += `   **${index + 1}.** Schedule: ${copy.schedule?.name || 'N/A'}\n`;
        result += `        Count: ${copy.count}\n`;
        if (copy.prefix) result += `        Prefix: ${copy.prefix}\n`;
        if (copy.retention) result += `        Retention: ${copy.retention}\n`;
        result += `\n`;
      });
    } else {
      result += `📅 **Copies:** None configured\n\n`;
    }

    result += `🚀 **Available Actions:**\n`;
    result += `   • Apply to volume: apply_snapshot_policy_to_volume\n`;
    result += `   • Update policy: update_snapshot_policy\n`;
    result += `   • Delete policy: delete_snapshot_policy\n`;

    return result;
  } catch (error) {
    return `❌ Error retrieving snapshot policy: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function handleDeleteSnapshotPolicy(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = DeleteSnapshotPolicySchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    // First, try to get the policy to confirm it exists and show what's being deleted
    let policyInfo = '';
    try {
      const policy = await client.getSnapshotPolicy(params.policy_name, params.svm_name);
      policyInfo = `📋 **Deleting Policy:** ${policy.name}\n`;
      policyInfo += `🆔 UUID: ${policy.uuid}\n`;
      if (policy.comment) policyInfo += `📝 Description: ${policy.comment}\n`;
      if (policy.svm?.name) policyInfo += `🏢 SVM: ${policy.svm.name}\n`;
      policyInfo += `\n`;
    } catch {
      // If we can't get the policy details, continue with deletion anyway
      policyInfo = `📋 **Deleting Policy:** ${params.policy_name}\n\n`;
    }

    // Attempt to delete the policy
    await client.deleteSnapshotPolicy(params.policy_name);

    let result = `✅ **Snapshot policy deleted successfully!**\n\n`;
    result += policyInfo;
    result += `🗑️ **Status:** Policy has been permanently removed\n\n`;
    result += `⚠️ **Important Notes:**\n`;
    result += `   • This action is irreversible\n`;
    result += `   • Any volumes using this policy will revert to default snapshot behavior\n`;
    result += `   • Consider creating a new policy if snapshot protection is still needed\n\n`;
    result += `🚀 **Next Steps:**\n`;
    result += `   • Review volumes that may have used this policy\n`;
    result += `   • Create new policies if needed: create_snapshot_policy\n`;
    result += `   • Apply appropriate policies to volumes: apply_snapshot_policy_to_volume\n`;

    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('409')) {
      return `❌ **Cannot delete snapshot policy '${params.policy_name}'**\n\n` +
             `🚫 **Reason:** Policy is currently in use by one or more volumes\n\n` +
             `🔧 **To resolve this:**\n` +
             `   1. List volumes using this policy: list_volumes\n` +
             `   2. Apply a different policy or revert to default for each volume\n` +
             `   3. Then retry the deletion\n\n` +
             `💡 **Alternative:** Use disable_snapshot_policy to keep the policy but disable it`;
    }
    return `❌ Error deleting snapshot policy: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Export all snapshot policy tools
export const snapshotPolicyTools = [
  createCreateSnapshotPolicyToolDefinition(),
  createListSnapshotPoliciesToolDefinition(),
  createGetSnapshotPolicyToolDefinition(),
  createDeleteSnapshotPolicyToolDefinition()
];

export const snapshotPolicyHandlers = {
  create_snapshot_policy: handleCreateSnapshotPolicy,
  list_snapshot_policies: handleListSnapshotPolicies,
  get_snapshot_policy: handleGetSnapshotPolicy,
  delete_snapshot_policy: handleDeleteSnapshotPolicy
};

