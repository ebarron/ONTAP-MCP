#!/usr/bin/env node

/**
 * MCP JSON-RPC 2.0 Test Client
 * 
 * NOW USES STREAMABLE HTTP TRANSPORT (MCP 2025-06-18) BY DEFAULT
 * 
 * This is a compatibility wrapper that imports the new Streamable HTTP client.
 * All tests now use the modern protocol by default.
 * 
 * Legacy HTTP+SSE transport (2024-11-05) is deprecated.
 * Original implementation backed up in mcp-legacy-client.js for reference.
 */

// Re-export everything from the new Streamable client
export { 
  MCP_PROTOCOL_VERSION,
  McpStreamableClient as McpTestClient,  // Export with legacy name for test compatibility
  loadClustersFromFile,
  loadClustersIntoSession,
  createSessionWithClusters
} from './mcp-streamable-client.js';

// Also export with new name for clarity
export { McpStreamableClient } from './mcp-streamable-client.js';
