#!/usr/bin/env node

/**
 * Fix volume-tools.ts structured content returns to plain strings
 */

const fs = require('fs');

const filePath = 'src/tools/volume-tools.ts';
let content = fs.readFileSync(filePath, 'utf8');

console.log('🔧 Fixing volume tool return statements...');

// Pattern to match and replace structured content returns
// Matches: return { content: [{ type: "text", text: `...` }] };
// Replaces with: return `...`;

let fixCount = 0;

// Replace structured returns with string returns
content = content.replace(
  /return \{\s*content: \[\{\s*type: "text",\s*text: `([^`]*(?:`[^`]*`[^`]*)*)`\s*\}\]\s*\};/gs,
  (match, textContent) => {
    fixCount++;
    return `return \`${textContent}\`;`;
  }
);

// Handle multi-line structured returns
content = content.replace(
  /return \{\s*content: \[\{\s*type: "text",\s*text: `([^`]*(?:`[^`]*`[^`]*)*)`\s*\}\]\s*\}/gs,
  (match, textContent) => {
    fixCount++;
    return `return \`${textContent}\``;
  }
);

// Fix any remaining escaped newlines
content = content.replace(/\\\\n/g, '\\n');

// Write the fixed content back
fs.writeFileSync(filePath, content);

console.log(`✅ Fixed ${fixCount} structured content returns`);
console.log('📝 Updated volume-tools.ts with plain string returns');