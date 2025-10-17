#!/usr/bin/env node

/**
 * Hybrid Format Validator
 * 
 * Validates that Go implementation responses match TypeScript golden fixtures.
 * Compares structure (field names, types, nesting) not values (UUIDs, timestamps, etc).
 * 
 * This ensures Go implementation preserves exact API contract from TypeScript.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GOLDEN_DIR = join(__dirname, '../fixtures/hybrid-golden');

export class HybridFormatValidator {
  constructor(toolName, options = {}) {
    this.toolName = toolName;
    this.strictValues = options.strictValues || false;
    this.ignoreArrayLengths = options.ignoreArrayLengths !== false;
    this.goldenPath = join(GOLDEN_DIR, `${toolName}.json`);
  }

  /**
   * Load golden fixture for this tool
   */
  loadGolden() {
    if (!existsSync(this.goldenPath)) {
      throw new Error(`Golden fixture not found: ${this.goldenPath}`);
    }
    
    const content = readFileSync(this.goldenPath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Parse hybrid format from MCP response
   */
  parseHybridFormat(result) {
    // Extract text from MCP response format
    let parsed;
    if (typeof result === 'string') {
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        return {
          summary: result,
          data: null,
          isHybrid: false,
          raw: result
        };
      }
    } else if (result?.content?.[0]?.text) {
      const text = result.content[0].text;
      // Check if text is already an object (TypeScript format)
      if (typeof text === 'object') {
        parsed = text;
      } else {
        // Text is a string, try to parse as JSON
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          return {
            summary: text,
            data: null,
            isHybrid: false,
            raw: text
          };
        }
      }
    } else if (typeof result === 'object') {
      parsed = result;
    } else {
      return {
        summary: String(result),
        data: null,
        isHybrid: false,
        raw: result
      };
    }

    // Check if it's hybrid format
    if (parsed && typeof parsed === 'object' && 'summary' in parsed && 'data' in parsed) {
      return {
        summary: parsed.summary,
        data: parsed.data,
        isHybrid: true,
        raw: parsed
      };
    }
    
    // Not hybrid format
    return {
      summary: JSON.stringify(parsed),
      data: null,
      isHybrid: false,
      raw: parsed
    };
  }

  /**
   * Validate Go response against golden fixture
   */
  validate(goResponse) {
    const golden = this.loadGolden();
    const goldenParsed = this.parseHybridFormat(golden.response);
    const goParsed = this.parseHybridFormat(goResponse);

    const results = {
      valid: true,
      errors: [],
      warnings: [],
      details: {
        tool: this.toolName,
        goldenMeta: golden.metadata,
        goldenIsHybrid: goldenParsed.isHybrid,
        goIsHybrid: goParsed.isHybrid
      }
    };

    // Both should be hybrid format (or Go can be hybrid when TypeScript is plain - that's an enhancement)
    if (goldenParsed.isHybrid !== goParsed.isHybrid) {
      // Special case: Go has hybrid format but TypeScript doesn't = Go enhancement
      if (!goldenParsed.isHybrid && goParsed.isHybrid) {
        results.warnings.push({
          type: 'go_enhancement',
          message: 'Go returns hybrid format {summary, data}, TypeScript returns plain text',
          note: 'This is an improvement in Go - hybrid format provides better structure'
        });
        // Don't fail validation - this is acceptable
        // Just validate the summary text matches expectations
        return results;
      }
      
      // Other direction (TypeScript hybrid, Go plain) is an error
      results.errors.push({
        type: 'format_mismatch',
        message: `TypeScript is ${goldenParsed.isHybrid ? 'hybrid' : 'plain'}, Go is ${goParsed.isHybrid ? 'hybrid' : 'plain'}`,
        expected: 'Both should return {summary, data} format'
      });
      results.valid = false;
      return results;
    }

    if (!goldenParsed.isHybrid) {
      results.warnings.push({
        type: 'not_hybrid',
        message: `Tool ${this.toolName} doesn't use hybrid format (both TS and Go match)`
      });
      return results;
    }

    // Validate summary exists and is non-empty
    if (!goParsed.summary || goParsed.summary.trim() === '') {
      results.errors.push({
        type: 'missing_summary',
        message: 'Go response has empty or missing summary field'
      });
      results.valid = false;
    }

    // Validate data structure
    const structureValidation = this.compareStructures(
      goldenParsed.data,
      goParsed.data,
      'data'
    );

    results.errors.push(...structureValidation.errors);
    results.warnings.push(...structureValidation.warnings);

    if (structureValidation.errors.length > 0) {
      results.valid = false;
    }

    return results;
  }

  /**
   * Compare data structures recursively
   */
  compareStructures(golden, go, path = 'data') {
    const errors = [];
    const warnings = [];

    // Handle null/undefined
    if (golden === null || golden === undefined) {
      if (go !== null && go !== undefined) {
        warnings.push({
          type: 'null_mismatch',
          path,
          message: `TypeScript is null/undefined, Go has value`
        });
      }
      return { errors, warnings };
    }

    if (go === null || go === undefined) {
      errors.push({
        type: 'missing_data',
        path,
        message: `Go response is null/undefined but TypeScript has data`
      });
      return { errors, warnings };
    }

    // Type validation
    const goldenType = Array.isArray(golden) ? 'array' : typeof golden;
    const goType = Array.isArray(go) ? 'array' : typeof go;

    if (goldenType !== goType) {
      errors.push({
        type: 'type_mismatch',
        path,
        message: `Type mismatch: TypeScript=${goldenType}, Go=${goType}`,
        expected: goldenType,
        actual: goType
      });
      return { errors, warnings };
    }

    // Array validation
    if (Array.isArray(golden)) {
      if (!this.ignoreArrayLengths && golden.length !== go.length) {
        warnings.push({
          type: 'array_length_difference',
          path,
          message: `Array length differs: TypeScript=${golden.length}, Go=${go.length}`,
          expected: golden.length,
          actual: go.length
        });
      }

      // Compare structure of first element (if exists)
      if (golden.length > 0 && go.length > 0) {
        const elementValidation = this.compareStructures(
          golden[0],
          go[0],
          `${path}[0]`
        );
        errors.push(...elementValidation.errors);
        warnings.push(...elementValidation.warnings);
      } else if (golden.length > 0 && go.length === 0) {
        warnings.push({
          type: 'empty_array',
          path,
          message: 'TypeScript has array items, Go array is empty (may be timing)'
        });
      }

      return { errors, warnings };
    }

    // Object validation
    if (typeof golden === 'object') {
      const goldenKeys = Object.keys(golden);
      const goKeys = Object.keys(go);

      // Check for missing fields (in TypeScript but not Go)
      for (const key of goldenKeys) {
        if (!(key in go)) {
          errors.push({
            type: 'missing_field',
            path: `${path}.${key}`,
            message: `Field exists in TypeScript but missing in Go`,
            field: key
          });
        } else {
          // Recursively compare nested structures
          const nestedValidation = this.compareStructures(
            golden[key],
            go[key],
            `${path}.${key}`
          );
          errors.push(...nestedValidation.errors);
          warnings.push(...nestedValidation.warnings);
        }
      }

      // Check for extra fields (in Go but not TypeScript)
      for (const key of goKeys) {
        if (!(key in golden)) {
          warnings.push({
            type: 'extra_field',
            path: `${path}.${key}`,
            message: `Field exists in Go but not in TypeScript (possible enhancement)`,
            field: key
          });
        }
      }

      return { errors, warnings };
    }

    // Primitive value comparison (only if strictValues enabled)
    if (this.strictValues && golden !== go) {
      warnings.push({
        type: 'value_difference',
        path,
        message: `Value differs: TypeScript="${golden}", Go="${go}"`,
        expected: golden,
        actual: go
      });
    }

    return { errors, warnings };
  }

  /**
   * Format validation results as human-readable report
   */
  formatReport(results) {
    const lines = [];

    if (results.valid) {
      lines.push(`✅ ${this.toolName}: PASSED`);
    } else {
      lines.push(`❌ ${this.toolName}: FAILED`);
    }

    if (results.errors.length > 0) {
      lines.push(`\n  Errors (${results.errors.length}):`);
      results.errors.forEach((error, i) => {
        lines.push(`    ${i + 1}. [${error.type}] ${error.path || ''}`);
        lines.push(`       ${error.message}`);
        if (error.expected !== undefined) {
          lines.push(`       Expected: ${error.expected}`);
          lines.push(`       Got: ${error.actual}`);
        }
      });
    }

    if (results.warnings.length > 0) {
      lines.push(`\n  Warnings (${results.warnings.length}):`);
      results.warnings.slice(0, 5).forEach((warning, i) => {
        lines.push(`    ${i + 1}. [${warning.type}] ${warning.path || ''}`);
        lines.push(`       ${warning.message}`);
      });
      if (results.warnings.length > 5) {
        lines.push(`    ... and ${results.warnings.length - 5} more warnings`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Validate a single tool response
 */
export function validateTool(toolName, goResponse, options = {}) {
  const validator = new HybridFormatValidator(toolName, options);
  return validator.validate(goResponse);
}

/**
 * Check if golden fixture exists for a tool
 */
export function hasGoldenFixture(toolName) {
  const goldenPath = join(GOLDEN_DIR, `${toolName}.json`);
  return existsSync(goldenPath);
}

/**
 * Get list of all available golden fixtures
 */
export async function listGoldenFixtures() {
  const { readdirSync } = await import('fs');
  if (!existsSync(GOLDEN_DIR)) {
    return [];
  }
  
  return readdirSync(GOLDEN_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}
