#!/usr/bin/env node

/**
 * AK-FLOW Test Runner
 * 
 * Advanced test execution with reporting and analysis
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Test categories
const TEST_CATEGORIES = {
    UNIT: '__tests__/unit/',
    INTEGRATION: '__tests__/integration/',
    E2E: '__tests__/e2e/',
    ALL: '__tests__/'
};

// Test configurations
const TEST_CONFIGS = {
    DEFAULT: 'vitest run --config vitest.config.ts',
    WATCH: 'vitest watch --config vitest.config.ts',
    COVERAGE: 'vitest run --config vitest.config.ts --coverage',
    CI: 'vitest run --config vitest.config.ts --reporter=verbose'
};

// Color codes for console output
const COLORS = {
    RESET: '\x1b[0m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    BOLD: '\x1b[1m'
};

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const category = args[1];
const filter = args[2];

function log(message, color = COLORS.RESET) {
    console.log(`${color}${message}${COLORS.RESET}`);
}

function logHeader(message) {
    log(`\n${COLORS.BOLD}${COLORS.CYAN}=== ${message} ===${COLORS.RESET}\n`);
}

function logSuccess(message) {
    log(`${COLORS.GREEN}✓ ${message}${COLORS.RESET}`);
}

function logError(message) {
    log(`${COLORS.RED}✗ ${message}${COLORS.RESET}`);
}

function logInfo(message) {
    log(`${COLORS.BLUE}ℹ ${message}${COLORS.RESET}`);
}

function runCommand(cmd, description) {
    logInfo(`Running: ${description}`);
    logInfo(cmd);
    
    try {
        const result = execSync(cmd, { 
            cwd: rootDir,
            encoding: 'utf8',
            stdio: 'inherit'
        });
        return { success: true, result };
    } catch (error) {
        logError(`Command failed: ${cmd}`);
        return { success: false, error };
    }
}

function getTestFiles(category) {
    const categoryPath = TEST_CATEGORIES[category.toUpperCase()] || category;
    const fullPath = path.join(rootDir, categoryPath);
    
    if (!fs.existsSync(fullPath)) {
        logError(`Category not found: ${category}`);
        return [];
    }
    
    const files = [];
    
    function traverse(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                traverse(fullPath);
            } else if (item.endsWith('.test.ts')) {
                files.push(fullPath);
            }
        }
    }
    
    traverse(fullPath);
    return files;
}

function analyzeTestCoverage() {
    const coverageDir = path.join(rootDir, 'coverage');
    
    if (!fs.existsSync(coverageDir)) {
        logError('No coverage data found. Run tests with --coverage first.');
        return;
    }
    
    const coverageFile = path.join(coverageDir, 'coverage-summary.json');
    
    if (!fs.existsSync(coverageFile)) {
        logError('Coverage summary not found.');
        return;
    }
    
    const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    
    logHeader('TEST COVERAGE ANALYSIS');
    
    for (const [file, stats] of Object.entries(coverage.total)) {
        const lines = stats.lines.pct;
        const functions = stats.functions.pct;
        const branches = stats.branches.pct;
        const statements = stats.statements.pct;
        
        const color = lines >= 80 ? COLORS.GREEN : lines >= 60 ? COLORS.YELLOW : COLORS.RED;
        
        log(`${COLORS.BOLD}${file}${COLORS.RESET}`);
        log(`  Lines: ${color}${lines}%${COLORS.RESET}`);
        log(`  Functions: ${color}${functions}%${COLORS.RESET}`);
        log(`  Branches: ${color}${branches}%${COLORS.RESET}`);
        log(`  Statements: ${color}${statements}%${COLORS.RESET}`);
    }
}

function showHelp() {
    logHeader('AK-FLOW TEST RUNNER HELP');
    log('Usage: node scripts/test-runner.js <command> [category] [filter]');
    log('');
    log('Commands:');
    log('  run          Run tests');
    log('  watch        Run tests in watch mode');
    log('  coverage     Run tests with coverage');
    log('  ci           Run tests in CI mode');
    log('  analyze      Analyze test coverage');
    log('  list         List test files');
    log('  help         Show this help');
    log('');
    log('Categories:');
    log('  unit         Unit tests');
    log('  integration  Integration tests');
    log('  e2e          End-to-end tests');
    log('  all          All tests (default)');
    log('');
    log('Examples:');
    log('  node scripts/test-runner.js run unit');
    log('  node scripts/test-runner.js coverage integration');
    log('  node scripts/test-runner.js analyze');
}

// Main execution
switch (command) {
    case 'run':
        logHeader('RUNNING TESTS');
        const runCategory = category || 'all';
        const runConfig = TEST_CONFIGS.DEFAULT;
        
        if (filter) {
            const filterPattern = filter.endsWith('.test.ts') ? filter : `${filter}.test.ts`;
            runCommand(`${runConfig} ${filterPattern}`, `Running ${runCategory} tests with filter: ${filter}`);
        } else {
            runCommand(`${runConfig} ${TEST_CATEGORIES[runCategory.toUpperCase()] || runCategory}`, `Running ${runCategory} tests`);
        }
        break;
    
    case 'watch':
        logHeader('WATCHING TESTS');
        const watchCategory = category || 'all';
        runCommand(`${TEST_CONFIGS.WATCH} ${TEST_CATEGORIES[watchCategory.toUpperCase()] || watchCategory}`, `Watching ${watchCategory} tests`);
        break;
    
    case 'coverage':
        logHeader('RUNNING TESTS WITH COVERAGE');
        const coverageCategory = category || 'all';
        runCommand(`${TEST_CONFIGS.COVERAGE} ${TEST_CATEGORIES[coverageCategory.toUpperCase()] || coverageCategory}`, `Running ${coverageCategory} tests with coverage`);
        break;
    
    case 'ci':
        logHeader('RUNNING TESTS IN CI MODE');
        const ciCategory = category || 'all';
        runCommand(`${TEST_CONFIGS.CI} ${TEST_CATEGORIES[ciCategory.toUpperCase()] || ciCategory}`, `Running ${ciCategory} tests in CI mode`);
        break;
    
    case 'analyze':
        analyzeTestCoverage();
        break;
    
    case 'list':
        logHeader('LISTING TEST FILES');
        const listCategory = category || 'all';
        const files = getTestFiles(listCategory);
        
        if (files.length === 0) {
            logError(`No test files found in category: ${listCategory}`);
        } else {
            logSuccess(`Found ${files.length} test files:`);
            files.forEach(file => {
                const relativePath = path.relative(rootDir, file);
                log(`  - ${relativePath}`);
            });
        }
        break;
    
    case 'help':
    case undefined:
    default:
        showHelp();
        break;
}