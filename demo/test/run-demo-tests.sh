#!/bin/bash

# Demo Test Runner
# Runs all tests in the demo/test directory

echo "🧪 Running NetApp ONTAP MCP Demo Tests"
echo "======================================"

TEST_DIR="demo/test"
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Check if we're in the right directory
if [ ! -d "$TEST_DIR" ]; then
    echo "❌ Error: Run this script from the ONTAP-MCP project root"
    echo "   Expected directory: $TEST_DIR"
    exit 1
fi

# Find and run all test files
for test_file in "$TEST_DIR"/test-*.js; do
    if [ -f "$test_file" ]; then
        echo ""
        echo "▶️  Running: $(basename "$test_file")"
        echo "─────────────────────────────────────"
        
        TESTS_RUN=$((TESTS_RUN + 1))
        
        # Run the test and capture exit code
        if node "$test_file"; then
            TESTS_PASSED=$((TESTS_PASSED + 1))
            echo "✅ PASSED: $(basename "$test_file")"
        else
            TESTS_FAILED=$((TESTS_FAILED + 1))
            echo "❌ FAILED: $(basename "$test_file")"
        fi
    fi
done

echo ""
echo "🎯 Demo Test Summary"
echo "===================="
echo "Tests Run:    $TESTS_RUN"
echo "Tests Passed: $TESTS_PASSED" 
echo "Tests Failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo "🎉 All demo tests passed!"
    exit 0
else
    echo ""
    echo "⚠️  Some demo tests failed."
    exit 1
fi