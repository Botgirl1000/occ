import { z } from 'zod';
import { estimateTokenCount } from '../tokens.js';

export const DocumentPropertiesSchema = z.object({
  title: z.string().optional(),
  subject: z.string().optional(),
  author: z.string().optional(),
  company: z.string().optional(),
  createdDate: z.string().optional(),
  modifiedDate: z.string().optional(),
  lastModifiedBy: z.string().optional(),
  keywords: z.string().optional(),
});
export type DocumentProperties = z.infer<typeof DocumentPropertiesSchema>;

export function estimateTokens(input: string | number): number {
  return estimateTokenCount(input);
}

export function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function formatDateLike(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

export function createInspectPayload<T>(file: string, query: Record<string, unknown>, results: T): { file: string; query: Record<string, unknown>; results: T } {
  return { file, query, results };
}
