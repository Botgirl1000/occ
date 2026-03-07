import { readFile } from 'node:fs/promises';
import pdf from 'pdf-parse';
import { countWords } from '../utils.js';

export async function parsePdf(filePath) {
  const buffer = await readFile(filePath);
  const data = await pdf(buffer);
  const words = countWords(data.text);

  return {
    fileType: 'PDF',
    metrics: {
      words,
      pages: data.numpages,
      paragraphs: null,
      sheets: null,
      rows: null,
      cells: null,
      slides: null,
    },
  };
}
