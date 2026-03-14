import { z } from 'zod';

/** Schema that coerces a string to a positive integer. */
export const PositiveIntSchema = z
  .string()
  .transform((val, ctx) => {
    const parsed = Number.parseInt(val, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `must be a positive integer` });
      return z.NEVER;
    }
    return parsed;
  });

/** Schema for header-row option: "auto", "none", or a positive integer string. */
export const HeaderRowSchema = z.union([
  z.literal('auto'),
  z.literal('none'),
  PositiveIntSchema,
]);
export type HeaderRowValue = z.infer<typeof HeaderRowSchema>;

/** Schema that coerces a string to a positive number (float). */
export const PositiveNumberSchema = z
  .string()
  .transform((val, ctx) => {
    const n = parseFloat(val);
    if (Number.isNaN(n) || n <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `must be a positive number` });
      return z.NEVER;
    }
    return n;
  });

/** Parse a CLI string option as a positive integer, returning fallback if undefined. */
export function parsePositiveInt(value: string | undefined, fallback: number, label: string): number {
  if (!value) return fallback;
  const result = PositiveIntSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid ${label}: "${value}"`);
  }
  return result.data;
}

/** Parse a header-row CLI option: "auto", "none", or a positive integer. */
export function parseHeaderRow(value: string | undefined): HeaderRowValue {
  if (!value) return 'auto';
  const result = HeaderRowSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid header-row: "${value}" (use "auto", "none", or a positive number)`);
  }
  return result.data;
}

/** Validate the --large-file-limit value. */
export function validateLargeFileLimit(value: string): number {
  const result = PositiveNumberSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid --large-file-limit value: "${value}" (must be a positive number)`);
  }
  return result.data;
}
