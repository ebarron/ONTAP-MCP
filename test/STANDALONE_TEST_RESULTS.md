# Standalone Test Results

## Testing Date: October 5, 2025

This document tracks the results of running each test individually (outside of run-all-tests.sh).

## Test Methodology

Each test is run individually with:
- STDIO mode: No server running, uses spawned child process
- HTTP mode: Requires MCP server running on port 3000

## Individual Test Results

### Test 1: test-tool-discovery.js

**Command**: `node test/test-tool-discovery.js`

**STDIO Mode**: ✅ PASS
- Returns expected 47 tools
- Works without HTTP server running

**HTTP Mode**: ⏸️ REQUIRES SERVER
- Needs `node build/index.js --http=3000` running
- Will test separately with server

**Standalone Result**: ✅ PASS (STDIO mode works)

---

### Test 2: test-mcp-spec-compliance.js

**Command**: `node test/test-mcp-spec-compliance.js`

**Result**: ✅ PASS (HTTP mode - starts own server)
- All 5 MCP specification tests passed
- Tests SSE format, session management, JSON-RPC 2.0, etc.
- Connects to localhost:3000 or starts own server
- Runtime: ~5 seconds

**Standalone Result**: ✅ PASS

---

### Test 3: test-response-format-validation.js

**Command**: `node test/test-response-format-validation.js`

**Result**: ❌ FAIL (HTTP mode - no server)
- Requires HTTP server running
- Tests 7 tools for MCP response format compliance
- Returns empty responses without server

**Standalone Result**: ⏸️ REQUIRES SERVER

---

### Test 4: test-cluster-info.js

**Command**: `node test/test-cluster-info.js`

**Result**: ✅ PASS (STDIO mode)
- Tests get_all_clusters_info and list_registered_clusters
- Runtime: ~130ms
- Both tools responded correctly in STDIO mode

**Standalone Result**: ✅ PASS

---

### Test 5: test-volume-lifecycle.js (STDIO mode)

**Command**: `node test/test-volume-lifecycle.js stdio`

**Result**: ✅ PASS
- Creates volumes on two clusters
- Updates, offlines, and deletes volumes
- Full lifecycle test completed successfully
- Runtime: ~20 seconds

**Standalone Result**: ✅ PASS (STDIO mode tested)

---

### Test 6: test-export-policy-lifecycle.js (STDIO mode)

**Command**: `node test/test-export-policy-lifecycle.js stdio`

**Result**: ✅ PASS
- Full export policy lifecycle test completed
- Creates, lists, gets, updates, and deletes export policies
- Runtime: ~20 seconds

**Standalone Result**: ✅ PASS

---

### Test 7: test-cifs-lifecycle.js (STDIO mode)

**Command**: `node test/test-cifs-lifecycle.js stdio`

**Result**: ✅ PASS
- Full CIFS share lifecycle test completed
- Creates, lists, updates, and deletes shares
- Runtime: ~15 seconds

**Standalone Result**: ✅ PASS

---

### Test 8: test-qos-lifecycle.js (STDIO mode)

**Command**: `node test/test-qos-lifecycle.js stdio`

**Result**: ✅ PASS
- Fixed QoS policy lifecycle test completed
- Creates, lists, gets, updates, and deletes policies
- Runtime: ~10 seconds

**Standalone Result**: ✅ PASS

---

### Test 9: test-snapshot-policy-formats.js

**Command**: `node test/test-snapshot-policy-formats.js`

**Result**: ❌ REQUIRES HTTP SERVER
- Tests snapshot policy creation with various formats
- Needs HTTP mode with server running

**Standalone Result**: ⏸️ REQUIRES SERVER

---

### Test 10: test-comprehensive.js

**Command**: `node test/test-comprehensive.js`

**Result**: ❌ REQUIRES HTTP SERVER
- Comprehensive tool testing across categories
- Tests 8 different tools
- Needs HTTP server on port 3000

**Standalone Result**: ⏸️ REQUIRES SERVER

---

### Test 11: test-param-filtering.js

**Command**: `node test/test-param-filtering.js`

**Result**: ✅ PASS (utility test)
- Tests parameter filtering logic
- Validates cluster_name filtering from API params
- Unit test - no server needed

**Standalone Result**: ✅ PASS

---

### Test 12: test-user-scenario.js

**Command**: `node test/test-user-scenario.js`

**Result**: ✅ PASS
- Real-world CIFS share creation scenario
- Tests share creation with ACLs
- Updates and deletes share successfully
- Runtime: ~10 seconds

**Standalone Result**: ✅ PASS

---

### Test 13: test-cifs-creation-acl.js

**Command**: `node test/test-cifs-creation-acl.js`

**Result**: ✅ PASS
- Tests CIFS share creation with ACLs
- Verifies ACL configuration
- Cleans up test share
- Runtime: ~5 seconds

**Standalone Result**: ✅ PASS

---

### Test 14-16: HTTP-Only Tests

- test-session-management.js (HTTP only)
- test-session-isolation.js (HTTP only)
- test-mcp-jsonrpc.js (HTTP only)

**Status**: ⏸️ REQUIRES SERVER (will test with server running)

---

### Test 11-12: Session Tests (HTTP Only)

- test-session-management.js
- test-session-isolation.js

**Status**: 🔄 PENDING (HTTP mode only)

---

## Summary

- Total Test Files: 16
- Tested Standalone (STDIO): 13
- Passing (STDIO): 10
- Passing (HTTP with own server): 1 (test-mcp-spec-compliance.js)
- Requires External Server: 5
- Pending: 0

## Breakdown

### ✅ Tests Working Standalone (No External Server)
1. test-mcp-spec-compliance.js - Starts own server, all 5 tests pass
2. test-cluster-info.js - STDIO mode, ~130ms
3. test-volume-lifecycle.js stdio - Full lifecycle, ~20s
4. test-export-policy-lifecycle.js stdio - Full lifecycle, ~20s
5. test-cifs-lifecycle.js stdio - Full lifecycle, ~15s
6. test-qos-lifecycle.js stdio - Full lifecycle, ~10s
7. test-param-filtering.js - Unit test, instant
8. test-user-scenario.js - Real CIFS scenario, ~10s
9. test-cifs-creation-acl.js - ACL creation test, ~5s

### ⚠️ Tests With HTTP Mode Failures (But STDIO Works)
10. test-tool-discovery.js - STDIO ✅, HTTP ❌ (needs server)

### ⏸️ Tests Requiring HTTP Server on Port 3000
1. test-response-format-validation.js
2. test-snapshot-policy-formats.js
3. test-comprehensive.js
4. test-session-management.js (HTTP only)
5. test-session-isolation.js (HTTP only)
6. test-mcp-jsonrpc.js (HTTP only)

## Quick Test Command

Run all STDIO tests at once:
```bash
bash test/quick-standalone-test.sh
```

Results: 6/7 tests pass (test-tool-discovery fails on HTTP portion only)

## Notes

- Many tests support both STDIO and HTTP modes
- HTTP mode tests require server to be running first
- Some tests (session-*) are HTTP-only
