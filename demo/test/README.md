# Demo Test Directory

This directory contains tests specific to the NetApp ONTAP MCP Demo interface functionality.

## Test Files

### JavaScript Tests

#### `test-intent-detection.js`
Tests the chatbot's intent detection and structured recommendation parsing logic.

**Purpose**: Validates that the chatbot correctly identifies when responses should trigger the provisioning form vs. when they should not.

**Usage**:
```bash
cd /Users/ebarron/ONTAP-MCP
node demo/test/test-intent-detection.js
```

**Test Coverage**:
- ✅ Structured provisioning recommendations (should trigger form)
- ✅ Legacy provisioning recommendations (should trigger form) 
- ✅ Error responses (should NOT trigger form)
- ✅ Informational responses (should NOT trigger form)
- ✅ User's problematic response format (should NOT trigger form)
- ✅ CIFS provisioning with all optional fields

### HTML Testing Utilities

#### `test-api.html`
Direct MCP API testing interface for individual tool validation.
- Raw JSON input/output for any MCP tool
- Useful for debugging specific API calls
- Validates tool registration and parameter handling
- **Access**: Open `demo/test/test-api.html` in browser while MCP server is running

#### `debug.html`
Development debugging interface with real-time API logging.
- Real-time API call logging  
- Network request inspection
- Error message debugging
- **Access**: Open `demo/test/debug.html` in browser while MCP server is running

#### `debug-test.html`
Enhanced debugging with network inspection tools.
- Advanced debugging features
- Network request monitoring
- Cluster loading diagnostics  
- **Access**: Open `demo/test/debug-test.html` in browser while MCP server is running

## Test Categories

### Intent Detection Tests
These tests verify that the chatbot's `isProvisioningIntent()` method correctly identifies:
- **Positive cases**: Responses that should open the provisioning form
- **Negative cases**: Responses that should NOT open the provisioning form

### Structured Parsing Tests  
These tests verify that the chatbot's `parseStructuredRecommendation()` method correctly extracts:
- **Required fields**: Cluster, SVM, Aggregate, Size
- **Optional fields**: Protocol, Snapshot_Policy, Export_Policy

## Running Tests

### JavaScript Tests
From the project root:
```bash
# Run intent detection tests
node demo/test/test-intent-detection.js

# Run all demo tests (when more are added)
find demo/test -name "test-*.js" -exec node {} \;

# Use the test runner
./demo/test/run-demo-tests.sh
```

### HTML Testing Utilities
Ensure the MCP server is running first:
```bash
# Start demo servers
./start-demo.sh

# Then access HTML utilities:
# - http://localhost:8080/test/test-api.html
# - http://localhost:8080/test/debug.html  
# - http://localhost:8080/test/debug-test.html
```

## Adding New Demo Tests

When adding new demo-specific tests:

1. **File naming**: Use `test-[feature].js` format
2. **Test structure**: Follow the existing pattern with clear test case descriptions
3. **Test categories**: Group related test cases together
4. **Documentation**: Update this README with new test descriptions

## Integration with Main Tests

Demo tests are separate from the main MCP server tests in the `/test` directory:

- **`/test`**: MCP server functionality, tool registration, API testing
- **`/demo/test`**: Demo UI functionality, chatbot logic, form behavior

This separation ensures clear boundaries between server-side and client-side testing.