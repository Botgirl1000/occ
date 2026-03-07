import Table from 'cli-table3';
import chalk from 'chalk';
import { formatBytes, formatNumber } from '../utils.js';

export function formatDocumentTable(stats, options = {}) {
  const { ci = false } = options;
  const c = ci ? noColor : colorize;

  const isByFile = stats.mode === 'by-file';
  const headers = buildHeaders(stats.columns, isByFile, c);
  const colAligns = buildColAligns(stats.columns, isByFile);
  const table = new Table({
    head: headers.map(h => h.label),
    chars: tableChars(ci),
    style: { head: [], border: [] },
    colAligns,
  });

  for (const row of stats.rows) {
    table.push(buildRow(row, stats.columns, isByFile, c));
  }

  table.push(buildRow(stats.totals, stats.columns, isByFile, c, true));

  const tableStr = addSeparators(table.toString(), ci ? '-' : '─');

  const tableWidth = stripAnsi(tableStr.split('\n')[0]).length;

  const lines = [];
  lines.push('');
  lines.push(c.header(sectionHeader('Documents', tableWidth, ci)));
  lines.push(tableStr);

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
    chars: tableChars(ci),
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
          c.number(formatNumber(file.Blank)),
          c.number(formatNumber(file.Comment)),
          c.number(formatNumber(file.Code)),
        ]);
      }
    } else {
      table.push([
        c.type(lang.Name),
        formatNumber(lang.Count),
        c.number(formatNumber(lang.Lines)),
        c.number(formatNumber(lang.Blank)),
        c.number(formatNumber(lang.Comment)),
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

  const tableStr = addSeparators(table.toString(), ci ? '-' : '─');
  const tableWidth = stripAnsi(tableStr.split('\n')[0]).length;

  const lines = [];
  lines.push('');
  lines.push(c.header(sectionHeader('Code (via scc)', tableWidth, ci)));
  lines.push(tableStr);

  return lines.join('\n');
}

export function formatSummaryLine(stats, sccData, elapsed, options = {}) {
  const { ci = false } = options;
  const c = ci ? noColor : colorize;

  const parts = [];
  if (stats && stats.totals.files > 0) {
    let docPart = `${stats.totals.files} document${stats.totals.files !== 1 ? 's' : ''}`;
    const details = [];
    if (stats.totals.words > 0) details.push(`${formatNumber(stats.totals.words)} word${stats.totals.words !== 1 ? 's' : ''}`);
    if (stats.totals.pages > 0) details.push(`${formatNumber(stats.totals.pages)} page${stats.totals.pages !== 1 ? 's' : ''}`);
    if (details.length > 0) docPart += ` (${details.join(', ')})`;
    parts.push(docPart);
  }
  if (sccData && sccData.length > 0) {
    const totalCode = sccData.reduce((sum, l) => sum + (l.Code || 0), 0);
    parts.push(`${formatNumber(totalCode)} lines of code`);
  }

  if (parts.length === 0) return '';

  const time = elapsed >= 1000
    ? `${(elapsed / 1000).toFixed(1)}s`
    : `${elapsed}ms`;

  return '\n' + c.dim(`Scanned ${parts.join(', ')} in ${time}`) + '\n';
}

/**
 * Post-process table string to insert separator lines after the header row
 * and before the totals row (last data row).
 *
 * Table layout from cli-table3 (with empty mid chars):
 *   line 0: top border
 *   line 1: header row
 *   lines 2..N-2: data rows
 *   line N-1: totals row
 *   line N: bottom border
 */
function addSeparators(tableStr, char) {
  const lines = tableStr.split('\n');
  if (lines.length < 4) return tableStr;

  // Use header row width — top border is narrower due to single-char top-mid vs 2-char middle
  const width = stripAnsi(lines[1]).length;
  const sep = char.repeat(width);

  const result = [];
  // Skip lines[0] (top border) — section header already serves as delimiter
  result.push(lines[1]); // header row
  result.push(sep);      // header separator

  // Data rows (everything except first 2 and last 2)
  for (let i = 2; i < lines.length - 2; i++) {
    result.push(lines[i]);
  }

  result.push(sep);                    // totals separator
  result.push(lines[lines.length - 2]); // totals row
  // Skip bottom border — totals row is the natural end

  return result.join('\n');
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function sectionHeader(title, width, ci = false) {
  const dash = ci ? '-' : '─';
  const prefix = `${dash}${dash} ${title} `;
  const padLen = Math.max(0, width - prefix.length);
  return prefix + dash.repeat(padLen);
}

function hasExtraColumns(columns) {
  return columns.hasParagraphs || columns.hasSheets || columns.hasSlides ||
         columns.hasRows || columns.hasCells;
}

function buildHeaders(columns, byFile, c) {
  const headers = [];
  headers.push({ key: 'format', label: c.headerCell(byFile ? 'File' : 'Format') });
  if (!byFile) headers.push({ key: 'files', label: c.headerCell('Files') });
  if (columns.hasWords) headers.push({ key: 'words', label: c.headerCell('Words') });
  if (columns.hasPages) headers.push({ key: 'pages', label: c.headerCell('Pages') });
  if (hasExtraColumns(columns)) headers.push({ key: 'extra', label: c.headerCell('Details') });
  headers.push({ key: 'size', label: c.headerCell('Size') });
  return headers;
}

function buildColAligns(columns, byFile) {
  const aligns = ['left']; // Format/File
  if (!byFile) aligns.push('right'); // Files
  if (columns.hasWords) aligns.push('right');
  if (columns.hasPages) aligns.push('right');
  if (hasExtraColumns(columns)) aligns.push('right');
  aligns.push('right'); // Size
  return aligns;
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

  if (hasExtraColumns(columns)) {
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

function tableChars(ci) {
  const ch = ci ? '-' : '─';
  return {
    top: ch, 'top-mid': ch, 'top-left': ch, 'top-right': ch,
    bottom: ch, 'bottom-mid': ch, 'bottom-left': ch, 'bottom-right': ch,
    left: ' ', 'left-mid': '', mid: '', 'mid-mid': '',
    right: ' ', 'right-mid': '', middle: '  ',
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

const identity = (s) => s;
const noColor = Object.fromEntries(Object.keys(colorize).map(k => [k, identity]));
