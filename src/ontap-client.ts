import https from 'https';
import { z } from 'zod';

// Type definitions for ONTAP API responses
export interface ClusterInfo {
  name: string;
  version: {
    generation: number;
    major: number;
    minor: number;
    micro: number;
    full: string;
  };
  uuid: string;
  state: string;
  nodes?: Array<{
    uuid: string;
    name: string;
    state: string;
  }>;
  management_interface?: {
    ip: {
      address: string;
      netmask: string;
    };
  };
}

export interface VolumeInfo {
  uuid: string;
  name: string;
  size: number;
  state: string;
  type: string;
  svm?: {
    uuid: string;
    name: string;
  };
  aggregates?: Array<{
    uuid: string;
    name: string;
  }>;
}

export interface VolumeStats {
  uuid: string;
  iops?: {
    read: number;
    write: number;
    other: number;
    total: number;
  };
  throughput?: {
    read: number;
    write: number;
    other: number;
    total: number;
  };
  latency?: {
    read: number;
    write: number;
    other: number;
    total: number;
  };
  space?: {
    used: number;
    available: number;
    total: number;
  };
}

export interface CreateVolumeParams {
  svm_name: string;
  volume_name: string;
  size: string;
  aggregate_name?: string;
}

export interface CreateVolumeResponse {
  uuid: string;
  job?: {
    uuid: string;
    state: string;
  };
}

export interface ClusterConfig {
  name: string;
  cluster_ip: string;
  username: string;
  password: string;
  description?: string;
  verify_ssl?: boolean;
}

export interface ClusterRegistry {
  [clusterName: string]: ClusterConfig;
}

/**
 * NetApp ONTAP Cluster Manager
 * Manages multiple ONTAP clusters and provides unified access
 */
export class OntapClusterManager {
  private clusters: ClusterRegistry = {};

  /**
   * Add a cluster to the registry
   */
  addCluster(config: ClusterConfig): void {
    this.clusters[config.name] = config;
  }

  /**
   * Remove a cluster from the registry
   */
  removeCluster(clusterName: string): boolean {
    if (this.clusters[clusterName]) {
      delete this.clusters[clusterName];
      return true;
    }
    return false;
  }

  /**
   * Get cluster configuration
   */
  getCluster(clusterName: string): ClusterConfig | undefined {
    return this.clusters[clusterName];
  }

  /**
   * List all registered clusters
   */
  listClusters(): ClusterConfig[] {
    return Object.values(this.clusters);
  }

  /**
   * Get API client for a specific cluster
   */
  getClient(clusterName: string): OntapApiClient {
    const config = this.clusters[clusterName];
    if (!config) {
      throw new Error(`Cluster '${clusterName}' not found in registry`);
    }
    return new OntapApiClient(config.cluster_ip, config.username, config.password);
  }

  /**
   * Test connectivity to a cluster
   */
  async testCluster(clusterName: string): Promise<ClusterInfo> {
    const client = this.getClient(clusterName);
    return await client.getClusterInfo();
  }

  /**
   * Get cluster info for all registered clusters
   */
  async getAllClustersInfo(): Promise<Array<{ name: string; info: ClusterInfo; error?: string }>> {
    const results = [];
    
    for (const [name, config] of Object.entries(this.clusters)) {
      try {
        const client = new OntapApiClient(config.cluster_ip, config.username, config.password);
        const info = await client.getClusterInfo();
        results.push({ name, info });
      } catch (error) {
        results.push({ 
          name, 
          info: {} as ClusterInfo, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    return results;
  }
}

/**
 * NetApp ONTAP REST API Client
 * Provides methods to interact with ONTAP clusters via REST API
 */
export class OntapApiClient {
  private baseUrl: string;
  private auth: string;
  private agent: https.Agent;

  constructor(
    private clusterIp: string,
    private username: string,
    private password: string
  ) {
    this.baseUrl = `https://${clusterIp}/api`;
    this.auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    // Create HTTPS agent that ignores self-signed certificates (common in ONTAP)
    this.agent = new https.Agent({
      rejectUnauthorized: false,
    });
  }

  /**
   * Make a REST API call to the ONTAP cluster
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: https.RequestOptions = {
      method,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      agent: this.agent,
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const jsonData = data ? JSON.parse(data) : {};
              resolve(jsonData);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  /**
   * Get cluster information
   */
  async getClusterInfo(): Promise<ClusterInfo> {
    const response = await this.makeRequest<{ cluster: ClusterInfo }>('/cluster');
    return response.cluster;
  }

  /**
   * List all volumes, optionally filtered by SVM
   */
  async listVolumes(svmName?: string): Promise<VolumeInfo[]> {
    let endpoint = '/storage/volumes?fields=uuid,name,size,state,type,svm,aggregates';
    
    if (svmName) {
      endpoint += `&svm.name=${encodeURIComponent(svmName)}`;
    }
    
    const response = await this.makeRequest<{ records: VolumeInfo[] }>(endpoint);
    return response.records || [];
  }

  /**
   * Create a new volume
   */
  async createVolume(params: CreateVolumeParams): Promise<CreateVolumeResponse> {
    const body = {
      name: params.volume_name,
      svm: {
        name: params.svm_name,
      },
      size: this.parseSize(params.size),
    };

    // Add aggregate if specified
    if (params.aggregate_name) {
      (body as any).aggregates = [{ name: params.aggregate_name }];
    }

    const response = await this.makeRequest<CreateVolumeResponse>(
      '/storage/volumes',
      'POST',
      body
    );
    
    return response;
  }

  /**
   * Get volume performance statistics
   */
  async getVolumeStats(volumeUuid: string): Promise<VolumeStats> {
    const endpoint = `/storage/volumes/${volumeUuid}/metrics?fields=iops,throughput,latency,space`;
    const response = await this.makeRequest<Omit<VolumeStats, 'uuid'>>(endpoint);
    return { uuid: volumeUuid, ...response };
  }

  /**
   * Get list of SVMs (Storage Virtual Machines)
   */
  async listSvms(): Promise<Array<{ uuid: string; name: string; state: string }>> {
    const endpoint = '/svm/svms?fields=uuid,name,state';
    const response = await this.makeRequest<{ records: Array<{ uuid: string; name: string; state: string }> }>(endpoint);
    return response.records || [];
  }

  /**
   * Get list of aggregates
   */
  async listAggregates(): Promise<Array<{ uuid: string; name: string; state: string; space: any }>> {
    const endpoint = '/storage/aggregates?fields=uuid,name,state,space';
    const response = await this.makeRequest<{ records: Array<{ uuid: string; name: string; state: string; space: any }> }>(endpoint);
    return response.records || [];
  }

  /**
   * Parse size string to bytes
   * Supports formats like: 100GB, 1TB, 500MB, etc.
   */
  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB|PB)$/i);
    if (!match) {
      throw new Error(`Invalid size format: ${sizeStr}. Use format like '100GB', '1TB', etc.`);
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: { [key: string]: number } = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 ** 2,
      'GB': 1024 ** 3,
      'TB': 1024 ** 4,
      'PB': 1024 ** 5,
    };

    return Math.floor(value * multipliers[unit]);
  }
}
