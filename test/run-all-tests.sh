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

# Test 1: Volume Lifecycle (JavaScript)
run_test "Volume Lifecycle (JavaScript)" "node test/test-volume-lifecycle.js"

# Test 2: Tool Count Verification  
run_test "Tool Count Verification" "bash test/verify-tool-count.sh"

# Test 3: API Fields Test
run_test "API Fields Test" "node test/test-api-fields.js"

# Test 4: API Fixes Test
run_test "API Fixes Test" "node test/test-api-fixes.js"

# Test 5: Parameter Filtering Test
run_test "Parameter Filtering Test" "node test/test-param-filtering.js"

# Test 6: Snapshot Policy Formats
run_test "Snapshot Policy Formats" "node test/test-snapshot-policy-formats.js"

# Test 7: Comprehensive Test Suite
run_test "Comprehensive Test Suite" "node test/test-comprehensive.js"

# Test 8: Policy Management (Shell)
run_test "Policy Management (Shell)" "bash test/test-policy-management.sh"

# Test 9: Volume Lifecycle (Shell)
run_test "Volume Lifecycle (Shell)" "bash test/test-volume-lifecycle.sh"

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