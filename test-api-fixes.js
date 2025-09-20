#!/usr/bin/env node

/**
 * Quick API validation test for the fixed tools
 */

const TEST_TOOLS = [
  { name: 'list_snapshot_policies', params: { cluster_name: 'julia-vsim-1' } },
  { name: 'list_export_policies', params: { cluster_name: 'julia-vsim-1' } },
  { name: 'cluster_list_volumes', params: { cluster_name: 'julia-vsim-1' } }
];

async function testTool(toolName, params) {
  try {
    const response = await fetch('http://localhost:3000/api/tools/' + toolName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    const text = result.content?.[0]?.text || '';
    
    if (text.includes('❌ Error') || text.includes('HTTP 400')) {
      return { success: false, error: text.substring(0, 200) + '...' };
    }
    return { success: true, response: 'API call successful' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Testing API Fixes...\n');
  
  for (const test of TEST_TOOLS) {
    process.stdout.write(`${test.name}... `);
    const result = await testTool(test.name, test.params);
    
    if (result.success) {
      console.log('✅ PASS');
    } else {
      console.log('❌ FAIL');
      console.log(`   ${result.error}\n`);
    }
  }
}

runTests().catch(console.error);
