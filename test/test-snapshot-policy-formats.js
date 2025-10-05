#!/usr/bin/env node

/**
 * Test snapshot policy creation API formats using MCP client
 * Uses unique timestamped policy names to avoid conflicts
 */

import { McpTestClient } from './mcp-test-client.js';

// Generate unique test names with timestamp to avoid conflicts
const TEST_RUN_ID = Date.now();

const TEST_FORMATS = [
  {
    name: "Valid format (should succeed)",
    shouldFail: false,
    data: {
      cluster_name: 'karan-ontap-1',
      policy_name: `test_snap_policy_${TEST_RUN_ID}_1`, 
      enabled: true,
      comment: "Test policy format 1",
      svm_name: "vs123",
      copies: [
        { count: 6, schedule: { name: "hourly" } },
        { count: 2, schedule: { name: "daily" } }
      ]
    }
  },
  {
    name: "Invalid format - schedule as string (should fail validation)",
    shouldFail: true,
    expectedError: "Expected object, received string",
    data: {
      cluster_name: 'karan-ontap-1',
      policy_name: `test_snap_policy_${TEST_RUN_ID}_2`,
      svm_name: "vs123",
      copies: [
        {count: 6, schedule: "hourly"},  // Wrong: string instead of object
        {count: 2, schedule: "daily"}, 
        {count: 2, schedule: "weekly"}
      ]
    }
  }
];

async function testPolicyFormat(client, format) {
  try {
    const result = await client.callTool('create_snapshot_policy', format.data);
    const text = client.parseContent(result);
    
    if (format.shouldFail) {
      // Negative test: Should have failed but didn't
      console.log(`${format.name}: ❌ UNEXPECTED SUCCESS (should have failed validation)`);
      return { passed: false, policyName: format.data.policy_name };
    } else {
      // Positive test: Should succeed
      if (text.includes('❌')) {
        console.log(`${format.name}: ❌ FAILED`);
        console.log(`   Error: ${text.substring(0, 200)}...\n`);
        return { passed: false, policyName: format.data.policy_name };
      } else {
        console.log(`${format.name}: ✅ SUCCESS`);
        return { passed: true, policyName: format.data.policy_name };
      }
    }
  } catch (error) {
    if (format.shouldFail) {
      // Negative test: Expected to fail, check if it's the right error
      const errorMsg = error.message;
      if (format.expectedError && errorMsg.includes(format.expectedError)) {
        console.log(`${format.name}: ✅ CORRECTLY REJECTED`);
        console.log(`   Expected error found: "${format.expectedError}"`);
        return { passed: true, policyName: null }; // No policy created
      } else {
        console.log(`${format.name}: ❌ FAILED (wrong error)`);
        console.log(`   Expected: "${format.expectedError}"`);
        console.log(`   Got: ${errorMsg.substring(0, 100)}...\n`);
        return { passed: false, policyName: null };
      }
    } else {
      // Positive test: Unexpected error
      console.log(`${format.name}: ❌ ERROR - ${error.message}`);
      return { passed: false, policyName: format.data.policy_name };
    }
  }
}

async function runFormatTests() {
  console.log('🧪 Testing Snapshot Policy Creation Formats (MCP)\n');
  console.log('📝 Includes both positive and negative validation tests\n');
  
  // Create new session and load clusters
  console.log('🆕 Creating new test session and loading clusters');
  const client = new McpTestClient('http://localhost:3000');
  await client.initialize();
  
  // Load clusters into session
  const { loadClustersIntoSession } = await import('./mcp-test-client.js');
  await loadClustersIntoSession(client);
  
  const createdPolicies = []; // Track only policies WE created
  
  try {
    console.log('✅ MCP client initialized\n');
    
    let passCount = 0;
    
    for (const format of TEST_FORMATS) {
      const result = await testPolicyFormat(client, format);
      if (result.passed) {
        passCount++;
        if (result.policyName) {
          createdPolicies.push(result.policyName);
        }
      }
    }
    
    console.log(`\n✅ Passed: ${passCount}/${TEST_FORMATS.length}`);
    
    // Clean up ONLY the policies we successfully created in this test run
    if (createdPolicies.length > 0) {
      console.log(`\n🧹 Cleaning up ${createdPolicies.length} policies created by this test...`);
      for (const policyName of createdPolicies) {
        try {
          await client.callTool('delete_snapshot_policy', {
            cluster_name: 'karan-ontap-1',
            policy_name: policyName,
            svm_name: 'vs123'
          });
          console.log(`   ✅ Deleted: ${policyName}`);
        } catch (error) {
          console.log(`   ⚠️ Could not delete ${policyName}: ${error.message}`);
        }
      }
    }
    
    await client.close();
    
    process.exit(passCount === TEST_FORMATS.length ? 0 : 1);
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Clean up on error too
    if (createdPolicies.length > 0) {
      console.log(`\n🧹 Emergency cleanup of ${createdPolicies.length} policies...`);
      for (const policyName of createdPolicies) {
        try {
          await client.callTool('delete_snapshot_policy', {
            cluster_name: 'karan-ontap-1',
            policy_name: policyName,
            svm_name: 'vs123'
          });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    
    await client.close();
    process.exit(1);
  }
}

runFormatTests().catch(console.error);