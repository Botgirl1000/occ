import { readFile } from 'node:fs/promises';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import JSZip from 'jszip';
import XLSX from 'xlsx';
import officeparser from 'officeparser';
import TurndownService from 'turndown';
import { z } from 'zod';
import { getExtension } from '../utils.js';

const turndown = new TurndownService({ headingStyle: 'atx' });
const PdfTextContentSchema = z.object({ items: z.array(z.object({ str: z.string() }).passthrough()) });

/** Convert a DOCX file to markdown via mammoth → HTML → turndown */
async function docxToMarkdown(filePath: string): Promise<string> {
  const result = await mammoth.convertToHtml({ path: filePath });
  const html = result.value || '';
  if (!html.trim()) return '';
  return turndown.turndown(html);
}

/** Convert a PDF to markdown with [Page N] markers */
async function pdfToMarkdown(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);

  // Suppress pdf.js warnings
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && (args[0].startsWith('Warning: ') || args[0].startsWith('Info: ') || args[0].startsWith('Deprecated API usage: '))) {
      return;
    }
    originalLog.apply(console, args);
  };

  let data: { text: string; numpages: number };
  try {
    data = await pdf(buffer, {
      pagerender: async (pageData: { pageIndex: number; getTextContent: () => Promise<unknown> }) => {
        const textContent = PdfTextContentSchema.parse(await pageData.getTextContent());
        const strings = textContent.items.map(item => item.str);
        return `[Page ${pageData.pageIndex + 1}]\n${strings.join(' ')}`;
      },
    });
  } finally {
    console.log = originalLog;
  }

  return data.text;
}

/** Convert a PPTX to markdown with slide headers */
async function pptxToMarkdown(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);

  // Get slide filenames sorted by number
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0', 10);
      return numA - numB;
    });

  // Get full text via officeparser
  const fullText = z.string().parse(await officeparser.parseOffice(buffer));
  const slideCount = slideFiles.length;

  if (slideCount <= 1) {
    return `# Slide 1\n\n${fullText}`;
  }

  // Split text roughly between slides
  const lines = fullText.split('\n');
  const linesPerSlide = Math.max(1, Math.ceil(lines.length / slideCount));
  const parts: string[] = [];

  for (let i = 0; i < slideCount; i++) {
    const start = i * linesPerSlide;
    const end = Math.min((i + 1) * linesPerSlide, lines.length);
    const slideText = lines.slice(start, end).join('\n').trim();
    parts.push(`# Slide ${i + 1}\n\n${slideText}`);
  }

  return parts.join('\n\n');
}

/** Convert an ODT file to markdown (best-effort heading detection) */
async function odtToMarkdown(filePath: string): Promise<string> {
  const text = z.string().parse(await officeparser.parseOffice(filePath));
  return text;
}

/** Convert an ODP file to markdown with slide headers */
async function odpToMarkdown(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file('content.xml')?.async('text');
  if (!contentXml) return '';

  const slides = (contentXml.match(/<draw:page /g) || []).length;
  const text = z.string().parse(await officeparser.parseOffice(buffer));

  if (slides <= 1) {
    return `# Slide 1\n\n${text}`;
  }

  const lines = text.split('\n');
  const linesPerSlide = Math.max(1, Math.ceil(lines.length / slides));
  const parts: string[] = [];

  for (let i = 0; i < slides; i++) {
    const start = i * linesPerSlide;
    const end = Math.min((i + 1) * linesPerSlide, lines.length);
    const slideText = lines.slice(start, end).join('\n').trim();
    parts.push(`# Slide ${i + 1}\n\n${slideText}`);
  }

  return parts.join('\n\n');
}

/** Convert an XLSX file to markdown with table formatting per sheet */
async function xlsxToMarkdown(filePath: string, maxRows = 20): Promise<string> {
  const buffer = await readFile(filePath);
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellText: true,
  });

  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.['!ref']) continue;

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const totalRows = range.e.r - range.s.r + 1;
    const totalCols = range.e.c - range.s.c + 1;

    parts.push(`## ${sheetName}`);
    parts.push('');

    if (totalCols === 0 || totalRows === 0) {
      parts.push('*Empty sheet*');
      parts.push('');
      continue;
    }

    // Read header row
    const headers: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
      const raw = cell?.v != null ? String(cell.w ?? cell.v) : XLSX.utils.encode_col(col);
      headers.push(raw.replace(/\|/g, '\\|').replace(/\n/g, ' '));
    }

    // Build markdown table
    parts.push(`| ${headers.join(' | ')} |`);
    parts.push(`| ${headers.map(() => '---').join(' | ')} |`);

    const dataRows = Math.min(maxRows, totalRows - 1);
    for (let row = range.s.r + 1; row <= range.s.r + dataRows; row++) {
      const values: string[] = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        const val = cell?.v != null ? String(cell.w ?? cell.v) : '';
        values.push(val.replace(/\|/g, '\\|').replace(/\n/g, ' '));
      }
      parts.push(`| ${values.join(' | ')} |`);
    }

    if (totalRows - 1 > maxRows) {
      parts.push('');
      parts.push(`*...${totalRows - 1 - maxRows} more rows*`);
    }

    parts.push('');
  }

  return parts.join('\n');
}

/** Convert a document to markdown. Returns null for unsupported formats (ods). */
export async function documentToMarkdown(filePath: string): Promise<string | null> {
  const ext = getExtension(filePath);

  switch (ext) {
    case 'docx': return docxToMarkdown(filePath);
    case 'pdf': return pdfToMarkdown(filePath);
    case 'pptx': return pptxToMarkdown(filePath);
    case 'odt': return odtToMarkdown(filePath);
    case 'odp': return odpToMarkdown(filePath);
    case 'xlsx': return xlsxToMarkdown(filePath);
    case 'ods':
      return null;
    default:
      return null;
  }
}
