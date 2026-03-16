#!/usr/bin/env node

/**
 * Import DAG linter for the OCC codebase.
 *
 * Enforces the module dependency rules defined in specs/refactor/architecture.md.
 * Only cross-module imports are checked; intra-module imports are always allowed.
 *
 * Usage: node scripts/check-imports.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;

// ── Module Mapping ──────────────────────────────────────────────────────
// Maps each directory/file in src/ to its logical module name.

/** @param {string} relPath - path relative to src/, e.g. "code/build.ts" or "utils.ts" */
function getModule(relPath) {
  const parts = relPath.split('/');

  // Root-level files → module name is the filename without extension
  if (parts.length === 1) {
    return basename(parts[0], '.ts');
  }

  // Subdirectory files → module name is the directory
  return parts[0];
}

// ── Allowed Dependencies (from architecture.md) ────────────────────────
// '*' means the module can import from any other module.

const ALLOWED_DEPS = {
  // Layer 0: Foundation — no internal deps
  'types':          [],
  'utils':          [],
  '@types':         [],
  'tokens':         [],
  'progress-event': [],

  // Layer 1: Infrastructure — depends on shared only
  'walker':         ['types', 'utils'],
  'parsers':        ['types', 'utils'],
  'stats':          ['types', 'utils'],
  'scc':            ['utils'],
  'progress':       [],
  'cli-validation': [],
  'inspect':        ['tokens'],
  'structure':      ['utils', 'tokens'],
  'markdown':       ['utils'],

  // Layer 2: Output — depends on shared + infrastructure
  'output':         ['utils', 'stats', 'scc', 'structure'],

  // Layer 3: Domain commands — depends on shared + infrastructure + output
  'code':           ['utils', 'cli-validation', 'output', 'progress-event'],
  'doc':            ['utils', 'cli-validation', 'inspect', 'structure', 'markdown', 'output', 'walker', 'tokens'],
  'sheet':          ['utils', 'cli-validation', 'inspect', 'output'],
  'slide':          ['utils', 'cli-validation', 'inspect', 'output'],
  'table':          ['utils', 'cli-validation', 'inspect', 'output'],

  // Layer 4: Orchestrator — can import anything
  'cli':            ['*'],
};

// ── File Discovery ──────────────────────────────────────────────────────

/** @param {string} dir */
function findTsFiles(dir) {
  /** @type {string[]} */
  const results = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}

// ── Import Extraction ───────────────────────────────────────────────────

/**
 * @param {string} content
 * @returns {{ specifier: string, line: number }[]}
 */
function extractImports(content) {
  /** @type {{ specifier: string, line: number }[]} */
  const imports = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match import statements
    const importMatch = line.match(/^\s*import\s+(?:type\s+)?.*?\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch && importMatch[1].startsWith('.')) {
      imports.push({ specifier: importMatch[1], line: i + 1 });
      continue;
    }
    // Match export ... from statements
    const exportMatch = line.match(/^\s*export\s+(?:type\s+)?(?:\{.*?\}|\*)\s+from\s+['"]([^'"]+)['"]/);
    if (exportMatch && exportMatch[1].startsWith('.')) {
      imports.push({ specifier: exportMatch[1], line: i + 1 });
    }
  }

  return imports;
}

// ── Import Resolution ───────────────────────────────────────────────────

/**
 * Resolve a relative import specifier to its target module.
 * @param {string} importerRelPath - path of importing file relative to src/
 * @param {string} specifier - the import specifier (e.g., '../utils.js')
 * @returns {string} target module name
 */
function resolveImportModule(importerRelPath, specifier) {
  const importerDir = dirname(importerRelPath);
  // Remove .js/.ts extension from specifier for resolution
  const cleanSpec = specifier.replace(/\.[jt]sx?$/, '');
  // Resolve relative path
  const resolved = join(importerDir, cleanSpec);
  // Normalize (handle ../  etc.)
  const normalized = relative('', resolved);
  return getModule(normalized);
}

// ── Main ────────────────────────────────────────────────────────────────

const files = findTsFiles(SRC);
let violations = 0;

for (const file of files) {
  const relPath = relative(SRC, file);
  const sourceModule = getModule(relPath);

  const content = readFileSync(file, 'utf-8');
  const imports = extractImports(content);

  for (const { specifier, line } of imports) {
    const targetModule = resolveImportModule(relPath, specifier);

    // Intra-module imports are always allowed
    if (targetModule === sourceModule) continue;

    const allowed = ALLOWED_DEPS[sourceModule];
    if (!allowed) {
      console.error(`ERROR: Unknown module "${sourceModule}" (from ${relPath})`);
      violations++;
      continue;
    }

    // Wildcard allows everything
    if (allowed.includes('*')) continue;

    if (!allowed.includes(targetModule)) {
      console.error(`VIOLATION: ${relPath}:${line} — ${sourceModule} → ${targetModule} (${specifier})`);
      violations++;
    }
  }
}

// ── Summary ─────────────────────────────────────────────────────────────

console.log('');
console.log(`Checked ${files.length} files.`);

if (violations > 0) {
  console.error(`Import DAG violations: ${violations}`);
  process.exit(1);
} else {
  console.log('No import DAG violations found.');
  process.exit(0);
}
