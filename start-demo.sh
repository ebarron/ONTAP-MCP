#!/bin/bash

# NetApp ONTAP MCP Demo Startup Script
# 
# This script properly starts both servers required for the demo:
# 1. MCP HTTP server with all clusters from test/clusters.json
# 2. Demo web server from the demo directory (no /demo URL suffix needed)
#
# Usage: ./start-demo.sh
# Access demo at: http://localhost:8080 (no /demo suffix needed)

set -e  # Exit on any error

# If not already backgrounded, relaunch in background with nohup
if [[ -z "$START_DEMO_BACKGROUNDED" ]]; then
    export START_DEMO_BACKGROUNDED=1
    echo "🚀 Launching demo in background..."
    nohup "$0" "$@" > start-demo.log 2>&1 &
    BG_PID=$!
    echo "✅ Demo started in background (PID: $BG_PID)"
    echo "📋 Logs: start-demo.log"
    echo "🛑 To stop: ./stop-demo.sh"
    echo ""
    echo "Demo will be available at:"
    echo "  http://localhost:8080"
    echo ""
    echo "Waiting for servers to start..."
    sleep 5
    
    # Show initial status
    if ps -p $BG_PID > /dev/null 2>&1; then
        echo "✅ Demo is running"
        tail -20 start-demo.log
    else
        echo "❌ Demo failed to start. Check start-demo.log for details"
        exit 1
    fi
    exit 0
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to cleanup background processes on exit (only if Ctrl+C in foreground)
cleanup() {
    # Only cleanup if we receive an interrupt signal
    # Don't cleanup on normal exit (EXIT trap) to keep servers running
    print_status "Shutting down demo servers..."
    pkill -f "node build/index.js" 2>/dev/null || true
    pkill -f "python3 -m http.server" 2>/dev/null || true
    pkill -f "start-demo.sh" 2>/dev/null || true  # Kill monitoring loops
    print_success "Demo servers stopped"
    exit 0
}

# Set up cleanup only on interrupt signals, not EXIT
trap cleanup INT TERM

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -d "demo" ]] || [[ ! -d "test" ]]; then
    print_error "Please run this script from the ONTAP-MCP root directory"
    print_error "Expected structure: package.json, demo/, test/ directories"
    exit 1
fi

# Check if clusters.json exists
if [[ ! -f "test/clusters.json" ]]; then
    print_error "test/clusters.json not found"
    print_error "Please ensure cluster configuration file exists"
    exit 1
fi

# Check if demo files exist
if [[ ! -f "demo/index.html" ]] || [[ ! -f "demo/app.js" ]]; then
    print_error "Demo files not found in demo/ directory"
    print_error "Please ensure demo/index.html and demo/app.js exist"
    exit 1
fi

print_status "Starting NetApp ONTAP MCP Demo..."

# Step 1: Build the MCP server if needed
if [[ ! -f "build/index.js" ]] || [[ "src/index.ts" -nt "build/index.js" ]]; then
    print_status "Building MCP server..."
    npm run build
    if [[ $? -ne 0 ]]; then
        print_error "Build failed"
        exit 1
    fi
    print_success "MCP server built successfully"
else
    print_status "Using existing build (up to date)"
fi

# Step 2: Convert clusters.json to environment variable format
print_status "Loading cluster configuration from test/clusters.json..."

# Read clusters.json and convert to ONTAP_CLUSTERS format
CLUSTERS_JSON=$(node -e "
const fs = require('fs');
const clusters = JSON.parse(fs.readFileSync('test/clusters.json', 'utf8'));
const clusterArray = Object.entries(clusters).map(([name, config]) => ({
    name: name,
    cluster_ip: config.cluster_ip,
    username: config.username,
    password: config.password,
    description: config.description
}));
console.log(JSON.stringify(clusterArray));
")

if [[ $? -ne 0 ]] || [[ -z "$CLUSTERS_JSON" ]]; then
    print_error "Failed to parse test/clusters.json"
    exit 1
fi

# Count clusters
CLUSTER_COUNT=$(echo "$CLUSTERS_JSON" | node -e "
const clusters = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(clusters.length);
")

print_success "Loaded $CLUSTER_COUNT clusters from configuration file"

# Step 3: Kill any existing servers and check for port conflicts
print_status "Stopping any existing demo servers..."
pkill -f "node build/index.js" 2>/dev/null || true
pkill -f "python3 -m http.server" 2>/dev/null || true
sleep 2

# Check for port conflicts
if lsof -i :3000 >/dev/null 2>&1; then
    print_error "Port 3000 is in use by another process:"
    lsof -i :3000
    print_error "Please stop the conflicting process and try again"
    exit 1
fi

if lsof -i :8080 >/dev/null 2>&1; then
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

# Step 4: Start MCP HTTP server with all clusters (Streamable HTTP transport)
print_status "Starting MCP HTTP server on port 3000 (Streamable HTTP - MCP 2025-06-18)..."
export ONTAP_CLUSTERS="$CLUSTERS_JSON"
# export HARVEST_TSDB_URL="http://10.193.49.74:9090"
nohup node build/index.js --http=3000 > mcp-server.log 2>&1 &
MCP_PID=$!

# Wait for MCP server to start
sleep 3

# Check if MCP server is running
if ! kill -0 $MCP_PID 2>/dev/null; then
    print_error "MCP server failed to start"
    print_error "Check mcp-server.log for details:"
    tail -n 20 mcp-server.log
    exit 1
fi

# Test MCP server health
if curl -s http://localhost:3000/health > /dev/null; then
    print_success "MCP HTTP server started successfully on port 3000"
else
    print_error "MCP server not responding to health check"
    exit 1
fi

# Step 5: Start demo web server from demo directory
print_status "Starting demo web server on port 8080..."

# Ensure we start from the demo directory to avoid /demo URL suffix
if [[ ! -d "demo" ]]; then
    print_error "demo/ directory not found"
    exit 1
fi

cd demo || exit 1
nohup python3 -m http.server 8080 > ../demo-server.log 2>&1 &
DEMO_PID=$!

# Return to root directory for remaining operations
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

# Test demo server - should serve the demo HTML, not a directory listing
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
    -H "Content-Type: application/json" -d '{}' | head -c 100)

if [[ -n "$CLUSTER_TEST" ]]; then
    print_success "MCP API responding correctly"
else
    print_warning "MCP API test failed - check cluster connectivity"
fi

# Success message and instructions
echo
print_success "🚀 NetApp ONTAP MCP Demo is ready!"
echo
echo -e "${GREEN}=================================="
echo -e "  Demo Access Information"  
echo -e "==================================${NC}"
echo -e "${BLUE}Demo URL:${NC}        http://localhost:8080"
echo -e "${BLUE}MCP API:${NC}         http://localhost:3000"
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
echo -e "${BLUE}Press Ctrl+C to stop both servers${NC}"

# Keep script running and show live logs
print_status "Monitoring servers... (Press Ctrl+C to stop)"
echo

# Function to show rotating logs
show_logs() {
    while true; do
        if [[ -f mcp-server.log ]]; then
            echo -e "${BLUE}--- MCP Server Activity (last 3 lines) ---${NC}"
            tail -n 3 mcp-server.log 2>/dev/null || echo "No recent activity"
        fi
        
        if [[ -f demo-server.log ]]; then
            echo -e "${BLUE}--- Demo Server Activity (last 3 lines) ---${NC}"  
            tail -n 3 demo-server.log 2>/dev/null || echo "No recent activity"
        fi
        
        sleep 10
        echo "---"
    done
}

# Start log monitoring in background
show_logs &
LOG_PID=$!

# Wait for user interrupt
wait