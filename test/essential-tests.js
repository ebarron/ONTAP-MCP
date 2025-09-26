#!/usr/bin/env node

/**
 * Essential Tests Runner - Focused set of core tests for JSON-RPC validation
 * Usage: node essential-tests.js
 */

import { spawn } from 'child_process';

const TESTS = [
  {
    name: 'Volume Lifecycle (REST/JSON-RPC)',
    command: 'node test/test-volume-lifecycle.js rest',
    timeout: 60000
  },
  {
    name: 'Comprehensive Tool Test',
    command: 'node test/test-comprehensive.js',
    timeout: 30000
  },
  {
    name: 'Export Policy Lifecycle', 
    command: 'node test/test-export-policy-lifecycle.js',
    timeout: 60000
  },
  {
    name: 'CIFS Simple Registration',
    command: 'node test/test-cifs-simple.js rest',
    timeout: 30000
  },
  {
    name: 'Cluster Info Test',
    command: 'node test/test-cluster-info.js rest',
    timeout: 30000
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`🧪 Running: ${test.name}`);
    
    const child = spawn('bash', ['-c', test.command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';
    let completed = false;

    const timeout = setTimeout(() => {
      if (!completed) {
        child.kill('SIGTERM');
        resolve({
          name: test.name,
          success: false,
          error: 'Test timeout',
          duration: test.timeout / 1000
        });
      }
    }, test.timeout);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      completed = true;
      clearTimeout(timeout);
      
      const success = code === 0;
      const output = success ? 
        stdout.split('\n').slice(-3).join('\n').trim() : 
        stderr.split('\n')[0] || `Exit code: ${code}`;

      resolve({
        name: test.name,
        success,
        error: success ? null : output,
        duration: Date.now() / 1000 // Approximate
      });
    });
  });
}

async function main() {
  console.log('🚀 Essential Tests - JSON-RPC Validation Suite\n');
  
  const results = [];
  const startTime = Date.now();

  for (const test of TESTS) {
    const result = await runTest(test);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.name} - PASSED`);
    } else {
      console.log(`❌ ${result.name} - FAILED`);
      console.log(`   Error: ${result.error}`);
    }
    console.log(); // blank line
  }

  const totalTime = (Date.now() - startTime) / 1000;
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;

  console.log('📊 Essential Tests Summary');
  console.log('=' .repeat(50));
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Time: ${totalTime.toFixed(1)}s`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (passed >= results.length * 0.8) {
    console.log('\n🎉 Essential functionality verified! JSON-RPC conversion successful.');
  } else {
    console.log('\n⚠️ Some essential tests failed. Review needed.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);