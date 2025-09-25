/**
 * Base Transport Interface
 * Common interface for all transport implementations
 */

import { OntapClusterManager } from "../ontap-client.js";

/**
 * Base transport interface that all transport implementations must follow
 */
export interface BaseTransport {
  /**
   * Start the transport server
   */
  start(port?: number): Promise<void>;

  /**
   * Stop the transport server
   */
  stop(): Promise<void>;

  /**
   * Get the cluster manager instance
   */
  getClusterManager(): OntapClusterManager;
}

/**
 * Transport factory for creating appropriate transport instances
 */
export class TransportFactory {
  /**
   * Create transport based on command line arguments
   */
  static createTransport(args: string[]): BaseTransport {
    const httpArg = args.find(arg => arg.startsWith('--http'));
    const isHttpMode = args.includes('--http') || httpArg || args[0] === 'http';
    
    if (isHttpMode) {
      // Import HTTP transport dynamically to avoid circular dependencies
      const { HttpTransport } = require('./http-transport.js');
      return new HttpTransport();
    } else {
      // Import STDIO transport dynamically
      const { StdioTransport } = require('./stdio-transport.js');
      return new StdioTransport();
    }
  }

  /**
   * Parse port from command line arguments
   */
  static parsePort(args: string[]): number {
    const httpArg = args.find(arg => arg.startsWith('--http'));
    if (httpArg) {
      const port = parseInt(httpArg.split('=')[1]);
      return port || 3000;
    }
    
    if (args[0] === 'http' && args[1]) {
      const port = parseInt(args[1]);
      return port || 3000;
    }
    
    return 3000;
  }
}