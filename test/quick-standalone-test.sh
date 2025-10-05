#!/bin/bash
# Quick standalone test runner - tests each file individually
# Usage: ./test/quick-standalone-test.sh

set -e

cd "$(dirname "$0")/.."

echo "Quick Standalone Test Runner"
echo "============================="
echo ""

# Tests that work in STDIO mode (no server needed)
STDIO_TESTS=(
    "test-tool-discovery.js"
    "test-mcp-spec-compliance.js"
    "test-cluster-info.js"
    "test-volume-lifecycle.js stdio"
    "test-export-policy-lifecycle.js stdio"
    "test-cifs-lifecycle.js stdio"
    "test-qos-lifecycle.js stdio"
)

# Tests that require HTTP server
HTTP_TESTS=(
    "test-response-format-validation.js"
    "test-snapshot-policy-formats.js"
    "test-session-management.js"
    "test-session-isolation.js"
    "test-mcp-jsonrpc.js"
    "test-param-filtering.js"
)

# Other tests to check
OTHER_TESTS=(
    "test-comprehensive.js"
    "test-cifs-creation-acl.js"
    "test-user-scenario.js"
)

passed=0
failed=0
skipped=0

echo "🧪 Testing STDIO Mode Tests (no server needed)"
echo "=============================================="
for test in "${STDIO_TESTS[@]}"; do
    echo ""
    echo -n "Testing: $test ... "
    
    # Run without timeout on macOS
    if node test/$test > /tmp/test-output.txt 2>&1; then
        echo "✅ PASS"
        ((passed++))
    else
        exit_code=$?
        echo "❌ FAIL (exit code: $exit_code)"
        ((failed++))
        echo "   Last 10 lines of output:"
        tail -10 /tmp/test-output.txt | sed 's/^/   /'
    fi
done

echo ""
echo ""
echo "📊 Summary"
echo "=========="
echo "Passed:  $passed"
echo "Failed:  $failed"
echo "Skipped: $skipped"
echo ""

if [ $failed -eq 0 ]; then
    echo "✅ All tested files passed!"
    exit 0
else
    echo "❌ Some tests failed"
    exit 1
fi
