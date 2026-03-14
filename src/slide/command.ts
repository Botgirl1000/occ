import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { inspectPresentation } from './inspect.js';
import { formatSlideInspection, formatSlidePayloadJson } from './output.js';
import { createInspectPayload } from '../inspect/shared.js';
import { writeStream } from '../utils.js';
import { parsePositiveInt } from '../cli-validation.js';
import type { InspectSlideOptions, SlideInspectPayload } from './types.js';

interface SlideCommandOptions {
  format?: string;
  output?: string;
  ci?: boolean;
  sampleSlides?: string;
  slide?: string;
}

function getOptions(command: Command): SlideCommandOptions {
  return command.optsWithGlobals() as SlideCommandOptions;
}

async function emit(output: string, options: SlideCommandOptions) {
  if (options.output) {
    await writeFile(options.output, output);
    return;
  }
  await writeStream(process.stdout, output);
}

export function registerSlideCommands(program: Command) {
  const slide = program.command('slide').description('Inspect presentation structure and content before deep reading');
  const inspect = slide.command('inspect <file>').description('Inspect PPTX or ODP presentation metadata, slides, and content preview');

  inspect
    .option('--format <type>', 'output format: tabular or json', 'tabular')
    .option('-o, --output <file>', 'write output to file')
    .option('--ci', 'ASCII-only output, no colors')
    .option('--sample-slides <n>', 'preview slide count', '3')
    .option('--slide <number>', 'inspect specific slide (1-based index)');

  inspect.action(async (file: string, _options: SlideCommandOptions, command: Command) => {
    const options = getOptions(command);
    const resolved = path.resolve(file);
    const inspectOptions: InspectSlideOptions = {
      sampleSlides: parsePositiveInt(options.sampleSlides, 3, 'sample slide count'),
      slide: options.slide ? parsePositiveInt(options.slide, 1, 'slide number') : undefined,
    };
    const result = await inspectPresentation(resolved, inspectOptions);
    const payload = createInspectPayload<typeof result>(resolved, {
      command: 'slide.inspect',
      sampleSlides: inspectOptions.sampleSlides,
      slide: inspectOptions.slide,
    }, result) as SlideInspectPayload;
    const output = options.format === 'json'
      ? formatSlidePayloadJson(payload)
      : formatSlideInspection(result, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });
}
