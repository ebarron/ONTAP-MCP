/**
 * TypeScript types for NetApp ONTAP CIFS/SMB share management
 * These types correspond to ONTAP REST API v1/v2 CIFS objects
 */

/**
 * CIFS access permission enumeration
 */
export type CifsAccessPermission = 'no_access' | 'read' | 'change' | 'full_control';

/**
 * CIFS share properties
 */
export interface CifsShareProperties {
  /** Enable access-based enumeration */
  access_based_enumeration?: boolean;
  /** Enable BranchCache */
  branch_cache?: boolean;
  /** Enable change notify */
  change_notify?: boolean;
  /** Enable encryption */
  encryption?: boolean;
  /** Home directory */
  home_directory?: boolean;
  /** Namespace caching */
  namespace_caching?: boolean;
  /** No strict locks */
  no_strict_locks?: boolean;
  /** Offline files policy */
  offline_files?: 'none' | 'manual' | 'documents' | 'programs';
  /** Oplocks */
  oplocks?: boolean;
  /** Show snapshot */
  show_snapshot?: boolean;
  /** Symlink properties */
  symlink_properties?: {
    enable?: boolean;
    hide_unreadable?: boolean;
  };
}

/**
 * CIFS access control entry (ACE)
 */
export interface CifsAccessControlEntry {
  /** Permission level */
  permission: CifsAccessPermission;
  /** User or group name */
  user_or_group: string;
  /** Whether this is a user group */
  type?: 'windows' | 'unix_user' | 'unix_group';
}

/**
 * CIFS share access control list (ACL)
 */
export interface CifsAccessControlList {
  /** Access control entries */
  access_control: CifsAccessControlEntry[];
}

/**
 * CIFS share reference
 */
export interface CifsShareReference {
  /** Share name */
  name: string;
  /** Share path */
  path: string;
  /** SVM reference */
  svm?: {
    name: string;
    uuid?: string;
  };
}

/**
 * CIFS share information
 */
export interface CifsShareInfo extends CifsShareReference {
  /** Share comment/description */
  comment?: string;
  /** Share properties */
  properties?: CifsShareProperties;
  /** Access control list */
  acls?: CifsAccessControlList;
  /** Volume reference */
  volume?: {
    name: string;
    uuid: string;
  };
}

/**
 * Create CIFS share request parameters
 */
export interface CreateCifsShareRequest {
  /** Share name */
  name: string;
  /** Volume path (typically /vol/volume_name) */
  path: string;
  /** SVM name */
  svm_name: string;
  /** Optional comment */
  comment?: string;
  /** Share properties */
  properties?: CifsShareProperties;
  /** Access control entries */
  access_control?: CifsAccessControlEntry[];
}

/**
 * Update CIFS share request parameters  
 */
export interface UpdateCifsShareRequest {
  /** Share name */
  name: string;
  /** SVM name */
  svm_name: string;
  /** Updated comment */
  comment?: string;
  /** Updated share properties */
  properties?: CifsShareProperties;
  /** Updated access control entries */
  access_control?: CifsAccessControlEntry[];
}

/**
 * List CIFS shares parameters
 */
export interface ListCifsSharesParams {
  /** Filter by SVM name */
  'svm.name'?: string;
  /** Filter by share name pattern */
  'name'?: string;
  /** Filter by volume name */
  'volume.name'?: string;
  /** Fields to include in response */
  'fields'?: string;
}

/**
 * CIFS share API response wrapper
 */
export interface CifsShareResponse {
  records?: CifsShareInfo[];
  num_records?: number;
}

/**
 * Volume CIFS configuration for volume creation
 */
export interface VolumeCifsConfig {
  /** CIFS share name */
  share_name: string;
  /** Optional share comment */
  comment?: string;
  /** Share properties */
  properties?: CifsShareProperties;
  /** Access control entries */
  access_control?: CifsAccessControlEntry[];
}

/**
 * CIFS share deletion parameters
 */
export interface DeleteCifsShareParams {
  /** Share name */
  name: string;
  /** SVM name */
  svm_name: string;
}

/**
 * CIFS share ACL update parameters
 */
export interface UpdateCifsShareAclParams {
  /** Share name */
  name: string;
  /** SVM name */
  svm_name: string;
  /** Access control entries to add/update */
  access_control: CifsAccessControlEntry[];
}

/**
 * CIFS share list information (for hybrid format)
 * Simplified structure for UI dropdown population
 */
export interface CifsShareListInfo {
  /** Share name */
  name: string;
  /** Share path */
  path: string;
  /** SVM name */
  svm_name?: string;
  /** SVM UUID */
  svm_uuid?: string;
  /** Volume name */
  volume_name?: string;
  /** Volume UUID */
  volume_uuid?: string;
  /** Share comment/description */
  comment?: string;
  /** Key share properties */
  properties?: {
    encryption?: boolean;
    oplocks?: boolean;
    offline_files?: string;
    access_based_enumeration?: boolean;
  };
}

/**
 * CIFS share list result (hybrid format)
 * Returns both human-readable summary and structured data
 */
export interface CifsShareListResult {
  /** Human-readable summary */
  summary: string;
  /** Structured array of CIFS shares */
  data: CifsShareListInfo[];
}