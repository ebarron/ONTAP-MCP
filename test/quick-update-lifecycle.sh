#!/bin/bash

# Quick update script for export-policy and qos lifecycle tests
# Both have similar structure to CIFS test

FILES=(
  "test/test-export-policy-lifecycle.js"
  "test/test-qos-lifecycle.js"
)

echo "Updating lifecycle test files with MCP client pattern..."

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  Skipping $file (not found)"
    continue
  fi
  
  echo "Processing $file..."
  
  # The manual edits needed in each file:
  # 1. Import added (done manually above for export-policy)
  # 2. Constructor - add serverAlreadyRunning and mcpClient
  # 3. Add callHttpTool, callTool, extractText methods
  # 4. Update startHttpServer and stopHttpServer
  # 5. Update main() function
  
  echo "  ✅ Import statement (manual)"
  echo "  ⏳ Constructor update needed"
  echo "  ⏳ Method additions needed"
  echo "  ⏳ Server start/stop updates needed"
  echo "  ⏳ Main function update needed"
done

echo ""
echo "Manual changes required - see test-volume-lifecycle.js as template"
