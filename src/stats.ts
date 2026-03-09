import path from 'node:path';
import { METRIC_FIELDS, hasKey } from './utils.js';
import type { ParseResult } from './types.js';

// Stats rows use dynamic keys (hasWords, hasPages, etc.) so we use a record type
export interface StatsRow {
  fileType: string;
  fileName?: string;
  filePath?: string;
  files: number;
  size: number;
  words: number;
  pages: number;
  paragraphs: number;
  sheets: number;
  rows: number;
  cells: number;
  slides: number;
  [key: string]: string | number | boolean | undefined;
}

export interface ColumnVisibility {
  [key: string]: boolean;
}

export interface AggregateResult {
  rows: StatsRow[];
  totals: StatsRow;
  columns: ColumnVisibility;
  mode: string;
}

export interface AggregateOptions {
  byFile?: boolean;
  sort?: string;
}

const SUM_FIELDS = ['files', ...METRIC_FIELDS, 'size'] as const;

export function aggregate(results: ParseResult[], options: AggregateOptions = {}): AggregateResult {
  const { byFile = false, sort = 'files' } = options;

  if (byFile) {
    return aggregateByFile(results, sort);
  }
  return aggregateByType(results, sort);
}

function aggregateByType(results: ParseResult[], sort: string): AggregateResult {
  const groups: Record<string, StatsRow> = {};

  for (const r of results) {
    const key = r.success ? r.fileType : 'Unreadable';
    if (!groups[key]) {
      const g: StatsRow = { fileType: key, files: 0, size: 0, words: 0, pages: 0, paragraphs: 0, sheets: 0, rows: 0, cells: 0, slides: 0 };
      for (const f of METRIC_FIELDS) { g[hasKey(f)] = false; }
      groups[key] = g;
    }
    const g = groups[key];
    g.files++;
    g.size += r.size || 0;

    if (r.success && r.metrics) {
      const m = r.metrics;
      for (const f of METRIC_FIELDS) {
        if (m[f] != null) { (g[f] as number) += m[f]; g[hasKey(f)] = true; }
      }
    }
  }

  return finalize(Object.values(groups), sort, 'grouped');
}

function aggregateByFile(results: ParseResult[], sort: string): AggregateResult {
  const rows: StatsRow[] = results.map(r => {
    const row: StatsRow = {
      fileType: r.success ? r.fileType : 'Unreadable',
      fileName: path.basename(r.filePath),
      filePath: r.filePath,
      files: 1,
      size: r.size || 0,
      words: 0, pages: 0, paragraphs: 0, sheets: 0, rows: 0, cells: 0, slides: 0,
    };
    for (const f of METRIC_FIELDS) {
      row[f] = r.metrics?.[f] || 0;
      row[hasKey(f)] = r.metrics?.[f] != null;
    }
    return row;
  });

  return finalize(rows, sort, 'by-file');
}

function finalize(rows: StatsRow[], sort: string, mode: string): AggregateResult {
  sortRows(rows, sort);
  const totals = computeTotals(rows);
  const columns = detectColumns(rows);
  return { rows, totals, columns, mode };
}

function sortRows(rows: StatsRow[], sort: string) {
  const sortFns: Record<string, (a: StatsRow, b: StatsRow) => number> = {
    files: (a, b) => b.files - a.files,
    name: (a, b) => (a.fileType || a.fileName || '').localeCompare(b.fileType || b.fileName || ''),
    words: (a, b) => b.words - a.words,
    size: (a, b) => b.size - a.size,
  };
  const fn = sortFns[sort] || sortFns.files;
  rows.sort(fn);
}

function computeTotals(rows: StatsRow[]): StatsRow {
  const totals: StatsRow = { fileType: 'Total', files: 0, size: 0, words: 0, pages: 0, paragraphs: 0, sheets: 0, rows: 0, cells: 0, slides: 0 };
  for (const f of SUM_FIELDS) totals[f] = 0;
  for (const r of rows) {
    for (const f of SUM_FIELDS) (totals[f] as number) += (r[f] as number);
  }
  return totals;
}

function detectColumns(rows: StatsRow[]): ColumnVisibility {
  const columns: ColumnVisibility = {};
  for (const f of METRIC_FIELDS) {
    columns[hasKey(f)] = rows.some(r => !!r[hasKey(f)]);
  }
  return columns;
}
