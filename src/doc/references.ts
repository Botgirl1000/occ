/**
 * Cross-document reference detection.
 * Detects filename mentions, hyperlinks, and citation patterns across documents.
 */
import path from 'node:path';

export interface CrossReference {
  sourceFile: string;
  targetFile: string;
  referenceType: 'filename-mention' | 'hyperlink' | 'citation';
  context: string;
  line?: number;
}

export interface ReferenceAnalysis {
  references: CrossReference[];
  unresolvedMentions: Array<{ sourceFile: string; mention: string; context: string }>;
}

const CONTEXT_WINDOW = 60;

function getContext(text: string, position: number, length: number): string {
  const start = Math.max(0, position - CONTEXT_WINDOW);
  const end = Math.min(text.length, position + length + CONTEXT_WINDOW);
  let context = text.slice(start, end).replace(/\n/g, ' ').trim();
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';
  return context;
}

function getLineNumber(text: string, position: number): number {
  let line = 1;
  for (let i = 0; i < position && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

/** Detect cross-references between documents */
export function detectCrossReferences(
  documents: Array<{ filePath: string; content: string }>,
): ReferenceAnalysis {
  const references: CrossReference[] = [];
  const unresolvedMentions: ReferenceAnalysis['unresolvedMentions'] = [];

  // Build a set of known filenames for matching
  const fileNames = new Map<string, string>(); // basename (lower) -> full path
  const fileNamesNoExt = new Map<string, string>(); // basename without ext (lower) -> full path
  for (const doc of documents) {
    const base = path.basename(doc.filePath).toLowerCase();
    const noExt = path.basename(doc.filePath, path.extname(doc.filePath)).toLowerCase();
    fileNames.set(base, doc.filePath);
    fileNamesNoExt.set(noExt, doc.filePath);
  }

  for (const doc of documents) {
    const { filePath, content } = doc;

    // 1. Filename mentions — look for other filenames in this document's text
    for (const [name, targetPath] of fileNames) {
      if (targetPath === filePath) continue;
      const regex = new RegExp(escapeRegex(name), 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        references.push({
          sourceFile: filePath,
          targetFile: targetPath,
          referenceType: 'filename-mention',
          context: getContext(content, match.index, match[0].length),
          line: getLineNumber(content, match.index),
        });
      }
    }

    // 2. Hyperlink extraction — markdown links [text](url) and bare URLs with local file references
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(content)) !== null) {
      const linkTarget = linkMatch[2];
      // Check if link target references a known file
      const linkBasename = path.basename(linkTarget).toLowerCase();
      const resolved = fileNames.get(linkBasename) ?? fileNamesNoExt.get(linkBasename.replace(/\.[^.]+$/, ''));
      if (resolved && resolved !== filePath) {
        references.push({
          sourceFile: filePath,
          targetFile: resolved,
          referenceType: 'hyperlink',
          context: getContext(content, linkMatch.index, linkMatch[0].length),
          line: getLineNumber(content, linkMatch.index),
        });
      }
    }

    // 3. Citation patterns — "see X", "refer to X", "as described in X"
    const citationPatterns = [
      /\b(?:see|refer\s+to|as\s+described\s+in|as\s+noted\s+in|per|according\s+to)\s+["']?([^"'\n,;.]+?)["']?(?=[,;.\s]|$)/gi,
    ];
    for (const citationRegex of citationPatterns) {
      let citMatch: RegExpExecArray | null;
      while ((citMatch = citationRegex.exec(content)) !== null) {
        const mention = citMatch[1].trim();
        const mentionLower = mention.toLowerCase();
        // Try to resolve against known files
        const resolved = fileNames.get(mentionLower)
          ?? fileNamesNoExt.get(mentionLower)
          ?? fileNamesNoExt.get(mentionLower.replace(/\s+/g, '-'))
          ?? fileNamesNoExt.get(mentionLower.replace(/\s+/g, '_'));

        if (resolved && resolved !== filePath) {
          references.push({
            sourceFile: filePath,
            targetFile: resolved,
            referenceType: 'citation',
            context: getContext(content, citMatch.index, citMatch[0].length),
            line: getLineNumber(content, citMatch.index),
          });
        } else if (mention.length > 3 && mention.length < 100) {
          unresolvedMentions.push({
            sourceFile: filePath,
            mention,
            context: getContext(content, citMatch.index, citMatch[0].length),
          });
        }
      }
    }
  }

  return { references, unresolvedMentions };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
