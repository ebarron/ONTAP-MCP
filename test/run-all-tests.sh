#!/bin/bash

# Comprehensive regression test suite for NetApp ONTAP MCP Server
# Runs all available tests to validate functionality

set -e

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

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log "Running Test $TOTAL_TESTS: $test_name"
    
    if eval "$test_command" > /tmp/test_output_$TOTAL_TESTS.log 2>&1; then
        success "Test $TOTAL_TESTS PASSED: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        error "Test $TOTAL_TESTS FAILED: $test_name"
        echo "Error output:"
        cat /tmp/test_output_$TOTAL_TESTS.log
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Change to project root
cd "$(dirname "$0")/.."

log "🚀 Starting Comprehensive Regression Test Suite"
log "Building project first..."
npm run build

echo ""
log "=== Starting Shared HTTP Server for Test Suite ==="
# Note: HTTP mode no longer loads clusters from ONTAP_CLUSTERS env var
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
run_test "Volume Lifecycle (STDIO Mode)" "node test/test-volume-lifecycle.js stdio"

# Test 2: Volume Lifecycle (HTTP Mode) 
run_test "Volume Lifecycle (HTTP Mode)" "node test/test-volume-lifecycle.js http --server-running"

# Test 3: Export Policy Lifecycle (STDIO Mode)
run_test "Export Policy Lifecycle (STDIO Mode)" "node test/test-export-policy-lifecycle.js stdio"

# Test 4: Export Policy Lifecycle (HTTP Mode)
run_test "Export Policy Lifecycle (HTTP Mode)" "node test/test-export-policy-lifecycle.js http --server-running"

# Test 5: Tool Discovery (STDIO vs HTTP)
run_test "Tool Discovery (STDIO vs HTTP)" "node test/test-tool-discovery.js"

# Test 6: Tool Count Verification (Legacy)  
run_test "Tool Count Verification (Legacy)" "bash test/verify-tool-count.sh"

# Test 7: Tool Count Verification (Dynamic)
run_test "Tool Count Verification (Dynamic)" "node test/dynamic-tool-count.js"

# Test 8: Parameter Filtering Test
run_test "Parameter Filtering Test" "node test/test-param-filtering.js"

# Test 9: Snapshot Policy Formats (MCP)
run_test "Snapshot Policy Formats (MCP)" "node test/test-snapshot-policy-formats.js"

# Test 10: Comprehensive Test Suite
run_test "Comprehensive Test Suite" "node test/test-comprehensive.js"

# Test 11: Policy Management (Shell)
run_test "Policy Management (Shell)" "bash test/test-policy-management.sh"

# Test 12: CIFS ACL Creation Test
run_test "CIFS ACL Creation Test" "node test/test-cifs-creation-acl.js"

# Test 13: User Scenario Test (Original CIFS Workflow)
run_test "User Scenario Test" "node test/test-user-scenario.js"

# Test 14: CIFS Lifecycle Test (STDIO Mode)
run_test "CIFS Lifecycle (STDIO Mode)" "node test/test-cifs-lifecycle.js stdio"

# Test 15: CIFS Lifecycle Test (HTTP Mode) - Now fully working with JSON-RPC support!
run_test "CIFS Lifecycle (HTTP Mode)" "node test/test-cifs-lifecycle.js http --server-running"

# Test 16: Cluster Info Test (STDIO Mode)
run_test "Cluster Info Test (STDIO Mode)" "node test/test-cluster-info.js stdio"

# Test 17: Cluster Info Test (HTTP Mode)
run_test "Cluster Info Test (HTTP Mode)" "node test/test-cluster-info.js http --server-running"

# Test 18: QoS Policy Lifecycle Test (STDIO Mode)
run_test "QoS Policy Lifecycle (STDIO Mode)" "node test/test-qos-lifecycle.js stdio"

# Test 19: QoS Policy Lifecycle Test (HTTP Mode)
run_test "QoS Policy Lifecycle (HTTP Mode)" "node test/test-qos-lifecycle.js http --server-running"

# Test 20: Session Management (HTTP Mode Only)
# Note: This test starts its own server with custom timeouts, so we stop the shared server first
echo ""
log "=== Stopping Shared HTTP Server for Session Management Test ==="
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
log "Shared server stopped"

run_test "Session Management (HTTP Mode)" "node test/test-session-management.js"

# Test 21: Session Isolation (HTTP Mode Only)
# This test validates that sessions cannot access each other's clusters
echo ""
log "=== Starting Fresh HTTP Server for Session Isolation Test ==="

# Make sure port 3000 is free
pkill -f "node build/index.js --http=3000" 2>/dev/null || true
sleep 2

node build/index.js --http=3000 > /tmp/mcp-isolation-test-server.log 2>&1 &
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

run_test "Session Isolation (HTTP Mode)" "node test/test-session-isolation.js"

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