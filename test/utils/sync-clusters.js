#!/usr/bin/env node

/**
 * Utility to extract cluster configuration from VS Code mcp.json
 * and update the test clusters.json file
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function extractClustersFromMcpJson() {
  const mcpJsonPath = process.env.MCP_JSON_PATH || 
    '/Users/ebarron/Library/Application Support/Code/User/mcp.json';
  
  console.log(`Reading MCP configuration from: ${mcpJsonPath}`);
  
  try {
    const mcpData = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));
    
    // Find the netapp-ontap-mcp server configuration
    const ontapServer = mcpData.servers['netapp-ontap-mcp'];
    if (!ontapServer) {
      throw new Error('netapp-ontap-mcp server not found in mcp.json');
    }
    
    // Extract the ONTAP_CLUSTERS environment variable
    const clustersEnv = ontapServer.env?.ONTAP_CLUSTERS;
    if (!clustersEnv) {
      throw new Error('ONTAP_CLUSTERS not found in netapp-ontap-mcp server configuration');
    }
    
    // Parse the JSON string
    const clusters = JSON.parse(clustersEnv);
    console.log(`Found ${Object.keys(clusters).length} clusters:`, Object.keys(clusters));
    
    // Write to test clusters.json
    const testClustersPath = join(__dirname, 'clusters.json');
    writeFileSync(testClustersPath, JSON.stringify(clusters, null, 2), 'utf8');
    console.log(`✅ Updated test clusters configuration: ${testClustersPath}`);
    
    // Display the clusters for verification
    console.log('\nCluster configuration:');
    for (const [name, config] of Object.entries(clusters)) {
      console.log(`  ${name}: ${config.cluster_ip} (${config.description})`);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// If run directly, execute the function
if (import.meta.url === `file://${process.argv[1]}`) {
  extractClustersFromMcpJson();
}

export { extractClustersFromMcpJson };