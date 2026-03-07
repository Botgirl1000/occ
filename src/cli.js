import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { findFiles } from './walker.js';
import { parseFiles } from './parsers/index.js';
import { aggregate } from './stats.js';
import { formatDocumentTable, formatSccTable } from './output/tabular.js';
import { formatJson } from './output/json.js';
import { checkScc, runScc } from './scc.js';

export async function run(argv) {
  const program = new Command();

  program
    .name('occ')
    .description('Office Cloc and Count — scc-style summary tables for office documents')
    .version('0.1.0')
    .argument('[directories...]', 'directories to scan', [])
    .option('-f, --by-file', 'show a row per file instead of grouped by type')
    .option('--format <type>', 'output format: tabular or json', 'tabular')
    .option('--include-ext <exts>', 'comma-separated extensions to include')
    .option('--exclude-ext <exts>', 'comma-separated extensions to exclude')
    .option('--exclude-dir <dirs>', 'directories to skip (comma-separated)', 'node_modules,.git')
    .option('--no-gitignore', 'disable .gitignore respect')
    .option('--sort <col>', 'sort by: files, name, words, size', 'files')
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

async function execute(directories, opts) {
  const excludeDirs = opts.excludeDir
    ? opts.excludeDir.split(',').map(d => d.trim())
    : ['node_modules', '.git'];

  // Check scc availability (unless --no-code)
  if (opts.code !== false) {
    await checkScc();
  }

  // Find and parse office documents
  const { files, skipped } = await findFiles(directories, {
    includeExt: opts.includeExt,
    excludeExt: opts.excludeExt,
    excludeDir: excludeDirs,
    noGitignore: !opts.gitignore,
    largeFileLimit: parseFloat(opts.largeFileLimit),
  });

  let results = [];
  if (files.length > 0) {
    results = await parseFiles(files);
  }

  const stats = aggregate(results, {
    byFile: opts.byFile,
    sort: opts.sort,
  });

  // Run scc for code files
  let sccData = null;
  if (opts.code !== false) {
    sccData = await runScc(directories, {
      byFile: opts.byFile,
      excludeDir: excludeDirs,
      sort: opts.sort,
      ci: opts.ci,
      noGitignore: !opts.gitignore,
    });
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

      if (files.length === 0) {
        parts.unshift('\nNo office documents found.');
      }
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
