#!/bin/bash
# Quick Standalone Test Runner
# Tests all STDIO-mode tests that work without HTTP server

echo "🧪 Running All Standalone Tests (STDIO Mode)"
echo "=============================================="
echo ""

PASS=0
FAIL=0
TOTAL=0

run_test() {
    local test_name=$1
    local cmd=$2
    
    ((TOTAL++))
    echo -n "Testing $test_name... "
    
    if eval "$cmd" > /tmp/quick-test-$TOTAL.log 2>&1; then
        echo "✅ PASS"
        ((PASS++))
    else
        echo "❌ FAIL"
        ((FAIL++))
        echo "   Log: /tmp/quick-test-$TOTAL.log"
    fi
}

# Run all standalone tests
run_test "tool-discovery" "node test/test-tool-discovery.js | grep -q 'STDIO mode: ✅ PASS'"
run_test "mcp-spec-compliance" "node test/test-mcp-spec-compliance.js | grep -q 'ALL MCP SPECIFICATION COMPLIANCE TESTS PASSED'"
run_test "cluster-info" "node test/test-cluster-info.js | grep -q 'All tests passed'"
run_test "volume-lifecycle" "node test/test-volume-lifecycle.js stdio | grep -q 'Volume Lifecycle Test (STDIO) PASSED'"
run_test "export-policy" "node test/test-export-policy-lifecycle.js stdio | grep -q 'STDIO Mode: ✅ PASSED'"
run_test "cifs-lifecycle" "node test/test-cifs-lifecycle.js stdio | grep -q 'CIFS Share Lifecycle Test completed successfully'"
run_test "qos-lifecycle" "node test/test-qos-lifecycle.js stdio | grep -q 'QoS Policy Lifecycle Test (STDIO) PASSED'"
run_test "param-filtering" "node test/test-param-filtering.js | grep -q 'false'"
run_test "user-scenario" "node test/test-user-scenario.js | grep -q 'User scenario test completed successfully'"

echo ""
echo "=============================================="
echo "📊 Results: $PASS/$TOTAL passed"
echo "=============================================="

if [ $FAIL -eq 0 ]; then
    echo "✅ All standalone tests PASSED!"
    exit 0
else
    echo "❌ $FAIL test(s) failed"
    exit 1
fi
