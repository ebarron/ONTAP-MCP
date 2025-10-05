#!/usr/bin/env node
/**
 * Test Session-Scoped Cluster Isolation
 * 
 * Validates that:
 * 1. Clusters added to one session are not visible to another session
 * 2. list_registered_clusters only shows clusters in the current session
 * 3. Cluster operations (list_volumes, list_svms) cannot access clusters from other sessions
 * 4. Each session maintains completely isolated cluster registries
 */

import { McpTestClient } from './mcp-test-client.js';

async function testSessionIsolation() {
    console.log('\n=== Testing Session-Scoped Cluster Isolation ===\n');
    
    // Create two independent MCP sessions
    console.log('📡 Creating Session A...');
    const sessionA = new McpTestClient('http://localhost:3000');
    await sessionA.initialize();
    console.log(`✅ Session A ID: ${sessionA.sessionId}\n`);
    
    console.log('📡 Creating Session B...');
    const sessionB = new McpTestClient('http://localhost:3000');
    await sessionB.initialize();
    console.log(`✅ Session B ID: ${sessionB.sessionId}\n`);
    
    // Add a unique cluster to Session A only
    const testClusterA = {
        name: `session-a-test-${Date.now()}`,
        cluster_ip: '10.193.49.74',
        username: 'admin',
        password: 'Netapp1!',
        description: 'Session A Test Cluster'
    };
    
    console.log(`🔧 Adding cluster to Session A: ${testClusterA.name}`);
    const addResultA = await sessionA.callTool('add_cluster', testClusterA);
    console.log('Session A add_cluster result:', addResultA.content[0].text);
    
    // List clusters in Session A - should see the new cluster
    console.log('\n📋 Listing clusters in Session A...');
    const listA1 = await sessionA.callTool('list_registered_clusters', {});
    const clustersA1 = parseClusterList(listA1.content[0].text);
    console.log(`Session A sees ${clustersA1.length} cluster(s):`);
    clustersA1.forEach(c => console.log(`  - ${c.name}`));
    
    const sessionAHasTestCluster = clustersA1.some(c => c.name === testClusterA.name);
    console.log(`\n✅ Session A can see its own cluster: ${sessionAHasTestCluster}`);
    
    // List clusters in Session B - should NOT see Session A's cluster
    console.log('\n📋 Listing clusters in Session B...');
    const listB1 = await sessionB.callTool('list_registered_clusters', {});
    const clustersB1 = parseClusterList(listB1.content[0].text);
    console.log(`Session B sees ${clustersB1.length} cluster(s):`);
    clustersB1.forEach(c => console.log(`  - ${c.name}`));
    
    const sessionBHasTestCluster = clustersB1.some(c => c.name === testClusterA.name);
    console.log(`\n✅ Session B CANNOT see Session A's cluster: ${!sessionBHasTestCluster}`);
    
    // Add a different cluster to Session B
    const testClusterB = {
        name: `session-b-test-${Date.now()}`,
        cluster_ip: '10.193.49.74',
        username: 'admin',
        password: 'Netapp1!',
        description: 'Session B Test Cluster'
    };
    
    console.log(`\n🔧 Adding cluster to Session B: ${testClusterB.name}`);
    const addResultB = await sessionB.callTool('add_cluster', testClusterB);
    console.log('Session B add_cluster result:', addResultB.content[0].text);
    
    // Verify Session A doesn't see Session B's cluster
    console.log('\n📋 Re-listing clusters in Session A...');
    const listA2 = await sessionA.callTool('list_registered_clusters', {});
    const clustersA2 = parseClusterList(listA2.content[0].text);
    const sessionAHasSessionBCluster = clustersA2.some(c => c.name === testClusterB.name);
    console.log(`Session A sees ${clustersA2.length} cluster(s)`);
    console.log(`✅ Session A CANNOT see Session B's cluster: ${!sessionAHasSessionBCluster}`);
    
    // Verify Session B doesn't see Session A's cluster
    console.log('\n📋 Re-listing clusters in Session B...');
    const listB2 = await sessionB.callTool('list_registered_clusters', {});
    const clustersB2 = parseClusterList(listB2.content[0].text);
    const sessionBHasSessionACluster = clustersB2.some(c => c.name === testClusterA.name);
    console.log(`Session B sees ${clustersB2.length} cluster(s)`);
    console.log(`✅ Session B CANNOT see Session A's cluster: ${!sessionBHasSessionACluster}`);
    
    // Test 5: Verify cluster operations respect session isolation
    console.log('\n=== Testing Cluster Operations Respect Session Isolation ===');
    
    // Try to list volumes from Session A's cluster using Session B (should fail)
    console.log(`\n🔍 Session B attempting to list volumes from Session A's cluster...`);
    try {
        const volumeResult = await sessionB.callTool('cluster_list_volumes', {
            cluster_name: testClusterA.name
        });
        const volumeText = sessionB.parseContent(volumeResult);
        
        if (volumeText.includes('not found in registry') || volumeText.includes('not found')) {
            console.log('✅ Session B correctly DENIED access to Session A\'s cluster');
            console.log(`   Error message: ${volumeText.substring(0, 100)}...`);
        } else {
            console.log('❌ Session B incorrectly accessed Session A\'s cluster!');
            console.log(`   Response: ${volumeText.substring(0, 100)}...`);
            process.exit(1);
        }
    } catch (error) {
        console.log('✅ Session B correctly DENIED access to Session A\'s cluster');
        console.log(`   Error: ${error.message.substring(0, 100)}...`);
    }
    
    // Try to list SVMs from Session B's cluster using Session A (should fail)
    console.log(`\n🔍 Session A attempting to list SVMs from Session B's cluster...`);
    try {
        const svmResult = await sessionA.callTool('cluster_list_svms', {
            cluster_name: testClusterB.name
        });
        const svmText = sessionA.parseContent(svmResult);
        
        if (svmText.includes('not found in registry') || svmText.includes('not found')) {
            console.log('✅ Session A correctly DENIED access to Session B\'s cluster');
            console.log(`   Error message: ${svmText.substring(0, 100)}...`);
        } else {
            console.log('❌ Session A incorrectly accessed Session B\'s cluster!');
            console.log(`   Response: ${svmText.substring(0, 100)}...`);
            process.exit(1);
        }
    } catch (error) {
        console.log('✅ Session A correctly DENIED access to Session B\'s cluster');
        console.log(`   Error: ${error.message.substring(0, 100)}...`);
    }
    
    // Cleanup sessions
    console.log('\n🧹 Cleaning up test sessions...');
    await sessionA.close();
    await sessionB.close();
    console.log('✅ Sessions closed successfully');
    
    // Final verification
    console.log('\n=== Session Isolation Test Results ===');
    
    const allTestsPassed = 
        sessionAHasTestCluster &&           // Session A sees its own cluster
        !sessionBHasTestCluster &&          // Session B doesn't see Session A's cluster
        !sessionAHasSessionBCluster &&      // Session A doesn't see Session B's cluster
        clustersA2.some(c => c.name === testClusterA.name) &&  // Session A still has its cluster
        clustersB2.some(c => c.name === testClusterB.name);    // Session B has its cluster
    
    if (allTestsPassed) {
        console.log('✅ ALL TESTS PASSED - Session isolation working correctly!');
        console.log('   ✓ Each session maintains its own isolated cluster registry');
        console.log('   ✓ Cross-session cluster listing successfully prevented');
        console.log('   ✓ Cross-session cluster operations successfully blocked');
        console.log('   ✓ Sessions cannot access or modify each other\'s clusters');
        process.exit(0);
    } else {
        console.log('❌ TESTS FAILED - Session isolation not working properly');
        console.log('   Details:');
        console.log(`   - Session A sees its own cluster: ${sessionAHasTestCluster}`);
        console.log(`   - Session B cannot see Session A's cluster: ${!sessionBHasTestCluster}`);
        console.log(`   - Session A cannot see Session B's cluster: ${!sessionAHasSessionBCluster}`);
        process.exit(1);
    }
}

/**
 * Parse cluster list from MCP response text
 */
function parseClusterList(text) {
    const clusters = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
        // Pattern: "- cluster-name: 10.1.1.1 (description)"
        const match = line.match(/^-\s+([^:]+):\s+([^\s]+)\s+\(([^)]+)\)/);
        if (match) {
            clusters.push({
                name: match[1].trim(),
                cluster_ip: match[2].trim(),
                description: match[3].trim()
            });
        }
    }
    
    return clusters;
}

// Run the test
testSessionIsolation().catch(error => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
});
