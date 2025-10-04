/**
 * HTTP Transport Implementation
 * Handles MCP JSON-RPC 2.0 over Server-Sent Events (SSE)
 * Also maintains legacy REST API for backward compatibility
 */

import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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

export class HttpTransport implements BaseTransport {
  private app: express.Application;
  private clusterManager: OntapClusterManager;
  private server: any;
  private transports: Map<string, SSEServerTransport> = new Map();

  constructor() {
    this.app = express();
    this.clusterManager = new OntapClusterManager();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Create a new MCP Server instance for each SSE connection
   * This follows the SDK's example pattern
   */
  private createMcpServer(): Server {
    const mcpServer = new Server(
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

    // Initialize handler
    mcpServer.setRequestHandler(InitializeRequestSchema, async (request) => {
      console.error("MCP Server initializing via HTTP/SSE...");
      
      // Load clusters from initialization options
      loadClusters(this.clusterManager, request.params.initializationOptions);
      
      // Tools are already registered in start() - don't re-register them
      
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

    // List tools handler
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: getAllToolDefinitions()
      };
    });

    // Call tool handler
    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: args } = request.params;
      
      console.error(`=== MCP JSON-RPC - ${toolName} called ===`);
      
      const handler = getToolHandler(toolName);
      if (!handler) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      try {
        const result = await handler(args || {}, this.clusterManager);
        
        // Wrap result in MCP content format
        // Tools return strings - wrap them in content array
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error in ${toolName}:`, error);
        throw error;
      }
    });

    return mcpServer;
  }

  private setupMiddleware(): void {
    // Configure CORS with exposed headers for MCP session management
    this.app.use(cors({
      origin: '*',
      exposedHeaders: ['Mcp-Session-Id', 'Mcp-Protocol-Version'],
      allowedHeaders: ['Content-Type', 'Mcp-Protocol-Version', 'Mcp-Session-Id']
    }));
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

    // MCP JSON-RPC 2.0 over Server-Sent Events (SSE) - Official MCP Protocol
    // GET endpoint establishes SSE stream
    console.error('Registering MCP SSE endpoint at GET /mcp');
    this.app.get('/mcp', async (req, res) => {
      console.error('MCP SSE stream request received');
      
      try {
        // Create SSE transport (messages will be posted to /messages)
        const transport = new SSEServerTransport('/messages', res);
        
        // Store transport by session ID for message routing
        const sessionId = transport.sessionId;
        this.transports.set(sessionId, transport);
        console.error(`Created SSE transport with session ID: ${sessionId}`);
        
        // Set up cleanup handler
        transport.onclose = () => {
          console.error(`SSE transport closed for session ${sessionId}`);
          this.transports.delete(sessionId);
        };
        
        // Create a new MCP server instance for this connection
        const mcpServer = this.createMcpServer();
        
        // Connect MCP server to transport
        await mcpServer.connect(transport);
        console.error(`MCP server connected via SSE for session ${sessionId}`);
        
      } catch (error) {
        console.error('Error establishing SSE stream:', error);
        if (!res.headersSent) {
          res.status(500).send('Error establishing SSE stream');
        }
      }
    });
    
    // POST endpoint receives JSON-RPC messages
    console.error('Registering MCP message endpoint at POST /messages');
    this.app.post('/messages', async (req, res) => {
      console.error('MCP message received');
      
      // Extract session ID from query parameter (added by client based on SSE endpoint event)
      const sessionId = req.query.sessionId as string;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId parameter' });
      }
      
      // Get the transport for this session
      const transport = this.transports.get(sessionId);
      
      if (!transport) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      try {
        // Handle the POST message with the transport
        await transport.handlePostMessage(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP message:', error);
        if (!res.headersSent) {
          res.status(500).send('Error handling request');
        }
      }
    });
  }

  async start(port: number = 3000): Promise<void> {
    // Load clusters from environment
    loadClusters(this.clusterManager);
    
    // Register all tools (only if not already registered)
    try {
      registerAllTools();
    } catch (error) {
      // Tools may already be registered - that's okay
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('already registered')) {
        throw error;
      }
    }
    
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.error(`NetApp ONTAP MCP Server running on HTTP port ${port}`);
        console.error(`Health check: http://localhost:${port}/health`);
        console.error(`MCP JSON-RPC 2.0 (SSE): GET http://localhost:${port}/mcp`);
        console.error(`MCP Messages endpoint: POST http://localhost:${port}/messages`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    // Close all active SSE transports
    for (const [sessionId, transport] of this.transports.entries()) {
      try {
        console.error(`Closing transport for session ${sessionId}`);
        await transport.close();
      } catch (error) {
        console.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }
    this.transports.clear();
    
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