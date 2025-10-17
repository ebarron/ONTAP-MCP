#!/bin/bash

# NetApp ONTAP MCP Demo Start Script (Go Version)
# 
# This script starts the Go implementation of the MCP server and demo web interface
#
# Requirements:
# - Go binary compiled at ./ontap-mcp-server
# - test/clusters.json with cluster configurations
# - demo/ directory with web interface
#
# Architecture:
# 1. MCP HTTP Server (Go): Port 3000 (Streamable HTTP - MCP 2025-06-18)
# 2. Demo Web Server (Python): Port 8080
#
# Usage: ./start-demo-go.sh
# Access demo at: http://localhost:8080

set -e  # Exit on error

# If not already backgrounded, relaunch in background with nohup
if [[ -z "$START_DEMO_GO_BACKGROUNDED" ]]; then
    export START_DEMO_GO_BACKGROUNDED=1
    echo "🚀 Launching Go demo in background..."
    nohup "$0" "$@" > start-demo.log 2>&1 &
    BG_PID=$!
    echo "✅ Go demo started in background (PID: $BG_PID)"
    echo "📋 Logs: start-demo.log"
    echo "🛑 To stop: ./stop-demo-go.sh"
    echo ""
    echo "Demo will be available at:"
    echo "  http://localhost:8080"
    echo ""
    echo "Waiting for servers to start..."
    sleep 8
    
    # Show initial status
    echo "Checking server status..."
    if pgrep -f "ontap-mcp-server" >/dev/null; then
        echo "✅ Go MCP server is running"
    else
        echo "❌ Go MCP server not detected - check start-demo.log"
    fi
    
    if lsof -ti :8080 >/dev/null 2>&1; then
        echo "✅ Demo web server is running on port 8080"
    else
        echo "❌ Demo web server not detected - check start-demo.log"
    fi
    
    echo ""
    echo "🌐 Open http://localhost:8080 to access the demo"
    exit 0
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[DEMO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[DEMO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[DEMO]${NC} $1"
}

print_error() {
    echo -e "${RED}[DEMO]${NC} $1"
}

# Cleanup function for graceful shutdown
cleanup() {
    echo
    print_status "Shutting down demo servers..."
    
    # Kill MCP server
    if [[ -n "${MCP_PID:-}" ]]; then
        kill $MCP_PID 2>/dev/null || true
    fi
    pkill -f "ontap-mcp-server" 2>/dev/null || true
    
    # Kill demo web server
    if [[ -n "${DEMO_PID:-}" ]]; then
        kill $DEMO_PID 2>/dev/null || true
    fi
    pkill -f "python3 -m http.server 8080" 2>/dev/null || true
    
    # Kill log monitor
    if [[ -n "${LOG_PID:-}" ]]; then
        kill $LOG_PID 2>/dev/null || true
    fi
    
    print_success "Demo stopped"
    exit 0
}

# Set up cleanup on exit
trap cleanup SIGINT SIGTERM

# Step 1: Verify we're in the correct directory
if [[ ! -f "start-demo-go.sh" ]]; then
    print_error "Must run from ONTAP-MCP root directory"
    exit 1
fi

print_status "Starting NetApp ONTAP MCP Demo (Go Version)..."

# Step 2: Check for Go binary
if [[ ! -f "ontap-mcp-server" ]]; then
    print_error "Go binary not found: ./ontap-mcp-server"
    print_error "Please build first with: go build -o ontap-mcp-server ./cmd/mcp-server"
    exit 1
fi

# Step 3: Load cluster configurations
print_status "Loading cluster configurations..."

if [[ ! -f "test/clusters.json" ]]; then
    print_error "test/clusters.json not found"
    print_error "Run ./test/setup-test-env.sh to create cluster configuration"
    exit 1
fi

# Validate clusters.json is valid JSON
if ! jq empty test/clusters.json 2>/dev/null; then
    print_error "test/clusters.json is not valid JSON"
    exit 1
fi

# Load clusters into environment variable
# Go server reads ONTAP_CLUSTERS env var directly
CLUSTERS_JSON=$(cat test/clusters.json)
CLUSTER_COUNT=$(echo "$CLUSTERS_JSON" | jq 'length')

if [[ "$CLUSTER_COUNT" -eq 0 ]]; then
    print_error "No clusters configured in test/clusters.json"
    exit 1
fi

print_success "Loaded $CLUSTER_COUNT cluster(s) from test/clusters.json"

# Step 3.5: Stop any existing demo servers
print_status "Checking for existing demo servers..."

# Stop previous instances of start-demo-go.sh
if pgrep -f "start-demo-go.sh" >/dev/null 2>&1; then
    print_status "Stopping existing start-demo-go.sh processes..."
    pkill -f "start-demo-go.sh"
    sleep 2
fi

# Stop Go MCP server
if pgrep -f "ontap-mcp-server" >/dev/null 2>&1; then
    print_status "Stopping existing Go MCP server..."
    pkill -f "ontap-mcp-server"
    sleep 2
fi

# Stop Python demo server on port 8080
if lsof -ti :8080 >/dev/null 2>&1; then
    print_status "Stopping existing demo web server on port 8080..."
    lsof -ti :8080 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

sleep 2

# Check for port conflicts (only check for LISTEN state)
if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
    print_error "Port 3000 is in use by another process:"
    lsof -i :3000 -sTCP:LISTEN
    print_error "Please stop the conflicting process and try again"
    exit 1
fi

if lsof -i :8080 -sTCP:LISTEN >/dev/null 2>&1; then
    print_warning "Port 8080 is in use. Attempting to free it..."
    lsof -ti :8080 | xargs kill -9 2>/dev/null || true
    sleep 2
    if lsof -i :8080 >/dev/null 2>&1; then
        print_error "Cannot free port 8080. Please stop the conflicting process manually:"
        lsof -i :8080
        exit 1
    fi
    print_success "Port 8080 freed successfully"
fi

# Step 4: Start Go MCP HTTP server with all clusters
print_status "Starting Go MCP HTTP server on port 3000 (Streamable HTTP - MCP 2025-06-18)..."
export ONTAP_CLUSTERS="$CLUSTERS_JSON"

# Launch Go server in background
nohup ./ontap-mcp-server --http=3000 > mcp-server.log 2>&1 &
MCP_PID=$!

# Wait for MCP server to start
sleep 3

# Check if MCP server is running
if ! kill -0 $MCP_PID 2>/dev/null; then
    print_error "Go MCP server failed to start"
    print_error "Check mcp-server.log for details:"
    tail -n 20 mcp-server.log
    exit 1
fi

# Test MCP server health
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    print_success "Go MCP HTTP server started successfully on port 3000"
else
    print_error "Go MCP server not responding to health check"
    print_error "Check mcp-server.log for details:"
    tail -n 20 mcp-server.log
    exit 1
fi

# Step 5: Start demo web server from demo directory
print_status "Starting demo web server on port 8080..."

# Ensure we start from the demo directory
if [[ ! -d "demo" ]]; then
    print_error "demo/ directory not found"
    exit 1
fi

cd demo || exit 1
nohup python3 -m http.server 8080 > ../demo-server.log 2>&1 &
DEMO_PID=$!

# Return to root directory
cd .. || exit 1

# Wait for demo server to start
sleep 3

# Check if demo server is running
if ! kill -0 $DEMO_PID 2>/dev/null; then
    print_error "Demo web server failed to start"
    print_error "Check demo-server.log for details:"
    tail -n 10 demo-server.log
    exit 1
fi

# Test demo server - should serve the demo HTML
DEMO_TEST=$(curl -s http://localhost:8080 | head -n 5)
if echo "$DEMO_TEST" | grep -qi "<!DOCTYPE html"; then
    if echo "$DEMO_TEST" | grep -q "Directory listing"; then
        print_error "Demo server showing directory listing instead of demo interface"
        print_error "This indicates the server didn't start from the demo/ directory"
        exit 1
    else
        print_success "Demo web server started successfully on port 8080"
        print_success "Demo serving from demo/ directory (no /demo URL suffix needed)"
    fi
else
    print_warning "Demo server started but content validation inconclusive"
    print_status "Demo should be accessible at http://localhost:8080"
fi

# Step 6: Final validation - test MCP API connectivity
print_status "Validating MCP API connectivity..."
CLUSTER_TEST=$(curl -s -X POST http://localhost:3000/api/tools/list_registered_clusters \
    -H "Content-Type: application/json" -d '{}' 2>/dev/null | head -c 100)

if [[ -n "$CLUSTER_TEST" ]]; then
    print_success "MCP API responding correctly"
else
    print_warning "MCP API test failed - check cluster connectivity"
fi

# Success message and instructions
echo
print_success "🚀 NetApp ONTAP MCP Demo is ready! (Go Implementation)"
echo
echo -e "${GREEN}=================================="
echo -e "  Demo Access Information"  
echo -e "==================================${NC}"
echo -e "${BLUE}Demo URL:${NC}        http://localhost:8080"
echo -e "${BLUE}MCP API:${NC}         http://localhost:3000"
echo -e "${BLUE}Implementation:${NC}  Go (./ontap-mcp-server)"
echo -e "${BLUE}Clusters:${NC}        $CLUSTER_COUNT loaded from test/clusters.json"
echo -e "${BLUE}Logs:${NC}            mcp-server.log, demo-server.log"
echo
echo -e "${YELLOW}Important:${NC} Demo web server is running from demo/ directory"
echo -e "${YELLOW}          ${NC} No need to add /demo to the URL!"
echo
echo -e "${GREEN}To test the provisioning workflow:${NC}"
echo -e "  1. Open http://localhost:8080 in your browser"
echo -e "  2. Click 'Provision Storage' to start testing"
echo -e "  3. Select cluster, SVM, and configure volume"
echo -e "  4. Submit to test complete MCP API workflow"
echo
echo -e "${BLUE}To stop servers:${NC} ./stop-demo-go.sh"
echo -e "${BLUE}View logs:${NC} tail -f mcp-server.log (or demo-server.log)"
echo

# Keep servers running until cleanup signal
# This runs in background via nohup, so it will continue even after script exits
print_success "Servers are running in background"
print_status "Use ./stop-demo-go.sh to stop the demo"

# Exit cleanly - servers continue in background
exit 0
