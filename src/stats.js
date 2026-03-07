import path from 'node:path';
import { EXTENSION_TO_TYPE } from './utils.js';

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
      groups[key] = {
        fileType: key,
        files: 0,
        words: 0,
        pages: 0,
        paragraphs: 0,
        sheets: 0,
        rows: 0,
        cells: 0,
        slides: 0,
        size: 0,
        hasWords: false,
        hasPages: false,
        hasParagraphs: false,
        hasSheets: false,
        hasRows: false,
        hasCells: false,
        hasSlides: false,
      };
    }
    const g = groups[key];
    g.files++;
    g.size += r.size || 0;

    if (r.success && r.metrics) {
      const m = r.metrics;
      if (m.words != null) { g.words += m.words; g.hasWords = true; }
      if (m.pages != null) { g.pages += m.pages; g.hasPages = true; }
      if (m.paragraphs != null) { g.paragraphs += m.paragraphs; g.hasParagraphs = true; }
      if (m.sheets != null) { g.sheets += m.sheets; g.hasSheets = true; }
      if (m.rows != null) { g.rows += m.rows; g.hasRows = true; }
      if (m.cells != null) { g.cells += m.cells; g.hasCells = true; }
      if (m.slides != null) { g.slides += m.slides; g.hasSlides = true; }
    }
  }

  const rows = Object.values(groups);
  sortRows(rows, sort);

  const totals = computeTotals(rows);
  const columns = detectColumns(rows);

  return { rows, totals, columns, mode: 'grouped' };
}

function aggregateByFile(results, sort) {
  const rows = results.map(r => ({
    fileType: r.success ? r.fileType : 'Unreadable',
    fileName: path.basename(r.filePath),
    filePath: r.filePath,
    files: 1,
    words: r.metrics?.words || 0,
    pages: r.metrics?.pages || 0,
    paragraphs: r.metrics?.paragraphs || 0,
    sheets: r.metrics?.sheets || 0,
    rows: r.metrics?.rows || 0,
    cells: r.metrics?.cells || 0,
    slides: r.metrics?.slides || 0,
    size: r.size || 0,
    hasWords: r.metrics?.words != null,
    hasPages: r.metrics?.pages != null,
    hasParagraphs: r.metrics?.paragraphs != null,
    hasSheets: r.metrics?.sheets != null,
    hasRows: r.metrics?.rows != null,
    hasCells: r.metrics?.cells != null,
    hasSlides: r.metrics?.slides != null,
  }));

  sortRows(rows, sort);

  const totals = computeTotals(rows);
  const columns = detectColumns(rows);

  return { rows, totals, columns, mode: 'by-file' };
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
  const totals = {
    fileType: 'Total',
    files: 0,
    words: 0,
    pages: 0,
    paragraphs: 0,
    sheets: 0,
    rows: 0,
    cells: 0,
    slides: 0,
    size: 0,
  };
  for (const r of rows) {
    totals.files += r.files;
    totals.words += r.words;
    totals.pages += r.pages;
    totals.paragraphs += r.paragraphs;
    totals.sheets += r.sheets;
    totals.rows += r.rows;
    totals.cells += r.cells;
    totals.slides += r.slides;
    totals.size += r.size;
  }
  return totals;
}

function detectColumns(rows) {
  return {
    hasWords: rows.some(r => r.hasWords),
    hasPages: rows.some(r => r.hasPages),
    hasParagraphs: rows.some(r => r.hasParagraphs),
    hasSheets: rows.some(r => r.hasSheets),
    hasRows: rows.some(r => r.hasRows),
    hasCells: rows.some(r => r.hasCells),
    hasSlides: rows.some(r => r.hasSlides),
  };
}
