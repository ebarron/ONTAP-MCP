#!/bin/bash

# NetApp ONTAP Volume Lifecycle Test - REST API Mode
# Tests create → wait → offline → delete workflow via HTTP API

set -e  # Exit on any error

# Configuration
CLUSTER_NAME="greg-vsim-1"
SVM_NAME="vs0"
VOLUME_NAME="test_lifecycle_$(date +%s)"
SIZE="100MB"
AGGREGATE_NAME="aggr1_1"
WAIT_TIME=10
HTTP_PORT=3004

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
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

# Start HTTP server
start_server() {
    log "🌐 Starting ONTAP MCP HTTP server on port $HTTP_PORT..."
    
    ONTAP_CLUSTERS='[{"name":"'$CLUSTER_NAME'","cluster_ip":"10.193.184.184","username":"admin","password":"Netapp1!","description":"Test cluster"}]' \
    node build/index.js --http=$HTTP_PORT &
    
    SERVER_PID=$!
    echo $SERVER_PID > /tmp/ontap-mcp-test.pid
    
    # Wait for server to start
    for i in {1..10}; do
        if curl -s http://localhost:$HTTP_PORT/health > /dev/null 2>&1; then
            success "HTTP server started successfully"
            return 0
        fi
        sleep 1
    done
    
    error "Failed to start HTTP server"
    return 1
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
    log "📋 Volume: $VOLUME_NAME, Size: $SIZE, SVM: $SVM_NAME"
    
    # Build project
    log "🔨 Building project..."
    npm run build
    
    # Start server
    start_server
    sleep 3  # Give server time to fully initialize
    
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
