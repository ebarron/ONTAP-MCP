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
  ClusterApiResponse
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
    description: "List aggregates from a registered cluster by cluster name",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
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

export async function handleGetClusterInfo(args: any): Promise<any> {
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

export async function handleListSvms(args: any): Promise<any> {
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

export async function handleListAggregates(args: any): Promise<any> {
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

export async function handleClusterListSvms(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const { cluster_name } = ClusterOperationSchema.parse(args);
  const client = clusterManager.getClient(cluster_name);
  const svms = await client.listSvms();
  
  const svmList = svms.map((svm: any) => 
    `- ${svm.name} (${svm.uuid}) - State: ${svm.state}`
  ).join('\n');

  return `SVMs on cluster '${cluster_name}': ${svms.length}\n\n${svmList}`;
}

export async function handleClusterListAggregates(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const { cluster_name } = ClusterOperationSchema.parse(args);
  const client = clusterManager.getClient(cluster_name);
  const aggregates = await client.listAggregates();
  
  const aggrList = aggregates.map((aggr: any) => 
    `- ${aggr.name} (${aggr.uuid}) - State: ${aggr.state}, Available: ${aggr.space?.block_storage?.available || 'N/A'}, Used: ${aggr.space?.block_storage?.used || 'N/A'}`
  ).join('\n');

  return `Aggregates on cluster '${cluster_name}': ${aggregates.length}\n\n${aggrList}`;
}

export async function handleClusterListVolumes(args: any, clusterManager: OntapClusterManager): Promise<string> {
  const { cluster_name, svm_name } = ClusterListVolumesSchema.parse(args);
  const client = clusterManager.getClient(cluster_name);
  const volumes = await client.listVolumes(svm_name);
  
  const volumeList = volumes.map((vol: any) => 
    `- ${vol.name} (${vol.uuid}) - Size: ${vol.size}, State: ${vol.state}, SVM: ${vol.svm?.name || 'N/A'}`
  ).join('\n');

  return `Volumes on cluster '${cluster_name}': ${volumes.length}\n\n${volumeList}`;
}