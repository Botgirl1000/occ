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

export function analyzeCallChain(index: CodebaseIndex, fromName: string, toName: string, depth = 5, fromFile?: string, toFile?: string): CallChain[] {
  const byId = nodeById(index);
  const starts = resolveFunctionNodes(index, fromName, fromFile);
  const targets = new Set(resolveFunctionNodes(index, toName, toFile).map(node => node.id));
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
        if (targets.has(next.id)) {
          chains.push({ nodes: nextNodes, edges: nextEdges, status: 'resolved' });
          continue;
        }
        queue.push({ node: next, pathNodes: nextNodes, pathEdges: nextEdges });
      }
    }
  }

  const resolvedChains = chains.sort((a, b) => a.edges.length - b.edges.length);
  const blockedChains = [...blocked.values()].sort((a, b) => a.nodes.length - b.nodes.length);
  return [...resolvedChains, ...blockedChains].slice(0, 20);
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

  const importers: RelationMatch[] = [];
  const localImports: RelationMatch[] = [];
  const externalImports: RelationMatch[] = [];
  const unresolvedImports: RelationMatch[] = [];

  for (const edge of index.edges.filter(edge => edge.type === 'imports')) {
    const from = byId.get(edge.from);
    const to = edge.to ? byId.get(edge.to) : undefined;
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
