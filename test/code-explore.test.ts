import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
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
  findByType,
  findContent,
} from '../src/code/query.js';
const fixtureRoot = path.resolve('test/fixtures/code-explore');

test('buildCodebaseIndex indexes JS/TS and Python fixtures', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });

  assert.equal(index.files.length, 18);
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
  assert.equal(payload.stats.filesIndexed, 18);
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

test('findByName indexes TypeScript interfaces, type aliases, and enums', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });

  const iface = findByName(index, 'Serializable');
  assert.equal(iface.length, 1);
  assert.equal(iface[0]?.node.type, 'interface');
  assert.equal(iface[0]?.node.relativePath, 'src/types.ts');

  const alias = findByName(index, 'UserId');
  assert.equal(alias.length, 1);
  assert.equal(alias[0]?.node.type, 'type-alias');

  const enumResult = findByName(index, 'Status');
  assert.equal(enumResult.length, 1);
  assert.equal(enumResult[0]?.node.type, 'enum');

  const allInterfaces = findByType(index, 'interface');
  assert.deepEqual(allInterfaces.map(r => r.node.name).sort(), ['Loggable', 'Serializable']);
});

test('analyzeTree shows interface extends interface', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });
  const results = analyzeTree(index, 'Loggable');

  assert(results);
  assert.equal(results.target.type, 'interface');
  assert.deepEqual(results.parents.map(p => p.to?.name ?? p.edge.targetName), ['Serializable']);
  assert.equal(results.parents[0]?.edge.type, 'inherits');
});

test('analyzeTree shows implements relationship from both directions', async () => {
  const index = await buildCodebaseIndex({ repoRoot: fixtureRoot });

  const classTree = analyzeTree(index, 'UserStore');
  assert(classTree);
  assert.equal(classTree.target.type, 'class');
  assert.deepEqual(classTree.parents.map(p => p.to?.name ?? p.edge.targetName), ['Loggable']);
  assert.equal(classTree.parents[0]?.edge.type, 'implements');
  assert.equal(classTree.parents[0]?.edge.status, 'resolved');

  const ifaceTree = analyzeTree(index, 'Loggable');
  assert(ifaceTree);
  assert.equal(ifaceTree.children.length, 1);
  assert.equal(ifaceTree.children[0]?.from.name, 'UserStore');
  assert.equal(ifaceTree.children[0]?.edge.type, 'implements');
});

test('inheritance resolution stays specific to classes when interfaces share the same name', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'occ-pr2-'));
  await mkdir(path.join(repoRoot, 'src'));
  await writeFile(path.join(repoRoot, 'src/base.ts'), 'export class Foo {}\n');
  await writeFile(path.join(repoRoot, 'src/iface.ts'), 'export interface Foo { value: string }\n');
  await writeFile(path.join(repoRoot, 'src/child.ts'), 'export class Bar extends Foo {}\n');
  await writeFile(path.join(repoRoot, 'src/impl.ts'), 'export interface Contract {}\nexport class Contract {}\nexport class UsesContract implements Contract {}\n');

  const index = await buildCodebaseIndex({ repoRoot });
  const classTree = analyzeTree(index, 'Bar');
  const implTree = analyzeTree(index, 'UsesContract');

  assert(classTree);
  assert.equal(classTree.parents.length, 1);
  assert.equal(classTree.parents[0]?.edge.status, 'resolved');
  assert.equal(classTree.parents[0]?.to?.type, 'class');
  assert.equal(classTree.parents[0]?.to?.name, 'Foo');

  assert(implTree);
  assert.equal(implTree.parents.length, 1);
  assert.equal(implTree.parents[0]?.edge.status, 'resolved');
  assert.equal(implTree.parents[0]?.edge.type, 'implements');
  assert.equal(implTree.parents[0]?.to?.type, 'interface');
  assert.equal(implTree.parents[0]?.to?.name, 'Contract');
});

test('analyzeTree prefers classes on name collisions and still allows file disambiguation for interfaces', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'occ-pr2-'));
  await mkdir(path.join(repoRoot, 'src'));
  await writeFile(path.join(repoRoot, 'src/a.ts'), 'export interface Foo { value: string }\n');
  await writeFile(path.join(repoRoot, 'src/z.ts'), 'export class Foo {\n  bar() {}\n}\n');

  const index = await buildCodebaseIndex({ repoRoot });
  const classTree = analyzeTree(index, 'Foo');
  const interfaceTree = analyzeTree(index, 'Foo', 'src/a.ts');

  assert(classTree);
  assert.equal(classTree.target.type, 'class');
  assert.equal(classTree.target.relativePath, 'src/z.ts');
  assert.deepEqual(classTree.methods.map(method => method.name), ['bar']);

  assert(interfaceTree);
  assert.equal(interfaceTree.target.type, 'interface');
  assert.equal(interfaceTree.target.relativePath, 'src/a.ts');
});
