import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import officeparser from 'officeparser';
import { countWords, getExtension } from '../utils.js';

export async function parseOdf(filePath) {
  const ext = getExtension(filePath);
  const buffer = await readFile(filePath);

  if (ext === 'odt') return parseOdt(filePath);
  if (ext === 'ods') return parseOds(filePath, buffer);
  if (ext === 'odp') return parseOdp(filePath, buffer);

  throw new Error(`Unsupported ODF format: ${ext}`);
}

async function parseOdt(filePath) {
  const text = await officeparser.parseOffice(filePath);
  const words = countWords(text);
  const paragraphs = text.split(/\n+/).filter(s => s.trim().length > 0).length;
  const pages = Math.max(1, Math.ceil(words / 250));

  return {
    fileType: 'ODT',
    metrics: {
      words,
      pages,
      paragraphs,
      sheets: null,
      rows: null,
      cells: null,
      slides: null,
    },
  };
}

async function parseOds(filePath, buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file('content.xml')?.async('text');
  if (!contentXml) throw new Error('No content.xml found in ODS');

  const sheets = (contentXml.match(/<table:table /g) || []).length;
  const rows = (contentXml.match(/<table:table-row/g) || []).length;

  // Use officeparser for cell text count
  const text = await officeparser.parseOffice(filePath);
  const cells = text.split(/\n/).filter(s => s.trim().length > 0).length;

  return {
    fileType: 'ODS',
    metrics: {
      words: null,
      pages: null,
      paragraphs: null,
      sheets,
      rows,
      cells,
      slides: null,
    },
  };
}

async function parseOdp(filePath, buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file('content.xml')?.async('text');
  if (!contentXml) throw new Error('No content.xml found in ODP');

  const slides = (contentXml.match(/<draw:page /g) || []).length;

  const text = await officeparser.parseOffice(filePath);
  const words = countWords(text);

  return {
    fileType: 'ODP',
    metrics: {
      words,
      pages: null,
      paragraphs: null,
      sheets: null,
      rows: null,
      cells: null,
      slides,
    },
  };
}
