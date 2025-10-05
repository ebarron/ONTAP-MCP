/**
 * Harvest Prometheus/VictoriaMetrics Configuration
 * 
 * Manages connection to time-series database for metrics queries.
 * Feature-gated by HARVEST_TSDB_URL environment variable.
 */

import type { HarvestConfig } from '../types/harvest-types.js';

/**
 * Get Harvest TSDB configuration from environment
 * 
 * @returns Configuration object with enabled flag and connection details
 */
export function getHarvestConfig(): HarvestConfig {
    const tsdbUrl = process.env.HARVEST_TSDB_URL;
    
    return {
        enabled: !!tsdbUrl,
        url: tsdbUrl || '',
        timeout: process.env.HARVEST_TSDB_TIMEOUT || '30s'
    };
}

/**
 * Validate Harvest configuration
 * 
 * @param config - Harvest configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateHarvestConfig(config: HarvestConfig): void {
    if (!config.enabled) {
        throw new Error('Harvest metrics tools are disabled. Set HARVEST_TSDB_URL to enable.');
    }
    
    if (!config.url) {
        throw new Error('HARVEST_TSDB_URL is required but not set');
    }
    
    try {
        new URL(config.url);
    } catch (error) {
        throw new Error(`Invalid HARVEST_TSDB_URL: ${config.url}`);
    }
}

/**
 * Parse timeout duration string to milliseconds
 * 
 * @param duration - Duration string (e.g., "30s", "1m", "90s")
 * @returns Duration in milliseconds
 */
export function parseTimeoutDuration(duration: string): number {
    const match = duration.match(/^(\d+)(s|m|h)$/);
    
    if (!match) {
        throw new Error(`Invalid timeout duration format: ${duration}. Expected format: number + unit (e.g., "30s", "1m")`);
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
        case 's':
            return value * 1000;
        case 'm':
            return value * 60 * 1000;
        case 'h':
            return value * 60 * 60 * 1000;
        default:
            throw new Error(`Unknown duration unit: ${unit}`);
    }
}
