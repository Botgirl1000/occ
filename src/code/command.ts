import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command, Option } from 'commander';
import { z } from 'zod';
import { buildCodebaseIndex } from './build.js';
import { writeStream } from '../utils.js';
import { parsePositiveInt } from '../cli-validation.js';
import {
  analyzeCallChain,
  analyzeCallers,
  analyzeCalls,
  analyzeDeps,
  analyzeTree,
  createPayload,
  findByName,
  findByPattern,
  findByType,
  findContent,
  fusedSearch,
} from './query.js';
import {
  formatChains,
  formatClassTree,
  formatContentResults,
  formatDependencies,
  formatFusedResults,
  formatPayloadJson,
  formatRelationResults,
  formatSearchResults,
} from './output.js';
import type { CodeNodeType } from './types.js';

const CodeCommandOptionsSchema = z.object({
  path: z.string().optional(),
  format: z.string().optional(),
  output: z.string().optional(),
  ci: z.boolean().optional(),
  file: z.string().optional(),
  limit: z.string().optional(),
  depth: z.string().optional(),
  type: z.string().optional(),
  excludeDir: z.string().optional(),
  gitignore: z.boolean().optional(),
}).passthrough();
type CodeCommandOptions = z.infer<typeof CodeCommandOptionsSchema>;

function getOptions(command: Command): CodeCommandOptions {
  return CodeCommandOptionsSchema.parse(command.optsWithGlobals());
}

const FINDABLE_TYPES: CodeNodeType[] = ['file', 'module', 'function', 'class', 'interface', 'type-alias', 'enum', 'variable'];

const FindableTypeSchema = z.enum(['file', 'module', 'function', 'class', 'interface', 'type-alias', 'enum', 'variable']);

function parseType(value: string | undefined): CodeNodeType | undefined {
  if (!value) return undefined;
  const result = FindableTypeSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid type "${value}". Expected one of: ${FINDABLE_TYPES.join(', ')}`);
  }
  return result.data;
}

async function emit(output: string, options: CodeCommandOptions) {
  if (options.output) {
    await writeFile(options.output, output);
    return;
  }
  await writeStream(process.stdout, output);
}

async function withIndex(options: CodeCommandOptions) {
  const repoRoot = path.resolve(options.path ?? process.cwd());
  return buildCodebaseIndex({
    repoRoot,
    excludeDir: options.excludeDir?.split(',').map(value => value.trim()).filter(Boolean),
    noGitignore: options.gitignore === false,
  });
}

function addSharedOptions(command: Command, extra: { includeFile?: boolean; includeLimit?: boolean; includeDepth?: boolean; includeType?: boolean } = {}) {
  command
    .option('--path <repo-root>', 'repository root to analyze', process.cwd())
    .option('--format <type>', 'output format: tabular or json', 'tabular')
    .option('-o, --output <file>', 'write output to file')
    .option('--ci', 'ASCII-only output, no colors')
    .option('--exclude-dir <dirs>', 'directories to skip (comma-separated)', 'node_modules,.git,dist,vendor,build,coverage,target')
    .option('--no-gitignore', 'disable .gitignore respect');

  if (extra.includeFile) {
    command.option('--file <path>', 'specific file path to disambiguate the target');
  }
  if (extra.includeLimit) {
    command.option('--limit <n>', 'maximum results to return', '50');
  }
  if (extra.includeDepth) {
    command.option('--depth <n>', 'maximum call-chain depth', '5');
  }
  if (extra.includeType) {
    command.addOption(new Option('--type <node-type>', 'filter by node type').choices(FINDABLE_TYPES));
  }
}

export function registerCodeCommands(program: Command) {
  const code = program.command('code').description('Explore code structure with first-class JS/TS and Python support');
  const find = code.command('find').description('Find symbols and source content');
  const analyze = code.command('analyze').description('Analyze relationships between code elements');

  // occ code index — build and emit the full codebase index
  const indexCmd = code.command('index').description('Build the full codebase index (files, symbols, edges, capabilities)');
  addSharedOptions(indexCmd);
  indexCmd.action(async (_options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const repoRoot = path.resolve(options.path ?? process.cwd());
    const index = await buildCodebaseIndex({
      repoRoot,
      excludeDir: options.excludeDir?.split(',').map(value => value.trim()).filter(Boolean),
      noGitignore: options.gitignore === false,
    }, (event) => {
      if (options.format !== 'json') {
        process.stderr.write(`\r${event.phase}: ${event.completed}/${event.total}${event.detail ? ` ${event.detail}` : ''}   `);
      }
    });
    if (options.format !== 'json') {
      process.stderr.write('\n');
    }
    const summary = options.format === 'json'
      ? JSON.stringify(index, null, 2)
      : `${index.files.length} files, ${index.nodes.length} nodes, ${index.edges.length} edges, ${Object.keys(index.capabilities).length} languages\n`;
    await emit(summary.endsWith('\n') ? summary : `${summary}\n`, options);
  });

  const findName = find.command('name <name>').description('Find code elements by exact name');
  addSharedOptions(findName, { includeFile: true, includeLimit: true, includeType: true });
  findName.action(async (name: string, _options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const index = await withIndex(options);
    const results = findByName(index, name, parseType(options.type), options.file, parsePositiveInt(options.limit, 50, 'limit'));
    const payload = createPayload(index, { command: 'code.find.name', value: name, file: options.file, type: options.type }, results);
    const output = options.format === 'json'
      ? formatPayloadJson(payload)
      : formatSearchResults(`Code Search: ${name}`, results, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });

  const findPatternCmd = find.command('pattern <pattern>').description('Find code elements by substring pattern');
  addSharedOptions(findPatternCmd, { includeLimit: true, includeType: true });
  findPatternCmd.action(async (pattern: string, _options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const index = await withIndex(options);
    const results = findByPattern(index, pattern, parseType(options.type), parsePositiveInt(options.limit, 50, 'limit'));
    const payload = createPayload(index, { command: 'code.find.pattern', value: pattern, type: options.type }, results);
    const output = options.format === 'json'
      ? formatPayloadJson(payload)
      : formatSearchResults(`Code Pattern: ${pattern}`, results, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });

  const findTypeCmd = find.command('type <nodeType>').description('List all nodes of a given type');
  addSharedOptions(findTypeCmd, { includeLimit: true });
  findTypeCmd.action(async (nodeType: string, _options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const index = await withIndex(options);
    const results = findByType(index, parseType(nodeType) ?? 'function', parsePositiveInt(options.limit, 50, 'limit'));
    const payload = createPayload(index, { command: 'code.find.type', value: nodeType }, results);
    const output = options.format === 'json'
      ? formatPayloadJson(payload)
      : formatSearchResults(`Code Type: ${nodeType}`, results, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });

  const findContentCmd = find.command('content <text>').description('Search code content');
  addSharedOptions(findContentCmd, { includeLimit: true });
  findContentCmd.action(async (text: string, _options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const index = await withIndex(options);
    const results = findContent(index, text, parsePositiveInt(options.limit, 50, 'limit'));
    const payload = createPayload(index, { command: 'code.find.content', value: text }, results);
    const output = options.format === 'json'
      ? formatPayloadJson(payload)
      : formatContentResults(results, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });

  const analyzeCallsCmd = analyze.command('calls <functionName>').description('Show what a function calls');
  addSharedOptions(analyzeCallsCmd, { includeFile: true });
  analyzeCallsCmd.action(async (functionName: string, _options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const index = await withIndex(options);
    const results = analyzeCalls(index, functionName, options.file);
    const payload = createPayload(index, { command: 'code.analyze.calls', value: functionName, file: options.file }, results);
    const output = options.format === 'json'
      ? formatPayloadJson(payload)
      : formatRelationResults(`Outgoing Calls: ${functionName}`, 'Callee', results, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });

  const analyzeCallersCmd = analyze.command('callers <functionName>').description('Show what calls a function');
  addSharedOptions(analyzeCallersCmd, { includeFile: true });
  analyzeCallersCmd.action(async (functionName: string, _options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const index = await withIndex(options);
    const results = analyzeCallers(index, functionName, options.file);
    const payload = createPayload(index, { command: 'code.analyze.callers', value: functionName, file: options.file }, results);
    const output = options.format === 'json'
      ? formatPayloadJson(payload)
      : formatRelationResults(`Incoming Calls: ${functionName}`, 'Caller', results, options.ci, 'from');
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });

  const analyzeChainCmd = analyze.command('chain <fromFunction> <toFunction>').description('Find call paths between two functions');
  addSharedOptions(analyzeChainCmd, { includeDepth: true });
  analyzeChainCmd.action(async (fromFunction: string, toFunction: string, _options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const index = await withIndex(options);
    const results = analyzeCallChain(index, fromFunction, toFunction, parsePositiveInt(options.depth, 5, 'depth'));
    const payload = createPayload(index, { command: 'code.analyze.chain', from: fromFunction, to: toFunction, depth: options.depth }, results);
    const output = options.format === 'json'
      ? formatPayloadJson(payload)
      : formatChains(results, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });

  const analyzeDepsCmd = analyze.command('deps <target>').description('Show module/file import relationships');
  addSharedOptions(analyzeDepsCmd);
  analyzeDepsCmd.action(async (target: string, _options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const index = await withIndex(options);
    const results = analyzeDeps(index, target);
    const payload = createPayload(index, { command: 'code.analyze.deps', value: target }, results);
    const output = options.format === 'json'
      ? formatPayloadJson(payload)
      : formatDependencies(results, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });

  const analyzeTreeCmd = analyze.command('tree <className>').description('Show class/interface inheritance relationships');
  addSharedOptions(analyzeTreeCmd, { includeFile: true });
  analyzeTreeCmd.action(async (className: string, _options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const index = await withIndex(options);
    const results = analyzeTree(index, className, options.file);
    const payload = createPayload(index, { command: 'code.analyze.tree', value: className, file: options.file }, results);
    const output = options.format === 'json'
      ? formatPayloadJson(payload)
      : formatClassTree(results, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });

  const findFusedCmd = find.command('fused <query>').description('Fused search: combines name, pattern, and content search with rank fusion');
  addSharedOptions(findFusedCmd, { includeLimit: true });
  findFusedCmd.option('--weights <spec>', 'weights as name:N,pattern:N,content:N', 'name:3,pattern:2,content:1');
  findFusedCmd.action(async (query: string, _options: CodeCommandOptions, command: Command) => {
    const options = getOptions(command);
    const index = await withIndex(options);
    const weightsStr = (options as Record<string, string>).weights ?? 'name:3,pattern:2,content:1';
    const weights: Record<string, number> = {};
    for (const pair of weightsStr.split(',')) {
      const [key, val] = pair.split(':');
      if (key && val) weights[key.trim()] = parseFloat(val);
    }
    const results = fusedSearch(index, query, {
      weights: { name: weights.name, pattern: weights.pattern, content: weights.content },
      limit: parsePositiveInt(options.limit, 50, 'limit'),
    });
    const payload = createPayload(index, { command: 'code.find.fused', value: query, weights }, results);
    const output = options.format === 'json'
      ? formatPayloadJson(payload)
      : formatFusedResults(results, options.ci);
    await emit(output.endsWith('\n') ? output : `${output}\n`, options);
  });
}
