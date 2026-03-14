import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { inspectWorkbook, createSheetPayload } from './inspect.js';
import { formatSheetInspection, formatSheetPayloadJson } from './output.js';
import { writeStream } from '../utils.js';
import { parsePositiveInt, parseHeaderRow } from '../cli-validation.js';
import type { InspectSheetOptions } from './types.js';

interface SheetCommandOptions {
  format?: string;
  output?: string;
  ci?: boolean;
  sheet?: string;
  sampleRows?: string;
  headerRow?: string;
  maxColumns?: string;
}

function getOptions(command: Command): SheetCommandOptions {
  return command.optsWithGlobals() as SheetCommandOptions;
}

async function emit(output: string, options: SheetCommandOptions) {
  if (options.output) {
    await writeFile(options.output, output);
    return;
  }
  await writeStream(process.stdout, output);
}

export function registerSheetCommands(program: Command) {
  const sheet = program.command('sheet').description('Explore spreadsheet structure and schema before reading cell content in depth');
  const inspect = sheet.command('inspect <file>').description('Inspect XLSX workbook metadata, schema, and lightweight samples');

  inspect
    .option('--format <type>', 'output format: tabular or json', 'tabular')
    .option('-o, --output <file>', 'write output to file')
    .option('--ci', 'ASCII-only output, no colors')
    .option('--sheet <selector>', 'exact sheet name or 1-based sheet index')
    .option('--sample-rows <n>', 'maximum preview rows per sheet', '5')
    .option('--header-row <mode>', 'header row mode: auto, none, or a 1-based row number', 'auto')
    .option('--max-columns <n>', 'maximum columns to include in schema and sample output', '50');

  inspect.action(async (file: string, _options: SheetCommandOptions, command: Command) => {
    const options = getOptions(command);
    const resolved = path.resolve(file);
    const inspectOptions: InspectSheetOptions = {
      sheet: options.sheet,
      sampleRows: parsePositiveInt(options.sampleRows, 5, 'sample row count'),
      headerRow: parseHeaderRow(options.headerRow),
      maxColumns: parsePositiveInt(options.maxColumns, 50, 'max column count'),
    };
    const result = await inspectWorkbook(resolved, inspectOptions);
    const payload = createSheetPayload(resolved, {
      command: 'sheet.inspect',
      sheet: inspectOptions.sheet,
      sampleRows: inspectOptions.sampleRows,
      headerRow: inspectOptions.headerRow,
      maxColumns: inspectOptions.maxColumns,
    }, result);
    const output = options.format === 'json'
      ? formatSheetPayloadJson(payload)
      : formatSheetInspection(result, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });
}
