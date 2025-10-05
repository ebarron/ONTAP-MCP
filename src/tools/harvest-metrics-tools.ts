/**
 * Harvest Metrics Tools
 * 
 * Prometheus/VictoriaMetrics query tools for ONTAP infrastructure monitoring.
 * Ported from NetApp Harvest MCP server with ONTAP-specific enhancements.
 * 
 * Tools (11 total):
 * - metrics_query: Instant PromQL queries
 * - metrics_range_query: Time-series range queries
 * - list_metrics: Metric discovery with filtering
 * - list_label_values: Label value enumeration
 * - list_all_label_names: Label discovery
 * - get_active_alerts: Alert monitoring
 * - infrastructure_health: Comprehensive health assessment
 * - get_metric_description: Metadata lookup
 * - search_metrics: Metric search by pattern
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { HarvestConfig } from '../types/harvest-types.js';
import type {
    QueryArgs,
    RangeQueryArgs,
    ListMetricsArgs,
    ListLabelValuesArgs,
    InfrastructureHealthArgs,
    GetMetricDescriptionArgs,
    SearchMetricsArgs,
    PrometheusMetricsResponse,
    PrometheusLabelsResponse,
    PrometheusAlertsResponse,
    MetricDescriptionMap
} from '../types/harvest-types.js';
import { validateHarvestConfig, parseTimeoutDuration } from '../config/harvest-config.js';

/**
 * Query Prometheus metadata endpoint for metric descriptions
 * 
 * @param config - Harvest configuration
 * @param metricName - Optional specific metric name to query
 * @returns Map of metric names to their metadata
 */
async function queryPrometheusMetadata(
    config: HarvestConfig,
    metricName?: string
): Promise<Record<string, Array<{ type: string; help: string; unit?: string }>>> {
    validateHarvestConfig(config);
    
    const params = new URLSearchParams();
    if (metricName) {
        params.append('metric', metricName);
    }
    
    const url = `${config.url}/api/v1/metadata${params.toString() ? '?' + params.toString() : ''}`;
    const timeout = parseTimeoutDuration(config.timeout);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Prometheus metadata query failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.status !== 'success') {
            throw new Error(`Prometheus metadata query failed: ${data.error || 'Unknown error'}`);
        }
        
        return data.data;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Execute Prometheus/VictoriaMetrics API query
 * 
 * @param config - Harvest configuration
 * @param endpoint - API endpoint path
 * @param params - Query parameters
 * @returns Response data
 */
async function executeTSDBQuery(
    config: HarvestConfig,
    endpoint: string,
    params: URLSearchParams
): Promise<any> {
    validateHarvestConfig(config);
    
    const url = `${config.url}${endpoint}?${params.toString()}`;
    const timeout = parseTimeoutDuration(config.timeout);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Query timeout after ${config.timeout}`);
        }
        
        throw error;
    }
}

/**
 * Filter strings by pattern (regex or substring)
 * 
 * @param items - Strings to filter
 * @param pattern - Filter pattern
 * @returns Filtered strings
 */
function filterStrings(items: string[], pattern: string): string[] {
    if (!pattern) {
        return items;
    }
    
    // Try regex first
    try {
        const regex = new RegExp(pattern);
        return items.filter(item => regex.test(item));
    } catch {
        // Fall back to case-insensitive substring matching
        const lowerPattern = pattern.toLowerCase();
        return items.filter(item => item.toLowerCase().includes(lowerPattern));
    }
}

/**
 * Validate PromQL query string
 * 
 * @param query - PromQL query to validate
 * @throws Error if query is invalid
 */
function validateQuery(query: string): void {
    if (!query || query.trim() === '') {
        throw new Error('Query parameter is required and cannot be empty');
    }
    
    if (query.length > 10000) {
        throw new Error('Query exceeds maximum length of 10000 characters');
    }
}

/**
 * Validate range query parameters
 * 
 * @param query - PromQL query
 * @param start - Start timestamp
 * @param end - End timestamp
 * @param step - Step duration
 * @throws Error if parameters are invalid
 */
function validateRangeQuery(query: string, start: string, end: string, step: string): void {
    validateQuery(query);
    
    if (!start || start.trim() === '') {
        throw new Error('Start timestamp is required');
    }
    
    if (!end || end.trim() === '') {
        throw new Error('End timestamp is required');
    }
    
    if (!step || step.trim() === '') {
        throw new Error('Step duration is required');
    }
    
    // Validate step format
    if (!/^\d+[smhd]$/.test(step)) {
        throw new Error('Step must be in format: number + unit (e.g., "15s", "1m", "1h", "1d")');
    }
}

/**
 * Tool: metrics_query
 * 
 * Execute instant PromQL queries against Prometheus or VictoriaMetrics to get current metric values.
 */
export async function handleMetricsQuery(args: QueryArgs, config: HarvestConfig): Promise<string> {
    validateQuery(args.query);
    
    const params = new URLSearchParams({ query: args.query });
    const response: PrometheusMetricsResponse = await executeTSDBQuery(
        config,
        '/api/v1/query',
        params
    );
    
    if (response.status !== 'success') {
        throw new Error(`Prometheus error: ${response.errorType} - ${response.error}`);
    }
    
    return JSON.stringify(response, null, 2);
}

/**
 * Tool: metrics_range_query
 * 
 * Execute a PromQL range query to get time series data over a period.
 */
export async function handleMetricsRangeQuery(args: RangeQueryArgs, config: HarvestConfig): Promise<string> {
    validateRangeQuery(args.query, args.start, args.end, args.step);
    
    const params = new URLSearchParams({
        query: args.query,
        start: args.start,
        end: args.end,
        step: args.step
    });
    
    const response: PrometheusMetricsResponse = await executeTSDBQuery(
        config,
        '/api/v1/query_range',
        params
    );
    
    if (response.status !== 'success') {
        throw new Error(`Prometheus error: ${response.errorType} - ${response.error}`);
    }
    
    return JSON.stringify(response, null, 2);
}

/**
 * Tool: list_metrics
 * 
 * List all available metrics with optional filtering and descriptions.
 */
export async function handleListMetrics(args: ListMetricsArgs, config: HarvestConfig): Promise<string> {
    let response: PrometheusLabelsResponse;
    
    if (args.matches && args.matches.length > 0) {
        // Server-side filtering with label matchers
        const params = new URLSearchParams();
        args.matches.forEach(match => params.append('match[]', match));
        
        response = await executeTSDBQuery(config, '/api/v1/label/__name__/values', params);
    } else {
        // Get all metrics
        response = await executeTSDBQuery(config, '/api/v1/label/__name__/values', new URLSearchParams());
    }
    
    if (response.status !== 'success') {
        throw new Error(`Prometheus error: ${response.error}`);
    }
    
    let metrics = response.data;
    
    // Client-side filtering if pattern provided
    if (args.match && !args.matches) {
        metrics = filterStrings(metrics, args.match);
    }
    
    // Optionally fetch descriptions from Prometheus metadata
    // Only do this when filtering is applied to limit response size
    const includeDescriptions = !!args.match || (args.matches && args.matches.length > 0);
    let metadataMap: Record<string, Array<{ type: string; help: string }>> = {};
    
    if (includeDescriptions) {
        try {
            metadataMap = await queryPrometheusMetadata(config);
        } catch (error) {
            // Metadata unavailable, continue without descriptions
            console.warn('Failed to fetch Prometheus metadata:', error);
        }
    }
    
    const metricsArray = metrics.map(metric => {
        const metricInfo: any = { name: metric };
        
        if (includeDescriptions && metadataMap[metric]?.[0]?.help) {
            metricInfo.description = metadataMap[metric][0].help;
        }
        
        return metricInfo;
    });
    
    const result = {
        status: 'success',
        data: {
            total_count: metrics.length,
            filtering: {
                server_side_matches: !!(args.matches && args.matches.length > 0),
                client_side_pattern: !!args.match && !args.matches,
                pattern_used: args.match || '',
                matches_used: args.matches || null
            },
            descriptions_included: includeDescriptions,
            metrics: metricsArray
        }
    };
    
    return JSON.stringify(result, null, 2);
}

/**
 * Tool: list_label_values
 * 
 * Get all available values for a specific label (e.g., cluster names, node names).
 */
export async function handleListLabelValues(args: ListLabelValuesArgs, config: HarvestConfig): Promise<string> {
    if (!args.label) {
        throw new Error('Label parameter is required');
    }
    
    const response: PrometheusLabelsResponse = await executeTSDBQuery(
        config,
        `/api/v1/label/${args.label}/values`,
        new URLSearchParams()
    );
    
    if (response.status !== 'success') {
        throw new Error(`Prometheus error: ${response.error}`);
    }
    
    let values = response.data;
    
    // Apply client-side filtering if pattern provided
    if (args.match) {
        values = filterStrings(values, args.match);
    }
    
    const result = {
        status: 'success',
        data: {
            label_name: args.label,
            label_values: values,
            total_count: values.length
        }
    };
    
    return JSON.stringify(result, null, 2);
}

/**
 * Tool: list_all_label_names
 * 
 * Get all available label names (dimensions) from Prometheus.
 */
export async function handleListAllLabelNames(_args: any, config: HarvestConfig): Promise<string> {
    const response: PrometheusLabelsResponse = await executeTSDBQuery(
        config,
        '/api/v1/labels',
        new URLSearchParams()
    );
    
    if (response.status !== 'success') {
        throw new Error(`Prometheus error: ${response.error}`);
    }
    
    const result = {
        status: 'success',
        data: {
            label_names: response.data,
            total_count: response.data.length
        }
    };
    
    return JSON.stringify(result, null, 2);
}

/**
 * Tool: get_active_alerts
 * 
 * Get active alerts from Prometheus with summary by severity level.
 */
export async function handleGetActiveAlerts(_args: any, config: HarvestConfig): Promise<string> {
    const response: PrometheusAlertsResponse = await executeTSDBQuery(
        config,
        '/api/v1/alerts',
        new URLSearchParams()
    );
    
    const alerts = response.data?.alerts || [];
    
    let report = '## Prometheus Active Alerts\n\n';
    
    if (alerts.length === 0) {
        report += '✅ **No active alerts found**\n\n';
    } else {
        report += `🚨 **${alerts.length} active alerts found:**\n\n`;
        
        // Group alerts by severity
        let criticalCount = 0;
        let warningCount = 0;
        let infoCount = 0;
        
        alerts.forEach(alert => {
            const severity = alert.labels.severity?.toLowerCase();
            if (severity === 'critical') criticalCount++;
            else if (severity === 'warning') warningCount++;
            else if (severity === 'info') infoCount++;
        });
        
        if (criticalCount > 0) {
            report += `🔴 **Critical**: ${criticalCount} alerts\n`;
        }
        if (warningCount > 0) {
            report += `🟡 **Warning**: ${warningCount} alerts\n`;
        }
        if (infoCount > 0) {
            report += `🔵 **Info**: ${infoCount} alerts\n`;
        }
        
        const otherCount = alerts.length - criticalCount - warningCount - infoCount;
        if (otherCount > 0) {
            report += `⚪ **Other**: ${otherCount} alerts\n`;
        }
        
        report += '\n### Alert Details:\n\n';
        report += '```json\n';
        report += JSON.stringify(alerts, null, 2);
        report += '\n```';
    }
    
    return report;
}

/**
 * Tool: infrastructure_health
 * 
 * Perform comprehensive automated health assessment across ONTAP infrastructure.
 */
export async function handleInfrastructureHealth(args: InfrastructureHealthArgs, config: HarvestConfig): Promise<string> {
    let healthReport = '## ONTAP Infrastructure Health Report\n\n';
    let issuesFound = false;
    
    // Health checks to perform
    const healthChecks = [
        {
            name: 'Cluster Status',
            query: 'cluster_new_status != 1',
            description: 'Clusters not in healthy state',
            critical: true
        },
        {
            name: 'Node Status',
            query: 'node_new_status != 1',
            description: 'Nodes not online',
            critical: true
        },
        {
            name: 'Aggregate Status',
            query: 'aggr_new_status != 1',
            description: 'Aggregates not online',
            critical: true
        },
        {
            name: 'Volume Status',
            query: 'volume_new_status != 1',
            description: 'Volumes not online',
            critical: false
        },
        {
            name: 'Full Volumes',
            query: 'volume_size_used_percent == 100',
            description: 'Volumes at 100% capacity',
            critical: true
        },
        {
            name: 'High Volume Usage',
            query: 'volume_size_used_percent > 95',
            description: 'Volumes over 95% capacity',
            critical: false
        },
        {
            name: 'High Aggregate Usage',
            query: 'aggr_inode_used_percent > 90',
            description: 'Aggregates over 90% capacity',
            critical: false
        },
        {
            name: 'Health Alerts',
            query: '{__name__=~"health_.*"}',
            description: 'Active health alerts',
            critical: true
        }
    ];
    
    for (const check of healthChecks) {
        try {
            const params = new URLSearchParams({ query: check.query });
            const response: PrometheusMetricsResponse = await executeTSDBQuery(
                config,
                '/api/v1/query',
                params
            );
            
            if (response.status === 'success') {
                const results = response.data.result || [];
                
                if (results.length > 0) {
                    issuesFound = true;
                    const icon = check.critical ? '🚨' : '⚠️';
                    healthReport += `${icon} **${check.name}**: ${results.length} issues found - ${check.description}\n`;
                    
                    // Add details if requested
                    if (args.includeDetails) {
                        healthReport += '   Details:\n';
                        const limit = Math.min(results.length, 5);
                        
                        for (let i = 0; i < limit; i++) {
                            const result = results[i];
                            const metric = result.metric || {};
                            const identifiers = [
                                metric.cluster && `cluster:${metric.cluster}`,
                                metric.node && `node:${metric.node}`,
                                metric.volume && `volume:${metric.volume}`,
                                metric.aggr && `aggr:${metric.aggr}`
                            ].filter(Boolean).join(', ');
                            
                            healthReport += `   - ${identifiers || 'Unknown'}\n`;
                        }
                        
                        if (results.length > 5) {
                            healthReport += `   ... and ${results.length - 5} more\n`;
                        }
                    }
                } else {
                    healthReport += `✅ **${check.name}**: No issues found\n`;
                }
            }
        } catch (error) {
            healthReport += `❌ **${check.name}**: Error querying - ${error}\n`;
        }
    }
    
    // Summary
    if (issuesFound) {
        healthReport = '🚨 **HEALTH ISSUES DETECTED** 🚨\n\n' + healthReport +
            '\n**Recommendation**: Investigate and resolve critical (🚨) alerts.\n\n' +
            '**Health Monitoring Context**: \n' +
            '- Status metrics (cluster_new_status, node_new_status, aggr_new_status, volume_new_status): 1 = healthy/online, 0 = unhealthy/offline\n' +
            '- State metrics (*_state): When querying state metrics, 0 = object is offline, 1 = object is online\n' +
            '- Health metrics (health_*): Any value ≥ 1 indicates an active alert or issue\n' +
            '- Capacity metrics: Monitor volume_size_used_percent and aggr_inode_used_percent for space issues\n';
    } else {
        healthReport = '✅ **ALL SYSTEMS HEALTHY** ✅\n\n' + healthReport +
            '\n**Status**: Your ONTAP infrastructure appears to be operating normally.\n';
    }
    
    return healthReport;
}

/**
 * Tool: get_metric_description
 * 
 * Get description and metadata for a specific metric by name from Prometheus.
 */
export async function handleGetMetricDescription(args: GetMetricDescriptionArgs, config: HarvestConfig): Promise<string> {
    if (!args.metricName) {
        throw new Error('metricName parameter is required');
    }
    
    try {
        const metadata = await queryPrometheusMetadata(config, args.metricName);
        
        if (!metadata[args.metricName] || metadata[args.metricName].length === 0) {
            return `No metadata found for metric: ${args.metricName}\n\nThis metric may not exist or has not been scraped by Harvest yet.`;
        }
        
        const info = metadata[args.metricName][0];
        let response = `**Metric:** ${args.metricName}\n\n`;
        response += `**Type:** ${info.type}\n\n`;
        response += `**Description:** ${info.help}`;
        
        if (info.unit) {
            response += `\n\n**Unit:** ${info.unit}`;
        }
        
        return response;
    } catch (error) {
        return `Failed to retrieve metadata for ${args.metricName}: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * Tool: search_metrics
 * 
 * Search for metrics by name or description pattern using Prometheus metadata.
 */
export async function handleSearchMetrics(args: SearchMetricsArgs, config: HarvestConfig): Promise<string> {
    if (!args.pattern) {
        throw new Error('pattern parameter is required');
    }
    
    try {
        // Get all metric metadata from Prometheus
        const metadata = await queryPrometheusMetadata(config);
        
        const pattern = args.pattern.toLowerCase();
        const matches: Array<{ name: string; type: string; description: string }> = [];
        
        // Search through all metrics
        for (const [metricName, metricInfo] of Object.entries(metadata)) {
            if (metricInfo.length === 0) continue;
            
            const info = metricInfo[0];
            const matchesName = metricName.toLowerCase().includes(pattern);
            const matchesDesc = info.help.toLowerCase().includes(pattern);
            
            if (matchesName || matchesDesc) {
                matches.push({
                    name: metricName,
                    type: info.type,
                    description: info.help
                });
            }
        }
        
        if (matches.length === 0) {
            return `No metrics found matching pattern: ${args.pattern}\n\nNote: Only metrics currently scraped by Harvest are searchable.`;
        }
        
        // Limit results to avoid overwhelming response
        const maxResults = 50;
        const truncated = matches.length > maxResults;
        const displayMatches = matches.slice(0, maxResults);
        
        let response = `Found ${matches.length} metrics matching pattern '${args.pattern}'`;
        if (truncated) {
            response += ` (showing first ${maxResults})`;
        }
        response += ':\n\n';
        
        displayMatches.forEach((match, index) => {
            if (index > 0) {
                response += '\n---\n\n';
            }
            response += `**${match.name}** (${match.type})\n${match.description}`;
        });
        
        return response;
    } catch (error) {
        return `Failed to search metrics: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * Tool Definition Creators
 * Required for MCP tool registration
 */

export function createMetricsQueryToolDefinition(): Tool {
    return {
        name: "metrics_query",
        description: `Execute instant PromQL queries against Prometheus or VictoriaMetrics to get current metric values at a specific point in time.

**COMMON IOPS QUERIES** (use these exact metric names):
- cluster_total_ops - Total IOPS per cluster
- node_total_ops - Total IOPS per node
- volume_total_ops - Total IOPS per volume
- aggr_total_ops - Total IOPS per aggregate

**COMMON LATENCY QUERIES** (for "high latency" or "performance bottlenecks"):
- volume_read_latency - Read latency per volume (microseconds)
- volume_write_latency - Write latency per volume (microseconds)
- aggr_total_latency - Aggregate latency (microseconds)
- node_disk_max_latency - Node disk latency (microseconds)

**LATENCY QUERY EXAMPLES**:
- topk(10, avg by (cluster, volume) (volume_read_latency + volume_write_latency)) > 100
  → Top 10 volumes with combined latency >100μs
- topk(10, avg by (cluster, node, aggr) (aggr_total_latency))
  → Top 10 aggregates by latency

**CPU/PERFORMANCE QUERIES**:
- node_avg_processor_busy - Node CPU utilization (percentage)
- topk(10, avg by (cluster, node) (node_avg_processor_busy))
  → Top 10 busiest nodes by CPU

**CAPACITY QUERIES**:
- volume_size_used_percent - Volume space utilization (percentage)
- aggr_space_used_percent - Aggregate space utilization (percentage)

**IMPORTANT**: For latency, you MUST combine read+write metrics and filter results (e.g., > 100). Use topk() to get worst offenders.`,
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "PromQL query expression - use exact metric names and examples above. For latency: combine volume_read_latency + volume_write_latency"
                }
            },
            required: ["query"]
        }
    };
}export function createMetricsRangeQueryToolDefinition(): Tool {
    return {
        name: "metrics_range_query",
        description: "Execute a PromQL range query against Prometheus or VictoriaMetrics to get time series data over a period",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "PromQL query expression" },
                start: { type: "string", description: "Start timestamp (RFC3339 or Unix timestamp)" },
                end: { type: "string", description: "End timestamp (RFC3339 or Unix timestamp)" },
                step: { type: "string", description: "Query resolution step width (e.g., '15s', '1m', '1h')" }
            },
            required: ["query", "start", "end", "step"]
        }
    };
}

export function createListMetricsToolDefinition(): Tool {
    return {
        name: "list_metrics",
        description: `List all available metrics from Prometheus or VictoriaMetrics with advanced filtering and optional descriptions. 
        
When 'match' or 'matches' filters are applied, metric descriptions are automatically included. 

Use 1) 'match' for simple/regex patterns, 2) 'matches' for efficient server-side label matchers`,
        inputSchema: {
            type: "object",
            properties: {
                match: { 
                    type: "string", 
                    description: "Optional metric name pattern to filter results. Supports simple string matching or regex patterns" 
                },
                matches: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Array of PromQL label matchers for server-side filtering (e.g., ['{__name__=~\".*volume.*\"}'])" 
                }
            }
        }
    };
}

export function createListLabelValuesToolDefinition(): Tool {
    return {
        name: "list_label_values",
        description: "Get all available values for a specific label (e.g., cluster names, node names, volume names) with optional regex filtering",
        inputSchema: {
            type: "object",
            properties: {
                label: { type: "string", description: "Label name to get values for (e.g., 'cluster', 'node', 'volume')" },
                match: { type: "string", description: "Optional pattern to filter label values. Supports simple string matching or regex patterns" }
            },
            required: ["label"]
        }
    };
}

export function createListAllLabelNamesToolDefinition(): Tool {
    return {
        name: "list_all_label_names",
        description: "Get all available label names (dimensions) that can be used to filter metrics in Prometheus or VictoriaMetrics",
        inputSchema: {
            type: "object",
            properties: {}
        }
    };
}

export function createGetActiveAlertsToolDefinition(): Tool {
    return {
        name: "get_active_alerts",
        description: "Get active alerts from Prometheus or VictoriaMetrics with summary by severity level",
        inputSchema: {
            type: "object",
            properties: {}
        }
    };
}

export function createInfrastructureHealthToolDefinition(): Tool {
    return {
        name: "infrastructure_health",
        description: `Perform comprehensive automated health assessment with actionable insights across ONTAP infrastructure.

    **USE THIS TOOL FOR**: Performance bottlenecks, cluster health checks, capacity planning, infrastructure assessment.
    
    Combines multiple health indicators into a unified operational status view:
    - **Performance Issues**: High CPU, latency hotspots, IOPS distribution
    - **Capacity Bottlenecks**: Full volumes (100%), near-full aggregates (>95%), space exhaustion
    - **System Availability**: Cluster/node/aggregate/volume status (offline components)
    - **Active Alerts**: Health alerts requiring immediate attention
    
    Output: Prioritized list of issues with severity levels (🚨 critical, ⚠️ warning, ✅ healthy).
    
    Workflow: **Start here** for "show me performance bottlenecks", "health check", or "what's wrong with my clusters".`,
        inputSchema: {
            type: "object",
            properties: {
                includeDetails: { 
                    type: "boolean", 
                    description: "Include detailed metrics in the response",
                    default: false
                }
            }
        }
    };
}

export function createGetMetricDescriptionToolDefinition(): Tool {
    return {
        name: "get_metric_description",
        description: "Get description and metadata for a specific metric by name",
        inputSchema: {
            type: "object",
            properties: {
                metricName: { type: "string", description: "Name of the metric to get description for" }
            },
            required: ["metricName"]
        }
    };
}

export function createSearchMetricsToolDefinition(): Tool {
    return {
        name: "search_metrics",
        description: "Search for metrics by name, description, or object type using a pattern",
        inputSchema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "Search pattern to match against metric names and descriptions" }
            },
            required: ["pattern"]
        }
    };
}
