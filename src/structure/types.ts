export interface PageMapping {
  pageNumber: number;
  startChar: number;
  endChar: number;
}

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
  children: StructureNode[];
}

export interface DocumentStructure {
  rootNodes: StructureNode[];
  pageMappings: PageMapping[];
  totalNodes: number;
  maxDepth: number;
}

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
  function nodeFromDict(d: Record<string, unknown>): StructureNode {
    return {
      nodeId: d.nodeId as string,
      title: d.title as string,
      level: d.level as number,
      startChar: d.startChar as number,
      endChar: d.endChar as number,
      startLine: d.startLine as number,
      startPage: d.startPage as number | undefined,
      endPage: d.endPage as number | undefined,
      parentNodeId: d.parentNodeId as string | undefined,
      structureCode: d.structureCode as string | undefined,
      children: (d.children as Record<string, unknown>[]).map(nodeFromDict),
    };
  }
  return {
    rootNodes: (data.rootNodes as Record<string, unknown>[]).map(nodeFromDict),
    pageMappings: data.pageMappings as PageMapping[],
    totalNodes: data.totalNodes as number,
    maxDepth: data.maxDepth as number,
  };
}
