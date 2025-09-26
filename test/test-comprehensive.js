#!/usr/bin/env node

/**
 * Comprehensive Enhanced Tools Test Suite
 */

const CLUSTER = 'julia-vsim-1';

// MCP JSON-RPC 2.0 helper function
async function callMcpTool(toolName, args, httpPort = 3000) {
  const url = `http://localhost:${httpPort}/mcp`;
  
  const jsonrpcRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    },
    id: Date.now()
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jsonrpcRequest),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const jsonrpcResponse = await response.json();
  
  // Handle JSON-RPC errors
  if (jsonrpcResponse.error) {
    throw new Error(`JSON-RPC Error ${jsonrpcResponse.error.code}: ${jsonrpcResponse.error.message}${jsonrpcResponse.error.data ? ` - ${jsonrpcResponse.error.data}` : ''}`);
  }

  // Return the result in the same format as REST API for compatibility
  return jsonrpcResponse.result;
}

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
    const result = await callMcpTool(test.name, test.params);
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
