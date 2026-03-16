import path from 'node:path';
import { normalizePath } from './languages.js';
import type {
  CallChain,
  ClassTreeAnalysis,
  CodebaseIndex,
  CodeCommandPayload,
  CodeEdge,
  CodeNode,
  CodeNodeType,
  CodeSearchResult,
  ContentMatch,
  DependencyAnalysis,
  ParsedFile,
  RelationMatch,
} from './types.js';

function resolveFileFilter(repoRoot: string, file?: string): string | undefined {
  if (!file) return undefined;
  return path.isAbsolute(file) ? path.normalize(file) : path.resolve(repoRoot, file);
}

function matchesFile(node: CodeNode, filePath?: string): boolean {
  return !filePath || path.normalize(node.path) === path.normalize(filePath);
}

function compareNodes(a: CodeNode, b: CodeNode): number {
  if (a.path !== b.path) return a.path.localeCompare(b.path);
  return (a.line ?? 0) - (b.line ?? 0);
}

export function createPayload(index: CodebaseIndex, query: Record<string, unknown>, results: unknown): CodeCommandPayload {
  return {
    repo: index.repoRoot,
    query,
    results,
    stats: {
      filesIndexed: index.files.length,
      nodes: index.nodes.length,
      edges: index.edges.length,
    },
    capabilities: index.capabilities,
  };
}

export function findByName(index: CodebaseIndex, name: string, type?: CodeNodeType, file?: string, limit = 20): CodeSearchResult[] {
  const fileFilter = resolveFileFilter(index.repoRoot, file);
  return index.nodes
    .filter(node => node.name === name)
    .filter(node => !type || node.type === type)
    .filter(node => matchesFile(node, fileFilter))
    .sort(compareNodes)
    .slice(0, limit)
    .map(node => ({ node }));
}

export function findByPattern(index: CodebaseIndex, pattern: string, type?: CodeNodeType, limit = 50): CodeSearchResult[] {
  const lowered = pattern.toLowerCase();
  return index.nodes
    .filter(node => node.name.toLowerCase().includes(lowered))
    .filter(node => !type || node.type === type)
    .sort(compareNodes)
    .slice(0, limit)
    .map(node => ({ node }));
}

export function findByType(index: CodebaseIndex, type: CodeNodeType, limit = 50): CodeSearchResult[] {
  return index.nodes
    .filter(node => node.type === type)
    .sort(compareNodes)
    .slice(0, limit)
    .map(node => ({ node }));
}

export function findContent(index: CodebaseIndex, text: string, limit = 50): ContentMatch[] {
  const lowered = text.toLowerCase();
  const matches: ContentMatch[] = [];
  for (const file of index.files) {
    for (let indexLine = 0; indexLine < file.lines.length; indexLine++) {
      const line = file.lines[indexLine];
      if (!line.toLowerCase().includes(lowered)) continue;
      matches.push({
        path: file.path,
        relativePath: normalizePath(path.relative(index.repoRoot, file.path)),
        language: file.language,
        line: indexLine + 1,
        snippet: line.trim(),
      });
      if (matches.length >= limit) return matches;
    }
  }
  return matches;
}

function nodeById(index: CodebaseIndex): Map<string, CodeNode> {
  return new Map(index.nodes.map(node => [node.id, node]));
}

function outgoingEdges(index: CodebaseIndex, type: CodeEdge['type'], nodeId: string): CodeEdge[] {
  return index.edges.filter(edge => edge.type === type && edge.from === nodeId);
}

function incomingEdges(index: CodebaseIndex, type: CodeEdge['type'], nodeId: string): CodeEdge[] {
  return index.edges.filter(edge => edge.type === type && edge.to === nodeId);
}

function resolveFunctionNodes(index: CodebaseIndex, name: string, file?: string): CodeNode[] {
  const fileFilter = resolveFileFilter(index.repoRoot, file);
  return index.nodes
    .filter(node => node.type === 'function' && node.name === name)
    .filter(node => matchesFile(node, fileFilter))
    .sort(compareNodes);
}

const CLASS_LIKE_TYPES: Set<CodeNodeType> = new Set(['class', 'interface', 'enum']);

function resolveClassNodes(index: CodebaseIndex, name: string, file?: string): CodeNode[] {
  const fileFilter = resolveFileFilter(index.repoRoot, file);
  const matches = index.nodes
    .filter(node => CLASS_LIKE_TYPES.has(node.type) && node.name === name)
    .filter(node => matchesFile(node, fileFilter))
    .sort(compareNodes);
  if (fileFilter) return matches;

  const classes = matches.filter(node => node.type === 'class');
  if (classes.length > 0) return classes;

  const interfaces = matches.filter(node => node.type === 'interface');
  if (interfaces.length > 0) return interfaces;

  return matches;
}

export function analyzeCalls(index: CodebaseIndex, functionName: string, file?: string): RelationMatch[] {
  const byId = nodeById(index);
  const matches: RelationMatch[] = [];
  for (const node of resolveFunctionNodes(index, functionName, file)) {
    for (const edge of outgoingEdges(index, 'calls', node.id)) {
      matches.push({ from: node, edge, to: edge.to ? byId.get(edge.to) : undefined });
    }
  }
  return matches.sort((a, b) => (a.edge.line ?? 0) - (b.edge.line ?? 0));
}

export function analyzeCallers(index: CodebaseIndex, functionName: string, file?: string): RelationMatch[] {
  const byId = nodeById(index);
  const matches: RelationMatch[] = [];
  for (const node of resolveFunctionNodes(index, functionName, file)) {
    for (const edge of incomingEdges(index, 'calls', node.id)) {
      const from = byId.get(edge.from);
      if (from) matches.push({ from, edge, to: node });
    }
  }
  return matches.sort((a, b) => (a.from.path !== b.from.path ? a.from.path.localeCompare(b.from.path) : (a.from.line ?? 0) - (b.from.line ?? 0)));
}

function searchCallChain(index: CodebaseIndex, starts: CodeNode[], targetIds: Set<string>, depth: number): { chains: CallChain[]; blocked: CallChain[] } {
  const byId = nodeById(index);
  const chains: CallChain[] = [];
  const blocked = new Map<string, CallChain>();

  for (const start of starts) {
    const queue: Array<{ node: CodeNode; pathNodes: CodeNode[]; pathEdges: CodeEdge[] }> = [{ node: start, pathNodes: [start], pathEdges: [] }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (current.pathEdges.length >= depth) continue;

      for (const edge of outgoingEdges(index, 'calls', current.node.id)) {
        if (edge.status === 'ambiguous') {
          const key = [
            current.pathNodes.map(node => node.id).join('>'),
            edge.id,
          ].join('|');
          if (!blocked.has(key)) {
            blocked.set(key, {
              nodes: [...current.pathNodes],
              edges: [...current.pathEdges],
              status: 'blocked_ambiguous',
              blockedAt: current.node,
              blockedBy: edge,
            });
          }
          continue;
        }
        if (!edge.to) continue;
        const next = byId.get(edge.to);
        if (!next || current.pathNodes.some(node => node.id === next.id)) continue;
        const nextNodes = [...current.pathNodes, next];
        const nextEdges = [...current.pathEdges, edge];
        if (targetIds.has(next.id)) {
          chains.push({ nodes: nextNodes, edges: nextEdges, status: 'resolved' });
          continue;
        }
        queue.push({ node: next, pathNodes: nextNodes, pathEdges: nextEdges });
      }
    }
  }

  return {
    chains: chains.sort((a, b) => a.edges.length - b.edges.length),
    blocked: [...blocked.values()].sort((a, b) => a.nodes.length - b.nodes.length),
  };
}

function markDirection(chains: CallChain[], direction: CallChain['direction']): CallChain[] {
  return chains.map(chain => ({ ...chain, direction }));
}

export function analyzeCallChain(index: CodebaseIndex, fromName: string, toName: string, depth = 5, fromFile?: string, toFile?: string): CallChain[] {
  const fromNodes = resolveFunctionNodes(index, fromName, fromFile);
  const toNodes = resolveFunctionNodes(index, toName, toFile);
  const fromIds = new Set(fromNodes.map(node => node.id));
  const toIds = new Set(toNodes.map(node => node.id));

  const forward = searchCallChain(index, fromNodes, toIds, depth);
  if (forward.chains.length > 0) {
    return [...markDirection(forward.chains, 'forward'), ...markDirection(forward.blocked, 'forward')].slice(0, 20);
  }

  const reverse = searchCallChain(index, toNodes, fromIds, depth);
  if (reverse.chains.length > 0) {
    return markDirection(reverse.chains, 'reverse').slice(0, 20);
  }

  return markDirection(forward.blocked, 'forward').slice(0, 20);
}

export function analyzeDeps(index: CodebaseIndex, target: string): DependencyAnalysis {
  const byId = nodeById(index);
  const normalizedTarget = normalizePath(target.replace(/\\/g, '/'));
  const localFile = index.nodes.find(node =>
    node.type === 'file' &&
    (node.path === target || node.relativePath === normalizedTarget || node.name === target || node.moduleName === target)
  );
  const moduleCandidates = index.nodes.filter(node => node.type === 'module' && (node.name === target || node.path === target || node.relativePath === normalizedTarget));
  const targetPaths = new Set<string>();
  if (localFile) targetPaths.add(localFile.path);
  for (const node of moduleCandidates) targetPaths.add(node.path);

  const isDirectory = !localFile && targetPaths.size === 0;
  const dirPrefix = isDirectory ? (normalizedTarget.endsWith('/') ? normalizedTarget : `${normalizedTarget}/`) : undefined;
  if (isDirectory) {
    for (const node of index.nodes) {
      if (node.type === 'file' && node.relativePath?.startsWith(dirPrefix!)) {
        targetPaths.add(node.path);
      }
    }
  }

  const importers: RelationMatch[] = [];
  const localImports: RelationMatch[] = [];
  const externalImports: RelationMatch[] = [];
  const unresolvedImports: RelationMatch[] = [];

  for (const edge of index.edges.filter(edge => edge.type === 'imports')) {
    const from = byId.get(edge.from);
    const to = edge.to ? byId.get(edge.to) : undefined;
    const fromInside = from != null && targetPaths.has(from.path);
    const toInside = to != null && targetPaths.has(to.path);

    if (isDirectory) {
      if (!fromInside && toInside && from) {
        importers.push({ from, edge, to });
      }
      if (fromInside) {
        const match = { from: from!, edge, to };
        if (edge.importKind === 'external') {
          externalImports.push(match);
        } else if (edge.importKind === 'local' && !toInside) {
          localImports.push(match);
        } else if (edge.status === 'unresolved') {
          unresolvedImports.push(match);
        }
      }
    } else {
      if (to && (to.name === target || targetPaths.has(to.path))) {
        if (from) importers.push({ from, edge, to });
      }
      if (from && localFile && from.path === localFile.path) {
        const match = { from, edge, to };
        if (edge.importKind === 'local') {
          localImports.push(match);
        } else if (edge.importKind === 'external') {
          externalImports.push(match);
        } else {
          unresolvedImports.push(match);
        }
      }
    }
  }

  return {
    target,
    targetFile: localFile,
    importers,
    localImports,
    externalImports,
    unresolvedImports,
  };
}

export function analyzeTree(index: CodebaseIndex, className: string, file?: string): ClassTreeAnalysis | null {
  const byId = nodeById(index);
  const target = resolveClassNodes(index, className, file)[0];
  if (!target) return null;

  const parents = [
    ...outgoingEdges(index, 'inherits', target.id),
    ...outgoingEdges(index, 'implements', target.id),
  ].map(edge => ({ from: target, edge, to: edge.to ? byId.get(edge.to) : undefined }));
  const children: RelationMatch[] = [];
  for (const edge of [...incomingEdges(index, 'inherits', target.id), ...incomingEdges(index, 'implements', target.id)]) {
    const from = byId.get(edge.from);
    if (from) children.push({ from, edge, to: target });
  }
  const methods = index.nodes
    .filter(node => node.type === 'function' && node.containerName === target.name && node.path === target.path)
    .sort(compareNodes);

  return { target, parents, children, methods };
}

export interface ModuleCoupling {
  module: string;
  publicSymbolCount: number;
  afferentCoupling: number;
  efferentCoupling: number;
  instability: number;
  topImporters: string[];
  topDependencies: string[];
  keyClasses: Array<{
    name: string;
    parents: string[];
    childCount: number;
    methodCount: number;
  }>;
}

export function analyzeModuleCoupling(index: CodebaseIndex, modulePath: string): ModuleCoupling {
  const normalizedModule = normalizePath(modulePath.replace(/\\/g, '/'));
  const dirPrefix = normalizedModule.endsWith('/') ? normalizedModule : `${normalizedModule}/`;

  // Find all files belonging to this module
  const moduleFilePaths = new Set<string>();
  for (const node of index.nodes) {
    if (node.type === 'file' && node.relativePath?.startsWith(dirPrefix)) {
      moduleFilePaths.add(node.path);
    }
  }

  // Count public symbols (exported)
  let publicSymbolCount = 0;
  for (const file of index.files) {
    if (!moduleFilePaths.has(file.path)) continue;
    for (const sym of file.symbols) {
      if (sym.exported) publicSymbolCount++;
    }
  }

  // Afferent coupling: external modules that import from this module
  const importerModules = new Set<string>();
  const importerDetails: string[] = [];
  // Efferent coupling: external modules this module imports from
  const dependencyModules = new Set<string>();
  const dependencyDetails: string[] = [];

  for (const edge of index.edges) {
    if (edge.type !== 'imports') continue;
    const fromFile = index.nodes.find(n => n.id === edge.from);
    const toFile = edge.to ? index.nodes.find(n => n.id === edge.to) : undefined;
    if (!fromFile) continue;

    const fromInside = moduleFilePaths.has(fromFile.path);
    const toInside = toFile ? moduleFilePaths.has(toFile.path) : false;

    if (!fromInside && toInside) {
      // External file imports from our module
      const fromModule = fromFile.relativePath?.split('/').slice(0, -1).join('/') ?? '';
      if (!importerModules.has(fromModule)) {
        importerModules.add(fromModule);
        importerDetails.push(fromModule || (fromFile.relativePath ?? fromFile.name));
      }
    }

    if (fromInside && !toInside && toFile && edge.importKind !== 'external') {
      // Our module imports from external internal module
      const toModule = toFile.relativePath?.split('/').slice(0, -1).join('/') ?? '';
      if (!dependencyModules.has(toModule)) {
        dependencyModules.add(toModule);
        dependencyDetails.push(toModule || (toFile.relativePath ?? toFile.name));
      }
    }
  }

  const ca = importerModules.size;
  const ce = dependencyModules.size;
  const instability = ca + ce > 0 ? ce / (ca + ce) : 0;

  // Key classes
  const classNodes = index.nodes.filter(
    n => n.type === 'class' && moduleFilePaths.has(n.path),
  );
  const keyClasses = classNodes.map(classNode => {
    const tree = analyzeTree(index, classNode.name, classNode.relativePath);
    return {
      name: classNode.name,
      parents: tree?.parents.map(p => p.to?.name ?? p.edge.targetName ?? '') ?? [],
      childCount: tree?.children.length ?? 0,
      methodCount: tree?.methods.length ?? 0,
    };
  });

  return {
    module: modulePath,
    publicSymbolCount,
    afferentCoupling: ca,
    efferentCoupling: ce,
    instability: Math.round(instability * 1000) / 1000,
    topImporters: importerDetails.slice(0, 10),
    topDependencies: dependencyDetails.slice(0, 10),
    keyClasses: keyClasses.sort((a, b) => (b.methodCount + b.childCount) - (a.methodCount + a.childCount)).slice(0, 10),
  };
}

export interface FusedSearchResult {
  nodeId: string;
  path: string;
  relativePath?: string;
  name: string;
  type: CodeNodeType;
  line?: number;
  score: number;
  sources: Array<{ method: string; rank: number }>;
}

export interface FusedSearchOptions {
  weights?: { name?: number; pattern?: number; content?: number };
  limit?: number;
}

/** Fused search: runs name, pattern, and content search, merges via Reciprocal Rank Fusion */
export function fusedSearch(index: CodebaseIndex, query: string, options: FusedSearchOptions = {}): FusedSearchResult[] {
  const { weights = {}, limit = 50 } = options;
  const nameWeight = weights.name ?? 3;
  const patternWeight = weights.pattern ?? 2;
  const contentWeight = weights.content ?? 1;
  const RRF_K = 60;

  // Run all three searches
  const nameResults = findByName(index, query, undefined, undefined, 100);
  const patternResults = findByPattern(index, query, undefined, 200);
  const contentResults = findContent(index, query, 200);

  // Build fused scores by node identity
  const scores = new Map<string, FusedSearchResult>();

  function ensureEntry(key: string, node: CodeNode | { path: string; relativePath?: string; name: string; type: string; line?: number }): FusedSearchResult {
    let entry = scores.get(key);
    if (!entry) {
      entry = {
        nodeId: key,
        path: 'path' in node ? node.path : '',
        relativePath: 'relativePath' in node ? node.relativePath : undefined,
        name: node.name,
        type: (node.type as CodeNodeType) ?? 'function',
        line: 'line' in node ? node.line : undefined,
        score: 0,
        sources: [],
      };
      scores.set(key, entry);
    }
    return entry;
  }

  // Name results — weight by rank
  for (let i = 0; i < nameResults.length; i++) {
    const r = nameResults[i];
    const key = r.node.id;
    const entry = ensureEntry(key, r.node);
    entry.score += nameWeight / (RRF_K + i + 1);
    entry.sources.push({ method: 'name', rank: i + 1 });
  }

  // Pattern results — weight by rank
  for (let i = 0; i < patternResults.length; i++) {
    const r = patternResults[i];
    const key = r.node.id;
    const entry = ensureEntry(key, r.node);
    entry.score += patternWeight / (RRF_K + i + 1);
    entry.sources.push({ method: 'pattern', rank: i + 1 });
  }

  // Content results — use file:line as key since these aren't nodes
  for (let i = 0; i < contentResults.length; i++) {
    const r = contentResults[i];
    const key = `content:${r.path}:${r.line}`;
    const entry = ensureEntry(key, {
      path: r.path,
      relativePath: r.relativePath,
      name: r.snippet.slice(0, 60),
      type: 'variable',
      line: r.line,
    });
    entry.score += contentWeight / (RRF_K + i + 1);
    entry.sources.push({ method: 'content', rank: i + 1 });
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export interface KeySection {
  content: string;
  startLine: number;
  endLine: number;
  reason: string;
}

/** Select the most architecturally significant portion of a file */
export function extractKeySection(file: ParsedFile, maxChars: number): KeySection {
  const lines = file.lines;
  const totalContent = file.content;

  if (totalContent.length <= maxChars) {
    return { content: totalContent, startLine: 1, endLine: lines.length, reason: 'full file' };
  }

  // Prioritize: exported class definitions > exported functions > public API surface > file start
  const exportedSymbols = file.symbols.filter(s => s.exported);
  const exportedClasses = exportedSymbols.filter(s => s.type === 'class');
  const exportedFunctions = exportedSymbols.filter(s => s.type === 'function' && !s.containerName);

  // Try exported class first (including its methods)
  if (exportedClasses.length > 0) {
    const cls = exportedClasses[0];
    const section = extractSymbolRegion(lines, cls.line - 1, maxChars);
    if (section) return { ...section, reason: `exported class ${cls.name}` };
  }

  // Try exported functions
  if (exportedFunctions.length > 0) {
    const startLine = exportedFunctions[0].line - 1;
    const section = extractSymbolRegion(lines, startLine, maxChars);
    if (section) return { ...section, reason: `exported functions starting at ${exportedFunctions[0].name}` };
  }

  // Try all exported symbols
  if (exportedSymbols.length > 0) {
    const startLine = exportedSymbols[0].line - 1;
    const section = extractSymbolRegion(lines, startLine, maxChars);
    if (section) return { ...section, reason: 'public API surface' };
  }

  // Fallback: first maxChars of file
  return extractFromStart(lines, maxChars);
}

function extractSymbolRegion(lines: string[], startLineIdx: number, maxChars: number): { content: string; startLine: number; endLine: number } | null {
  // Include a few lines before for context (imports/JSDoc)
  const contextStart = Math.max(0, startLineIdx - 3);
  let chars = 0;
  let endIdx = contextStart;

  for (let i = contextStart; i < lines.length; i++) {
    chars += lines[i].length + 1;
    endIdx = i;
    if (chars >= maxChars) break;
  }

  const content = lines.slice(contextStart, endIdx + 1).join('\n');
  return { content, startLine: contextStart + 1, endLine: endIdx + 1 };
}

function extractFromStart(lines: string[], maxChars: number): KeySection {
  let chars = 0;
  let endIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    chars += lines[i].length + 1;
    endIdx = i;
    if (chars >= maxChars) break;
  }

  return {
    content: lines.slice(0, endIdx + 1).join('\n'),
    startLine: 1,
    endLine: endIdx + 1,
    reason: 'file start',
  };
}
