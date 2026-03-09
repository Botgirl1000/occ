import { readFile } from 'node:fs/promises';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import JSZip from 'jszip';
import officeparser from 'officeparser';
import TurndownService from 'turndown';
import { getExtension } from '../utils.js';

const turndown = new TurndownService({ headingStyle: 'atx' });

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
        const textContent = await pageData.getTextContent() as { items: Array<{ str: string }> };
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
  const fullText = await officeparser.parseOffice(buffer) as unknown as string;
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
  const text = await officeparser.parseOffice(filePath) as unknown as string;
  return text;
}

/** Convert an ODP file to markdown with slide headers */
async function odpToMarkdown(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file('content.xml')?.async('text');
  if (!contentXml) return '';

  const slides = (contentXml.match(/<draw:page /g) || []).length;
  const text = await officeparser.parseOffice(buffer) as unknown as string;

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

/** Convert a document to markdown. Returns null for unsupported formats (xlsx, ods). */
export async function documentToMarkdown(filePath: string): Promise<string | null> {
  const ext = getExtension(filePath);

  switch (ext) {
    case 'docx': return docxToMarkdown(filePath);
    case 'pdf': return pdfToMarkdown(filePath);
    case 'pptx': return pptxToMarkdown(filePath);
    case 'odt': return odtToMarkdown(filePath);
    case 'odp': return odpToMarkdown(filePath);
    case 'xlsx':
    case 'ods':
      return null;
    default:
      return null;
  }
}
