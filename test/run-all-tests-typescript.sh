#!/bin/bash

# Comprehensive regression test suite for NetApp ONTAP MCP Server
# Runs all available tests to validate functionality
# Usage: ./run-all-tests.sh [test_number]
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
    
    if eval "$test_command" > /tmp/test_output_$CURRENT_TEST_NUM.log 2>&1; then
        success "Test $CURRENT_TEST_NUM PASSED: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        error "Test $CURRENT_TEST_NUM FAILED: $test_name"
        echo "Error output:"
        cat /tmp/test_output_$CURRENT_TEST_NUM.log
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Change to project root
cd "$(dirname "$0")/.."

if [ ! -z "$SPECIFIC_TEST" ]; then
    log "🎯 Running Specific Test #$SPECIFIC_TEST"
else
    log "🚀 Starting Comprehensive Regression Test Suite"
fi

log "Building project first..."
npm run build

echo ""
log "=== Starting Shared HTTP Server for Test Suite ==="
# Using Streamable HTTP transport (MCP 2025-06-18)
# Clusters must be loaded via MCP API into each session
node build/index.js --http=3000 > /tmp/mcp-test-suite-server.log 2>&1 &
SERVER_PID=$!
log "Server started with PID: $SERVER_PID"

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
log "=== Running All Tests ==="

# Test 1: Volume Lifecycle (STDIO Mode)
run_test "Volume Lifecycle (STDIO Mode)" "node test/tools/test-volume-lifecycle.js stdio"

# Test 2: Volume Lifecycle (HTTP Mode) 
run_test "Volume Lifecycle (HTTP Mode)" "node test/tools/test-volume-lifecycle.js http --server-running"

# Test 3: Export Policy Lifecycle (STDIO Mode)
run_test "Export Policy Lifecycle (STDIO Mode)" "node test/tools/test-export-policy-lifecycle.js stdio"

# Test 4: Export Policy Lifecycle (HTTP Mode)
run_test "Export Policy Lifecycle (HTTP Mode)" "node test/tools/test-export-policy-lifecycle.js http --server-running"

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

# Test 14: CIFS Lifecycle Test (STDIO Mode)
run_test "CIFS Lifecycle (STDIO Mode)" "node test/tools/test-cifs-lifecycle.js stdio"

# Test 15: CIFS Lifecycle Test (HTTP Mode) - Now fully working with JSON-RPC support!
run_test "CIFS Lifecycle (HTTP Mode)" "node test/tools/test-cifs-lifecycle.js http --server-running"

# Test 16: Cluster Info Test (STDIO Mode)
run_test "Cluster Info Test (STDIO Mode)" "node test/tools/test-cluster-info.js stdio"

# Test 17: Cluster Info Test (HTTP Mode)
run_test "Cluster Info Test (HTTP Mode)" "node test/tools/test-cluster-info.js http --server-running"

# Test 18: Aggregate List Test (STDIO Mode)
run_test "Aggregate List Test (STDIO Mode)" "node test/tools/test-aggregate-svm-filter.js stdio"

# Test 19: Aggregate List Test (HTTP Mode)
run_test "Aggregate List Test (HTTP Mode)" "node test/tools/test-aggregate-svm-filter.js http --server-running"

# Test 20: QoS Policy Lifecycle Test (STDIO Mode)
run_test "QoS Policy Lifecycle (STDIO Mode)" "node test/tools/test-qos-lifecycle.js stdio"

# Test 21: QoS Policy Lifecycle Test (HTTP Mode)
run_test "QoS Policy Lifecycle (HTTP Mode)" "node test/tools/test-qos-lifecycle.js http --server-running"

# Test 22: Volume Autosize Lifecycle Test (STDIO Mode)
run_test "Volume Autosize Lifecycle (STDIO Mode)" "node test/tools/test-volume-autosize-lifecycle-v2.js stdio"

# Test 23: Volume Autosize Lifecycle Test (HTTP Mode)
run_test "Volume Autosize Lifecycle (HTTP Mode)" "node test/tools/test-volume-autosize-lifecycle-v2.js http --server-running"

# Test 24: Volume Snapshot Lifecycle Test (STDIO Mode)
run_test "Volume Snapshot Lifecycle (STDIO Mode)" "node test/tools/test-volume-snapshot-lifecycle-v2.js stdio"

# Test 25: Volume Snapshot Lifecycle Test (HTTP Mode)
run_test "Volume Snapshot Lifecycle (HTTP Mode)" "node test/tools/test-volume-snapshot-lifecycle-v2.js http --server-running"

# Test 26: Session Management (HTTP Mode Only)
# Note: This test starts its own server with custom timeouts, so we stop the shared server first
echo ""
log "=== Stopping Shared HTTP Server for Session Management Test ==="
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
log "Shared server stopped"

run_test "Session Management (HTTP Mode)" "node test/core/test-session-management.js"

# Test 27: Session Isolation (HTTP Mode Only)
# This test validates that sessions cannot access each other's clusters
echo ""
log "=== Starting Fresh HTTP Server for Session Isolation Test ==="

# Make sure port 3000 is free
pkill -f "node build/index.js --http=3000" 2>/dev/null || true
sleep 2

node build/index.js --http=3000 --streamable > /tmp/mcp-isolation-test-server.log 2>&1 &
SERVER_PID=$!
log "Server started with PID: $SERVER_PID"

# Wait for server to be ready with health check  
for i in {1..20}; do
    if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
        success "HTTP server is ready for isolation test"
        sleep 2  # Give SSE endpoint time to fully initialize
        break
    fi
    sleep 0.5
done

run_test "Session Isolation (HTTP Mode)" "node test/core/test-session-isolation.js"

# Stop the isolation test server
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
log "Isolation test server stopped"

# Restart shared server and session for any remaining tests
log "=== Restarting Shared HTTP Server ==="
node build/index.js --http=3000 > /tmp/mcp-test-suite-server.log 2>&1 &
SERVER_PID=$!
log "Server restarted with PID: $SERVER_PID"
sleep 2

echo ""
log "=== Stopping Shared HTTP Server ==="

if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null || true
    log "Server stopped (PID: $SERVER_PID)"
fi

# Clean up temp files
rm -f /tmp/test-session.log

echo ""
log "=== Test Summary ==="
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
    success "🎉 ALL TESTS PASSED! Regression test suite completed successfully."
    exit 0
else
    error "❌ Some tests failed. Please review the output above."
    exit 1
fi