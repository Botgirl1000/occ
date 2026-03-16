import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { z } from 'zod';
import { inspectDocument } from './inspect.js';
import { formatDocInspection, formatDocPayloadJson } from './output.js';
import { createInspectPayload } from '../inspect/shared.js';
import { writeStream } from '../utils.js';
import { parsePositiveInt } from '../cli-validation.js';
import { extractDocumentEntities } from './entities.js';
import { detectCrossReferences } from './references.js';
import { documentToMarkdown } from '../markdown/convert.js';
import { findFiles } from '../walker.js';
import type { InspectDocOptions, DocInspectPayload } from './types.js';

const DocCommandOptionsSchema = z.object({
  format: z.string().optional(),
  output: z.string().optional(),
  ci: z.boolean().optional(),
  sampleParagraphs: z.string().optional(),
  structure: z.boolean().optional(),
}).passthrough();
type DocCommandOptions = z.infer<typeof DocCommandOptionsSchema>;

function getOptions(command: Command): DocCommandOptions {
  return DocCommandOptionsSchema.parse(command.optsWithGlobals());
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

  // Entity extraction command
  const entities = doc.command('entities <file>').description('Extract entities (emails, URLs, dates, phone numbers, mentions) and keywords from a document');
  entities
    .option('--format <type>', 'output format: tabular or json', 'json')
    .option('-o, --output <file>', 'write output to file')
    .option('--ci', 'ASCII-only output, no colors');

  entities.action(async (file: string, _options: DocCommandOptions, command: Command) => {
    const options = getOptions(command);
    const resolved = path.resolve(file);
    const markdown = await documentToMarkdown(resolved);
    if (!markdown) {
      await emit('Could not extract text from document.\n', options);
      return;
    }
    const result = extractDocumentEntities(markdown);
    const output = JSON.stringify({
      file: resolved,
      entities: result.entities,
      keywords: result.keywords,
    }, null, 2);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });

  // Cross-document references command
  const references = doc.command('references [directories...]').description('Detect cross-references between documents in directories');
  references
    .option('--format <type>', 'output format: tabular or json', 'json')
    .option('-o, --output <file>', 'write output to file')
    .option('--ci', 'ASCII-only output, no colors');

  references.action(async (directories: string[], _options: DocCommandOptions, command: Command) => {
    const options = getOptions(command);
    const dirs = directories.length > 0 ? directories : [process.cwd()];

    // Find and convert all documents
    const { files } = await findFiles(dirs);
    const documents: Array<{ filePath: string; content: string }> = [];
    for (const file of files) {
      try {
        const markdown = await documentToMarkdown(file.path);
        if (markdown) documents.push({ filePath: file.path, content: markdown });
      } catch {
        // Skip files that can't be converted
      }
    }

    const result = detectCrossReferences(documents);
    const output = JSON.stringify({
      directories: dirs,
      documentsAnalyzed: documents.length,
      references: result.references,
      unresolvedMentions: result.unresolvedMentions,
    }, null, 2);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });
}
