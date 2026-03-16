import { documentToMarkdown } from '../markdown/convert.js';
import { estimateTokens } from '../inspect/shared.js';
import { extractFromMarkdown } from '../structure/index.js';
import { discoverDocuments } from './discover.js';
import { inspectDocument } from './inspect.js';
import { countWords } from '../utils.js';

export interface DocumentSummary {
  filePath: string;
  relativePath: string;
  format: string;
  title?: string;
  words: number;
  pages: number;
  tokenEstimate: number;
  headingCount: number;
  topLevelSections: string[];
  markdownContent?: string;
}

export async function inspectWorkspaceDocuments(rootDir: string, options?: {
  excludeDir?: string[];
  includeMarkdown?: boolean;
  maxFiles?: number;
}): Promise<DocumentSummary[]> {
  const maxFiles = options?.maxFiles ?? 50;
  const includeMarkdown = options?.includeMarkdown ?? false;

  const discovered = await discoverDocuments(rootDir, {
    excludeDir: options?.excludeDir,
  });

  const results: DocumentSummary[] = [];

  for (const doc of discovered.slice(0, maxFiles)) {
    try {
      const summary = await inspectSingleDocument(doc.filePath, doc.relativePath, doc.format, includeMarkdown);
      if (summary) results.push(summary);
    } catch {
      // Best-effort: skip documents that fail to inspect
      results.push({
        filePath: doc.filePath,
        relativePath: doc.relativePath,
        format: doc.format,
        words: 0,
        pages: 0,
        tokenEstimate: 0,
        headingCount: 0,
        topLevelSections: [],
      });
    }
  }

  return results;
}

async function inspectSingleDocument(
  filePath: string,
  relativePath: string,
  format: string,
  includeMarkdown: boolean,
): Promise<DocumentSummary> {
  // Try markdown conversion first (works for all formats)
  let markdownContent: string | null = null;
  try {
    markdownContent = await documentToMarkdown(filePath);
  } catch {
    // Fall through to format-specific inspection
  }

  // For formats supported by inspectDocument, get rich metadata
  if (format === 'docx' || format === 'pdf' || format === 'odt') {
    try {
      const inspection = await inspectDocument(filePath, {
        sampleParagraphs: 5,
        includeStructure: true,
      });

      return {
        filePath,
        relativePath,
        format,
        title: inspection.properties.title,
        words: inspection.contentStats.words,
        pages: inspection.contentStats.pages,
        tokenEstimate: inspection.fullTokenEstimate,
        headingCount: inspection.structure?.headingCount ?? 0,
        topLevelSections: inspection.structure?.topLevelSections ?? [],
        markdownContent: includeMarkdown ? (markdownContent ?? undefined) : undefined,
      };
    } catch {
      // Fall through to markdown-based inspection
    }
  }

  // For other formats (pptx, xlsx, ods, odp), derive from markdown
  if (markdownContent) {
    const structure = extractFromMarkdown(markdownContent);
    const words = countWords(markdownContent);
    return {
      filePath,
      relativePath,
      format,
      words,
      pages: 0,
      tokenEstimate: estimateTokens(markdownContent),
      headingCount: structure.totalNodes,
      topLevelSections: structure.rootNodes.map(n => n.title),
      markdownContent: includeMarkdown ? markdownContent : undefined,
    };
  }

  // Minimal fallback
  return {
    filePath,
    relativePath,
    format,
    words: 0,
    pages: 0,
    tokenEstimate: 0,
    headingCount: 0,
    topLevelSections: [],
  };
}
