import { Command, Option } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { findFiles } from './walker.js';
import { parseFiles } from './parsers/index.js';
import { aggregate } from './stats.js';
import { formatDocumentTable, formatSccTable, formatSummaryLine } from './output/tabular.js';
import { formatJson } from './output/json.js';
import { checkScc, runScc } from './scc.js';
import { createProgress } from './progress.js';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

export async function run(argv) {
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
    .action(async (directories, opts) => {
      try {
        await execute(directories, opts);
      } catch (err) {
        process.stderr.write(`Error: ${err.message}\n`);
        process.exit(1);
      }
    });

  await program.parseAsync(argv);
}

function validateLargeFileLimit(value) {
  const n = parseFloat(value);
  if (Number.isNaN(n) || n <= 0) {
    throw new Error(`Invalid --large-file-limit value: "${value}" (must be a positive number)`);
  }
  return n;
}

async function execute(directories, opts) {
  const startTime = Date.now();
  const excludeDirs = opts.excludeDir
    ? opts.excludeDir.split(',').map(d => d.trim())
    : ['node_modules', '.git'];

  // Check scc availability (unless --no-code)
  let sccBinary = null;
  if (opts.code !== false) {
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
  let results = [];
  if (files.length > 0) {
    const progress = createProgress({ total: files.length, label: 'Parsing', enabled: showProgress });
    results = await parseFiles(files, 10, (inc, detail) => progress.update(inc, detail));
    progress.done();
  }

  const stats = aggregate(results, {
    byFile: opts.byFile,
    sort: opts.sort,
  });

  // Run scc for code files
  let sccData = null;
  if (opts.code !== false) {
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

  // Format output
  let output;
  if (opts.format === 'json') {
    output = formatJson(stats, sccData);
  } else {
    const parts = [];

    if (files.length === 0 && (!sccData || sccData.length === 0)) {
      parts.push('No files found.');
    } else {
      if (files.length > 0) {
        parts.push(formatDocumentTable(stats, { ci: opts.ci }));
      }

      if (sccData && sccData.length > 0) {
        parts.push(formatSccTable(sccData, { ci: opts.ci, byFile: opts.byFile }));
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
    process.stdout.write(output);
  }
}
