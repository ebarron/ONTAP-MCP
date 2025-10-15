/**
 * NetApp ONTAP Snapshot Schedule Management Tools
 * Provides tools for creating, listing, updating, and deleting snapshot schedules (cron jobs)
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OntapClusterManager, OntapApiClient } from '../ontap-client.js';
import type { 
  CreateSnapshotScheduleRequest,
  UpdateSnapshotScheduleRequest,
  SnapshotScheduleData,
  SnapshotScheduleResult
} from '../types/schedule-types.js';

// ================================
// Zod Schemas for Input Validation
// ================================

const CreateSnapshotScheduleSchema = z.object({
  cluster_ip: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  cluster_name: z.string().optional(),
  schedule_name: z.string(),
  schedule_type: z.enum(['cron', 'interval']).default('interval'),
  interval: z.string().optional(),
  cron_minutes: z.array(z.number().min(0).max(59)).optional(),
  cron_hours: z.array(z.number().min(0).max(23)).optional(),
  cron_days: z.array(z.number().min(1).max(31)).optional(),
  cron_months: z.array(z.number().min(1).max(12)).optional(),
  cron_weekdays: z.array(z.number().min(0).max(6)).optional()
});

const UpdateSnapshotScheduleSchema = z.object({
  cluster_ip: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  cluster_name: z.string().optional(),
  schedule_name: z.string(),
  new_name: z.string().optional(),
  schedule_type: z.enum(['cron', 'interval']).optional(),
  interval: z.string().optional(),
  cron_minutes: z.array(z.number().min(0).max(59)).optional(),
  cron_hours: z.array(z.number().min(0).max(23)).optional(),
  cron_days: z.array(z.number().min(1).max(31)).optional(),
  cron_months: z.array(z.number().min(1).max(12)).optional(),
  cron_weekdays: z.array(z.number().min(0).max(6)).optional()
});

const ListSnapshotSchedulesSchema = z.object({
  cluster_ip: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  cluster_name: z.string().optional(),
  schedule_name_pattern: z.string().optional(),
  schedule_type: z.string().optional()
});

const GetSnapshotScheduleSchema = z.object({
  cluster_ip: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  cluster_name: z.string().optional(),
  schedule_name: z.string()
});

const DeleteSnapshotScheduleSchema = z.object({
  cluster_ip: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  cluster_name: z.string().optional(),
  schedule_name: z.string()
});

// ================================
// Helper Functions
// ================================

/**
 * Get API client from either cluster credentials or cluster registry
 */
function getApiClient(
  clusterManager: OntapClusterManager,
  clusterName?: string,
  clusterIp?: string,
  username?: string,
  password?: string
): OntapApiClient {
  if (clusterName) {
    return clusterManager.getClient(clusterName);
  } else if (clusterIp && username && password) {
    return new OntapApiClient(clusterIp, username, password);
  } else {
    throw new Error("Either cluster_name or (cluster_ip, username, password) must be provided");
  }
}

// ================================
// Tool Definitions
// ================================

/**
 * List all snapshot schedules
 */
export function createListSnapshotSchedulesToolDefinition(): Tool {
  return {
    name: "list_snapshot_schedules",
    description: "List all snapshot schedules (cron jobs) on an ONTAP cluster",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        schedule_name_pattern: { type: "string", description: "Filter by schedule name pattern" },
        schedule_type: { type: "string", description: "Filter by schedule type (cron, interval)" }
      },
      required: []
    }
  };
}

export async function handleListSnapshotSchedules(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = ListSnapshotSchedulesSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    const queryParams: any = {};
    if (params.schedule_name_pattern) queryParams['name'] = params.schedule_name_pattern;
    if (params.schedule_type) queryParams['type'] = params.schedule_type;

    const schedules = await client.listSnapshotSchedules(queryParams);

    if (schedules.length === 0) {
      return "No snapshot schedules found matching the specified criteria.";
    }

    let result = `Found ${schedules.length} snapshot schedules:\n\n`;
    
    for (const schedule of schedules) {
      result += `⏰ **${schedule.name}**\n`;
      result += `   UUID: ${schedule.uuid}\n`;
      result += `   Type: ${schedule.type || 'interval'}\n`;
      
      if (schedule.interval) {
        result += `   Interval: ${schedule.interval}\n`;
      }
      
      if (schedule.cron) {
        result += `   Cron Expression:\n`;
        if (schedule.cron.minutes) result += `     Minutes: ${schedule.cron.minutes.join(', ')}\n`;
        if (schedule.cron.hours) result += `     Hours: ${schedule.cron.hours.join(', ')}\n`;
        if (schedule.cron.days) result += `     Days: ${schedule.cron.days.join(', ')}\n`;
        if (schedule.cron.months) result += `     Months: ${schedule.cron.months.join(', ')}\n`;
        if (schedule.cron.weekdays) result += `     Weekdays: ${schedule.cron.weekdays.join(', ')}\n`;
      }
      
      result += `\n`;
    }

    return result;
  } catch (error) {
    return `❌ Error listing snapshot schedules: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Get detailed information about a specific snapshot schedule
 */
export function createGetSnapshotScheduleToolDefinition(): Tool {
  return {
    name: "get_snapshot_schedule",
    description: "Get detailed information about a specific snapshot schedule by name",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        schedule_name: { type: "string", description: "Name of the snapshot schedule" }
      },
      required: ["schedule_name"]
    }
  };
}

export async function handleGetSnapshotSchedule(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<SnapshotScheduleResult> {
  const params = GetSnapshotScheduleSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    const schedule = await client.getSnapshotSchedule(params.schedule_name);

    // Build structured data with MCP parameter names
    const data: SnapshotScheduleData = {
      uuid: schedule.uuid,
      name: schedule.name,
      type: schedule.type,
      interval: schedule.interval,
      cron: schedule.cron
    };

    // Build summary text
    let summary = `⏰ **Snapshot Schedule: ${schedule.name}**\n\n`;
    summary += `🆔 UUID: ${schedule.uuid}\n`;
    summary += `🔧 Type: ${schedule.type || 'interval'}\n`;
    
    if (schedule.interval) {
      summary += `⏱️ Interval: ${schedule.interval}\n`;
    }
    
    if (schedule.cron) {
      summary += `📅 **Cron Configuration:**\n`;
      if (schedule.cron.minutes) summary += `   • Minutes: ${schedule.cron.minutes.join(', ')}\n`;
      if (schedule.cron.hours) summary += `   • Hours: ${schedule.cron.hours.join(', ')}\n`;
      if (schedule.cron.days) summary += `   • Days of Month: ${schedule.cron.days.join(', ')}\n`;
      if (schedule.cron.months) summary += `   • Months: ${schedule.cron.months.join(', ')}\n`;
      if (schedule.cron.weekdays) summary += `   • Weekdays: ${schedule.cron.weekdays.join(', ')} (0=Sunday)\n`;
    }

    summary += `\n💡 **Usage:**\n`;
    summary += `   • Use this schedule in snapshot policies\n`;
    summary += `   • Reference by name: "${schedule.name}"\n`;

    return { summary, data };
  } catch (error) {
    // Error case - still return hybrid format for consistency
    const errorMsg = `❌ Error getting snapshot schedule: ${error instanceof Error ? error.message : String(error)}`;
    return {
      summary: errorMsg,
      data: {
        uuid: '',
        name: params.schedule_name
      }
    };
  }
}

/**
 * Create a new snapshot schedule
 */
export function createCreateSnapshotScheduleToolDefinition(): Tool {
  return {
    name: "create_snapshot_schedule",
    description: "Create a new snapshot schedule (cron job) for use in snapshot policies",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        schedule_name: { type: "string", description: "Name for the snapshot schedule" },
        schedule_type: { 
          type: "string", 
          enum: ["cron", "interval"],
          description: "Type of schedule: 'cron' for specific times, 'interval' for regular intervals"
        },
        interval: { type: "string", description: "Interval string (e.g., '1h', '30m', '1d') - used with interval type" },
        cron_minutes: { 
          type: "array", 
          items: { type: "number", minimum: 0, maximum: 59 },
          description: "Minutes when to run (0-59) - used with cron type"
        },
        cron_hours: { 
          type: "array", 
          items: { type: "number", minimum: 0, maximum: 23 },
          description: "Hours when to run (0-23) - used with cron type"
        },
        cron_days: { 
          type: "array", 
          items: { type: "number", minimum: 1, maximum: 31 },
          description: "Days of month when to run (1-31) - used with cron type"
        },
        cron_months: { 
          type: "array", 
          items: { type: "number", minimum: 1, maximum: 12 },
          description: "Months when to run (1-12) - used with cron type"
        },
        cron_weekdays: { 
          type: "array", 
          items: { type: "number", minimum: 0, maximum: 6 },
          description: "Days of week when to run (0-6, 0=Sunday) - used with cron type"
        }
      },
      required: ["schedule_name", "schedule_type"]
    }
  };
}

export async function handleCreateSnapshotSchedule(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = CreateSnapshotScheduleSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    const scheduleRequest: CreateSnapshotScheduleRequest = {
      name: params.schedule_name
    };

    if (params.schedule_type === 'interval' && params.interval) {
      scheduleRequest.interval = params.interval;
    } else if (params.schedule_type === 'cron') {
      scheduleRequest.cron = {};
      if (params.cron_minutes) scheduleRequest.cron.minutes = params.cron_minutes;
      if (params.cron_hours) scheduleRequest.cron.hours = params.cron_hours;
      if (params.cron_days) scheduleRequest.cron.days = params.cron_days;
      if (params.cron_months) scheduleRequest.cron.months = params.cron_months;
      if (params.cron_weekdays) scheduleRequest.cron.weekdays = params.cron_weekdays;
    }

    const response = await client.createSnapshotSchedule(scheduleRequest);

    let result = `✅ **Snapshot schedule '${params.schedule_name}' created successfully!**\n\n`;
    result += `🆔 UUID: ${response.uuid}\n`;
    result += `📋 Name: ${params.schedule_name}\n`;
    result += `🔧 Type: ${params.schedule_type}\n`;
    
    if (params.interval) {
      result += `⏱️ Interval: ${params.interval}\n`;
    }
    
    if (params.schedule_type === 'cron') {
      result += `📅 **Cron Configuration:**\n`;
      if (params.cron_minutes) result += `   • Minutes: ${params.cron_minutes.join(', ')}\n`;
      if (params.cron_hours) result += `   • Hours: ${params.cron_hours.join(', ')}\n`;
      if (params.cron_days) result += `   • Days: ${params.cron_days.join(', ')}\n`;
      if (params.cron_months) result += `   • Months: ${params.cron_months.join(', ')}\n`;
      if (params.cron_weekdays) result += `   • Weekdays: ${params.cron_weekdays.join(', ')} (0=Sunday)\n`;
    }

    result += `\n💡 **Next Steps:**\n`;
    result += `   • Use this schedule in snapshot policies\n`;
    result += `   • Reference by name: "${params.schedule_name}"\n`;

    return result;
  } catch (error) {
    return `❌ Error creating snapshot schedule: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Update an existing snapshot schedule
 */
export function createUpdateSnapshotScheduleToolDefinition(): Tool {
  return {
    name: "update_snapshot_schedule",
    description: "Update an existing snapshot schedule's configuration",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        schedule_name: { type: "string", description: "Name of the schedule to update" },
        new_name: { type: "string", description: "New name for the schedule" },
        schedule_type: { 
          type: "string", 
          enum: ["cron", "interval"],
          description: "Updated schedule type"
        },
        interval: { type: "string", description: "Updated interval string" },
        cron_minutes: { 
          type: "array", 
          items: { type: "number", minimum: 0, maximum: 59 },
          description: "Updated minutes (0-59)"
        },
        cron_hours: { 
          type: "array", 
          items: { type: "number", minimum: 0, maximum: 23 },
          description: "Updated hours (0-23)"
        },
        cron_days: { 
          type: "array", 
          items: { type: "number", minimum: 1, maximum: 31 },
          description: "Updated days (1-31)"
        },
        cron_months: { 
          type: "array", 
          items: { type: "number", minimum: 1, maximum: 12 },
          description: "Updated months (1-12)"
        },
        cron_weekdays: { 
          type: "array", 
          items: { type: "number", minimum: 0, maximum: 6 },
          description: "Updated weekdays (0-6, 0=Sunday)"
        }
      },
      required: ["schedule_name"]
    }
  };
}

export async function handleUpdateSnapshotSchedule(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = UpdateSnapshotScheduleSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    const updates: UpdateSnapshotScheduleRequest = {};
    
    if (params.new_name) updates.name = params.new_name;
    if (params.interval) updates.interval = params.interval;
    
    if (params.schedule_type === 'cron' || params.cron_minutes || params.cron_hours || 
        params.cron_days || params.cron_months || params.cron_weekdays) {
      updates.cron = {};
      if (params.cron_minutes) updates.cron.minutes = params.cron_minutes;
      if (params.cron_hours) updates.cron.hours = params.cron_hours;
      if (params.cron_days) updates.cron.days = params.cron_days;
      if (params.cron_months) updates.cron.months = params.cron_months;
      if (params.cron_weekdays) updates.cron.weekdays = params.cron_weekdays;
    }

    await client.updateSnapshotSchedule(params.schedule_name, updates);

    let result = `✅ **Snapshot schedule '${params.schedule_name}' updated successfully!**\n\n`;
    
    if (params.new_name) result += `📋 New Name: ${params.new_name}\n`;
    if (params.interval) result += `⏱️ Interval: ${params.interval}\n`;
    
    if (updates.cron) {
      result += `📅 **Updated Cron Configuration:**\n`;
      if (params.cron_minutes) result += `   • Minutes: ${params.cron_minutes.join(', ')}\n`;
      if (params.cron_hours) result += `   • Hours: ${params.cron_hours.join(', ')}\n`;
      if (params.cron_days) result += `   • Days: ${params.cron_days.join(', ')}\n`;
      if (params.cron_months) result += `   • Months: ${params.cron_months.join(', ')}\n`;
      if (params.cron_weekdays) result += `   • Weekdays: ${params.cron_weekdays.join(', ')}\n`;
    }

    return result;
  } catch (error) {
    return `❌ Error updating snapshot schedule: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Delete a snapshot schedule
 */
export function createDeleteSnapshotScheduleToolDefinition(): Tool {
  return {
    name: "delete_snapshot_schedule",
    description: "Delete a snapshot schedule. WARNING: Schedule must not be in use by any policies.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_ip: { type: "string", description: "IP address or FQDN of the ONTAP cluster" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        schedule_name: { type: "string", description: "Name of the schedule to delete" }
      },
      required: ["schedule_name"]
    }
  };
}

export async function handleDeleteSnapshotSchedule(
  args: unknown,
  clusterManager: OntapClusterManager
): Promise<string> {
  const params = DeleteSnapshotScheduleSchema.parse(args);
  const client = getApiClient(clusterManager, params.cluster_name, params.cluster_ip, params.username, params.password);

  try {
    await client.deleteSnapshotSchedule(params.schedule_name);

    return `✅ **Snapshot schedule '${params.schedule_name}' deleted successfully!**\n\n⚠️  This schedule can no longer be used in snapshot policies.`;
  } catch (error) {
    return `❌ Error deleting snapshot schedule: ${error instanceof Error ? error.message : String(error)}`;
  }
}