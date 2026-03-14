import { z } from 'zod';
import { DocumentPropertiesSchema } from '../inspect/shared.js';

export const SlideRiskFlagsSchema = z.object({
  comments: z.boolean(),
  speakerNotes: z.boolean(),
  hyperlinks: z.boolean(),
  embeddedMedia: z.boolean(),
  animations: z.boolean(),
  macros: z.boolean(),
  charts: z.boolean(),
  tables: z.boolean(),
});
export type SlideRiskFlags = z.infer<typeof SlideRiskFlagsSchema>;

export const SlideProfileSchema = z.object({
  index: z.number(),
  title: z.string().nullable(),
  words: z.number(),
  hasNotes: z.boolean(),
  notePreview: z.string().nullable(),
  images: z.number(),
  tables: z.number(),
  charts: z.number(),
});
export type SlideProfile = z.infer<typeof SlideProfileSchema>;

export const SlideContentStatsSchema = z.object({
  slides: z.number(),
  words: z.number(),
  slidesWithNotes: z.number(),
  totalImages: z.number(),
  totalTables: z.number(),
  totalCharts: z.number(),
});
export type SlideContentStats = z.infer<typeof SlideContentStatsSchema>;

export const SlidePreviewSchema = z.object({
  truncated: z.boolean(),
  slides: z.array(z.object({
    index: z.number(),
    title: z.string().nullable(),
    textPreview: z.string(),
    hasNotes: z.boolean(),
  })),
});
export type SlidePreview = z.infer<typeof SlidePreviewSchema>;

export const PresentationInspectionSchema = z.object({
  file: z.string(),
  format: z.enum(['pptx', 'odp']),
  size: z.number(),
  properties: DocumentPropertiesSchema,
  riskFlags: SlideRiskFlagsSchema,
  contentStats: SlideContentStatsSchema,
  slideInventory: z.array(SlideProfileSchema),
  slidePreview: SlidePreviewSchema,
  fullTokenEstimate: z.number(),
  previewTokenEstimate: z.number(),
});
export type PresentationInspection = z.infer<typeof PresentationInspectionSchema>;

export const SlideInspectPayloadSchema = z.object({
  file: z.string(),
  query: z.record(z.string(), z.unknown()),
  results: PresentationInspectionSchema,
});
export type SlideInspectPayload = z.infer<typeof SlideInspectPayloadSchema>;

export const InspectSlideOptionsSchema = z.object({
  sampleSlides: z.number(),
  slide: z.number().optional(),
});
export type InspectSlideOptions = z.infer<typeof InspectSlideOptionsSchema>;
