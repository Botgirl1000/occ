import path from 'node:path';
import { METRIC_FIELDS, hasKey } from './utils.js';

const SUM_FIELDS = ['files', ...METRIC_FIELDS, 'size'];

export function aggregate(results, options = {}) {
  const { byFile = false, sort = 'files' } = options;

  if (byFile) {
    return aggregateByFile(results, sort);
  }
  return aggregateByType(results, sort);
}

function aggregateByType(results, sort) {
  const groups = {};

  for (const r of results) {
    const key = r.success ? r.fileType : 'Unreadable';
    if (!groups[key]) {
      const g = { fileType: key, files: 0, size: 0 };
      for (const f of METRIC_FIELDS) { g[f] = 0; g[hasKey(f)] = false; }
      groups[key] = g;
    }
    const g = groups[key];
    g.files++;
    g.size += r.size || 0;

    if (r.success && r.metrics) {
      const m = r.metrics;
      for (const f of METRIC_FIELDS) {
        if (m[f] != null) { g[f] += m[f]; g[hasKey(f)] = true; }
      }
    }
  }

  return finalize(Object.values(groups), sort, 'grouped');
}

function aggregateByFile(results, sort) {
  const rows = results.map(r => {
    const row = {
      fileType: r.success ? r.fileType : 'Unreadable',
      fileName: path.basename(r.filePath),
      filePath: r.filePath,
      files: 1,
      size: r.size || 0,
    };
    for (const f of METRIC_FIELDS) {
      row[f] = r.metrics?.[f] || 0;
      row[hasKey(f)] = r.metrics?.[f] != null;
    }
    return row;
  });

  return finalize(rows, sort, 'by-file');
}

function finalize(rows, sort, mode) {
  sortRows(rows, sort);
  const totals = computeTotals(rows);
  const columns = detectColumns(rows);
  return { rows, totals, columns, mode };
}

function sortRows(rows, sort) {
  const sortFns = {
    files: (a, b) => b.files - a.files,
    name: (a, b) => (a.fileType || a.fileName || '').localeCompare(b.fileType || b.fileName || ''),
    words: (a, b) => b.words - a.words,
    size: (a, b) => b.size - a.size,
  };
  const fn = sortFns[sort] || sortFns.files;
  rows.sort(fn);
}

function computeTotals(rows) {
  const totals = { fileType: 'Total' };
  for (const f of SUM_FIELDS) totals[f] = 0;
  for (const r of rows) {
    for (const f of SUM_FIELDS) totals[f] += r[f];
  }
  return totals;
}

function detectColumns(rows) {
  const columns = {};
  for (const f of METRIC_FIELDS) {
    columns[hasKey(f)] = rows.some(r => r[hasKey(f)]);
  }
  return columns;
}
