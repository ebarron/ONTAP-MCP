#!/usr/bin/env node

/**
 * NetApp ONTAP API Fields Validation Test
 */

const TEST_TOOLS = [
  { tool: 'list_snapshot_policies', params: { cluster_name: 'julia-vsim-1' } },
  { tool: 'list_export_policies', params: { cluster_name: 'julia-vsim-1' } }
];

async function testTool(tool, params) {
  try {
    const response = await fetch(`http://localhost:3000/api/tools/${tool}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    const text = result.content?.[0]?.text || '';
    
    return text.includes('❌ Error') ? { success: false, error: text } : { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 API Fields Validation\n');
  
  for (const test of TEST_TOOLS) {
    process.stdout.write(`Testing ${test.tool}... `);
    const result = await testTool(test.tool, test.params);
    console.log(result.success ? '✅ PASS' : `❌ FAIL: ${result.error}`);
  }
}

runTests().catch(console.error);
