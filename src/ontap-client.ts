import * as https from 'https';
import { z } from 'zod';
import type { 
  SnapshotPolicy, 
  CreateSnapshotPolicyRequest, 
  UpdateSnapshotPolicyRequest,
  SnapshotPolicyResponse,
  ListSnapshotPoliciesParams
} from './types/snapshot-types.js';
import type {
  VolumeInfo,
  VolumeStats,
  CreateVolumeParams,
  CreateVolumeResponse,
  VolumeSnapshotConfig,
  VolumeNfsConfig
} from './types/volume-types.js';
import type {
  ExportPolicy,
  ExportRule,
  CreateExportPolicyRequest,
  CreateExportRuleRequest,
  UpdateExportRuleRequest,
  ExportPolicyResponse,
  ExportRuleResponse,
  ListExportPoliciesParams,
  ListExportRulesParams
} from './types/export-policy-types.js';
import type {
  CifsShareInfo,
  CreateCifsShareRequest,
  UpdateCifsShareRequest,
  ListCifsSharesParams,
  CifsShareResponse,
  DeleteCifsShareParams,
  UpdateCifsShareAclParams
} from './types/cifs-types.js';

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
    const body: any = {
      name: params.volume_name,
      svm: {
        name: params.svm_name,
      },
      size: this.parseSize(params.size),
    };

    // Add aggregate if specified
    if (params.aggregate_name) {
      body.aggregates = [{ name: params.aggregate_name }];
    }

    // Add snapshot policy if specified
    if (params.snapshot_policy) {
      body.snapshot_policy = { name: params.snapshot_policy };
    }

    // Add NFS export policy if specified
    if (params.nfs_export_policy) {
      body.nas = {
        export_policy: { name: params.nfs_export_policy }
      };
    }

    const response = await this.makeRequest<any>(
      '/storage/volumes',
      'POST',
      body
    );
    
    // Handle different response formats from ONTAP API
    let volumeUuid: string;
    if (response.uuid) {
      // Direct UUID response
      volumeUuid = response.uuid;
    } else {
      // If no UUID is returned, we need to get it by listing volumes and finding the one we just created
      // Wait and retry with backoff for the volume to appear
      let foundVolumeUuid: string | undefined;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!foundVolumeUuid && attempts < maxAttempts) {
        attempts++;
        // Progressive delay: 1s, 2s, 3s, 4s, 5s
        const delay = attempts * 1000;
        console.log(`Waiting ${delay}ms for volume '${params.volume_name}' to appear (attempt ${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const volumes = await this.listVolumes(params.svm_name);
        const newVolume = volumes.find(v => v.name === params.volume_name);
        
        if (newVolume) {
          foundVolumeUuid = newVolume.uuid;
          console.log(`Volume '${params.volume_name}' found after ${attempts} attempts`);
          break;
        }
      }
      
      if (!foundVolumeUuid) {
        throw new Error(`Volume '${params.volume_name}' was not found after creation (tried ${maxAttempts} times over ${maxAttempts * (maxAttempts + 1) / 2} seconds)`);
      }
      
      volumeUuid = foundVolumeUuid;
    }

    // Create CIFS share if specified
    if (params.cifs_share) {
      try {
        await this.createCifsShare({
          name: params.cifs_share.share_name,
          path: `/vol/${params.volume_name}`,
          svm_name: params.svm_name,
          comment: params.cifs_share.comment,
          properties: params.cifs_share.properties,
          access_control: params.cifs_share.access_control
        });
      } catch (error) {
        // Log the error but don't fail the volume creation
        console.error(`Warning: Failed to create CIFS share '${params.cifs_share.share_name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      uuid: volumeUuid,
      job: response.job
    };
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
   * Take a volume offline
   * @param volumeUuid UUID of the volume to offline
   */
  async offlineVolume(volumeUuid: string): Promise<void> {
    const endpoint = `/storage/volumes/${volumeUuid}`;
    const body = {
      state: "offline"
    };
    
    await this.makeRequest(endpoint, 'PATCH', body);
  }

  /**
   * Delete a volume (must be offline first)
   * @param volumeUuid UUID of the volume to delete
   */
  async deleteVolume(volumeUuid: string): Promise<void> {
    const endpoint = `/storage/volumes/${volumeUuid}`;
    
    await this.makeRequest(endpoint, 'DELETE');
  }

  /**
   * Get volume information by UUID
   * @param volumeUuid UUID of the volume
   */
  async getVolumeInfo(volumeUuid: string): Promise<VolumeInfo> {
    const endpoint = `/storage/volumes/${volumeUuid}?fields=name,state,size,svm,type,comment`;
    const response = await this.makeRequest<VolumeInfo>(endpoint);
    return response;
  }

  // ================================
  // Snapshot Policy Management
  // ================================

  /**
   * List all snapshot policies
   */
  async listSnapshotPolicies(params?: ListSnapshotPoliciesParams): Promise<SnapshotPolicy[]> {
    let endpoint = '/storage/snapshot-policies?fields=uuid,name,comment,svm,enabled';
    
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
      if (queryParams.toString()) {
        endpoint += `&${queryParams.toString()}`;
      }
    }
    
    const response = await this.makeRequest<SnapshotPolicyResponse>(endpoint);
    return response.records || [];
  }

  /**
   * Get a specific snapshot policy by name or UUID
   */
  async getSnapshotPolicy(nameOrUuid: string, svmName?: string): Promise<SnapshotPolicy> {
    let endpoint = `/storage/snapshot-policies?name=${encodeURIComponent(nameOrUuid)}&fields=uuid,name,comment,svm,enabled`;
    
    if (svmName) {
      endpoint += `&svm.name=${encodeURIComponent(svmName)}`;
    }
    
    const response = await this.makeRequest<SnapshotPolicyResponse>(endpoint);
    
    if (!response.records || response.records.length === 0) {
      // Try by UUID
      try {
        const directResponse = await this.makeRequest<SnapshotPolicy>(`/storage/snapshot-policies/${nameOrUuid}?fields=uuid,name,comment,svm,enabled`);
        return directResponse;
      } catch {
        throw new Error(`Snapshot policy '${nameOrUuid}' not found`);
      }
    }
    
    return response.records[0];
  }

  /**
   * Create a new snapshot policy
   */
  async createSnapshotPolicy(policy: CreateSnapshotPolicyRequest): Promise<{ uuid: string }> {
    const response = await this.makeRequest<{ uuid: string }>(
      '/storage/snapshot-policies',
      'POST',
      policy
    );
    return response;
  }

  /**
   * Update an existing snapshot policy
   */
  async updateSnapshotPolicy(nameOrUuid: string, updates: UpdateSnapshotPolicyRequest): Promise<void> {
    // First get the policy to determine if we're using name or UUID
    let policyUuid = nameOrUuid;
    
    // If it doesn't look like a UUID, find the policy by name
    if (!nameOrUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const policy = await this.getSnapshotPolicy(nameOrUuid);
      policyUuid = policy.uuid!;
    }
    
    await this.makeRequest(
      `/storage/snapshot-policies/${policyUuid}`,
      'PATCH',
      updates
    );
  }

  /**
   * Delete a snapshot policy
   */
  async deleteSnapshotPolicy(nameOrUuid: string): Promise<void> {
    // First get the policy to determine if we're using name or UUID
    let policyUuid = nameOrUuid;
    
    // If it doesn't look like a UUID, find the policy by name
    if (!nameOrUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const policy = await this.getSnapshotPolicy(nameOrUuid);
      policyUuid = policy.uuid!;
    }
    
    await this.makeRequest(
      `/storage/snapshot-policies/${policyUuid}`,
      'DELETE'
    );
  }

  /**
   * Apply a snapshot policy to a volume
   */
  async applySnapshotPolicyToVolume(volumeUuid: string, policyName: string): Promise<void> {
    const body = {
      snapshot_policy: {
        name: policyName
      }
    };
    
    await this.makeRequest(
      `/storage/volumes/${volumeUuid}`,
      'PATCH',
      body
    );
  }

  /**
   * Remove snapshot policy from a volume (set to default)
   */
  async removeSnapshotPolicyFromVolume(volumeUuid: string): Promise<void> {
    const body = {
      snapshot_policy: {
        name: "default"
      }
    };
    
    await this.makeRequest(
      `/storage/volumes/${volumeUuid}`,
      'PATCH',
      body
    );
  }

  // ================================
  // Export Policy Management
  // ================================

  /**
   * List all export policies
   */
  async listExportPolicies(params?: ListExportPoliciesParams): Promise<ExportPolicy[]> {
    let endpoint = '/protocols/nfs/export-policies?fields=id,name,svm,rules';
    
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
      if (queryParams.toString()) {
        endpoint += `&${queryParams.toString()}`;
      }
    }
    
    const response = await this.makeRequest<ExportPolicyResponse>(endpoint);
    return response.records || [];
  }

  /**
   * Get a specific export policy by name or ID
   */
  async getExportPolicy(nameOrId: string | number, svmName?: string): Promise<ExportPolicy> {
    if (typeof nameOrId === 'number' || /^\d+$/.test(nameOrId.toString())) {
      // It's an ID
      const endpoint = `/protocols/nfs/export-policies/${nameOrId}?fields=id,name,svm,rules`;
      return await this.makeRequest<ExportPolicy>(endpoint);
    } else {
      // It's a name, search for it
      let endpoint = `/protocols/nfs/export-policies?name=${encodeURIComponent(nameOrId.toString())}&fields=id,name,svm,rules`;
      
      if (svmName) {
        endpoint += `&svm.name=${encodeURIComponent(svmName)}`;
      }
      
      const response = await this.makeRequest<ExportPolicyResponse>(endpoint);
      
      if (!response.records || response.records.length === 0) {
        throw new Error(`Export policy '${nameOrId}' not found`);
      }
      
      return response.records[0];
    }
  }

  /**
   * Create a new export policy
   */
  async createExportPolicy(policy: CreateExportPolicyRequest): Promise<{ id: number }> {
    const response = await this.makeRequest<{ id: number }>(
      '/protocols/nfs/export-policies',
      'POST',
      policy
    );
    return response;
  }

  /**
   * Delete an export policy
   */
  async deleteExportPolicy(nameOrId: string | number, svmName?: string): Promise<void> {
    let policyId: number;
    
    if (typeof nameOrId === 'number' || /^\d+$/.test(nameOrId.toString())) {
      policyId = Number(nameOrId);
    } else {
      const policy = await this.getExportPolicy(nameOrId, svmName);
      policyId = policy.id!;
    }
    
    await this.makeRequest(
      `/protocols/nfs/export-policies/${policyId}`,
      'DELETE'
    );
  }

  /**
   * List export rules for a specific policy
   */
  async listExportRules(policyNameOrId: string | number, svmName?: string, params?: ListExportRulesParams): Promise<ExportRule[]> {
    let policyId: number;
    
    if (typeof policyNameOrId === 'number' || /^\d+$/.test(policyNameOrId.toString())) {
      policyId = Number(policyNameOrId);
    } else {
      const policy = await this.getExportPolicy(policyNameOrId, svmName);
      policyId = policy.id!;
    }
    
    let endpoint = `/protocols/nfs/export-policies/${policyId}/rules?fields=index,clients,protocols,ro_rule,rw_rule,superuser,allow_device_creation,allow_suid,anonymous_user,comment`;
    
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
      if (queryParams.toString()) {
        endpoint += `&${queryParams.toString()}`;
      }
    }
    
    const response = await this.makeRequest<ExportRuleResponse>(endpoint);
    return response.records || [];
  }

  /**
   * Add a new export rule to a policy
   */
  async addExportRule(policyNameOrId: string | number, rule: CreateExportRuleRequest, svmName?: string): Promise<{ index: number }> {
    let policyId: number;
    
    if (typeof policyNameOrId === 'number' || /^\d+$/.test(policyNameOrId.toString())) {
      policyId = Number(policyNameOrId);
    } else {
      const policy = await this.getExportPolicy(policyNameOrId, svmName);
      policyId = policy.id!;
    }
    
    const response = await this.makeRequest<{ index: number }>(
      `/protocols/nfs/export-policies/${policyId}/rules`,
      'POST',
      rule
    );
    return response;
  }

  /**
   * Update an existing export rule
   */
  async updateExportRule(
    policyNameOrId: string | number, 
    ruleIndex: number, 
    updates: UpdateExportRuleRequest, 
    svmName?: string
  ): Promise<void> {
    let policyId: number;
    
    if (typeof policyNameOrId === 'number' || /^\d+$/.test(policyNameOrId.toString())) {
      policyId = Number(policyNameOrId);
    } else {
      const policy = await this.getExportPolicy(policyNameOrId, svmName);
      policyId = policy.id!;
    }
    
    await this.makeRequest(
      `/protocols/nfs/export-policies/${policyId}/rules/${ruleIndex}`,
      'PATCH',
      updates
    );
  }

  /**
   * Delete an export rule from a policy
   */
  async deleteExportRule(
    policyNameOrId: string | number, 
    ruleIndex: number, 
    svmName?: string
  ): Promise<void> {
    let policyId: number;
    
    if (typeof policyNameOrId === 'number' || /^\d+$/.test(policyNameOrId.toString())) {
      policyId = Number(policyNameOrId);
    } else {
      const policy = await this.getExportPolicy(policyNameOrId, svmName);
      policyId = policy.id!;
    }
    
    await this.makeRequest(
      `/protocols/nfs/export-policies/${policyId}/rules/${ruleIndex}`,
      'DELETE'
    );
  }

  /**
   * Configure NFS access for a volume
   */
  async configureVolumeNfsAccess(volumeUuid: string, exportPolicyName: string): Promise<void> {
    const body = {
      nas: {
        export_policy: {
          name: exportPolicyName
        }
      }
    };
    
    await this.makeRequest(
      `/storage/volumes/${volumeUuid}`,
      'PATCH',
      body
    );
  }

  /**
   * Disable NFS access for a volume (set to default export policy)
   */
  async disableVolumeNfsAccess(volumeUuid: string): Promise<void> {
    const body = {
      nas: {
        export_policy: {
          name: "default"
        }
      }
    };
    
    await this.makeRequest(
      `/storage/volumes/${volumeUuid}`,
      'PATCH',
      body
    );
  }

  /**
   * Update volume security style
   */
  async updateVolumeSecurityStyle(volumeUuid: string, securityStyle: string): Promise<void> {
    const body = {
      nas: {
        security_style: securityStyle
      }
    };
    
    await this.makeRequest(
      `/storage/volumes/${volumeUuid}`,
      'PATCH',
      body
    );
  }

  /**
   * Resize a volume
   */
  async resizeVolume(volumeUuid: string, newSize: string): Promise<void> {
    const sizeInBytes = this.parseSize(newSize);
    const body = {
      size: sizeInBytes
    };
    
    await this.makeRequest(
      `/storage/volumes/${volumeUuid}`,
      'PATCH',
      body
    );
  }

  /**
   * Update volume comment
   */
  async updateVolumeComment(volumeUuid: string, comment: string): Promise<void> {
    const body = {
      comment: comment
    };
    
    await this.makeRequest(
      `/storage/volumes/${volumeUuid}`,
      'PATCH',
      body
    );
  }

  // ================================
  // Snapshot Schedule Management
  // ================================

  /**
   * List all snapshot schedules
   */
  async listSnapshotSchedules(params?: any): Promise<any[]> {
    let endpoint = '/cluster/schedules?fields=uuid,name,type,cron,interval';
    
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
      if (queryParams.toString()) {
        endpoint += `&${queryParams.toString()}`;
      }
    }
    
    const response = await this.makeRequest<{ records: any[] }>(endpoint);
    return response.records || [];
  }

  /**
   * Get a specific snapshot schedule by name
   */
  async getSnapshotSchedule(scheduleName: string): Promise<any> {
    const endpoint = `/cluster/schedules?name=${encodeURIComponent(scheduleName)}&fields=uuid,name,type,cron,interval`;
    
    const response = await this.makeRequest<{ records: any[] }>(endpoint);
    
    if (!response.records || response.records.length === 0) {
      throw new Error(`Snapshot schedule '${scheduleName}' not found`);
    }
    
    return response.records[0];
  }

  /**
   * Create a new snapshot schedule
   */
  async createSnapshotSchedule(schedule: any): Promise<{ uuid: string }> {
    const response = await this.makeRequest<{ uuid: string }>(
      '/cluster/schedules',
      'POST',
      schedule
    );
    return response;
  }

  /**
   * Update an existing snapshot schedule
   */
  async updateSnapshotSchedule(scheduleName: string, updates: any): Promise<void> {
    // First get the schedule to get its UUID
    const schedule = await this.getSnapshotSchedule(scheduleName);
    
    await this.makeRequest(
      `/cluster/schedules/${schedule.uuid}`,
      'PATCH',
      updates
    );
  }

  /**
   * Delete a snapshot schedule
   */
  async deleteSnapshotSchedule(scheduleName: string): Promise<void> {
    // First get the schedule to get its UUID
    const schedule = await this.getSnapshotSchedule(scheduleName);
    
    await this.makeRequest(
      `/cluster/schedules/${schedule.uuid}`,
      'DELETE'
    );
  }

  // ================================
  // CIFS Share Management
  // ================================

  /**
   * List all CIFS shares
   */
  async listCifsShares(params?: ListCifsSharesParams): Promise<CifsShareInfo[]> {
    let endpoint = '/protocols/cifs/shares?fields=name,path,svm,comment,volume';
    
    if (params) {
      if (params['svm.name']) {
        endpoint += `&svm.name=${encodeURIComponent(params['svm.name'])}`;
      }
      if (params['name']) {
        endpoint += `&name=${encodeURIComponent(params['name'])}`;
      }
      if (params['volume.name']) {
        endpoint += `&volume.name=${encodeURIComponent(params['volume.name'])}`;
      }
    }
    
    const response = await this.makeRequest<CifsShareResponse>(endpoint);
    return response.records || [];
  }

  /**
   * Get a specific CIFS share by name and SVM
   */
  async getCifsShare(shareName: string, svmName: string): Promise<CifsShareInfo> {
    const endpoint = `/protocols/cifs/shares?name=${encodeURIComponent(shareName)}&svm.name=${encodeURIComponent(svmName)}&fields=name,path,svm,comment,volume,acls`;
    
    const response = await this.makeRequest<CifsShareResponse>(endpoint);
    
    if (!response.records || response.records.length === 0) {
      throw new Error(`CIFS share '${shareName}' not found in SVM '${svmName}'`);
    }
    
    return response.records[0];
  }

  /**
   * Create a new CIFS share
   */
  async createCifsShare(shareConfig: CreateCifsShareRequest): Promise<{ name: string }> {
    // First get the SVM to get its UUID
    const svms = await this.listSvms();
    const svm = svms.find(s => s.name === shareConfig.svm_name);
    if (!svm) {
      throw new Error(`SVM '${shareConfig.svm_name}' not found`);
    }

    const body: any = {
      name: shareConfig.name,
      path: shareConfig.path,
      svm: {
        name: svm.name,
        uuid: svm.uuid
      }
    };

    if (shareConfig.comment) {
      body.comment = shareConfig.comment;
    }

    if (shareConfig.properties) {
      body.properties = shareConfig.properties;
    }

    // Set ACLs during creation if specified
    if (shareConfig.access_control && shareConfig.access_control.length > 0) {
      body.acls = shareConfig.access_control;
    }

    const response = await this.makeRequest<{ name: string }>(
      '/protocols/cifs/shares',
      'POST',
      body
    );

    return response;
  }

  /**
   * Update a CIFS share
   */
  async updateCifsShare(shareConfig: UpdateCifsShareRequest): Promise<void> {
    // First get the share to get SVM UUID
    const share = await this.getCifsShare(shareConfig.name, shareConfig.svm_name);
    
    const body: any = {};

    if (shareConfig.comment !== undefined) {
      body.comment = shareConfig.comment;
    }

    if (shareConfig.properties) {
      body.properties = shareConfig.properties;
    }

    // Only update share properties, not ACLs (ACLs require recreation)
    await this.makeRequest(
      `/protocols/cifs/shares?name=${encodeURIComponent(shareConfig.name)}&svm.uuid=${encodeURIComponent(share.svm!.uuid!)}`,
      'PATCH',
      body
    );

    // Handle ACL updates separately (requires recreation)
    if (shareConfig.access_control) {
      await this.updateCifsShareAcl({
        name: shareConfig.name,
        svm_name: shareConfig.svm_name,
        access_control: shareConfig.access_control
      });
    }
  }

  /**
   * Delete a CIFS share
   */
  async deleteCifsShare(params: DeleteCifsShareParams): Promise<void> {
    // First get the share to ensure it exists and get its full details
    const share = await this.getCifsShare(params.name, params.svm_name);
    
    // Use query-based endpoint structure
    await this.makeRequest(
      `/protocols/cifs/shares?name=${encodeURIComponent(params.name)}&svm.uuid=${encodeURIComponent(share.svm!.uuid!)}`,
      'DELETE'
    );
  }

  /**
   * Update CIFS share ACL (Access Control List)
   * Note: NetApp ONTAP does not support direct ACL updates after creation.
   * This method implements ACL updates by recreating the share.
   */
  async updateCifsShareAcl(params: UpdateCifsShareAclParams): Promise<void> {
    // Get current share details
    const currentShare = await this.getCifsShare(params.name, params.svm_name);
    
    // Delete the existing share
    await this.deleteCifsShare({
      name: params.name,
      svm_name: params.svm_name
    });
    
    // Recreate the share with new ACLs
    await this.createCifsShare({
      name: params.name,
      path: currentShare.path,
      svm_name: params.svm_name,
      comment: currentShare.comment,
      access_control: params.access_control
    });
  }

  /**
   * Get CIFS share ACL
   */
  async getCifsShareAcl(shareName: string, svmName: string): Promise<any> {
    // First get the share to get SVM UUID
    const share = await this.getCifsShare(shareName, svmName);
    
    const endpoint = `/protocols/cifs/shares/acls?name=${encodeURIComponent(shareName)}&svm.uuid=${encodeURIComponent(share.svm!.uuid!)}`;
    
    const response = await this.makeRequest<{ records: any[] }>(endpoint);
    return response.records || [];
  }

  // ================================
  // QoS Policy Management Methods
  // ================================

  /**
   * List QoS policies
   */
  async listQosPolicies(params?: { 
    svmName?: string; 
    policyNamePattern?: string; 
    policyType?: 'fixed' | 'adaptive' 
  }): Promise<any[]> {
    let endpoint = '/storage/qos/policies';
    const queryParams: string[] = [];

    if (params?.svmName) {
      queryParams.push(`svm.name=${encodeURIComponent(params.svmName)}`);
    }

    if (params?.policyNamePattern) {
      queryParams.push(`name=${encodeURIComponent(params.policyNamePattern)}`);
    }

    if (params?.policyType) {
      queryParams.push(`type=${params.policyType}`);
    }

    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }

    const response = await this.makeRequest<{ records: any[]; num_records: number }>(endpoint);
    return response.records || [];
  }

  /**
   * Get specific QoS policy by UUID
   */
  async getQosPolicy(policyUuid: string): Promise<any> {
    const endpoint = `/storage/qos/policies/${policyUuid}`;
    return await this.makeRequest<any>(endpoint);
  }

  /**
   * Get QoS policy by name and optional SVM
   */
  async getQosPolicyByName(policyName: string, svmName?: string): Promise<any> {
    const params: any = { policyNamePattern: policyName };
    if (svmName) {
      params.svmName = svmName;
    }

    const policies = await this.listQosPolicies(params);
    
    if (policies.length === 0) {
      throw new Error(`QoS policy '${policyName}' not found${svmName ? ` in SVM ${svmName}` : ''}`);
    }

    if (policies.length > 1) {
      throw new Error(`Multiple QoS policies found with name '${policyName}'. Please specify SVM name or use UUID.`);
    }

    return policies[0];
  }

  /**
   * Create fixed QoS policy
   */
  async createFixedQosPolicy(params: {
    name: string;
    svmName: string;
    maxThroughput?: string;
    minThroughput?: string;
    isShared?: boolean;
  }): Promise<{ uuid: string }> {
    const requestBody: any = {
      name: params.name,
      svm: { name: params.svmName },
      fixed: {}
    };

    // Parse throughput values to extract numeric values
    if (params.maxThroughput) {
      const maxValue = parseInt(params.maxThroughput.replace(/[^0-9]/g, ''));
      if (!isNaN(maxValue)) {
        requestBody.fixed.max_throughput_iops = maxValue;
      }
    }
    
    if (params.minThroughput) {
      const minValue = parseInt(params.minThroughput.replace(/[^0-9]/g, ''));
      if (!isNaN(minValue)) {
        requestBody.fixed.min_throughput_iops = minValue;
      }
    }

    if (params.isShared !== undefined) {
      requestBody.shared = params.isShared;
    }

    return await this.makeRequest<{ uuid: string }>('/storage/qos/policies', 'POST', requestBody);
  }

  /**
   * Create adaptive QoS policy
   */
  async createAdaptiveQosPolicy(params: {
    name: string;
    svmName: string;
    expectedIops?: string;
    peakIops?: string;
    expectedIopsAllocation?: 'used-space' | 'allocated-space';
    peakIopsAllocation?: 'used-space' | 'allocated-space';
  }): Promise<{ uuid: string }> {
    const requestBody: any = {
      name: params.name,
      svm: { name: params.svmName },
      adaptive: {}
    };

    if (params.expectedIops) {
      requestBody.adaptive.expected_iops = params.expectedIops;
    }

    if (params.peakIops) {
      requestBody.adaptive.peak_iops = params.peakIops;
    }

    if (params.expectedIopsAllocation) {
      requestBody.adaptive.expected_iops_allocation = params.expectedIopsAllocation;
    }

    if (params.peakIopsAllocation) {
      requestBody.adaptive.peak_iops_allocation = params.peakIopsAllocation;
    }

    return await this.makeRequest<{ uuid: string }>('/storage/qos/policies', 'POST', requestBody);
  }

  /**
   * Update QoS policy
   */
  async updateQosPolicy(policyUuid: string, updates: {
    name?: string;
    maxThroughput?: string;
    minThroughput?: string;
    expectedIops?: string;
    peakIops?: string;
    expectedIopsAllocation?: 'used-space' | 'allocated-space';
    peakIopsAllocation?: 'used-space' | 'allocated-space';
    isShared?: boolean;
  }): Promise<void> {
    const updateBody: any = {};

    if (updates.name) {
      updateBody.name = updates.name;
    }

    if (updates.maxThroughput || updates.minThroughput) {
      updateBody.fixed = {};
      if (updates.maxThroughput) {
        updateBody.fixed.max_throughput = updates.maxThroughput;
      }
      if (updates.minThroughput) {
        updateBody.fixed.min_throughput = updates.minThroughput;
      }
    }

    if (updates.expectedIops || updates.peakIops || updates.expectedIopsAllocation || updates.peakIopsAllocation) {
      updateBody.adaptive = {};
      if (updates.expectedIops) {
        updateBody.adaptive.expected_iops = updates.expectedIops;
      }
      if (updates.peakIops) {
        updateBody.adaptive.peak_iops = updates.peakIops;
      }
      if (updates.expectedIopsAllocation) {
        updateBody.adaptive.expected_iops_allocation = updates.expectedIopsAllocation;
      }
      if (updates.peakIopsAllocation) {
        updateBody.adaptive.peak_iops_allocation = updates.peakIopsAllocation;
      }
    }

    if (updates.isShared !== undefined) {
      updateBody.is_shared = updates.isShared;
    }

    await this.makeRequest(`/storage/qos/policies/${policyUuid}`, 'PATCH', updateBody);
  }

  /**
   * Delete QoS policy
   */
  async deleteQosPolicy(policyUuid: string): Promise<void> {
    await this.makeRequest(`/storage/qos/policies/${policyUuid}`, 'DELETE');
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
