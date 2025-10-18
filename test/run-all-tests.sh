#!/bin/bash

# Concurrent regression test suite for NetApp ONTAP MCP Server (Go Implementation)
# Runs HTTP tests in parallel for faster execution
# STDIO tests run sequentially as they each spawn their own server
# Usage: ./run-all-tests-concurrent.sh [test_number]
#   test_number: Optional - run only specific test (e.g., 1, 18, 20)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
SPECIFIC_TEST="$1"

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

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
CURRENT_TEST_NUM=0

# Arrays to track parallel test results (using indexed arrays for bash 3.2 compatibility)
TEST_PIDS=()
TEST_NAMES=()
TEST_NUMBERS=()
TEST_PID_COUNT=0

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    CURRENT_TEST_NUM=$((CURRENT_TEST_NUM + 1))
    
    # Skip if specific test requested and this isn't it
    if [ ! -z "$SPECIFIC_TEST" ] && [ "$CURRENT_TEST_NUM" != "$SPECIFIC_TEST" ]; then
        return
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log "Running Test $CURRENT_TEST_NUM: $test_name"
    
    if eval "$test_command" > /tmp/test_output_go_$CURRENT_TEST_NUM.log 2>&1; then
        success "Test $CURRENT_TEST_NUM PASSED: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        error "Test $CURRENT_TEST_NUM FAILED: $test_name"
        echo "Error output:"
        cat /tmp/test_output_go_$CURRENT_TEST_NUM.log
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to run a test in background (for parallel execution)
run_test_async() {
    local test_name="$1"
    local test_command="$2"
    
    CURRENT_TEST_NUM=$((CURRENT_TEST_NUM + 1))
    
    # Skip if specific test requested and this isn't it
    if [ ! -z "$SPECIFIC_TEST" ] && [ "$CURRENT_TEST_NUM" != "$SPECIFIC_TEST" ]; then
        return
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log "Starting Test $CURRENT_TEST_NUM (async): $test_name"
    
    # Run test in background and capture PID
    (eval "$test_command" > /tmp/test_output_go_$CURRENT_TEST_NUM.log 2>&1) &
    local pid=$!
    
    # Store PID and test info in indexed arrays
    TEST_PIDS[$TEST_PID_COUNT]=$pid
    TEST_NAMES[$TEST_PID_COUNT]="$test_name"
    TEST_NUMBERS[$TEST_PID_COUNT]=$CURRENT_TEST_NUM
    TEST_PID_COUNT=$((TEST_PID_COUNT + 1))
}

# Function to wait for all async tests and check results
wait_for_async_tests() {
    log "Waiting for parallel tests to complete..."
    
    for i in $(seq 0 $((TEST_PID_COUNT - 1))); do
        local pid="${TEST_PIDS[$i]}"
        local test_num="${TEST_NUMBERS[$i]}"
        local test_name="${TEST_NAMES[$i]}"
        
        if wait $pid; then
            success "Test $test_num PASSED: $test_name"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            error "Test $test_num FAILED: $test_name"
            echo "Error output:"
            cat /tmp/test_output_go_$test_num.log
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    done
    
    # Clear arrays for next batch
    TEST_PIDS=()
    TEST_NAMES=()
    TEST_NUMBERS=()
    TEST_PID_COUNT=0
}

# Change to project root
cd "$(dirname "$0")/.."

if [ ! -z "$SPECIFIC_TEST" ]; then
    log "🎯 Running Specific Test #$SPECIFIC_TEST (Go Implementation)"
else
    log "🚀 Starting Concurrent Regression Test Suite (Go Implementation)"
fi

log "Building Go binary first..."
if ! go build -o ontap-mcp-server ./cmd/ontap-mcp; then
    error "Failed to build Go binary"
    exit 1
fi
success "Go binary built successfully ($(ls -lh ontap-mcp-server | awk '{print $5}'))"

echo ""
log "=== Starting Shared HTTP Server for Test Suite (Go) ==="
# Using Streamable HTTP transport (MCP 2025-06-18)
# Clusters must be loaded via MCP API into each session
./ontap-mcp-server --http=3000 > /tmp/mcp-test-suite-server-go.log 2>&1 &
SERVER_PID=$!
log "Go server started with PID: $SERVER_PID"

# Wait for server to be healthy (up to 20 seconds)
log "Waiting for server to be ready..."
for i in {1..40}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        success "HTTP server is ready on port 3000"
        break
    fi
    if [ $i -eq 40 ]; then
        error "Server failed to start within 20 seconds"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    sleep 0.5
done

# Note: Session reuse doesn't work with HTTP/SSE architecture.
# Each test creates its own session and loads clusters independently.
log "=== HTTP Server Ready for Tests ==="

echo ""
log "=== Phase 1: STDIO Tests (Sequential - each needs own server) ==="

# Test 1: Volume Lifecycle (STDIO Mode)
run_test "Volume Lifecycle (STDIO Mode)" "node test/tools/test-volume-lifecycle.js stdio"

# Test 3: Export Policy Lifecycle (STDIO Mode)
run_test "Export Policy Lifecycle (STDIO Mode)" "node test/tools/test-export-policy-lifecycle.js stdio"

# Test 14: CIFS Lifecycle Test (STDIO Mode)
run_test "CIFS Lifecycle (STDIO Mode)" "node test/tools/test-cifs-lifecycle.js stdio"

# Test 16: Cluster Info Test (STDIO Mode)
run_test "Cluster Info Test (STDIO Mode)" "node test/tools/test-cluster-info.js stdio"

# Test 18: Aggregate List Test (STDIO Mode)
run_test "Aggregate List Test (STDIO Mode)" "node test/tools/test-aggregate-svm-filter.js stdio"

# Test 20: QoS Policy Lifecycle Test (STDIO Mode)
run_test "QoS Policy Lifecycle (STDIO Mode)" "node test/tools/test-qos-lifecycle.js stdio"

# Test 22: Volume Autosize Lifecycle Test (STDIO Mode)
run_test "Volume Autosize Lifecycle (STDIO Mode)" "node test/tools/test-volume-autosize-lifecycle-v2.js stdio"

# Test 24: Volume Snapshot Lifecycle Test (STDIO Mode)
run_test "Volume Snapshot Lifecycle (STDIO Mode)" "node test/tools/test-volume-snapshot-lifecycle-v2.js stdio"

echo ""
log "=== Phase 2: Mixed/Other Tests (Sequential) ==="

# Test 5: Tool Discovery (STDIO vs HTTP)
run_test "Tool Discovery (STDIO vs HTTP)" "node test/core/test-tool-discovery.js"

# Test 6: Tool Count Verification (Legacy)  
run_test "Tool Count Verification (Legacy)" "bash test/core/verify-tool-count.sh"

# Test 7: Tool Count Verification (Dynamic)
run_test "Tool Count Verification (Dynamic)" "node test/core/dynamic-tool-count.js"

# Test 8: Parameter Filtering Test
run_test "Parameter Filtering Test" "node test/core/test-param-filtering.js"

# Test 9: Snapshot Policy Formats (MCP)
run_test "Snapshot Policy Formats (MCP)" "node test/tools/test-snapshot-policy-formats.js"

# Test 10: Comprehensive Test Suite
run_test "Comprehensive Test Suite" "node test/integration/test-comprehensive.js"

# Test 11: Policy Management (Shell)
run_test "Policy Management (Shell)" "bash test/integration/test-policy-management.sh"

# Test 12: CIFS ACL Creation Test
run_test "CIFS ACL Creation Test" "node test/tools/test-cifs-creation-acl.js"

# Test 13: User Scenario Test (Original CIFS Workflow)
run_test "User Scenario Test" "node test/tools/test-user-scenario.js"

echo ""
log "=== Phase 3: HTTP Tests (PARALLEL - session-based, can run concurrently) ==="

# Launch all HTTP tests in parallel
run_test_async "Volume Lifecycle (HTTP Mode)" "node test/tools/test-volume-lifecycle.js http --server-running"

run_test_async "Export Policy Lifecycle (HTTP Mode)" "node test/tools/test-export-policy-lifecycle.js http --server-running"

run_test_async "CIFS Lifecycle (HTTP Mode)" "node test/tools/test-cifs-lifecycle.js http --server-running"

run_test_async "Cluster Info Test (HTTP Mode)" "node test/tools/test-cluster-info.js http --server-running"

run_test_async "Aggregate List Test (HTTP Mode)" "node test/tools/test-aggregate-svm-filter.js http --server-running"

run_test_async "QoS Policy Lifecycle (HTTP Mode)" "node test/tools/test-qos-lifecycle.js http --server-running"

run_test_async "Volume Autosize Lifecycle (HTTP Mode)" "node test/tools/test-volume-autosize-lifecycle-v2.js http --server-running"

run_test_async "Volume Snapshot Lifecycle (HTTP Mode)" "node test/tools/test-volume-snapshot-lifecycle-v2.js http --server-running"

run_test_async "Session Isolation (HTTP Mode)" "node test/core/test-session-isolation.js"

# Wait for all parallel HTTP tests to complete
wait_for_async_tests

echo ""
log "=== Phase 4: Session Management Test (stops shared server) ==="

# Test 27: Session Management (HTTP Mode Only)
# This test requires a fresh server with custom session timeout environment variables
log "Stopping shared test server for session management test..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
sleep 2

run_test "Session Management (HTTP Mode Only)" "node test/core/test-session-management.js"

# No need to restart server - this is the last test

# Clean up temp files
rm -f /tmp/test-session.log

echo ""
log "=== Test Summary (Go Implementation - Concurrent Mode) ==="
log "Total Tests: $TOTAL_TESTS"
success "Passed: $PASSED_TESTS"
if [ $FAILED_TESTS -gt 0 ]; then
    error "Failed: $FAILED_TESTS"
else
    success "Failed: 0"
fi

# Calculate success rate
SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
log "Success Rate: ${SUCCESS_RATE}%"

if [ $FAILED_TESTS -eq 0 ]; then
    success "🎉 ALL TESTS PASSED! Concurrent regression test suite completed successfully (Go Implementation)."
    exit 0
else
    error "❌ Some tests failed. Please review the output above."
    exit 1
fi
