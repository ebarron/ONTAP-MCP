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
log "=== Running All Tests ==="

# Test 1: Volume Lifecycle (STDIO Mode)
run_test "Volume Lifecycle (STDIO Mode)" "node test/test-volume-lifecycle.js stdio"

# Test 2: Volume Lifecycle (HTTP Mode) 
run_test "Volume Lifecycle (HTTP Mode)" "node test/test-volume-lifecycle.js http"

# Test 3: Export Policy Lifecycle (STDIO Mode)
run_test "Export Policy Lifecycle (STDIO Mode)" "node test/test-export-policy-lifecycle.js stdio"

# Test 4: Export Policy Lifecycle (HTTP Mode)
run_test "Export Policy Lifecycle (HTTP Mode)" "node test/test-export-policy-lifecycle.js http"

# Test 5: Tool Discovery (STDIO vs HTTP)
run_test "Tool Discovery (STDIO vs HTTP)" "bash test/test-tool-discovery.sh"

# Test 6: Tool Count Verification (Legacy)  
run_test "Tool Count Verification (Legacy)" "bash test/verify-tool-count.sh"

# Test 7: Tool Count Verification (Dynamic)
run_test "Tool Count Verification (Dynamic)" "node test/dynamic-tool-count.js"

# Test 8: API Fields Test
run_test "API Fields Test" "node test/test-api-fields.js"

# Test 9: API Fixes Test
run_test "API Fixes Test" "node test/test-api-fixes.js"

# Test 10: Parameter Filtering Test
run_test "Parameter Filtering Test" "node test/test-param-filtering.js"

# Test 11: Snapshot Policy Formats
run_test "Snapshot Policy Formats" "node test/test-snapshot-policy-formats.js"

# Test 12: Comprehensive Test Suite
run_test "Comprehensive Test Suite" "node test/test-comprehensive.js"

# Test 13: Policy Management (Shell)
run_test "Policy Management (Shell)" "bash test/test-policy-management.sh"

# Test 14: Volume Lifecycle (Shell)
run_test "Volume Lifecycle (Shell)" "bash test/test-volume-lifecycle.sh"

# Test 15: CIFS Tools Registration Verification
run_test "CIFS Tools Registration" "node test/test-cifs-simple.js"

# Test 16: CIFS ACL Creation Test
run_test "CIFS ACL Creation Test" "node test/test-cifs-creation-acl.js"

# Test 17: User Scenario Test (Original CIFS Workflow)
run_test "User Scenario Test" "node test/test-user-scenario.js"

# Test 18: CIFS Lifecycle Test (STDIO Mode)
run_test "CIFS Lifecycle (STDIO Mode)" "node test/test-cifs-lifecycle.js stdio"

# Test 19: CIFS Lifecycle Test (HTTP Mode) - Now fully working with JSON-RPC support!
run_test "CIFS Lifecycle (HTTP Mode)" "node test/test-cifs-lifecycle.js http"

# Test 20: Cluster Info Test (STDIO Mode)
run_test "Cluster Info Test (STDIO Mode)" "node test/test-cluster-info.js stdio"

# Test 21: Cluster Info Test (HTTP Mode)
run_test "Cluster Info Test (HTTP Mode)" "node test/test-cluster-info.js http"

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