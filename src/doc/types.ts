import { z } from 'zod';
import { DocumentPropertiesSchema } from '../inspect/shared.js';
import { StructureNodeSchema } from '../structure/types.js';

export const DocRiskFlagsSchema = z.object({
  comments: z.boolean(),
  trackedChanges: z.boolean(),
  hyperlinks: z.boolean(),
  embeddedObjects: z.boolean(),
  footnotes: z.boolean(),
  endnotes: z.boolean(),
  macros: z.boolean(),
  headerFooter: z.boolean(),
  tables: z.boolean(),
  encrypted: z.boolean(),
});
export type DocRiskFlags = z.infer<typeof DocRiskFlagsSchema>;

export const DocContentStatsSchema = z.object({
  words: z.number(),
  pages: z.number(),
  pagesEstimated: z.boolean(),
  paragraphs: z.number(),
  characters: z.number(),
  tables: z.number(),
  images: z.number(),
});
export type DocContentStats = z.infer<typeof DocContentStatsSchema>;

export const StructureSummarySchema = z.object({
  headingCount: z.number(),
  maxDepth: z.number(),
  topLevelSections: z.array(z.string()),
  tree: z.array(StructureNodeSchema),
});
export type StructureSummary = z.infer<typeof StructureSummarySchema>;

export const ContentPreviewParagraphSchema = z.object({
  index: z.number(),
  text: z.string(),
  isHeading: z.boolean(),
  headingLevel: z.number().optional(),
});

export const ContentPreviewSchema = z.object({
  truncated: z.boolean(),
  paragraphs: z.array(ContentPreviewParagraphSchema),
});
export type ContentPreview = z.infer<typeof ContentPreviewSchema>;

export const DocumentInspectionSchema = z.object({
  file: z.string(),
  format: z.enum(['docx', 'pdf', 'odt']),
  size: z.number(),
  properties: DocumentPropertiesSchema,
  riskFlags: DocRiskFlagsSchema,
  contentStats: DocContentStatsSchema,
  structure: StructureSummarySchema.nullable(),
  contentPreview: ContentPreviewSchema,
  fullTokenEstimate: z.number(),
  previewTokenEstimate: z.number(),
});
export type DocumentInspection = z.infer<typeof DocumentInspectionSchema>;

export const DocInspectPayloadSchema = z.object({
  file: z.string(),
  query: z.record(z.string(), z.unknown()),
  results: DocumentInspectionSchema,
});
export type DocInspectPayload = z.infer<typeof DocInspectPayloadSchema>;

export const InspectDocOptionsSchema = z.object({
  sampleParagraphs: z.number(),
  includeStructure: z.boolean(),
});
export type InspectDocOptions = z.infer<typeof InspectDocOptionsSchema>;
