#!#!/usr/bin/env node

/**
 * NetApp ONTAP Aggregates Checker
 * Fetches and displays aggregate information from all registered clusters
 * Uses the MCP server's HTTP API to get cluster configuration
 */

import { setTimeout as sleep } from 'timers/promises';

// Get clusters from the MCP server via HTTP API
async function getClustersFromServer(httpPort = 3000) {
  try {
    const response = await fetch(`http://localhost:${httpPort}/api/tools/list_registered_clusters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Parse the response from the tool
    if (result.content && result.content[0] && result.content[0].text) {
      const text = result.content[0].text;
      
      // If no clusters, return empty array
      if (text.includes('No clusters registered')) {
        return [];
      }
      
      // Extract cluster info from the text response
      const lines = text.split('\n');
      const clusters = [];
      
      for (const line of lines) {
        if (line.trim().startsWith('- ')) {
          const match = line.match(/- ([^:]+): ([^\s]+) \(([^)]*)\)/);
          if (match) {
            clusters.push({
              name: match[1].trim(),
              cluster_ip: match[2].trim(),
              description: match[3].trim()
            });
          }
        }
      }
      
      return clusters;
    }
    
    throw new Error('Unexpected response format');
  } catch (error) {
    throw new Error(`Failed to get clusters from MCP server: ${error.message}`);
  }
}

// Call MCP server HTTP API
async function callMcpTool(toolName, args, httpPort = 3000) {
  try {
    const response = await fetch(`http://localhost:${httpPort}/api/tools/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.content && result.content[0] && result.content[0].text) {
      // For aggregates, parse the response to extract the actual data
      const text = result.content[0].text;
      const lines = text.split('\n');
      const aggregates = [];
      
      for (const line of lines) {
        if (line.trim().startsWith('- ') && line.includes('State:')) {
          // Parse aggregate line: "- aggr1 (uuid) - State: online, Available: 1.5TB, Used: 500GB"
          const match = line.match(/- ([^\s]+) \([^)]+\) - State: ([^,]+), Available: ([^,]+), Used: (.+)/);
          if (match) {
            aggregates.push({
              name: match[1],
              state: match[2],
              space: {
                block_storage: {
                  available: match[3],
                  used: match[4]
                }
              }
            });
          }
        }
      }
      
      return aggregates;
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to call MCP tool ${toolName}: ${error.message}`);
  }
}

async function checkAggregates() {
  const clusters = await getClustersFromServer();
  
  console.log('Checking aggregates across all configured clusters...\n');
  console.log(`Found ${clusters.length} cluster(s) in configuration`);
  
  let totalAggregates = 0;
  
  for (const cluster of clusters) {
    try {
      console.log(`\n--- ${cluster.name} (${cluster.cluster_ip}) ---`);
      
      const aggregates = await callMcpTool('cluster_list_aggregates', {
        cluster_name: cluster.name
      });
      
      console.log(`Aggregates found: ${aggregates.length}`);
      
      aggregates.forEach((aggr, index) => {
        const available = aggr.space?.block_storage?.available || 'N/A';
        const used = aggr.space?.block_storage?.used || 'N/A';
        const size = aggr.space?.block_storage?.size || 'N/A';
        console.log(`  ${index + 1}. ${aggr.name} - State: ${aggr.state}, Size: ${size}, Available: ${available}, Used: ${used}`);
      });
      
      totalAggregates += aggregates.length;
      
    } catch (error) {
      console.log(`ERROR connecting to ${cluster.name}: ${error.message}`);
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total aggregates across all clusters: ${totalAggregates}`);
}

// Start the HTTP server for testing
async function startHttpServer() {
  const { spawn } = await import('child_process');
  
  // Use the same cluster configuration that's in the MCP JSON (new object format)
  const clustersEnv = JSON.stringify({
    "greg-vsim-1": {
      "cluster_ip": "10.193.184.184",
      "username": "admin",
      "password": "Netapp1!",
      "description": "Gregs vSim ONTAP cluster"
    },
    "julia-vsim-1": {
      "cluster_ip": "10.193.77.89",
      "username": "admin",
      "password": "Netapp1!",
      "description": "Julias first vSim ONTAP cluster"
    },
    "julia-vsim-2": {
      "cluster_ip": "10.61.183.200",
      "username": "admin",
      "password": "!nT3r$1gH+ K1ouD",
      "description": "Julias second vSim cluster"
    }
  });
  
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['build/index.js', '--http=3000'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ONTAP_CLUSTERS: clustersEnv
      }
    });

    server.stdout.on('data', (data) => {
      // Just log for debugging
    });

    server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('NetApp ONTAP MCP Server running on HTTP port')) {
        // Wait a moment for server to fully initialize
        setTimeout(() => resolve(server), 1000);
      }
    });

    server.on('error', reject);

    // Timeout after 10 seconds
    setTimeout(() => {
      reject(new Error('Server failed to start within 10 seconds'));
    }, 10000);
  });
}

// Main execution
async function main() {
  console.log('🚀 Starting NetApp ONTAP Aggregates Checker...');
  
  let server;
  try {
    console.log('Starting MCP HTTP server...');
    server = await startHttpServer();
    
    // Wait a bit for server to fully initialize
    await sleep(2000);
    
    await checkAggregates();
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    if (server) {
      console.log('\n🛑 Stopping HTTP server...');
      server.kill();
    }
  }
}

main().catch(console.error);
