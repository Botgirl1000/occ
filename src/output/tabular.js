import Table from 'cli-table3';
import chalk from 'chalk';
import { formatBytes, formatNumber } from '../utils.js';

export function formatDocumentTable(stats, options = {}) {
  const { ci = false } = options;
  const c = ci ? noColor : colorize;

  const headers = buildHeaders(stats.columns, stats.mode === 'by-file', c);
  const table = new Table({
    head: headers.map(h => h.label),
    chars: ci ? asciiChars() : unicodeChars(),
    style: { head: [], border: [] },
  });

  for (const row of stats.rows) {
    table.push(buildRow(row, stats.columns, stats.mode === 'by-file', c));
  }

  // Totals row
  const isByFile = stats.mode === 'by-file';
  table.push(buildRow(stats.totals, stats.columns, isByFile, c, true));

  const lines = [];
  lines.push('');
  lines.push(c.header(`── Documents ${'─'.repeat(56)}`));
  lines.push(table.toString());

  // Footnotes
  const hasEstimatedPages = stats.rows.some(r =>
    ['Word', 'ODT'].includes(r.fileType) && r.hasPages
  );
  if (hasEstimatedPages) {
    lines.push(c.dim('* Word/ODT pages estimated at 250 words/page'));
  }

  return lines.join('\n');
}

export function formatSccTable(sccData, options = {}) {
  const { ci = false, byFile = false } = options;
  const c = ci ? noColor : colorize;

  if (!sccData || sccData.length === 0) return '';

  const table = new Table({
    head: [
      c.headerCell('Language'),
      c.headerCell('Files'),
      c.headerCell('Lines'),
      c.headerCell('Blanks'),
      c.headerCell('Comments'),
      c.headerCell('Code'),
    ],
    chars: ci ? asciiChars() : unicodeChars(),
    style: { head: [], border: [] },
    colAligns: ['left', 'right', 'right', 'right', 'right', 'right'],
  });

  let totalFiles = 0, totalLines = 0, totalBlanks = 0, totalComments = 0, totalCode = 0;

  for (const lang of sccData) {
    if (byFile && lang.Files) {
      for (const file of lang.Files) {
        table.push([
          c.type(file.Filename || file.Location || ''),
          formatNumber(1),
          c.number(formatNumber(file.Lines)),
          formatNumber(file.Blank),
          formatNumber(file.Comment),
          c.number(formatNumber(file.Code)),
        ]);
      }
    } else {
      table.push([
        c.type(lang.Name),
        formatNumber(lang.Count),
        c.number(formatNumber(lang.Lines)),
        formatNumber(lang.Blank),
        formatNumber(lang.Comment),
        c.number(formatNumber(lang.Code)),
      ]);
    }
    totalFiles += lang.Count || 0;
    totalLines += lang.Lines || 0;
    totalBlanks += lang.Blank || 0;
    totalComments += lang.Comment || 0;
    totalCode += lang.Code || 0;
  }

  table.push([
    c.total('Total'),
    c.total(formatNumber(totalFiles)),
    c.total(formatNumber(totalLines)),
    c.total(formatNumber(totalBlanks)),
    c.total(formatNumber(totalComments)),
    c.total(formatNumber(totalCode)),
  ]);

  const lines = [];
  lines.push('');
  lines.push(c.header(`── Code (via scc) ${'─'.repeat(51)}`));
  lines.push(table.toString());

  return lines.join('\n');
}

function buildHeaders(columns, byFile, c) {
  const headers = [];
  headers.push({ key: 'format', label: c.headerCell(byFile ? 'File' : 'Format') });
  if (!byFile) headers.push({ key: 'files', label: c.headerCell('Files') });
  if (columns.hasWords) headers.push({ key: 'words', label: c.headerCell('Words') });
  if (columns.hasPages) headers.push({ key: 'pages', label: c.headerCell('Pages') });

  // Extra column for type-specific metrics
  const hasExtra = columns.hasParagraphs || columns.hasSheets || columns.hasSlides ||
                   columns.hasRows || columns.hasCells;
  if (hasExtra) headers.push({ key: 'extra', label: c.headerCell('Extra') });

  headers.push({ key: 'size', label: c.headerCell('Size') });
  return headers;
}

function buildRow(row, columns, byFile, c, isTotal = false) {
  const fmt = isTotal ? c.total : (v) => v;
  const fmtType = isTotal ? c.total : c.type;
  const fmtNum = isTotal ? c.total : c.number;

  const cells = [];
  let label;
  if (byFile && isTotal) {
    label = `Total (${formatNumber(row.files)} files)`;
  } else if (byFile) {
    label = row.fileName || row.fileType;
  } else {
    label = row.fileType;
  }
  cells.push(row.fileType === 'Unreadable' ? c.error(label) : fmtType(label));

  if (!byFile) cells.push(fmt(formatNumber(row.files)));

  if (columns.hasWords) cells.push(fmtNum(row.words ? formatNumber(row.words) : ''));
  if (columns.hasPages) cells.push(fmtNum(row.pages ? formatNumber(row.pages) : ''));

  const hasExtra = columns.hasParagraphs || columns.hasSheets || columns.hasSlides ||
                   columns.hasRows || columns.hasCells;
  if (hasExtra) {
    const parts = [];
    if (row.paragraphs) parts.push(`${formatNumber(row.paragraphs)} paras`);
    if (row.sheets) parts.push(`${formatNumber(row.sheets)} sheets`);
    if (row.rows) parts.push(`${formatNumber(row.rows)} rows`);
    if (row.cells) parts.push(`${formatNumber(row.cells)} cells`);
    if (row.slides) parts.push(`${formatNumber(row.slides)} slides`);
    cells.push(fmt(parts.join(', ')));
  }

  cells.push(fmt(formatBytes(row.size)));
  return cells;
}

function unicodeChars() {
  return {
    top: '─', 'top-mid': '─', 'top-left': '─', 'top-right': '─',
    bottom: '─', 'bottom-mid': '─', 'bottom-left': '─', 'bottom-right': '─',
    left: ' ', 'left-mid': '─', mid: '─', 'mid-mid': '─',
    right: ' ', 'right-mid': '─', middle: '  ',
  };
}

function asciiChars() {
  return {
    top: '-', 'top-mid': '-', 'top-left': '-', 'top-right': '-',
    bottom: '-', 'bottom-mid': '-', 'bottom-left': '-', 'bottom-right': '-',
    left: ' ', 'left-mid': '-', mid: '-', 'mid-mid': '-',
    right: ' ', 'right-mid': '-', middle: '  ',
  };
}

const colorize = {
  header: (s) => chalk.bold(s),
  headerCell: (s) => chalk.bold(s),
  type: (s) => chalk.cyan(s),
  number: (s) => chalk.yellow(s),
  total: (s) => chalk.bold.green(s),
  error: (s) => chalk.red(s),
  dim: (s) => chalk.dim(s),
};

const noColor = {
  header: (s) => s,
  headerCell: (s) => s,
  type: (s) => s,
  number: (s) => s,
  total: (s) => s,
  error: (s) => s,
  dim: (s) => s,
};
