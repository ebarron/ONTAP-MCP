#!/usr/bin/env node

// Note: Environment variables are now provided by the MCP client configuration
// No need for dotenv as clusters are configured at client connection time

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import express from "express";
import cors from "cors";
import { OntapApiClient, OntapClusterManager } from "./ontap-client.js";

// Create global cluster manager instance
const clusterManager = new OntapClusterManager();

/**
 * Interface for cluster configuration in object format (new format)
 */
interface ClusterConfigObject {
  [clusterName: string]: {
    cluster_ip: string;
    username: string;
    password: string;
    description?: string;
  };
}

/**
 * Interface for cluster configuration in array format (legacy)
 */
interface ClusterConfigArray {
  name: string;
  cluster_ip: string;
  username: string;
  password: string;
  description?: string;
}

/**
 * Parse cluster configuration from environment variable
 * Supports both new object format and legacy array format
 */
function parseClusterConfig(): ClusterConfigArray[] {
  const clustersEnv = process.env.ONTAP_CLUSTERS;
  if (!clustersEnv) {
    console.error('No ONTAP_CLUSTERS environment variable found');
    return [];
  }

  try {
    // When MCP passes JSON objects as environment variables, they get stringified
    const parsed = typeof clustersEnv === 'string' ? JSON.parse(clustersEnv) : clustersEnv;
    
    // Check if it's the new object format
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Convert object format to array format for internal use
      const clusters: ClusterConfigArray[] = [];
      for (const [clusterName, config] of Object.entries(parsed as ClusterConfigObject)) {
        clusters.push({
          name: clusterName,
          cluster_ip: config.cluster_ip,
          username: config.username,
          password: config.password,
          description: config.description
        });
      }
      console.error(`Pre-registered ${clusters.length} clusters from object format`);
      return clusters;
    }
    
    // Handle legacy array format
    if (Array.isArray(parsed)) {
      console.error(`Pre-registered ${parsed.length} clusters from array format`);
      return parsed as ClusterConfigArray[];
    }
    
    console.error('ONTAP_CLUSTERS is not in a recognized format');
    return [];
    
  } catch (error) {
    console.error('Error parsing ONTAP_CLUSTERS environment variable:', error);
    return [];
  }
}

// Pre-register clusters from environment variables (recommended for production)
if (process.env.ONTAP_CLUSTERS) {
  const clusters = parseClusterConfig();
  clusters.forEach((cluster: ClusterConfigArray) => {
    clusterManager.addCluster(cluster);
  });
}

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

// Volume management schemas
const OfflineVolumeSchema = z.object({
  cluster_ip: z.string(),
  username: z.string(),
  password: z.string(),
  volume_uuid: z.string(),
});

const DeleteVolumeSchema = z.object({
  cluster_ip: z.string(),
  username: z.string(),
  password: z.string(),
  volume_uuid: z.string(),
});

const OfflineVolumeClusterSchema = z.object({
  cluster_name: z.string(),
  volume_uuid: z.string(),
});

const DeleteVolumeClusterSchema = z.object({
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
      {
        name: "offline_volume",
        description: "Take a volume offline (required before deletion). WARNING: This will make the volume inaccessible.",
        inputSchema: {
          type: "object",
          properties: {
            cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
            username: { type: "string", description: "Username for authentication" },
            password: { type: "string", description: "Password for authentication" },
            volume_uuid: { type: "string", description: "UUID of the volume to take offline" },
          },
          required: ["cluster_ip", "username", "password", "volume_uuid"],
        },
      },
      {
        name: "delete_volume",
        description: "Delete a volume (must be offline first). WARNING: This action is irreversible and will permanently destroy all data.",
        inputSchema: {
          type: "object",
          properties: {
            cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
            username: { type: "string", description: "Username for authentication" },
            password: { type: "string", description: "Password for authentication" },
            volume_uuid: { type: "string", description: "UUID of the volume to delete" },
          },
          required: ["cluster_ip", "username", "password", "volume_uuid"],
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
        name: "cluster_offline_volume",
        description: "Take a volume offline on a registered cluster by cluster name (required before deletion). WARNING: This will make the volume inaccessible.",
        inputSchema: {
          type: "object",
          properties: {
            cluster_name: { type: "string", description: "Name of the registered cluster" },
            volume_uuid: { type: "string", description: "UUID of the volume to take offline" },
          },
          required: ["cluster_name", "volume_uuid"],
        },
      },
      {
        name: "cluster_delete_volume",
        description: "Delete a volume on a registered cluster by cluster name (must be offline first). WARNING: This action is irreversible and will permanently destroy all data.",
        inputSchema: {
          type: "object",
          properties: {
            cluster_name: { type: "string", description: "Name of the registered cluster" },
            volume_uuid: { type: "string", description: "UUID of the volume to delete" },
          },
          required: ["cluster_name", "volume_uuid"],
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

      case "offline_volume": {
        const { cluster_ip, username, password, volume_uuid } = OfflineVolumeSchema.parse(args);
        const client = new OntapApiClient(cluster_ip, username, password);
        
        // Get volume info first for safety check
        try {
          const volumeInfo = await client.getVolumeInfo(volume_uuid);
          if (volumeInfo.state === 'offline') {
            return {
              content: [{
                type: "text",
                text: `Volume '${volumeInfo.name}' (${volume_uuid}) is already offline.`,
              }],
            };
          }
          
          await client.offlineVolume(volume_uuid);
          
          return {
            content: [{
              type: "text",
              text: `Volume '${volumeInfo.name}' (${volume_uuid}) has been taken offline successfully.
⚠️  Volume is now inaccessible until brought back online.
💡 You can now delete this volume if needed using the delete_volume tool.`,
            }],
          };
        } catch (error) {
          throw new Error(`Failed to offline volume: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      case "delete_volume": {
        const { cluster_ip, username, password, volume_uuid } = DeleteVolumeSchema.parse(args);
        const client = new OntapApiClient(cluster_ip, username, password);
        
        // Get volume info first for safety check
        try {
          const volumeInfo = await client.getVolumeInfo(volume_uuid);
          
          if (volumeInfo.state !== 'offline') {
            return {
              content: [{
                type: "text",
                text: `❌ Cannot delete volume '${volumeInfo.name}' (${volume_uuid}).
The volume must be offline before deletion.
Current state: ${volumeInfo.state}

Use the offline_volume tool first:
offline_volume --volume_uuid="${volume_uuid}"`,
              }],
              isError: true,
            };
          }
          
          await client.deleteVolume(volume_uuid);
          
          return {
            content: [{
              type: "text",
              text: `✅ Volume '${volumeInfo.name}' (${volume_uuid}) has been permanently deleted.
⚠️  This action cannot be undone. All data has been destroyed.`,
            }],
          };
        } catch (error) {
          throw new Error(`Failed to delete volume: ${error instanceof Error ? error.message : String(error)}`);
        }
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

      case "cluster_offline_volume": {
        const { cluster_name, volume_uuid } = OfflineVolumeClusterSchema.parse(args);
        const client = clusterManager.getClient(cluster_name);
        
        try {
          const volumeInfo = await client.getVolumeInfo(volume_uuid);
          if (volumeInfo.state === 'offline') {
            return {
              content: [{
                type: "text",
                text: `Volume '${volumeInfo.name}' (${volume_uuid}) on cluster '${cluster_name}' is already offline.`,
              }],
            };
          }
          
          await client.offlineVolume(volume_uuid);
          
          return {
            content: [{
              type: "text",
              text: `Volume '${volumeInfo.name}' (${volume_uuid}) on cluster '${cluster_name}' has been taken offline successfully.
⚠️  Volume is now inaccessible until brought back online.
💡 You can now delete this volume if needed using the cluster_delete_volume tool.`,
            }],
          };
        } catch (error) {
          throw new Error(`Failed to offline volume on cluster '${cluster_name}': ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      case "cluster_delete_volume": {
        const { cluster_name, volume_uuid } = DeleteVolumeClusterSchema.parse(args);
        const client = clusterManager.getClient(cluster_name);
        
        try {
          const volumeInfo = await client.getVolumeInfo(volume_uuid);
          
          if (volumeInfo.state !== 'offline') {
            return {
              content: [{
                type: "text",
                text: `❌ Cannot delete volume '${volumeInfo.name}' (${volume_uuid}) on cluster '${cluster_name}'.
The volume must be offline before deletion.
Current state: ${volumeInfo.state}

Use the cluster_offline_volume tool first:
cluster_offline_volume --cluster_name="${cluster_name}" --volume_uuid="${volume_uuid}"`,
              }],
              isError: true,
            };
          }
          
          await client.deleteVolume(volume_uuid);
          
          return {
            content: [{
              type: "text",
              text: `✅ Volume '${volumeInfo.name}' (${volume_uuid}) on cluster '${cluster_name}' has been permanently deleted.
⚠️  This action cannot be undone. All data has been destroyed.`,
            }],
          };
        } catch (error) {
          throw new Error(`Failed to delete volume on cluster '${cluster_name}': ${error instanceof Error ? error.message : String(error)}`);
        }
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

// Start the server with transport detection
async function startStdioServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("NetApp ONTAP Multi-Cluster MCP Server running on stdio");
}

async function startHttpServer(port: number = 3000) {
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      server: 'NetApp ONTAP MCP Server',
      clusters: clusterManager.listClusters().map(c => c.name),
      timestamp: new Date().toISOString()
    });
  });
  
  // MCP Server-Sent Events endpoint
  app.get('/sse', (req, res) => {
    const transport = new SSEServerTransport('/sse', res);
    server.connect(transport);
  });
  
  // RESTful API endpoints for direct tool access
  app.post('/api/tools/:toolName', async (req, res) => {
    try {
      const { toolName } = req.params;
      const args = req.body;
      
      // Direct tool execution (simplified)
      let result;
      switch (toolName) {
        case 'list_registered_clusters':
          const clusters = clusterManager.listClusters();
          result = {
            content: [{
              type: "text",
              text: `Registered clusters (${clusters.length}):\n\n${clusters.map(c => `- ${c.name}: ${c.cluster_ip} (${c.description || 'No description'})`).join('\n')}`
            }]
          };
          break;
        case 'cluster_create_volume':
          if (!args.cluster_name || !args.svm_name || !args.volume_name || !args.size) {
            throw new Error('cluster_name, svm_name, volume_name, and size are required');
          }
          const createClient = clusterManager.getClient(args.cluster_name);
          const createResult = await createClient.createVolume({
            svm_name: args.svm_name,
            volume_name: args.volume_name,
            size: args.size,
            aggregate_name: args.aggregate_name
          });
          result = {
            content: [{
              type: "text",
              text: `Volume created successfully on cluster '${args.cluster_name}':\nName: ${args.volume_name}\nUUID: ${createResult.uuid}\nSVM: ${args.svm_name}\nSize: ${args.size}`
            }]
          };
          break;
        case 'cluster_offline_volume':
          if (!args.cluster_name || !args.volume_uuid) {
            throw new Error('cluster_name and volume_uuid are required');
          }
          const offlineClient = clusterManager.getClient(args.cluster_name);
          const volumeInfo = await offlineClient.getVolumeInfo(args.volume_uuid);
          if (volumeInfo.state === 'offline') {
            result = {
              content: [{
                type: "text",
                text: `Volume '${volumeInfo.name}' (${args.volume_uuid}) on cluster '${args.cluster_name}' is already offline.`
              }]
            };
          } else {
            await offlineClient.offlineVolume(args.volume_uuid);
            result = {
              content: [{
                type: "text",
                text: `Volume '${volumeInfo.name}' (${args.volume_uuid}) on cluster '${args.cluster_name}' has been taken offline successfully.`
              }]
            };
          }
          break;
        case 'cluster_delete_volume':
          if (!args.cluster_name || !args.volume_uuid) {
            throw new Error('cluster_name and volume_uuid are required');
          }
          const deleteClient = clusterManager.getClient(args.cluster_name);
          const deleteVolumeInfo = await deleteClient.getVolumeInfo(args.volume_uuid);
          if (deleteVolumeInfo.state !== 'offline') {
            result = {
              content: [{
                type: "text",
                text: `❌ Cannot delete volume '${deleteVolumeInfo.name}' (${args.volume_uuid}). Volume must be offline before deletion. Current state: ${deleteVolumeInfo.state}`
              }]
            };
          } else {
            await deleteClient.deleteVolume(args.volume_uuid);
            result = {
              content: [{
                type: "text",
                text: `✅ Volume '${deleteVolumeInfo.name}' (${args.volume_uuid}) on cluster '${args.cluster_name}' has been permanently deleted.`
              }]
            };
          }
          break;
        case 'cluster_list_volumes':
          if (!args.cluster_name) {
            throw new Error('cluster_name is required');
          }
          const client = clusterManager.getClient(args.cluster_name);
          const volumes = await client.listVolumes(args.svm_name);
          result = {
            content: [{
              type: "text", 
              text: `Volumes on cluster '${args.cluster_name}': ${volumes.length}\n\n${volumes.map((vol: any) => `- ${vol.name} (${vol.uuid}) - Size: ${vol.size}, State: ${vol.state}, SVM: ${vol.svm?.name || 'N/A'}`).join('\n')}`
            }]
          };
          break;
        case 'cluster_list_aggregates':
          if (!args.cluster_name) {
            throw new Error('cluster_name is required');
          }
          const aggrClient = clusterManager.getClient(args.cluster_name);
          const aggregates = await aggrClient.listAggregates();
          result = {
            content: [{
              type: "text",
              text: `Aggregates on cluster '${args.cluster_name}': ${aggregates.length}\n\n${aggregates.map((aggr: any) => `- ${aggr.name} (${aggr.uuid}) - State: ${aggr.state}, Available: ${aggr.space?.block_storage?.available || 'N/A'}, Used: ${aggr.space?.block_storage?.used || 'N/A'}`).join('\n')}`
            }]
          };
          break;
        case 'cluster_list_svms':
          if (!args.cluster_name) {
            throw new Error('cluster_name is required');
          }
          const svmClient = clusterManager.getClient(args.cluster_name);
          const svms = await svmClient.listSvms();
          result = {
            content: [{
              type: "text",
              text: `SVMs on cluster '${args.cluster_name}': ${svms.length}\n\n${svms.map((svm: any) => `- ${svm.name} (${svm.uuid}) - State: ${svm.state}`).join('\n')}`
            }]
          };
          break;
        default:
          throw new Error(`Tool '${toolName}' not implemented in REST API`);
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Start HTTP server
  app.listen(port, () => {
    console.error(`NetApp ONTAP MCP Server running on HTTP port ${port}`);
    console.error(`Health check: http://localhost:${port}/health`);
    console.error(`MCP SSE endpoint: http://localhost:${port}/sse`);
    console.error(`RESTful API: http://localhost:${port}/api/tools/{toolName}`);
  });
}

async function main() {
  // Detect transport method from command line arguments
  const args = process.argv.slice(2);
  const httpArg = args.find(arg => arg.startsWith('--http'));
  const port = httpArg ? parseInt(httpArg.split('=')[1]) || 3000 : 3000;
  
  if (args.includes('--http') || httpArg) {
    // HTTP mode
    await startHttpServer(port);
  } else {
    // Default: STDIO mode
    await startStdioServer();
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
