/**
 * HTTP Transport Implementation
 * Handles both REST API (legacy) and JSON-RPC over HTTP
 */

import express from "express";
import cors from "cors";
import { BaseTransport } from "./base-transport.js";
import { OntapClusterManager } from "../ontap-client.js";
import { loadClusters } from "../config/cluster-config.js";
import { registerAllTools } from "../registry/register-tools.js";
import { 
  getAllToolDefinitions, 
  getToolHandler 
} from "../registry/tool-registry.js";

export class HttpTransport implements BaseTransport {
  private app: express.Application;
  private clusterManager: OntapClusterManager;
  private server: any;

  constructor() {
    this.app = express();
    this.clusterManager = new OntapClusterManager();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        server: 'NetApp ONTAP MCP Server',
        version: '2.0.0',
        clusters: this.clusterManager.listClusters().length
      });
    });

    // MCP tools list endpoint (REST API equivalent)
    this.app.get('/api/tools', async (req, res) => {
      try {
        const tools = getAllToolDefinitions();
        res.json({
          tools: tools
        });
      } catch (error) {
        console.error('Failed to list tools:', error);
        res.status(500).json({
          error: 'Failed to retrieve tool list',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // RESTful API endpoint for tool execution
    this.app.post('/api/tools/:toolName', async (req, res) => {
      try {
        const { toolName } = req.params;
        const args = req.body;
        
        console.error(`=== HTTP API - ${toolName} called ===`);
        
        const handler = getToolHandler(toolName);
        if (!handler) {
          return res.status(404).json({
            error: `Tool '${toolName}' not found`
          });
        }

        const result = await handler(args, this.clusterManager);
        res.json(result);
        
      } catch (error) {
        console.error(`Error in ${req.params.toolName}:`, error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // TODO: Add JSON-RPC endpoint for MCP compliance
    // this.app.post('/mcp', async (req, res) => {
    //   // JSON-RPC 2.0 implementation
    // });
  }

  async start(port: number = 3000): Promise<void> {
    // Load clusters from environment
    loadClusters(this.clusterManager);
    
    // Register all tools
    registerAllTools();
    
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.error(`NetApp ONTAP MCP Server running on HTTP port ${port}`);
        console.error(`Health check: http://localhost:${port}/health`);
        console.error(`Tools API: http://localhost:${port}/api/tools`);
        console.error(`Tool execution: http://localhost:${port}/api/tools/{toolName}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.error('HTTP server stopped');
          resolve();
        });
      });
    }
  }

  getClusterManager(): OntapClusterManager {
    return this.clusterManager;
  }
}