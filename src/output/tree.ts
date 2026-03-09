import chalk from 'chalk';
import path from 'node:path';
import { sectionHeader, stripAnsi, tableChars } from './tabular.js';
import type { StructureNode, DocumentStructure } from '../structure/types.js';

type ColorFn = (s: string) => string;

interface ColorScheme {
  header: ColorFn;
  code: ColorFn;
  title: ColorFn;
  page: ColorFn;
  dim: ColorFn;
  summary: ColorFn;
}

const colorize: ColorScheme = {
  header: (s) => chalk.bold(s),
  code: (s) => chalk.cyan(s),
  title: (s) => s,
  page: (s) => chalk.dim(s),
  dim: (s) => chalk.dim(s),
  summary: (s) => chalk.dim(s),
};

const identity: ColorFn = (s) => s;
const noColor: ColorScheme = Object.fromEntries(Object.keys(colorize).map(k => [k, identity])) as unknown as ColorScheme;

export interface StructureResult {
  file: string;
  structure: DocumentStructure;
  markdown: string;
}

export interface TreeOptions {
  ci?: boolean;
}

function formatPageRange(node: StructureNode): string {
  if (node.startPage == null) return '';
  if (node.endPage != null && node.endPage !== node.startPage) {
    return `p.${node.startPage}-${node.endPage}`;
  }
  return `p.${node.startPage}`;
}

function formatTreeNode(node: StructureNode, width: number, c: ColorScheme): string {
  const indent = '  '.repeat(node.level - 1);
  const code = node.structureCode || '';
  const left = `${indent}${c.code(code)}   ${c.title(node.title)}`;
  const pageStr = formatPageRange(node);

  if (!pageStr) return left;

  const leftLen = stripAnsi(left).length;
  const rightStr = c.page(pageStr);
  const rightLen = pageStr.length;
  const gap = Math.max(2, width - leftLen - rightLen - 2);
  const dots = c.dim('.'.repeat(gap));

  return `${left} ${dots} ${rightStr}`;
}

export function formatStructureTree(result: StructureResult, options: TreeOptions = {}): string {
  const { ci = false } = options;
  const c: ColorScheme = ci ? noColor : colorize;

  const { structure } = result;
  const fileName = path.basename(result.file);
  const width = 70;

  const lines: string[] = [];
  lines.push('');
  lines.push(c.header(sectionHeader(`Structure: ${fileName}`, width, ci)));

  if (structure.totalNodes === 0) {
    lines.push(c.dim('  (no headings found)'));
  } else {
    function renderNodes(nodes: StructureNode[]) {
      for (const node of nodes) {
        lines.push(formatTreeNode(node, width, c));
        renderNodes(node.children);
      }
    }
    renderNodes(structure.rootNodes);
  }

  // Summary line
  const rootCount = structure.rootNodes.length;
  const parts: string[] = [];
  parts.push(`${rootCount} section${rootCount !== 1 ? 's' : ''}`);
  if (structure.totalNodes !== rootCount) {
    parts.push(`${structure.totalNodes} nodes`);
  }
  if (structure.maxDepth > 1) {
    parts.push(`max depth ${structure.maxDepth}`);
  }
  lines.push('');
  lines.push(c.summary(parts.join(', ')));

  return lines.join('\n');
}

export function formatStructureJson(results: StructureResult[]): Record<string, unknown>[] {
  return results.map(r => ({
    file: r.file,
    totalNodes: r.structure.totalNodes,
    maxDepth: r.structure.maxDepth,
    nodes: r.structure.rootNodes,
  }));
}
