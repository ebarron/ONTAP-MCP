# NetApp ONTAP MCP Server - HTTP Configuration

## Transport Options

The NetApp ONTAP MCP Server supports both **STDIO** and **HTTP** transports:

### STDIO Transport (Default)
Best for local development and VS Code integration:

```json
{
  "servers": {
    "netapp-ontap-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/ONTAP-MCP/build/index.js"],
      "env": {
        "ONTAP_CLUSTERS": "[{\"name\":\"cluster1\",\"cluster_ip\":\"10.1.1.1\",\"username\":\"admin\",\"password\":\"password\"}]"
      }
    }
  }
}
```

### HTTP Transport
Best for multi-client environments and RESTful API access:

```json
{
  "servers": {
    "netapp-ontap-mcp": {
      "type": "http",
      "url": "http://localhost:3000/sse"
    }
  }
}
```

## Starting the HTTP Server

### Command Line Options

```bash
# Default STDIO mode
npm start

# HTTP mode (default port 3000)
npm run start:http

# HTTP mode with custom port
npm run start:http:port
# or
node build/index.js --http=3001
```

### Environment Variables for HTTP Mode

```bash
# Set clusters via environment variable
export ONTAP_CLUSTERS='[
  {
    "name": "cluster1",
    "cluster_ip": "10.1.1.1", 
    "username": "admin",
    "password": "password",
    "description": "Production cluster"
  }
]'

# Start HTTP server
node build/index.js --http=3000
```

## HTTP Endpoints

### Health Check
```
GET /health
```
Returns server status and configured clusters.

### MCP Server-Sent Events
```
GET /sse
```
MCP protocol endpoint for HTTP-based MCP clients.

### RESTful API (Direct Tool Access)
```
POST /api/tools/{toolName}
Content-Type: application/json

{
  "cluster_name": "cluster1",
  "svm_name": "svm1"
}
```

#### Available REST Tools:
- `list_registered_clusters` - List all configured clusters
- `cluster_list_volumes` - List volumes for a specific cluster
- More tools can be added as needed

## Examples

### Health Check
```bash
curl http://localhost:3000/health
```

### List Clusters via REST API
```bash
curl -X POST http://localhost:3000/api/tools/list_registered_clusters \
  -H "Content-Type: application/json" \
  -d '{}'
```

### List Volumes via REST API
```bash
curl -X POST http://localhost:3000/api/tools/cluster_list_volumes \
  -H "Content-Type: application/json" \
  -d '{"cluster_name": "cluster1"}'
```

## Security Considerations

### STDIO Mode
- ✅ **Secure**: No network exposure
- ✅ **Process isolation**
- ✅ **Credential safety**

### HTTP Mode
- ⚠️ **Network exposure**: Consider firewall rules
- ⚠️ **Authentication**: Add API keys or OAuth for production
- ⚠️ **HTTPS**: Use HTTPS in production environments
- ⚠️ **Credential protection**: Ensure secure credential management

## Production Deployment

For production HTTP deployments, consider:

1. **HTTPS**: Enable SSL/TLS
2. **Authentication**: Implement API key or OAuth
3. **Rate limiting**: Add request rate limiting
4. **Monitoring**: Add logging and metrics
5. **Load balancing**: Use reverse proxy (nginx, HAProxy)
6. **Process management**: Use PM2 or similar process manager

```bash
# Production example with PM2
pm2 start build/index.js --name "ontap-mcp" -- --http=3000
```
