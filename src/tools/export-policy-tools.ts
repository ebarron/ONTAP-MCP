/**
 * MCP Tools for NetApp ONTAP NFS Export Policy Management
 * These tools provide export policy and rule CRUD operations for ONTAP clusters
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OntapApiClient, OntapClusterManager } from '../ontap-client.js';
import type { 
  CreateExportPolicyRequest, 
  CreateExportRuleRequest, 
  UpdateExportRuleRequest,
  NfsProtocol,
  NfsAccess,
  NfsAuthMethod,
  SuperUserAccess
} from '../types/export-policy-types.js';

// ================================
// Zod Schemas for Input Validation
// ================================

const ClientMatchSchema = z.object({
  match: z.string().describe("Client specification - IP, subnet, hostname, netgroup, etc.")
});

const NfsProtocolSchema = z.enum(['any', 'nfs', 'nfs3', 'nfs4', 'nfs41']);
const NfsAccessSchema = z.enum(['none', 'readonly', 'rw']);
const NfsAuthMethodSchema = z.enum(['any', 'none', 'never', 'krb5', 'krb5i', 'krb5p', 'ntlm', 'sys']);
const SuperUserAccessSchema = z.enum(['any', 'none', 'never', 'krb5', 'krb5i', 'krb5p', 'ntlm', 'sys']);

const ExportRuleSchema = z.object({
  clients: z.array(ClientMatchSchema).min(1).describe("Client specifications that this rule applies to"),
  protocols: z.array(NfsProtocolSchema).default(['nfs3', 'nfs4']).describe("Allowed NFS protocols"),
  ro_rule: z.array(NfsAuthMethodSchema).default(['sys']).describe("Read-only access authentication methods"),
  rw_rule: z.array(NfsAuthMethodSchema).default(['none']).describe("Read-write access authentication methods"),
  superuser: z.array(SuperUserAccessSchema).default(['none']).describe("Superuser access authentication methods"),
  index: z.number().min(1).max(999).optional().describe("Rule index within the policy"),
  allow_device_creation: z.boolean().default(true).describe("Whether to allow device creation"),
  allow_suid: z.boolean().default(false).describe("Whether to allow set UID"),
  anonymous_user: z.string().default('65534').describe("Anonymous user ID mapping"),
  comment: z.string().optional().describe("Rule comment/description")
});

const CreateExportPolicySchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  policy_name: z.string().describe("Name for the export policy"),
  svm_name: z.string().describe("SVM name where policy will be created"),
  comment: z.string().describe("Optional description for the policy").optional()
});

const ListExportPoliciesSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  svm_name: z.string().describe("Filter by SVM name").optional(),
  policy_name_pattern: z.string().describe("Filter by policy name pattern").optional()
});

const GetExportPolicySchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  policy_name: z.string().describe("Name or ID of the export policy"),
  svm_name: z.string().describe("SVM name to search within").optional()
});

const DeleteExportPolicySchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  policy_name: z.string().describe("Name or ID of the export policy to delete"),
  svm_name: z.string().describe("SVM name where policy exists").optional()
});

const AddExportRuleSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  policy_name: z.string().describe("Name or ID of the export policy"),
  svm_name: z.string().describe("SVM name where policy exists").optional(),
  clients: z.array(ClientMatchSchema).min(1).describe("Client specifications"),
  protocols: z.array(NfsProtocolSchema).default(['nfs3', 'nfs4']).describe("Allowed NFS protocols"),
  ro_rule: z.array(NfsAuthMethodSchema).default(['sys']).describe("Read-only access methods"),
  rw_rule: z.array(NfsAuthMethodSchema).default(['none']).describe("Read-write access methods"),
  superuser: z.array(SuperUserAccessSchema).default(['none']).describe("Superuser access methods"),
  index: z.number().min(1).max(999).optional().describe("Rule index"),
  allow_device_creation: z.boolean().default(true).describe("Allow device creation"),
  allow_suid: z.boolean().default(false).describe("Allow set UID"),
  anonymous_user: z.string().default('65534').describe("Anonymous user mapping"),
  comment: z.string().optional().describe("Rule comment")
});

const UpdateExportRuleSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  policy_name: z.string().describe("Name or ID of the export policy"),
  rule_index: z.number().min(1).describe("Index of the rule to update"),
  svm_name: z.string().describe("SVM name where policy exists").optional(),
  clients: z.array(ClientMatchSchema).optional().describe("Updated client specifications"),
  protocols: z.array(NfsProtocolSchema).optional().describe("Updated NFS protocols"),
  ro_rule: z.array(NfsAuthMethodSchema).optional().describe("Updated read-only access methods"),
  rw_rule: z.array(NfsAuthMethodSchema).optional().describe("Updated read-write access methods"),
  superuser: z.array(SuperUserAccessSchema).optional().describe("Updated superuser access methods"),
  allow_device_creation: z.boolean().optional().describe("Updated device creation setting"),
  allow_suid: z.boolean().optional().describe("Updated set UID setting"),
  anonymous_user: z.string().optional().describe("Updated anonymous user mapping"),
  comment: z.string().optional().describe("Updated rule comment")
});

const DeleteExportRuleSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster").optional(),
  username: z.string().describe("Username for authentication").optional(),
  password: z.string().describe("Password for authentication").optional(),
  cluster_name: z.string().describe("Name of the registered cluster").optional(),
  policy_name: z.string().describe("Name or ID of the export policy"),
  rule_index: z.number().min(1).describe("Index of the rule to delete"),
  svm_name: z.string().describe("SVM name where policy exists").optional()
});

// ================================
// Helper Functions
// ================================

/**
 * Get API client from either cluster credentials or cluster registry
 */
function getApiClient(
  clusterManager: OntapClusterManager,
  clusterName?: string,
  clusterIp?: string,
  username?: string,
  password?: string
): OntapApiClient {
  if (clusterName) {
    return clusterManager.getClient(clusterName);
  } else if (clusterIp && username && password) {
    return new OntapApiClient(clusterIp, username, password);
  } else {
    throw new Error("Either cluster_name or (cluster_ip, username, password) must be provided");
  }
}

/**
 * Format export rule for display
 */
function formatExportRule(rule: any): string {
  let result = `   📏 **Rule ${rule.index}**\n`;
  result += `      👥 Clients: ${rule.clients?.map((c: any) => c.match).join(', ')}\n`;
  result += `      🔌 Protocols: ${rule.protocols?.join(', ')}\n`;
  result += `      📖 Read-Only: ${rule.ro_rule?.join(', ')}\n`;
  result += `      📝 Read-Write: ${rule.rw_rule?.join(', ')}\n`;
  result += `      👑 Superuser: ${rule.superuser?.join(', ')}\n`;
  if (rule.comment) result += `      💬 Comment: ${rule.comment}\n`;
  result += `      🔧 Device Creation: ${rule.allow_device_creation ? '✅' : '❌'}\n`;
  result += `      🔒 Allow SUID: ${rule.allow_suid ? '✅' : '❌'}\n`;
  if (rule.anonymous_user) result += `      👤 Anonymous User: ${rule.anonymous_user}\n`;
  return result;
}

// ================================
// MCP Tool Implementations
// ================================

/**
 * List all export policies
 */
export function createListExportPoliciesToolDefinition(): Tool {
  return {
    name: "list_export_policies",
    description: "List all NFS export policies on an ONTAP cluster, optionally filtered by SVM or name pattern",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        svm_name: { type: "string", description: "Filter by SVM name" },
        policy_name_pattern: { type: "string", description: "Filter by policy name pattern" }
      }
    }
  };
}

export async function handleListExportPolicies(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = ListExportPoliciesSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  const queryParams: any = {};
  if (params.svm_name) queryParams['svm.name'] = params.svm_name;
  if (params.policy_name_pattern) queryParams['name'] = params.policy_name_pattern;

  const policies = await client.listExportPolicies(queryParams);

  if (policies.length === 0) {
    return "No export policies found matching the specified criteria.";
  }

  let result = `Found ${policies.length} export policies:\n\n`;
  
  for (const policy of policies) {
    result += `🔐 **${policy.name}** (ID: ${policy.id})\n`;
    if (policy.svm) result += `   🏢 SVM: ${policy.svm.name}\n`;
    if (policy.comment) result += `   📝 Description: ${policy.comment}\n`;
    
    if (policy.rules && policy.rules.length > 0) {
      result += `   📏 Rules: ${policy.rules.length}\n`;
      for (const rule of policy.rules.slice(0, 3)) { // Show first 3 rules
        result += `     • Rule ${rule.index}: ${rule.clients?.map((c: any) => c.match).join(', ')}\n`;
      }
      if (policy.rules.length > 3) {
        result += `     • ... and ${policy.rules.length - 3} more rules\n`;
      }
    } else {
      result += `   📏 Rules: None\n`;
    }
    result += `\n`;
  }

  return result;
}

/**
 * Get detailed information about a specific export policy
 */
export function createGetExportPolicyToolDefinition(): Tool {
  return {
    name: "get_export_policy",
    description: "Get detailed information about a specific export policy including all rules",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_name: { type: "string", description: "Name or ID of the export policy" },
        svm_name: { type: "string", description: "SVM name to search within" }
      },
      required: ["policy_name"]
    }
  };
}

export async function handleGetExportPolicy(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = GetExportPolicySchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  const policy = await client.getExportPolicy(params.policy_name, params.svm_name);
  const rules = await client.listExportRules(policy.id!, params.svm_name);

  let result = `🔐 **Export Policy: ${policy.name}**\n\n`;
  result += `🆔 ID: ${policy.id}\n`;
  if (policy.comment) result += `📝 Description: ${policy.comment}\n`;
  if (policy.svm) result += `🏢 SVM: ${policy.svm.name} (${policy.svm.uuid})\n`;
  
  if (rules && rules.length > 0) {
    result += `\n📏 **Export Rules (${rules.length}):**\n\n`;
    for (const rule of rules) {
      result += formatExportRule(rule);
      result += `\n`;
    }
  } else {
    result += `\n📏 **Export Rules:** None configured\n`;
  }

  return result;
}

/**
 * Create a new export policy
 */
export function createCreateExportPolicyToolDefinition(): Tool {
  return {
    name: "create_export_policy",
    description: "Create a new NFS export policy (rules must be added separately)",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_name: { type: "string", description: "Name for the export policy" },
        svm_name: { type: "string", description: "SVM name where policy will be created" },
        comment: { type: "string", description: "Optional description for the policy" }
      },
      required: ["policy_name", "svm_name"]
    }
  };
}

export async function handleCreateExportPolicy(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = CreateExportPolicySchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  const policyRequest: CreateExportPolicyRequest = {
    name: params.policy_name,
    svm: { name: params.svm_name }
  };

  if (params.comment) policyRequest.comment = params.comment;

  const response = await client.createExportPolicy(policyRequest);

  let result = `✅ **Export policy '${params.policy_name}' created successfully!**\n\n`;
  result += `🆔 ID: ${response.id}\n`;
  result += `📋 Name: ${params.policy_name}\n`;
  result += `🏢 SVM: ${params.svm_name}\n`;
  if (params.comment) result += `📝 Description: ${params.comment}\n`;
  
  result += `\n💡 **Next Steps:**\n`;
  result += `   • Add export rules using: add_export_rule\n`;
  result += `   • Apply to volumes using: configure_volume_nfs_access\n`;
  result += `   • View policy details using: get_export_policy\n`;

  return result;
}

/**
 * Delete an export policy
 */
export function createDeleteExportPolicyToolDefinition(): Tool {
  return {
    name: "delete_export_policy",
    description: "Delete an NFS export policy. Warning: Policy must not be in use by any volumes.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_name: { type: "string", description: "Name or ID of the export policy to delete" },
        svm_name: { type: "string", description: "SVM name where policy exists" }
      },
      required: ["policy_name"]
    }
  };
}

export async function handleDeleteExportPolicy(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = DeleteExportPolicySchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  await client.deleteExportPolicy(params.policy_name, params.svm_name);

  return `✅ **Export policy '${params.policy_name}' deleted successfully!**\n\n⚠️ **Important:** Make sure no volumes were using this policy, or they will revert to the default export policy.`;
}

/**
 * Add an export rule to a policy
 */
export function createAddExportRuleToolDefinition(): Tool {
  return {
    name: "add_export_rule",
    description: "Add a new export rule to an existing export policy",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_name: { type: "string", description: "Name or ID of the export policy" },
        svm_name: { type: "string", description: "SVM name where policy exists" },
        clients: {
          type: "array",
          description: "Client specifications",
          items: {
            type: "object",
            properties: {
              match: { type: "string", description: "Client specification" }
            },
            required: ["match"]
          }
        },
        protocols: {
          type: "array",
          description: "Allowed NFS protocols",
          items: { type: "string", enum: ["any", "nfs", "nfs3", "nfs4", "nfs41"] }
        },
        ro_rule: {
          type: "array",
          description: "Read-only access methods",
          items: { type: "string", enum: ["any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"] }
        },
        rw_rule: {
          type: "array",
          description: "Read-write access methods",
          items: { type: "string", enum: ["any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"] }
        },
        superuser: {
          type: "array",
          description: "Superuser access methods",
          items: { type: "string", enum: ["any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"] }
        },
        index: { type: "number", description: "Rule index" },
        allow_device_creation: { type: "boolean", description: "Allow device creation" },
        allow_suid: { type: "boolean", description: "Allow set UID" },
        anonymous_user: { type: "string", description: "Anonymous user mapping" },
        comment: { type: "string", description: "Rule comment" }
      },
      required: ["policy_name", "clients"]
    }
  };
}

export async function handleAddExportRule(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = AddExportRuleSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  const ruleRequest: CreateExportRuleRequest = {
    clients: params.clients,
    protocols: params.protocols as NfsProtocol[],
    ro_rule: params.ro_rule as NfsAuthMethod[],
    rw_rule: params.rw_rule as NfsAuthMethod[],
    superuser: params.superuser as SuperUserAccess[],
    allow_device_creation: params.allow_device_creation,
    allow_suid: params.allow_suid,
    anonymous_user: params.anonymous_user
  };

  if (params.index) ruleRequest.index = params.index;
  if (params.comment) ruleRequest.comment = params.comment;

  const response = await client.addExportRule(params.policy_name, ruleRequest, params.svm_name);

  let result = `✅ **Export rule added successfully!**\n\n`;
  result += `🔐 **Policy:** ${params.policy_name}\n`;
  result += `📏 **Rule Index:** ${response.index}\n`;
  result += `👥 **Clients:** ${params.clients.map(c => c.match).join(', ')}\n`;
  result += `🔌 **Protocols:** ${params.protocols.join(', ')}\n`;
  result += `📖 **Read-Only:** ${params.ro_rule.join(', ')}\n`;
  result += `📝 **Read-Write:** ${params.rw_rule.join(', ')}\n`;
  result += `👑 **Superuser:** ${params.superuser.join(', ')}\n`;
  if (params.comment) result += `💬 **Comment:** ${params.comment}\n`;
  
  result += `\n💡 Use get_export_policy to view the complete policy configuration.`;

  return result;
}

/**
 * Update an existing export rule
 */
export function createUpdateExportRuleToolDefinition(): Tool {
  return {
    name: "update_export_rule",
    description: "Update an existing export rule in an export policy",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_name: { type: "string", description: "Name or ID of the export policy" },
        rule_index: { type: "number", description: "Index of the rule to update" },
        svm_name: { type: "string", description: "SVM name where policy exists" },
        clients: {
          type: "array",
          description: "Updated client specifications",
          items: {
            type: "object",
            properties: {
              match: { type: "string", description: "Client specification" }
            },
            required: ["match"]
          }
        },
        protocols: {
          type: "array",
          description: "Updated NFS protocols",
          items: { type: "string", enum: ["any", "nfs", "nfs3", "nfs4", "nfs41"] }
        },
        ro_rule: {
          type: "array",
          description: "Updated read-only access methods",
          items: { type: "string", enum: ["any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"] }
        },
        rw_rule: {
          type: "array",
          description: "Updated read-write access methods",
          items: { type: "string", enum: ["any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"] }
        },
        superuser: {
          type: "array",
          description: "Updated superuser access methods",
          items: { type: "string", enum: ["any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"] }
        },
        allow_device_creation: { type: "boolean", description: "Updated device creation setting" },
        allow_suid: { type: "boolean", description: "Updated set UID setting" },
        anonymous_user: { type: "string", description: "Updated anonymous user mapping" },
        comment: { type: "string", description: "Updated rule comment" }
      },
      required: ["policy_name", "rule_index"]
    }
  };
}

export async function handleUpdateExportRule(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = UpdateExportRuleSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  const updates: UpdateExportRuleRequest = {};
  
  if (params.clients) updates.clients = params.clients;
  if (params.protocols) updates.protocols = params.protocols as NfsProtocol[];
  if (params.ro_rule) updates.ro_rule = params.ro_rule as NfsAuthMethod[];
  if (params.rw_rule) updates.rw_rule = params.rw_rule as NfsAuthMethod[];
  if (params.superuser) updates.superuser = params.superuser as SuperUserAccess[];
  if (params.allow_device_creation !== undefined) updates.allow_device_creation = params.allow_device_creation;
  if (params.allow_suid !== undefined) updates.allow_suid = params.allow_suid;
  if (params.anonymous_user) updates.anonymous_user = params.anonymous_user;
  if (params.comment !== undefined) updates.comment = params.comment;

  await client.updateExportRule(params.policy_name, params.rule_index, updates, params.svm_name);

  let result = `✅ **Export rule updated successfully!**\n\n`;
  result += `🔐 **Policy:** ${params.policy_name}\n`;
  result += `📏 **Rule Index:** ${params.rule_index}\n`;
  
  if (params.clients) result += `👥 **Clients:** ${params.clients.map(c => c.match).join(', ')}\n`;
  if (params.protocols) result += `🔌 **Protocols:** ${params.protocols.join(', ')}\n`;
  if (params.ro_rule) result += `📖 **Read-Only:** ${params.ro_rule.join(', ')}\n`;
  if (params.rw_rule) result += `📝 **Read-Write:** ${params.rw_rule.join(', ')}\n`;
  if (params.superuser) result += `👑 **Superuser:** ${params.superuser.join(', ')}\n`;
  if (params.comment !== undefined) result += `💬 **Comment:** ${params.comment}\n`;

  result += `\n💡 Use get_export_policy to view the complete updated configuration.`;

  return result;
}

/**
 * Delete an export rule from a policy
 */
export function createDeleteExportRuleToolDefinition(): Tool {
  return {
    name: "delete_export_rule",
    description: "Delete an export rule from an export policy",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        policy_name: { type: "string", description: "Name or ID of the export policy" },
        rule_index: { type: "number", description: "Index of the rule to delete" },
        svm_name: { type: "string", description: "SVM name where policy exists" }
      },
      required: ["policy_name", "rule_index"]
    }
  };
}

export async function handleDeleteExportRule(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = DeleteExportRuleSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  await client.deleteExportRule(params.policy_name, params.rule_index, params.svm_name);

  return `✅ **Export rule ${params.rule_index} deleted successfully from policy '${params.policy_name}'!**\n\n💡 Use get_export_policy to view the updated policy configuration.`;
}

