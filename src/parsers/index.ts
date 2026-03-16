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

export function suggestFromError(error: Error, ext: string): string | undefined {
  const msg = error.message.toLowerCase();

  if (msg.includes('invalid zip') || msg.includes('not a valid zip') || msg.includes('end of central directory')) {
    return `File may be corrupted or not a valid .${ext} file.`;
  }
  if (msg.includes('password') || msg.includes('encrypted')) {
    return 'Document is password-protected. Remove the password and retry.';
  }
  if (msg.includes('enoent') || msg.includes('no such file')) {
    return 'File not found. Check the file path.';
  }
  if (msg.includes('eacces') || msg.includes('permission denied')) {
    return 'Permission denied. Check file permissions.';
  }
  if (msg.includes('out of memory') || msg.includes('allocation failed')) {
    return 'File is too large to parse. Try increasing the memory limit or use --large-file-limit.';
  }
  if (msg.includes('content.xml')) {
    return `File may be corrupted or not a valid .${ext} document (missing content.xml).`;
  }
  return undefined;
}

function failureResult(filePath: string, size: number, ext: string, suggestion?: string): ParseResult {
  return {
    filePath,
    size,
    success: false,
    fileType: EXTENSION_TO_TYPE[ext] || ext.toUpperCase(),
    metrics: null,
    suggestion,
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
      confidence: result.confidence,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failureResult(filePath, size, ext, suggestFromError(error, ext));
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
