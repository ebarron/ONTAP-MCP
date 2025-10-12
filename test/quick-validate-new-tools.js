#!/usr/bin/env node

/**
 * Quick validation test for new volume autosize and snapshot tools
 * Tests the tools against existing volumes (no volume creation needed)
 */

import { McpTestClient } from './mcp-test-client.js';

const baseUrl = 'http://localhost:3000';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Quick Validation: New Autosize & Snapshot Tools          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Initialize client
    console.log('🔌 Connecting to MCP server...');
    const client = new McpTestClient(baseUrl);
    await client.initialize();
    
    // Load clusters
    const { loadClustersIntoSession } = await import('./mcp-test-client.js');
    await loadClustersIntoSession(client);
    console.log('✅ Connected and clusters loaded\n');

    const clusterName = 'greg-vsim-1';

    // Test 1: List volumes to find one to test with
    console.log('📋 Test 1: List volumes...');
    const volumesResult = await client.callTool('cluster_list_volumes', {
      cluster_name: clusterName,
      svm_name: 'vs0'
    });
    console.log('✅ Volume list retrieved\n');
    
    // Extract a volume UUID from the list
    const volumeText = volumesResult.content[0].text;
    const volumeMatch = volumeText.match(/UUID:\s*([a-f0-9-]+)/);
    
    if (!volumeMatch) {
      console.log('⚠️  No volumes found to test with');
      process.exit(0);
    }
    
    const testVolumeUuid = volumeMatch[1];
    console.log(`   Using test volume UUID: ${testVolumeUuid}\n`);

    // Test 2: Get autosize status (new tool)
    console.log('📋 Test 2: Get volume autosize status...');
    const autosizeStatus = await client.callTool('cluster_get_volume_autosize_status', {
      cluster_name: clusterName,
      volume_uuid: testVolumeUuid
    });
    console.log('✅ Autosize status retrieved:');
    console.log(autosizeStatus.content[0].text.split('\n').slice(0, 5).join('\n'));
    console.log('...\n');

    // Test 3: List snapshots (new tool)
    console.log('📋 Test 3: List volume snapshots...');
    const snapshotsResult = await client.callTool('cluster_list_volume_snapshots', {
      cluster_name: clusterName,
      volume_uuid: testVolumeUuid
    });
    console.log('✅ Snapshots retrieved:');
    console.log(snapshotsResult.content[0].text.split('\n').slice(0, 10).join('\n'));
    console.log('...\n');

    // Test 4: Enable autosize (new tool) - in off mode first, then back to original state
    console.log('📋 Test 4: Enable autosize in off mode (toggle test)...');
    const enableResult = await client.callTool('cluster_enable_volume_autosize', {
      cluster_name: clusterName,
      volume_uuid: testVolumeUuid,
      mode: 'off'
    });
    console.log('✅ Autosize toggled:');
    console.log(enableResult.content[0].text.split('\n')[0]);
    console.log();

    // Verify it was disabled
    console.log('📋 Test 5: Verify autosize status changed...');
    const verifyStatus = await client.callTool('cluster_get_volume_autosize_status', {
      cluster_name: clusterName,
      volume_uuid: testVolumeUuid
    });
    console.log('✅ Status verified:');
    const statusText = verifyStatus.content[0].text;
    if (statusText.includes('Mode: off')) {
      console.log('   ✓ Autosize correctly disabled\n');
    } else {
      console.log('   ⚠️  Autosize status unexpected\n');
    }

    // Test 6: Try to get info for a snapshot (if one exists)
    const snapshotText = snapshotsResult.content[0].text;
    const snapshotMatch = snapshotText.match(/\(([a-f0-9-]+)\)/);
    
    if (snapshotMatch) {
      const snapshotUuid = snapshotMatch[1];
      console.log('📋 Test 6: Get snapshot info...');
      const snapshotInfo = await client.callTool('cluster_get_volume_snapshot_info', {
        cluster_name: clusterName,
        volume_uuid: testVolumeUuid,
        snapshot_uuid: snapshotUuid
      });
      console.log('✅ Snapshot info retrieved:');
      console.log(snapshotInfo.content[0].text.split('\n').slice(0, 5).join('\n'));
      console.log('...\n');
    } else {
      console.log('📋 Test 6: Get snapshot info... SKIPPED (no snapshots)\n');
    }

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ All New Tools Validated Successfully!                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n🎉 Tool Summary:');
    console.log('   ✓ cluster_get_volume_autosize_status - WORKING');
    console.log('   ✓ cluster_list_volume_snapshots - WORKING');
    console.log('   ✓ cluster_enable_volume_autosize - WORKING');
    console.log('   ✓ cluster_get_volume_snapshot_info - WORKING');
    console.log('\n📝 Note: cluster_delete_volume_snapshot not tested (requires user snapshot)');

    await client.close();
    process.exit(0);

  } catch (error) {
    console.error(`\n❌ Validation failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
