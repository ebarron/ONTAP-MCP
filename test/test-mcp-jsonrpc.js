#!/usr/bin/env node

/**
 * Test MCP JSON-RPC 2.0 Compliance
 * 
 * This script tests the new /mcp endpoint to ensure it follows
 * proper JSON-RPC 2.0 specification for MCP protocol compliance.
 */

import http from 'http';

const MCP_URL = 'http://localhost:3000/mcp';

function makeJsonRpcRequest(method, params = null, id = 1) {
  const requestData = JSON.stringify({
    jsonrpc: '2.0',
    method: method,
    params: params,
    id: id
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: response });
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(requestData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing MCP JSON-RPC 2.0 Compliance');
  console.log('=====================================\n');

  let testCount = 0;
  let passCount = 0;

  // Test helper
  function test(name, condition) {
    testCount++;
    if (condition) {
      console.log(`✅ Test ${testCount}: ${name}`);
      passCount++;
    } else {
      console.log(`❌ Test ${testCount}: ${name}`);
    }
  }

  try {
    // Test 1: tools/list method
    console.log('Testing tools/list method...');
    const listResponse = await makeJsonRpcRequest('tools/list');
    
    test('tools/list returns 200 status', listResponse.statusCode === 200);
    test('tools/list has jsonrpc field', listResponse.body.jsonrpc === '2.0');
    test('tools/list has id field', listResponse.body.id === 1);
    test('tools/list has result field', listResponse.body.result !== undefined);
    test('tools/list result has tools array', Array.isArray(listResponse.body.result?.tools));
    
    const toolsCount = listResponse.body.result?.tools?.length || 0;
    test(`tools/list returns expected tool count (${toolsCount} >= 40)`, toolsCount >= 40);

    // Test 2: tools/call method with valid tool
    console.log('\nTesting tools/call method...');
    const callResponse = await makeJsonRpcRequest('tools/call', {
      name: 'list_registered_clusters',
      arguments: {}
    });
    
    test('tools/call returns 200 status', callResponse.statusCode === 200);
    test('tools/call has jsonrpc field', callResponse.body.jsonrpc === '2.0');
    test('tools/call has id field', callResponse.body.id === 1);
    test('tools/call has result field', callResponse.body.result !== undefined);
    test('tools/call result has content array', Array.isArray(callResponse.body.result?.content));

    // Test 3: Invalid JSON-RPC version
    console.log('\nTesting invalid JSON-RPC version...');
    const invalidVersionResponse = await makeJsonRpcRequest('tools/list');
    invalidVersionResponse.body.jsonrpc = '1.0'; // Simulate invalid version
    
    const badVersionRequest = await makeJsonRpcRequest('tools/list').catch(() => ({
      statusCode: 200,
      body: { jsonrpc: '2.0', id: 1, error: { code: -32600 } }
    }));

    // Test 4: Invalid method
    console.log('\nTesting invalid method...');
    const invalidMethodResponse = await makeJsonRpcRequest('invalid/method');
    
    test('Invalid method returns JSON-RPC error', invalidMethodResponse.body.error !== undefined);
    test('Invalid method error code is -32601', invalidMethodResponse.body.error?.code === -32601);

    // Test 5: Missing tool name in tools/call
    console.log('\nTesting missing tool name...');
    const missingToolResponse = await makeJsonRpcRequest('tools/call', { arguments: {} });
    
    test('Missing tool name returns error', missingToolResponse.body.error !== undefined);
    test('Missing tool name error code is -32602', missingToolResponse.body.error?.code === -32602);

    // Test 6: Non-existent tool
    console.log('\nTesting non-existent tool...');
    const nonExistentToolResponse = await makeJsonRpcRequest('tools/call', {
      name: 'non_existent_tool',
      arguments: {}
    });
    
    test('Non-existent tool returns error', nonExistentToolResponse.body.error !== undefined);
    test('Non-existent tool error code is -32601', nonExistentToolResponse.body.error?.code === -32601);

    // Summary
    console.log('\n📊 Test Results');
    console.log('================');
    console.log(`Passed: ${passCount}/${testCount} tests`);
    
    if (passCount === testCount) {
      console.log('🎉 All tests passed! MCP JSON-RPC 2.0 compliance verified.');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Check implementation.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test suite failed with error:', error.message);
    console.error('\n💡 Make sure the MCP server is running with:');
    console.error('   export ONTAP_CLUSTERS=\'[{"name":"test","cluster_ip":"127.0.0.1","username":"admin","password":"pass"}]\'');
    console.error('   node build/index.js --http=3000');
    process.exit(1);
  }
}

runTests();