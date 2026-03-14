import { Command, Option } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findFiles } from './walker.js';
import { parseFiles } from './parsers/index.js';
import { aggregate } from './stats.js';
import { formatDocumentTable, formatSccTable, formatSummaryLine } from './output/tabular.js';
import { formatJson } from './output/json.js';
import { checkScc, runScc } from './scc.js';
import { createProgress } from './progress.js';
import { documentToMarkdown } from './markdown/convert.js';
import { extractFromMarkdown } from './structure/index.js';
import { formatStructureTree, formatStructureJson } from './output/tree.js';
import { registerCodeCommands } from './code/command.js';
import { registerSheetCommands } from './sheet/command.js';
import { registerDocCommands } from './doc/command.js';
import { registerSlideCommands } from './slide/command.js';
import { registerTableCommands } from './table/command.js';
import type { StructureResult } from './output/tree.js';
import type { ParseResult } from './types.js';
import type { FileEntry } from './types.js';
import type { SccLanguage } from './scc.js';
import { getExtension, writeStream } from './utils.js';
import { validateLargeFileLimit } from './cli-validation.js';

interface CliOptions {
  byFile?: boolean;
  format: string;
  includeExt?: string;
  excludeExt?: string;
  excludeDir?: string;
  gitignore: boolean;
  sort: string;
  output?: string;
  ci?: boolean;
  largeFileLimit: string;
  code: boolean;
  structure?: boolean;
}

// Find package.json — works from both src/ (dev) and dist/src/ (built)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function loadPkg() {
  for (const rel of ['..', '../..']) {
    try { return JSON.parse(await readFile(path.resolve(__dirname, rel, 'package.json'), 'utf8')); }
    catch { /* try next */ }
  }
  return { version: '0.0.0' };
}
const pkg = await loadPkg();

export async function run(argv: string[]) {
  const program = new Command();

  program
    .name('occ')
    .description('Office Cloc and Count — scc-style summary tables for office documents')
    .version(pkg.version)
    .argument('[directories...]', 'directories to scan', [])
    .option('-f, --by-file', 'show a row per file instead of grouped by type')
    .option('--format <type>', 'output format: tabular or json', 'tabular')
    .option('--include-ext <exts>', 'comma-separated extensions to include')
    .option('--exclude-ext <exts>', 'comma-separated extensions to exclude')
    .option('--exclude-dir <dirs>', 'directories to skip (comma-separated)', 'node_modules,.git')
    .option('--no-gitignore', 'disable .gitignore respect')
    .addOption(new Option('--sort <col>', 'sort by: files, name, words, size').choices(['files', 'name', 'words', 'size']).default('files'))
    .option('-o, --output <file>', 'write output to file')
    .option('--ci', 'ASCII-only output, no colors')
    .option('--large-file-limit <mb>', 'skip files over this size in MB', '50')
    .option('--no-code', 'skip scc code analysis')
    .option('--structure', 'extract and display document structure')
    .action(async (directories: string[], opts: CliOptions) => {
      try {
        await execute(directories, opts);
      } catch (err: unknown) {
        const error = err as Error;
        await writeStream(process.stderr, `Error: ${error.message}\n`);
        process.exit(1);
      }
    });

  registerCodeCommands(program);
  registerSheetCommands(program);
  registerDocCommands(program);
  registerSlideCommands(program);
  registerTableCommands(program);

  await program.parseAsync(argv);
}

const STRUCTURABLE_EXTS = new Set(['docx', 'pdf', 'pptx', 'odt', 'odp']);

async function extractStructures(
  files: FileEntry[],
  concurrency: number,
  onProgress?: (inc: number, detail?: string) => void,
): Promise<StructureResult[]> {
  const results: StructureResult[] = [];

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (f) => {
        const markdown = await documentToMarkdown(f.path);
        if (markdown == null) return null;
        const structure = extractFromMarkdown(markdown);
        return { file: f.path, structure, markdown } as StructureResult;
      })
    );
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      }
      if (onProgress) onProgress(1, batch[j]?.path);
    }
  }

  return results;
}

async function execute(directories: string[], opts: CliOptions) {
  const startTime = Date.now();
  const excludeDirs = opts.excludeDir
    ? opts.excludeDir.split(',').map(d => d.trim())
    : ['node_modules', '.git'];

  const includeCode = opts.code !== false;

  let sccBinary: string | null = null;
  if (includeCode) {
    sccBinary = await checkScc();
  }

  // Find and parse office documents
  const { files, skipped } = await findFiles(directories, {
    includeExt: opts.includeExt,
    excludeExt: opts.excludeExt,
    excludeDir: excludeDirs,
    noGitignore: !opts.gitignore,
    largeFileLimit: validateLargeFileLimit(opts.largeFileLimit),
  });

  const showProgress = opts.format !== 'json' && process.stderr.isTTY;
  let results: ParseResult[] = [];
  if (files.length > 0) {
    const progress = createProgress({ total: files.length, label: 'Parsing', enabled: showProgress });
    results = await parseFiles(files, 10, (inc, detail) => progress.update(inc, detail));
    progress.done();
  }

  const stats = aggregate(results, {
    byFile: opts.byFile,
    sort: opts.sort,
  });

  let sccData: SccLanguage[] | null = null;
  if (includeCode) {
    if (showProgress) process.stderr.write('\rAnalyzing code with scc...');
    sccData = await runScc(sccBinary, directories, {
      byFile: opts.byFile,
      excludeDir: excludeDirs,
      sort: opts.sort,
      ci: opts.ci,
      noGitignore: !opts.gitignore,
    });
    if (showProgress) {
      const cols = process.stderr.columns || 80;
      process.stderr.write('\r' + ' '.repeat(cols) + '\r');
    }
  }

  // Structure extraction
  let structureResults: StructureResult[] = [];
  if (opts.structure) {
    const structurableFiles = files.filter(f => STRUCTURABLE_EXTS.has(getExtension(f.path)));
    if (structurableFiles.length > 0) {
      const progress = createProgress({ total: structurableFiles.length, label: 'Extracting structure', enabled: showProgress });
      structureResults = await extractStructures(structurableFiles, 10, (inc, detail) => progress.update(inc, detail));
      progress.done();
    }
  }

  // Format output
  let output: string;
  if (opts.format === 'json') {
    output = formatJson(stats, sccData, opts.structure ? structureResults : undefined);
  } else {
    const parts: string[] = [];

    if (files.length === 0 && (!sccData || sccData.length === 0)) {
      parts.push('No files found.');
    } else {
      if (files.length > 0) {
        parts.push(formatDocumentTable(stats, { ci: opts.ci }));
      }

      if (sccData && sccData.length > 0) {
        parts.push(formatSccTable(sccData, { ci: opts.ci, byFile: opts.byFile }));
      }

      // Structure trees
      if (structureResults.length > 0) {
        for (const sr of structureResults) {
          parts.push(formatStructureTree(sr, { ci: opts.ci }));
        }
      }

      const elapsed = Date.now() - startTime;
      const summary = formatSummaryLine(stats, sccData, elapsed, { ci: opts.ci });
      if (summary) parts.push(summary);
    }

    if (skipped.length > 0) {
      parts.push(`\n${skipped.length} file(s) skipped (use --large-file-limit to adjust)`);
    }

    output = parts.join('\n') + '\n';
  }

  if (opts.output) {
    await writeFile(opts.output, output);
  } else {
    await writeStream(process.stdout, output);
  }
}
