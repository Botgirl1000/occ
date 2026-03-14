import JSZip from 'jszip';
import officeparser from 'officeparser';
import { z } from 'zod';
import { countWords } from '../utils.js';
import { asOptionalString, formatDateLike } from '../inspect/shared.js';
import type { DocumentProperties } from '../inspect/shared.js';
import type { DocRiskFlags, DocContentStats, ContentPreview } from './types.js';

function parseXmlText(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match?.[1]?.trim() || undefined;
}

export async function inspectOdt(
  filePath: string,
  buffer: Buffer,
  sampleParagraphs: number,
): Promise<{
  properties: DocumentProperties;
  riskFlags: DocRiskFlags;
  contentStats: DocContentStats;
  preview: ContentPreview;
}> {
  const zip = await JSZip.loadAsync(buffer);

  // Parse metadata from meta.xml
  const properties: DocumentProperties = {};
  const metaXml = await zip.file('meta.xml')?.async('text');
  if (metaXml) {
    properties.title = asOptionalString(parseXmlText(metaXml, 'dc:title'));
    properties.subject = asOptionalString(parseXmlText(metaXml, 'dc:subject'));
    properties.author = asOptionalString(parseXmlText(metaXml, 'dc:creator') ?? parseXmlText(metaXml, 'meta:initial-creator'));
    properties.keywords = asOptionalString(parseXmlText(metaXml, 'meta:keyword'));
    properties.createdDate = formatDateLike(parseXmlText(metaXml, 'meta:creation-date'));
    properties.modifiedDate = formatDateLike(parseXmlText(metaXml, 'dc:date'));
  }

  // Parse risk flags from content.xml
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
    encrypted: false,
  };

  const contentXml = await zip.file('content.xml')?.async('text');
  if (contentXml) {
    if (/<office:annotation\b/.test(contentXml)) riskFlags.comments = true;
    if (/<text:tracked-changes\b/.test(contentXml)) riskFlags.trackedChanges = true;
    if (/<text:a\b[^>]*xlink:href=/.test(contentXml)) riskFlags.hyperlinks = true;
    if (/<draw:frame\b/.test(contentXml)) riskFlags.embeddedObjects = true;
    if (/<text:note\b/.test(contentXml)) riskFlags.footnotes = true;
    if (/<table:table\b/.test(contentXml)) riskFlags.tables = true;
  }

  // Check for macros
  if (zip.file('Basic/') || zip.file('Scripts/')) riskFlags.macros = true;

  // Extract text via officeparser
  const text = z.string().parse(await officeparser.parseOffice(buffer));
  const words = countWords(text);
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0).length;

  // Count images and tables from content.xml
  let images = 0;
  let tables = 0;
  if (contentXml) {
    images = (contentXml.match(/<draw:image\b/g) || []).length;
    tables = (contentXml.match(/<table:table\b/g) || []).length;
  }

  const contentStats: DocContentStats = {
    words,
    pages: Math.max(1, Math.ceil(words / 250)),
    pagesEstimated: true,
    paragraphs,
    characters: text.length,
    tables,
    images,
  };

  // Build preview
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
