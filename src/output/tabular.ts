import Table from 'cli-table3';
import chalk from 'chalk';
import { formatBytes, formatNumber } from '../utils.js';
import type { AggregateResult, StatsRow, ColumnVisibility } from '../stats.js';
import type { SccLanguage } from '../scc.js';

type ColorFn = (s: string) => string;

interface ColorScheme {
  header: ColorFn;
  headerCell: ColorFn;
  type: ColorFn;
  number: ColorFn;
  total: ColorFn;
  error: ColorFn;
  dim: ColorFn;
}

export interface TableOptions {
  ci?: boolean;
  byFile?: boolean;
}

export function formatDocumentTable(stats: AggregateResult, options: TableOptions = {}): string {
  const { ci = false } = options;
  const c: ColorScheme = ci ? noColor : colorize;

  const isByFile = stats.mode === 'by-file';
  const headers = buildHeaders(stats.columns, isByFile, c);
  const colAligns = buildColAligns(stats.columns, isByFile) as Table.HorizontalAlignment[];
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

  const lines: string[] = [];
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

export function formatSccTable(sccData: SccLanguage[], options: TableOptions = {}): string {
  const { ci = false, byFile = false } = options;
  const c: ColorScheme = ci ? noColor : colorize;

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

  const lines: string[] = [];
  lines.push('');
  lines.push(c.header(sectionHeader('Code (via scc)', tableWidth, ci)));
  lines.push(tableStr);

  return lines.join('\n');
}

export function formatSummaryLine(stats: AggregateResult, sccData: SccLanguage[] | null, elapsed: number, options: TableOptions = {}): string {
  const { ci = false } = options;
  const c: ColorScheme = ci ? noColor : colorize;

  const parts: string[] = [];
  if (stats && stats.totals.files > 0) {
    let docPart = `${stats.totals.files} document${stats.totals.files !== 1 ? 's' : ''}`;
    const details: string[] = [];
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

function addSeparators(tableStr: string, char: string): string {
  const lines = tableStr.split('\n');
  if (lines.length < 4) return tableStr;

  const width = stripAnsi(lines[1]).length;
  const sep = char.repeat(width);

  const result: string[] = [];
  result.push(lines[1]);
  result.push(sep);

  for (let i = 2; i < lines.length - 2; i++) {
    result.push(lines[i]);
  }

  result.push(sep);
  result.push(lines[lines.length - 2]);

  return result.join('\n');
}

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function sectionHeader(title: string, width: number, ci = false): string {
  const dash = ci ? '-' : '─';
  const prefix = `${dash}${dash} ${title} `;
  const padLen = Math.max(0, width - prefix.length);
  return prefix + dash.repeat(padLen);
}

function hasExtraColumns(columns: ColumnVisibility): boolean {
  return !!(columns.hasParagraphs || columns.hasSheets || columns.hasSlides ||
         columns.hasRows || columns.hasCells);
}

function buildHeaders(columns: ColumnVisibility, byFile: boolean, c: ColorScheme): { key: string; label: string }[] {
  const headers: { key: string; label: string }[] = [];
  headers.push({ key: 'format', label: c.headerCell(byFile ? 'File' : 'Format') });
  if (!byFile) headers.push({ key: 'files', label: c.headerCell('Files') });
  if (columns.hasWords) headers.push({ key: 'words', label: c.headerCell('Words') });
  if (columns.hasPages) headers.push({ key: 'pages', label: c.headerCell('Pages') });
  if (hasExtraColumns(columns)) headers.push({ key: 'extra', label: c.headerCell('Details') });
  headers.push({ key: 'size', label: c.headerCell('Size') });
  return headers;
}

function buildColAligns(columns: ColumnVisibility, byFile: boolean): string[] {
  const aligns = ['left'];
  if (!byFile) aligns.push('right');
  if (columns.hasWords) aligns.push('right');
  if (columns.hasPages) aligns.push('right');
  if (hasExtraColumns(columns)) aligns.push('right');
  aligns.push('right');
  return aligns;
}

function buildRow(row: StatsRow, columns: ColumnVisibility, byFile: boolean, c: ColorScheme, isTotal = false): string[] {
  const fmt = isTotal ? c.total : (v: string) => v;
  const fmtType = isTotal ? c.total : c.type;
  const fmtNum = isTotal ? c.total : c.number;

  const cells: string[] = [];
  let label: string;
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
    const parts: string[] = [];
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

export function tableChars(ci: boolean): Record<string, string> {
  const ch = ci ? '-' : '─';
  return {
    top: ch, 'top-mid': ch, 'top-left': ch, 'top-right': ch,
    bottom: ch, 'bottom-mid': ch, 'bottom-left': ch, 'bottom-right': ch,
    left: ' ', 'left-mid': '', mid: '', 'mid-mid': '',
    right: ' ', 'right-mid': '', middle: '  ',
  };
}

const colorize: ColorScheme = {
  header: (s) => chalk.bold(s),
  headerCell: (s) => chalk.bold(s),
  type: (s) => chalk.cyan(s),
  number: (s) => chalk.yellow(s),
  total: (s) => chalk.bold.green(s),
  error: (s) => chalk.red(s),
  dim: (s) => chalk.dim(s),
};

const identity: ColorFn = (s) => s;
const noColor: ColorScheme = Object.fromEntries(Object.keys(colorize).map(k => [k, identity])) as unknown as ColorScheme;
