/**
 * Language-aware token estimation — tokenx-inspired approach.
 * Replaces the naive `chars / 4` heuristic with segment-level analysis.
 */

export interface LanguageConfig {
  pattern: RegExp;
  averageCharsPerToken: number;
}

export interface TokenEstimationOptions {
  defaultCharsPerToken?: number;
  languageConfigs?: LanguageConfig[];
}

const PATTERNS = {
  whitespace: /^\s+$/,
  cjk: /[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF\u30A0-\u30FF\u2E80-\u2EFF\u31C0-\u31EF\u3200-\u32FF\u3300-\u33FF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/,
  numeric: /^\d+(?:[.,]\d+)*$/,
  punctuation: /[.,!?;(){}[\]<>:/\\|@#$%^&*+=`~_-]/,
  alphanumeric: /^[a-zA-Z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]+$/,
} as const;

const TOKEN_SPLIT_PATTERN = new RegExp(`(\\s+|${PATTERNS.punctuation.source}+)`);
const DEFAULT_CHARS_PER_TOKEN = 6;
const SHORT_TOKEN_THRESHOLD = 3;

const DEFAULT_LANGUAGE_CONFIGS: LanguageConfig[] = [
  { pattern: /[äöüßẞ]/i, averageCharsPerToken: 3 },
  { pattern: /[éèêëàâîïôûùüÿçœæáíóúñ]/i, averageCharsPerToken: 3 },
  { pattern: /[ąćęłńóśźżěščřžýůúďťň]/i, averageCharsPerToken: 3.5 },
];

function getLanguageSpecificCharsPerToken(segment: string, configs: LanguageConfig[]): number | undefined {
  for (const config of configs) {
    if (config.pattern.test(segment)) {
      return config.averageCharsPerToken;
    }
  }
  return undefined;
}

function getCharacterCount(text: string): number {
  return Array.from(text).length;
}

function estimateSegmentTokens(
  segment: string,
  languageConfigs: LanguageConfig[],
  defaultCharsPerToken: number,
): number {
  if (PATTERNS.whitespace.test(segment)) return 0;
  if (PATTERNS.cjk.test(segment)) return getCharacterCount(segment);
  if (PATTERNS.numeric.test(segment)) return 1;
  if (segment.length <= SHORT_TOKEN_THRESHOLD) return 1;
  if (PATTERNS.punctuation.test(segment)) return segment.length > 1 ? Math.ceil(segment.length / 2) : 1;

  const charsPerToken = getLanguageSpecificCharsPerToken(segment, languageConfigs) ?? defaultCharsPerToken;
  return Math.ceil(segment.length / charsPerToken);
}

/** Estimate token count using language-aware heuristics */
export function estimateTokenCount(text?: string | number, options: TokenEstimationOptions = {}): number {
  if (text == null) return 0;
  if (typeof text === 'number') {
    // Fallback for numeric input (character count) — use default ratio
    return Math.max(0, Math.ceil(text / (options.defaultCharsPerToken ?? DEFAULT_CHARS_PER_TOKEN)));
  }
  if (!text) return 0;

  const {
    defaultCharsPerToken = DEFAULT_CHARS_PER_TOKEN,
    languageConfigs = DEFAULT_LANGUAGE_CONFIGS,
  } = options;

  const segments = text.split(TOKEN_SPLIT_PATTERN).filter(Boolean);
  let tokenCount = 0;
  for (const segment of segments) {
    tokenCount += estimateSegmentTokens(segment, languageConfigs, defaultCharsPerToken);
  }
  return tokenCount;
}

/** Slice text by token positions (like Array.slice but for tokens) */
export function sliceByTokens(
  text: string,
  start = 0,
  end?: number,
  options: TokenEstimationOptions = {},
): string {
  if (!text) return '';

  const { defaultCharsPerToken = DEFAULT_CHARS_PER_TOKEN, languageConfigs = DEFAULT_LANGUAGE_CONFIGS } = options;

  let totalTokens = 0;
  if (start < 0 || (end !== undefined && end < 0)) {
    totalTokens = estimateTokenCount(text, options);
  }

  const normalizedStart = start < 0 ? Math.max(0, totalTokens + start) : Math.max(0, start);
  const normalizedEnd = end === undefined ? Infinity : end < 0 ? Math.max(0, totalTokens + end) : end;

  if (normalizedStart >= normalizedEnd) return '';

  const segments = text.split(TOKEN_SPLIT_PATTERN).filter(Boolean);
  const parts: string[] = [];
  let currentTokenPos = 0;

  for (const segment of segments) {
    if (currentTokenPos >= normalizedEnd) break;

    const tokenCount = estimateSegmentTokens(segment, languageConfigs, defaultCharsPerToken);
    const segmentEnd = currentTokenPos + tokenCount;

    if (segmentEnd > normalizedStart && currentTokenPos < normalizedEnd) {
      if (tokenCount === 0) {
        if (currentTokenPos >= normalizedStart && currentTokenPos < normalizedEnd) {
          parts.push(segment);
        }
      } else {
        const overlapStart = Math.max(0, normalizedStart - currentTokenPos);
        const overlapEnd = Math.min(tokenCount, normalizedEnd - currentTokenPos);
        if (overlapStart === 0 && overlapEnd === tokenCount) {
          parts.push(segment);
        } else {
          const charStart = Math.floor((overlapStart / tokenCount) * segment.length);
          const charEnd = Math.ceil((overlapEnd / tokenCount) * segment.length);
          parts.push(segment.slice(charStart, charEnd));
        }
      }
    }

    currentTokenPos += tokenCount;
  }

  return parts.join('');
}
