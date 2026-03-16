import { z } from 'zod';

export const PageMappingSchema = z.object({
  pageNumber: z.number(),
  startChar: z.number(),
  endChar: z.number(),
});
export type PageMapping = z.infer<typeof PageMappingSchema>;

export const StructureNodeSchema: z.ZodType<StructureNode> = z.object({
  nodeId: z.string(),
  title: z.string(),
  level: z.number(),
  startChar: z.number(),
  endChar: z.number(),
  startLine: z.number(),
  startPage: z.number().optional(),
  endPage: z.number().optional(),
  parentNodeId: z.string().optional(),
  structureCode: z.string().optional(),
  wordCount: z.number().optional(),
  tokenEstimate: z.number().optional(),
  children: z.lazy(() => z.array(StructureNodeSchema)),
});
export interface StructureNode {
  nodeId: string;
  title: string;
  level: number;
  startChar: number;
  endChar: number;
  startLine: number;
  startPage?: number;
  endPage?: number;
  parentNodeId?: string;
  structureCode?: string;
  wordCount?: number;
  tokenEstimate?: number;
  children: StructureNode[];
}

export const DocumentStructureSchema = z.object({
  rootNodes: z.array(StructureNodeSchema),
  pageMappings: z.array(PageMappingSchema),
  totalNodes: z.number(),
  maxDepth: z.number(),
});
export type DocumentStructure = z.infer<typeof DocumentStructureSchema>;

export function flatten(nodes: StructureNode[]): StructureNode[] {
  const result: StructureNode[] = [];
  function walk(list: StructureNode[]) {
    for (const node of list) {
      result.push(node);
      walk(node.children);
    }
  }
  walk(nodes);
  return result;
}

export function getNodeById(nodes: StructureNode[], nodeId: string): StructureNode | undefined {
  for (const node of flatten(nodes)) {
    if (node.nodeId === nodeId) return node;
  }
  return undefined;
}

export function getNodeByPath(nodes: StructureNode[], structureCode: string): StructureNode | undefined {
  for (const node of flatten(nodes)) {
    if (node.structureCode === structureCode) return node;
  }
  return undefined;
}

export function toDict(structure: DocumentStructure): Record<string, unknown> {
  function nodeToDict(node: StructureNode): Record<string, unknown> {
    return {
      nodeId: node.nodeId,
      title: node.title,
      level: node.level,
      startChar: node.startChar,
      endChar: node.endChar,
      startLine: node.startLine,
      startPage: node.startPage,
      endPage: node.endPage,
      parentNodeId: node.parentNodeId,
      structureCode: node.structureCode,
      wordCount: node.wordCount,
      tokenEstimate: node.tokenEstimate,
      children: node.children.map(nodeToDict),
    };
  }
  return {
    rootNodes: structure.rootNodes.map(nodeToDict),
    pageMappings: structure.pageMappings,
    totalNodes: structure.totalNodes,
    maxDepth: structure.maxDepth,
  };
}

export function fromDict(data: Record<string, unknown>): DocumentStructure {
  return DocumentStructureSchema.parse(data);
}
