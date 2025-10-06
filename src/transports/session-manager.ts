/**
 * Session Manager
 * Handles MCP session lifecycle, expiration, and monitoring
 */

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { OntapClusterManager } from "../ontap-client.js";
import { 
  SessionMetadata, 
  SessionConfig, 
  SessionStats,
  SessionExpirationReason 
} from "../types/session-types.js";

/**
 * Manages HTTP/SSE session lifecycle with automatic cleanup
 */
export class SessionManager {
  private sessions: Map<string, SessionMetadata> = new Map();
  private config: SessionConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: SessionConfig) {
    this.config = config;
    console.error(`Session Manager initialized:`);
    console.error(`  - Inactivity timeout: ${config.inactivityTimeout / 1000 / 60} minutes`);
    console.error(`  - Max session lifetime: ${config.maxLifetime / 1000 / 60 / 60} hours`);
    console.error(`  - Cleanup interval: ${config.cleanupInterval / 1000} seconds`);
  }

  /**
   * Add a new session with SSE transport and its own cluster manager
   */
  add(sessionId: string, transport: SSEServerTransport): void {
    const now = new Date();
    this.sessions.set(sessionId, {
      transport,
      createdAt: now,
      lastActivityAt: now,
      activityCount: 0,
      clusterManager: new OntapClusterManager()  // Per-session cluster isolation
    });
    console.error(`Session ${sessionId} created with isolated cluster manager. Active sessions: ${this.sessions.size}`);
  }

  /**
   * Create a new session with just a cluster manager (for Streamable HTTP)
   * Streamable HTTP manages its own transports, so we only need the cluster manager here
   */
  create(sessionId: string): void {
    const now = new Date();
    this.sessions.set(sessionId, {
      transport: null as any,  // Not used for Streamable HTTP
      createdAt: now,
      lastActivityAt: now,
      activityCount: 0,
      clusterManager: new OntapClusterManager()
    });
    console.error(`Session ${sessionId} created (Streamable HTTP). Active sessions: ${this.sessions.size}`);
  }

  /**
   * Get session metadata by ID
   */
  get(sessionId: string): SessionMetadata | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if session exists
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Remove session and clean up resources
   */
  remove(sessionId: string, reason: SessionExpirationReason = 'manual_close'): void {
    const metadata = this.sessions.get(sessionId);
    if (metadata) {
      const lifetime = Date.now() - metadata.createdAt.getTime();
      console.error(
        `Session ${sessionId} removed (${reason}) after ${Math.round(lifetime / 1000)}s ` +
        `(${metadata.activityCount} requests)`
      );
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const metadata = this.sessions.get(sessionId);
    if (metadata) {
      metadata.lastActivityAt = new Date();
      metadata.activityCount++;
    }
  }

  /**
   * Get session's cluster manager
   */
  getClusterManager(sessionId: string): OntapClusterManager | undefined {
    return this.sessions.get(sessionId)?.clusterManager;
  }

  /**
   * Get current session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session statistics for monitoring
   */
  getStats(): SessionStats {
    const now = Date.now();
    const stats: SessionStats = {
      total: this.sessions.size,
      byAge: {
        '< 5min': 0,
        '5-20min': 0,
        '20min-1hr': 0,
        '1-6hr': 0,
        '6-24hr': 0,
        '> 24hr': 0
      }
    };

    for (const metadata of this.sessions.values()) {
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

  /**
   * Check for expired sessions and clean them up
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [sessionId, metadata] of this.sessions.entries()) {
      const sessionAge = now - metadata.createdAt.getTime();
      const timeSinceLastActivity = now - metadata.lastActivityAt.getTime();

      let reason: SessionExpirationReason | null = null;
      let reasonText: string | null = null;

      // Check max lifetime
      if (sessionAge > this.config.maxLifetime) {
        reason = 'max_lifetime';
        reasonText = `max lifetime exceeded (${Math.round(sessionAge / 1000 / 60 / 60)} hours)`;
      }
      // Check inactivity timeout
      else if (timeSinceLastActivity > this.config.inactivityTimeout) {
        reason = 'inactivity_timeout';
        reasonText = `inactivity timeout (${Math.round(timeSinceLastActivity / 1000 / 60)} minutes idle)`;
      }

      if (reason && reasonText) {
        console.error(`Expiring session ${sessionId}: ${reasonText}`);
        try {
          metadata.transport.close();
        } catch (error) {
          console.error(`Error closing transport for session ${sessionId}:`, error);
          reason = 'transport_error';
        }
        this.remove(sessionId, reason);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.error(`Cleaned up ${expiredCount} expired session(s). Active sessions: ${this.sessions.size}`);
    }
  }

  /**
   * Start automatic cleanup job
   */
  startCleanup(): void {
    if (this.cleanupInterval) {
      console.error('Session cleanup job already running');
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);

    console.error('Session cleanup job started');
  }

  /**
   * Stop automatic cleanup job
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.error('Session cleanup job stopped');
    }
  }

  /**
   * Close all sessions and stop cleanup
   */
  async closeAll(): Promise<void> {
    this.stopCleanup();

    // Close all active transports
    for (const [sessionId, metadata] of this.sessions.entries()) {
      try {
        console.error(`Closing session ${sessionId}`);
        await metadata.transport.close();
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }
    }

    this.sessions.clear();
    console.error('All sessions closed');
  }

  /**
   * Get configuration
   */
  getConfig(): SessionConfig {
    return { ...this.config };
  }
}
