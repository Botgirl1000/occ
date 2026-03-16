/**
 * Light entity extraction — regex-based pattern matching + TF-IDF keyword extraction.
 */

export interface ExtractedEntity {
  type: 'email' | 'url' | 'date' | 'phone' | 'mention';
  value: string;
  position: number;
  context: string;
}

export interface KeywordScore {
  term: string;
  tfidf: number;
  tf: number;
  idf: number;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  keywords: KeywordScore[];
}

const ENTITY_PATTERNS: Array<{ type: ExtractedEntity['type']; pattern: RegExp }> = [
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: 'url', pattern: /https?:\/\/[^\s)<>]+/g },
  { type: 'date', pattern: /\b\d{4}-\d{2}-\d{2}\b/g },
  { type: 'date', pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g },
  { type: 'phone', pattern: /(?:\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g },
  { type: 'mention', pattern: /@[a-zA-Z0-9_-]+/g },
];

const CONTEXT_WINDOW = 40;

function extractContext(text: string, position: number, length: number): string {
  const start = Math.max(0, position - CONTEXT_WINDOW);
  const end = Math.min(text.length, position + length + CONTEXT_WINDOW);
  let context = text.slice(start, end).replace(/\n/g, ' ');
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';
  return context;
}

/** Extract entities (emails, URLs, dates, phone numbers, @mentions) from text */
export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  for (const { type, pattern } of ENTITY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const key = `${type}:${match[0]}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entities.push({
        type,
        value: match[0],
        position: match.index,
        context: extractContext(text, match.index, match[0].length),
      });
    }
  }

  return entities.sort((a, b) => a.position - b.position);
}

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'is', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'having',
  'does', 'did', 'doing', 'am', 'its', 'than', 'also', 'into', 'could',
  'may', 'should', 'each', 'other', 'then', 'them', 'these', 'some',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/** Extract keywords using TF-IDF across a batch of documents */
export function extractKeywords(texts: string[], topK = 20): KeywordScore[][] {
  const docCount = texts.length;
  const allTokenized = texts.map(tokenize);

  // Document frequency
  const df = new Map<string, number>();
  for (const tokens of allTokenized) {
    const unique = new Set(tokens);
    for (const term of unique) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  return allTokenized.map(tokens => {
    // Term frequency for this document
    const tf = new Map<string, number>();
    for (const term of tokens) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
    }

    const scores: KeywordScore[] = [];
    for (const [term, count] of tf) {
      const termFreq = count / tokens.length;
      const inverseDocFreq = Math.log(docCount / (df.get(term) ?? 1));
      scores.push({
        term,
        tfidf: termFreq * inverseDocFreq,
        tf: termFreq,
        idf: inverseDocFreq,
      });
    }

    return scores.sort((a, b) => b.tfidf - a.tfidf).slice(0, topK);
  });
}

/** Single-document keyword extraction (IDF is 1 for all terms, falls back to TF) */
export function extractKeywordsSingle(text: string, topK = 20): KeywordScore[] {
  return extractKeywords([text], topK)[0];
}

/** Full entity extraction: entities + keywords for a single document */
export function extractDocumentEntities(text: string, topK = 20): EntityExtractionResult {
  return {
    entities: extractEntities(text),
    keywords: extractKeywordsSingle(text, topK),
  };
}
