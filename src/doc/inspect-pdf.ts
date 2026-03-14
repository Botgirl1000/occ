import { readFile } from 'node:fs/promises';
import pdf from 'pdf-parse';
import { z } from 'zod';
import { countWords } from '../utils.js';
import { asOptionalString, formatDateLike } from '../inspect/shared.js';
import type { DocumentProperties } from '../inspect/shared.js';
import type { DocRiskFlags, DocContentStats, ContentPreview } from './types.js';

const PdfParseResultSchema = z.object({
  text: z.string(),
  numpages: z.number(),
  info: z.record(z.string(), z.unknown()).default({}),
});

function parsePdfDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const str = String(value);
  // PDF dates: D:YYYYMMDDHHmmSS or plain ISO strings
  const match = str.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
  }
  return formatDateLike(str);
}

export async function inspectPdf(
  filePath: string,
  buffer: Buffer,
  sampleParagraphs: number,
): Promise<{
  properties: DocumentProperties;
  riskFlags: DocRiskFlags;
  contentStats: DocContentStats;
  preview: ContentPreview;
}> {
  // Suppress pdf.js warnings
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && (args[0].startsWith('Warning: ') || args[0].startsWith('Info: ') || args[0].startsWith('Deprecated API usage: '))) {
      return;
    }
    originalLog.apply(console, args);
  };

  let data: z.infer<typeof PdfParseResultSchema>;
  try {
    data = PdfParseResultSchema.parse(await pdf(buffer));
  } finally {
    console.log = originalLog;
  }

  const info = data.info;

  const properties: DocumentProperties = {
    title: asOptionalString(info.Title),
    subject: asOptionalString(info.Subject),
    author: asOptionalString(info.Author),
    keywords: asOptionalString(info.Keywords),
    createdDate: parsePdfDate(info.CreationDate),
    modifiedDate: parsePdfDate(info.ModDate),
  };

  // PDFs have limited risk flag detection
  const riskFlags: DocRiskFlags = {
    comments: false,
    trackedChanges: false,
    hyperlinks: false,
    embeddedObjects: false,
    footnotes: false,
    endnotes: false,
    macros: false,
    headerFooter: false,
    tables: false,
    encrypted: !!info.IsAcroFormPresent || (info as Record<string, unknown>).Encrypted === true,
  };

  const text = data.text || '';
  const words = countWords(text);
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0).length;

  const contentStats: DocContentStats = {
    words,
    pages: data.numpages,
    pagesEstimated: false,
    paragraphs,
    characters: text.length,
    tables: 0,
    images: 0,
  };

  // Build preview from text
  const textParagraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const previewParagraphs: ContentPreview['paragraphs'] = [];
  const limit = Math.min(sampleParagraphs, textParagraphs.length);
  for (let i = 0; i < limit; i++) {
    previewParagraphs.push({
      index: i,
      text: textParagraphs[i].trim().replace(/\s+/g, ' '),
      isHeading: false,
    });
  }

  const preview: ContentPreview = {
    truncated: textParagraphs.length > sampleParagraphs,
    paragraphs: previewParagraphs,
  };

  return { properties, riskFlags, contentStats, preview };
}
