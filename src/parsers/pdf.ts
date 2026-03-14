import { readFile } from 'node:fs/promises';
import pdf from 'pdf-parse';
import { z } from 'zod';
import { countWords } from '../utils.js';
import type { ParserOutput } from '../types.js';

const PdfParseResultSchema = z.object({
  text: z.string(),
  numpages: z.number(),
});

// Suppress noisy pdf.js warnings (font parsing, deprecated API, etc.)
// Reference-counted to handle concurrent PDFs in the same batch safely.
const originalLog = console.log;
let suppressionDepth = 0;
const capturedWarnings: string[] = [];

const SUPPRESSED_PREFIXES = ['Warning: ', 'Info: ', 'Deprecated API usage: '];

function beginSuppression() {
  if (suppressionDepth++ === 0) {
    console.log = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && SUPPRESSED_PREFIXES.some(p => (args[0] as string).startsWith(p))) {
        capturedWarnings.push(args[0] as string);
        return;
      }
      originalLog.apply(console, args);
    };
  }
}

function endSuppression() {
  if (--suppressionDepth === 0) {
    console.log = originalLog;
    capturedWarnings.length = 0;
  }
}

export async function parsePdf(filePath: string): Promise<ParserOutput> {
  const buffer = await readFile(filePath);

  beginSuppression();
  let data: z.infer<typeof PdfParseResultSchema>;
  try {
    data = PdfParseResultSchema.parse(await pdf(buffer));
  } finally {
    endSuppression();
  }

  const words = countWords(data.text);

  return {
    fileType: 'PDF',
    metrics: { words, pages: data.numpages },
  };
}
