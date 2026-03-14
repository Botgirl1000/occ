import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { inspectDocument } from './inspect.js';
import { formatDocInspection, formatDocPayloadJson } from './output.js';
import { createInspectPayload } from '../inspect/shared.js';
import { writeStream } from '../utils.js';
import { parsePositiveInt } from '../cli-validation.js';
import type { InspectDocOptions, DocInspectPayload } from './types.js';

interface DocCommandOptions {
  format?: string;
  output?: string;
  ci?: boolean;
  sampleParagraphs?: string;
  structure?: boolean;
}

function getOptions(command: Command): DocCommandOptions {
  return command.optsWithGlobals() as DocCommandOptions;
}

async function emit(output: string, options: DocCommandOptions) {
  if (options.output) {
    await writeFile(options.output, output);
    return;
  }
  await writeStream(process.stdout, output);
}

export function registerDocCommands(program: Command) {
  const doc = program.command('doc').description('Inspect document structure and content before deep reading');
  const inspect = doc.command('inspect <file>').description('Inspect DOCX, PDF, or ODT document metadata, structure, and content preview');

  inspect
    .option('--format <type>', 'output format: tabular or json', 'tabular')
    .option('-o, --output <file>', 'write output to file')
    .option('--ci', 'ASCII-only output, no colors')
    .option('--sample-paragraphs <n>', 'preview paragraph count', '5')
    .option('--no-structure', 'skip heading tree extraction');

  inspect.action(async (file: string, _options: DocCommandOptions, command: Command) => {
    const options = getOptions(command);
    const resolved = path.resolve(file);
    const inspectOptions: InspectDocOptions = {
      sampleParagraphs: parsePositiveInt(options.sampleParagraphs, 5, 'sample paragraph count'),
      includeStructure: options.structure !== false,
    };
    const result = await inspectDocument(resolved, inspectOptions);
    const payload = createInspectPayload<typeof result>(resolved, {
      command: 'doc.inspect',
      sampleParagraphs: inspectOptions.sampleParagraphs,
      includeStructure: inspectOptions.includeStructure,
    }, result) as DocInspectPayload;
    const output = options.format === 'json'
      ? formatDocPayloadJson(payload)
      : formatDocInspection(result, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });
}
