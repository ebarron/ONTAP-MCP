/**
 * Cluster Configuration Management
 * Extracted from index.ts to centralize cluster config parsing and loading
 */

import { OntapClusterManager } from "../ontap-client.js";

/**
 * Interface for cluster configuration in object format (new format)
 */
interface ClusterConfigObject {
  [clusterName: string]: {
    cluster_ip: string;
    username: string;
    password: string;
    description?: string;
  };
}

/**
 * Interface for cluster configuration in array format (legacy)
 */
interface ClusterConfigArray {
  name: string;
  cluster_ip: string;
  username: string;
  password: string;
  description?: string;
}

/**
 * Parse cluster configuration from initialization options or environment variable
 * Supports both new object format and legacy array format
 */
export function parseClusterConfig(initOptions?: any): ClusterConfigArray[] {
  // First try initialization options
  if (initOptions?.ONTAP_CLUSTERS) {
    try {
      const parsed = initOptions.ONTAP_CLUSTERS;
      
      // Check if it's the new object format
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Convert object format to array format for internal use
        const clusters: ClusterConfigArray[] = [];
        for (const [clusterName, config] of Object.entries(parsed as ClusterConfigObject)) {
          clusters.push({
            name: clusterName,
            cluster_ip: config.cluster_ip,
            username: config.username,
            password: config.password,
            description: config.description
          });
        }
        console.error(`Pre-registered ${clusters.length} clusters from initializationOptions object format`);
        return clusters;
      }
      
      // Handle legacy array format
      if (Array.isArray(parsed)) {
        console.error(`Pre-registered ${parsed.length} clusters from initializationOptions array format`);
        return parsed as ClusterConfigArray[];
      }
    } catch (error) {
      console.error('Error parsing ONTAP_CLUSTERS from initializationOptions:', error);
    }
  }

  // Fall back to environment variable
  const envClusters = process.env.ONTAP_CLUSTERS;
  if (envClusters) {
    try {
      const parsed = JSON.parse(envClusters);
      
      // Check if it's the new object format
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Convert object format to array format for internal use
        const clusters: ClusterConfigArray[] = [];
        for (const [clusterName, config] of Object.entries(parsed as ClusterConfigObject)) {
          clusters.push({
            name: clusterName,
            cluster_ip: config.cluster_ip,
            username: config.username,
            password: config.password,
            description: config.description
          });
        }
        console.error(`Pre-registered ${clusters.length} clusters from environment object format`);
        return clusters;
      }
      
      // Handle legacy array format
      if (Array.isArray(parsed)) {
        console.error(`Pre-registered ${parsed.length} clusters from environment array format`);
        return parsed as ClusterConfigArray[];
      }
    } catch (error) {
      console.error('Error parsing ONTAP_CLUSTERS from environment:', error);
    }
  }

  return [];
}

/**
 * Load clusters into the cluster manager from configuration
 */
export function loadClusters(clusterManager: OntapClusterManager, initOptions?: any): void {
  const clusters = parseClusterConfig(initOptions);
  
  for (const cluster of clusters) {
    try {
      clusterManager.addCluster({
        name: cluster.name,
        cluster_ip: cluster.cluster_ip,
        username: cluster.username,
        password: cluster.password,
        description: cluster.description
      });
      console.error(`✓ Loaded cluster: ${cluster.name} (${cluster.cluster_ip})`);
    } catch (error) {
      console.error(`✗ Failed to load cluster ${cluster.name}: ${error}`);
    }
  }
}