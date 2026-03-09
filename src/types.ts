export interface FileEntry {
  path: string;
  size: number;
}

export interface SkippedEntry {
  path: string;
  reason: string;
  size: number;
}

export interface ParserOutput {
  fileType: string;
  metrics: Record<string, number>;
}

export interface ParseResult {
  filePath: string;
  size: number;
  success: boolean;
  fileType: string;
  metrics: Record<string, number> | null;
}
