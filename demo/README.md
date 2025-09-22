# NetApp ONTAP MCP Demo Interface

## Overview

This demo directory contains a web-based demonstration interface for the NetApp ONTAP MCP (Model Context Protocol) server. The demo serves as both a functional showcase of the MCP capabilities and a comprehensive validation tool for REST API endpoints through an end-to-end storage provisioning workflow.

## Purpose

The primary purpose of this demo is to:

1. **REST API Validation**: Comprehensive testing of ONTAP MCP server's REST API endpoints through real provisioning workflows
2. **Visual Demonstration**: Provide an authentic NetApp BlueXP-style interface to showcase MCP capabilities
3. **Testing Framework**: Complete end-to-end testing of storage provisioning including volume creation, NFS/CIFS configuration
4. **API Integration Validation**: Test all 46+ MCP tools through realistic user scenarios

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

### Storage Provisioning Workflow
- **Complete Volume Creation**: End-to-end volume provisioning with NFS and CIFS support
- **SVM-Dependent Dropdowns**: Smart form controls that populate based on selected cluster and SVM
- **Aggregate Selection**: Automatic aggregate discovery and selection for volume placement
- **Export Policy Management**: NFS export policy assignment with SVM-specific policy discovery
- **Volume Validation**: Client-side validation ensuring ONTAP-compatible naming conventions
- **Real-time Testing**: Each provisioning step validates multiple MCP REST API endpoints

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

## MCP REST API Testing Through Provisioning Workflow

### Complete API Coverage
The provisioning workflow comprehensively tests these MCP REST endpoints in a realistic sequence:

#### Cluster Discovery Phase
- `POST /api/tools/list_registered_clusters` - Enumerate available clusters
- `POST /api/tools/cluster_list_svms` - Discover SVMs for selected cluster
- `POST /api/tools/cluster_list_aggregates` - Get available aggregates for SVM

#### NFS Configuration Phase  
- `POST /api/tools/list_export_policies` - Enumerate export policies for SVM
- `POST /api/tools/get_export_policy` - Get detailed policy information
- `POST /api/tools/create_export_policy` - Create new policies if needed
- `POST /api/tools/add_export_rule` - Configure NFS access rules

#### Volume Provisioning Phase
- `POST /api/tools/cluster_create_volume` - Create volume with optional CIFS share
- `POST /api/tools/configure_volume_nfs_access` - Apply export policies to volume
- `POST /api/tools/cluster_list_volumes` - Verify volume creation
- `POST /api/tools/get_volume_configuration` - Validate volume settings

#### CIFS Configuration Phase (Optional)
- `POST /api/tools/cluster_create_cifs_share` - Create SMB shares during volume creation
- `POST /api/tools/cluster_list_cifs_shares` - Verify CIFS share creation
- `POST /api/tools/get_cifs_share` - Validate share configuration

### Testing Methodology

#### 1. Prerequisites Setup
```bash
# Terminal 1: Start MCP HTTP server with test clusters
cd /Users/ebarron/ONTAP-MCP
export ONTAP_CLUSTERS='[{"name":"karan-ontap-1","cluster_ip":"10.196.61.123","username":"admin","password":"netapp1!","description":"Karans hardware system"}]'
node build/index.js --http=3000

# Terminal 2: Start demo web server
cd /Users/ebarron/ONTAP-MCP/demo  
python3 -m http.server 8080
```

#### 2. End-to-End Provisioning Test
1. **Navigate to Demo**: Open http://localhost:8080
2. **Select Cluster**: Choose from registered clusters (tests `list_registered_clusters`)
3. **Select SVM**: Choose SVM from dropdown (tests `cluster_list_svms`)
4. **Select Aggregate**: Choose aggregate (tests `cluster_list_aggregates`)
5. **Configure NFS**: Select export policy (tests `list_export_policies`)
6. **Create Volume**: Submit form (tests `cluster_create_volume`, `configure_volume_nfs_access`)
7. **Verify Creation**: Check volume appears in cluster (tests `cluster_list_volumes`)

#### 3. API Validation Points
Each form interaction validates specific API endpoints:
- **Dropdown Population**: Tests list/enumeration APIs
- **Real-time Validation**: Tests configuration validation APIs  
- **Form Submission**: Tests creation/modification APIs
- **Result Verification**: Tests retrieval/status APIs

#### 4. Error Handling Testing
The demo tests error scenarios:
- **Invalid Volume Names**: Client-side validation prevents HTTP 500 errors
- **Missing Dependencies**: SVM-dependent loading prevents invalid configurations
- **Network Failures**: Graceful handling of API timeouts
- **ONTAP Errors**: Proper display of ONTAP-specific error messages

## Advanced Testing Scenarios

### Volume Lifecycle Testing
Test complete volume management through the UI:
```javascript
// Example: Test volume creation with NFS export
const volumeCreation = {
  cluster_name: "karan-ontap-1",
  svm_name: "svm143", 
  volume_name: "test_volume_demo",
  size: "100GB",
  aggregate_name: "aggr1",
  export_policy_name: "mcp-read-only"
};

// This tests multiple APIs in sequence:
// 1. cluster_create_volume
// 2. configure_volume_nfs_access  
// 3. cluster_list_volumes (verification)
```

### CIFS Share Testing
Test SMB share creation during volume provisioning:
```javascript
// Volume with CIFS share creation
const cifsVolumeCreation = {
  cluster_name: "karan-ontap-1",
  svm_name: "svm143",
  volume_name: "cifs_test_volume", 
  size: "200GB",
  cifs_share: {
    share_name: "TestShare",
    access_control: [
      { user_or_group: "Everyone", permission: "full_control" }
    ]
  }
};

// Tests: cluster_create_volume with CIFS + cluster_list_cifs_shares
```

### Policy Management Testing
Test export policy creation and management:
```javascript
// Create custom export policy for testing
const exportPolicyCreation = {
  cluster_name: "karan-ontap-1",
  svm_name: "svm143",
  policy_name: "demo-test-policy",
  comment: "Created via demo interface"
};

// Tests: create_export_policy + add_export_rule + list_export_policies
```

### Error Condition Testing
Test various error scenarios through the UI:
- **Volume Name Validation**: Try invalid characters (spaces, special chars)
- **Missing Dependencies**: Submit form without required fields
- **Duplicate Resources**: Try creating existing volume names
- **Network Timeouts**: Test with unreachable cluster IPs
- **Authentication Failures**: Test with invalid credentials

## Demo Testing Utilities

### Built-in API Testing Tools
The demo includes additional testing utilities:

#### `test-api.html`
Direct MCP API testing interface:
- Raw JSON input/output for any MCP tool
- Useful for debugging specific API calls
- Validates tool registration and parameter handling

#### `debug.html` 
Development debugging interface:
- Real-time API call logging
- Network request inspection
- Error message debugging

### Example Test Workflows

#### Daily Smoke Test
1. Load demo at http://localhost:8080
2. Verify all clusters load (tests cluster enumeration)
3. Select each cluster and verify SVM loading
4. Create test volume with unique name
5. Verify volume appears in cluster volume list
6. Delete test volume (via API testing tools)

#### Integration Test
1. Create volume with NFS export policy
2. Create volume with CIFS share
3. Test policy modification through demo
4. Verify all configurations via ONTAP CLI
5. Clean up test resources

#### Performance Test  
1. Load demo with multiple clusters configured
2. Rapidly switch between clusters (tests API response times)
3. Submit multiple volume creation requests
4. Monitor API response times in browser dev tools

## Using the Demo for MCP API Testing

### Quick Start Testing Guide

#### 1. Basic Setup
```bash
# Ensure MCP server is built
npm run build

# Start MCP HTTP server with your clusters
export ONTAP_CLUSTERS='[{"name":"your-cluster","cluster_ip":"10.x.x.x","username":"admin","password":"yourpass","description":"Test cluster"}]'
node build/index.js --http=3000

# Start demo server
cd demo && python3 -m http.server 8080
```

#### 2. Storage Provisioning Test
1. **Open Demo**: Navigate to http://localhost:8080
2. **Click "Provision Storage"**: Opens the provisioning interface
3. **Select Cluster**: Choose from dropdown (validates cluster connectivity)
4. **Select SVM**: Choose SVM (tests SVM enumeration API)
5. **Configure Volume**:
   - Name: `demo_test_vol_001` (tests volume naming validation)
   - Size: `100GB` 
   - Aggregate: Select from dropdown (tests aggregate enumeration)
6. **Configure NFS** (Optional):
   - Export Policy: Select existing or create new
   - Tests export policy APIs
7. **Configure CIFS** (Optional):
   - Share Name: `DemoShare`
   - Access Control: Configure user permissions
   - Tests CIFS share creation APIs
8. **Submit**: Creates volume and validates all configurations

#### 3. Verification Steps
1. **Check Volume Creation**: Volume should appear in cluster volume list
2. **Verify NFS Config**: Export policy should be applied correctly
3. **Verify CIFS Config**: CIFS share should be accessible (if configured)
4. **API Logs**: Check browser dev tools for API call details

### Comprehensive API Testing Workflow

The provisioning workflow tests these MCP tools in realistic sequence:

#### Phase 1: Discovery (Dropdown Population)
```
list_registered_clusters → cluster_list_svms → cluster_list_aggregates → list_export_policies
```

#### Phase 2: Configuration Validation  
```
get_export_policy → create_export_policy (if needed) → add_export_rule (if needed)
```

#### Phase 3: Provisioning
```
cluster_create_volume → configure_volume_nfs_access → cluster_create_cifs_share (if CIFS)
```

#### Phase 4: Verification
```
cluster_list_volumes → get_volume_configuration → cluster_list_cifs_shares (if CIFS)
```

## MCP Server Integration

The demo connects to the MCP server using its HTTP REST API at `http://localhost:3000`. The provisioning workflow integrates these MCP tools:

### Core Infrastructure Tools
- `list_registered_clusters` - Load all registered clusters
- `cluster_list_svms` - Get SVMs for cluster selection
- `cluster_list_aggregates` - Get aggregates for volume placement
- `cluster_list_volumes` - List and verify volumes

### NFS/Export Policy Tools
- `list_export_policies` - Enumerate available export policies
- `get_export_policy` - Get detailed policy configuration
- `create_export_policy` - Create new export policies
- `add_export_rule` - Configure NFS access rules
- `configure_volume_nfs_access` - Apply export policies to volumes

### CIFS/SMB Tools  
- `cluster_create_cifs_share` - Create SMB shares
- `cluster_list_cifs_shares` - List CIFS shares
- `get_cifs_share` - Get detailed share configuration
- `update_cifs_share` - Modify share properties

### Volume Management Tools
- `cluster_create_volume` - Create volumes with optional CIFS integration
- `get_volume_configuration` - Validate volume settings
- `resize_volume` - Modify volume size
- `cluster_offline_volume` - Take volumes offline
- `cluster_delete_volume` - Remove volumes

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
1. The MCP server is running in HTTP mode: `node build/index.js --http=3000`
2. The demo is accessed via HTTP server (not file://)
3. Both servers are running on localhost

### Connection Errors
If cluster operations fail:
1. Verify ONTAP cluster credentials in ONTAP_CLUSTERS environment variable
2. Check network connectivity to the cluster
3. Ensure the cluster IP/FQDN is correct
4. Verify ONTAP REST API is enabled

### Volume Creation Failures
If volume provisioning fails:
1. **Invalid Names**: Ensure volume names use only alphanumeric and underscores
2. **Duplicate Names**: Volume names must be unique within the SVM
3. **Aggregate Space**: Verify selected aggregate has sufficient free space
4. **SVM Configuration**: Ensure SVM supports the requested protocols (NFS/CIFS)

### Export Policy Issues
If NFS export policies don't populate:
1. **SVM Selection**: Export policies are SVM-specific, select SVM first
2. **Policy Creation**: Create policies via ONTAP CLI if none exist
3. **Demo Fallback**: Demo provides fallback policies if none found

### Demo Not Loading
If the demo doesn't load properly:
1. Check that the Python HTTP server is running on port 8080 from demo directory
2. Verify all files (index.html, styles.css, app.js) are in the demo directory
3. Check browser console for JavaScript errors
4. Ensure MCP server is running and responding on port 3000

### API Testing Failures
If specific API calls fail:
1. **Tool Registration**: Verify tool is registered in both STDIO and HTTP modes
2. **Parameter Validation**: Check required parameters are provided correctly
3. **Authentication**: Verify cluster credentials are correct
4. **Network**: Test direct curl calls to isolate browser vs server issues

### Example Debugging Commands
```bash
# Test MCP server health
curl -s http://localhost:3000/health

# Test cluster enumeration
curl -s -X POST http://localhost:3000/api/tools/list_registered_clusters \
  -H "Content-Type: application/json" -d '{}'

# Test volume creation directly
curl -s -X POST http://localhost:3000/api/tools/cluster_create_volume \
  -H "Content-Type: application/json" \
  -d '{"cluster_name":"karan-ontap-1","svm_name":"svm143","volume_name":"test_vol","size":"100GB"}'

# Verify volume was created
curl -s -X POST http://localhost:3000/api/tools/cluster_list_volumes \
  -H "Content-Type: application/json" \
  -d '{"cluster_name":"karan-ontap-1","svm_name":"svm143"}'
```

## Files

### Core Demo Files
- **`index.html`** - Main demo interface structure with provisioning workflow UI
- **`styles.css`** - Complete NetApp BlueXP styling and responsive layout  
- **`app.js`** - JavaScript functionality with comprehensive MCP API integration
- **`README.md`** - This comprehensive documentation

### Testing Utilities
- **`test-api.html`** - Direct MCP API testing interface for individual tool validation
- **`debug.html`** - Development debugging interface with real-time API logging  
- **`debug-test.html`** - Enhanced debugging with network inspection tools

### Reference Materials
- **`existingPage/`** - Original NetApp BlueXP design reference files
- **`ProvionNFSPage/`** - Additional NetApp interface patterns and styling

## Comprehensive Testing Checklist

### Pre-Test Setup ✓
- [ ] MCP server built: `npm run build`
- [ ] ONTAP_CLUSTERS environment variable configured
- [ ] MCP HTTP server running on port 3000
- [ ] Demo HTTP server running on port 8080 from demo directory
- [ ] Demo loads at http://localhost:8080 without errors

### Basic API Connectivity ✓
- [ ] Cluster enumeration works (clusters appear in main table)
- [ ] Search functionality works (can filter clusters)
- [ ] Health check passes: `curl http://localhost:3000/health`
- [ ] Basic MCP call succeeds: `list_registered_clusters`

### Provisioning Workflow Testing ✓

#### Phase 1: Discovery APIs
- [ ] Click "Provision Storage" - form appears
- [ ] Cluster dropdown populates from `list_registered_clusters`
- [ ] Select cluster - SVM dropdown populates from `cluster_list_svms`  
- [ ] Select SVM - aggregates populate from `cluster_list_aggregates`
- [ ] Select SVM - export policies populate from `list_export_policies`

#### Phase 2: Form Validation
- [ ] Volume name validation prevents invalid characters
- [ ] Size field accepts valid ONTAP size formats (100GB, 1TB, etc.)
- [ ] Required fields prevent form submission when empty
- [ ] SVM-dependent fields reset when SVM changes

#### Phase 3: Volume Creation
- [ ] NFS-only volume creation succeeds
- [ ] Volume with export policy assignment succeeds
- [ ] CIFS volume creation with share succeeds
- [ ] Dual-protocol (NFS+CIFS) volume succeeds

#### Phase 4: Verification
- [ ] Created volume appears in cluster volume list
- [ ] Volume configuration matches submitted parameters
- [ ] NFS export policy correctly applied
- [ ] CIFS share created with correct permissions (if applicable)

### Error Condition Testing ✓
- [ ] Invalid volume name shows client-side validation error
- [ ] Missing required fields prevent submission
- [ ] Network timeout handled gracefully
- [ ] Invalid cluster credentials show appropriate error
- [ ] Duplicate volume name handled correctly

### Browser Compatibility ✓
- [ ] Chrome/Safari/Firefox all load demo correctly
- [ ] JavaScript functions work across browsers
- [ ] CSS layout renders correctly on different screen sizes
- [ ] No console errors in any supported browser

### API Integration Validation ✓
- [ ] All 20+ provisioning-related MCP tools tested
- [ ] HTTP vs STDIO mode consistency verified
- [ ] CORS headers allow browser access
- [ ] Response parsing handles all expected formats
- [ ] Error responses formatted correctly for UI display

### Performance Testing ✓  
- [ ] Demo loads quickly (<3 seconds with local servers)
- [ ] API calls complete within reasonable time (<10 seconds)
- [ ] Multiple rapid form submissions handled correctly
- [ ] Large cluster lists (10+ clusters) display properly
- [ ] Simultaneous user sessions don't interfere

### Documentation Verification ✓
- [ ] README instructions accurate for current demo version
- [ ] Setup commands work as documented
- [ ] Troubleshooting section covers encountered issues
- [ ] Code examples reflect actual implementation
- [ ] API endpoint documentation matches implementation

This checklist ensures comprehensive validation of the MCP REST API through realistic storage provisioning workflows.

## Development

### Extending the Demo

To modify or extend the demo for additional API testing:

#### 1. Adding New MCP Tools
```javascript
// In app.js, add new API call function
async function callNewTool(params) {
    const response = await fetch(`http://localhost:3000/api/tools/new_tool_name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    // Handle response...
}

// Integrate into UI workflow
document.getElementById('newButton').addEventListener('click', async () => {
    const result = await callNewTool({param1: 'value1'});
    updateUI(result);
});
```

#### 2. Adding New Test Scenarios
```javascript
// Create new test functions for specific workflows
async function testSnapshotWorkflow() {
    // Test snapshot policy creation, assignment, and verification
    const policies = await callMcp('list_snapshot_policies', {cluster_name: 'test'});
    const creation = await callMcp('create_snapshot_policy', {...});
    const verification = await callMcp('get_snapshot_policy', {...});
    // Validate results...
}
```

#### 3. Enhancing Validation
```javascript
// Add comprehensive validation functions
function validateVolumeCreation(response) {
    // Check for expected volume properties
    // Validate ONTAP-specific configurations
    // Return detailed validation results
}
```

### Testing New Features

#### 1. HTML Structure Changes
Edit `index.html` for:
- New form fields for additional MCP tool parameters
- Additional UI sections for new testing workflows
- Enhanced validation feedback displays

#### 2. Styling Updates
Modify `styles.css` for:
- New form elements using NetApp design variables
- Additional responsive layouts
- Enhanced error/success state styling

#### 3. JavaScript Functionality
Update `app.js` for:
- New MCP tool integration functions
- Enhanced error handling and validation
- Additional testing workflow orchestration

### API Testing Patterns

#### Standard MCP Call Pattern
```javascript
async function callMcp(toolName, params = {}) {
    try {
        const response = await fetch(`http://localhost:3000/api/tools/${toolName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('');
    } catch (error) {
        console.error(`MCP call failed for ${toolName}:`, error);
        throw error;
    }
}
```

#### Validation Pattern
```javascript
function validateMcpResponse(response, expectedFields) {
    const validation = {
        success: true,
        errors: [],
        warnings: []
    };
    
    // Check for expected content
    expectedFields.forEach(field => {
        if (!response.includes(field)) {
            validation.errors.push(`Missing expected field: ${field}`);
            validation.success = false;
        }
    });
    
    return validation;
}
```

#### Error Handling Pattern
```javascript
function handleMcpError(error, context) {
    const errorInfo = {
        context: context,
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
    };
    
    // Log for debugging
    console.error('MCP Error:', errorInfo);
    
    // Display user-friendly message
    displayErrorMessage(`Operation failed: ${context}. Please check console for details.`);
    
    // Return structured error for testing validation
    return errorInfo;
}
```

The demo uses modern JavaScript (ES6+) and CSS Grid/Flexbox for responsive design, following NetApp BlueXP design patterns for authentic integration testing.