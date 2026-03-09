import XLSX from 'xlsx';
import type { ParserOutput } from '../types.js';

export async function parseXlsx(filePath: string): Promise<ParserOutput> {
  const workbook = XLSX.readFile(filePath);

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
  };
}
