# Grafana Dashboard Iframe Embedding via Proxy

## Problem
Grafana sets `X-Frame-Options: deny` header by default, which prevents embedding dashboards in iframes. This blocks the inline dashboard modal feature in the demo application.

## Solution Architecture

We use a **dual-proxy setup** to separate concerns:

### Proxy 1: MCP API Proxy (Port 8001)
- **Purpose**: CORS proxy for Grafana MCP API calls
- **Route**: `localhost:8001` → `localhost:8000` (Grafana MCP server)
- **Script**: `scripts/grafana-cors-proxy.sh`
- **Function**: Adds CORS headers for browser MCP API calls
- **Used by**: `demo/js/core/McpApiClient.js`

### Proxy 2: Viewer Proxy (Port 3001)
- **Purpose**: Strip X-Frame-Options header for iframe embedding
- **Route**: `localhost:3001` → `10.193.49.74:3000` (Grafana viewer)
- **Script**: `scripts/grafana-viewer-proxy.sh`
- **Function**: 
  - Adds CORS headers
  - **Strips `X-Frame-Options` header**
  - Strips `Content-Security-Policy` frame-ancestors directive
- **Used by**: Dashboard modal iframes in `demo/js/components/GrafanaDashboardModal.js`

## Configuration

### MCP Config (demo/mcp.json)
```json
{
  "servers": {
    "grafana-remote": {
      "type": "http",
      "url": "http://localhost:8001",       // MCP API calls go here
      "viewer_url": "http://localhost:3001" // Dashboard iframes use this
    }
  }
}
```

### Viewer URL Usage
```javascript
// demo/js/components/views/VolumesView.js
const viewerUrl = window.app.mcpConfig.getGrafanaViewerUrl(); // http://localhost:3001
const dashboardUrl = `${viewerUrl}/d/${dashboardUid}`;
this.dashboardModal.open(dashboardUrl, volumeName);
```

## Why This Approach?

### Alternative: Modify Grafana Config
```ini
# grafana.ini (requires server access and restart)
[security]
allow_embedding = true
```
**Downsides:**
- Requires Grafana server access
- Requires Grafana restart
- Changes global security policy
- May conflict with organization security policies

### Our Approach: Viewer Proxy
**Benefits:**
✅ No Grafana configuration changes needed  
✅ No server restarts required  
✅ Grafana security policy unchanged  
✅ Transparent to both Grafana and demo app  
✅ Can be enabled/disabled independently  
✅ Only affects proxied requests (demo app)  

## Technical Details

### Headers Stripped by Viewer Proxy
```python
BLOCKED_HEADERS = [
    'x-frame-options',              # Blocks iframe embedding
    'content-security-policy',      # May restrict frame-ancestors
    'x-content-security-policy',    # Legacy CSP header
]
```

### CORS Headers Added
```
Access-Control-Allow-Origin: http://localhost:8080
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Cookie
Access-Control-Allow-Credentials: true
```

## Starting the Proxies

### Automatic (via start-demo.sh)
```bash
./scripts/start-demo.sh
# Starts both proxies automatically
```

### Manual
```bash
# MCP API proxy (port 8001)
python3 scripts/grafana-cors-proxy.sh &

# Viewer proxy (port 3001)
python3 scripts/grafana-viewer-proxy.sh &
```

## Testing Iframe Embedding

1. Start demo with both proxies running
2. Provision a volume with Grafana dashboard
3. Go to Volumes view
4. Click dashboard icon (🔗)
5. Modal should open with inline dashboard (not error message)
6. Dashboard should be fully interactive in iframe

## Troubleshooting

### Modal shows "Unable to embed dashboard" error
- **Check viewer proxy is running**: `lsof -i :3001`
- **Check proxy logs**: `tail -f grafana-viewer-proxy.log`
- **Verify proxy strips headers**: Look for "✂️ Stripped header" in logs

### Dashboard loads in new tab but not iframe
- **Check viewer URL in mcp.json**: Should be `http://localhost:3001`
- **Check browser console**: Look for X-Frame-Options error
- **Verify dashboard URL uses viewer proxy**: Should start with `http://localhost:3001`

### CORS errors in browser console
- **Check viewer proxy CORS headers**: Should include your origin
- **Check demo server origin**: Default is `http://localhost:8080`
- **Update ALLOWED_ORIGIN in proxy if needed**

## Port Summary

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | ONTAP MCP Server | Storage management API |
| 3001 | Grafana Viewer Proxy | Dashboard iframe embedding (strips X-Frame-Options) |
| 8000 | Grafana MCP Server | Dashboard metadata/queries |
| 8001 | Grafana MCP Proxy | CORS for MCP API calls |
| 8080 | Demo Web Server | Serve demo HTML/JS/CSS |

## Security Considerations

- Viewer proxy only removes headers for **localhost** demo access
- CORS restricted to `http://localhost:8080` origin
- Grafana's native security policy remains unchanged
- Proxy can be disabled without affecting production Grafana
- No authentication bypass - Grafana auth still enforced
