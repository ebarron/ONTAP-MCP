/**
 * TypeScript types for NetApp ONTAP NFS Export Policy management
 * These types correspond to ONTAP REST API v1/v2 export policy objects
 */

/**
 * NFS protocol versions supported
 */
export type NfsProtocol = 'any' | 'nfs' | 'nfs3' | 'nfs4' | 'nfs41';

/**
 * Access permissions for NFS exports
 */
export type NfsAccess = 'none' | 'readonly' | 'rw';

/**
 * Authentication methods for NFS
 */
export type NfsAuthMethod = 'any' | 'none' | 'never' | 'krb5' | 'krb5i' | 'krb5p' | 'ntlm' | 'sys';

/**
 * Superuser access settings
 */
export type SuperUserAccess = 'any' | 'none' | 'never' | 'krb5' | 'krb5i' | 'krb5p' | 'ntlm' | 'sys';

/**
 * Client specification for export rules
 */
export interface ClientMatch {
  /** Client specification - can be IP, subnet, hostname, netgroup, etc. */
  match: string;
}

/**
 * Export rule within an export policy
 */
export interface ExportRule {
  /** Rule index within the policy */
  index?: number;
  /** Client specifications that this rule applies to */
  clients: ClientMatch[];
  /** Allowed NFS protocols */
  protocols: NfsProtocol[];
  /** Read-only access configuration */
  ro_rule: NfsAuthMethod[];
  /** Read-write access configuration */
  rw_rule: NfsAuthMethod[];
  /** Superuser access configuration */
  superuser: SuperUserAccess[];
  /** Whether to allow device creation */
  allow_device_creation?: boolean;
  /** Whether to allow set UID */
  allow_suid?: boolean;
  /** Anonymous user ID mapping */
  anonymous_user?: string;
  /** Rule comment/description */
  comment?: string;
}

/**
 * Export policy definition
 */
export interface ExportPolicy {
  /** Unique identifier for the export policy */
  id?: number;
  /** Policy name */
  name: string;
  /** SVM information */
  svm?: {
    uuid?: string;
    name?: string;
  };
  /** Array of export rules within this policy */
  rules?: ExportRule[];
  /** Policy comment/description */
  comment?: string;
}

/**
 * Request body for creating an export policy
 */
export interface CreateExportPolicyRequest {
  /** Policy name (required) */
  name: string;
  /** SVM where policy will be created */
  svm: {
    name: string;
  };
  /** Optional policy comment */
  comment?: string;
}

/**
 * Request body for creating an export rule
 */
export interface CreateExportRuleRequest {
  /** Client specifications */
  clients: ClientMatch[];
  /** Allowed protocols (default: ['any']) */
  protocols?: NfsProtocol[];
  /** Read-only access rules (default: ['any']) */
  ro_rule?: NfsAuthMethod[];
  /** Read-write access rules (default: ['none']) */
  rw_rule?: NfsAuthMethod[];
  /** Superuser access rules (default: ['none']) */
  superuser?: SuperUserAccess[];
  /** Rule index (auto-assigned if not specified) */
  index?: number;
  /** Allow device creation (default: true) */
  allow_device_creation?: boolean;
  /** Allow set UID (default: true) */
  allow_suid?: boolean;
  /** Anonymous user mapping (default: '65534') */
  anonymous_user?: string;
  /** Rule comment */
  comment?: string;
}

/**
 * Request body for updating an export rule
 */
export interface UpdateExportRuleRequest {
  /** Updated client specifications */
  clients?: ClientMatch[];
  /** Updated protocol list */
  protocols?: NfsProtocol[];
  /** Updated read-only access rules */
  ro_rule?: NfsAuthMethod[];
  /** Updated read-write access rules */
  rw_rule?: NfsAuthMethod[];
  /** Updated superuser access rules */
  superuser?: SuperUserAccess[];
  /** Updated device creation setting */
  allow_device_creation?: boolean;
  /** Updated set UID setting */
  allow_suid?: boolean;
  /** Updated anonymous user mapping */
  anonymous_user?: string;
  /** Updated comment */
  comment?: string;
}

/**
 * Response from ONTAP API for export policy operations
 */
export interface ExportPolicyResponse {
  /** Records array containing export policies */
  records?: ExportPolicy[];
  /** Total number of records */
  num_records?: number;
  /** Links for pagination */
  _links?: {
    self: { href: string };
    next?: { href: string };
  };
}

/**
 * Response from ONTAP API for export rule operations
 */
export interface ExportRuleResponse {
  /** Records array containing export rules */
  records?: ExportRule[];
  /** Total number of records */
  num_records?: number;
  /** Links for pagination */
  _links?: {
    self: { href: string };
    next?: { href: string };
  };
}

/**
 * Parameters for listing export policies
 */
export interface ListExportPoliciesParams {
  /** Filter by policy name pattern */
  'name'?: string;
  /** Filter by SVM name */
  'svm.name'?: string;
  /** Fields to include in response */
  'fields'?: string;
  /** Maximum number of records to return */
  'max_records'?: number;
  /** Sort order */
  'order_by'?: string;
}

/**
 * Parameters for listing export rules
 */
export interface ListExportRulesParams {
  /** Filter by client match pattern */
  'clients.match'?: string;
  /** Filter by protocol */
  'protocols'?: string;
  /** Fields to include in response */
  'fields'?: string;
  /** Maximum number of records to return */
  'max_records'?: number;
  /** Sort order */
  'order_by'?: string;
}

/**
 * Common NFS export rule templates for easy configuration
 */
export const NFS_RULE_TEMPLATES = {
  /** Read-write access for specific subnet with NFSv3/v4 */
  readWrite: (clientSubnet: string): CreateExportRuleRequest => ({
    clients: [{ match: clientSubnet }],
    protocols: ['nfs3', 'nfs4'],
    ro_rule: ['sys'],
    rw_rule: ['sys'],
    superuser: ['sys'],
    allow_device_creation: true,
    allow_suid: false
  }),
  
  /** Read-only access for specific subnet */
  readOnly: (clientSubnet: string): CreateExportRuleRequest => ({
    clients: [{ match: clientSubnet }],
    protocols: ['nfs3', 'nfs4'],
    ro_rule: ['sys'],
    rw_rule: ['none'],
    superuser: ['none'],
    allow_device_creation: false,
    allow_suid: false
  }),
  
  /** Full access for local subnet (common development pattern) */
  localSubnet: (subnet: string = '192.168.0.0/16'): CreateExportRuleRequest => ({
    clients: [{ match: subnet }],
    protocols: ['nfs3', 'nfs4'],
    ro_rule: ['sys'],
    rw_rule: ['sys'],
    superuser: ['sys'],
    allow_device_creation: true,
    allow_suid: true
  })
};