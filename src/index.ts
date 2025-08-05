#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { OntapApiClient, OntapClusterManager } from "./ontap-client.js";

// Create global cluster manager instance
const clusterManager = new OntapClusterManager();

// Pre-register clusters from environment variables (recommended for production)
if (process.env.ONTAP_CLUSTERS) {
  try {
    const clusters = JSON.parse(process.env.ONTAP_CLUSTERS);
    clusters.forEach((cluster: any) => {
      clusterManager.addCluster(cluster);
    });
    console.error(`Pre-registered ${clusters.length} clusters from environment`);
  } catch (error) {
    console.error("Error parsing ONTAP_CLUSTERS environment variable:", error);
  }
}

// Pre-register clusters (optional - remove if you prefer dynamic registration only)
// clusterManager.addCluster({
//   name: "production",
//   cluster_ip: "10.193.184.184",
//   username: "admin", 
//   password: "Netapp1!",
//   description: "Production ONTAP cluster"
// });
// 
// clusterManager.addCluster({
//   name: "development",
//   cluster_ip: "10.193.184.185",
//   username: "admin",
//   password: "DevPassword123",
//   description: "Development ONTAP cluster"
// });

// Input schemas for validation
const GetClusterInfoSchema = z.object({
  cluster_ip: z.string(),
  username: z.string(),
  password: z.string(),
});

const ListVolumesSchema = z.object({
  cluster_ip: z.string(),
  username: z.string(),
  password: z.string(),
  svm_name: z.string().optional(),
});

const CreateVolumeSchema = z.object({
  cluster_ip: z.string(),
  username: z.string(),
  password: z.string(),
  svm_name: z.string(),
  volume_name: z.string(),
  size: z.string(),
  aggregate_name: z.string().optional(),
});

const ListSvmsSchema = z.object({
  cluster_ip: z.string(),
  username: z.string(),
  password: z.string(),
});

const ListAggregatesSchema = z.object({
  cluster_ip: z.string(),
  username: z.string(),
  password: z.string(),
});

const GetVolumeStatsSchema = z.object({
  cluster_ip: z.string(),
  username: z.string(),
  password: z.string(),
  volume_uuid: z.string(),
});

// Multi-cluster schemas
const AddClusterSchema = z.object({
  name: z.string(),
  cluster_ip: z.string(),
  username: z.string(),
  password: z.string(),
  description: z.string().optional(),
});

const ClusterOperationSchema = z.object({
  cluster_name: z.string(),
  svm_name: z.string().optional(),
});

const CreateVolumeClusterSchema = z.object({
  cluster_name: z.string(),
  svm_name: z.string(),
  volume_name: z.string(),
  size: z.string(),
  aggregate_name: z.string().optional(),
});

const GetVolumeStatsClusterSchema = z.object({
  cluster_name: z.string(),
  volume_uuid: z.string(),
});

const server = new Server(
  {
    name: "netapp-ontap-mcp",
    version: "2.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Legacy single-cluster tools (backward compatibility)
      {
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
        },
      },
      {
        name: "list_volumes",
        description: "List all volumes in the cluster or a specific SVM",
        inputSchema: {
          type: "object",
          properties: {
            cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
            username: { type: "string", description: "Username for authentication" },
            password: { type: "string", description: "Password for authentication" },
            svm_name: { type: "string", description: "Optional: Filter volumes by SVM name" },
          },
          required: ["cluster_ip", "username", "password"],
        },
      },
      {
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
        },
      },
      {
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
        },
      },
      {
        name: "get_volume_stats",
        description: "Get performance statistics for a specific volume",
        inputSchema: {
          type: "object",
          properties: {
            cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
            username: { type: "string", description: "Username for authentication" },
            password: { type: "string", description: "Password for authentication" },
            volume_uuid: { type: "string", description: "UUID of the volume to get statistics for" },
          },
          required: ["cluster_ip", "username", "password", "volume_uuid"],
        },
      },
      {
        name: "create_volume",
        description: "Create a new volume in the specified SVM",
        inputSchema: {
          type: "object",
          properties: {
            cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
            username: { type: "string", description: "Username for authentication" },
            password: { type: "string", description: "Password for authentication" },
            svm_name: { type: "string", description: "Name of the SVM where the volume will be created" },
            volume_name: { type: "string", description: "Name of the new volume" },
            size: { type: "string", description: "Size of the volume (e.g., '100GB', '1TB')" },
            aggregate_name: { type: "string", description: "Optional: Name of the aggregate to use" },
          },
          required: ["cluster_ip", "username", "password", "svm_name", "volume_name", "size"],
        },
      },
      
      // Multi-cluster management tools
      {
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
        },
      },
      {
        name: "list_registered_clusters",
        description: "List all registered clusters in the cluster manager",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_all_clusters_info",
        description: "Get cluster information for all registered clusters",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "cluster_list_volumes",
        description: "List volumes from a registered cluster by cluster name",
        inputSchema: {
          type: "object",
          properties: {
            cluster_name: { type: "string", description: "Name of the registered cluster" },
            svm_name: { type: "string", description: "Optional: Filter volumes by SVM name" },
          },
          required: ["cluster_name"],
        },
      },
      {
        name: "cluster_list_svms",
        description: "List SVMs from a registered cluster by cluster name",
        inputSchema: {
          type: "object",
          properties: {
            cluster_name: { type: "string", description: "Name of the registered cluster" },
          },
          required: ["cluster_name"],
        },
      },
      {
        name: "cluster_list_aggregates",
        description: "List aggregates from a registered cluster by cluster name",
        inputSchema: {
          type: "object",
          properties: {
            cluster_name: { type: "string", description: "Name of the registered cluster" },
          },
          required: ["cluster_name"],
        },
      },
      {
        name: "cluster_create_volume",
        description: "Create a volume on a registered cluster by cluster name",
        inputSchema: {
          type: "object",
          properties: {
            cluster_name: { type: "string", description: "Name of the registered cluster" },
            svm_name: { type: "string", description: "Name of the SVM where the volume will be created" },
            volume_name: { type: "string", description: "Name of the new volume" },
            size: { type: "string", description: "Size of the volume (e.g., '100GB', '1TB')" },
            aggregate_name: { type: "string", description: "Optional: Name of the aggregate to use" },
          },
          required: ["cluster_name", "svm_name", "volume_name", "size"],
        },
      },
      {
        name: "cluster_get_volume_stats",
        description: "Get volume statistics from a registered cluster by cluster name",
        inputSchema: {
          type: "object",
          properties: {
            cluster_name: { type: "string", description: "Name of the registered cluster" },
            volume_uuid: { type: "string", description: "UUID of the volume to get statistics for" },
          },
          required: ["cluster_name", "volume_uuid"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Legacy single-cluster operations
      case "get_cluster_info": {
        const { cluster_ip, username, password } = GetClusterInfoSchema.parse(args);
        const client = new OntapApiClient(cluster_ip, username, password);
        const clusterInfo = await client.getClusterInfo();
        
        return {
          content: [{
            type: "text",
            text: `NetApp ONTAP Cluster Information:
Name: ${clusterInfo.name}
Version: ${clusterInfo.version.full}
UUID: ${clusterInfo.uuid}
State: ${clusterInfo.state}
Nodes: ${clusterInfo.nodes?.length || 0}`,
          }],
        };
      }

      case "list_volumes": {
        const { cluster_ip, username, password, svm_name } = ListVolumesSchema.parse(args);
        const client = new OntapApiClient(cluster_ip, username, password);
        const volumes = await client.listVolumes(svm_name);
        
        const volumeList = volumes.map((vol: any) => 
          `- ${vol.name} (${vol.uuid}) - Size: ${vol.size}, State: ${vol.state}, SVM: ${vol.svm?.name || 'N/A'}`
        ).join('\n');

        return {
          content: [{
            type: "text",
            text: `Volumes found: ${volumes.length}\n\n${volumeList}`,
          }],
        };
      }

      case "list_svms": {
        const { cluster_ip, username, password } = ListSvmsSchema.parse(args);
        const client = new OntapApiClient(cluster_ip, username, password);
        const svms = await client.listSvms();
        
        const svmList = svms.map((svm: any) => 
          `- ${svm.name} (${svm.uuid}) - State: ${svm.state}`
        ).join('\n');

        return {
          content: [{
            type: "text",
            text: `SVMs found: ${svms.length}\n\n${svmList}`,
          }],
        };
      }

      case "list_aggregates": {
        const { cluster_ip, username, password } = ListAggregatesSchema.parse(args);
        const client = new OntapApiClient(cluster_ip, username, password);
        const aggregates = await client.listAggregates();
        
        const aggrList = aggregates.map((aggr: any) => 
          `- ${aggr.name} (${aggr.uuid}) - State: ${aggr.state}, Available: ${aggr.space?.block_storage?.available || 'N/A'}, Used: ${aggr.space?.block_storage?.used || 'N/A'}`
        ).join('\n');

        return {
          content: [{
            type: "text",
            text: `Aggregates found: ${aggregates.length}\n\n${aggrList}`,
          }],
        };
      }

      case "get_volume_stats": {
        const { cluster_ip, username, password, volume_uuid } = GetVolumeStatsSchema.parse(args);
        const client = new OntapApiClient(cluster_ip, username, password);
        const stats = await client.getVolumeStats(volume_uuid);
        
        return {
          content: [{
            type: "text",
            text: `Volume Statistics:
IOPS: ${JSON.stringify(stats.iops || {})}
Latency: ${JSON.stringify(stats.latency || {})}
Throughput: ${JSON.stringify(stats.throughput || {})}`,
          }],
        };
      }

      case "create_volume": {
        const { cluster_ip, username, password, svm_name, volume_name, size, aggregate_name } = 
          CreateVolumeSchema.parse(args);
        const client = new OntapApiClient(cluster_ip, username, password);
        const result = await client.createVolume({ svm_name, volume_name, size, aggregate_name });
        
        return {
          content: [{
            type: "text",
            text: `Volume created successfully:
Name: ${volume_name}
UUID: ${result.uuid}
SVM: ${svm_name}
Size: ${size}`,
          }],
        };
      }

      // Multi-cluster operations
      case "add_cluster": {
        const { name, cluster_ip, username, password, description } = AddClusterSchema.parse(args);
        
        clusterManager.addCluster({ name, cluster_ip, username, password, description });
        
        return {
          content: [{
            type: "text",
            text: `Cluster '${name}' added successfully:
IP: ${cluster_ip}
Description: ${description || 'None'}
Username: ${username}`,
          }],
        };
      }

      case "list_registered_clusters": {
        const clusters = clusterManager.listClusters();
        
        if (clusters.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No clusters registered. Use 'add_cluster' to register clusters.",
            }],
          };
        }

        const clusterList = clusters.map(cluster => 
          `- ${cluster.name}: ${cluster.cluster_ip} (${cluster.description || 'No description'})`
        ).join('\n');

        return {
          content: [{
            type: "text",
            text: `Registered clusters (${clusters.length}):\n\n${clusterList}`,
          }],
        };
      }

      case "get_all_clusters_info": {
        const clusterInfos = await clusterManager.getAllClustersInfo();
        
        if (clusterInfos.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No clusters registered.",
            }],
          };
        }

        const infoText = clusterInfos.map(({ name, info, error }) => {
          if (error) {
            return `- ${name}: ERROR - ${error}`;
          }
          return `- ${name}: ${info.name} (${info.version?.full || 'Unknown version'}) - ${info.state || 'Unknown state'}`;
        }).join('\n');

        return {
          content: [{
            type: "text",
            text: `Cluster Information:\n\n${infoText}`,
          }],
        };
      }

      case "cluster_list_volumes": {
        const { cluster_name, svm_name } = ClusterOperationSchema.parse(args);
        const client = clusterManager.getClient(cluster_name);
        const volumes = await client.listVolumes(svm_name);
        
        const volumeList = volumes.map((vol: any) => 
          `- ${vol.name} (${vol.uuid}) - Size: ${vol.size}, State: ${vol.state}, SVM: ${vol.svm?.name || 'N/A'}`
        ).join('\n');

        return {
          content: [{
            type: "text",
            text: `Volumes on cluster '${cluster_name}': ${volumes.length}\n\n${volumeList}`,
          }],
        };
      }

      case "cluster_list_svms": {
        const { cluster_name } = ClusterOperationSchema.parse(args);
        const client = clusterManager.getClient(cluster_name);
        const svms = await client.listSvms();
        
        const svmList = svms.map((svm: any) => 
          `- ${svm.name} (${svm.uuid}) - State: ${svm.state}`
        ).join('\n');

        return {
          content: [{
            type: "text",
            text: `SVMs on cluster '${cluster_name}': ${svms.length}\n\n${svmList}`,
          }],
        };
      }

      case "cluster_list_aggregates": {
        const { cluster_name } = ClusterOperationSchema.parse(args);
        const client = clusterManager.getClient(cluster_name);
        const aggregates = await client.listAggregates();
        
        const aggrList = aggregates.map((aggr: any) => 
          `- ${aggr.name} (${aggr.uuid}) - State: ${aggr.state}, Available: ${aggr.space?.block_storage?.available || 'N/A'}, Used: ${aggr.space?.block_storage?.used || 'N/A'}`
        ).join('\n');

        return {
          content: [{
            type: "text",
            text: `Aggregates on cluster '${cluster_name}': ${aggregates.length}\n\n${aggrList}`,
          }],
        };
      }

      case "cluster_create_volume": {
        const { cluster_name, svm_name, volume_name, size, aggregate_name } = 
          CreateVolumeClusterSchema.parse(args);
        const client = clusterManager.getClient(cluster_name);
        const result = await client.createVolume({ svm_name, volume_name, size, aggregate_name });
        
        return {
          content: [{
            type: "text",
            text: `Volume created successfully on cluster '${cluster_name}':
Name: ${volume_name}
UUID: ${result.uuid}
SVM: ${svm_name}
Size: ${size}`,
          }],
        };
      }

      case "cluster_get_volume_stats": {
        const { cluster_name, volume_uuid } = GetVolumeStatsClusterSchema.parse(args);
        const client = clusterManager.getClient(cluster_name);
        const stats = await client.getVolumeStats(volume_uuid);
        
        return {
          content: [{
            type: "text",
            text: `Volume Statistics on cluster '${cluster_name}':
IOPS: ${JSON.stringify(stats.iops || {})}
Latency: ${JSON.stringify(stats.latency || {})}
Throughput: ${JSON.stringify(stats.throughput || {})}`,
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("NetApp ONTAP Multi-Cluster MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
