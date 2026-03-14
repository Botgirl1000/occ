import { z } from 'zod';

export const FileEntrySchema = z.object({
  path: z.string(),
  size: z.number(),
});
export type FileEntry = z.infer<typeof FileEntrySchema>;

export const SkippedEntrySchema = z.object({
  path: z.string(),
  reason: z.string(),
  size: z.number(),
});
export type SkippedEntry = z.infer<typeof SkippedEntrySchema>;

export const ParserOutputSchema = z.object({
  fileType: z.string(),
  metrics: z.record(z.string(), z.number()),
});
export type ParserOutput = z.infer<typeof ParserOutputSchema>;

export const ParseResultSchema = z.object({
  filePath: z.string(),
  size: z.number(),
  success: z.boolean(),
  fileType: z.string(),
  metrics: z.record(z.string(), z.number()).nullable(),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;
