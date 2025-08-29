#!/usr/bin/env node

import { OntapApiClient } from './build/ontap-client.js';

const clusters = [
  {
    name: "greg-vsim-1",
    cluster_ip: "10.193.184.184",
    username: "admin",
    password: "Netapp1!"
  },
  {
    name: "julia-vsim-1", 
    cluster_ip: "10.193.77.89",
    username: "admin",
    password: "Netapp1!"
  },
  {
    name: "julia-vsim-2",
    cluster_ip: "10.61.183.200",
    username: "admin", 
    password: "!nT3r$1gH+ K1ouD"
  }
];

async function checkAggregates() {
  console.log('Checking aggregates across all clusters...\n');
  
  let totalAggregates = 0;
  
  for (const cluster of clusters) {
    try {
      console.log(`\n--- ${cluster.name} (${cluster.cluster_ip}) ---`);
      const client = new OntapApiClient(cluster.cluster_ip, cluster.username, cluster.password);
      
      const aggregates = await client.listAggregates();
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

checkAggregates().catch(console.error);
