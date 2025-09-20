const params = { cluster_name: "test", svm_name: "vs1", enabled: true };

// Filter out MCP-specific parameters and only pass ONTAP API parameters
const apiParams = {};
if (params.svm_name) apiParams['svm.name'] = params.svm_name;
if (params.policy_name_pattern) apiParams['name'] = params.policy_name_pattern;
if (params.enabled !== undefined) apiParams['enabled'] = params.enabled;

console.log('Original params:', params);
console.log('Filtered apiParams:', apiParams);
console.log('Should cluster_name be in apiParams?', 'cluster_name' in apiParams);