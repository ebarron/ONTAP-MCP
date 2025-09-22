# NetApp ONTAP MCP Demo Interface

## Overview

This demo directory contains a web-based demonstration interface for the NetApp ONTAP MCP (Model Context Protocol) server. The demo serves as both a functional showcase of the MCP capabilities and a validation tool for the REST API endpoints.

## Purpose

The primary purpose of this demo is to:

1. **REST API Validation**: Validate that the ONTAP MCP server's REST API endpoints are functioning correctly
2. **Visual Demonstration**: Provide an authentic NetApp BlueXP-style interface to showcase MCP capabilities
3. **Testing Framework**: Serve as a foundation for automated testing and validation

## Architecture

### Components

- **`index.html`**: Main interface structure with NetApp BlueXP-authentic styling
- **`styles.css`**: Complete NetApp design system implementation with proper colors, typography, and layout
- **`app.js`**: JavaScript application handling MCP API calls and UI interactions

### Server Setup

The demo requires two servers running simultaneously:

1. **Python HTTP Server** (port 8080): Serves the demo files
   ```bash
   cd demo && python3 -m http.server 8080
   ```

2. **ONTAP MCP Server** (port 3000): Provides REST API endpoints with CORS support
   ```bash
   ONTAP_CLUSTERS='[...]' node build/index.js --http=3000
   ```

## Current Features

### Cluster Management
- **List Registered Clusters**: Displays all configured ONTAP clusters
- **Real-time Data**: Fetches live cluster information via REST API
- **Search Functionality**: Filter clusters with expanding search widget

### Authentication & CORS
- **Cross-Origin Support**: Properly configured CORS headers for browser compatibility
- **Environment Configuration**: Clusters pre-loaded via environment variables

### User Interface
- **NetApp BlueXP Styling**: Authentic visual design matching NetApp's interface
- **Responsive Layout**: Proper spacing, typography, and interactive elements
- **Search Widget**: Expandable search functionality with authentic animations

## API Validation

The demo currently validates these MCP REST endpoints:

- `POST /api/tools/list_registered_clusters` - Cluster enumeration
- `GET /health` - Server health check

### Example API Call
```javascript
const response = await fetch('http://localhost:3000/api/tools/list_registered_clusters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
});
```

## Future Enhancements

### Planned API Validation
- Volume operations (create, list, delete, resize)
- CIFS share management
- NFS export policy configuration
- Snapshot policy management
- Performance statistics retrieval

### Agentic/LLM-Driven Testing
Future versions will include:
- **Automated Test Generation**: LLM-generated test scenarios
- **Intelligent Validation**: AI-driven API response validation
- **Dynamic Test Flows**: Context-aware testing sequences
- **Natural Language Testing**: Describe test scenarios in plain English
- **Interactive Modals**: Easy forms for adding clusters
- **Flyout Panels**: Detailed cluster information and services

## Using the Demo

### Adding Your First Cluster
1. Click the "Add ONTAP Cluster" button
2. Fill in the cluster details:
   - **Name**: A friendly name for the cluster
   - **Cluster IP**: IP address or FQDN of the ONTAP cluster
   - **Username**: ONTAP admin username
   - **Password**: ONTAP admin password
   - **Description**: Optional description
3. Click "Add Cluster"

### Exploring Cluster Services
1. Click on any cluster name in the table
2. The cluster details flyout will open on the right
3. Click on service buttons to explore:
   - **Volumes**: View all volumes on the cluster
   - **Snapshots**: Manage snapshot policies
   - **NFS Exports**: Configure export policies
   - **CIFS Shares**: Manage SMB shares

### Testing Connectivity
- Use the "Test" button in the Actions column to verify cluster connectivity
- Status indicators show real-time connection status

## MCP Server Integration

The demo connects to the MCP server using its HTTP REST API at `http://localhost:3000`. The following MCP tools are integrated:

- `list_registered_clusters` - Load all registered clusters
- `add_cluster` - Add new clusters to the registry
- `cluster_list_svms` - Get cluster information
- `cluster_list_volumes` - List volumes on a cluster
- `list_snapshot_policies` - View snapshot policies
- `list_export_policies` - View NFS export policies
- `cluster_list_cifs_shares` - List CIFS/SMB shares

## Architecture

```
Browser (Demo UI) ←→ HTTP Server (port 8080) ←→ MCP Server (port 3000) ←→ ONTAP Clusters
```

- **Demo UI**: HTML/CSS/JavaScript interface
- **HTTP Server**: Serves static demo files
- **MCP Server**: Provides ONTAP management tools via HTTP API
- **ONTAP Clusters**: Target NetApp storage systems

## Troubleshooting

### CORS Issues
If you see CORS errors in the browser console, ensure:
1. The MCP server is running on port 3000
2. The demo is accessed via HTTP (not file://)
3. Both servers are running on localhost

### Connection Errors
If cluster operations fail:
1. Verify ONTAP cluster credentials
2. Check network connectivity to the cluster
3. Ensure the cluster IP/FQDN is correct
4. Verify ONTAP REST API is enabled

### Demo Not Loading
If the demo doesn't load properly:
1. Check that the HTTP server is running on port 8080
2. Verify all files (index.html, styles.css, app.js) are in the demo directory
3. Check browser console for JavaScript errors

## Files

- `index.html` - Main demo interface structure
- `styles.css` - NetApp BlueXP styling and layout
- `app.js` - JavaScript functionality and MCP integration
- `README.md` - This documentation
- `existingPage/` - Reference NetApp BlueXP design files

## Development

To modify or extend the demo:

1. **HTML Structure**: Edit `index.html` for layout changes
2. **Styling**: Modify `styles.css` using NetApp design variables
3. **Functionality**: Update `app.js` for new features or MCP tool integration
4. **MCP Tools**: Add new tools to the MCP server and integrate them in the demo

The demo uses modern JavaScript (ES6+) and CSS Grid/Flexbox for responsive design.