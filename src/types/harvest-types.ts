/**
 * Type definitions for Harvest Prometheus/VictoriaMetrics integration
 * Based on Harvest MCP server implementation
 */

import { z } from 'zod';

/**
 * Prometheus API Response Types
 */

export interface PrometheusResponse<T = any> {
    status: 'success' | 'error';
    data?: T;
    error?: string;
    errorType?: string;
    warnings?: string[];
}

export interface PrometheusMetricsResponse {
    status: 'success' | 'error';
    data: {
        resultType: 'matrix' | 'vector' | 'scalar' | 'string';
        result: any[];
    };
    error?: string;
    errorType?: string;
}

export interface PrometheusLabelsResponse {
    status: 'success' | 'error';
    data: string[];
    error?: string;
    errorType?: string;
}

export interface PrometheusAlert {
    labels: Record<string, string>;
    annotations: Record<string, string>;
    state: 'pending' | 'firing';
    activeAt: string;
    value: string;
}

export interface PrometheusAlertsResponse {
    status: 'success' | 'error';
    data: {
        alerts: PrometheusAlert[];
    };
    error?: string;
    errorType?: string;
}

/**
 * Tool Input Schemas
 */

export const QueryArgsSchema = z.object({
    query: z.string().describe('PromQL query expression')
});

export const RangeQueryArgsSchema = z.object({
    query: z.string().describe('PromQL query expression'),
    start: z.string().describe('Start timestamp (RFC3339 or Unix timestamp)'),
    end: z.string().describe('End timestamp (RFC3339 or Unix timestamp)'),
    step: z.string().describe('Query resolution step width (e.g., "15s", "1m", "1h")')
});

export const ListMetricsArgsSchema = z.object({
    match: z.string().optional().describe('Optional metric name pattern to filter results. Supports simple string matching or regex patterns'),
    matches: z.array(z.string()).optional().describe('Array of PromQL label matchers for server-side filtering (e.g., ["{__name__=~\\".*volume.*\\"}"])')
});

export const ListLabelValuesArgsSchema = z.object({
    label: z.string().describe('Label name to get values for (e.g., "cluster", "node", "volume")'),
    match: z.string().optional().describe('Optional pattern to filter label values. Supports simple string matching or regex patterns')
});

export const InfrastructureHealthArgsSchema = z.object({
    includeDetails: z.boolean().optional().default(false).describe('Include detailed metrics in the response')
});

export const GetMetricDescriptionArgsSchema = z.object({
    metricName: z.string().describe('Name of the metric to get description for')
});

export const SearchMetricsArgsSchema = z.object({
    pattern: z.string().describe('Search pattern to match against metric names and descriptions')
});

/**
 * Type exports for use in tool handlers
 */

export type QueryArgs = z.infer<typeof QueryArgsSchema>;
export type RangeQueryArgs = z.infer<typeof RangeQueryArgsSchema>;
export type ListMetricsArgs = z.infer<typeof ListMetricsArgsSchema>;
export type ListLabelValuesArgs = z.infer<typeof ListLabelValuesArgsSchema>;
export type InfrastructureHealthArgs = z.infer<typeof InfrastructureHealthArgsSchema>;
export type GetMetricDescriptionArgs = z.infer<typeof GetMetricDescriptionArgsSchema>;
export type SearchMetricsArgs = z.infer<typeof SearchMetricsArgsSchema>;

/**
 * Harvest Configuration
 */

export interface HarvestConfig {
    enabled: boolean;
    url: string;
    timeout: string;
}

/**
 * Metric Metadata
 */

export interface MetricDescription {
    name: string;
    description: string;
    type?: string;
    unit?: string;
}

export type MetricDescriptionMap = Record<string, string>;
