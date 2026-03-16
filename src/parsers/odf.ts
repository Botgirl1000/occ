import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import officeparser from 'officeparser';
import { z } from 'zod';
import { countWords, getExtension } from '../utils.js';
import type { ParserOutput } from '../types.js';

export async function parseOdf(filePath: string): Promise<ParserOutput> {
  const ext = getExtension(filePath);

  if (ext === 'odt') return parseOdt(filePath);

  const buffer = await readFile(filePath);
  if (ext === 'ods') return parseOds(buffer);
  if (ext === 'odp') return parseOdp(buffer);

  throw new Error(`Unsupported ODF format: ${ext}`);
}

async function parseOdt(filePath: string): Promise<ParserOutput> {
  const text = z.string().parse(await officeparser.parseOffice(filePath));
  const words = countWords(text);
  const paragraphs = text.split(/\n\n+/).filter((s: string) => s.trim().length > 0).length;
  const pages = Math.max(1, Math.ceil(words / 250));

  return {
    fileType: 'ODT',
    metrics: { words, pages, paragraphs },
    confidence: {
      words: 'exact',
      pages: 'estimated',
      paragraphs: 'exact',
    },
  };
}

async function parseOds(buffer: Buffer): Promise<ParserOutput> {
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file('content.xml')?.async('text');
  if (!contentXml) throw new Error('No content.xml found in ODS');

  const sheets = (contentXml.match(/<table:table /g) || []).length;
  const rows = (contentXml.match(/<table:table-row/g) || []).length;

  // Use officeparser with buffer to avoid re-reading from disk
  const text = z.string().parse(await officeparser.parseOffice(buffer));
  const cells = text.split(/\n/).filter((s: string) => s.trim().length > 0).length;

  return {
    fileType: 'ODS',
    metrics: { sheets, rows, cells },
    confidence: {
      sheets: 'exact',
      rows: 'exact',
      cells: 'estimated',
    },
  };
}

async function parseOdp(buffer: Buffer): Promise<ParserOutput> {
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file('content.xml')?.async('text');
  if (!contentXml) throw new Error('No content.xml found in ODP');

  const slides = (contentXml.match(/<draw:page /g) || []).length;

  const text = z.string().parse(await officeparser.parseOffice(buffer));
  const words = countWords(text);

  return {
    fileType: 'ODP',
    metrics: { words, slides },
    confidence: {
      words: 'estimated',
      slides: 'exact',
    },
  };
}
