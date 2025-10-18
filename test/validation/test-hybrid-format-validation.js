#!/usr/bin/env node

/**
 * Hybrid Format Validation Test
 * 
 * Validates that Go MCP server responses match TypeScript golden fixtures
 * for all 14 tools that return hybrid format {summary, data}.
 * 
 * This ensures the Go implementation preserves the exact API contract
 * that TypeScript established, particularly for Fix-It undo functionality.
 * 
 * Usage:
 *   1. Ensure golden fixtures exist: node test/utils/capture-golden-responses.js
 *   2. Start Go MCP server: ./start-demo-go.sh (or go run cmd/ontap-mcp)
 *   3. Run validation: node test/validation/test-hybrid-format-validation.js
 * 
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { McpTestClient } from '../utils/mcp-test-client.js';
import { HybridFormatValidator, hasGoldenFixture } from '../utils/hybrid-format-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GO_SERVER_PORT = process.env.MCP_PORT || 3000;
const GOLDEN_DIR = join(__dirname, '../fixtures/hybrid-golden');

// All 14 tools that should return hybrid format
const TOOLS_TO_VALIDATE = [
  'cluster_list_volumes',
  'cluster_list_aggregates',
  'cluster_list_svms',
  'get_cifs_share',
  'cluster_list_cifs_shares',
  'list_export_policies',
  'get_export_policy',
  'cluster_list_qos_policies',
  'cluster_get_qos_policy',
  'list_snapshot_policies',
  'get_snapshot_policy',
  'get_snapshot_schedule',
  'cluster_get_volume_autosize_status',
  'cluster_list_volume_snapshots',
  'cluster_get_volume_snapshot_info'
];

async function getCluster(client) {
  // Load clusters into session
  const { loadClustersIntoSession } = await import('../utils/mcp-test-client.js');
  await loadClustersIntoSession(client);
  
  const result = await client.callTool('list_registered_clusters', {});
  const text = client.parseContent(result);
  
  if (text.includes('No clusters registered')) {
    throw new Error('No clusters registered. Please configure clusters in test/clusters.json');
  }
  
  // Parse cluster info
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('- ')) {
      const match = line.match(/- ([^:]+): ([^\s]+) \(([^)]*)\)/);
      if (match) {
        return {
          name: match[1].trim(),
          cluster_ip: match[2].trim(),
          description: match[3].trim()
        };
      }
    }
  }
  
  throw new Error('Could not parse cluster information');
}

async function discoverResource(client, tool, params) {
  try {
    const result = await client.callTool(tool, params);
    const parsed = client.parseHybridFormat(result);
    return parsed.data;
  } catch (error) {
    console.log(`    ⚠️  Discovery failed for ${tool}: ${error.message}`);
    return null;
  }
}

async function getToolParams(client, toolName, cluster, discoveries = {}) {
  const baseParams = { cluster_name: cluster.name };
  
  // Tools that need specific parameters
  switch (toolName) {
    case 'get_cifs_share':
      // This is a LEGACY tool - use cluster_ip/username/password from golden fixture if available
      // Try to load params from golden fixture first
      const cifsFixturePath = join(GOLDEN_DIR, `${toolName}.json`);
      try {
        const cifsFixture = JSON.parse(readFileSync(cifsFixturePath, 'utf8'));
        if (cifsFixture.metadata?.params) {
          console.log('  ℹ️  Using legacy params from golden fixture');
          return cifsFixture.metadata.params;
        }
      } catch (e) {
        // No golden fixture, try discovery
      }
      
      // Fallback: try to discover a CIFS share
      if (!discoveries.cifs_shares) {
        discoveries.cifs_shares = await discoverResource(
          client,
          'cluster_list_cifs_shares',
          baseParams
        );
      }
      if (discoveries.cifs_shares && discoveries.cifs_shares.length > 0) {
        return {
          ...baseParams,
          name: discoveries.cifs_shares[0].name,
          svm_name: discoveries.cifs_shares[0].svm_name || discoveries.cifs_shares[0].svm?.name
        };
      }
      return null; // Skip if no CIFS shares
      
    case 'get_export_policy':
      return { ...baseParams, policy_name: 'default' };
      
    case 'cluster_get_qos_policy':
      // Try to load params from golden fixture first
      const qosFixturePath = join(GOLDEN_DIR, `${toolName}.json`);
      try {
        const qosFixture = JSON.parse(readFileSync(qosFixturePath, 'utf8'));
        if (qosFixture.metadata?.params) {
          console.log('  ℹ️  Using params from golden fixture');
          return qosFixture.metadata.params;
        }
      } catch (e) {
        // No golden fixture, try discovery
      }
      
      // Fallback: try to discover QoS policies
      if (!discoveries.qos_policies) {
        discoveries.qos_policies = await discoverResource(
          client,
          'cluster_list_qos_policies',
          baseParams
        );
      }
      if (discoveries.qos_policies && discoveries.qos_policies.length > 0) {
        return { ...baseParams, policy_uuid: discoveries.qos_policies[0].uuid };
      }
      return null; // Skip if no QoS policies
      
    case 'get_snapshot_policy':
    case 'list_snapshot_policies':
      // Snapshot policies - list doesn't need UUID
      if (toolName === 'get_snapshot_policy') {
        if (!discoveries.snapshot_policies) {
          discoveries.snapshot_policies = await discoverResource(
            client,
            'list_snapshot_policies',
            baseParams
          );
        }
        if (discoveries.snapshot_policies && discoveries.snapshot_policies.length > 0) {
          return { ...baseParams, policy_uuid: discoveries.snapshot_policies[0].uuid };
        }
        return null;
      }
      return baseParams;
      
    case 'get_snapshot_schedule':
      return { ...baseParams, schedule_name: 'daily' };
      
    case 'cluster_get_volume_autosize_status':
    case 'cluster_list_volume_snapshots':
      if (!discoveries.volumes) {
        discoveries.volumes = await discoverResource(
          client,
          'cluster_list_volumes',
          baseParams
        );
      }
      if (discoveries.volumes && discoveries.volumes.length > 0) {
        return { ...baseParams, volume_uuid: discoveries.volumes[0].uuid };
      }
      return null; // Skip if no volumes
      
    case 'cluster_get_volume_snapshot_info':
      // Need volume snapshots first
      if (!discoveries.volumes) {
        discoveries.volumes = await discoverResource(
          client,
          'cluster_list_volumes',
          baseParams
        );
      }
      if (discoveries.volumes && discoveries.volumes.length > 0) {
        const volumeUuid = discoveries.volumes[0].uuid;
        
        if (!discoveries.snapshots) {
          discoveries.snapshots = await discoverResource(
            client,
            'cluster_list_volume_snapshots',
            { ...baseParams, volume_uuid: volumeUuid }
          );
        }
        
        if (discoveries.snapshots && discoveries.snapshots.length > 0) {
          return {
            ...baseParams,
            volume_uuid: volumeUuid,
            snapshot_uuid: discoveries.snapshots[0].uuid
          };
        }
      }
      return null; // Skip if no snapshots
      
    default:
      return baseParams;
  }
}

async function validateTool(client, toolName, cluster, discoveries) {
  console.log(`\n📋 Validating: ${toolName}`);
  
  // Check if golden fixture exists
  if (!hasGoldenFixture(toolName)) {
    console.log(`  ⏭️  Skipped: No golden fixture (run capture-golden-responses.js first)`);
    return { skipped: true, reason: 'no_golden' };
  }
  
  try {
    // Get parameters for this tool
    const params = await getToolParams(client, toolName, cluster, discoveries);
    
    if (params === null) {
      console.log(`  ⏭️  Skipped: Unable to discover required resources`);
      return { skipped: true, reason: 'no_resources' };
    }
    
    console.log(`  ℹ️  Params: ${JSON.stringify(params)}`);
    
    // Call the Go implementation
    const goResponse = await client.callTool(toolName, params);
    
    // Validate against golden fixture
    const validator = new HybridFormatValidator(toolName);
    const results = validator.validate(goResponse);
    
    // Print results
    console.log(validator.formatReport(results));
    
    return results;
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return {
      valid: false,
      errors: [{ type: 'exception', message: error.message }],
      warnings: []
    };
  }
}

async function main() {
  console.log('🔍 Hybrid Format Validation Test\n');
  console.log(`Go Server: http://localhost:${GO_SERVER_PORT}`);
  console.log(`Validating: ${TOOLS_TO_VALIDATE.length} tools\n`);
  
  const client = new McpTestClient(`http://localhost:${GO_SERVER_PORT}`);
  
  try {
    await client.initialize();
    console.log('✅ Connected to Go MCP server');
    
    // Get cluster
    const cluster = await getCluster(client);
    console.log(`✅ Using cluster: ${cluster.name}`);
    
    // Track results
    const results = {
      passed: [],
      failed: [],
      skipped: []
    };
    
    // Shared discoveries across tools
    const discoveries = {};
    
    // Validate each tool
    for (const toolName of TOOLS_TO_VALIDATE) {
      const result = await validateTool(client, toolName, cluster, discoveries);
      
      if (result.skipped) {
        results.skipped.push({ tool: toolName, reason: result.reason });
      } else if (result.valid) {
        results.passed.push(toolName);
      } else {
        results.failed.push({
          tool: toolName,
          errors: result.errors,
          warnings: result.warnings
        });
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 VALIDATION SUMMARY\n');
    
    console.log(`✅ Passed: ${results.passed.length}`);
    results.passed.forEach(tool => console.log(`   - ${tool}`));
    
    if (results.failed.length > 0) {
      console.log(`\n❌ Failed: ${results.failed.length}`);
      results.failed.forEach(failure => {
        console.log(`   - ${failure.tool} (${failure.errors.length} errors)`);
      });
    }
    
    if (results.skipped.length > 0) {
      console.log(`\n⏭️  Skipped: ${results.skipped.length}`);
      results.skipped.forEach(skip => {
        console.log(`   - ${skip.tool} (${skip.reason})`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
    
    // Exit with appropriate code
    if (results.failed.length > 0) {
      console.log('\n❌ VALIDATION FAILED - Go implementation does not match TypeScript golden fixtures');
      process.exit(1);
    } else if (results.passed.length === 0) {
      console.log('\n⚠️  NO VALIDATIONS RUN - Check golden fixtures and server configuration');
      process.exit(1);
    } else {
      console.log('\n✅ ALL VALIDATIONS PASSED - Go implementation matches TypeScript exactly!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error(`\n❌ Validation test failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
