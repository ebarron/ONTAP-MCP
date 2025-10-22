#!/bin/bash

# NetApp ONTAP MCP Demo Stop Script (Go Version)
# 
# This script cleanly stops both Go demo servers and cleans up log files
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

print_status "Stopping NetApp ONTAP MCP Demo servers (Go Version)..."

# Stop Grafana proxies
CORS_PIDS=$(pgrep -f "grafana-cors-proxy.sh" 2>/dev/null || true)
if [[ -n "$CORS_PIDS" ]]; then
    print_status "Stopping Grafana MCP CORS proxy..."
    pkill -f "grafana-cors-proxy.sh"
    sleep 1
    print_success "Grafana MCP CORS proxy stopped"
else
    print_status "Grafana MCP CORS proxy not running"
fi

VIEWER_PIDS=$(pgrep -f "grafana-viewer-proxy.sh" 2>/dev/null || true)
if [[ -n "$VIEWER_PIDS" ]]; then
    print_status "Stopping Grafana Viewer proxy..."
    pkill -f "grafana-viewer-proxy.sh"
    sleep 1
    print_success "Grafana Viewer proxy stopped"
else
    print_status "Grafana Viewer proxy not running"
fi

# Stop any lingering start-demo.sh processes first
START_DEMO_PIDS=$(pgrep -f "start-demo.sh" 2>/dev/null || true)
if [[ -n "$START_DEMO_PIDS" ]]; then
    print_status "Stopping start-demo.sh monitoring processes..."
    pkill -f "start-demo.sh"
    sleep 1
    print_success "start-demo.sh processes stopped"
else
    print_status "No start-demo.sh processes running"
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

if [[ -f "grafana-cors-proxy.log" ]]; then
    print_status "Cleaning up MCP CORS proxy log..."
    rm -f grafana-cors-proxy.log
fi

if [[ -f "grafana-viewer-proxy.log" ]]; then
    print_status "Cleaning up Viewer proxy log..."
    rm -f grafana-viewer-proxy.log
fi

print_success "✅ Go demo servers stopped and cleaned up"
