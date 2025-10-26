#!/usr/bin/env python3
"""
CORS Proxy for Grafana MCP Server
Routes localhost:8001 -> localhost:8000 with CORS headers
"""
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error

PROXY_PORT = 8001
TARGET_URL = "http://localhost:8000"
ALLOWED_ORIGINS = ["http://localhost:8080", "http://localhost:8001"]

class CORSProxyHandler(BaseHTTPRequestHandler):
    def _get_allowed_origin(self):
        """Get the allowed origin based on request origin"""
        request_origin = self.headers.get('Origin', '')
        if request_origin in ALLOWED_ORIGINS:
            return request_origin
        # Default to localhost:8080 for non-CORS requests (direct browser access)
        return '*'
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', self._get_allowed_origin())
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()
    
    def do_GET(self):
        """Proxy GET requests"""
        self._proxy_request('GET')
    
    def do_POST(self):
        """Proxy POST requests"""
        self._proxy_request('POST')
    
    def _proxy_request(self, method):
        """Forward request to target server with CORS headers"""
        try:
            # Build target URL
            target = TARGET_URL + self.path
            
            # Read request body for POST
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else None
            
            # Create request
            req = urllib.request.Request(target, data=body, method=method)
            
            # Copy headers (except Host)
            for key, value in self.headers.items():
                if key.lower() not in ['host', 'content-length', 'origin']:
                    req.add_header(key, value)
            
            # Forward request
            with urllib.request.urlopen(req) as response:
                # Send response
                self.send_response(response.status)
                
                # Add CORS headers
                allowed_origin = self._get_allowed_origin()
                self.send_header('Access-Control-Allow-Origin', allowed_origin)
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version')
                if allowed_origin != '*':
                    self.send_header('Access-Control-Allow-Credentials', 'true')
                
                # Copy response headers
                for key, value in response.headers.items():
                    if key.lower() not in ['access-control-allow-origin', 'access-control-allow-credentials']:
                        self.send_header(key, value)
                
                self.end_headers()
                
                # Copy response body
                self.wfile.write(response.read())
                
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', self._get_allowed_origin())
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            print(f"❌ Proxy error: {e}", file=sys.stderr)
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', self._get_allowed_origin())
            self.end_headers()
            self.wfile.write(f"Proxy error: {e}".encode())
    
    def log_message(self, format, *args):
        """Custom log format"""
        print(f"🔄 {self.address_string()} - {format % args}")

if __name__ == '__main__':
    print(f"🔧 Starting CORS proxy...")
    print(f"   Listening on: http://localhost:{PROXY_PORT}")
    print(f"   Forwarding to: {TARGET_URL}")
    print(f"   Allowing origins: {', '.join(ALLOWED_ORIGINS)}")
    print(f"   Plus wildcard for direct browser access")
    print()
    
    server = HTTPServer(('localhost', PROXY_PORT), CORSProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n⏹️  Stopping CORS proxy...")
        server.shutdown()
