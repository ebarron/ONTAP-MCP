#!/bin/bash

# Standalone Test Validation Script
# Tests each individual test in both STDIO and HTTP modes
# Usage: ./test/validate-standalone-tests.sh [test-name]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="/tmp/standalone-test-logs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$LOG_DIR"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test definitions (test-file:mode:requires-server)
TESTS=(
    "test-tool-discovery.js:stdio:no"
    "test-tool-discovery.js:http:yes"
    "test-mcp-spec-compliance.js:stdio:no"
    "test-mcp-spec-compliance.js:http:yes"
    "test-response-format-validation.js:stdio:no"
    "test-response-format-validation.js:http:yes"
    "test-cluster-info.js:stdio:no"
    "test-cluster-info.js:http:yes"
    "test-volume-lifecycle.js:stdio:no"
    "test-volume-lifecycle.js:http:yes"
    "test-export-policy-lifecycle.js:stdio:no"
    "test-export-policy-lifecycle.js:http:yes"
    "test-cifs-lifecycle.js:stdio:no"
    "test-cifs-lifecycle.js:http:yes"
    "test-qos-lifecycle.js:stdio:no"
    "test-qos-lifecycle.js:http:yes"
    "test-snapshot-policy-formats.js:stdio:no"
    "test-snapshot-policy-formats.js:http:yes"
    "test-session-management.js:http:yes"
    "test-session-isolation.js:http:yes"
)

# Function to check if server is running
check_server() {
    if pgrep -f "node build/index.js --http=3000" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to start server
start_server() {
    echo -e "${YELLOW}Starting MCP HTTP server...${NC}"
    
    # Source clusters from test/clusters.json
    ONTAP_CLUSTERS=$(cat "$SCRIPT_DIR/clusters.json")
    export ONTAP_CLUSTERS
    
    cd "$PROJECT_ROOT"
    node build/index.js --http=3000 > "$LOG_DIR/server-$TIMESTAMP.log" 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to be ready
    for i in {1..30}; do
        if curl -s http://localhost:3000/mcp > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Server started (PID: $SERVER_PID)${NC}"
            return 0
        fi
        sleep 1
    done
    
    echo -e "${RED}✗ Server failed to start${NC}"
    return 1
}

# Function to stop server
stop_server() {
    echo -e "${YELLOW}Stopping MCP HTTP server...${NC}"
    pkill -f "node build/index.js --http=3000" || true
    sleep 2
    echo -e "${GREEN}✓ Server stopped${NC}"
}

# Function to run a single test
run_test() {
    local test_file=$1
    local mode=$2
    local test_name="${test_file%.js}"
    local log_file="$LOG_DIR/${test_name}-${mode}-$TIMESTAMP.log"
    
    echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Testing: $test_file (${mode} mode)${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    cd "$SCRIPT_DIR"
    
    if [ "$mode" = "stdio" ]; then
        # Run in STDIO mode
        if node "$test_file" 2>&1 | tee "$log_file"; then
            echo -e "${GREEN}✅ PASSED: $test_file (stdio)${NC}"
            return 0
        else
            echo -e "${RED}❌ FAILED: $test_file (stdio)${NC}"
            echo -e "${RED}   Log: $log_file${NC}"
            return 1
        fi
    else
        # Run in HTTP mode
        if node "$test_file" 2>&1 | tee "$log_file"; then
            echo -e "${GREEN}✅ PASSED: $test_file (http)${NC}"
            return 0
        else
            echo -e "${RED}❌ FAILED: $test_file (http)${NC}"
            echo -e "${RED}   Log: $log_file${NC}"
            return 1
        fi
    fi
}

# Main execution
main() {
    local specific_test=$1
    local passed=0
    local failed=0
    local failed_tests=()
    
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║     Standalone Test Validation Suite                  ║${NC}"
    echo -e "${YELLOW}║     $(date)                       ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════╝${NC}"
    
    # Build the project first
    echo -e "\n${YELLOW}Building project...${NC}"
    cd "$PROJECT_ROOT"
    if npm run build > "$LOG_DIR/build-$TIMESTAMP.log" 2>&1; then
        echo -e "${GREEN}✓ Build successful${NC}"
    else
        echo -e "${RED}✗ Build failed - check $LOG_DIR/build-$TIMESTAMP.log${NC}"
        exit 1
    fi
    
    # If specific test requested, filter to that
    if [ -n "$specific_test" ]; then
        echo -e "\n${YELLOW}Running specific test: $specific_test${NC}"
        TESTS=($(printf '%s\n' "${TESTS[@]}" | grep "$specific_test"))
    fi
    
    # Process each test
    for test_spec in "${TESTS[@]}"; do
        IFS=':' read -r test_file mode requires_server <<< "$test_spec"
        
        # Start server if needed and not running
        if [ "$requires_server" = "yes" ]; then
            if ! check_server; then
                if ! start_server; then
                    echo -e "${RED}Cannot run test - server start failed${NC}"
                    ((failed++))
                    failed_tests+=("$test_file ($mode) - server start failed")
                    continue
                fi
            fi
        else
            # Stop server if running (for STDIO tests)
            if check_server; then
                stop_server
            fi
        fi
        
        # Run the test
        if run_test "$test_file" "$mode"; then
            ((passed++))
        else
            ((failed++))
            failed_tests+=("$test_file ($mode)")
        fi
        
        # Brief pause between tests
        sleep 2
    done
    
    # Cleanup
    if check_server; then
        stop_server
    fi
    
    # Summary
    echo -e "\n${YELLOW}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║              Test Summary                              ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════╝${NC}"
    echo -e "Total Tests: $((passed + failed))"
    echo -e "${GREEN}✅ Passed: $passed${NC}"
    echo -e "${RED}❌ Failed: $failed${NC}"
    echo -e "Logs: $LOG_DIR"
    
    if [ $failed -gt 0 ]; then
        echo -e "\n${RED}Failed Tests:${NC}"
        for test in "${failed_tests[@]}"; do
            echo -e "  ${RED}- $test${NC}"
        done
        exit 1
    else
        echo -e "\n${GREEN}🎉 ALL STANDALONE TESTS PASSED!${NC}"
        exit 0
    fi
}

# Run main function
main "$@"
