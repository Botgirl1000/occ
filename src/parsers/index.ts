import { getExtension, EXTENSION_TO_TYPE } from '../utils.js';
import { parseDocx } from './docx.js';
import { parsePdf } from './pdf.js';
import { parseXlsx } from './xlsx.js';
import { parsePptx } from './pptx.js';
import { parseOdf } from './odf.js';
import type { FileEntry, ParseResult, ParserOutput } from '../types.js';

type ParserFn = (filePath: string) => Promise<ParserOutput>;

const PARSER_MAP: Record<string, ParserFn> = {
  docx: parseDocx,
  pdf: parsePdf,
  xlsx: parseXlsx,
  pptx: parsePptx,
  odt: parseOdf,
  ods: parseOdf,
  odp: parseOdf,
};

function failureResult(filePath: string, size: number, ext: string): ParseResult {
  return {
    filePath,
    size,
    success: false,
    fileType: EXTENSION_TO_TYPE[ext] || ext.toUpperCase(),
    metrics: null,
  };
}

export async function parseFile(filePath: string, size: number): Promise<ParseResult> {
  const ext = getExtension(filePath);
  const parser = PARSER_MAP[ext];

  if (!parser) {
    return failureResult(filePath, size, ext);
  }

  try {
    const result = await parser(filePath);
    return {
      filePath,
      size,
      success: true,
      fileType: result.fileType,
      metrics: result.metrics,
    };
  } catch {
    return failureResult(filePath, size, ext);
  }
}

export type ProgressCallback = (increment: number, detail?: string) => void;

export async function parseFiles(files: FileEntry[], concurrency = 10, onProgress?: ProgressCallback): Promise<ParseResult[]> {
  const results: ParseResult[] = [];
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(f => parseFile(f.path, f.size))
    );
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      results.push(r.status === 'fulfilled' ? r.value : {
        filePath: batch[j]?.path ?? '',
        size: 0,
        success: false,
        fileType: 'Unreadable',
        metrics: null,
      });
      if (onProgress) onProgress(1, batch[j]?.path);
    }
  }
  return results;
}
