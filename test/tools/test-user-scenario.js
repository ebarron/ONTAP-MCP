#!/usr/bin/env node

import { OntapApiClient } from '../../build/ontap-client.js';
import fs from 'fs';

async function testUserScenario() {
  console.log('🎯 Testing Original User Scenario: CIFS Share with Access Control...\n');

  try {
    // Load cluster config
    const clusters = JSON.parse(fs.readFileSync('./test/clusters.json', 'utf8'));
    const clusterName = Object.keys(clusters)[0];
    const cluster = clusters[clusterName];
    
    console.log(`📡 Connecting to cluster: ${cluster.cluster_ip}`);
    const client = new OntapApiClient(cluster.cluster_ip, cluster.username, cluster.password);

    // Test the exact user scenario
    const shareName = 'mcp-test-share';
    const svmName = 'vs0';

    // Clean up any existing share
    try {
      await client.deleteCifsShare({
        name: shareName,
        svm_name: svmName
      });
      console.log('🗑️ Cleaned up existing share');
    } catch (error) {
      console.log('ℹ️ No existing share to delete');
    }

    // Create CIFS share with the exact parameters from user's error
    console.log(`\n📝 Creating CIFS share: ${shareName}`);
    const result = await client.createCifsShare({
      name: shareName,
      path: '/',
      svm_name: svmName,
      comment: 'Test share created via MCP',
      access_control: [
        {
          permission: 'full_control',
          user_or_group: 'Everyone',
          type: 'windows'
        },
        {
          permission: 'change',
          user_or_group: 'BUILTIN\\Administrators',
          type: 'windows'
        },
        {
          permission: 'read',
          user_or_group: 'BUILTIN\\Users',
          type: 'windows'
        }
      ]
    });
    console.log('✅ Share created successfully:', result);

    // Verify the share
    console.log('\n🔍 Verifying share details...');
    const shareInfo = await client.getCifsShare(shareName, svmName);
    console.log('📋 Share created with:');
    console.log(`   Name: ${shareInfo.name}`);
    console.log(`   Path: ${shareInfo.path}`);
    console.log(`   Comment: ${shareInfo.comment}`);
    console.log(`   ACL Entries: ${shareInfo.acls?.length || 0}`);
    
    if (shareInfo.acls && shareInfo.acls.length > 0) {
      console.log('   Access Control:');
      shareInfo.acls.forEach(acl => {
        console.log(`     - ${acl.user_or_group}: ${acl.permission} (${acl.type})`);
      });
    }

    // Test ACL update functionality
    console.log('\n🔄 Testing ACL update...');
    await client.updateCifsShareAcl({
      name: shareName,
      svm_name: svmName,
      access_control: [
        {
          permission: 'full_control',
          user_or_group: 'Everyone',
          type: 'windows'
        },
        {
          permission: 'read',
          user_or_group: 'BUILTIN\\Users',
          type: 'windows'
        }
      ]
    });
    console.log('✅ ACL updated successfully');

    // Verify ACL update
    const updatedShare = await client.getCifsShare(shareName, svmName);
    console.log(`   Updated ACL Entries: ${updatedShare.acls?.length || 0}`);

    // Clean up
    console.log('\n🗑️ Cleaning up...');
    await client.deleteCifsShare({
      name: shareName,
      svm_name: svmName
    });
    console.log('✅ Test share deleted');

    console.log('\n🎉 User scenario test completed successfully!');
    console.log('\n✅ All CIFS functionality is working:');
    console.log('   • Share creation with ACLs ✅');
    console.log('   • Share verification ✅');
    console.log('   • ACL updates ✅');
    console.log('   • Share deletion ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
    process.exit(1);
  }
}

testUserScenario().catch(console.error);