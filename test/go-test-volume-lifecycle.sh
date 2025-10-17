#!/bin/bash

# Simple Go binary test for volume lifecycle
# Tests: cluster_list_volumes in STDIO mode

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

cd "$(dirname "$0")/.."

log "Starting Go Volume Lifecycle Test (STDIO Mode)"

# Check if binary exists
if [ ! -f "build/ontap-mcp" ]; then
    error "Go binary not found. Run: go build -o build/ontap-mcp ./cmd/ontap-mcp"
fi

# Load clusters
if [ ! -f "test/clusters.json" ]; then
    error "test/clusters.json not found"
fi

log "Loading clusters from test/clusters.json..."
export ONTAP_CLUSTERS="$(cat test/clusters.json)"

# Test 1: List registered clusters
log "Test 1: list_registered_clusters"
RESULT=$(echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_registered_clusters", "arguments": {}}}' | \
    ./build/ontap-mcp 2>/dev/null | jq -r '.result.content[0].text')

if echo "$RESULT" | grep -q "Registered clusters"; then
    success "Test 1: list_registered_clusters - PASSED"
    CLUSTER_NAME=$(echo "$RESULT" | grep "^-" | head -1 | sed 's/^- //' | cut -d' ' -f1)
    log "Using cluster: $CLUSTER_NAME"
else
    error "Test 1: Failed to list clusters"
fi

# Test 2: List SVMs
log "Test 2: cluster_list_svms"
RESULT=$(echo "{\"jsonrpc\": \"2.0\", \"id\": 2, \"method\": \"tools/call\", \"params\": {\"name\": \"cluster_list_svms\", \"arguments\": {\"cluster_name\": \"$CLUSTER_NAME\"}}}" | \
    ./build/ontap-mcp 2>/dev/null | jq -r '.result.content[0].text')

if echo "$RESULT" | grep -q "SVMs on cluster"; then
    success "Test 2: cluster_list_svms - PASSED"
    SVM_NAME=$(echo "$RESULT" | grep "^-" | head -1 | sed 's/^- \([^ ]*\) .*/\1/')
    log "Using SVM: $SVM_NAME"
else
    error "Test 2: Failed to list SVMs"
fi

# Test 3: List aggregates
log "Test 3: cluster_list_aggregates"
RESULT=$(echo "{\"jsonrpc\": \"2.0\", \"id\": 3, \"method\": \"tools/call\", \"params\": {\"name\": \"cluster_list_aggregates\", \"arguments\": {\"cluster_name\": \"$CLUSTER_NAME\"}}}" | \
    ./build/ontap-mcp 2>/dev/null | jq -r '.result.content[0].text')

if echo "$RESULT" | grep -q "Aggregates"; then
    success "Test 3: cluster_list_aggregates - PASSED"
    AGGR_NAME=$(echo "$RESULT" | grep "^-" | head -1 | sed 's/^- \([^ ]*\) .*/\1/')
    log "Using aggregate: $AGGR_NAME"
else
    error "Test 3: Failed to list aggregates"
fi

# Test 4: List volumes
log "Test 4: cluster_list_volumes"
RESULT=$(echo "{\"jsonrpc\": \"2.0\", \"id\": 4, \"method\": \"tools/call\", \"params\": {\"name\": \"cluster_list_volumes\", \"arguments\": {\"cluster_name\": \"$CLUSTER_NAME\", \"svm_name\": \"$SVM_NAME\"}}}" | \
    ./build/ontap-mcp 2>/dev/null | jq -r '.result.content[0].text')

if echo "$RESULT" | grep -q "Volumes on cluster" || echo "$RESULT" | grep -q "No volumes found"; then
    success "Test 4: cluster_list_volumes - PASSED"
else
    error "Test 4: Failed to list volumes"
fi

# Test 5: Create volume
TIMESTAMP=$(date +%s)
VOL_NAME="go_test_vol_${TIMESTAMP}"
log "Test 5: cluster_create_volume (${VOL_NAME})"

RESULT=$(echo "{\"jsonrpc\": \"2.0\", \"id\": 5, \"method\": \"tools/call\", \"params\": {\"name\": \"cluster_create_volume\", \"arguments\": {\"cluster_name\": \"$CLUSTER_NAME\", \"svm_name\": \"$SVM_NAME\", \"volume_name\": \"$VOL_NAME\", \"size\": \"1GB\", \"aggregate_name\": \"$AGGR_NAME\"}}}" | \
    ./build/ontap-mcp 2>/dev/null | jq -r '.result.content[0].text')

if echo "$RESULT" | grep -q "Successfully created volume"; then
    success "Test 5: cluster_create_volume - PASSED"
    log "Result: $RESULT"
else
    error "Test 5: Failed to create volume. Output: $RESULT"
fi

# Wait a bit for volume to be ready and get its UUID
log "Waiting 5 seconds for volume creation job to complete..."
sleep 5

# Get volume UUID by listing volumes and finding our test volume
log "Looking up volume UUID for $VOL_NAME..."
VOL_UUID=$(echo "{\"jsonrpc\": \"2.0\", \"id\": 5, \"method\": \"tools/call\", \"params\": {\"name\": \"cluster_list_volumes\", \"arguments\": {\"cluster_name\": \"$CLUSTER_NAME\", \"svm_name\": \"$SVM_NAME\"}}}" | \
    ./build/ontap-mcp 2>/dev/null | jq -r '.result.content[0].text' | grep "$VOL_NAME" | grep -o '[a-f0-9]\{8\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{12\}' | head -1)

if [ -z "$VOL_UUID" ]; then
    error "Failed to find UUID for volume $VOL_NAME"
fi

log "Volume UUID: $VOL_UUID"

# Test 6: Update volume to offline
log "Test 6: cluster_update_volume (offline)"
RESULT=$(echo "{\"jsonrpc\": \"2.0\", \"id\": 6, \"method\": \"tools/call\", \"params\": {\"name\": \"cluster_update_volume\", \"arguments\": {\"cluster_name\": \"$CLUSTER_NAME\", \"volume_uuid\": \"$VOL_UUID\", \"state\": \"offline\"}}}" | \
    ./build/ontap-mcp 2>/dev/null | jq -r '.result.content[0].text')

if echo "$RESULT" | grep -q "Successfully updated volume"; then
    success "Test 6: cluster_update_volume (offline) - PASSED"
else
    error "Test 6: Failed to offline volume. Output: $RESULT"
fi

# Wait for offline to complete
log "Waiting 2 seconds for volume to go offline..."
sleep 2

# Test 7: Delete volume
log "Test 7: cluster_delete_volume"
RESULT=$(echo "{\"jsonrpc\": \"2.0\", \"id\": 7, \"method\": \"tools/call\", \"params\": {\"name\": \"cluster_delete_volume\", \"arguments\": {\"cluster_name\": \"$CLUSTER_NAME\", \"volume_uuid\": \"$VOL_UUID\"}}}" | \
    ./build/ontap-mcp 2>/dev/null | jq -r '.result.content[0].text')

if echo "$RESULT" | grep -q "Successfully deleted volume"; then
    success "Test 7: cluster_delete_volume - PASSED"
else
    error "Test 7: Failed to delete volume. Output: $RESULT"
fi

echo ""
success "🎉 All Go volume lifecycle tests PASSED!"
log "Volume created, offlined, and deleted successfully"
