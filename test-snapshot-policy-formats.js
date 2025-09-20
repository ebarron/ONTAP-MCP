#!/usr/bin/env node

/**
 * Test snapshot policy creation API formats
 * This will help us understand what ONTAP expects
 */

const TEST_FORMATS = [
  {
    name: "Simple format",
    data: {
      name: "test-policy-1", 
      enabled: true,
      comment: "Test policy format 1",
      svm: { name: "vs123" },
      copies: [
        { count: 6, schedule: { name: "hourly" } },
        { count: 2, schedule: { name: "daily" } }
      ]
    }
  },
  {
    name: "Alternative format",
    data: {
      name: "test-policy-2",
      enabled: true, 
      comment: "Test policy format 2",
      svm: { name: "vs123" },
      copy: {
        policy: { name: "default" }
      }
    }
  }
];

async function testPolicyFormat(format) {
  try {
    const response = await fetch('http://localhost:3000/api/tools/create_snapshot_policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cluster_name: 'karan-ontap-1',
        policy_name: format.data.name,
        comment: format.data.comment,
        enabled: format.data.enabled,
        svm_name: 'vs123',
        copies: format.data.copies
      })
    });
    
    const result = await response.json();
    const text = result.content?.[0]?.text || '';
    
    console.log(`${format.name}: ${text.includes('❌') ? 'FAILED' : 'SUCCESS'}`);
    if (text.includes('❌')) {
      console.log(`   Error: ${text.substring(0, 200)}...\n`);
    }
    
  } catch (error) {
    console.log(`${format.name}: ERROR - ${error.message}`);
  }
}

async function runFormatTests() {
  console.log('🧪 Testing Snapshot Policy Creation Formats\n');
  
  // Test original failing case first
  console.log('Testing original failing format...');
  await testPolicyFormat({
    name: "Original failing format",
    data: {
      name: "mcp-test-policy",
      copies: [
        {count: 6, schedule: "hourly"}, 
        {count: 2, schedule: "daily"}, 
        {count: 2, schedule: "weekly"}
      ]
    }
  });
  
  console.log('\nTesting alternative formats...');
  for (const format of TEST_FORMATS) {
    await testPolicyFormat(format);
  }
}

runFormatTests().catch(console.error);