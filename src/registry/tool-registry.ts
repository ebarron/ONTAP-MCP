/**
 * Central Tool Registry for NetApp ONTAP MCP Server
 * 
 * This registry provides a single source of truth for all tools,
 * eliminating duplication between STDIO and HTTP transports.
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { OntapClusterManager } from "../ontap-client.js";

/**
 * Tool Registration Interface
 * Each tool must provide a definition factory and handler function
 */
export interface ToolRegistration {
  name: string;
  category: string;
  definition: () => Tool;
  handler: (args: any, clusterManager: OntapClusterManager) => Promise<any>;
}

/**
 * Tool Categories for organization
 */
export enum ToolCategory {
  CLUSTER_MANAGEMENT = "cluster-management",
  VOLUME_MANAGEMENT = "volume-management", 
  SNAPSHOT_POLICIES = "snapshot-policies",
  SNAPSHOT_SCHEDULES = "snapshot-schedules",
  EXPORT_POLICIES = "export-policies",
  CIFS_SHARES = "cifs-shares",
  QOS_POLICIES = "qos-policies",
  LEGACY_SINGLE_CLUSTER = "legacy-single-cluster"
}

/**
 * Master Tool Registry
 * All 53 tools are registered here with their definitions and handlers
 */
export const TOOL_REGISTRY: ToolRegistration[] = [];

/**
 * Register a tool in the central registry
 */
export function registerTool(registration: ToolRegistration): void {
  // Check for duplicate names
  const existing = TOOL_REGISTRY.find(t => t.name === registration.name);
  if (existing) {
    throw new Error(`Tool '${registration.name}' is already registered`);
  }
  
  TOOL_REGISTRY.push(registration);
}

/**
 * Get all tool definitions for MCP tools/list response
 */
export function getAllToolDefinitions(): Tool[] {
  return TOOL_REGISTRY.map(registration => registration.definition());
}

/**
 * Get tool handler by name
 */
export function getToolHandler(toolName: string): ToolRegistration['handler'] | null {
  const registration = TOOL_REGISTRY.find(t => t.name === toolName);
  return registration ? registration.handler : null;
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: ToolCategory): ToolRegistration[] {
  return TOOL_REGISTRY.filter(t => t.category === category);
}

/**
 * Get tool count
 */
export function getToolCount(): number {
  return TOOL_REGISTRY.length;
}

/**
 * Get tool categories summary
 */
export function getToolCategorySummary(): Record<string, number> {
  return TOOL_REGISTRY.reduce((summary, tool) => {
    summary[tool.category] = (summary[tool.category] || 0) + 1;
    return summary;
  }, {} as Record<string, number>);
}