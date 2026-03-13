export type CodeNodeType = 'file' | 'module' | 'function' | 'class' | 'interface' | 'type-alias' | 'enum' | 'variable' | 'parameter';
export type CodeEdgeType = 'contains' | 'imports' | 'calls' | 'inherits' | 'implements' | 'has_parameter';
export type ResolutionStatus = 'resolved' | 'ambiguous' | 'unresolved';
export type ImportKind = 'local' | 'external' | 'unresolved';

export interface CodeCapabilities {
  definitions: boolean;
  imports: boolean;
  calls: boolean;
  inheritance: boolean;
  content: boolean;
}

export interface ParsedImportBinding {
  localName: string;
  importedName?: string;
  isNamespace?: boolean;
  isDefault?: boolean;
}

export interface ParsedImport {
  specifier: string;
  line: number;
  kind: 'local' | 'external' | 'unresolved';
  bindings: ParsedImportBinding[];
  resolvedPath?: string;
  isReExport?: boolean;
}

export interface ParsedSymbol {
  type: Extract<CodeNodeType, 'function' | 'class' | 'interface' | 'type-alias' | 'enum' | 'variable'>;
  name: string;
  line: number;
  containerName?: string;
  signature?: string;
  exported?: boolean;
}

export interface ParsedCall {
  callerName: string;
  callerLine: number;
  callerContainerName?: string;
  calleeName: string;
  qualifier?: string;
  line: number;
}

export interface ParsedInheritance {
  className: string;
  classLine: number;
  baseName: string;
  line: number;
  kind?: 'extends' | 'implements';
}

export interface ParsedFile {
  path: string;
  relativePath: string;
  moduleName: string;
  language: string;
  content: string;
  lines: string[];
  symbols: ParsedSymbol[];
  imports: ParsedImport[];
  calls: ParsedCall[];
  inheritances: ParsedInheritance[];
}

export interface CodeNode {
  id: string;
  type: CodeNodeType;
  name: string;
  path: string;
  relativePath?: string;
  line?: number;
  language: string;
  moduleName?: string;
  containerId?: string;
  containerName?: string;
  signature?: string;
  external?: boolean;
}

export interface CodeEdge {
  id: string;
  type: CodeEdgeType;
  from: string;
  to?: string;
  fromPath: string;
  toPath?: string;
  line?: number;
  status: ResolutionStatus;
  targetName?: string;
  detail?: string;
  specifier?: string;
  importKind?: ImportKind;
  candidates?: Array<{
    name: string;
    relativePath?: string;
    line?: number;
  }>;
}

export interface CodebaseIndex {
  repoRoot: string;
  files: ParsedFile[];
  nodes: CodeNode[];
  edges: CodeEdge[];
  capabilities: Record<string, CodeCapabilities>;
}

export interface CodeSearchResult {
  node: CodeNode;
  resolution?: ResolutionStatus;
}

export interface ContentMatch {
  path: string;
  relativePath: string;
  language: string;
  line: number;
  snippet: string;
}

export interface RelationMatch {
  from: CodeNode;
  edge: CodeEdge;
  to?: CodeNode;
}

export interface DependencyAnalysis {
  target: string;
  targetFile?: CodeNode;
  importers: RelationMatch[];
  localImports: RelationMatch[];
  externalImports: RelationMatch[];
  unresolvedImports: RelationMatch[];
}

export interface ClassTreeAnalysis {
  target: CodeNode;
  parents: RelationMatch[];
  children: RelationMatch[];
  methods: CodeNode[];
}

export interface CallChain {
  nodes: CodeNode[];
  edges: CodeEdge[];
  direction?: 'forward' | 'reverse';
  status?: 'resolved' | 'blocked_ambiguous';
  blockedAt?: CodeNode;
  blockedBy?: CodeEdge;
}

export interface CodeCommandPayload {
  repo: string;
  query: Record<string, unknown>;
  results: unknown;
  stats: {
    filesIndexed: number;
    nodes: number;
    edges: number;
  };
  capabilities: Record<string, CodeCapabilities>;
}
