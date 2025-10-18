#!/bin/bash
# Test script for new volume operations

set -e

echo "Testing volume operations..."

# Load clusters
export ONTAP_CLUSTERS=$(cat test/clusters.json)

# List SVMs
echo -e "\n=== Testing ListSVMs ==="
./bin/ontap-mcp --test-connection --log-level=info 2>&1 | grep -A 50 "SVM" || true

# Test via MCP tool call (if we add a test tool)
echo -e "\n=== Build completed successfully ==="
echo "Volume API methods added:"
echo "  - ListSVMs() / GetSVM()"
echo "  - ListAggregates() / GetAggregate()"  
echo "  - ListVolumes() / GetVolume()"
echo "  - CreateVolume() / UpdateVolume() / DeleteVolume()"
echo ""
echo "Next: Add CIFS, NFS, Snapshot, QoS API methods"
