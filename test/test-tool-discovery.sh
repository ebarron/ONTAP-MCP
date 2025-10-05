#!/bin/bash
# NetApp ONTAP MCP Server - Tool Discovery Test
set -e

echo "=== ONTAP MCP Tool Discovery Test ==="
EXPECTED_TOOL_COUNT=47

echo "Testing HTTP mode via MCP protocol..."
# Load clusters from clusters.json (handle both running from root and test dir)
if [ -f "test/clusters.json" ]; then
    export ONTAP_CLUSTERS=$(cat test/clusters.json)
elif [ -f "clusters.json" ]; then
    export ONTAP_CLUSTERS=$(cat clusters.json)
else
    echo "❌ clusters.json not found"
    exit 1
fi

node build/index.js --http=3000 > /tmp/test-discovery-server.log 2>&1 &
MCP_PID=$!
sleep 3

HTTP_TOOL_COUNT=$(node test/mcp-test-client.js http://localhost:3000 tools/list 2>/dev/null | jq -r '.tools | length' || echo "0")
echo "HTTP mode returned $HTTP_TOOL_COUNT tools"

kill $MCP_PID 2>/dev/null || true
wait $MCP_PID 2>/dev/null || true

echo "Results: Expected $EXPECTED_TOOL_COUNT, Got $HTTP_TOOL_COUNT"

if [[ "$HTTP_TOOL_COUNT" -eq "$EXPECTED_TOOL_COUNT" ]]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Tool count mismatch"
    exit 1
fi
