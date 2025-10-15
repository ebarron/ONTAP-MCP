/**
 * Streamable HTTP Transport Implementation (MCP Spec 2025-06-18)
 * 
 * Implements the modern Streamable HTTP transport with Mcp-Session-Id header support.
 * This transport will eventually replace the legacy HTTP+SSE transport.
 * 
 * Key differences from legacy HTTP+SSE:
 * - Single /mcp endpoint for all operations (GET, POST, DELETE)
 * - Session ID communicated via Mcp-Session-Id HTTP header
 * - Supports resumability via event store (optional)
 * - Server-generated session IDs for stateful mode
 * 
 * Usage:
 * - POST /mcp with initialize request → Server generates session ID in header
 * - GET /mcp with Mcp-Session-Id header → Establishes SSE stream
 * - POST /mcp with Mcp-Session-Id header → Send JSON-RPC requests
 * - DELETE /mcp with Mcp-Session-Id header → Terminate session
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { BaseTransport } from './base-transport.js';
import { OntapClusterManager } from '../ontap-client.js';
import { SessionManager } from './session-manager.js';
import { loadClusters } from '../config/cluster-config.js';
import { registerAllTools } from '../registry/register-tools.js';
import {
  getAllToolDefinitions,
  getToolHandler
} from '../registry/tool-registry.js';

/**
 * Streamable HTTP Transport for MCP 2025-06-18 specification
 * 
 * This transport maintains session-scoped cluster managers similar to the legacy
 * HTTP+SSE transport, but uses the modern Streamable HTTP protocol.
 */
export class StreamableHttpTransport implements BaseTransport {
  private app: express.Application;
  private server: any;
  private sessionManager: SessionManager;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  constructor() {
    this.app = express();
    
    // Initialize session manager with configuration from environment variables
    this.sessionManager = new SessionManager({
      inactivityTimeout: parseInt(process.env.MCP_SESSION_INACTIVITY_TIMEOUT || '1200000', 10),
      maxLifetime: parseInt(process.env.MCP_SESSION_MAX_LIFETIME || '86400000', 10),
      cleanupInterval: 60000 // Check every 60 seconds
    });
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Create a new MCP Server instance for each transport connection
   * This follows the SDK's example pattern
   */
  private createMcpServer(sessionId: string): Server {
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
      console.error(`[Streamable HTTP] Session ${sessionId} initializing...`);
      
      // Get this session's cluster manager
      const clusterManager = this.sessionManager.getClusterManager(sessionId);
      if (!clusterManager) {
        throw new Error(`No cluster manager found for session ${sessionId}`);
      }
      
      // Load clusters into THIS SESSION's cluster manager
      // Priority: initializationOptions > environment variables
      loadClusters(clusterManager, request.params.initializationOptions);
      
      // Backwards compatibility: If no clusters loaded from initializationOptions,
      // fall back to environment variables (for legacy tests)
      if (clusterManager.listClusters().length === 0) {
        console.error(`[Streamable HTTP] No clusters from initializationOptions, trying environment variables...`);
        loadClusters(clusterManager);
      }
      
      console.error(`[Streamable HTTP] Session ${sessionId} initialized with ${clusterManager.listClusters().length} cluster(s)`);
      
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
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: getAllToolDefinitions()
      };
    });

    // Call tool handler
    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: args } = request.params;
      
      console.error(`[Streamable HTTP] Tool ${toolName} called (session: ${sessionId})`);
      
      // Get this session's cluster manager
      const clusterManager = this.sessionManager.getClusterManager(sessionId);
      if (!clusterManager) {
        throw new Error(`No cluster manager found for session ${sessionId}`);
      }
      
      // Update session activity
      this.sessionManager.updateActivity(sessionId);
      
      const handler = getToolHandler(toolName);
      if (!handler) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      try {
        const result = await handler(args || {}, clusterManager);
        
        // Wrap result in MCP content format
        // Handle different result types:
        // - string: plain text response
        // - object with {summary, data}: hybrid format (keep as object)
        // - other objects: stringify for backwards compatibility
        let text: any;
        if (typeof result === 'string') {
          text = result;
        } else if (result && typeof result === 'object' && 'summary' in result && 'data' in result) {
          // Hybrid format - keep as object for client to use directly
          text = result;
        } else {
          // Legacy: stringify other objects
          text = JSON.stringify(result, null, 2);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: text
            }
          ]
        };
      } catch (error) {
        console.error(`[Streamable HTTP] Error in ${toolName}:`, error);
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
    console.error('[Streamable HTTP] Setting up routes...');
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const sessionStats = this.sessionManager.getStats();
      const config = this.sessionManager.getConfig();
      
      // Count total clusters across all sessions
      let totalClusters = 0;
      for (const sessionId of this.sessionManager.getSessionIds()) {
        const clusterManager = this.sessionManager.getClusterManager(sessionId);
        if (clusterManager) {
          totalClusters += clusterManager.listClusters().length;
        }
      }
      
      res.json({ 
        status: 'healthy',
        server: 'NetApp ONTAP MCP Server',
        version: '2.0.0',
        transport: 'Streamable HTTP (2025-06-18)',
        clusters: totalClusters,
        sessions: {
          active: sessionStats.total,
          distribution: sessionStats.byAge
        },
        sessionConfig: {
          inactivityTimeoutMinutes: config.inactivityTimeout / 1000 / 60,
          maxLifetimeHours: config.maxLifetime / 1000 / 60 / 60
        }
      });
    });

    // Streamable HTTP endpoint - handles GET, POST, DELETE
    this.app.all('/mcp', async (req, res) => {
      console.error(`[Streamable HTTP] Received ${req.method} request to /mcp`);
      console.error(`[Streamable HTTP] Headers:`, JSON.stringify(req.headers, null, 2));
      console.error(`[Streamable HTTP] Body:`, JSON.stringify(req.body, null, 2));
      
      try {
        // Check for existing session ID in headers
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        console.error(`[Streamable HTTP] Session ID from header: ${sessionId}`);
        
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.transports.has(sessionId)) {
          // Reuse existing transport
          transport = this.transports.get(sessionId)!;
          console.error(`[Streamable HTTP] Reusing transport for session ${sessionId}`);
          
          // Handle the request with the existing transport
          await transport.handleRequest(req, res, req.body);
        } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
          // Create new transport for initialization request
          console.error('[Streamable HTTP] Creating new transport for initialization');
          console.error('[Streamable HTTP] Request body is valid initialize request');
          
          const newSessionId = randomUUID();
          console.error(`[Streamable HTTP] Generated session ID: ${newSessionId}`);
          
          // Create session in session manager BEFORE creating transport
          // This ensures the cluster manager is ready when initialize handler runs
          this.sessionManager.create(newSessionId);
          console.error(`[Streamable HTTP] Created session in session manager: ${newSessionId}`);
          
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId,
            // Use default SSE streaming (enableJsonResponse: false by default)
            onsessioninitialized: (sid) => {
              console.error(`[Streamable HTTP] Session initialized callback with ID: ${sid}`);
              
              // Store the transport by session ID
              this.transports.set(sid, transport);
            },
            onsessionclosed: async (sid) => {
              console.error(`[Streamable HTTP] Session closed: ${sid}`);
              
              // Clean up transport
              this.transports.delete(sid);
              
              // Clean up from session manager if tracked
              this.sessionManager.remove(sid, 'manual_close');
            }
          });

          // Set up onclose handler for transport cleanup
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && this.transports.has(sid)) {
              console.error(`[Streamable HTTP] Transport closed for session ${sid}`);
              this.transports.delete(sid);
              this.sessionManager.remove(sid, 'transport_error');
            }
          };

          // Create MCP server and connect BEFORE handling the request
          console.error('[Streamable HTTP] Creating MCP server and connecting transport...');
          const mcpServer = this.createMcpServer(newSessionId);
          await mcpServer.connect(transport);
          console.error('[Streamable HTTP] MCP server connected, handling request...');
          
          // Now handle the initialization request
          await transport.handleRequest(req, res, req.body);
          console.error('[Streamable HTTP] Request handled successfully');
        } else {
          // Invalid request - no session ID or not initialization request
          console.error('[Streamable HTTP] Invalid request - sessionId:', sessionId, 'method:', req.method, 'isInit:', isInitializeRequest(req.body));
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided or not an initialization request'
            },
            id: null
          });
          return;
        }
      } catch (error) {
        console.error('[Streamable HTTP] Error handling request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error'
            },
            id: null
          });
        }
      }
    });
  }

  async start(port: number = 3000): Promise<void> {
    // Register all tools (only if not already registered)
    try {
      registerAllTools();
      console.error('[Streamable HTTP] Tools registered successfully');
    } catch (error) {
      // Tools might already be registered - this is okay
      console.error('[Streamable HTTP] Tools already registered or error:', error);
    }
    
    // Start session cleanup
    this.sessionManager.startCleanup();
    
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.error(`[Streamable HTTP] NetApp ONTAP MCP Server running on port ${port}`);
        console.error('[Streamable HTTP] Using Streamable HTTP transport (MCP 2025-06-18)');
        console.error('[Streamable HTTP] Endpoint: /mcp (GET, POST, DELETE)');
        console.error('[Streamable HTTP] Session ID communicated via Mcp-Session-Id header');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    // Close all transports and sessions
    for (const [sessionId, transport] of this.transports) {
      try {
        console.error(`[Streamable HTTP] Closing transport for session ${sessionId}`);
        await transport.close();
      } catch (error) {
        console.error(`[Streamable HTTP] Error closing transport for session ${sessionId}:`, error);
      }
    }
    this.transports.clear();
    
    // Close all sessions
    await this.sessionManager.closeAll();
    
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.error('[Streamable HTTP] Server stopped');
          resolve();
        });
      });
    }
  }

  getClusterManager(): OntapClusterManager {
    // Streamable HTTP mode uses session-scoped cluster managers for security
    // Tools receive the appropriate manager via the CallTool handler
    throw new Error(
      'getClusterManager() not supported in Streamable HTTP mode. ' +
      'Streamable HTTP mode uses session-scoped cluster managers for security isolation. ' +
      'Use sessionManager.getClusterManager(sessionId) instead.'
    );
  }
}
