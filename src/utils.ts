import path from 'node:path';
import { z } from 'zod';

export function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '';
  return n.toLocaleString('en-US');
}

export function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase().replace('.', '');
}

export const EXTENSION_TO_TYPE: Record<string, string> = {
  docx: 'Word',
  pdf: 'PDF',
  xlsx: 'Excel',
  pptx: 'PowerPoint',
  odt: 'ODT',
  ods: 'ODS',
  odp: 'ODP',
};

export const OFFICE_EXTENSIONS: string[] = Object.keys(EXTENSION_TO_TYPE);

export const METRIC_FIELDS = ['words', 'pages', 'paragraphs', 'sheets', 'rows', 'cells', 'slides'] as const;

export const MetricFieldSchema = z.enum(METRIC_FIELDS);
export type MetricField = z.infer<typeof MetricFieldSchema>;

export function hasKey(field: string): string {
  return `has${field[0].toUpperCase()}${field.slice(1)}`;
}

export async function writeStream(stream: NodeJS.WritableStream, text: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    stream.write(text, (error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
