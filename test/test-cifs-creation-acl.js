#!/usr/bin/env node

import { OntapApiClient } from '../build/ontap-client.js';
import fs from 'fs';

async function testCifsCreationWithAcl() {
  console.log('🧪 Testing CIFS Share Creation with ACLs during creation...\n');

  try {
    // Load cluster config
    const clusters = JSON.parse(fs.readFileSync('./test/clusters.json', 'utf8'));
    const clusterName = Object.keys(clusters)[0];
    const cluster = clusters[clusterName];
    
    console.log(`📡 Connecting to cluster: ${cluster.cluster_ip}`);
    const client = new OntapApiClient(cluster.cluster_ip, cluster.username, cluster.password);

    // Get the first SVM
    const svms = await client.listSvms();
    const svm = svms.find(s => s.name !== 'Cluster');
    if (!svm) {
      throw new Error('No data SVM found');
    }
    console.log(`📁 Using SVM: ${svm.name}`);

    // Clean up any existing test share
    const shareName = 'acl-creation-test';
    try {
      console.log(`🗑️ Cleaning up existing share: ${shareName}`);
      await client.deleteCifsShare({
        name: shareName,
        svm_name: svm.name
      });
      console.log('✅ Existing share deleted');
    } catch (error) {
      console.log('ℹ️ No existing share to delete');
    }

    // Get a volume to use
    const volumes = await client.listVolumes('vs0');
    const volume = volumes.find(v => v.state === 'online' && v.type === 'rw');
    if (!volume) {
      throw new Error('No suitable volume found');
    }
    console.log(`💾 Using volume: ${volume.name}`);

    // Create CIFS share with ACLs during creation
    console.log('\n📝 Creating CIFS share with ACLs during creation...');
    const shareConfig = {
      name: shareName,
      path: '/',
      svm_name: svm.name,
      comment: 'Test share with ACL during creation',
      access_control: [
        {
          permission: 'full_control',
          user_or_group: 'Everyone',
          type: 'windows'
        },
        {
          permission: 'read',
          user_or_group: 'Domain Users',
          type: 'windows'
        }
      ]
    };

    const result = await client.createCifsShare(shareConfig);
    console.log('✅ Share created successfully:', result);

    // Verify the share was created with ACLs
    console.log('\n🔍 Verifying share with ACLs...');
    const shareInfo = await client.getCifsShare(shareName, svm.name);
    console.log('📋 Share info:', JSON.stringify(shareInfo, null, 2));

    // Clean up
    console.log('\n🗑️ Cleaning up...');
    await client.deleteCifsShare({
      name: shareName,
      svm_name: svm.name
    });
    console.log('✅ Test share deleted');

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
    process.exit(1);
  }
}

testCifsCreationWithAcl().catch(console.error);