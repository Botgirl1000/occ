import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildCodebaseIndex } from '../src/code/build.js';
import { formatChains, formatDependencies, formatPayloadJson, formatRelationResults } from '../src/code/output.js';
import {
  analyzeCallChain,
  analyzeCallers,
  analyzeCalls,
  analyzeDeps,
  analyzeTree,
  createPayload,
  findByName,
  findContent,
} from '../src/code/query.js';
const fixtureRoot = path.resolve('test/fixtures/code-explore');

test('buildCodebaseIndex indexes JS/TS and Python fixtures', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });

  assert.equal(index.files.length, 17);
  assert.deepEqual(Object.keys(index.capabilities).sort(), ['python', 'typescript']);
  assert.equal(index.capabilities.typescript.calls, true);
  assert.equal(index.capabilities.python.inheritance, true);
});

test('findByName returns expected class symbol', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = findByName(index, 'UserService', 'class');

  assert.equal(results.length, 1);
  assert.equal(results[0]?.node.relativePath, 'src/service.ts');
  assert.equal(results[0]?.node.line, 9);
});

test('findContent finds python source matches', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = findContent(index, 'normalize_name');

  assert.equal(results.length, 5);
  assert.deepEqual(results.map(result => `${result.relativePath}:${result.line}`), [
    'python/consumer.py:1',
    'python/deps.py:2',
    'python/deps.py:8',
    'python/helpers.py:1',
    'python/helpers.py:7',
  ]);
});

test('analyzeCalls resolves outgoing call from bootstrap', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeCalls(index, 'bootstrap');

  assert.equal(results.length, 1);
  assert.equal(results[0]?.to?.name, 'createUser');
  assert.equal(results[0]?.edge.status, 'resolved');
});

test('analyzeCallers resolves incoming call to createUser', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeCallers(index, 'createUser');

  assert.equal(results.length, 1);
  assert.equal(results[0]?.from.name, 'bootstrap');
  assert.equal(results[0]?.from.relativePath, 'src/main.ts');
});

test('analyzeCallChain finds bootstrap to formatName path', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeCallChain(index, 'bootstrap', 'formatName', 5);

  assert.equal(results.length, 1);
  assert.deepEqual(results[0]?.nodes.map(node => node.name), ['bootstrap', 'createUser', 'saveUser', 'formatName']);
});

test('analyzeCallChain finds path when arguments are in reverse call order', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeCallChain(index, 'formatName', 'bootstrap', 5);

  assert.equal(results.length, 1);
  assert.equal(results[0]?.status, 'resolved');
  assert.deepEqual(results[0]?.nodes.map(node => node.name), ['bootstrap', 'createUser', 'saveUser', 'formatName']);
});

test('analyzeDeps reports importers and imports for service module', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeDeps(index, 'src/service');

  assert.equal(results.targetFile?.relativePath, 'src/service.ts');
  assert.deepEqual(results.importers.map(item => item.from.relativePath), ['src/main.ts']);
  assert.deepEqual(results.localImports.map(item => item.to?.name ?? item.edge.targetName), ['src/utils']);
  assert.equal(results.externalImports.length, 0);
  assert.equal(results.unresolvedImports.length, 0);
});

test('analyzeTree reports inheritance and methods for UserService', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeTree(index, 'UserService');

  assert(results);
  assert.equal(results.target.relativePath, 'src/service.ts');
  assert.deepEqual(results.parents.map(item => item.to?.name ?? item.edge.targetName), ['BaseService']);
  assert.deepEqual(results.methods.map(method => method.name), ['createUser']);
});

test('JSON payload envelope stays stable for code queries', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = findByName(index, 'Greeter', 'class');
  const payload = JSON.parse(formatPayloadJson(createPayload(index, {
    command: 'code.find.name',
    value: 'Greeter',
  }, results))) as {
    repo: string;
    query: { command: string; value: string };
    results: Array<{ node: { name: string; relativePath: string; language: string } }>;
    stats: { filesIndexed: number };
    capabilities: Record<string, unknown>;
  };

  assert.equal(payload.repo, fixtureRoot);
  assert.equal(payload.query.command, 'code.find.name');
  assert.equal(payload.query.value, 'Greeter');
  assert.equal(payload.stats.filesIndexed, 17);
  assert.equal(payload.results[0]?.node.name, 'Greeter');
  assert.equal(payload.results[0]?.node.relativePath, 'python/helpers.py');
  assert.equal(payload.results[0]?.node.language, 'python');
  assert.ok('python' in payload.capabilities);
  assert.ok('typescript' in payload.capabilities);
});

test('analyzeCalls resolves imported alias in TypeScript', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeCalls(index, 'aliasBootstrap');

  assert.equal(results.length, 1);
  assert.equal(results[0]?.to?.name, 'saveUser');
  assert.equal(results[0]?.to?.relativePath, 'src/utils.ts');
  assert.equal(results[0]?.edge.status, 'resolved');
});

test('analyzeCalls resolves this and super method dispatch', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const runCalls = analyzeCalls(index, 'run', 'src/runner.ts');
  const runAgainCalls = analyzeCalls(index, 'runAgain', 'src/runner.ts');

  assert.equal(runCalls.length, 1);
  assert.equal(runCalls[0]?.to?.name, 'finish');
  assert.equal(runCalls[0]?.to?.relativePath, 'src/runner.ts');
  assert.equal(runCalls[0]?.edge.detail, 'this');

  assert.equal(runAgainCalls.length, 1);
  assert.equal(runAgainCalls[0]?.to?.name, 'finish');
  assert.equal(runAgainCalls[0]?.to?.relativePath, 'src/runner.ts');
  assert.equal(runAgainCalls[0]?.edge.detail, 'super');
});

test('analyzeCalls resolves python self method dispatch and aliased imports', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const shoutCalls = analyzeCalls(index, 'shout');
  const slugCalls = analyzeCalls(index, 'make_slug');

  assert.equal(shoutCalls.length, 2);
  assert.deepEqual(shoutCalls.map(item => item.to?.name ?? item.edge.targetName), ['greet', 'upper']);
  const greetCall = shoutCalls.find(item => item.edge.targetName === 'greet');
  assert.equal(greetCall?.to?.relativePath, 'python/helpers.py');
  assert.equal(greetCall?.edge.detail, 'self');
  assert.equal(greetCall?.edge.status, 'resolved');

  assert.equal(slugCalls.length, 1);
  assert.equal(slugCalls[0]?.to?.name, 'normalize_name');
  assert.equal(slugCalls[0]?.to?.relativePath, 'python/helpers.py');
  assert.equal(slugCalls[0]?.edge.status, 'resolved');
});

test('receiver-qualified calls stay resolved even when other classes share the same method name', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeCalls(index, 'run', 'src/other-runner.ts');

  assert.equal(results.length, 1);
  assert.equal(results[0]?.to?.name, 'finish');
  assert.equal(results[0]?.to?.relativePath, 'src/other-runner.ts');
  assert.equal(results[0]?.edge.status, 'resolved');
  assert.equal(results[0]?.edge.detail, 'this');
});

test('unqualified TypeScript calls become ambiguous when multiple matching definitions exist', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeCalls(index, 'ambiguousCaller');

  assert.equal(results.length, 1);
  assert.equal(results[0]?.edge.targetName, 'duplicate');
  assert.equal(results[0]?.edge.status, 'ambiguous');
  assert.equal(results[0]?.to, undefined);
  assert.deepEqual(results[0]?.edge.candidates?.map(candidate => `${candidate.relativePath}:${candidate.line}`), [
    'src/duplicate-a.ts:1',
    'src/duplicate-b.ts:1',
  ]);
});

test('python self dispatch stays resolved while unqualified duplicate names become ambiguous', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const shoutCalls = analyzeCalls(index, 'shout');
  const repeatCalls = analyzeCalls(index, 'call_repeat');

  const greetCall = shoutCalls.find(item => item.edge.targetName === 'greet');
  assert.equal(greetCall?.to?.relativePath, 'python/helpers.py');
  assert.equal(greetCall?.edge.status, 'resolved');

  assert.equal(repeatCalls.length, 1);
  assert.equal(repeatCalls[0]?.edge.targetName, 'repeat');
  assert.equal(repeatCalls[0]?.edge.status, 'ambiguous');
  assert.equal(repeatCalls[0]?.to, undefined);
  assert.deepEqual(repeatCalls[0]?.edge.candidates?.map(candidate => `${candidate.relativePath}:${candidate.line}`), [
    'python/repeat_a.py:1',
    'python/repeat_b.py:1',
  ]);
});

test('ambiguous relation output includes candidate hints', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeCalls(index, 'ambiguousCaller');
  const output = formatRelationResults('Outgoing Calls: ambiguousCaller', 'Callee', results, true);

  assert.match(output, /ambiguous/);
  assert.match(output, /2 candidates:/);
  assert.match(output, /src\/duplicate-a\.ts:1/);
  assert.match(output, /src\/duplicate-b\.ts:1/);
});

test('analyzeCallChain reports blocked ambiguity when path search cannot continue', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeCallChain(index, 'ambiguousCaller', 'duplicate', 5);

  assert.equal(results.length, 1);
  assert.equal(results[0]?.status, 'blocked_ambiguous');
  assert.equal(results[0]?.blockedAt?.name, 'ambiguousCaller');
  assert.equal(results[0]?.blockedBy?.targetName, 'duplicate');
  assert.equal(results[0]?.blockedBy?.status, 'ambiguous');
  assert.deepEqual(results[0]?.blockedBy?.candidates?.map(candidate => `${candidate.relativePath}:${candidate.line}`), [
    'src/duplicate-a.ts:1',
    'src/duplicate-b.ts:1',
  ]);
});

test('blocked chain output explains the ambiguity', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeCallChain(index, 'ambiguousCaller', 'duplicate', 5);
  const output = formatChains(results, true);

  assert.match(output, /blocked by ambiguity/);
  assert.match(output, /blocked by ambiguous call "duplicate"/);
  assert.match(output, /src\/duplicate-a\.ts:1/);
  assert.match(output, /src\/duplicate-b\.ts:1/);
});

test('analyzeDeps separates local, external, and unresolved TypeScript imports', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeDeps(index, 'src/deps');

  assert.equal(results.targetFile?.relativePath, 'src/deps.ts');
  assert.deepEqual(results.localImports.map(item => item.to?.name ?? item.edge.targetName), ['src/utils']);
  assert.deepEqual(results.externalImports.map(item => item.to?.name ?? item.edge.targetName), ['node:path']);
  assert.deepEqual(results.unresolvedImports.map(item => item.edge.targetName), ['./missing']);
});

test('analyzeDeps separates local, external, and unresolved Python imports', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeDeps(index, 'python/deps');

  assert.equal(results.targetFile?.relativePath, 'python/deps.py');
  assert.deepEqual(results.localImports.map(item => item.to?.name ?? item.edge.targetName), ['python/helpers']);
  assert.deepEqual(results.externalImports.map(item => item.to?.name ?? item.edge.targetName), ['json']);
  assert.deepEqual(results.unresolvedImports.map(item => item.edge.targetName), ['missing_module']);
});

test('dependency output shows explicit import categories', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeDeps(index, 'src/deps');
  const output = formatDependencies(results, true);

  assert.match(output, /Local Imports/);
  assert.match(output, /External Imports/);
  assert.match(output, /Unresolved Imports/);
  assert.match(output, /src\/utils/);
  assert.match(output, /node:path/);
  assert.match(output, /\.\/missing/);
});
