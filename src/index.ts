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
  InitializeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import express from "express";
import cors from "cors";
import { OntapApiClient, OntapClusterManager } from "./ontap-client.js";

// Import snapshot policy tools
import {
  createCreateSnapshotPolicyToolDefinition,
  handleCreateSnapshotPolicy,
  createListSnapshotPoliciesToolDefinition,
  handleListSnapshotPolicies,
  createGetSnapshotPolicyToolDefinition,
  handleGetSnapshotPolicy,
  createDeleteSnapshotPolicyToolDefinition,
  handleDeleteSnapshotPolicy
} from "./tools/snapshot-policy-tools.js";

// Import export policy tools
import {
  createListExportPoliciesToolDefinition,
  handleListExportPolicies,
  createGetExportPolicyToolDefinition,
  handleGetExportPolicy,
  createCreateExportPolicyToolDefinition,
  handleCreateExportPolicy,
  createDeleteExportPolicyToolDefinition,
  handleDeleteExportPolicy,
  createAddExportRuleToolDefinition,
  handleAddExportRule,
  createUpdateExportRuleToolDefinition,
  handleUpdateExportRule,
  createDeleteExportRuleToolDefinition,
  handleDeleteExportRule
} from "./tools/export-policy-tools.js";

// Import CIFS share tools
import {
  createListCifsSharesToolDefinition,
  handleListCifsShares,
  createGetCifsShareToolDefinition,
  handleGetCifsShare,
  createCreateCifsShareToolDefinition,
  handleCreateCifsShare,
  createUpdateCifsShareToolDefinition,
  handleUpdateCifsShare,
  createDeleteCifsShareToolDefinition,
  handleDeleteCifsShare,
  createClusterListCifsSharesToolDefinition,
  handleClusterListCifsShares,
  createClusterCreateCifsShareToolDefinition,
  handleClusterCreateCifsShare,
  createClusterDeleteCifsShareToolDefinition,
  handleClusterDeleteCifsShare
} from "./tools/cifs-share-tools.js";

// Import volume tools (all volume-related functionality consolidated)
import {
  // Legacy single-cluster volume tools
  createListVolumesToolDefinition,
  handleListVolumes,
  createCreateVolumeToolDefinition,
  handleCreateVolume,
  createGetVolumeStatsToolDefinition,
  handleGetVolumeStats,
  createOfflineVolumeToolDefinition,
  handleOfflineVolume,
  createDeleteVolumeToolDefinition,
  handleDeleteVolume,
  
  // Multi-cluster volume tools
  createClusterListVolumesToolDefinition,
  handleClusterListVolumes,
  createClusterCreateVolumeToolDefinition,
  handleClusterCreateVolume,
  createClusterOfflineVolumeToolDefinition,
  handleClusterOfflineVolume,
  createClusterDeleteVolumeToolDefinition,
  handleClusterDeleteVolume,
  createClusterGetVolumeStatsToolDefinition,
  handleClusterGetVolumeStats,
  
  // Volume configuration and update tools
  createGetVolumeConfigurationToolDefinition,
  handleGetVolumeConfiguration,
  createUpdateVolumeSecurityStyleToolDefinition,
  handleUpdateVolumeSecurityStyle,
  createResizeVolumeToolDefinition,
  handleResizeVolume,
  createUpdateVolumeCommentToolDefinition,
  handleUpdateVolumeComment,
  
  // Volume NFS access tools
  createConfigureVolumeNfsAccessToolDefinition,
  handleConfigureVolumeNfsAccess,
  createDisableVolumeNfsAccessToolDefinition,
  handleDisableVolumeNfsAccess
} from "./tools/volume-tools.js";

// Import volume update tools - DEPRECATED: moved to volume-tools.ts
// import {
//   createGetVolumeConfigurationToolDefinition,
//   handleGetVolumeConfiguration,
//   createUpdateVolumeSecurityStyleToolDefinition,
//   handleUpdateVolumeSecurityStyle,
//   createResizeVolumeToolDefinition,
//   handleResizeVolume,
//   createUpdateVolumeCommentToolDefinition,
//   handleUpdateVolumeComment
// } from "./tools/volume-update-tools.js";

// Import snapshot schedule tools
import {
  createListSnapshotSchedulesToolDefinition,
  handleListSnapshotSchedules,
  createGetSnapshotScheduleToolDefinition,
  handleGetSnapshotSchedule,
  createCreateSnapshotScheduleToolDefinition,
  handleCreateSnapshotSchedule,
  createUpdateSnapshotScheduleToolDefinition,
  handleUpdateSnapshotSchedule,
  createDeleteSnapshotScheduleToolDefinition,
  handleDeleteSnapshotSchedule
} from "./tools/snapshot-schedule-tools.js";

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
 * Parse cluster configuration from initialization options or environment variable
 * Supports both new object format and legacy array format
 */
function parseClusterConfig(initOptions?: any): ClusterConfigArray[] {
  // First try initialization options
  if (initOptions?.ONTAP_CLUSTERS) {
    try {
      const parsed = initOptions.ONTAP_CLUSTERS;
      
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
        console.error(`Pre-registered ${clusters.length} clusters from initializationOptions object format`);
        return clusters;
      }
      
      // Handle legacy array format
      if (Array.isArray(parsed)) {
        console.error(`Pre-registered ${parsed.length} clusters from initializationOptions array format`);
        return parsed as ClusterConfigArray[];
      }
    } catch (error) {
      console.error('Error parsing ONTAP_CLUSTERS from initializationOptions:', error);
    }
  }

  // Fallback to environment variable
  const clustersEnv = process.env.ONTAP_CLUSTERS;
  if (!clustersEnv) {
    console.error('No ONTAP_CLUSTERS found in initializationOptions or environment variables');
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
      console.error(`Pre-registered ${clusters.length} clusters from environment variable object format`);
      return clusters;
    }
    
    // Handle legacy array format
    if (Array.isArray(parsed)) {
      console.error(`Pre-registered ${parsed.length} clusters from environment variable array format`);
      return parsed as ClusterConfigArray[];
    }
    
    console.error('ONTAP_CLUSTERS is not in a recognized format');
    return [];
    
  } catch (error) {
    console.error('Error parsing ONTAP_CLUSTERS environment variable:', error);
    return [];
  }
}

/**
 * Load clusters from configuration
 */
function loadClusters(initOptions?: any): void {
  console.error('=== ONTAP MCP Server Cluster Loading ===');
  const clusters = parseClusterConfig(initOptions);
  
  if (clusters.length > 0) {
    clusters.forEach((cluster: ClusterConfigArray) => {
      clusterManager.addCluster(cluster);
      console.error(`Added cluster: ${cluster.name} at ${cluster.cluster_ip}`);
      
      // Debug: Verify cluster was added
      const addedCluster = clusterManager.getCluster(cluster.name);
      if (addedCluster) {
        console.error(`✅ Verified cluster '${cluster.name}' is in registry`);
      } else {
        console.error(`❌ Failed to verify cluster '${cluster.name}' in registry`);
      }
    });
    
    // Debug: Check total clusters in registry
    const totalClusters = clusterManager.listClusters();
    console.error(`Successfully loaded ${clusters.length} clusters`);
    console.error(`Registry now contains ${totalClusters.length} clusters: ${totalClusters.map(c => c.name).join(', ')}`);
  } else {
    console.error('No clusters loaded - clusters must be added manually via add_cluster tool');
  }
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

// Handle initialization to load clusters from initializationOptions
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  console.error('=== MCP Server Initialization ===');
  console.error('Initialization options received:', !!request.params?.initializationOptions);
  console.error('InitializationOptions content:', JSON.stringify(request.params?.initializationOptions, null, 2));
  
  // Load clusters from initialization options (if any)
  if (request.params?.initializationOptions) {
    loadClusters(request.params.initializationOptions);
  }
  
  // Fallback: Try to load from environment variables if no clusters loaded yet
  if (clusterManager.listClusters().length === 0) {
    console.error('No clusters from initializationOptions, trying environment variables...');
    loadClusters();
  }
  
  return {
    protocolVersion: "2024-11-05",
    capabilities: {
      resources: {},
      tools: {},
    },
    serverInfo: {
      name: "netapp-ontap-mcp",
      version: "2.0.0",
    },
  };
});

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
      
      // Snapshot Policy Management Tools
      createListSnapshotPoliciesToolDefinition(),
      createGetSnapshotPolicyToolDefinition(),
      createCreateSnapshotPolicyToolDefinition(),
      createDeleteSnapshotPolicyToolDefinition(),

      // Export Policy Management Tools
      createListExportPoliciesToolDefinition(),
      createGetExportPolicyToolDefinition(),
      createCreateExportPolicyToolDefinition(),
      createDeleteExportPolicyToolDefinition(),
      createAddExportRuleToolDefinition(),
      createUpdateExportRuleToolDefinition(),
      createDeleteExportRuleToolDefinition(),

      // Volume Management Tools (all volume-related functionality)
      // Legacy single-cluster volume tools
      createListVolumesToolDefinition(),
      createCreateVolumeToolDefinition(),
      createGetVolumeStatsToolDefinition(),
      createOfflineVolumeToolDefinition(),
      createDeleteVolumeToolDefinition(),
      
      // Multi-cluster volume tools  
      createClusterListVolumesToolDefinition(),
      createClusterCreateVolumeToolDefinition(),
      createClusterOfflineVolumeToolDefinition(),
      createClusterDeleteVolumeToolDefinition(),
      createClusterGetVolumeStatsToolDefinition(),
      
      // Volume configuration and update tools
      createGetVolumeConfigurationToolDefinition(),
      createUpdateVolumeSecurityStyleToolDefinition(),
      createResizeVolumeToolDefinition(),
      createUpdateVolumeCommentToolDefinition(),
      
      // Volume NFS access tools
      createConfigureVolumeNfsAccessToolDefinition(),
      createDisableVolumeNfsAccessToolDefinition(),

      // CIFS Share Management Tools
      // Legacy single-cluster CIFS tools
      createListCifsSharesToolDefinition(),
      createGetCifsShareToolDefinition(),
      createCreateCifsShareToolDefinition(),
      createUpdateCifsShareToolDefinition(),
      createDeleteCifsShareToolDefinition(),
      
      // Multi-cluster CIFS tools
      createClusterListCifsSharesToolDefinition(),
      createClusterCreateCifsShareToolDefinition(),
      createClusterDeleteCifsShareToolDefinition(),

      // Snapshot Schedule Management Tools
      createListSnapshotSchedulesToolDefinition(),
      createGetSnapshotScheduleToolDefinition(),
      createCreateSnapshotScheduleToolDefinition(),
      createUpdateSnapshotScheduleToolDefinition(),
      createDeleteSnapshotScheduleToolDefinition(),
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

      // Snapshot Policy Management Tools
      case "list_snapshot_policies": {
        const result = await handleListSnapshotPolicies(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "get_snapshot_policy": {
        const result = await handleGetSnapshotPolicy(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "create_snapshot_policy": {
        const result = await handleCreateSnapshotPolicy(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "delete_snapshot_policy": {
        const result = await handleDeleteSnapshotPolicy(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      // Export Policy Management Tools
      case "list_export_policies": {
        const result = await handleListExportPolicies(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "get_export_policy": {
        const result = await handleGetExportPolicy(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "create_export_policy": {
        const result = await handleCreateExportPolicy(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "delete_export_policy": {
        const result = await handleDeleteExportPolicy(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "add_export_rule": {
        const result = await handleAddExportRule(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "update_export_rule": {
        const result = await handleUpdateExportRule(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "delete_export_rule": {
        const result = await handleDeleteExportRule(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "configure_volume_nfs_access": {
        const result = await handleConfigureVolumeNfsAccess(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "disable_volume_nfs_access": {
        const result = await handleDisableVolumeNfsAccess(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      // Volume Configuration and Update Tools
      case "get_volume_configuration": {
        const result = await handleGetVolumeConfiguration(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "update_volume_security_style": {
        const result = await handleUpdateVolumeSecurityStyle(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "resize_volume": {
        const result = await handleResizeVolume(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "update_volume_comment": {
        const result = await handleUpdateVolumeComment(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      // CIFS Share Management Tools
      case "list_cifs_shares": {
        const result = await handleListCifsShares(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "get_cifs_share": {
        const result = await handleGetCifsShare(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "create_cifs_share": {
        const result = await handleCreateCifsShare(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "update_cifs_share": {
        const result = await handleUpdateCifsShare(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "delete_cifs_share": {
        const result = await handleDeleteCifsShare(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "cluster_list_cifs_shares": {
        const result = await handleClusterListCifsShares(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "cluster_create_cifs_share": {
        const result = await handleClusterCreateCifsShare(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "cluster_delete_cifs_share": {
        const result = await handleClusterDeleteCifsShare(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      // Snapshot Schedule Management Tools
      case "list_snapshot_schedules": {
        const result = await handleListSnapshotSchedules(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "get_snapshot_schedule": {
        const result = await handleGetSnapshotSchedule(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "create_snapshot_schedule": {
        const result = await handleCreateSnapshotSchedule(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "update_snapshot_schedule": {
        const result = await handleUpdateSnapshotSchedule(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
      }

      case "delete_snapshot_schedule": {
        const result = await handleDeleteSnapshotSchedule(args, clusterManager);
        return { content: [{ type: "text", text: result }] };
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
  // Initialize clusters from environment variables for HTTP mode
  console.error('=== HTTP Mode: Loading clusters from environment ===');
  loadClusters();
  
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

  // List available tools endpoint (REST API equivalent of ListToolsRequest)
  app.get('/api/tools', async (req, res) => {
    try {
      // Return the same format as the STDIO ListToolsRequest handler
      // This ensures REST and STDIO modes are completely consistent
      const response = {
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
          
          // Snapshot Policy Management Tools
          createListSnapshotPoliciesToolDefinition(),
          createGetSnapshotPolicyToolDefinition(),
          createCreateSnapshotPolicyToolDefinition(),
          createDeleteSnapshotPolicyToolDefinition(),

          // Export Policy Management Tools
          createListExportPoliciesToolDefinition(),
          createGetExportPolicyToolDefinition(),
          createCreateExportPolicyToolDefinition(),
          createDeleteExportPolicyToolDefinition(),
          createAddExportRuleToolDefinition(),
          createUpdateExportRuleToolDefinition(),
          createDeleteExportRuleToolDefinition(),

          // Volume Management Tools (all volume-related functionality)
          // Legacy single-cluster volume tools
          createListVolumesToolDefinition(),
          createCreateVolumeToolDefinition(),
          createGetVolumeStatsToolDefinition(),
          createOfflineVolumeToolDefinition(),
          createDeleteVolumeToolDefinition(),
          
          // Multi-cluster volume tools  
          createClusterListVolumesToolDefinition(),
          createClusterCreateVolumeToolDefinition(),
          createClusterOfflineVolumeToolDefinition(),
          createClusterDeleteVolumeToolDefinition(),
          createClusterGetVolumeStatsToolDefinition(),
          
          // Volume configuration and update tools
          createGetVolumeConfigurationToolDefinition(),
          createUpdateVolumeSecurityStyleToolDefinition(),
          createResizeVolumeToolDefinition(),
          createUpdateVolumeCommentToolDefinition(),
          
          // Volume NFS access tools
          createConfigureVolumeNfsAccessToolDefinition(),
          createDisableVolumeNfsAccessToolDefinition(),

          // CIFS Share Management Tools
          // Legacy single-cluster CIFS tools
          createListCifsSharesToolDefinition(),
          createGetCifsShareToolDefinition(),
          createCreateCifsShareToolDefinition(),
          createUpdateCifsShareToolDefinition(),
          createDeleteCifsShareToolDefinition(),
          
          // Multi-cluster CIFS tools
          createClusterListCifsSharesToolDefinition(),
          createClusterCreateCifsShareToolDefinition(),
          createClusterDeleteCifsShareToolDefinition(),

          // Snapshot Schedule Management Tools
          createListSnapshotSchedulesToolDefinition(),
          createGetSnapshotScheduleToolDefinition(),
          createCreateSnapshotScheduleToolDefinition(),
          createUpdateSnapshotScheduleToolDefinition(),
          createDeleteSnapshotScheduleToolDefinition(),
        ]
      };
      
      res.json(response);
    } catch (error) {
      console.error('Failed to list tools:', error);
      res.status(500).json({
        error: 'Failed to retrieve tool list',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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
          console.error(`=== DEBUG: HTTP API - list_registered_clusters called ===`);
          const clusters = clusterManager.listClusters();
          console.error(`DEBUG: clusterManager.listClusters() returned ${clusters.length} clusters`);
          console.error(`DEBUG: clusters = ${JSON.stringify(clusters.map(c => ({ name: c.name, ip: c.cluster_ip })))}`);
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
          
          const aggrList = aggregates.map((aggr: any) => 
            `- ${aggr.name} (${aggr.uuid}) - State: ${aggr.state}, Available: ${aggr.space?.block_storage?.available || 'N/A'}, Used: ${aggr.space?.block_storage?.used || 'N/A'}`
          ).join('\n');
          
          result = {
            content: [{
              type: "text",
              text: `Aggregates on cluster '${args.cluster_name}': ${aggregates.length}\n\n${aggrList}`
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
        case 'list_cifs_shares':
          if (!args.cluster_ip && !args.cluster_name) {
            throw new Error('Either cluster_ip (with username/password) or cluster_name is required');
          }
          const cifsListClient = args.cluster_name ? 
            clusterManager.getClient(args.cluster_name) : 
            new OntapApiClient(args.cluster_ip, args.username, args.password);
          const cifsShares = await cifsListClient.listCifsShares(args.svm_name);
          result = {
            content: [{
              type: "text",
              text: `CIFS shares: ${cifsShares.length}\n\n${cifsShares.map((share: any) => `- ${share.name}: ${share.path} (SVM: ${share.svm?.name || 'N/A'})`).join('\n')}`
            }]
          };
          break;
        case 'cluster_list_cifs_shares':
          if (!args.cluster_name) {
            throw new Error('cluster_name is required');
          }
          const clusterCifsClient = clusterManager.getClient(args.cluster_name);
          const clusterCifsShares = await clusterCifsClient.listCifsShares(args.svm_name);
          result = {
            content: [{
              type: "text",
              text: `CIFS shares on cluster '${args.cluster_name}': ${clusterCifsShares.length}\n\n${clusterCifsShares.map((share: any) => `- ${share.name}: ${share.path} (SVM: ${share.svm?.name || 'N/A'})`).join('\n')}`
            }]
          };
          break;
        case 'get_cifs_share':
          if (!args.name || (!args.cluster_ip && !args.cluster_name)) {
            throw new Error('name and either cluster_ip (with username/password) or cluster_name are required');
          }
          const getShareClient = args.cluster_name ? 
            clusterManager.getClient(args.cluster_name) : 
            new OntapApiClient(args.cluster_ip, args.username, args.password);
          const shareInfo = await getShareClient.getCifsShare(args.name, args.svm_name);
          result = {
            content: [{
              type: "text",
              text: `CIFS Share Details:\nName: ${shareInfo.name}\nPath: ${shareInfo.path}\nSVM: ${shareInfo.svm?.name || 'N/A'}\nComment: ${shareInfo.comment || 'None'}`
            }]
          };
          break;
        case 'create_cifs_share':
          if (!args.name || !args.path || (!args.cluster_ip && !args.cluster_name)) {
            throw new Error('name, path, and either cluster_ip (with username/password) or cluster_name are required');
          }
          const createShareClient = args.cluster_name ? 
            clusterManager.getClient(args.cluster_name) : 
            new OntapApiClient(args.cluster_ip, args.username, args.password);
          const createShareResult = await createShareClient.createCifsShare({
            name: args.name,
            path: args.path,
            svm_name: args.svm_name,
            comment: args.comment,
            properties: args.properties,
            access_control: args.access_control
          });
          result = {
            content: [{
              type: "text",
              text: `CIFS share '${args.name}' created successfully at path '${args.path}'`
            }]
          };
          break;
        case 'cluster_create_cifs_share':
          if (!args.cluster_name || !args.name || !args.path) {
            throw new Error('cluster_name, name, and path are required');
          }
          const clusterCreateShareClient = clusterManager.getClient(args.cluster_name);
          const clusterCreateShareResult = await clusterCreateShareClient.createCifsShare({
            name: args.name,
            path: args.path,
            svm_name: args.svm_name,
            comment: args.comment,
            properties: args.properties,
            access_control: args.access_control
          });
          result = {
            content: [{
              type: "text",
              text: `CIFS share '${args.name}' created successfully on cluster '${args.cluster_name}' at path '${args.path}'`
            }]
          };
          break;
        case 'delete_cifs_share':
          if (!args.name || (!args.cluster_ip && !args.cluster_name)) {
            throw new Error('name and either cluster_ip (with username/password) or cluster_name are required');
          }
          const deleteShareClient = args.cluster_name ? 
            clusterManager.getClient(args.cluster_name) : 
            new OntapApiClient(args.cluster_ip, args.username, args.password);
          await deleteShareClient.deleteCifsShare({
            name: args.name,
            svm_name: args.svm_name
          });
          result = {
            content: [{
              type: "text",
              text: `CIFS share '${args.name}' has been deleted successfully`
            }]
          };
          break;
        case 'cluster_delete_cifs_share':
          if (!args.cluster_name || !args.name) {
            throw new Error('cluster_name and name are required');
          }
          const clusterDeleteShareClient = clusterManager.getClient(args.cluster_name);
          await clusterDeleteShareClient.deleteCifsShare({
            name: args.name,
            svm_name: args.svm_name
          });
          result = {
            content: [{
              type: "text",
              text: `CIFS share '${args.name}' has been deleted successfully from cluster '${args.cluster_name}'`
            }]
          };
          break;
        case 'update_cifs_share':
          if (!args.name || (!args.cluster_ip && !args.cluster_name)) {
            throw new Error('name and either cluster_ip (with username/password) or cluster_name are required');
          }
          const updateShareClient = args.cluster_name ? 
            clusterManager.getClient(args.cluster_name) : 
            new OntapApiClient(args.cluster_ip, args.username, args.password);
          await updateShareClient.updateCifsShare({
            name: args.name,
            svm_name: args.svm_name,
            comment: args.comment,
            properties: args.properties,
            access_control: args.access_control
          });
          result = {
            content: [{
              type: "text",
              text: `CIFS share '${args.name}' has been updated successfully`
            }]
          };
          break;
        case 'list_export_policies':
          const exportPoliciesResult = await handleListExportPolicies(args, clusterManager);
          result = {
            content: [{
              type: "text",
              text: exportPoliciesResult
            }]
          };
          break;
        case 'get_export_policy':
          const getExportPolicyResult = await handleGetExportPolicy(args, clusterManager);
          result = {
            content: [{
              type: "text",
              text: getExportPolicyResult
            }]
          };
          break;
        case 'create_export_policy':
          result = await handleCreateExportPolicy(args, clusterManager);
          break;
        case 'delete_export_policy':
          result = await handleDeleteExportPolicy(args, clusterManager);
          break;
        case 'add_export_rule':
          result = await handleAddExportRule(args, clusterManager);
          break;
        case 'update_export_rule':
          result = await handleUpdateExportRule(args, clusterManager);
          break;
        case 'delete_export_rule':
          result = await handleDeleteExportRule(args, clusterManager);
          break;
        case 'list_snapshot_policies':
          const listSnapshotPoliciesResult = await handleListSnapshotPolicies(args, clusterManager);
          result = {
            content: [{
              type: "text",
              text: listSnapshotPoliciesResult
            }]
          };
          break;
        case 'get_snapshot_policy':
          const getSnapshotPolicyResult = await handleGetSnapshotPolicy(args, clusterManager);
          result = {
            content: [{
              type: "text",
              text: getSnapshotPolicyResult
            }]
          };
          break;
        case 'create_snapshot_policy':
          result = await handleCreateSnapshotPolicy(args, clusterManager);
          break;
        case 'delete_snapshot_policy':
          result = await handleDeleteSnapshotPolicy(args, clusterManager);
          break;
        case 'list_snapshot_schedules':
          const listSnapshotSchedulesResult = await handleListSnapshotSchedules(args, clusterManager);
          result = {
            content: [{
              type: "text",
              text: listSnapshotSchedulesResult
            }]
          };
          break;
        case 'get_snapshot_schedule':
          const getSnapshotScheduleResult = await handleGetSnapshotSchedule(args, clusterManager);
          result = {
            content: [{
              type: "text",
              text: getSnapshotScheduleResult
            }]
          };
          break;
        case 'create_snapshot_schedule':
          result = await handleCreateSnapshotSchedule(args, clusterManager);
          break;
        case 'update_snapshot_schedule':
          result = await handleUpdateSnapshotSchedule(args, clusterManager);
          break;
        case 'delete_snapshot_schedule':
          result = await handleDeleteSnapshotSchedule(args, clusterManager);
          break;
        case 'get_all_clusters_info':
          try {
            const clusterInfos = await clusterManager.getAllClustersInfo();
            console.log('DEBUG: getAllClustersInfo returned:', JSON.stringify(clusterInfos, null, 2));
            
            if (clusterInfos.length === 0) {
              result = {
                content: [{
                  type: "text",
                  text: "No clusters registered.",
                }],
              };
            } else {
              const infoText = clusterInfos.map(({ name, info, error }) => {
                if (error) {
                  return `- ${name}: ERROR - ${error}`;
                }
                return `- ${name}: ${info?.name || 'Unknown'} (${info?.version?.full || 'Unknown version'}) - ${info?.state || 'Unknown state'}`;
              }).join('\n');

              result = {
                content: [{
                  type: "text",
                  text: `Cluster Information:\n\n${infoText}`,
                }],
              };
            }
          } catch (error) {
            console.error('ERROR in get_all_clusters_info:', error);
            result = {
              content: [{
                type: "text",
                text: `Error getting cluster information: ${error instanceof Error ? error.message : String(error)}`,
              }],
            };
          }
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
  
  // Check for both --http flag and positional argument
  const isHttpMode = args.includes('--http') || httpArg || args[0] === 'http';
  const httpPort = args[0] === 'http' && args[1] ? parseInt(args[1]) || 3000 : port;
  
  if (isHttpMode) {
    // HTTP mode
    await startHttpServer(httpPort);
  } else {
    // Default: STDIO mode
    await startStdioServer();
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
