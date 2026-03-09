import mammoth from 'mammoth';
import { countWords } from '../utils.js';
import type { ParserOutput } from '../types.js';

export async function parseDocx(filePath: string): Promise<ParserOutput> {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value || '';
  const words = countWords(text);
  const paragraphs = text.split(/\n\n+/).filter(s => s.trim().length > 0).length;
  const pages = Math.max(1, Math.ceil(words / 250));

  return {
    fileType: 'Word',
    metrics: { words, pages, paragraphs },
  };
}
