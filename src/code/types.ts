import { z } from 'zod';

export const CodeNodeTypeSchema = z.enum(['file', 'module', 'function', 'class', 'interface', 'type-alias', 'enum', 'variable', 'parameter']);
export type CodeNodeType = z.infer<typeof CodeNodeTypeSchema>;

export const CodeEdgeTypeSchema = z.enum(['contains', 'imports', 'calls', 'inherits', 'implements', 'has_parameter']);
export type CodeEdgeType = z.infer<typeof CodeEdgeTypeSchema>;

export const ResolutionStatusSchema = z.enum(['resolved', 'ambiguous', 'unresolved']);
export type ResolutionStatus = z.infer<typeof ResolutionStatusSchema>;

export const ImportKindSchema = z.enum(['local', 'external', 'unresolved']);
export type ImportKind = z.infer<typeof ImportKindSchema>;

export const CodeCapabilitiesSchema = z.object({
  definitions: z.boolean(),
  imports: z.boolean(),
  calls: z.boolean(),
  inheritance: z.boolean(),
  content: z.boolean(),
});
export type CodeCapabilities = z.infer<typeof CodeCapabilitiesSchema>;

export const ParsedImportBindingSchema = z.object({
  localName: z.string(),
  importedName: z.string().optional(),
  isNamespace: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
export type ParsedImportBinding = z.infer<typeof ParsedImportBindingSchema>;

export const ParsedImportSchema = z.object({
  specifier: z.string(),
  line: z.number(),
  kind: ImportKindSchema,
  bindings: z.array(ParsedImportBindingSchema),
  resolvedPath: z.string().optional(),
  isReExport: z.boolean().optional(),
});
export type ParsedImport = z.infer<typeof ParsedImportSchema>;

export const ParsedSymbolSchema = z.object({
  type: z.enum(['function', 'class', 'interface', 'type-alias', 'enum', 'variable']),
  name: z.string(),
  line: z.number(),
  containerName: z.string().optional(),
  signature: z.string().optional(),
  exported: z.boolean().optional(),
  fullSignature: z.string().optional(),
  returnType: z.string().optional(),
  jsdoc: z.string().optional(),
  isAsync: z.boolean().optional(),
  isStatic: z.boolean().optional(),
  visibility: z.enum(['public', 'protected', 'private']).optional(),
});
export type ParsedSymbol = z.infer<typeof ParsedSymbolSchema>;

export const ParsedCallSchema = z.object({
  callerName: z.string(),
  callerLine: z.number(),
  callerContainerName: z.string().optional(),
  calleeName: z.string(),
  qualifier: z.string().optional(),
  line: z.number(),
});
export type ParsedCall = z.infer<typeof ParsedCallSchema>;

export const ParsedInheritanceSchema = z.object({
  className: z.string(),
  classLine: z.number(),
  baseName: z.string(),
  line: z.number(),
  kind: z.enum(['extends', 'implements']).optional(),
});
export type ParsedInheritance = z.infer<typeof ParsedInheritanceSchema>;

export const ParsedFileSchema = z.object({
  path: z.string(),
  relativePath: z.string(),
  moduleName: z.string(),
  language: z.string(),
  content: z.string(),
  lines: z.array(z.string()),
  symbols: z.array(ParsedSymbolSchema),
  imports: z.array(ParsedImportSchema),
  calls: z.array(ParsedCallSchema),
  inheritances: z.array(ParsedInheritanceSchema),
});
export type ParsedFile = z.infer<typeof ParsedFileSchema>;

export const CodeNodeSchema = z.object({
  id: z.string(),
  type: CodeNodeTypeSchema,
  name: z.string(),
  path: z.string(),
  relativePath: z.string().optional(),
  line: z.number().optional(),
  language: z.string(),
  moduleName: z.string().optional(),
  containerId: z.string().optional(),
  containerName: z.string().optional(),
  signature: z.string().optional(),
  external: z.boolean().optional(),
});
export type CodeNode = z.infer<typeof CodeNodeSchema>;

export const CodeEdgeSchema = z.object({
  id: z.string(),
  type: CodeEdgeTypeSchema,
  from: z.string(),
  to: z.string().optional(),
  fromPath: z.string(),
  toPath: z.string().optional(),
  line: z.number().optional(),
  status: ResolutionStatusSchema,
  targetName: z.string().optional(),
  detail: z.string().optional(),
  specifier: z.string().optional(),
  importKind: ImportKindSchema.optional(),
  candidates: z.array(z.object({
    name: z.string(),
    relativePath: z.string().optional(),
    line: z.number().optional(),
  })).optional(),
});
export type CodeEdge = z.infer<typeof CodeEdgeSchema>;

export const CodebaseIndexSchema = z.object({
  repoRoot: z.string(),
  files: z.array(ParsedFileSchema),
  nodes: z.array(CodeNodeSchema),
  edges: z.array(CodeEdgeSchema),
  capabilities: z.record(z.string(), CodeCapabilitiesSchema),
});
export type CodebaseIndex = z.infer<typeof CodebaseIndexSchema>;

export const CodeSearchResultSchema = z.object({
  node: CodeNodeSchema,
  resolution: ResolutionStatusSchema.optional(),
});
export type CodeSearchResult = z.infer<typeof CodeSearchResultSchema>;

export const ContentMatchSchema = z.object({
  path: z.string(),
  relativePath: z.string(),
  language: z.string(),
  line: z.number(),
  snippet: z.string(),
});
export type ContentMatch = z.infer<typeof ContentMatchSchema>;

export const RelationMatchSchema = z.object({
  from: CodeNodeSchema,
  edge: CodeEdgeSchema,
  to: CodeNodeSchema.optional(),
});
export type RelationMatch = z.infer<typeof RelationMatchSchema>;

export const DependencyAnalysisSchema = z.object({
  target: z.string(),
  targetFile: CodeNodeSchema.optional(),
  importers: z.array(RelationMatchSchema),
  localImports: z.array(RelationMatchSchema),
  externalImports: z.array(RelationMatchSchema),
  unresolvedImports: z.array(RelationMatchSchema),
});
export type DependencyAnalysis = z.infer<typeof DependencyAnalysisSchema>;

export const ClassTreeAnalysisSchema = z.object({
  target: CodeNodeSchema,
  parents: z.array(RelationMatchSchema),
  children: z.array(RelationMatchSchema),
  methods: z.array(CodeNodeSchema),
});
export type ClassTreeAnalysis = z.infer<typeof ClassTreeAnalysisSchema>;

export const CallChainSchema = z.object({
  nodes: z.array(CodeNodeSchema),
  edges: z.array(CodeEdgeSchema),
  direction: z.enum(['forward', 'reverse']).optional(),
  status: z.enum(['resolved', 'blocked_ambiguous']).optional(),
  blockedAt: CodeNodeSchema.optional(),
  blockedBy: CodeEdgeSchema.optional(),
});
export type CallChain = z.infer<typeof CallChainSchema>;

export const CodeCommandPayloadSchema = z.object({
  repo: z.string(),
  query: z.record(z.string(), z.unknown()),
  results: z.unknown(),
  stats: z.object({
    filesIndexed: z.number(),
    nodes: z.number(),
    edges: z.number(),
  }),
  capabilities: z.record(z.string(), CodeCapabilitiesSchema),
});
export type CodeCommandPayload = z.infer<typeof CodeCommandPayloadSchema>;
