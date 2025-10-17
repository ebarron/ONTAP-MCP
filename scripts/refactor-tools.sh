#!/bin/bash

# Script to extract tool registrations from register.go into modular files
# This preserves the existing code while reorganizing it

set -e

cd "$(dirname "$0")/.."

echo "🔧 Refactoring register.go into modular structure..."

# Create backup
cp pkg/tools/register.go pkg/tools/register.go.backup
echo "✅ Created backup: pkg/tools/register.go.backup"

# Extract volume tools (lines 279-1264)
echo "📦 Extracting volume tools..."
cat > pkg/tools/volume.go << 'EOF'
package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// RegisterVolumeTools registers volume management tools (18 tools)
EOF

sed -n '279,1264p' pkg/tools/register.go | sed 's/^func registerVolumeTools/func RegisterVolumeTools/' >> pkg/tools/volume.go

echo "✅ Created pkg/tools/volume.go"

# Extract CIFS tools (lines 1265-1669)
echo "📦 Extracting CIFS tools..."
cat > pkg/tools/cifs.go << 'EOF'
package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// RegisterCIFSTools registers CIFS share management tools (8 tools)
EOF

sed -n '1265,1669p' pkg/tools/register.go | sed 's/^func registerCIFSTools/func RegisterCIFSTools/' >> pkg/tools/cifs.go

echo "✅ Created pkg/tools/cifs.go"

# Extract export policy tools
echo "📦 Extracting export policy tools..."
sed -n '/^func registerExportPolicyTools/,/^func register[A-Z]/p' pkg/tools/register.go | head -n -1 > pkg/tools/nfs.go.tmp
cat > pkg/tools/nfs.go << 'EOF'
package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// RegisterExportPolicyTools registers NFS export policy tools (9 tools)
EOF

sed 's/^func registerExportPolicyTools/func RegisterExportPolicyTools/' pkg/tools/nfs.go.tmp >> pkg/tools/nfs.go
rm pkg/tools/nfs.go.tmp

echo "✅ Created pkg/tools/nfs.go"

# Continue for remaining tool categories...
echo ""
echo "✅ Refactoring complete!"
echo "📂 New structure:"
ls -lh pkg/tools/*.go | awk '{print "  " $9 " (" $5 ")"}'
