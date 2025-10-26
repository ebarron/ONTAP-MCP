#!/usr/bin/env python3
"""
Grafana Viewer CORS Proxy with X-Frame-Options Stripping

This proxy allows embedding Grafana dashboards in iframes by:
1. Adding CORS headers for cross-origin requests
2. Removing X-Frame-Options header that blocks iframe embedding
3. Removing Content-Security-Policy frame-ancestors directive

Routes localhost:3001 -> 10.193.49.74:3000 (Grafana viewer)
"""
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error

PROXY_PORT = 3001
GRAFANA_URL = "http://10.193.49.74:3000"
ALLOWED_ORIGINS = ["http://localhost:8080", "http://localhost:3001"]

# Grafana authentication (set to None to disable anonymous access requirement)
# If your Grafana requires auth, set username/password here
GRAFANA_AUTH = None  # Set to ('username', 'password') if auth required

# Headers to strip (prevent iframe blocking)
BLOCKED_HEADERS = [
    'x-frame-options',
    'content-security-policy',
    'x-content-security-policy',
]

class GrafanaViewerProxyHandler(BaseHTTPRequestHandler):
    def _get_allowed_origin(self):
        """Get the allowed origin based on request origin"""
        request_origin = self.headers.get('Origin', '')
        if request_origin in ALLOWED_ORIGINS:
            return request_origin
        # For direct browser access (no Origin header), allow wildcard
        return '*'
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        allowed_origin = self._get_allowed_origin()
        self.send_header('Access-Control-Allow-Origin', allowed_origin)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Grafana-Org-Id')
        if allowed_origin != '*':
            self.send_header('Access-Control-Allow-Credentials', 'true')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()
    
    def do_GET(self):
        """Proxy GET requests"""
        self._proxy_request('GET')
    
    def do_POST(self):
        """Proxy POST requests"""
        self._proxy_request('POST')
    
    def do_PUT(self):
        """Proxy PUT requests"""
        self._proxy_request('PUT')
    
    def do_DELETE(self):
        """Proxy DELETE requests"""
        self._proxy_request('DELETE')
    
    def _proxy_request(self, method):
        """Forward request to Grafana with CORS headers and stripped X-Frame-Options"""
        try:
            # Build target URL
            target = GRAFANA_URL + self.path
            
            # Read request body for POST/PUT
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else None
            
            # Create request
            req = urllib.request.Request(target, data=body, method=method)
            
            # Add Grafana authentication if configured
            if GRAFANA_AUTH:
                import base64
                credentials = base64.b64encode(f'{GRAFANA_AUTH[0]}:{GRAFANA_AUTH[1]}'.encode()).decode()
                req.add_header('Authorization', f'Basic {credentials}')
            
            # Copy headers (except Host, Content-Length, Origin, and Referer)
            # We'll rewrite Origin and Referer to make Grafana accept the login
            for key, value in self.headers.items():
                if key.lower() not in ['host', 'content-length', 'origin', 'referer']:
                    req.add_header(key, value)
            
            # Rewrite Origin and Referer to match Grafana's URL
            # This makes Grafana's CSRF protection accept the request
            req.add_header('Origin', GRAFANA_URL)
            if self.headers.get('Referer'):
                # Replace proxy URL with Grafana URL in referer
                referer = self.headers.get('Referer')
                referer = referer.replace('http://localhost:3001', GRAFANA_URL)
                req.add_header('Referer', referer)
            
            # Forward request
            with urllib.request.urlopen(req) as response:
                # Send response
                self.send_response(response.status)
                
                # Add CORS headers
                allowed_origin = self._get_allowed_origin()
                self.send_header('Access-Control-Allow-Origin', allowed_origin)
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Grafana-Org-Id')
                if allowed_origin != '*':
                    self.send_header('Access-Control-Allow-Credentials', 'true')
                
                # Copy response headers, EXCLUDING blocked headers
                for key, value in response.headers.items():
                    key_lower = key.lower()
                    
                    # Skip CORS headers (we add our own)
                    if key_lower.startswith('access-control-'):
                        continue
                    
                    # Skip headers that block iframe embedding
                    if key_lower in BLOCKED_HEADERS:
                        print(f"   ✂️  Stripped header: {key}: {value}")
                        continue
                    
                    # Copy all other headers
                    self.send_header(key, value)
                
                self.end_headers()
                
                # Copy response body
                self.wfile.write(response.read())
                
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', self._get_allowed_origin())
            if self._get_allowed_origin() != '*':
                self.send_header('Access-Control-Allow-Credentials', 'true')
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
    print(f"🖼️  Starting Grafana Viewer Proxy (iframe embedding enabled)...")
    print(f"   Listening on: http://localhost:{PROXY_PORT}")
    print(f"   Forwarding to: {GRAFANA_URL}")
    print(f"   Allowing origins: {', '.join(ALLOWED_ORIGINS)}")
    print(f"   Plus wildcard for direct browser access")
    print(f"   Stripped headers: {', '.join(BLOCKED_HEADERS)}")
    print()
    
    server = HTTPServer(('localhost', PROXY_PORT), GrafanaViewerProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n⏹️  Stopping Grafana Viewer proxy...")
        server.shutdown()
