#!/bin/bash

# NetApp ONTAP MCP Server - Test Environment Setup
# This script helps you configure the required environment variables for testing

echo "🔧 NetApp ONTAP MCP Server - Test Environment Setup"
echo ""

# Check if ONTAP_CLUSTERS is already set
if [ -n "$ONTAP_CLUSTERS" ]; then
    echo "✅ ONTAP_CLUSTERS environment variable is already set:"
    echo "$ONTAP_CLUSTERS" | jq '.' 2>/dev/null || echo "$ONTAP_CLUSTERS"
    echo ""
    echo "Current clusters:"
    echo "$ONTAP_CLUSTERS" | jq -r '.[].name' 2>/dev/null || echo "Could not parse cluster names"
    echo ""
    read -p "Do you want to reconfigure? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing configuration."
        exit 0
    fi
fi

echo "Please provide your ONTAP cluster information:"
echo ""

# Get cluster information
read -p "Cluster name (e.g., 'production'): " cluster_name
read -p "Cluster IP or FQDN: " cluster_ip
read -p "Username: " username
read -s -p "Password: " password
echo ""
read -p "Description (optional): " description

# Optional test configuration
echo ""
echo "Optional test configuration:"
read -p "Default SVM name for testing (default: vs0): " svm_name
read -p "Default aggregate name for testing (default: aggr1_1): " aggregate_name

svm_name=${svm_name:-vs0}
aggregate_name=${aggregate_name:-aggr1_1}

# Create the JSON configuration
json_config=$(cat <<EOF
[
  {
    "name": "$cluster_name",
    "cluster_ip": "$cluster_ip",
    "username": "$username",
    "password": "$password",
    "description": "$description"
  }
]
EOF
)

echo ""
echo "Generated configuration:"
echo "$json_config" | jq '.' 2>/dev/null || echo "$json_config"

echo ""
echo "To use this configuration, run the following commands:"
echo ""
echo "# Set cluster configuration"
echo "export ONTAP_CLUSTERS='$json_config'"
echo ""
if [ "$svm_name" != "vs0" ]; then
    echo "# Set custom SVM name for testing"
    echo "export TEST_SVM_NAME='$svm_name'"
fi
if [ "$aggregate_name" != "aggr1_1" ]; then
    echo "# Set custom aggregate name for testing"
    echo "export TEST_AGGREGATE_NAME='$aggregate_name'"
fi
echo ""
echo "# Then run tests:"
echo "npm run build"
echo "node test-volume-lifecycle.js stdio    # Test STDIO mode"
echo "node test-volume-lifecycle.js rest     # Test REST mode"
echo "./test-volume-lifecycle.sh             # Test REST API via bash"
echo "node check-aggregates.js               # Check aggregates"
echo ""

# Offer to set for current session
read -p "Set these environment variables for the current session? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    export ONTAP_CLUSTERS="$json_config"
    if [ "$svm_name" != "vs0" ]; then
        export TEST_SVM_NAME="$svm_name"
    fi
    if [ "$aggregate_name" != "aggr1_1" ]; then
        export TEST_AGGREGATE_NAME="$aggregate_name"
    fi
    echo "✅ Environment variables set for current session!"
    echo ""
    echo "You can now run the test scripts directly."
else
    echo "Environment variables not set. Use the export commands above."
fi
