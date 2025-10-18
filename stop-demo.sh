#!/bin/bash

# NetApp ONTAP MCP Demo Stop Script (Go Version)
# 
# This script cleanly stops both Go demo servers and cleans up log files
#
# Usage: ./stop-demo-go.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[DEMO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[DEMO]${NC} $1"
}

print_status "Stopping NetApp ONTAP MCP Demo servers (Go Version)..."

# Stop any lingering start-demo-go.sh processes first
START_DEMO_PIDS=$(pgrep -f "start-demo-go.sh" 2>/dev/null || true)
if [[ -n "$START_DEMO_PIDS" ]]; then
    print_status "Stopping start-demo-go.sh monitoring processes..."
    pkill -f "start-demo-go.sh"
    sleep 1
    print_success "start-demo-go.sh processes stopped"
else
    print_status "No start-demo-go.sh processes running"
fi

# Stop Go MCP server
MCP_PIDS=$(pgrep -f "ontap-mcp-server" 2>/dev/null || true)
if [[ -n "$MCP_PIDS" ]]; then
    print_status "Stopping Go MCP HTTP server..."
    pkill -f "ontap-mcp-server"
    sleep 2
    
    # Verify it's stopped
    if pgrep -f "ontap-mcp-server" >/dev/null 2>&1; then
        print_status "Force killing Go MCP server..."
        pkill -9 -f "ontap-mcp-server"
        sleep 1
    fi
    
    print_success "Go MCP server stopped"
else
    print_status "Go MCP server not running"
fi

# Stop demo web server  
DEMO_PIDS=$(pgrep -f "python3 -m http.server 8080" 2>/dev/null || true)
if [[ -n "$DEMO_PIDS" ]]; then
    print_status "Stopping demo web server..."
    pkill -f "python3 -m http.server 8080"
    sleep 1
    print_success "Demo web server stopped"
else
    print_status "Demo web server not running"
fi

# Clean up log files
if [[ -f "mcp-server.log" ]]; then
    print_status "Cleaning up Go MCP server log..."
    rm -f mcp-server.log
fi

if [[ -f "demo-server.log" ]]; then
    print_status "Cleaning up demo server log..."
    rm -f demo-server.log
fi

print_success "✅ Go demo servers stopped and cleaned up"
