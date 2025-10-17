#!/usr/bin/env node

/**
 * Capture Golden Responses from TypeScript MCP Server
 * 
 * This script connects to the TypeScript MCP server and captures responses
 * from all 14 hybrid format tools. These responses become the "golden" fixtures
 * used to validate the Go implementation matches TypeScript exactly.
 * 
 * Usage:
 *   1. Start TypeScript MCP server: npm start (or ./start-demo.sh)
 *   2. Run this script: node test/utils/capture-golden-responses.js
 *   3. Golden responses saved to: test/fixtures/hybrid-golden/
 * 
 * This is a ONE-TIME operation before sunsetting TypeScript server.
 * After Go implementation is validated, these fixtures become regression tests.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { McpTestClient } from './mcp-test-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GOLDEN_DIR = join(__dirname, '../fixtures/hybrid-golden');
const TS_SERVER_PORT = 3000;

// All 14 tools that return hybrid format {summary, data}
const HYBRID_TOOLS = [
  {
    name: 'cluster_list_volumes',
    category: 'cluster-management',
    getParams: (cluster) => ({ cluster_name: cluster.name })
  },
  {
    name: 'cluster_list_aggregates',
    category: 'cluster-management',
    getParams: (cluster) => ({ cluster_name: cluster.name })
  },
  {
    name: 'cluster_list_svms',
    category: 'cluster-management',
    getParams: (cluster) => ({ cluster_name: cluster.name })
  },
  {
    name: 'get_cifs_share',
    category: 'cifs',
    getParams: (cluster, svm, share) => ({ 
      cluster_name: cluster.name, 
      name: share || 'test_share',
      svm_name: svm || cluster.defaultSvm
    }),
    optional: true // May not have CIFS shares configured
  },
  {
    name: 'cluster_list_cifs_shares',
    category: 'cifs',
    getParams: (cluster) => ({ cluster_name: cluster.name })
  },
  {
    name: 'list_export_policies',
    category: 'export-policy',
    getParams: (cluster) => ({ cluster_name: cluster.name })
  },
  {
    name: 'get_export_policy',
    category: 'export-policy',
    getParams: (cluster) => ({ 
      cluster_name: cluster.name,
      policy_name: 'default'
    })
  },
  {
    name: 'cluster_list_qos_policies',
    category: 'qos',
    getParams: (cluster) => ({ cluster_name: cluster.name })
  },
  {
    name: 'cluster_get_qos_policy',
    category: 'qos',
    getParams: (cluster, policyUuid) => ({ 
      cluster_name: cluster.name,
      policy_uuid: policyUuid || 'auto-detect'
    }),
    needsDiscovery: 'cluster_list_qos_policies',
    optional: true
  },
  {
    name: 'list_snapshot_policies',
    category: 'snapshot-policy',
    getParams: (cluster) => ({ cluster_name: cluster.name })
  },
  {
    name: 'get_snapshot_policy',
    category: 'snapshot-policy',
    getParams: (cluster, policyUuid) => ({ 
      cluster_name: cluster.name,
      policy_uuid: policyUuid || 'auto-detect'
    }),
    needsDiscovery: 'list_snapshot_policies',
    optional: true
  },
  {
    name: 'get_snapshot_schedule',
    category: 'snapshot-schedule',
    getParams: (cluster) => ({ 
      cluster_name: cluster.name,
      schedule_name: 'daily'
    }),
    optional: true
  },
  {
    name: 'cluster_get_volume_autosize_status',
    category: 'volume-autosize',
    getParams: (cluster, volumeUuid) => ({ 
      cluster_name: cluster.name,
      volume_uuid: volumeUuid || 'auto-detect'
    }),
    needsDiscovery: 'cluster_list_volumes'
  },
  {
    name: 'cluster_list_volume_snapshots',
    category: 'volume-snapshot',
    getParams: (cluster, volumeUuid) => ({ 
      cluster_name: cluster.name,
      volume_uuid: volumeUuid || 'auto-detect'
    }),
    needsDiscovery: 'cluster_list_volumes'
  },
  {
    name: 'cluster_get_volume_snapshot_info',
    category: 'volume-snapshot',
    getParams: (cluster) => ({ 
      cluster_name: cluster.name,
      volume_uuid: 'auto-detect',
      snapshot_name: 'auto-detect'
    }),
    needsDiscovery: 'cluster_list_volume_snapshots',
    optional: true
  }
];

async function getCluster(client) {
  console.log('\n📋 Discovering available cluster...');
  
  // Load clusters into session
  const { loadClustersIntoSession } = await import('./mcp-test-client.js');
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
        const cluster = {
          name: match[1].trim(),
          cluster_ip: match[2].trim(),
          description: match[3].trim()
        };
        console.log(`✅ Using cluster: ${cluster.name} (${cluster.cluster_ip})`);
        return cluster;
      }
    }
  }
  
  throw new Error('Could not parse cluster information');
}

async function discoverResource(client, tool, params) {
  console.log(`  🔍 Discovering ${tool}...`);
  const result = await client.callTool(tool, params);
  const parsed = client.parseHybridFormat(result);
  
  // Check if it returned data in hybrid format
  if (parsed.data) {
    if (Array.isArray(parsed.data) && parsed.data.length === 0) {
      return null;
    }
    return parsed.data;
  }
  
  // For plain text responses, try to extract information from the text
  // This is needed for tools like list_snapshot_policies that don't use hybrid format
  const text = parsed.summary || '';
  
  // Try to extract UUIDs from plain text (for snapshot policies, QoS policies, etc.)
  if (tool === 'list_snapshot_policies') {
    // Parse output like "1. default\n   🆔 UUID: dc05d9d4-9557-11f0-b21b-005056bd74cc"
    const policyMatches = [...text.matchAll(/\*\*(\d+)\.\s+([^\n*]+)\*\*\s*\n\s*🆔\s*UUID:\s*([a-f0-9-]+)/g)];
    if (policyMatches.length > 0) {
      return policyMatches.map(m => ({
        name: m[2].trim(),
        uuid: m[3]
      }));
    }
  }
  
  // Try to extract volume info from plain text
  if (tool === 'cluster_list_volumes') {
    // Parse output like "- volname (uuid) - Size: X, State: online, SVM: svm0"
    const volMatches = [...text.matchAll(/-\s+([^\s(]+)\s+\(([a-f0-9-]+)\)/g)];
    if (volMatches.length > 0) {
      return volMatches.map(m => ({
        name: m[1],
        uuid: m[2]
      }));
    }
  }
  
  // Try to extract snapshot info from plain text  
  if (tool === 'cluster_list_volume_snapshots') {
    // Parse output like "1. **snapshot_name**\n   • UUID: uuid"
    const snapMatches = [...text.matchAll(/\d+\.\s+\*\*([^\*]+)\*\*\s*\n\s*•\s*UUID:\s*([a-f0-9-]+)/g)];
    if (snapMatches.length > 0) {
      return snapMatches.map(m => ({
        name: m[1].trim(),
        uuid: m[2]
      }));
    }
  }
  
  return null;
}

async function captureToolResponse(client, tool, cluster, discoveries = {}) {
  try {
    console.log(`\n📸 Capturing: ${tool.name}`);
    
    // Get base parameters
    let params = tool.getParams(cluster);
    
    // Auto-discover required resources
    if (tool.needsDiscovery) {
      const discoveryKey = tool.needsDiscovery;
      
      if (!discoveries[discoveryKey]) {
        // Discover the resource
        const discoveryTool = HYBRID_TOOLS.find(t => t.name === discoveryKey);
        if (discoveryTool) {
          let discoveryParams = discoveryTool.getParams(cluster);
          
          // Special case: cluster_list_volume_snapshots needs a volume_uuid
          if (discoveryKey === 'cluster_list_volume_snapshots') {
            // First ensure we have volumes discovered
            if (!discoveries['cluster_list_volumes']) {
              const volTool = HYBRID_TOOLS.find(t => t.name === 'cluster_list_volumes');
              if (volTool) {
                discoveries['cluster_list_volumes'] = await discoverResource(client, 'cluster_list_volumes', volTool.getParams(cluster));
              }
            }
            const volumes = discoveries['cluster_list_volumes'];
            if (volumes && volumes.length > 0) {
              discoveryParams.volume_uuid = volumes[0].uuid;
            }
          }
          
          discoveries[discoveryKey] = await discoverResource(client, discoveryKey, discoveryParams);
        }
      }
      
      const resourceData = discoveries[discoveryKey];
      if (!resourceData) {
        console.log(`  ⚠️  No resources found for discovery, skipping`);
        return null;
      }
      
      // Extract UUIDs from discovered data
      if (tool.name === 'cluster_get_volume_autosize_status' || 
          tool.name === 'cluster_list_volume_snapshots') {
        // Need volume UUID
        const volumes = Array.isArray(resourceData) ? resourceData : [resourceData];
        if (volumes.length > 0 && volumes[0].uuid) {
          params.volume_uuid = volumes[0].uuid;
          console.log(`  ℹ️  Using volume: ${volumes[0].name} (${volumes[0].uuid})`);
        }
      } else if (tool.name === 'cluster_get_volume_snapshot_info') {
        // Need volume UUID and snapshot NAME (or UUID)
        // First, we need the volume UUID from a previous discovery
        if (!discoveries['cluster_list_volumes']) {
          const volTool = HYBRID_TOOLS.find(t => t.name === 'cluster_list_volumes');
          if (volTool) {
            discoveries['cluster_list_volumes'] = await discoverResource(client, 'cluster_list_volumes', volTool.getParams(cluster));
          }
        }
        const volumes = discoveries['cluster_list_volumes'];
        if (volumes && volumes.length > 0) {
          params.volume_uuid = volumes[0].uuid;
          console.log(`  ℹ️  Using volume: ${volumes[0].name} (${volumes[0].uuid})`);
        }
        
        // Now get snapshot info
        const snapshots = Array.isArray(resourceData) ? resourceData : [resourceData];
        if (snapshots && snapshots.length > 0 && snapshots[0].name) {
          // Use snapshot_name instead of snapshot_uuid
          params.snapshot_name = snapshots[0].name;
          delete params.snapshot_uuid;  // Remove UUID param, use name
          console.log(`  ℹ️  Using snapshot: ${snapshots[0].name}`);
        } else {
          console.log(`  ⚠️  No snapshots discovered, resourceData:`, JSON.stringify(resourceData).substring(0, 200));
        }
      } else if (tool.name === 'cluster_get_qos_policy') {
        // Need QoS policy UUID
        const policies = Array.isArray(resourceData) ? resourceData : [resourceData];
        if (policies.length > 0 && policies[0].uuid) {
          params.policy_uuid = policies[0].uuid;
          console.log(`  ℹ️  Using QoS policy: ${policies[0].name} (${policies[0].uuid})`);
        }
      } else if (tool.name === 'get_snapshot_policy') {
        // Need snapshot policy NAME (not UUID)
        const policies = Array.isArray(resourceData) ? resourceData : [resourceData];
        if (policies.length > 0) {
          params.policy_name = policies[0].name;  // Use name, not uuid!
          delete params.policy_uuid;  // Remove uuid param
          console.log(`  ℹ️  Using snapshot policy: ${policies[0].name} (${policies[0].uuid})`);
        }
      }
    }
    
    // Call the tool
    const result = await client.callTool(tool.name, params);
    
    // Create golden fixture
    const golden = {
      metadata: {
        tool: tool.name,
        category: tool.category,
        capturedAt: new Date().toISOString(),
        cluster: cluster.name,
        params: params,
        mcpProtocol: '2024-11-05',
        implementation: 'typescript'
      },
      response: result
    };
    
    // Validate it's actually hybrid format
    const parsed = client.parseHybridFormat(result);
    if (!parsed.isHybrid) {
      console.log(`  ⚠️  Warning: ${tool.name} doesn't return hybrid format`);
    } else {
      console.log(`  ✅ Captured hybrid response (${parsed.data ? 'with data' : 'no data'})`);
    }
    
    return golden;
    
  } catch (error) {
    if (tool.optional) {
      console.log(`  ⚠️  Optional tool failed (expected): ${error.message}`);
      return null;
    }
    console.error(`  ❌ Failed to capture ${tool.name}: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('🌟 Capturing Golden Responses from TypeScript MCP Server\n');
  console.log(`Server: http://localhost:${TS_SERVER_PORT}`);
  console.log(`Output: ${GOLDEN_DIR}\n`);
  
  // Ensure output directory exists
  mkdirSync(GOLDEN_DIR, { recursive: true });
  
  // Connect to TypeScript server
  const client = new McpTestClient(`http://localhost:${TS_SERVER_PORT}`);
  
  try {
    await client.initialize();
    console.log('✅ Connected to TypeScript MCP server\n');
    
    // Get cluster info
    const cluster = await getCluster(client);
    
    // Track discovered resources across tools
    const discoveries = {};
    
    // Capture responses for all tools
    let captured = 0;
    let skipped = 0;
    
    for (const tool of HYBRID_TOOLS) {
      const golden = await captureToolResponse(client, tool, cluster, discoveries);
      
      if (golden) {
        // Save to file
        const filename = `${tool.name}.json`;
        const filepath = join(GOLDEN_DIR, filename);
        writeFileSync(filepath, JSON.stringify(golden, null, 2), 'utf8');
        console.log(`  💾 Saved: ${filename}`);
        captured++;
      } else {
        skipped++;
      }
    }
    
    console.log(`\n✅ Capture complete!`);
    console.log(`   📸 Captured: ${captured} tools`);
    console.log(`   ⏭️  Skipped: ${skipped} tools (optional/no data)`);
    console.log(`   📁 Location: ${GOLDEN_DIR}`);
    console.log(`\nThese golden responses can now be used to validate the Go implementation.`);
    
  } catch (error) {
    console.error(`\n❌ Capture failed: ${error.message}`);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
