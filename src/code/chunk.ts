import type { CodebaseIndex, ParsedFile } from './types.js';
import { buildCodebaseIndex, type BuildCodebaseOptions } from './build.js';
import { countWords } from '../utils.js';
import type { OnProgress } from '../progress-event.js';

export interface CodeChunk {
  filePath: string;
  relativePath: string;
  language: string;
  chunkIndex: number;
  title: string;
  content: string;
  symbolNames: string[];
  symbolTypes: string[];
  startLine: number;
  endLine: number;
  hasExports: boolean;
}

interface ChunkOptions {
  maxChunkWords?: number;
  overlapWords?: number;
}

const DEFAULT_MAX_CHUNK_WORDS = 500;
const DEFAULT_OVERLAP_WORDS = 50;

function chunkFile(file: ParsedFile, maxChunkWords: number, overlapWords: number): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = file.lines;
  const sortedSymbols = [...file.symbols].sort((a, b) => a.line - b.line);

  if (sortedSymbols.length === 0) {
    // No symbols — chunk by word count
    return chunkByWords(file, lines, maxChunkWords, overlapWords);
  }

  // Build symbol boundaries: each symbol starts a new potential chunk
  const boundaries: Array<{ startLine: number; endLine: number; symbols: typeof sortedSymbols }> = [];
  for (let i = 0; i < sortedSymbols.length; i++) {
    const sym = sortedSymbols[i];
    const startLine = sym.line - 1; // 0-indexed
    const endLine = i + 1 < sortedSymbols.length
      ? sortedSymbols[i + 1].line - 2 // up to line before next symbol
      : lines.length - 1;
    boundaries.push({ startLine, endLine, symbols: [sym] });
  }

  // Add file header (before first symbol) if present
  if (boundaries.length > 0 && boundaries[0].startLine > 0) {
    boundaries.unshift({ startLine: 0, endLine: boundaries[0].startLine - 1, symbols: [] });
  }

  // Merge small adjacent sections into chunks that respect maxChunkWords
  let currentStart = boundaries[0]?.startLine ?? 0;
  let currentEnd = boundaries[0]?.endLine ?? 0;
  let currentSymbols = [...(boundaries[0]?.symbols ?? [])];
  let currentWords = countWords(lines.slice(currentStart, currentEnd + 1).join('\n'));

  for (let i = 1; i < boundaries.length; i++) {
    const section = boundaries[i];
    const sectionText = lines.slice(section.startLine, section.endLine + 1).join('\n');
    const sectionWords = countWords(sectionText);

    if (currentWords + sectionWords <= maxChunkWords) {
      currentEnd = section.endLine;
      currentSymbols.push(...section.symbols);
      currentWords += sectionWords;
    } else {
      // Emit current chunk
      emitChunk(chunks, file, lines, currentStart, currentEnd, currentSymbols);
      // Start new chunk (with overlap)
      const overlapStart = findOverlapStart(lines, currentEnd, overlapWords);
      currentStart = Math.min(overlapStart, section.startLine);
      currentEnd = section.endLine;
      currentSymbols = [...section.symbols];
      currentWords = countWords(lines.slice(currentStart, currentEnd + 1).join('\n'));
    }
  }

  // Emit final chunk
  emitChunk(chunks, file, lines, currentStart, currentEnd, currentSymbols);

  return chunks;
}

function chunkByWords(file: ParsedFile, lines: string[], maxChunkWords: number, overlapWords: number): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let currentStart = 0;
  let currentWords = 0;

  for (let i = 0; i < lines.length; i++) {
    currentWords += countWords(lines[i]);
    if (currentWords >= maxChunkWords || i === lines.length - 1) {
      emitChunk(chunks, file, lines, currentStart, i, []);
      const overlapStart = findOverlapStart(lines, i, overlapWords);
      currentStart = overlapStart;
      currentWords = countWords(lines.slice(currentStart, i + 1).join('\n'));
    }
  }

  return chunks;
}

function findOverlapStart(lines: string[], endLine: number, overlapWords: number): number {
  if (overlapWords <= 0) return endLine + 1;
  let words = 0;
  for (let i = endLine; i >= 0; i--) {
    words += countWords(lines[i]);
    if (words >= overlapWords) return i;
  }
  return 0;
}

function emitChunk(
  chunks: CodeChunk[],
  file: ParsedFile,
  lines: string[],
  startLine: number,
  endLine: number,
  symbols: Array<{ name: string; type: string; exported?: boolean; containerName?: string }>,
): void {
  const content = lines.slice(startLine, endLine + 1).join('\n');
  if (!content.trim()) return;

  const primarySymbol = symbols.find(s => s.exported) ?? symbols[0];
  const title = primarySymbol
    ? (primarySymbol.containerName
      ? `${file.relativePath}:${primarySymbol.containerName}.${primarySymbol.name}`
      : `${file.relativePath}:${primarySymbol.name}`)
    : `${file.relativePath}:${startLine + 1}-${endLine + 1}`;

  chunks.push({
    filePath: file.path,
    relativePath: file.relativePath,
    language: file.language,
    chunkIndex: chunks.length,
    title,
    content,
    symbolNames: symbols.map(s => s.name),
    symbolTypes: symbols.map(s => s.type),
    startLine: startLine + 1,
    endLine: endLine + 1,
    hasExports: symbols.some(s => s.exported),
  });
}

/** Chunk files from an already-built CodebaseIndex (avoids double-parsing) */
export function chunkFromIndex(
  index: CodebaseIndex,
  options?: ChunkOptions,
): CodeChunk[] {
  const maxChunkWords = options?.maxChunkWords ?? DEFAULT_MAX_CHUNK_WORDS;
  const overlapWords = options?.overlapWords ?? DEFAULT_OVERLAP_WORDS;
  const chunks: CodeChunk[] = [];

  for (const file of index.files) {
    chunks.push(...chunkFile(file, maxChunkWords, overlapWords));
  }

  return chunks;
}

/** Discover, parse, and chunk an entire codebase */
export async function chunkCodebase(options: BuildCodebaseOptions & ChunkOptions, onProgress?: OnProgress): Promise<CodeChunk[]> {
  const index = await buildCodebaseIndex(options, onProgress);
  const chunks = chunkFromIndex(index, options);
  onProgress?.({ phase: 'chunk', total: chunks.length, completed: chunks.length, detail: 'Chunking complete' });
  return chunks;
}
