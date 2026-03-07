import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import officeparser from 'officeparser';
import { countWords } from '../utils.js';

export async function parsePptx(filePath) {
  const buffer = await readFile(filePath);

  // Count slides via ZIP internals
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files).filter(name =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name)
  );
  const slides = slideFiles.length;

  // Extract text via officeparser (reuse buffer to avoid re-reading)
  const text = await officeparser.parseOffice(buffer);
  const words = countWords(text);

  return {
    fileType: 'PowerPoint',
    metrics: { words, slides },
  };
}
