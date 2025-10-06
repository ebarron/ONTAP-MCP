/**
 * STDIO Transport Implementation
 * Handles MCP communication over STDIO
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { BaseTransport } from "./base-transport.js";
import { OntapClusterManager } from "../ontap-client.js";
import { loadClusters } from "../config/cluster-config.js";
import { registerAllTools } from "../registry/register-tools.js";
import { 
  getAllToolDefinitions, 
  getToolHandler 
} from "../registry/tool-registry.js";

export class StdioTransport implements BaseTransport {
  private server: Server;
  private clusterManager: OntapClusterManager;

  constructor() {
    this.server = new Server(
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
    
    this.clusterManager = new OntapClusterManager();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Initialize handler
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      console.error("MCP Server initializing...");
      
      // Load clusters from initialization options
      loadClusters(this.clusterManager, request.params.initializationOptions);
      
      // Register all tools
      registerAllTools();
      
      return {
        protocolVersion: "2025-06-18",
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

    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: getAllToolDefinitions()
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: args } = request.params;
      
      console.error(`=== STDIO API - ${toolName} called ===`);
      
      const handler = getToolHandler(toolName);
      if (!handler) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      try {
        return await handler(args || {}, this.clusterManager);
      } catch (error) {
        console.error(`Error in ${toolName}:`, error);
        throw error;
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("NetApp ONTAP MCP Server running on STDIO");
  }

  async stop(): Promise<void> {
    await this.server.close();
  }

  getClusterManager(): OntapClusterManager {
    return this.clusterManager;
  }
}