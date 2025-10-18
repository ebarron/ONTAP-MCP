#!/usr/bin/env node

/**
 * Tool Schema Parity Test
 * 
 * Compares tool schemas between TypeScript and Go implementations to ensure:
 * 1. Both servers expose the same tools
 * 2. Required parameters match exactly
 * 3. Optional parameters match exactly
 * 4. Parameter types match exactly
 * 5. Descriptions are present and helpful
 * 
 * This validates that the Go implementation can be a drop-in replacement
 * for the TypeScript implementation from a client's perspective.
 */

import { McpTestClient } from '../utils/mcp-test-client.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TS_SERVER_PORT = 3001;
const GO_SERVER_PORT = 3000;

// Tools to skip in comparison (if any are TypeScript-only or Go-only)
const SKIP_TOOLS = new Set([
  // Add any tools that are intentionally different
]);

class ToolSchemaComparator {
  constructor() {
    this.tsTools = new Map();
    this.goTools = new Map();
    this.differences = [];
  }

  /**
   * Connect to both servers and fetch tool lists
   */
  async fetchToolSchemas() {
    console.log('🔍 Fetching tool schemas from both servers...\n');

    // Fetch from TypeScript server
    console.log(`📡 Connecting to TypeScript server (port ${TS_SERVER_PORT})...`);
    const tsClient = new McpTestClient(`http://localhost:${TS_SERVER_PORT}`);
    await tsClient.initialize();
    const tsToolsResponse = await tsClient.listTools();
    const tsTools = tsToolsResponse.tools || [];
    console.log(`✅ TypeScript: Found ${tsTools.length} tools\n`);

    // Fetch from Go server
    console.log(`📡 Connecting to Go server (port ${GO_SERVER_PORT})...`);
    const goClient = new McpTestClient(`http://localhost:${GO_SERVER_PORT}`);
    await goClient.initialize();
    const goToolsResponse = await goClient.listTools();
    const goTools = goToolsResponse.tools || [];
    console.log(`✅ Go: Found ${goTools.length} tools\n`);

    // Build maps for easy comparison
    for (const tool of tsTools) {
      if (!SKIP_TOOLS.has(tool.name)) {
        this.tsTools.set(tool.name, tool);
      }
    }

    for (const tool of goTools) {
      if (!SKIP_TOOLS.has(tool.name)) {
        this.goTools.set(tool.name, tool);
      }
    }
  }

  /**
   * Compare tool sets and report differences
   */
  compareToolSets() {
    console.log('📋 Comparing tool sets...\n');

    // Check for tools in TypeScript but not in Go
    const tsOnly = [];
    for (const toolName of this.tsTools.keys()) {
      if (!this.goTools.has(toolName)) {
        tsOnly.push(toolName);
      }
    }

    if (tsOnly.length > 0) {
      this.differences.push({
        type: 'missing_in_go',
        tools: tsOnly,
        message: `${tsOnly.length} tool(s) exist in TypeScript but not in Go`
      });
    }

    // Check for tools in Go but not in TypeScript
    const goOnly = [];
    for (const toolName of this.goTools.keys()) {
      if (!this.tsTools.has(toolName)) {
        goOnly.push(toolName);
      }
    }

    if (goOnly.length > 0) {
      this.differences.push({
        type: 'missing_in_typescript',
        tools: goOnly,
        message: `${goOnly.length} tool(s) exist in Go but not in TypeScript`
      });
    }

    const commonTools = [...this.tsTools.keys()].filter(name => this.goTools.has(name));
    console.log(`✅ Common tools: ${commonTools.length}`);
    if (tsOnly.length > 0) {
      console.log(`⚠️  TypeScript-only: ${tsOnly.length}`);
    }
    if (goOnly.length > 0) {
      console.log(`⚠️  Go-only: ${goOnly.length}`);
    }
    console.log();

    return commonTools;
  }

  /**
   * Deep equality check that ignores property order in objects
   */
  deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;
    
    // Handle arrays
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) return false;
      for (let i = 0; i < obj1.length; i++) {
        if (!this.deepEqual(obj1[i], obj2[i])) return false;
      }
      return true;
    }
    
    // Handle objects - compare keys and values regardless of order
    const keys1 = Object.keys(obj1).sort();
    const keys2 = Object.keys(obj2).sort();
    
    if (keys1.length !== keys2.length) return false;
    if (keys1.join(',') !== keys2.join(',')) return false;
    
    for (const key of keys1) {
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }

  /**
   * Compare schemas for common tools
   */
  compareSchemas(commonTools) {
    console.log('🔬 Comparing tool schemas...\n');

    for (const toolName of commonTools) {
      const tsTool = this.tsTools.get(toolName);
      const goTool = this.goTools.get(toolName);

      const schemaDiffs = this.compareToolSchema(toolName, tsTool, goTool);
      if (schemaDiffs.length > 0) {
        this.differences.push({
          type: 'schema_mismatch',
          tool: toolName,
          differences: schemaDiffs
        });
      }
    }
  }

  /**
   * Compare schema for a single tool
   */
  compareToolSchema(toolName, tsTool, goTool) {
    const diffs = [];

    // Compare descriptions
    if (tsTool.description !== goTool.description) {
      diffs.push({
        type: 'description',
        ts: tsTool.description,
        go: goTool.description
      });
    }

    // Extract schema properties
    const tsSchema = tsTool.inputSchema || {};
    const goSchema = goTool.inputSchema || {};

    const tsRequired = new Set(tsSchema.required || []);
    const goRequired = new Set(goSchema.required || []);

    const tsProps = tsSchema.properties || {};
    const goProps = goSchema.properties || {};

    const allProps = new Set([...Object.keys(tsProps), ...Object.keys(goProps)]);

    // Compare each property
    for (const propName of allProps) {
      const tsProp = tsProps[propName];
      const goProp = goProps[propName];

      // Check if property exists in both
      if (!tsProp && goProp) {
        diffs.push({
          type: 'property_missing_in_ts',
          property: propName,
          goSchema: goProp
        });
        continue;
      }

      if (tsProp && !goProp) {
        diffs.push({
          type: 'property_missing_in_go',
          property: propName,
          tsSchema: tsProp
        });
        continue;
      }

      // Check if required status matches
      const tsIsRequired = tsRequired.has(propName);
      const goIsRequired = goRequired.has(propName);

      if (tsIsRequired !== goIsRequired) {
        diffs.push({
          type: 'required_mismatch',
          property: propName,
          tsRequired: tsIsRequired,
          goRequired: goIsRequired
        });
      }

      // Compare types
      if (tsProp.type !== goProp.type) {
        diffs.push({
          type: 'type_mismatch',
          property: propName,
          tsType: tsProp.type,
          goType: goProp.type
        });
      }

      // For objects, recursively compare nested properties
      if (tsProp.type === 'object' && goProp.type === 'object') {
        const nestedDiffs = this.compareNestedSchema(tsProp, goProp, propName);
        diffs.push(...nestedDiffs);
      }

      // For arrays, compare item schemas (deep equality, ignoring property order)
      if (tsProp.type === 'array' && goProp.type === 'array') {
        if (!this.deepEqual(tsProp.items, goProp.items)) {
          diffs.push({
            type: 'array_items_mismatch',
            property: propName,
            tsItems: tsProp.items,
            goItems: goProp.items
          });
        }
      }

      // Compare enums if present
      if (tsProp.enum || goProp.enum) {
        const tsEnum = JSON.stringify(tsProp.enum || []);
        const goEnum = JSON.stringify(goProp.enum || []);
        if (tsEnum !== goEnum) {
          diffs.push({
            type: 'enum_mismatch',
            property: propName,
            tsEnum: tsProp.enum,
            goEnum: goProp.enum
          });
        }
      }
    }

    return diffs;
  }

  /**
   * Compare nested object schemas
   */
  compareNestedSchema(tsProp, goProp, parentName) {
    const diffs = [];
    const tsProps = tsProp.properties || {};
    const goProps = goProp.properties || {};
    const allProps = new Set([...Object.keys(tsProps), ...Object.keys(goProps)]);

    for (const propName of allProps) {
      const fullPath = `${parentName}.${propName}`;
      
      if (!tsProps[propName]) {
        diffs.push({
          type: 'nested_property_missing_in_ts',
          property: fullPath
        });
      } else if (!goProps[propName]) {
        diffs.push({
          type: 'nested_property_missing_in_go',
          property: fullPath
        });
      } else if (tsProps[propName].type !== goProps[propName].type) {
        diffs.push({
          type: 'nested_type_mismatch',
          property: fullPath,
          tsType: tsProps[propName].type,
          goType: goProps[propName].type
        });
      }
    }

    return diffs;
  }

  /**
   * Generate formatted report
   */
  generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 TOOL SCHEMA COMPARISON REPORT');
    console.log('='.repeat(70) + '\n');

    if (this.differences.length === 0) {
      console.log('✅ PERFECT MATCH - All tool schemas are identical!\n');
      return true;
    }

    console.log(`❌ Found ${this.differences.length} difference(s):\n`);

    // Group by type
    const byType = new Map();
    for (const diff of this.differences) {
      const type = diff.type;
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type).push(diff);
    }

    // Report missing tools
    if (byType.has('missing_in_go')) {
      const missing = byType.get('missing_in_go');
      console.log('❌ Tools in TypeScript but not in Go:');
      for (const diff of missing) {
        for (const tool of diff.tools) {
          console.log(`   - ${tool}`);
        }
      }
      console.log();
    }

    if (byType.has('missing_in_typescript')) {
      const missing = byType.get('missing_in_typescript');
      console.log('⚠️  Tools in Go but not in TypeScript (enhancements):');
      for (const diff of missing) {
        for (const tool of diff.tools) {
          console.log(`   - ${tool}`);
        }
      }
      console.log();
    }

    // Report schema mismatches
    if (byType.has('schema_mismatch')) {
      const mismatches = byType.get('schema_mismatch');
      console.log(`❌ Schema mismatches in ${mismatches.length} tool(s):\n`);

      for (const mismatch of mismatches) {
        console.log(`📦 Tool: ${mismatch.tool}`);
        console.log(`   Differences: ${mismatch.differences.length}\n`);

        for (const diff of mismatch.differences) {
          switch (diff.type) {
            case 'description':
              console.log('   ⚠️  Description mismatch');
              console.log(`      TS: ${diff.ts?.substring(0, 60)}...`);
              console.log(`      Go: ${diff.go?.substring(0, 60)}...`);
              break;

            case 'property_missing_in_ts':
              console.log(`   ⚠️  Property in Go but not TypeScript: ${diff.property}`);
              break;

            case 'property_missing_in_go':
              console.log(`   ❌ Property in TypeScript but not Go: ${diff.property}`);
              break;

            case 'required_mismatch':
              console.log(`   ❌ Required status mismatch: ${diff.property}`);
              console.log(`      TS required: ${diff.tsRequired}`);
              console.log(`      Go required: ${diff.goRequired}`);
              break;

            case 'type_mismatch':
              console.log(`   ❌ Type mismatch: ${diff.property}`);
              console.log(`      TS type: ${diff.tsType}`);
              console.log(`      Go type: ${diff.goType}`);
              break;

            case 'enum_mismatch':
              console.log(`   ❌ Enum mismatch: ${diff.property}`);
              console.log(`      TS: ${JSON.stringify(diff.tsEnum)}`);
              console.log(`      Go: ${JSON.stringify(diff.goEnum)}`);
              break;

            case 'array_items_mismatch':
              console.log(`   ❌ Array items mismatch: ${diff.property}`);
              console.log(`      TS items: ${JSON.stringify(diff.tsItems)}`);
              console.log(`      Go items: ${JSON.stringify(diff.goItems)}`);
              break;

            case 'nested_property_missing_in_ts':
              console.log(`   ⚠️  Nested property in Go but not TypeScript: ${diff.property}`);
              break;

            case 'nested_property_missing_in_go':
              console.log(`   ❌ Nested property in TypeScript but not Go: ${diff.property}`);
              break;

            case 'nested_type_mismatch':
              console.log(`   ❌ Nested type mismatch: ${diff.property}`);
              console.log(`      TS: ${diff.tsType}, Go: ${diff.goType}`);
              break;
          }
        }
        console.log();
      }
    }

    console.log('='.repeat(70) + '\n');
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  NetApp ONTAP MCP Tool Schema Parity Test                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const comparator = new ToolSchemaComparator();

  try {
    // Fetch schemas from both servers
    await comparator.fetchToolSchemas();

    // Compare tool sets
    const commonTools = comparator.compareToolSets();

    // Compare schemas for common tools
    comparator.compareSchemas(commonTools);

    // Generate report
    const allMatch = comparator.generateReport();

    if (allMatch) {
      console.log('✅ SUCCESS - Go implementation is a perfect drop-in replacement!\n');
      process.exit(0);
    } else {
      console.log('❌ FAILURE - Schema mismatches found that could break clients\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    console.error('\nMake sure both servers are running:');
    console.error(`  - TypeScript: npm start (port ${TS_SERVER_PORT})`);
    console.error(`  - Go: ./ontap-mcp-server --http=${GO_SERVER_PORT}`);
    process.exit(1);
  }
}

main();
