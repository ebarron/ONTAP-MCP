/**
 * NetApp ONTAP MCP CIFS Share Management Tools
 * 
 * This module provides comprehensive CIFS/SMB share management functionality including:
 * - CIFS share lifecycle management (create, list, update, delete)
 * - CIFS share access control configuration
 * - Volume-integrated CIFS share creation
 * - Both single-cluster and multi-cluster operations
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OntapApiClient, OntapClusterManager } from '../ontap-client.js';
import type {
  CifsShareInfo,
  CifsShareListInfo,
  CifsShareListResult,
  CreateCifsShareRequest,
  UpdateCifsShareRequest,
  DeleteCifsShareParams,
  UpdateCifsShareAclParams,
  ListCifsSharesParams,
  CifsAccessPermission
} from '../types/cifs-types.js';

// ================================
// Zod Schemas for Input Validation
// ================================

const CifsAccessControlEntrySchema = z.object({
  permission: z.enum(['no_access', 'read', 'change', 'full_control']).describe("Permission level"),
  user_or_group: z.string().describe("User or group name"),
  type: z.enum(['windows', 'unix_user', 'unix_group']).optional().describe("Type of user/group")
});

const CifsSharePropertiesSchema = z.object({
  access_based_enumeration: z.boolean().optional().describe("Enable access-based enumeration"),
  branch_cache: z.boolean().optional().describe("Enable BranchCache"),
  change_notify: z.boolean().optional().describe("Enable change notify"),
  encryption: z.boolean().optional().describe("Enable encryption"),
  home_directory: z.boolean().optional().describe("Home directory"),
  namespace_caching: z.boolean().optional().describe("Namespace caching"),
  no_strict_locks: z.boolean().optional().describe("No strict locks"),
  offline_files: z.enum(['none', 'manual', 'documents', 'programs']).optional().describe("Offline files policy"),
  oplocks: z.boolean().optional().describe("Oplocks"),
  show_snapshot: z.boolean().optional().describe("Show snapshot")
});

// Legacy single-cluster schemas
const CreateCifsShareSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  name: z.string().describe("CIFS share name"),
  path: z.string().describe("Volume path (typically /vol/volume_name)"),
  svm_name: z.string().describe("SVM name where share will be created"),
  comment: z.string().optional().describe("Optional share comment"),
  properties: CifsSharePropertiesSchema.optional().describe("Share properties"),
  access_control: z.array(CifsAccessControlEntrySchema).optional().describe("Access control entries")
});

const ListCifsSharesSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  svm_name: z.string().optional().describe("Filter by SVM name"),
  share_name_pattern: z.string().optional().describe("Filter by share name pattern"),
  volume_name: z.string().optional().describe("Filter by volume name")
});

const GetCifsShareSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  name: z.string().describe("CIFS share name"),
  svm_name: z.string().describe("SVM name where share exists")
});

const UpdateCifsShareSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  name: z.string().describe("CIFS share name"),
  svm_name: z.string().describe("SVM name where share exists"),
  comment: z.string().optional().describe("Updated share comment"),
  properties: CifsSharePropertiesSchema.optional().describe("Updated share properties"),
  access_control: z.array(CifsAccessControlEntrySchema).optional().describe("Updated access control entries")
});

const DeleteCifsShareSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  name: z.string().describe("CIFS share name"),
  svm_name: z.string().describe("SVM name where share exists")
});

// Multi-cluster schemas
const ClusterCreateCifsShareSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  name: z.string().describe("CIFS share name"),
  path: z.string().describe("Volume path (typically /vol/volume_name)"),
  svm_name: z.string().describe("SVM name where share will be created"),
  comment: z.string().optional().describe("Optional share comment"),
  properties: CifsSharePropertiesSchema.optional().describe("Share properties"),
  access_control: z.array(CifsAccessControlEntrySchema).optional().describe("Access control entries")
});

const ClusterCifsShareSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  name: z.string().describe("CIFS share name"),
  svm_name: z.string().describe("SVM name where share exists")
});

const ClusterListCifsSharesSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  svm_name: z.string().optional().describe("Filter by SVM name"),
  share_name_pattern: z.string().optional().describe("Filter by share name pattern"),
  volume_name: z.string().optional().describe("Filter by volume name")
});

const ClusterUpdateCifsShareSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  name: z.string().describe("CIFS share name"),
  svm_name: z.string().describe("SVM name where share exists"),
  comment: z.string().optional().describe("Updated share comment"),
  properties: CifsSharePropertiesSchema.optional().describe("Updated share properties"),
  access_control: z.array(CifsAccessControlEntrySchema).optional().describe("Updated access control entries")
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

// ================================
// Legacy Single-Cluster Tools
// ================================

export function createListCifsSharesToolDefinition(): Tool {
  return {
    name: "list_cifs_shares",
    description: "List all CIFS shares in the cluster or filtered by SVM",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        svm_name: { type: "string", description: "Filter by SVM name" },
        share_name_pattern: { type: "string", description: "Filter by share name pattern" },
        volume_name: { type: "string", description: "Filter by volume name" }
      },
      required: ["cluster_ip", "username", "password"]
    }
  };
}

export async function handleListCifsShares(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = ListCifsSharesSchema.parse(args);
  const client = getApiClient(clusterManager, undefined, validated.cluster_ip, validated.username, validated.password);
  
  const params: ListCifsSharesParams = {};
  if (validated.svm_name) params['svm.name'] = validated.svm_name;
  if (validated.share_name_pattern) params['name'] = validated.share_name_pattern;
  if (validated.volume_name) params['volume.name'] = validated.volume_name;
  
  const shares = await client.listCifsShares(params);
  
  if (shares.length === 0) {
    return "No CIFS shares found matching the criteria.";
  }
  
  let result = `Found ${shares.length} CIFS share(s):\n\n`;
  
  for (const share of shares) {
    result += `📁 **${share.name}**\n`;
    result += `   Path: ${share.path}\n`;
    result += `   SVM: ${share.svm?.name || 'Unknown'}\n`;
    if (share.comment) result += `   Comment: ${share.comment}\n`;
    if (share.volume) result += `   Volume: ${share.volume.name} (${share.volume.uuid})\n`;
    result += '\n';
  }
  
  return result;
}

export function createGetCifsShareToolDefinition(): Tool {
  return {
    name: "get_cifs_share",
    description: "Get detailed information about a specific CIFS share",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        name: { type: "string", description: "CIFS share name" },
        svm_name: { type: "string", description: "SVM name where share exists" }
      },
      required: ["cluster_ip", "username", "password", "name", "svm_name"]
    }
  };
}

export async function handleGetCifsShare(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = GetCifsShareSchema.parse(args);
  const client = getApiClient(clusterManager, undefined, validated.cluster_ip, validated.username, validated.password);
  
  const share = await client.getCifsShare(validated.name, validated.svm_name);
  
  let result = `📁 **CIFS Share: ${share.name}**\n\n`;
  result += `**Basic Information:**\n`;
  result += `- Path: ${share.path}\n`;
  result += `- SVM: ${share.svm?.name || 'Unknown'}\n`;
  if (share.comment) result += `- Comment: ${share.comment}\n`;
  if (share.volume) result += `- Volume: ${share.volume.name} (${share.volume.uuid})\n`;
  
  if (share.properties) {
    result += `\n**Share Properties:**\n`;
    Object.entries(share.properties).forEach(([key, value]) => {
      if (value !== undefined) {
        result += `- ${key}: ${value}\n`;
      }
    });
  }
  
  if (share.acls?.access_control && share.acls.access_control.length > 0) {
    result += `\n**Access Control:**\n`;
    share.acls.access_control.forEach(ace => {
      result += `- ${ace.user_or_group}: ${ace.permission}`;
      if (ace.type) result += ` (${ace.type})`;
      result += '\n';
    });
  }
  
  return result;
}

export function createCreateCifsShareToolDefinition(): Tool {
  return {
    name: "create_cifs_share",
    description: "Create a new CIFS share with specified access permissions and user groups",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        name: { type: "string", description: "CIFS share name" },
        path: { type: "string", description: "Volume path (typically /vol/volume_name)" },
        svm_name: { type: "string", description: "SVM name where share will be created" },
        comment: { type: "string", description: "Optional share comment" },
        properties: {
          type: "object",
          properties: {
            access_based_enumeration: { type: "boolean", description: "Enable access-based enumeration" },
            encryption: { type: "boolean", description: "Enable encryption" },
            offline_files: { type: "string", enum: ["none", "manual", "documents", "programs"], description: "Offline files policy" },
            oplocks: { type: "boolean", description: "Oplocks" }
          },
          description: "Share properties"
        },
        access_control: {
          type: "array",
          items: {
            type: "object",
            properties: {
              permission: { type: "string", enum: ["no_access", "read", "change", "full_control"], description: "Permission level" },
              user_or_group: { type: "string", description: "User or group name" },
              type: { type: "string", enum: ["windows", "unix_user", "unix_group"], description: "Type of user/group" }
            },
            required: ["permission", "user_or_group"]
          },
          description: "Access control entries"
        }
      },
      required: ["cluster_ip", "username", "password", "name", "path", "svm_name"]
    }
  };
}

export async function handleCreateCifsShare(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = CreateCifsShareSchema.parse(args);
  const client = getApiClient(clusterManager, undefined, validated.cluster_ip, validated.username, validated.password);
  
  const shareConfig: CreateCifsShareRequest = {
    name: validated.name,
    path: validated.path,
    svm_name: validated.svm_name,
    comment: validated.comment,
    properties: validated.properties,
    access_control: validated.access_control?.map(ace => ({
      user_or_group: ace.user_or_group!,
      permission: ace.permission!,
      type: ace.type
    }))
  };
  
  const result = await client.createCifsShare(shareConfig);
  
  let response = `✅ **CIFS Share Created Successfully**\n\n`;
  response += `**Share Details:**\n`;
  response += `- Name: ${validated.name}\n`;
  response += `- Path: ${validated.path}\n`;
  response += `- SVM: ${validated.svm_name}\n`;
  if (validated.comment) response += `- Comment: ${validated.comment}\n`;
  
  if (validated.access_control && validated.access_control.length > 0) {
    response += `\n**Access Control:**\n`;
    validated.access_control.forEach(ace => {
      response += `- ${ace.user_or_group}: ${ace.permission}\n`;
    });
  }
  
  response += `\nThe CIFS share is now available for client access.`;
  
  return response;
}

export function createUpdateCifsShareToolDefinition(): Tool {
  return {
    name: "update_cifs_share",
    description: "Update an existing CIFS share's properties and access control",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        name: { type: "string", description: "CIFS share name" },
        svm_name: { type: "string", description: "SVM name where share exists" },
        comment: { type: "string", description: "Updated share comment" },
        properties: {
          type: "object",
          properties: {
            access_based_enumeration: { type: "boolean", description: "Enable access-based enumeration" },
            encryption: { type: "boolean", description: "Enable encryption" },
            offline_files: { type: "string", enum: ["none", "manual", "documents", "programs"], description: "Offline files policy" },
            oplocks: { type: "boolean", description: "Oplocks" }
          },
          description: "Updated share properties"
        },
        access_control: {
          type: "array",
          items: {
            type: "object",
            properties: {
              permission: { type: "string", enum: ["no_access", "read", "change", "full_control"], description: "Permission level" },
              user_or_group: { type: "string", description: "User or group name" },
              type: { type: "string", enum: ["windows", "unix_user", "unix_group"], description: "Type of user/group" }
            },
            required: ["permission", "user_or_group"]
          },
          description: "Updated access control entries"
        }
      },
      required: ["cluster_ip", "username", "password", "name", "svm_name"]
    }
  };
}

export async function handleUpdateCifsShare(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = UpdateCifsShareSchema.parse(args);
  const client = getApiClient(clusterManager, undefined, validated.cluster_ip, validated.username, validated.password);
  
  const updateConfig: UpdateCifsShareRequest = {
    name: validated.name,
    svm_name: validated.svm_name,
    comment: validated.comment,
    properties: validated.properties,
    access_control: validated.access_control?.map(ace => ({
      user_or_group: ace.user_or_group!,
      permission: ace.permission!,
      type: ace.type
    }))
  };
  
  await client.updateCifsShare(updateConfig);
  
  let response = `✅ **CIFS Share Updated Successfully**\n\n`;
  response += `**Updated Share: ${validated.name}**\n`;
  response += `- SVM: ${validated.svm_name}\n`;
  if (validated.comment !== undefined) response += `- Comment: ${validated.comment || '(removed)'}\n`;
  
  if (validated.access_control && validated.access_control.length > 0) {
    response += `\n**Updated Access Control:**\n`;
    validated.access_control.forEach(ace => {
      response += `- ${ace.user_or_group}: ${ace.permission}\n`;
    });
  }
  
  return response;
}

export function createDeleteCifsShareToolDefinition(): Tool {
  return {
    name: "delete_cifs_share",
    description: "Delete a CIFS share. WARNING: This will remove client access to the share.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        name: { type: "string", description: "CIFS share name" },
        svm_name: { type: "string", description: "SVM name where share exists" }
      },
      required: ["cluster_ip", "username", "password", "name", "svm_name"]
    }
  };
}

export async function handleDeleteCifsShare(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = DeleteCifsShareSchema.parse(args);
  const client = getApiClient(clusterManager, undefined, validated.cluster_ip, validated.username, validated.password);
  
  // Get share details before deletion for confirmation
  const share = await client.getCifsShare(validated.name, validated.svm_name);
  
  await client.deleteCifsShare({
    name: validated.name,
    svm_name: validated.svm_name
  });
  
  let response = `✅ **CIFS Share Deleted Successfully**\n\n`;
  response += `**Deleted Share Details:**\n`;
  response += `- Name: ${validated.name}\n`;
  response += `- Path: ${share.path}\n`;
  response += `- SVM: ${validated.svm_name}\n`;
  response += `\n⚠️  **Warning:** Client access to this share has been removed.`;
  
  return response;
}

// ================================
// Multi-Cluster Tools
// ================================

export function createClusterListCifsSharesToolDefinition(): Tool {
  return {
    name: "cluster_list_cifs_shares",
    description: "List all CIFS shares from a registered cluster by name",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        svm_name: { type: "string", description: "Filter by SVM name" },
        share_name_pattern: { type: "string", description: "Filter by share name pattern" },
        volume_name: { type: "string", description: "Filter by volume name" }
      },
      required: ["cluster_name"]
    }
  };
}

export async function handleClusterListCifsShares(args: any, clusterManager: OntapClusterManager): Promise<CifsShareListResult> {
  const validated = ClusterListCifsSharesSchema.parse(args);
  const client = getApiClient(clusterManager, validated.cluster_name);
  
  const params: ListCifsSharesParams = {};
  if (validated.svm_name) params['svm.name'] = validated.svm_name;
  if (validated.share_name_pattern) params['name'] = validated.share_name_pattern;
  if (validated.volume_name) params['volume.name'] = validated.volume_name;
  
  const shares = await client.listCifsShares(params);
  
  // Build structured data array
  const data: CifsShareListInfo[] = shares.map(share => ({
    name: share.name,
    path: share.path,
    svm_name: share.svm?.name,
    svm_uuid: share.svm?.uuid,
    volume_name: share.volume?.name,
    volume_uuid: share.volume?.uuid,
    comment: share.comment,
    properties: share.properties ? {
      encryption: share.properties.encryption,
      oplocks: share.properties.oplocks,
      offline_files: share.properties.offline_files,
      access_based_enumeration: share.properties.access_based_enumeration
    } : undefined
  }));
  
  // Build human-readable summary
  let summary = '';
  if (shares.length === 0) {
    summary = `No CIFS shares found in cluster '${validated.cluster_name}' matching the criteria.`;
  } else {
    summary = `Found ${shares.length} CIFS share(s) in cluster '${validated.cluster_name}':\n\n`;
    
    for (const share of shares) {
      summary += `📁 **${share.name}**\n`;
      summary += `   Path: ${share.path}\n`;
      summary += `   SVM: ${share.svm?.name || 'Unknown'}\n`;
      if (share.comment) summary += `   Comment: ${share.comment}\n`;
      if (share.volume) summary += `   Volume: ${share.volume.name}\n`;
      summary += '\n';
    }
  }
  
  return { summary, data };
}

export function createClusterCreateCifsShareToolDefinition(): Tool {
  return {
    name: "cluster_create_cifs_share",
    description: "Create a new CIFS share on a registered cluster by name",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        name: { type: "string", description: "CIFS share name" },
        path: { type: "string", description: "Volume path (typically /vol/volume_name)" },
        svm_name: { type: "string", description: "SVM name where share will be created" },
        comment: { type: "string", description: "Optional share comment" },
        properties: {
          type: "object",
          properties: {
            access_based_enumeration: { type: "boolean", description: "Enable access-based enumeration" },
            encryption: { type: "boolean", description: "Enable encryption" },
            offline_files: { type: "string", enum: ["none", "manual", "documents", "programs"], description: "Offline files policy" },
            oplocks: { type: "boolean", description: "Oplocks" }
          },
          description: "Share properties"
        },
        access_control: {
          type: "array",
          items: {
            type: "object",
            properties: {
              permission: { type: "string", enum: ["no_access", "read", "change", "full_control"], description: "Permission level" },
              user_or_group: { type: "string", description: "User or group name" },
              type: { type: "string", enum: ["windows", "unix_user", "unix_group"], description: "Type of user/group" }
            },
            required: ["permission", "user_or_group"]
          },
          description: "Access control entries"
        }
      },
      required: ["cluster_name", "name", "path", "svm_name"]
    }
  };
}

export async function handleClusterCreateCifsShare(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = ClusterCreateCifsShareSchema.parse(args);
  const client = getApiClient(clusterManager, validated.cluster_name);
  
  const shareConfig: CreateCifsShareRequest = {
    name: validated.name,
    path: validated.path,
    svm_name: validated.svm_name,
    comment: validated.comment,
    properties: validated.properties,
    access_control: validated.access_control?.map(ace => ({
      user_or_group: ace.user_or_group!,
      permission: ace.permission!,
      type: ace.type
    }))
  };
  
  const result = await client.createCifsShare(shareConfig);
  
  let response = `✅ **CIFS Share Created Successfully on ${validated.cluster_name}**\n\n`;
  response += `**Share Details:**\n`;
  response += `- Name: ${validated.name}\n`;
  response += `- Path: ${validated.path}\n`;
  response += `- SVM: ${validated.svm_name}\n`;
  response += `- Cluster: ${validated.cluster_name}\n`;
  if (validated.comment) response += `- Comment: ${validated.comment}\n`;
  
  if (validated.access_control && validated.access_control.length > 0) {
    response += `\n**Access Control:**\n`;
    validated.access_control.forEach(ace => {
      response += `- ${ace.user_or_group}: ${ace.permission}\n`;
    });
  }
  
  response += `\nThe CIFS share is now available for client access.`;
  
  return response;
}

export function createClusterDeleteCifsShareToolDefinition(): Tool {
  return {
    name: "cluster_delete_cifs_share",
    description: "Delete a CIFS share from a registered cluster. WARNING: This will remove client access to the share.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        name: { type: "string", description: "CIFS share name" },
        svm_name: { type: "string", description: "SVM name where share exists" }
      },
      required: ["cluster_name", "name", "svm_name"]
    }
  };
}

export async function handleClusterDeleteCifsShare(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const validated = ClusterCifsShareSchema.parse(args);
  const client = getApiClient(clusterManager, validated.cluster_name);
  
  // Get share details before deletion for confirmation
  const share = await client.getCifsShare(validated.name, validated.svm_name);
  
  await client.deleteCifsShare({
    name: validated.name,
    svm_name: validated.svm_name
  });
  
  let response = `✅ **CIFS Share Deleted Successfully from ${validated.cluster_name}**\n\n`;
  response += `**Deleted Share Details:**\n`;
  response += `- Name: ${validated.name}\n`;
  response += `- Path: ${share.path}\n`;
  response += `- SVM: ${validated.svm_name}\n`;
  response += `- Cluster: ${validated.cluster_name}\n`;
  response += `\n⚠️  **Warning:** Client access to this share has been removed.`;
  
  return response;
}