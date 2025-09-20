#!/usr/bin/env node

/**
 * Comprehensive Enhanced Tools Test Suite
 */

const CLUSTER = 'julia-vsim-1';

const TESTS = [
  // Core cluster management
  { name: 'list_registered_clusters', params: {}, group: 'Cluster Management' },
  
  // Snapshot policy tools
  { name: 'list_snapshot_policies', params: { cluster_name: CLUSTER }, group: 'Snapshot Policies' },
  { name: 'get_snapshot_policy', params: { cluster_name: CLUSTER, policy_name: 'default' }, group: 'Snapshot Policies' },
  { name: 'get_snapshot_policy', params: { cluster_name: CLUSTER, policy_name: 'none' }, group: 'Snapshot Policies' },
  
  // Export policy tools  
  { name: 'list_export_policies', params: { cluster_name: CLUSTER }, group: 'Export Policies' },
  
  // Multi-cluster tools
  { name: 'cluster_list_volumes', params: { cluster_name: CLUSTER }, group: 'Multi-Cluster' },
  { name: 'cluster_list_svms', params: { cluster_name: CLUSTER }, group: 'Multi-Cluster' },
  { name: 'cluster_list_aggregates', params: { cluster_name: CLUSTER }, group: 'Multi-Cluster' },
];

async function testTool(test) {
  try {
    const response = await fetch(`http://localhost:3000/api/tools/${test.name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test.params)
    });
    
    const result = await response.json();
    const text = result.content?.[0]?.text || '';
    
    if (text.includes('❌ Error') || text.includes('HTTP 400') || text.includes('HTTP 500')) {
      return { success: false, error: text.substring(0, 150) + '...' };
    }
    
    if (text.includes('Error:') && !text.includes('No ')) {
      return { success: false, error: text.substring(0, 150) + '...' };
    }
    
    return { success: true, response: text.substring(0, 100) + '...' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runComprehensiveTests() {
  console.log('🧪 NetApp ONTAP Enhanced Tools - Comprehensive Test Suite');
  console.log('=========================================================\n');
  
  const results = { total: 0, passed: 0, failed: 0 };
  const groupResults = {};
  
  for (const test of TESTS) {
    if (!groupResults[test.group]) {
      groupResults[test.group] = { passed: 0, failed: 0, tests: [] };
    }
    
    process.stdout.write(`Testing ${test.name}... `);
    const result = await testTool(test);
    
    results.total++;
    groupResults[test.group].tests.push({ ...test, result });
    
    if (result.success) {
      console.log('✅ PASS');
      results.passed++;
      groupResults[test.group].passed++;
    } else {
      console.log('❌ FAIL');
      console.log(`   ${result.error}\n`);
      results.failed++;
      groupResults[test.group].failed++;
    }
  }
  
  console.log('\n=========================================================');
  console.log('📊 TEST RESULTS BY CATEGORY');
  console.log('=========================================================');
  
  for (const [group, data] of Object.entries(groupResults)) {
    const total = data.passed + data.failed;
    const rate = total > 0 ? Math.round((data.passed / total) * 100) : 0;
    console.log(`${group}: ${data.passed}/${total} passed (${rate}%)`);
  }
  
  console.log('\n=========================================================');
  console.log(`OVERALL: ${results.passed}/${results.total} tests passed`);
  
  if (results.failed === 0) {
    console.log('�� All enhanced tools are working correctly!');
  } else {
    console.log(`⚠️  ${results.failed} tools need attention`);
  }
}

runComprehensiveTests().catch(console.error);
