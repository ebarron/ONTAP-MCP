/**
 * TypeScript types for NetApp ONTAP Snapshot Schedule management
 * These types correspond to ONTAP REST API schedule objects (cron jobs)
 */

/**
 * Snapshot schedule (cron job) definition
 */
export interface SnapshotSchedule {
  /** Unique identifier for the schedule */
  uuid?: string;
  /** Schedule name */
  name: string;
  /** Cron expression for the schedule */
  cron?: {
    /** Minutes (0-59) */
    minutes?: number[];
    /** Hours (0-23) */
    hours?: number[];
    /** Days of month (1-31) */
    days?: number[];
    /** Months (1-12) */
    months?: number[];
    /** Days of week (0-6, Sunday=0) */
    weekdays?: number[];
  };
  /** Schedule interval configuration */
  interval?: string;
  /** Schedule type */
  type?: 'cron' | 'interval';
}

/**
 * Request body for creating a snapshot schedule
 */
export interface CreateSnapshotScheduleRequest {
  /** Schedule name (required) */
  name: string;
  /** Cron configuration */
  cron?: {
    minutes?: number[];
    hours?: number[];
    days?: number[];
    months?: number[];
    weekdays?: number[];
  };
  /** Interval configuration (alternative to cron) */
  interval?: string;
}

/**
 * Request body for updating a snapshot schedule
 */
export interface UpdateSnapshotScheduleRequest {
  /** Updated schedule name */
  name?: string;
  /** Updated cron configuration */
  cron?: {
    minutes?: number[];
    hours?: number[];
    days?: number[];
    months?: number[];
    weekdays?: number[];
  };
  /** Updated interval configuration */
  interval?: string;
}

/**
 * Response from ONTAP API for snapshot schedule operations
 */
export interface SnapshotScheduleResponse {
  /** Records array containing snapshot schedules */
  records?: SnapshotSchedule[];
  /** Total number of records */
  num_records?: number;
  /** Links for pagination */
  _links?: {
    self: { href: string };
    next?: { href: string };
  };
}

/**
 * Parameters for listing snapshot schedules
 */
export interface ListSnapshotSchedulesParams {
  /** Filter by schedule name pattern */
  'name'?: string;
  /** Filter by schedule type */
  'type'?: string;
  /** Fields to include in response */
  'fields'?: string;
  /** Maximum number of records to return */
  'max_records'?: number;
  /** Order by field */
  'order_by'?: string;
}
/**
 * Structured snapshot schedule data (MCP parameter names)
 */
export interface SnapshotScheduleData {
  uuid: string;
  name: string;
  type?: string;
  interval?: string;
  cron?: {
    minutes?: number[];
    hours?: number[];
    days?: number[];
    months?: number[];
    weekdays?: number[];
  };
}

/**
 * Hybrid format result for get_snapshot_schedule
 */
export interface SnapshotScheduleResult {
  summary: string;
  data: SnapshotScheduleData;
}
