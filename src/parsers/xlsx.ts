import { readFile } from 'node:fs/promises';
import XLSX from 'xlsx';
import { z } from 'zod';
import type { ParserOutput } from '../types.js';

const XlsxWorkbookSchema = z.object({
  SheetNames: z.array(z.string()),
  Sheets: z.record(z.string(), z.object({
    '!ref': z.string().optional(),
  }).passthrough()),
});

export async function parseXlsx(filePath: string): Promise<ParserOutput> {
  const buffer = await readFile(filePath);
  const workbook = XlsxWorkbookSchema.parse(XLSX.read(buffer, { type: 'buffer' }));

  const sheets = workbook.SheetNames.length;
  let rows = 0;
  let cells = 0;

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const ref = sheet['!ref'];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    rows += range.e.r - range.s.r + 1;
    cells += (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
  }

  return {
    fileType: 'Excel',
    metrics: { sheets, rows, cells },
    confidence: {
      sheets: 'exact',
      rows: 'exact',
      cells: 'exact',
    },
  };
}
