# Grafana MCP CORS Proxy

## Problem
The Grafana MCP server (running on `localhost:8000` via SSH tunnel) does not support CORS headers, causing browser requests from the demo (`http://localhost:8080`) to be blocked with:

```
Access to fetch at 'http://localhost:8000/mcp/mcp' from origin 'http://localhost:8080' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check
```

## Solution
A lightweight Python proxy (`grafana-cors-proxy.sh`) that:
- Listens on **port 8001**
- Forwards requests to **localhost:8000** (Grafana MCP server)
- Adds CORS headers to responses:
  - `Access-Control-Allow-Origin: http://localhost:8080`
  - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, Authorization, Mcp-Session-Id`

## Architecture
```
Browser (localhost:8080)
    ↓ (with CORS)
CORS Proxy (localhost:8001)
    ↓ (without CORS restrictions)
Grafana MCP Server (localhost:8000)
    ↓ (SSH tunnel)
Remote Grafana Instance
```

## Usage

### Automatic Start
The CORS proxy starts automatically with the demo:
```bash
./scripts/start-demo.sh
```

### Manual Start
To run the CORS proxy independently:
```bash
python3 ./scripts/grafana-cors-proxy.sh
```

Output:
```
🔧 Starting CORS proxy...
   Listening on: http://localhost:8001
   Forwarding to: http://localhost:8000
   Allowing origin: http://localhost:8080
```

### Stop
```bash
./scripts/stop-demo.sh  # Stops all demo servers including proxy
# OR
pkill -f grafana-cors-proxy.sh  # Stop proxy only
```

## Configuration

### Demo MCP Config
The demo configuration (`demo/mcp.json`) points to the CORS proxy:
```json
{
  "servers": {
    "grafana-remote": {
      "type": "sse",
      "url": "http://localhost:8001/mcp",  // <- CORS proxy port
      "viewer_url": "http://10.193.49.74:3000",
      "enabled": true
    }
  }
}
```

### Proxy Settings
Edit `scripts/grafana-cors-proxy.sh` to customize:
- `PROXY_PORT = 8001` - Port the proxy listens on
- `TARGET_URL = "http://localhost:8000"` - Grafana MCP server URL
- `ALLOWED_ORIGIN = "http://localhost:8080"` - Demo origin

## Troubleshooting

### Proxy Not Starting
Check if port 8001 is already in use:
```bash
lsof -i :8001
```

### Still Getting CORS Errors
1. Verify proxy is running:
   ```bash
   ps aux | grep grafana-cors-proxy
   ```

2. Check proxy logs:
   ```bash
   tail -f grafana-cors-proxy.log
   ```

3. Verify demo is pointing to proxy port 8001 in `demo/mcp.json`

### Connection Refused
Ensure the Grafana MCP server is running on port 8000:
```bash
lsof -i :8000
curl http://localhost:8000/mcp
```

## Alternative Solutions

### 1. Local Grafana MCP Server (Recommended for Development)
Run Grafana MCP locally instead of via SSH tunnel:
```bash
docker run --rm -p 8000:8000 \
  -e GRAFANA_URL=http://10.193.49.74:3000 \
  -e GRAFANA_SERVICE_ACCOUNT_TOKEN=<token> \
  mcp/grafana -t streamable-http
```

### 2. Nginx Reverse Proxy
For production, use Nginx with CORS configuration:
```nginx
server {
    listen 8001;
    location / {
        proxy_pass http://localhost:8000;
        add_header Access-Control-Allow-Origin http://localhost:8080;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, Mcp-Session-Id";
    }
}
```

### 3. Browser Extension (Development Only)
Use a CORS-disabling browser extension (NOT recommended for production).

## Security Notes
- The proxy allows CORS **only** from `http://localhost:8080`
- This is safe for local development
- For production, use proper authentication and restrict origins
- The proxy is HTTP-only - use HTTPS in production

## Logs
Proxy logs are written to `grafana-cors-proxy.log` showing:
- Forwarded requests
- Response status codes
- Any proxy errors

Example log output:
```
🔄 127.0.0.1 - "POST /mcp HTTP/1.1" 200 -
🔄 127.0.0.1 - "GET /mcp HTTP/1.1" 200 -
```
