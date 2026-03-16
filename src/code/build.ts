import path from 'node:path';
import { z } from 'zod';
import { discoverCodeFiles } from './discover.js';
import { getLanguageSpec, getModuleName, normalizePath } from './languages.js';
import { parseCodeFile } from './parsers.js';
import type { CodeCapabilities, CodebaseIndex, CodeEdge, CodeNode, ParsedFile } from './types.js';
import type { OnProgress } from '../progress-event.js';

export const BuildCodebaseOptionsSchema = z.object({
  repoRoot: z.string(),
  excludeDir: z.array(z.string()).optional(),
  noGitignore: z.boolean().optional(),
});
export type BuildCodebaseOptions = z.infer<typeof BuildCodebaseOptionsSchema>;

function makeId(prefix: string, ...parts: Array<string | number | undefined>): string {
  return [prefix, ...parts.filter((part): part is string | number => part != null)].join(':');
}

function mergeCapabilities(files: ParsedFile[]): Record<string, CodeCapabilities> {
  const capabilities: Record<string, CodeCapabilities> = {};
  for (const file of files) {
    const spec = getLanguageSpec(file.path);
    if (!spec) continue;
    capabilities[spec.name] = spec.capabilities;
  }
  return capabilities;
}

function toCandidates(nodes: CodeNode[] | undefined): CodeEdge['candidates'] {
  if (!nodes || nodes.length === 0) return undefined;
  return nodes.map(node => ({
    name: node.name,
    relativePath: node.relativePath,
    line: node.line,
  }));
}

export async function buildCodebaseIndex(options: BuildCodebaseOptions, onProgress?: OnProgress): Promise<CodebaseIndex> {
  const repoRoot = path.resolve(options.repoRoot);
  const discovered = await discoverCodeFiles(repoRoot, {
    excludeDir: options.excludeDir,
    noGitignore: options.noGitignore,
  });

  onProgress?.({ phase: 'discover', total: discovered.length, completed: discovered.length, detail: 'File discovery complete' });

  const parsedFiles: ParsedFile[] = [];
  for (let i = 0; i < discovered.length; i++) {
    const filePath = discovered[i];
    const parsed = await parseCodeFile(filePath, { repoRoot });
    if (parsed) parsedFiles.push(parsed);
    onProgress?.({ phase: 'parse', total: discovered.length, completed: i + 1, detail: filePath });
  }

  const nodes: CodeNode[] = [];
  const edges: CodeEdge[] = [];
  const functionsByName = new Map<string, CodeNode[]>();
  const classNodesByName = new Map<string, CodeNode[]>();
  const interfaceNodesByName = new Map<string, CodeNode[]>();
  const filesByPath = new Map<string, CodeNode>();
  const modulesByName = new Map<string, CodeNode[]>();
  const topLevelSymbolsByFile = new Map<string, Map<string, CodeNode[]>>();
  const allPaths = new Set(parsedFiles.map(file => file.path));
  const moduleNodeByPath = new Map<string, CodeNode>();
  const symbolByIdentity = new Map<string, CodeNode>();
  const classByFileAndName = new Map<string, CodeNode>();
  const methodNodesByClassId = new Map<string, CodeNode[]>();
  const parentNamesByClassId = new Map<string, string[]>();

  const classKey = (filePath: string, className: string) => `${filePath}::${className}`;

  for (const file of parsedFiles) {
    const fileNode: CodeNode = {
      id: makeId('file', file.path),
      type: 'file',
      name: path.basename(file.path),
      path: file.path,
      relativePath: file.relativePath,
      line: 1,
      language: file.language,
      moduleName: file.moduleName,
    };
    const moduleNode: CodeNode = {
      id: makeId('module', file.path),
      type: 'module',
      name: file.moduleName,
      path: file.path,
      relativePath: file.relativePath,
      line: 1,
      language: file.language,
      moduleName: file.moduleName,
    };

    nodes.push(fileNode, moduleNode);
    filesByPath.set(file.path, fileNode);
    moduleNodeByPath.set(file.path, moduleNode);
    modulesByName.set(file.moduleName, [...(modulesByName.get(file.moduleName) ?? []), moduleNode]);
    modulesByName.set(path.basename(file.moduleName), [...(modulesByName.get(path.basename(file.moduleName)) ?? []), moduleNode]);
    edges.push({
      id: makeId('contains', fileNode.id, moduleNode.id),
      type: 'contains',
      from: fileNode.id,
      to: moduleNode.id,
      fromPath: file.path,
      toPath: file.path,
      status: 'resolved',
      targetName: moduleNode.name,
    });

    const symbolIndex = new Map<string, CodeNode[]>();

    for (const symbol of file.symbols) {
      const containerId = symbol.containerName
        ? makeId('class', file.path, symbol.containerName, file.symbols.find(candidate => candidate.type === 'class' && candidate.name === symbol.containerName)?.line)
        : moduleNode.id;
      const node: CodeNode = {
        id: makeId(symbol.type, file.path, symbol.name, symbol.line, symbol.containerName),
        type: symbol.type,
        name: symbol.name,
        path: file.path,
        relativePath: file.relativePath,
        line: symbol.line,
        language: file.language,
        moduleName: file.moduleName,
        containerId,
        containerName: symbol.containerName,
        signature: symbol.signature,
      };
      nodes.push(node);
      symbolByIdentity.set(makeId(symbol.type, file.path, symbol.name, symbol.line, symbol.containerName), node);
      symbolIndex.set(symbol.name, [...(symbolIndex.get(symbol.name) ?? []), node]);
      edges.push({
        id: makeId('contains', containerId, node.id),
        type: 'contains',
        from: containerId,
        to: node.id,
        fromPath: file.path,
        toPath: file.path,
        line: symbol.line,
        status: 'resolved',
        targetName: node.name,
      });

      if (node.type === 'function') {
        functionsByName.set(node.name, [...(functionsByName.get(node.name) ?? []), node]);
        if (node.containerName) {
          const parentClassNode = classByFileAndName.get(classKey(file.path, node.containerName));
          if (parentClassNode) {
            methodNodesByClassId.set(parentClassNode.id, [...(methodNodesByClassId.get(parentClassNode.id) ?? []), node]);
          }
        }
      } else if (node.type === 'class') {
        classNodesByName.set(node.name, [...(classNodesByName.get(node.name) ?? []), node]);
        classByFileAndName.set(classKey(file.path, node.name), node);
      } else if (node.type === 'interface') {
        interfaceNodesByName.set(node.name, [...(interfaceNodesByName.get(node.name) ?? []), node]);
      }
    }

    topLevelSymbolsByFile.set(file.path, symbolIndex);
  }

  const reExportsByFile = new Map<string, Map<string, string>>();
  for (const file of parsedFiles) {
    for (const fileImport of file.imports) {
      if (!fileImport.isReExport || !fileImport.resolvedPath || !allPaths.has(fileImport.resolvedPath)) continue;
      let fileMap = reExportsByFile.get(file.path);
      if (!fileMap) {
        fileMap = new Map();
        reExportsByFile.set(file.path, fileMap);
      }
      for (const binding of fileImport.bindings) {
        if (binding.isNamespace) {
          const sourceSymbols = topLevelSymbolsByFile.get(fileImport.resolvedPath);
          if (sourceSymbols) {
            for (const name of sourceSymbols.keys()) {
              fileMap.set(name, fileImport.resolvedPath);
            }
          }
        } else {
          fileMap.set(binding.localName, fileImport.resolvedPath);
        }
      }
    }
  }

  for (const file of parsedFiles) {
    const fileNode = filesByPath.get(file.path);
    if (!fileNode) continue;

    const bindings = new Map<string, { importedName?: string; modulePath?: string; specifier: string; namespace?: boolean }>();

    for (const fileImport of file.imports) {
      const resolvedPath = fileImport.resolvedPath && allPaths.has(fileImport.resolvedPath) ? fileImport.resolvedPath : undefined;
      const importKind = resolvedPath
        ? 'local'
        : fileImport.kind === 'external'
          ? 'external'
          : 'unresolved';
      let targetNode = resolvedPath ? moduleNodeByPath.get(resolvedPath) : undefined;

      if (!targetNode && importKind === 'external') {
        targetNode = {
          id: makeId('module-external', fileImport.specifier),
          type: 'module',
          name: fileImport.specifier,
          path: fileImport.specifier,
          relativePath: fileImport.specifier,
          line: fileImport.line,
          language: 'external',
          moduleName: fileImport.specifier,
          external: true,
        };
        if (!nodes.some(node => node.id === targetNode?.id)) {
          nodes.push(targetNode);
          modulesByName.set(targetNode.name, [...(modulesByName.get(targetNode.name) ?? []), targetNode]);
        } else {
          targetNode = nodes.find(node => node.id === targetNode?.id);
        }
      }

      edges.push({
        id: makeId('imports', fileNode.id, targetNode?.id, fileImport.line, fileImport.specifier),
        type: 'imports',
        from: fileNode.id,
        to: targetNode?.id,
        fromPath: file.path,
        toPath: resolvedPath ?? targetNode?.path,
        line: fileImport.line,
        status: importKind === 'unresolved' ? 'unresolved' : 'resolved',
        targetName: targetNode?.name ?? fileImport.specifier,
        specifier: fileImport.specifier,
        importKind,
      });

      for (const binding of fileImport.bindings) {
        bindings.set(binding.localName, {
          importedName: binding.importedName,
          modulePath: resolvedPath,
          namespace: binding.isNamespace,
          specifier: fileImport.specifier,
        });
      }
    }

    for (const inheritance of file.inheritances) {
      const classNodeType = file.symbols.find(s => s.name === inheritance.className && s.line === inheritance.classLine)?.type ?? 'class';
      const classNodeId = makeId(classNodeType, file.path, inheritance.className, inheritance.classLine);
      const classNode = symbolByIdentity.get(classNodeId);
      if (!classNode) continue;
      const edgeType = inheritance.kind === 'implements' ? 'implements' as const : 'inherits' as const;
      if (edgeType === 'inherits') {
        parentNamesByClassId.set(classNode.id, [...(parentNamesByClassId.get(classNode.id) ?? []), inheritance.baseName]);
      }
      const candidatePool = edgeType === 'implements'
        ? interfaceNodesByName
        : classNode.type === 'interface'
          ? interfaceNodesByName
          : classNodesByName;
      const localCandidates = candidatePool.get(inheritance.baseName) ?? [];
      const exactLocal = localCandidates.filter(candidate => candidate.path === file.path);
      const candidates = exactLocal.length > 0 ? exactLocal : localCandidates;
      const resolved = candidates.length === 1 ? candidates[0] : undefined;
      edges.push({
        id: makeId(edgeType, classNode.id, inheritance.baseName, inheritance.line),
        type: edgeType,
        from: classNode.id,
        to: resolved?.id,
        fromPath: file.path,
        toPath: resolved?.path,
        line: inheritance.line,
        status: resolved ? 'resolved' : candidates.length > 1 ? 'ambiguous' : 'unresolved',
        targetName: inheritance.baseName,
      });
    }

    const visitedClassMethods = new Map<string, CodeNode[]>();
    const resolveClassMethods = (classNode: CodeNode | undefined, methodName: string, includeParents: boolean): CodeNode[] => {
      if (!classNode) return [];
      const visitKey = `${classNode.id}:${methodName}:${includeParents}`;
      const cached = visitedClassMethods.get(visitKey);
      if (cached) return cached;

      const ownMethods = (methodNodesByClassId.get(classNode.id) ?? []).filter(node => node.name === methodName);
      if (!includeParents || ownMethods.length > 0) {
        visitedClassMethods.set(visitKey, ownMethods);
        return ownMethods;
      }

      const parents = parentNamesByClassId.get(classNode.id) ?? [];
      const inherited: CodeNode[] = [];
      for (const parentName of parents) {
        const directParent = classByFileAndName.get(classKey(classNode.path, parentName));
        const parentCandidates = directParent ? [directParent] : (classNodesByName.get(parentName) ?? []);
        for (const parentNode of parentCandidates) {
          inherited.push(...resolveClassMethods(parentNode, methodName, true));
        }
      }

      const unique = inherited.filter((node, index, array) => array.findIndex(candidate => candidate.id === node.id) === index);
      visitedClassMethods.set(visitKey, unique);
      return unique;
    };

    for (const call of file.calls) {
      const callerId = makeId('function', file.path, call.callerName, call.callerLine, call.callerContainerName);
      const callerNode = symbolByIdentity.get(callerId);
      if (!callerNode) continue;

      const localSymbols = topLevelSymbolsByFile.get(file.path)?.get(call.calleeName) ?? [];
      const namespaceBinding = call.qualifier ? bindings.get(call.qualifier) : undefined;
      const directBinding = bindings.get(call.calleeName);
      const callerClassNode = call.callerContainerName ? classByFileAndName.get(classKey(file.path, call.callerContainerName)) : undefined;
      let candidates = localSymbols;

      if (call.qualifier === 'this' || call.qualifier === 'self' || call.qualifier === 'cls') {
        const classCandidates = resolveClassMethods(callerClassNode, call.calleeName, true);
        if (classCandidates.length > 0) candidates = classCandidates;
      } else if (call.qualifier === 'super') {
        const parents = callerClassNode ? (parentNamesByClassId.get(callerClassNode.id) ?? []) : [];
        const parentCandidates: CodeNode[] = [];
        for (const parentName of parents) {
          const directParent = callerClassNode ? classByFileAndName.get(classKey(callerClassNode.path, parentName)) : undefined;
          const baseCandidates = directParent ? [directParent] : (classNodesByName.get(parentName) ?? []);
          for (const parentNode of baseCandidates) {
            parentCandidates.push(...resolveClassMethods(parentNode, call.calleeName, true));
          }
        }
        if (parentCandidates.length > 0) candidates = parentCandidates;
      } else if (namespaceBinding?.modulePath) {
        let importedFileSymbols = topLevelSymbolsByFile.get(namespaceBinding.modulePath)?.get(call.calleeName) ?? [];
        if (importedFileSymbols.length === 0) {
          const reExportSource = reExportsByFile.get(namespaceBinding.modulePath)?.get(call.calleeName);
          if (reExportSource) {
            importedFileSymbols = topLevelSymbolsByFile.get(reExportSource)?.get(call.calleeName) ?? [];
          }
        }
        if (importedFileSymbols.length > 0) candidates = importedFileSymbols;
      } else if (directBinding?.modulePath) {
        const symbolName = directBinding.importedName ?? call.calleeName;
        let importedFileSymbols = topLevelSymbolsByFile.get(directBinding.modulePath)?.get(symbolName) ?? [];
        if (importedFileSymbols.length === 0) {
          const reExportSource = reExportsByFile.get(directBinding.modulePath)?.get(symbolName);
          if (reExportSource) {
            importedFileSymbols = topLevelSymbolsByFile.get(reExportSource)?.get(symbolName) ?? [];
          }
        }
        if (importedFileSymbols.length > 0) candidates = importedFileSymbols;
      } else if (candidates.length === 0) {
        candidates = functionsByName.get(call.calleeName) ?? [];
      }

      const exactCandidates = directBinding?.modulePath
        ? candidates.filter(candidate => candidate.path === directBinding.modulePath)
        : namespaceBinding?.modulePath
          ? candidates.filter(candidate => candidate.path === namespaceBinding.modulePath)
          : candidates;
      const resolvedCandidates = exactCandidates.length > 0 ? exactCandidates : candidates;
      const resolved = resolvedCandidates.length === 1 ? resolvedCandidates[0] : undefined;

      edges.push({
        id: makeId('calls', callerNode.id, call.calleeName, call.line),
        type: 'calls',
        from: callerNode.id,
        to: resolved?.id,
        fromPath: file.path,
        toPath: resolved?.path,
        line: call.line,
        status: resolved ? 'resolved' : resolvedCandidates.length > 1 ? 'ambiguous' : 'unresolved',
        targetName: call.calleeName,
        detail: call.qualifier,
        candidates: resolved ? undefined : resolvedCandidates.length > 1 ? toCandidates(resolvedCandidates) : undefined,
      });
    }
  }

  onProgress?.({ phase: 'index', total: 1, completed: 1, detail: 'Index construction complete' });

  return {
    repoRoot,
    files: parsedFiles.map(file => ({
      ...file,
      relativePath: normalizePath(path.relative(repoRoot, file.path)),
      moduleName: getModuleName(repoRoot, file.path),
    })),
    nodes,
    edges,
    capabilities: mergeCapabilities(parsedFiles),
  };
}
