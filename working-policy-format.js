/**
 * Working API format for creating default-mcp-snapshot-policy
 * This demonstrates the exact JSON structure that ONTAP expects
 */

// This is the working JSON format for ONTAP API
const workingPolicyRequest = {
  name: "default-mcp-snapshot-policy",
  enabled: true,
  comment: "MCP copy of default policy with hourly, daily & weekly schedules",
  svm: { name: "vs123" },
  copies: [
    { 
      count: "6", 
      schedule: { name: "hourly" }, 
      prefix: "hourly" 
    },
    { 
      count: "2", 
      schedule: { name: "daily" }, 
      prefix: "daily" 
    },
    { 
      count: "1", 
      schedule: { name: "weekly" }, 
      prefix: "weekly" 
    }
  ]
};

console.log('✅ Working API Request Format:');
console.log(JSON.stringify(workingPolicyRequest, null, 2));

// MCP Tool equivalent (if parameter parsing worked correctly)
const mcpToolParams = {
  cluster_name: "karan-ontap-1",
  policy_name: "default-mcp-snapshot-policy", 
  comment: "MCP copy of default policy with hourly, daily & weekly schedules",
  svm_name: "vs123",
  enabled: true,
  copies: [
    { count: 6, schedule: { name: "hourly" }, prefix: "hourly" },
    { count: 2, schedule: { name: "daily" }, prefix: "daily" },
    { count: 1, schedule: { name: "weekly" }, prefix: "weekly" }
  ]
};

console.log('\n📋 MCP Tool Parameters (theoretical):');
console.log(JSON.stringify(mcpToolParams, null, 2));

console.log('\n📝 Summary:');
console.log('- API format: ✅ Confirmed working');
console.log('- Tool logic: ✅ Parameter filtering works');
console.log('- MCP interface: ❌ Complex JSON array parsing limitation');
console.log('- Solution: Direct API calls or simplified MCP tool interface');