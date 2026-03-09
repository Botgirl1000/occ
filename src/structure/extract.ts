import type { StructureNode, PageMapping, DocumentStructure } from './types.js';

interface RawHeader {
  title: string;
  level: number;
  lineNum: number;
  startChar: number;
}

/** Step 1: Extract headers from markdown content */
function extractHeaders(content: string): RawHeader[] {
  const lines = content.split('\n');
  const headers: RawHeader[] = [];
  let charPosition = 0;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    if (!inCodeBlock) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headers.push({
          title: match[2].trim(),
          level: match[1].length,
          lineNum: i + 1,
          startChar: charPosition,
        });
      }
    }

    charPosition += line.length + 1; // +1 for newline
  }

  return headers;
}

/** Step 2: Compute end positions — each section ends where the next begins */
function computeEndPositions(headers: RawHeader[], contentLength: number): Array<RawHeader & { endChar: number }> {
  return headers.map((h, i) => ({
    ...h,
    endChar: i < headers.length - 1 ? headers[i + 1].startChar : contentLength,
  }));
}

/** Step 3: Build tree using a stack-based approach */
function buildTree(headers: Array<RawHeader & { endChar: number }>): StructureNode[] {
  const rootNodes: StructureNode[] = [];
  const stack: Array<{ node: StructureNode; level: number }> = [];
  let nodeCounter = 0;

  for (const h of headers) {
    nodeCounter++;
    const node: StructureNode = {
      nodeId: String(nodeCounter).padStart(4, '0'),
      title: h.title,
      level: h.level,
      startChar: h.startChar,
      endChar: h.endChar,
      startLine: h.lineNum,
      children: [],
    };

    // Pop stack until we find a parent (lower level)
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      const parent = stack[stack.length - 1].node;
      node.parentNodeId = parent.nodeId;
      parent.children.push(node);
    }

    stack.push({ node, level: h.level });
  }

  return rootNodes;
}

/** Step 4: Assign dotted structure codes recursively */
function assignStructureCodes(nodes: StructureNode[], prefix = ''): void {
  for (let i = 0; i < nodes.length; i++) {
    const code = prefix ? `${prefix}.${i + 1}` : String(i + 1);
    nodes[i].structureCode = code;
    assignStructureCodes(nodes[i].children, code);
  }
}

/** Step 5: Extract page mappings from [Page N] markers in content */
function extractPageMappings(content: string): PageMapping[] {
  const regex = /^\[Page\s+(\d+)\]/gm;
  const mappings: PageMapping[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const pageNumber = parseInt(match[1], 10);
    mappings.push({
      pageNumber,
      startChar: match.index,
      endChar: content.length, // will be adjusted below
    });
  }

  // Adjust end positions
  for (let i = 0; i < mappings.length - 1; i++) {
    mappings[i].endChar = mappings[i + 1].startChar;
  }

  return mappings;
}

/** Step 6: Map nodes to pages based on char positions */
function mapNodesToPages(nodes: StructureNode[], mappings: PageMapping[]): void {
  if (mappings.length === 0) return;

  function findPage(charPos: number): number | undefined {
    for (const m of mappings) {
      if (charPos >= m.startChar && charPos < m.endChar) {
        return m.pageNumber;
      }
    }
    return undefined;
  }

  function mapRecursive(nodeList: StructureNode[]) {
    for (const node of nodeList) {
      node.startPage = findPage(node.startChar);
      node.endPage = findPage(Math.max(node.endChar - 1, node.startChar));
      mapRecursive(node.children);
    }
  }

  mapRecursive(nodes);
}

/** Compute max depth of the tree */
function computeMaxDepth(nodes: StructureNode[]): number {
  if (nodes.length === 0) return 0;
  let max = 0;
  for (const node of nodes) {
    const childDepth = computeMaxDepth(node.children);
    max = Math.max(max, 1 + childDepth);
  }
  return max;
}

/** Count total nodes in tree */
function countNodes(nodes: StructureNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countNodes(node.children);
  }
  return count;
}

/** Main extraction pipeline: markdown content → DocumentStructure */
export function extractFromMarkdown(content: string): DocumentStructure {
  const rawHeaders = extractHeaders(content);

  if (rawHeaders.length === 0) {
    return { rootNodes: [], pageMappings: [], totalNodes: 0, maxDepth: 0 };
  }

  const withEnds = computeEndPositions(rawHeaders, content.length);
  const rootNodes = buildTree(withEnds);
  assignStructureCodes(rootNodes);

  const pageMappings = extractPageMappings(content);
  mapNodesToPages(rootNodes, pageMappings);

  return {
    rootNodes,
    pageMappings,
    totalNodes: countNodes(rootNodes),
    maxDepth: computeMaxDepth(rootNodes),
  };
}

/** Find which section a character range falls into */
export function findChunkSection(structure: DocumentStructure, start: number, end: number): StructureNode | null {
  let best: StructureNode | null = null;

  function search(nodes: StructureNode[]) {
    for (const node of nodes) {
      if (start >= node.startChar && start < node.endChar) {
        best = node;
        search(node.children);
      }
    }
  }

  search(structure.rootNodes);
  return best;
}

/** Get the content of a section from the original markdown */
export function getSectionContent(content: string, node: StructureNode, includeChildren = true): string {
  if (includeChildren) {
    return content.slice(node.startChar, node.endChar);
  }

  // Exclude children: get content from section start to first child start
  if (node.children.length === 0) {
    return content.slice(node.startChar, node.endChar);
  }
  return content.slice(node.startChar, node.children[0].startChar);
}
