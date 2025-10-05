/**
 * TypeScript types for MCP Session Management
 * Used by HTTP/SSE transport for tracking connection lifecycle
 */

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { OntapClusterManager } from "../ontap-client.js";

/**
 * Session metadata for tracking activity and lifecycle
 */
export interface SessionMetadata {
  /** SSE transport instance for this session */
  transport: SSEServerTransport;
  /** When the session was created */
  createdAt: Date;
  /** Last request timestamp */
  lastActivityAt: Date;
  /** Total number of requests processed */
  activityCount: number;
  /** Session-scoped cluster manager (HTTP mode only) */
  clusterManager: OntapClusterManager;
}

/**
 * Session manager configuration
 */
export interface SessionConfig {
  /** Inactivity timeout in milliseconds */
  inactivityTimeout: number;
  /** Maximum session lifetime in milliseconds */
  maxLifetime: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
}

/**
 * Session statistics for monitoring
 */
export interface SessionStats {
  /** Total active sessions */
  total: number;
  /** Sessions grouped by age */
  byAge: Record<string, number>;
}

/**
 * Session expiration reason
 */
export type SessionExpirationReason = 
  | 'inactivity_timeout'
  | 'max_lifetime'
  | 'manual_close'
  | 'transport_error';
