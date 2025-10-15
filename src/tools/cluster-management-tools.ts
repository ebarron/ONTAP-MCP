/**
 * Cluster Management Tools
 * Basic cluster operations that were hardcoded in index.ts
 */

import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { OntapApiClient, OntapClusterManager } from "../ontap-client.js";
import {
  ClusterInfo,
  SvmInfo,
  AggregateInfo,
  RegisteredCluster,
  ClusterApiResponse,
  VolumeListInfo,
  VolumeListResult,
  SvmListInfo,
  SvmListResult,
  AggregateListInfo,
  AggregateListResult
} from "../types/cluster-types.js";

// ===== SCHEMAS =====

const GetClusterInfoSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
});

const ListSvmsSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
});

const ListAggregatesSchema = z.object({
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
});

const AddClusterSchema = z.object({
  name: z.string().describe("Unique name for the cluster"),
  cluster_ip: z.string().describe("IP address or FQDN of the ONTAP cluster"),
  username: z.string().describe("Username for authentication"),
  password: z.string().describe("Password for authentication"),
  description: z.string().optional().describe("Optional description of the cluster"),
});

const ClusterOperationSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
});

const ClusterListVolumesSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  svm_name: z.string().optional().describe("Optional: Filter volumes by SVM name"),
});

// ===== TOOL DEFINITIONS =====

export function createGetClusterInfoToolDefinition(): Tool {
  return {
    name: "get_cluster_info",
    description: "Get information about a NetApp ONTAP cluster",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
      },
      required: ["cluster_ip", "username", "password"],
    }
  };
}

export function createListSvmsToolDefinition(): Tool {
  return {
    name: "list_svms",
    description: "List all Storage Virtual Machines (SVMs) in the cluster",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
      },
      required: ["cluster_ip", "username", "password"],
    }
  };
}

export function createListAggregatesToolDefinition(): Tool {
  return {
    name: "list_aggregates",
    description: "List all aggregates in the cluster",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
      },
      required: ["cluster_ip", "username", "password"],
    }
  };
}

export function createAddClusterToolDefinition(): Tool {
  return {
    name: "add_cluster",
    description: "Add a cluster to the registry for multi-cluster management",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Unique name for the cluster" },
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        description: { type: "string", description: "Optional description of the cluster" },
      },
      required: ["name", "cluster_ip", "username", "password"],
    }
  };
}

export function createListRegisteredClustersToolDefinition(): Tool {
  return {
    name: "list_registered_clusters",
    description: "List all registered clusters in the cluster manager",
    inputSchema: {
      type: "object",
      properties: {}
    }
  };
}

export function createGetAllClustersInfoToolDefinition(): Tool {
  return {
    name: "get_all_clusters_info",
    description: "Get cluster information for all registered clusters",
    inputSchema: {
      type: "object", 
      properties: {}
    }
  };
}

export function createClusterListSvmsToolDefinition(): Tool {
  return {
    name: "cluster_list_svms",
    description: "List SVMs from a registered cluster by cluster name",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
      },
      required: ["cluster_name"],
    }
  };
}

export function createClusterListAggregatesToolDefinition(): Tool {
  return {
    name: "cluster_list_aggregates",
    description: "List aggregates from a registered cluster. Optionally filter to show only aggregates assigned to a specific SVM (the SVM's aggr-list).",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        svm_name: { type: "string", description: "Optional: Filter to show only aggregates assigned to this SVM" },
      },
      required: ["cluster_name"],
    }
  };
}

export function createClusterListVolumesToolDefinition(): Tool {
  return {
    name: "cluster_list_volumes",
    description: "List volumes from a registered cluster by cluster name",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        svm_name: { type: "string", description: "Optional: Filter volumes by SVM name" },
      },
      required: ["cluster_name"],
    }
  };
}

// ===== TOOL HANDLERS =====

export async function handleGetClusterInfo(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const { cluster_ip, username, password } = GetClusterInfoSchema.parse(args);
  const client = new OntapApiClient(cluster_ip, username, password);
  const info = await client.getClusterInfo();
  
  return {
    content: [{
      type: "text",
      text: `Cluster: ${info.name}\nVersion: ${info.version?.full || 'Unknown'}\nState: ${info.state || 'Unknown'}`,
    }],
  };
}

export async function handleListSvms(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const { cluster_ip, username, password } = ListSvmsSchema.parse(args);
  const client = new OntapApiClient(cluster_ip, username, password);
  const svms = await client.listSvms();
  
  const svmList = svms.map((svm: any) => 
    `- ${svm.name} (${svm.uuid}) - State: ${svm.state}`
  ).join('\n');

  return {
    content: [{
      type: "text",
      text: `SVMs: ${svms.length}\n\n${svmList}`,
    }],
  };
}

export async function handleListAggregates(args: any, clusterManager: OntapClusterManager): Promise<any> {
  const { cluster_ip, username, password } = ListAggregatesSchema.parse(args);
  const client = new OntapApiClient(cluster_ip, username, password);
  const aggregates = await client.listAggregates();
  
  const aggrList = aggregates.map((aggr: any) => 
    `- ${aggr.name} (${aggr.uuid}) - State: ${aggr.state}, Available: ${aggr.space?.block_storage?.available || 'N/A'}, Used: ${aggr.space?.block_storage?.used || 'N/A'}`
  ).join('\n');

  return {
    content: [{
      type: "text",
      text: `Aggregates: ${aggregates.length}\n\n${aggrList}`,
    }],
  };
}

export async function handleAddCluster(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const { name, cluster_ip, username, password, description } = AddClusterSchema.parse(args);
  
  clusterManager.addCluster({
    name,
    cluster_ip,
    username,
    password,
    description
  });
  
  return `Cluster '${name}' added successfully:
IP: ${cluster_ip}
Description: ${description || 'None'}
Username: ${username}`;
}

export async function handleListRegisteredClusters(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const clusters = clusterManager.listClusters();
  
  if (clusters.length === 0) {
    return "No clusters registered. Use 'add_cluster' to register clusters.";
  }

  const clusterList = clusters.map(c => 
    `- ${c.name}: ${c.cluster_ip} (${c.description || 'No description'})`
  ).join('\n');

  return `Registered clusters (${clusters.length}):\n\n${clusterList}`;
}

export async function handleGetAllClustersInfo(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const clusterInfos = await clusterManager.getAllClustersInfo();
  
  if (clusterInfos.length === 0) {
    return "No clusters registered.";
  }

  const infoText = clusterInfos.map(({ name, info, error }) => {
    if (error) {
      return `- ${name}: ERROR - ${error}`;
    }
    
    // Safe access to info properties
    const clusterName = info?.name || 'Unknown';
    const version = info?.version?.full || 'Unknown version';
    const state = info?.state || 'Unknown state';
    
    return `- ${name}: ${clusterName} (${version}) - ${state}`;
  }).join('\n');

  return `Cluster Information:\n\n${infoText}`;
}

export async function handleClusterListSvms(args: any, clusterManager: OntapClusterManager): Promise<SvmListResult> {
  const { cluster_name } = ClusterOperationSchema.parse(args);
  const client = clusterManager.getClient(cluster_name);
  const svms = await client.listSvms();
  
  // Build structured data array
  const data: SvmListInfo[] = svms.map((svm: any) => ({
    uuid: svm.uuid,
    name: svm.name,
    state: svm.state,
    subtype: svm.subtype,
    aggregates: svm.aggregates?.map((aggr: any) => ({
      name: aggr.name,
      uuid: aggr.uuid
    }))
  }));
  
  // Build human-readable summary (for LLMs)
  const svmList = data.map(svm => 
    `- ${svm.name} (${svm.uuid}) - State: ${svm.state}`
  ).join('\n');
  
  const summary = `SVMs on cluster '${cluster_name}': ${svms.length}\n\n${svmList}`;
  
  // Return hybrid format (Phase 2, Step 2)
  return { summary, data };
}

export async function handleClusterListAggregates(args: any, clusterManager: OntapClusterManager): Promise<AggregateListResult> {
  const { cluster_name, svm_name } = z.object({
    cluster_name: z.string(),
    svm_name: z.string().optional()
  }).parse(args);
  
  const client = clusterManager.getClient(cluster_name);
  
  let aggregates: any[];
  let description: string;
  
  if (svm_name) {
    // Get SVM details to find assigned aggregates
    const svmDetails = await client.getSvmDetails(svm_name);
    aggregates = svmDetails.aggregates || [];
    description = `Aggregates assigned to SVM '${svm_name}' on cluster '${cluster_name}'`;
  } else {
    // Get all aggregates
    aggregates = await client.listAggregates();
    description = `All aggregates on cluster '${cluster_name}'`;
  }
  
  // Build structured data array
  const data: AggregateListInfo[] = aggregates.map((aggr: any) => ({
    uuid: aggr.uuid,
    name: aggr.name,
    state: aggr.state,
    space: aggr.space?.block_storage ? {
      available: aggr.space.block_storage.available,
      used: aggr.space.block_storage.used,
      size: aggr.space.block_storage.size,
      percent_used: aggr.space.block_storage.size > 0 
        ? Math.round((aggr.space.block_storage.used / aggr.space.block_storage.size) * 100)
        : undefined
    } : undefined,
    node: aggr.node ? {
      name: aggr.node.name,
      uuid: aggr.node.uuid
    } : undefined
  }));
  
  // Build human-readable summary (for LLMs)
  const aggrList = data.map(aggr => {
    let line = `- ${aggr.name} (${aggr.uuid})`;
    if (aggr.state) line += ` - State: ${aggr.state}`;
    if (aggr.space?.available !== undefined && aggr.space?.used !== undefined) {
      line += `, Available: ${aggr.space.available}, Used: ${aggr.space.used}`;
    }
    return line;
  }).join('\n');
  
  const summary = `${description}: ${aggregates.length}\n\n${aggrList}`;
  
  // Return hybrid format (Phase 2, Step 3)
  return { summary, data };
}

export async function handleClusterListVolumes(args: any, clusterManager: OntapClusterManager): Promise<VolumeListResult> {
  const { cluster_name, svm_name } = ClusterListVolumesSchema.parse(args);
  const client = clusterManager.getClient(cluster_name);
  const volumes = await client.listVolumes(svm_name);
  
  // Build structured data array
  const data: VolumeListInfo[] = volumes.map((vol: any) => ({
    uuid: vol.uuid,
    name: vol.name,
    size: vol.size,
    state: vol.state,
    svm: {
      name: vol.svm?.name || 'N/A',
      uuid: vol.svm?.uuid
    },
    aggregate: vol.aggregates?.[0] ? {
      name: vol.aggregates[0].name,
      uuid: vol.aggregates[0].uuid
    } : undefined
  }));
  
  // Build human-readable summary (for LLMs)
  const volumeList = data.map(vol => 
    `- ${vol.name} (${vol.uuid}) - Size: ${vol.size}, State: ${vol.state}, SVM: ${vol.svm.name}`
  ).join('\n');
  
  const summary = `Volumes on cluster '${cluster_name}': ${volumes.length}\n\n${volumeList}`;
  
  // Return hybrid format (Phase 2)
  return { summary, data };
}