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

/**
 * Session metadata for tracking activity and lifecycle
 */
interface SessionMetadata {
  transport: SSEServerTransport;
  createdAt: Date;
  lastActivityAt: Date;
  activityCount: number;
}

export class HttpTransport implements BaseTransport {
  private app: express.Application;
  private clusterManager: OntapClusterManager;
  private server: any;
  private transports: Map<string, SessionMetadata> = new Map();
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  
  // Session timeout configuration (in milliseconds)
  private readonly INACTIVITY_TIMEOUT: number;
  private readonly MAX_SESSION_LIFETIME: number;
  private readonly CLEANUP_INTERVAL: number = 60000; // Check every 60 seconds

  constructor() {
    this.app = express();
    this.clusterManager = new OntapClusterManager();
    
    // Configure session timeouts from environment variables
    // Default: 20 minutes inactivity timeout
    this.INACTIVITY_TIMEOUT = parseInt(process.env.MCP_SESSION_INACTIVITY_TIMEOUT || '1200000', 10);
    // Default: 24 hours max session lifetime
    this.MAX_SESSION_LIFETIME = parseInt(process.env.MCP_SESSION_MAX_LIFETIME || '86400000', 10);
    
    console.error(`Session Management Configuration:`);
    console.error(`  - Inactivity timeout: ${this.INACTIVITY_TIMEOUT / 1000 / 60} minutes`);
    console.error(`  - Max session lifetime: ${this.MAX_SESSION_LIFETIME / 1000 / 60 / 60} hours`);
    console.error(`  - Cleanup interval: ${this.CLEANUP_INTERVAL / 1000} seconds`);
    
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
      const sessionStats = this.getSessionStats();
      res.json({ 
        status: 'healthy',
        server: 'NetApp ONTAP MCP Server',
        version: '2.0.0',
        clusters: this.clusterManager.listClusters().length,
        sessions: {
          active: sessionStats.total,
          distribution: sessionStats.byAge
        },
        sessionConfig: {
          inactivityTimeoutMinutes: this.INACTIVITY_TIMEOUT / 1000 / 60,
          maxLifetimeHours: this.MAX_SESSION_LIFETIME / 1000 / 60 / 60
        }
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
        
        // Store transport with session metadata
        const sessionId = transport.sessionId;
        const now = new Date();
        this.transports.set(sessionId, {
          transport,
          createdAt: now,
          lastActivityAt: now,
          activityCount: 0
        });
        console.error(`Created SSE transport with session ID: ${sessionId}`);
        
        // Set up cleanup handler
        transport.onclose = () => {
          console.error(`SSE transport closed for session ${sessionId}`);
          this.removeSession(sessionId);
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
      
      // Get the session metadata for this session
      const sessionMetadata = this.transports.get(sessionId);
      
      if (!sessionMetadata) {
        return res.status(404).json({ error: 'Session not found or expired' });
      }
      
      // Update session activity
      sessionMetadata.lastActivityAt = new Date();
      sessionMetadata.activityCount++;
      
      try {
        // Handle the POST message with the transport
        await sessionMetadata.transport.handlePostMessage(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP message:', error);
        if (!res.headersSent) {
          res.status(500).send('Error handling request');
        }
      }
    });
  }

  /**
   * Remove session and clean up resources
   */
  private removeSession(sessionId: string): void {
    const sessionMetadata = this.transports.get(sessionId);
    if (sessionMetadata) {
      const lifetime = Date.now() - sessionMetadata.createdAt.getTime();
      console.error(`Session ${sessionId} removed after ${Math.round(lifetime / 1000)}s (${sessionMetadata.activityCount} requests)`);
      this.transports.delete(sessionId);
    }
  }

  /**
   * Check for expired sessions and clean them up
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [sessionId, metadata] of this.transports.entries()) {
      const sessionAge = now - metadata.createdAt.getTime();
      const timeSinceLastActivity = now - metadata.lastActivityAt.getTime();
      
      let reason: string | null = null;
      
      // Check max lifetime
      if (sessionAge > this.MAX_SESSION_LIFETIME) {
        reason = `max lifetime exceeded (${Math.round(sessionAge / 1000 / 60 / 60)} hours)`;
      }
      // Check inactivity timeout
      else if (timeSinceLastActivity > this.INACTIVITY_TIMEOUT) {
        reason = `inactivity timeout (${Math.round(timeSinceLastActivity / 1000 / 60)} minutes idle)`;
      }
      
      if (reason) {
        console.error(`Expiring session ${sessionId}: ${reason}`);
        try {
          metadata.transport.close();
        } catch (error) {
          console.error(`Error closing transport for session ${sessionId}:`, error);
        }
        this.removeSession(sessionId);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      console.error(`Cleaned up ${expiredCount} expired session(s). Active sessions: ${this.transports.size}`);
    }
  }

  /**
   * Get session statistics for monitoring
   */
  private getSessionStats(): { total: number; byAge: Record<string, number> } {
    const now = Date.now();
    const stats = {
      total: this.transports.size,
      byAge: {
        '< 5min': 0,
        '5-20min': 0,
        '20min-1hr': 0,
        '1-6hr': 0,
        '6-24hr': 0,
        '> 24hr': 0
      }
    };
    
    for (const metadata of this.transports.values()) {
      const ageMinutes = (now - metadata.createdAt.getTime()) / 1000 / 60;
      
      if (ageMinutes < 5) stats.byAge['< 5min']++;
      else if (ageMinutes < 20) stats.byAge['5-20min']++;
      else if (ageMinutes < 60) stats.byAge['20min-1hr']++;
      else if (ageMinutes < 360) stats.byAge['1-6hr']++;
      else if (ageMinutes < 1440) stats.byAge['6-24hr']++;
      else stats.byAge['> 24hr']++;
    }
    
    return stats;
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
    
    // Start session cleanup interval
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL);
    
    console.error('Session cleanup job started');
    
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
    // Stop session cleanup interval
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
      console.error('Session cleanup job stopped');
    }
    
    // Close all active SSE transports
    for (const [sessionId, sessionMetadata] of this.transports.entries()) {
      try {
        console.error(`Closing transport for session ${sessionId}`);
        await sessionMetadata.transport.close();
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