#!/usr/bin/env node

/**
 * Phase 5.1 Integration Test - Verify UndoManager integration into FixItModal
 * Tests that all components are properly wired together for dynamic undo
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Phase 5.1 UndoManager Integration\n');

let errors = 0;

// Test 1: Verify UndoManager.js exists
console.log('Test 1: UndoManager.js exists...');
const undoManagerPath = path.join(__dirname, '../demo/js/core/UndoManager.js');
if (fs.existsSync(undoManagerPath)) {
    const content = fs.readFileSync(undoManagerPath, 'utf8');
    if (content.includes('class UndoManager')) {
        console.log('  ✅ UndoManager class found');
    } else {
        console.log('  ❌ UndoManager class not found in file');
        errors++;
    }
    
    // Check for required methods
    const requiredMethods = [
        'captureCurrentState',
        'captureFallback',
        'determineReversibility',
        'generateUndoAction',
        'generateUndoLabel',
        'generateUndoCLI',
        'storeUndoInfo',
        'getUndoInfo',
        'clearUndoInfo',
        'hasUndo'
    ];
    
    requiredMethods.forEach(method => {
        if (content.includes(`${method}(`)) {
            console.log(`    ✅ ${method}() method found`);
        } else {
            console.log(`    ❌ ${method}() method missing`);
            errors++;
        }
    });
} else {
    console.log('  ❌ UndoManager.js not found');
    errors++;
}

// Test 2: Verify index.html loads UndoManager
console.log('\nTest 2: index.html loads UndoManager...');
const indexPath = path.join(__dirname, '../demo/index.html');
if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8');
    if (content.includes('<script src="js/core/UndoManager.js"></script>')) {
        console.log('  ✅ UndoManager.js script tag found');
    } else {
        console.log('  ❌ UndoManager.js script tag missing');
        errors++;
    }
} else {
    console.log('  ❌ index.html not found');
    errors++;
}

// Test 3: Verify FixItModal accepts undoManager parameter
console.log('\nTest 3: FixItModal accepts undoManager parameter...');
const fixItModalPath = path.join(__dirname, '../demo/js/components/FixItModal.js');
if (fs.existsSync(fixItModalPath)) {
    const content = fs.readFileSync(fixItModalPath, 'utf8');
    
    if (content.includes('constructor(apiClient, parameterResolver, undoManager)')) {
        console.log('  ✅ Constructor accepts undoManager parameter');
    } else {
        console.log('  ❌ Constructor missing undoManager parameter');
        errors++;
    }
    
    if (content.includes('this.undoManager = undoManager')) {
        console.log('  ✅ undoManager stored as instance variable');
    } else {
        console.log('  ❌ undoManager not stored as instance variable');
        errors++;
    }
} else {
    console.log('  ❌ FixItModal.js not found');
    errors++;
}

// Test 4: Verify execute() captures state
console.log('\nTest 4: execute() captures state before execution...');
if (fs.existsSync(fixItModalPath)) {
    const content = fs.readFileSync(fixItModalPath, 'utf8');
    
    if (content.includes('await this.undoManager.captureCurrentState')) {
        console.log('  ✅ State capture call found');
    } else {
        console.log('  ❌ State capture call missing');
        errors++;
    }
    
    if (content.includes('this.undoManager.determineReversibility')) {
        console.log('  ✅ Reversibility determination found');
    } else {
        console.log('  ❌ Reversibility determination missing');
        errors++;
    }
    
    if (content.includes('this.showSuccess(result, originalState, reversibility)')) {
        console.log('  ✅ State passed to showSuccess()');
    } else {
        console.log('  ❌ State not passed to showSuccess()');
        errors++;
    }
}

// Test 5: Verify showSuccess() uses UndoManager
console.log('\nTest 5: showSuccess() uses UndoManager...');
if (fs.existsSync(fixItModalPath)) {
    const content = fs.readFileSync(fixItModalPath, 'utf8');
    
    if (content.includes('showSuccess(result, originalState, reversibility)')) {
        console.log('  ✅ showSuccess() accepts new parameters');
    } else {
        console.log('  ❌ showSuccess() signature not updated');
        errors++;
    }
    
    if (content.includes('this.undoManager.generateUndoAction')) {
        console.log('  ✅ generateUndoAction() call found');
    } else {
        console.log('  ❌ generateUndoAction() call missing');
        errors++;
    }
    
    if (content.includes('this.undoManager.storeUndoInfo')) {
        console.log('  ✅ storeUndoInfo() call found');
    } else {
        console.log('  ❌ storeUndoInfo() call missing');
        errors++;
    }
    
    // Verify old hardcoded method is removed
    if (!content.match(/storeUndoInfo\(\)\s*{[\s\S]*?reversibleActions\s*=/)) {
        console.log('  ✅ Old hardcoded storeUndoInfo() removed');
    } else {
        console.log('  ⚠️  Old hardcoded storeUndoInfo() still present (should be removed)');
    }
}

// Test 6: Verify app.js instantiates UndoManager
console.log('\nTest 6: app.js instantiates UndoManager...');
const appPath = path.join(__dirname, '../demo/app.js');
if (fs.existsSync(appPath)) {
    const content = fs.readFileSync(appPath, 'utf8');
    
    if (content.includes('new UndoManager(')) {
        console.log('  ✅ UndoManager instantiation found');
    } else {
        console.log('  ❌ UndoManager instantiation missing');
        errors++;
    }
    
    if (content.includes('window.undoManager =')) {
        console.log('  ✅ UndoManager assigned to window');
    } else {
        console.log('  ❌ UndoManager not assigned to window');
        errors++;
    }
    
    if (content.includes('new FixItModal(this.apiClient, window.parameterResolver, window.undoManager)')) {
        console.log('  ✅ UndoManager passed to FixItModal constructor');
    } else {
        console.log('  ❌ UndoManager not passed to FixItModal');
        errors++;
    }
}

// Summary
console.log('\n' + '═'.repeat(60));
if (errors === 0) {
    console.log('✅ All integration tests passed! Phase 5.1 complete.');
    console.log('\nNext steps:');
    console.log('  1. Start demo: ./start-demo.sh');
    console.log('  2. Navigate to Alerts view');
    console.log('  3. Find volume offline alert');
    console.log('  4. Execute Fix-It action');
    console.log('  5. Verify undo button appears in Alert Details');
    process.exit(0);
} else {
    console.log(`❌ ${errors} integration test(s) failed.`);
    console.log('\nPlease fix the issues above before testing.');
    process.exit(1);
}
