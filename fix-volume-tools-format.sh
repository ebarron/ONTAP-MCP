#!/bin/bash

# Fix volume-tools.ts structured content returns to plain string returns

input_file="src/tools/volume-tools.ts"
temp_file="temp_volume_tools.ts"

# Convert structured content returns to plain string returns
sed -E '
# Remove the opening return { content: [{
s/return \{$/return `/
# Remove type: "text", 
/type: "text",/d
# Convert text: "..." to just the content
s/^[[:space:]]*text: `(.*)`,?$/\1/
# Remove closing }] }
/^[[:space:]]*\}\]/d
s/^[[:space:]]*\}\]$/`;/
s/^[[:space:]]*\}\);$/`;/
# Fix escaped newlines
s/\\\\n/\\n/g
' "$input_file" > "$temp_file"

# Move the temp file back
mv "$temp_file" "$input_file"

echo "Fixed structured content returns in volume-tools.ts"