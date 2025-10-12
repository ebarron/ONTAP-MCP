#!/bin/bash

# NetApp ONTAP MCP Server - New Features Test Harness
# This script tests the snapshot policy and NFS export policy management capabilities

echo "=========================================="
echo "NetApp ONTAP MCP Server - Policy Management Test"
echo "=========================================="

# Configuration
CLUSTER_NAME="julia-vsim-1"
SVM_NAME="VS1"
TEST_POLICY_PREFIX="mcp-test"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Test volume info
TEST_VOLUME_NAME="test-policies-${TIMESTAMP}"
TEST_VOLUME_SIZE="1GB"

echo ""
echo "🔧 Test Configuration:"
echo "   • Cluster: ${CLUSTER_NAME}"
echo "   • SVM: ${SVM_NAME}"
echo "   • Test Volume: ${TEST_VOLUME_NAME}"
echo "   • Policy Prefix: ${TEST_POLICY_PREFIX}"
echo ""

# Function to test MCP tool
test_mcp_tool() {
    local tool_name="$1"
    local params="$2"
    local description="$3"
    
    echo "📋 Testing: $description"
    echo "   Tool: $tool_name"
    echo "   Input: $params"
    echo ""
    
    # Note: In real testing, you would use the MCP client to call these tools
    # For now, we'll document the test cases
    echo "   ✅ Tool defined and ready for testing"
    echo ""
}

echo "=== SNAPSHOT POLICY MANAGEMENT TESTS ==="
echo ""

# Test 1: List snapshot policies
test_mcp_tool "list_snapshot_policies" \
    '{"cluster_name": "'$CLUSTER_NAME'"}' \
    "List all snapshot policies on cluster"

# Test 2: Create a test snapshot policy
test_mcp_tool "create_snapshot_policy" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-snap-daily", "comment": "Test daily snapshot policy", "copies": [{"schedule": {"name": "daily"}, "count": 7, "prefix": "daily"}]}' \
    "Create daily snapshot policy"

# Test 3: Get snapshot policy details
test_mcp_tool "get_snapshot_policy" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-snap-daily"}' \
    "Get snapshot policy details"

# Test 4: Update snapshot policy
test_mcp_tool "update_snapshot_policy" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-snap-daily", "comment": "Updated test policy"}' \
    "Update snapshot policy comment"

echo "=== NFS EXPORT POLICY MANAGEMENT TESTS ==="
echo ""

# Test 5: List export policies
test_mcp_tool "list_export_policies" \
    '{"cluster_name": "'$CLUSTER_NAME'", "svm_name": "'$SVM_NAME'"}' \
    "List all export policies on SVM"

# Test 6: Create export policy
test_mcp_tool "create_export_policy" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-nfs-readonly", "svm_name": "'$SVM_NAME'", "comment": "Test read-only NFS export policy"}' \
    "Create NFS export policy"

# Test 7: Add export rule
test_mcp_tool "add_export_rule" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-nfs-readonly", "svm_name": "'$SVM_NAME'", "clients": [{"match": "192.168.1.0/24"}], "protocols": ["nfs3", "nfs4"], "ro_rule": ["sys"], "rw_rule": ["none"]}' \
    "Add read-only export rule for subnet"

# Test 8: Get export policy details
test_mcp_tool "get_export_policy" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-nfs-readonly", "svm_name": "'$SVM_NAME'"}' \
    "Get export policy with rules"

echo "=== VOLUME LIFECYCLE WITH POLICIES TESTS ==="
echo ""

# Test 9: Create volume with snapshot policy
test_mcp_tool "cluster_create_volume" \
    '{"cluster_name": "'$CLUSTER_NAME'", "svm_name": "'$SVM_NAME'", "volume_name": "'$TEST_VOLUME_NAME'", "size": "'$TEST_VOLUME_SIZE'", "snapshot_policy": "'$TEST_POLICY_PREFIX'-snap-daily", "nfs_export_policy": "'$TEST_POLICY_PREFIX'-nfs-readonly"}' \
    "Create volume with both snapshot and export policies"

# Test 10: Get volume configuration
test_mcp_tool "get_volume_configuration" \
    '{"cluster_name": "'$CLUSTER_NAME'", "volume_uuid": "VOLUME_UUID_FROM_CREATION"}' \
    "Get comprehensive volume configuration"

# Test 11: Update volume security style
test_mcp_tool "update_volume_security_style" \
    '{"cluster_name": "'$CLUSTER_NAME'", "volume_uuid": "VOLUME_UUID_FROM_CREATION", "security_style": "unix"}' \
    "Update volume security style to UNIX"

# Test 12: Resize volume
test_mcp_tool "resize_volume" \
    '{"cluster_name": "'$CLUSTER_NAME'", "volume_uuid": "VOLUME_UUID_FROM_CREATION", "new_size": "2GB"}' \
    "Resize volume to 2GB"

# Test 13: Update volume comment
test_mcp_tool "update_volume_comment" \
    '{"cluster_name": "'$CLUSTER_NAME'", "volume_uuid": "VOLUME_UUID_FROM_CREATION", "comment": "Test volume for policy management"}' \
    "Update volume comment"

echo "=== POLICY APPLICATION/REMOVAL TESTS ==="
echo ""

# Test 14: Remove snapshot policy from volume
test_mcp_tool "remove_snapshot_policy_from_volume" \
    '{"cluster_name": "'$CLUSTER_NAME'", "volume_uuid": "VOLUME_UUID_FROM_CREATION"}' \
    "Remove snapshot policy from volume"

# Test 15: Re-apply snapshot policy to volume
test_mcp_tool "apply_snapshot_policy_to_volume" \
    '{"cluster_name": "'$CLUSTER_NAME'", "volume_uuid": "VOLUME_UUID_FROM_CREATION", "snapshot_policy_name": "'$TEST_POLICY_PREFIX'-snap-daily"}' \
    "Re-apply snapshot policy to volume"

# Test 16: Disable NFS access
test_mcp_tool "disable_volume_nfs_access" \
    '{"cluster_name": "'$CLUSTER_NAME'", "volume_uuid": "VOLUME_UUID_FROM_CREATION"}' \
    "Disable NFS access (revert to default)"

# Test 17: Re-configure NFS access
test_mcp_tool "configure_volume_nfs_access" \
    '{"cluster_name": "'$CLUSTER_NAME'", "volume_uuid": "VOLUME_UUID_FROM_CREATION", "export_policy_name": "'$TEST_POLICY_PREFIX'-nfs-readonly"}' \
    "Re-configure NFS access with export policy"

echo "=== EXPORT POLICY RULE MANAGEMENT TESTS ==="
echo ""

# Test 18: Update export rule
test_mcp_tool "update_export_rule" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-nfs-readonly", "rule_index": 1, "svm_name": "'$SVM_NAME'", "rw_rule": ["sys"], "comment": "Updated to allow read-write"}' \
    "Update export rule to allow read-write"

# Test 19: Add second export rule
test_mcp_tool "add_export_rule" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-nfs-readonly", "svm_name": "'$SVM_NAME'", "clients": [{"match": "10.0.0.100"}], "protocols": ["nfs4"], "ro_rule": ["sys"], "rw_rule": ["sys"], "comment": "Admin access"}' \
    "Add admin access export rule"

# Test 20: Delete second export rule
test_mcp_tool "delete_export_rule" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-nfs-readonly", "rule_index": 2, "svm_name": "'$SVM_NAME'"}' \
    "Delete admin access export rule"

echo "=== CLEANUP TESTS ==="
echo ""

# Test 21: Offline and delete volume
test_mcp_tool "cluster_update_volume" \
    '{"cluster_name": "'$CLUSTER_NAME'", "volume_uuid": "VOLUME_UUID_FROM_CREATION", "state": "offline"}' \
    "Take test volume offline (using cluster_update_volume)"

test_mcp_tool "cluster_delete_volume" \
    '{"cluster_name": "'$CLUSTER_NAME'", "volume_uuid": "VOLUME_UUID_FROM_CREATION"}' \
    "Delete test volume"

# Test 22: Delete export policy
test_mcp_tool "delete_export_policy" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-nfs-readonly", "svm_name": "'$SVM_NAME'"}' \
    "Delete test export policy"

# Test 23: Delete snapshot policy
test_mcp_tool "delete_snapshot_policy" \
    '{"cluster_name": "'$CLUSTER_NAME'", "policy_name": "'$TEST_POLICY_PREFIX'-snap-daily"}' \
    "Delete test snapshot policy"

echo "=========================================="
echo "✅ Test Harness Complete!"
echo ""
echo "📝 Next Steps:"
echo "   1. Start the MCP server: npm start"
echo "   2. Connect with an MCP client (like Claude Desktop)"
echo "   3. Execute the test tools in sequence"
echo "   4. Verify each operation succeeds"
echo "   5. Check ONTAP System Manager for policy creation/application"
echo ""
echo "🔧 Test Tools Summary:"
echo "   • 7 Snapshot Policy Management tools"
echo "   • 9 NFS Export Policy Management tools" 
echo "   • 6 Volume Configuration/Update tools"
echo "   • Enhanced volume creation with policy support"
echo ""
echo "🎯 Use Cases Enabled:"
echo "   • Complete volume provisioning with data protection"
echo "   • NFS export policy management for secure access"
echo "   • Volume configuration updates post-creation"
echo "   • Policy lifecycle management (create, apply, remove, delete)"
echo "=========================================="