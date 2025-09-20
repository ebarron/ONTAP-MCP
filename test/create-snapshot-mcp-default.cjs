#!/usr/bin/env node

/**
 * Create snapshot-mcp-default policy using direct API call
 */

const https = require('https');

const cluster_ip = '10.196.61.123';
const username = 'admin';
const password = 'Netapp1!';

const policyData = {
  name: "default-mcp-snapshot-policy",
  enabled: true,
  comment: "MCP copy of default policy with hourly, daily & weekly copies",
  svm: { name: "vs123" },
  copies: [
    { count: "6", schedule: { name: "hourly" }, prefix: "hourly" },
    { count: "2", schedule: { name: "daily" }, prefix: "daily" },
    { count: "1", schedule: { name: "weekly" }, prefix: "weekly" }
  ]
};

console.log('Creating policy with data:', JSON.stringify(policyData, null, 2));

const auth = Buffer.from(`${username}:${password}`).toString('base64');

const options = {
  hostname: cluster_ip,
  port: 443,
  path: '/api/storage/snapshot-policies',
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  rejectUnauthorized: false
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(JSON.stringify(policyData));
req.end();