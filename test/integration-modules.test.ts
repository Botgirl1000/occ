/**
 * Integration tests for modular architecture (Phase 4).
 *
 * These tests verify that module boundaries are correct after the
 * Phase 3 extraction. Each test imports from the NEW module paths
 * (not re-export shims) and exercises cross-module interactions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import XLSX from 'xlsx';

// ── Layer 0: shared ──────────────────────────────────────────────────────
import type { FileEntry, ParseResult } from '../src/types.js';
import { countWords, formatBytes, getExtension, OFFICE_EXTENSIONS } from '../src/utils.js';

// ── Layer 1: pipeline (uses shared) ─────────────────────────────────────
import { aggregate } from '../src/stats.js';

// ── Layer 1: content (uses shared) ──────────────────────────────────────
import { estimateTokens, createInspectPayload } from '../src/inspect/shared.js';
import { getCell, renderCell, isNonEmptyCell } from '../src/inspect/xlsx-cells.js';

// ── Layer 3: inspect-commands (uses content + shared) ───────────────────
import { inspectWorkbook } from '../src/sheet/inspect.js';
import { inspectDocument } from '../src/doc/inspect.js';

// ── Layer 4: cli (orchestrator) ─────────────────────────────────────────
import { run } from '../src/cli.js';

const FIXTURES = path.resolve('test/fixtures');
const execFileAsync = promisify(execFile);

// ─── Shared → Pipeline Integration ─────────────────────────────────────

test('shared types flow into pipeline aggregate()', () => {
  const results: ParseResult[] = [
    { filePath: '/a.docx', size: 1024, success: true, fileType: 'Word', metrics: { words: 500, pages: 3, paragraphs: 20 } },
    { filePath: '/b.xlsx', size: 2048, success: true, fileType: 'Excel', metrics: { sheets: 2, rows: 100, cells: 300 } },
  ];

  const agg = aggregate(results);

  assert.equal(agg.rows.length, 2, 'two file-type rows');
  assert.equal(agg.totals.files, 2, 'total file count');
  assert.ok(agg.columns, 'column visibility computed');
});

// ─── Shared → Content Integration ───────────────────────────────────────

test('content module estimateTokens uses language-aware calculation', () => {
  const tokens = estimateTokens('hello world — some sample text');
  assert.ok(tokens > 0, 'token estimate is positive');
  // Tokenx-based estimator: segments are language-aware, not chars/4
  assert.ok(tokens >= 4 && tokens <= 15, `token estimate ${tokens} is within reasonable range`);
});

test('content module createInspectPayload wraps results correctly', () => {
  const payload = createInspectPayload('/test.docx', { format: 'json' }, { words: 42 });
  assert.equal(payload.file, '/test.docx');
  assert.deepEqual(payload.query, { format: 'json' });
  assert.deepEqual(payload.results, { words: 42 });
});

// ─── Extracted xlsx-cells used by both sheet and table ──────────────────

test('xlsx-cells getCell/renderCell work with real worksheet', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Value'],
    ['Alice', 42],
    ['Bob', null],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const cell = getCell(ws, 0, 0);
  assert.ok(cell, 'cell A1 exists');
  assert.equal(renderCell(cell), 'Name');

  const numCell = getCell(ws, 1, 1);
  assert.ok(numCell, 'cell B2 exists');
  assert.equal(renderCell(numCell), '42');

  assert.equal(renderCell(undefined), '', 'undefined cell renders empty');
});

test('xlsx-cells isNonEmptyCell detects content', () => {
  const ws = XLSX.utils.aoa_to_sheet([['Hello'], [null]]);
  const filled = getCell(ws, 0, 0);
  assert.ok(filled, 'filled cell exists');
  assert.ok(isNonEmptyCell(filled), 'filled cell is non-empty');
});

// ─── Sheet inspect uses xlsx-cells from new path ────────────────────────

test('sheet inspect composes with xlsx-cells and shared inspect', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'occ-integ-'));
  const filePath = path.join(tempDir, 'test.xlsx');

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['ID', 'Name', 'Score'],
    [1, 'Alice', 95],
    [2, 'Bob', 87],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  await writeFile(filePath, buffer);

  const result = await inspectWorkbook(filePath, {});
  assert.ok(result.workbook, 'workbook metadata present');
  assert.ok(result.sheets.length > 0, 'at least one sheet profiled');
  assert.equal(result.sheets[0].name, 'Data');
});

// ─── Doc inspect uses content module (markdown, structure) ──────────────

test('doc inspect composes content and shared modules', async () => {
  const result = await inspectDocument(path.join(FIXTURES, 'sample.docx'), {
    includeStructure: true,
    sampleParagraphs: 5,
  });
  assert.ok(result.properties, 'properties from inspect/shared used');
  assert.ok(result.contentStats, 'content stats extraction works');
  assert.ok(result.contentPreview, 'content preview works');
  assert.ok(result.fullTokenEstimate > 0, 'token estimation from content module works');
});

// ─── CLI entry point e2e ────────────────────────────────────────────────

test('CLI run() orchestrates all modules for document scan', async () => {
  const stdoutChunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding | ((error?: Error | null) => void), cb?: (error?: Error | null) => void) => {
    if (typeof chunk === 'string') {
      stdoutChunks.push(chunk);
    } else {
      return originalWrite(chunk, encoding as BufferEncoding, cb);
    }
    const callback = typeof encoding === 'function' ? encoding : cb;
    if (callback) callback();
    return true;
  }) as typeof process.stdout.write;

  try {
    await run(['node', 'occ', '--format', 'json', FIXTURES]);
  } finally {
    process.stdout.write = originalWrite;
  }

  const output = stdoutChunks.join('');
  const parsed = JSON.parse(output);
  assert.ok(parsed.documents, 'JSON output has documents section');
  assert.ok(parsed.documents.files.length > 0, 'scanned document files');
});

test('CLI run() orchestrates structure extraction across modules', async () => {
  const stdoutChunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding | ((error?: Error | null) => void), cb?: (error?: Error | null) => void) => {
    if (typeof chunk === 'string') {
      stdoutChunks.push(chunk);
    } else {
      return originalWrite(chunk, encoding as BufferEncoding, cb);
    }
    const callback = typeof encoding === 'function' ? encoding : cb;
    if (callback) callback();
    return true;
  }) as typeof process.stdout.write;

  try {
    await run(['node', 'occ', '--structure', '--format', 'json', FIXTURES]);
  } finally {
    process.stdout.write = originalWrite;
  }

  const output = stdoutChunks.join('');
  const parsed = JSON.parse(output);
  assert.ok(parsed.structures, 'JSON output has structures section');
});

// ─── Import DAG programmatic check ──────────────────────────────────────

test('import DAG linter passes with zero violations', async () => {
  const { stdout, stderr } = await execFileAsync('node', ['scripts/check-imports.mjs']);
  assert.ok(stdout.includes('No import DAG violations found'), 'DAG check clean');
  assert.ok(!stderr.includes('VIOLATION'), 'no violations in stderr');
});

// ─── Cross-layer type compatibility ─────────────────────────────────────

test('shared utility functions produce correct types for downstream consumers', () => {
  // Verify shared → pipeline type flow
  const ext = getExtension('report.docx');
  assert.equal(ext, 'docx');
  assert.ok(OFFICE_EXTENSIONS.includes(ext), 'extension recognized');

  const formatted = formatBytes(1536);
  assert.equal(typeof formatted, 'string');

  const words = countWords('hello world foo bar');
  assert.equal(words, 4);
});
