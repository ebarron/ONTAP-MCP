# TODO: Standalone Test Validation

## Objective
Verify that each individual test works correctly when run standalone (not via run-all-tests.sh) in both HTTP and STDIO modes where applicable.

## Test Execution Checklist

### Volume Lifecycle Tests
- [ ] `node test/test-volume-lifecycle.js` (STDIO mode standalone)
- [ ] `node test/test-volume-lifecycle.js http` (HTTP mode standalone)
- [ ] `node test/test-volume-lifecycle.js http --server-running` (HTTP with pre-started server)

### Export Policy Lifecycle Tests
- [ ] `node test/test-export-policy-lifecycle.js` (STDIO mode standalone)
- [ ] `node test/test-export-policy-lifecycle.js http` (HTTP mode standalone)
- [ ] `node test/test-export-policy-lifecycle.js http --server-running` (HTTP with pre-started server)

### CIFS Lifecycle Tests
- [ ] `node test/test-cifs-lifecycle.js` (STDIO mode standalone)
- [ ] `node test/test-cifs-lifecycle.js http` (HTTP mode standalone)
- [ ] `node test/test-cifs-lifecycle.js http --server-running` (HTTP with pre-started server)

### QoS Policy Lifecycle Tests
- [ ] `node test/test-qos-lifecycle.js` (STDIO mode standalone)
- [ ] `node test/test-qos-lifecycle.js http` (HTTP mode standalone)
- [ ] `node test/test-qos-lifecycle.js http --server-running` (HTTP with pre-started server)

### Other Tests (HTTP only or Shell)
- [ ] `node test/test-snapshot-policy-formats.js` (HTTP mode only)
- [ ] `node test/test-tool-discovery.js` (Both STDIO and HTTP)
- [ ] `bash test/test-tool-discovery.sh` (Shell script version)
- [ ] `node test/test-comprehensive.js` (STDIO mode)
- [ ] `bash test/test-policy-management.sh` (Shell script)
- [ ] `node test/test-cifs-creation-acl.js` (STDIO mode)
- [ ] `node test/test-user-scenario.js` (STDIO mode)
- [ ] `node test/test-cluster-info.js` (Both STDIO and HTTP)
- [ ] `node test/test-session-management.js` (HTTP mode only)
- [ ] `node test/test-param-filtering.js` (STDIO mode)

## Validation Criteria

For each test, verify:
1. **Exit code is 0** (success)
2. **All expected operations complete** (create, update, delete, etc.)
3. **Cleanup happens correctly** (no leftover test resources)
4. **Error messages are clear** if test fails
5. **Cluster loading works** in HTTP mode (each test loads its own clusters)

## Pre-Test Setup

Before running standalone HTTP tests:
```bash
# Start HTTP server in background
node build/index.js --http=3000 > /tmp/mcp-http-server.log 2>&1 &
HTTP_PID=$!

# Wait for server to be ready
sleep 3

# Run tests with --server-running flag
node test/test-volume-lifecycle.js http --server-running

# Cleanup
kill $HTTP_PID
```

## Notes on Session-Scoped Architecture

- Each HTTP test creates its own session via `new McpTestClient()`
- Each session loads clusters via `loadClustersIntoSession(mcpClient)`
- Sessions are isolated - cannot interfere with each other
- STDIO tests use global cluster manager (from ONTAP_CLUSTERS env var or test config)
- No session reuse across tests (HTTP/SSE architecture limitation)

## Testing Output Requirements

**Remember**: Always use `tee` or similar to show output on terminal:
```bash
# GOOD - visible output
node test/test-volume-lifecycle.js 2>&1 | tee /tmp/volume-test.log

# BAD - hidden output
node test/test-volume-lifecycle.js > /tmp/volume-test.log 2>&1
```

## Expected Timeline

- **Phase 1**: Test all STDIO mode tests standalone (10 tests) - ~30 minutes
- **Phase 2**: Test all HTTP mode tests standalone (10 tests) - ~30 minutes  
- **Phase 3**: Test HTTP mode with --server-running flag (8 tests) - ~20 minutes
- **Phase 4**: Document any failures and create fixes - As needed

## Success Criteria

- ✅ All tests pass when run standalone
- ✅ All tests clean up properly (no leftover volumes/policies)
- ✅ HTTP tests properly load clusters into their own sessions
- ✅ Tests provide clear success/failure messages
- ✅ Exit codes reflect test results correctly

## Current Status

- **run-all-tests.sh**: ✅ 20/20 tests passing (100%)
- **Standalone testing**: ⏳ Not yet started

---

**Next Action**: Begin Phase 1 - Test STDIO mode tests individually
