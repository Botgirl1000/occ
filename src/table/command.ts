import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { inspectTables } from './inspect.js';
import { formatTableInspection, formatTablePayloadJson } from './output.js';
import { createInspectPayload } from '../inspect/shared.js';
import { writeStream } from '../utils.js';
import { parsePositiveInt, parseHeaderRow } from '../cli-validation.js';
import type { InspectTableOptions, TableInspectPayload } from './types.js';

interface TableCommandOptions {
  format?: string;
  output?: string;
  ci?: boolean;
  table?: string;
  sampleRows?: string;
  headerRow?: string;
}

function getOptions(command: Command): TableCommandOptions {
  return command.optsWithGlobals() as TableCommandOptions;
}

async function emit(output: string, options: TableCommandOptions) {
  if (options.output) {
    await writeFile(options.output, output);
    return;
  }
  await writeStream(process.stdout, output);
}

export function registerTableCommands(program: Command) {
  const table = program.command('table').description('Extract and inspect table content from documents');
  const inspect = table.command('inspect <file>').description('Extract structured table data from DOCX, XLSX, PPTX, ODT, or ODP documents');

  inspect
    .option('--format <type>', 'output format: tabular or json', 'tabular')
    .option('-o, --output <file>', 'write output to file')
    .option('--ci', 'ASCII-only output, no colors')
    .option('--table <n>', 'extract specific table (1-based index)')
    .option('--sample-rows <n>', 'max rows per table', '20')
    .option('--header-row <mode>', 'header detection: auto, none, or row number', 'auto');

  inspect.action(async (file: string, _options: TableCommandOptions, command: Command) => {
    const options = getOptions(command);
    const resolved = path.resolve(file);
    const inspectOptions: InspectTableOptions = {
      sampleRows: parsePositiveInt(options.sampleRows, 20, 'sample row count'),
      table: options.table ? parsePositiveInt(options.table, 1, 'table number') : undefined,
      headerRow: parseHeaderRow(options.headerRow),
    };
    const result = await inspectTables(resolved, inspectOptions);
    const payload = createInspectPayload<typeof result>(resolved, {
      command: 'table.inspect',
      sampleRows: inspectOptions.sampleRows,
      table: inspectOptions.table,
      headerRow: inspectOptions.headerRow,
    }, result) as TableInspectPayload;
    const output = options.format === 'json'
      ? formatTablePayloadJson(payload)
      : formatTableInspection(result, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });
}
