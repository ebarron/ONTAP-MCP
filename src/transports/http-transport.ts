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
    console.error('=== Starting setupRoutes() ===');
    
    // Health check endpoint
    console.error('Registering health check endpoint');
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

    // MCP JSON-RPC 2.0 endpoint
    console.error('Registering MCP JSON-RPC 2.0 endpoint at /mcp');
    this.app.post('/mcp', async (req, res) => {
      console.error('MCP endpoint hit with request:', req.method, req.path);
      let requestId = null;
      
      try {
        const { jsonrpc, method, params, id } = req.body;
        requestId = id;
        
        // Validate JSON-RPC 2.0 format
        if (jsonrpc !== '2.0') {
          return res.json({
            jsonrpc: '2.0',
            id: requestId,
            error: {
              code: -32600,
              message: 'Invalid Request',
              data: 'JSON-RPC version must be 2.0'
            }
          });
        }
        
        let result: any;
        
        // Handle MCP methods
        switch (method) {
          case 'tools/list':
            result = {
              tools: getAllToolDefinitions()
            };
            break;
            
          case 'tools/call':
            const toolName = params?.name;
            const toolArgs = params?.arguments || {};
            
            if (!toolName) {
              return res.json({
                jsonrpc: '2.0',
                id: requestId,
                error: {
                  code: -32602,
                  message: 'Invalid params',
                  data: 'Tool name is required'
                }
              });
            }
            
            console.error(`=== MCP JSON-RPC - ${toolName} called ===`);
            
            const handler = getToolHandler(toolName);
            if (!handler) {
              return res.json({
                jsonrpc: '2.0',
                id: requestId,
                error: {
                  code: -32601,
                  message: 'Method not found',
                  data: `Tool '${toolName}' not found`
                }
              });
            }
            
            try {
              const toolResult = await handler(toolArgs, this.clusterManager);
              
              // Ensure result is in MCP format (tools should return { content: [...] })
              if (typeof toolResult === 'string') {
                result = {
                  content: [{
                    type: 'text',
                    text: toolResult
                  }]
                };
              } else {
                result = toolResult;
              }
            } catch (toolError) {
              return res.json({
                jsonrpc: '2.0',
                id: requestId,
                error: {
                  code: -32603,
                  message: 'Internal error',
                  data: toolError instanceof Error ? toolError.message : 'Tool execution failed'
                }
              });
            }
            break;
            
          default:
            return res.json({
              jsonrpc: '2.0',
              id: requestId,
              error: {
                code: -32601,
                message: 'Method not found',
                data: `Method '${method}' not supported`
              }
            });
        }
        
        // Return successful JSON-RPC 2.0 response
        res.json({
          jsonrpc: '2.0',
          id: requestId,
          result
        });
        
      } catch (error) {
        console.error('MCP JSON-RPC error:', error);
        res.json({
          jsonrpc: '2.0',
          id: requestId,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    });
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
        console.error(`MCP JSON-RPC 2.0: http://localhost:${port}/mcp`);
        console.error(`Legacy REST API: http://localhost:${port}/api/tools`);
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