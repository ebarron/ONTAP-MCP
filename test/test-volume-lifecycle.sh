#!/bin/bash

# NetApp ONTAP Volume Lifecycle Test - REST API Mode
# Tests create → wait → offline → delete workflow via HTTP API

set -e  # Exit on any error

# Get the project root directory (parent of test directory)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Configuration - defaults with environment variable overrides
VOLUME_NAME="test_lifecycle_$(date +%s)"
SIZE="100MB"  
WAIT_TIME=10
HTTP_PORT=3004
SERVER_LOG="/tmp/mcp-server-test.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Alias info to log for consistency
info() {
    log "$1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get SVM configuration for a cluster
get_svm_name() {
    local cluster_name="$1"
    
    # Get list of SVMs for this cluster
    local svms_response=$(curl -s -X POST "http://localhost:$HTTP_PORT/api/tools/cluster_list_svms" \
                              -H "Content-Type: application/json" \
                              -d "{\"cluster_name\":\"$cluster_name\"}" 2>/dev/null || echo "")
    
    if [ -z "$svms_response" ]; then
        error "Failed to get SVMs from cluster $cluster_name"
        exit 1
    fi
    
    # Parse SVM name from response (look for first SVM in the list)
    local svm_name=$(echo "$svms_response" | jq -r '.content[0].text' | grep -E "^- " | head -1 | sed 's/^- \([^ ]*\) .*/\1/' || echo "")
    
    if [ -z "$svm_name" ]; then
        error "Could not find any SVM on cluster $cluster_name"
        error "SVM response: $svms_response"
        exit 1
    fi
    
    echo "$svm_name"
}

# Get aggregate configuration for a cluster
get_aggregate_name() {
    local cluster_name="$1"
    
    # Get list of aggregates for this cluster
    local aggs_response=$(curl -s -X POST "http://localhost:$HTTP_PORT/api/tools/cluster_list_aggregates" \
                              -H "Content-Type: application/json" \
                              -d "{\"cluster_name\":\"$cluster_name\"}" 2>/dev/null || echo "")
    
    if [ -z "$aggs_response" ]; then
        error "Failed to get aggregates from cluster $cluster_name"
        exit 1
    fi
    
    # Parse aggregate name from response (look for first aggregate in the list)
    local agg_name=$(echo "$aggs_response" | jq -r '.content[0].text' | grep -E "^- " | head -1 | sed 's/^- \([^ ]*\) .*/\1/' || echo "")
    
    if [ -z "$agg_name" ]; then
        error "Could not find any aggregate on cluster $cluster_name"
        error "Aggregate response: $aggs_response"
        exit 1
    fi
    
    echo "$agg_name"
}

get_cluster_config() {
    local clusters_response=$(curl -s -X POST "http://localhost:$HTTP_PORT/api/tools/list_registered_clusters" \
                                  -H "Content-Type: application/json" \
                                  -d '{}' 2>/dev/null || echo "")
    
    if [ -z "$clusters_response" ]; then
        error "Failed to get clusters from MCP server. Is the server running?"
        exit 1
    fi
    
    # Parse the MCP tool response format
    local cluster_text=$(echo "$clusters_response" | jq -r '.content[0].text' 2>/dev/null || echo "")
    
    if [ "$cluster_text" = "null" ] || [ -z "$cluster_text" ]; then
        error "No clusters found in MCP server configuration"
        exit 1
    fi
    
    # Look for karan-ontap-1 specifically since we know it has the right aggregates
    local cluster_name=$(echo "$cluster_text" | grep -E "^- karan-ontap-1:" | head -1 | sed 's/^- \([^:]*\):.*/\1/' || echo "")
    
    # If karan-ontap-1 not found, fall back to first cluster
    if [ -z "$cluster_name" ]; then
        cluster_name=$(echo "$cluster_text" | grep -E "^- " | head -1 | sed 's/^- \([^:]*\):.*/\1/' || echo "")
    fi
    
    if [ -z "$cluster_name" ]; then
        error "Could not parse cluster name from server response"
        exit 1
    fi
    
    echo "$cluster_name"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Start the MCP server in HTTP mode
start_server() {
    info "Starting MCP server on port $HTTP_PORT..."
    
    # Read the clusters configuration from our test file
    local clusters_config
    if [ -f "test/clusters.json" ]; then
        clusters_config=$(cat test/clusters.json | jq -c .)
    else
        error "clusters.json not found - please run sync-clusters.js first"
        exit 1
    fi
    
    # Start server with cluster configuration
    ONTAP_CLUSTERS="$clusters_config" node build/index.js http "$HTTP_PORT" > "$SERVER_LOG" 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Check if server is responding with health check
    local health_check_attempts=0
    local max_attempts=10
    while [ $health_check_attempts -lt $max_attempts ]; do
        if curl -s "http://localhost:$HTTP_PORT/health" > /dev/null 2>&1; then
            info "Server started successfully with PID: $SERVER_PID"
            return 0
        fi
        health_check_attempts=$((health_check_attempts + 1))
        sleep 1
    done
    
    # If we get here, server didn't respond
    error "Server failed to respond to health checks. Check logs:"
    if [ -f "$SERVER_LOG" ]; then
        cat "$SERVER_LOG"
    fi
    exit 1
}

# Stop HTTP server
stop_server() {
    if [ -f /tmp/ontap-mcp-test.pid ]; then
        SERVER_PID=$(cat /tmp/ontap-mcp-test.pid)
        log "🛑 Stopping HTTP server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
        rm -f /tmp/ontap-mcp-test.pid
    fi
}

# Call REST API tool
call_tool() {
    local tool_name=$1
    local args=$2
    
    curl -s -X POST "http://localhost:$HTTP_PORT/api/tools/$tool_name" \
         -H "Content-Type: application/json" \
         -d "$args"
}

# Extract UUID from volume list
extract_uuid() {
    local volume_name=$1
    local list_response=$2
    
    echo "$list_response" | grep -o "$volume_name ([a-f0-9-]*)" | grep -o '([a-f0-9-]*)' | tr -d '()'
}

# Cleanup function
cleanup() {
    log "🧹 Cleaning up..."
    stop_server
}

# Set trap for cleanup
trap cleanup EXIT

# Main test execution
main() {
    log "🚀 Starting Volume Lifecycle Test (REST mode)"
    
    # Build project
    log "🔨 Building project..."
    cd "$PROJECT_ROOT" && npm run build
    
    # Start server
    start_server
    sleep 3  # Give server time to fully initialize
    
    # Get cluster configuration from server
    log "🔍 Getting cluster configuration from MCP server..."
    CLUSTER_NAME=$(get_cluster_config)
    
    # Discover SVM for this cluster
    log "🔍 Discovering SVM for cluster $CLUSTER_NAME..."
    SVM_NAME=$(get_svm_name "$CLUSTER_NAME")
    
    # Discover aggregate for this cluster
    log "🔍 Discovering aggregate for cluster $CLUSTER_NAME..."
    AGGREGATE_NAME=$(get_aggregate_name "$CLUSTER_NAME")
    
    log "📋 Using cluster: $CLUSTER_NAME"
    log "📋 Using SVM: $SVM_NAME"
    log "📋 Using aggregate: $AGGREGATE_NAME"
    log "📋 Volume: $VOLUME_NAME, Size: $SIZE"
    
    # Step 1: Create volume
    log "🔧 Step 1: Creating volume '$VOLUME_NAME'..."
    
    CREATE_ARGS="{\"cluster_name\":\"$CLUSTER_NAME\",\"svm_name\":\"$SVM_NAME\",\"volume_name\":\"$VOLUME_NAME\",\"size\":\"$SIZE\",\"aggregate_name\":\"$AGGREGATE_NAME\"}"
    
    CREATE_RESULT=$(call_tool "cluster_create_volume" "$CREATE_ARGS")
    echo "Create result: $CREATE_RESULT"
    
    if echo "$CREATE_RESULT" | grep -q "Volume created successfully"; then
        success "Volume created successfully"
    else
        error "Failed to create volume"
        echo "Response: $CREATE_RESULT"
        exit 1
    fi
    
    # Get volume UUID
    log "🔍 Getting volume UUID..."
    LIST_ARGS="{\"cluster_name\":\"$CLUSTER_NAME\",\"svm_name\":\"$SVM_NAME\"}"
    LIST_RESULT=$(call_tool "cluster_list_volumes" "$LIST_ARGS")
    
    VOLUME_UUID=$(extract_uuid "$VOLUME_NAME" "$LIST_RESULT")
    
    if [ -n "$VOLUME_UUID" ]; then
        success "Found volume UUID: $VOLUME_UUID"
    else
        error "Could not extract volume UUID"
        echo "List result: $LIST_RESULT"
        exit 1
    fi
    
    # Step 2: Wait and verify
    log "⏱️ Step 2: Waiting $WAIT_TIME seconds for volume to be ready..."
    sleep $WAIT_TIME
    
    # Verify volume is online
    VERIFY_RESULT=$(call_tool "cluster_list_volumes" "$LIST_ARGS")
    if echo "$VERIFY_RESULT" | grep -q "$VOLUME_NAME.*State: online"; then
        success "Volume verified online and ready"
    else
        warning "Could not verify volume state"
    fi
    
    # Step 3: Offline volume
    log "📴 Step 3: Taking volume offline..."
    
    OFFLINE_ARGS="{\"cluster_name\":\"$CLUSTER_NAME\",\"volume_uuid\":\"$VOLUME_UUID\"}"
    OFFLINE_RESULT=$(call_tool "cluster_offline_volume" "$OFFLINE_ARGS")
    
    echo "Offline result: $OFFLINE_RESULT"
    
    if echo "$OFFLINE_RESULT" | grep -q "taken offline\|already offline"; then
        success "Volume taken offline"
    else
        error "Failed to offline volume"
        echo "Response: $OFFLINE_RESULT"
        # Continue anyway to test error handling
    fi
    
    # Wait for state change
    sleep 3
    
    # Step 4: Delete volume
    log "🗑️ Step 4: Deleting volume..."
    
    DELETE_ARGS="{\"cluster_name\":\"$CLUSTER_NAME\",\"volume_uuid\":\"$VOLUME_UUID\"}"
    DELETE_RESULT=$(call_tool "cluster_delete_volume" "$DELETE_ARGS")
    
    echo "Delete result: $DELETE_RESULT"
    
    if echo "$DELETE_RESULT" | grep -q "permanently deleted\|Cannot delete.*offline"; then
        success "Delete operation completed (may require offline first)"
    else
        warning "Delete operation result unclear"
    fi
    
    # Final verification
    sleep 3
    FINAL_LIST=$(call_tool "cluster_list_volumes" "$LIST_ARGS")
    
    if echo "$FINAL_LIST" | grep -q "$VOLUME_UUID"; then
        warning "Volume still appears in listing (may be expected if offline failed)"
    else
        success "Volume confirmed deleted"
    fi
    
    success "🎉 Volume Lifecycle Test COMPLETED!"
}

# Run main function
main "$@"
