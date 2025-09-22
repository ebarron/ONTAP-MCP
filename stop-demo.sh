#!/bin/bash

# NetApp ONTAP MCP Demo Stop Script
# 
# This script cleanly stops both demo servers and cleans up log files
#
# Usage: ./stop-demo.sh

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

print_status "Stopping NetApp ONTAP MCP Demo servers..."

# Stop MCP server
MCP_PIDS=$(pgrep -f "node build/index.js" 2>/dev/null || true)
if [[ -n "$MCP_PIDS" ]]; then
    print_status "Stopping MCP HTTP server..."
    pkill -f "node build/index.js"
    sleep 2
    print_success "MCP server stopped"
else
    print_status "MCP server not running"
fi

# Stop demo web server  
DEMO_PIDS=$(pgrep -f "python3 -m http.server" 2>/dev/null || true)
if [[ -n "$DEMO_PIDS" ]]; then
    print_status "Stopping demo web server..."
    pkill -f "python3 -m http.server"
    sleep 1
    print_success "Demo web server stopped"
else
    print_status "Demo web server not running"
fi

# Clean up log files
if [[ -f "mcp-server.log" ]]; then
    print_status "Cleaning up MCP server log..."
    rm -f mcp-server.log
fi

if [[ -f "demo-server.log" ]]; then
    print_status "Cleaning up demo server log..."
    rm -f demo-server.log
fi

print_success "✅ Demo servers stopped and cleaned up"