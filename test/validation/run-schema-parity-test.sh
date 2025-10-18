#!/bin/bash

# Tool Schema Parity Test Runner
# Starts both TypeScript and Go servers, runs comparison, then cleans up

set -e

echo "🚀 Tool Schema Parity Test Runner"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  
  if [ ! -z "$TS_PID" ]; then
    echo "  Stopping TypeScript server (PID: $TS_PID)..."
    kill $TS_PID 2>/dev/null || true
  fi
  
  if [ ! -z "$GO_PID" ]; then
    echo "  Stopping Go server (PID: $GO_PID)..."
    kill $GO_PID 2>/dev/null || true
  fi
  
  # Wait a moment for cleanup
  sleep 1
  
  echo "✅ Cleanup complete"
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# Check if servers are already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Port 3000 is already in use. Using existing Go server.${NC}"
  GO_RUNNING=true
else
  GO_RUNNING=false
fi

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Port 3001 is already in use. Using existing TypeScript server.${NC}"
  TS_RUNNING=true
else
  TS_RUNNING=false
fi

# Start TypeScript server if not running
if [ "$TS_RUNNING" = false ]; then
  echo "📡 Starting TypeScript MCP server on port 3001..."
  export MCP_PORT=3001
  nohup node build/index.js --http=3001 > /tmp/ts-mcp-server.log 2>&1 &
  TS_PID=$!
  echo "  Started with PID: $TS_PID"
  
  # Wait for server to be ready
  echo "  Waiting for TypeScript server to start..."
  for i in {1..10}; do
    if curl -s http://localhost:3001/health >/dev/null 2>&1; then
      echo -e "  ${GREEN}✅ TypeScript server ready${NC}"
      break
    fi
    sleep 1
  done
else
  echo "✅ Using existing TypeScript server on port 3001"
fi

# Start Go server if not running
if [ "$GO_RUNNING" = false ]; then
  echo "📡 Starting Go MCP server on port 3000..."
  export ONTAP_CLUSTERS="$(cat test/clusters.json)"
  nohup ./ontap-mcp-server --http=3000 > /tmp/go-mcp-server.log 2>&1 &
  GO_PID=$!
  echo "  Started with PID: $GO_PID"
  
  # Wait for server to be ready
  echo "  Waiting for Go server to start..."
  for i in {1..10}; do
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
      echo -e "  ${GREEN}✅ Go server ready${NC}"
      break
    fi
    sleep 1
  done
else
  echo "✅ Using existing Go server on port 3000"
fi

echo ""
echo "🔬 Running tool schema comparison..."
echo ""

# Run the comparison test
if node test/validation/test-tool-schema-parity.js; then
  echo ""
  echo -e "${GREEN}✅ All tool schemas match perfectly!${NC}"
  EXIT_CODE=0
else
  echo ""
  echo -e "${RED}❌ Schema mismatches detected${NC}"
  EXIT_CODE=1
fi

# Cleanup will happen automatically via trap
exit $EXIT_CODE
