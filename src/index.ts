#!/usr/bin/env node

/**
 * NetApp ONTAP MCP Server - Main Entry Point
 * 
 * Refactored for clean separation of concerns:
 * - Tool registry eliminates duplication
 * - Transport abstraction supports STDIO/HTTP/JSON-RPC
 * - Configuration management centralized
 * - All business logic moved to appropriate modules
 */

import { TransportFactory } from "./transports/base-transport.js";
import { OntapClusterManager, OntapApiClient } from "./ontap-client.js";
import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";

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

// Import configuration management
import { parseClusterConfig, loadClusters } from "./config/cluster-config.js";

// Import tool registry system
import { registerAllTools } from "./registry/register-tools.js";
import { getAllToolDefinitions, getToolHandler } from "./registry/tool-registry.js";

// Create global cluster manager instance
const clusterManager = new OntapClusterManager();

// Initialize tool registry
registerAllTools();


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
    loadClusters(clusterManager, request.params.initializationOptions);
  }
  
  // Fallback: Try to load from environment variables if no clusters loaded yet
  if (clusterManager.listClusters().length === 0) {
    console.error('No clusters from initializationOptions, trying environment variables...');
    loadClusters(clusterManager);
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
    tools: getAllToolDefinitions(),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    // Use registry system to handle tool calls
    const handler = getToolHandler(name);
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    const result = await handler(args, clusterManager);
    return {
      content: [{
        type: "text",
        text: result,
      }],
    };
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
  loadClusters(clusterManager);
  
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
      // Return the same format as the STDIO ListToolsRequest handler using registry
      // This ensures REST and STDIO modes are completely consistent
      const response = {
        tools: getAllToolDefinitions()
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
      
      // Use registry system to handle HTTP tool calls
      const handler = getToolHandler(toolName);
      if (!handler) {
        throw new Error(`Tool '${toolName}' not implemented in REST API`);
      }
      
      const result = await handler(args, clusterManager);
      res.json({
        content: [{
          type: "text",
          text: result
        }]
      });
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
