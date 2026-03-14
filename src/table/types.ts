import { z } from 'zod';

export const TableCellSchema = z.object({
  value: z.string(),
  colSpan: z.number().optional(),
  rowSpan: z.number().optional(),
});
export type TableCell = z.infer<typeof TableCellSchema>;

export const ExtractedTableSchema = z.object({
  tableIndex: z.number(),
  location: z.string().nullable(),
  rowCount: z.number(),
  columnCount: z.number(),
  cellCount: z.number(),
  headers: z.array(z.string()).nullable(),
  rows: z.array(z.object({
    index: z.number(),
    cells: z.array(TableCellSchema),
  })),
  truncated: z.boolean(),
  tokenEstimate: z.number(),
});
export type ExtractedTable = z.infer<typeof ExtractedTableSchema>;

export const TableInspectionResultSchema = z.object({
  file: z.string(),
  format: z.enum(['docx', 'xlsx', 'pptx', 'odt', 'odp', 'pdf']),
  size: z.number(),
  tableCount: z.number(),
  tables: z.array(ExtractedTableSchema),
  notes: z.array(z.string()),
  totalTokenEstimate: z.number(),
});
export type TableInspectionResult = z.infer<typeof TableInspectionResultSchema>;

export const TableInspectPayloadSchema = z.object({
  file: z.string(),
  query: z.record(z.string(), z.unknown()),
  results: TableInspectionResultSchema,
});
export type TableInspectPayload = z.infer<typeof TableInspectPayloadSchema>;

export const InspectTableOptionsSchema = z.object({
  table: z.number().optional(),
  sampleRows: z.number(),
  headerRow: z.union([z.literal('auto'), z.literal('none'), z.number()]),
});
export type InspectTableOptions = z.infer<typeof InspectTableOptionsSchema>;
