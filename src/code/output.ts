import Table from 'cli-table3';
import chalk from 'chalk';
import { formatNumber } from '../utils.js';
import { sectionHeader, stripAnsi, tableChars } from '../output/tabular.js';
import type { CallChain, ClassTreeAnalysis, CodeCommandPayload, CodeNode, CodeSearchResult, ContentMatch, DependencyAnalysis, RelationMatch } from './types.js';
import type { FusedSearchResult } from './query.js';

type ColorFn = (value: string) => string;

interface ColorScheme {
  header: ColorFn;
  key: ColorFn;
  value: ColorFn;
  dim: ColorFn;
  ok: ColorFn;
  warn: ColorFn;
  bad: ColorFn;
}

const colors: ColorScheme = {
  header: (value) => chalk.bold(value),
  key: (value) => chalk.cyan(value),
  value: (value) => value,
  dim: (value) => chalk.dim(value),
  ok: (value) => chalk.green(value),
  warn: (value) => chalk.yellow(value),
  bad: (value) => chalk.red(value),
};

const noColor: ColorScheme = Object.fromEntries(
  Object.keys(colors).map(key => [key, (value: string) => value]),
) as unknown as ColorScheme;

function palette(ci = false): ColorScheme {
  return ci ? noColor : colors;
}

function addSeparators(rendered: string, ci = false): string {
  void ci;
  return rendered;
}

function tableTitle(title: string, body: string, ci = false): string {
  const width = stripAnsi(body.split('\n')[0] ?? '').length;
  return `${palette(ci).header(sectionHeader(title, width, ci))}\n${body}`;
}

function formatLocation(node: Pick<CodeNode, 'relativePath' | 'line'>): string {
  return node.line ? `${node.relativePath ?? ''}:${node.line}` : (node.relativePath ?? '');
}

function formatResolution(status: RelationMatch['edge']['status'], c: ColorScheme): string {
  if (status === 'resolved') return c.ok(status);
  if (status === 'ambiguous') return c.warn(status);
  return c.bad(status);
}

function formatCandidate(candidate: NonNullable<RelationMatch['edge']['candidates']>[number]): string {
  const location = candidate.relativePath
    ? `${candidate.relativePath}${candidate.line ? `:${candidate.line}` : ''}`
    : candidate.name;
  return location;
}

function formatRelationDetail(relation: RelationMatch): string {
  const parts: string[] = [];
  if (relation.edge.detail) parts.push(relation.edge.detail);
  if (relation.edge.specifier) parts.push(relation.edge.specifier);
  if (relation.edge.status === 'ambiguous' && relation.edge.candidates && relation.edge.candidates.length > 0) {
    const renderedCandidates = relation.edge.candidates.slice(0, 2).map(formatCandidate);
    const suffix = relation.edge.candidates.length > 2 ? ` +${relation.edge.candidates.length - 2} more` : '';
    parts.push(`${relation.edge.candidates.length} candidates: ${renderedCandidates.join(', ')}${suffix}`);
  }
  return parts.join(' | ');
}

export function formatPayloadJson(payload: CodeCommandPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function formatSearchResults(title: string, results: CodeSearchResult[], ci = false): string {
  const c = palette(ci);
  if (results.length === 0) return `${c.dim('No matches found.')}\n`;

  const table = new Table({
    head: [c.key('Name'), c.key('Type'), c.key('Location'), c.key('Container')],
    chars: tableChars(ci),
    style: { head: [], border: [] },
  });

  for (const result of results) {
    table.push([
      c.value(result.node.name),
      result.node.type,
      formatLocation(result.node),
      result.node.containerName ?? '',
    ]);
  }

  return `${tableTitle(title, addSeparators(table.toString(), ci), ci)}\n`;
}

export function formatContentResults(results: ContentMatch[], ci = false): string {
  const c = palette(ci);
  if (results.length === 0) return `${c.dim('No content matches found.')}\n`;

  const table = new Table({
    head: [c.key('Location'), c.key('Language'), c.key('Snippet')],
    chars: tableChars(ci),
    style: { head: [], border: [] },
  });

  for (const result of results) {
    table.push([
      `${result.relativePath}:${result.line}`,
      result.language,
      result.snippet,
    ]);
  }

  return `${tableTitle('Code Content', addSeparators(table.toString(), ci), ci)}\n`;
}

export function formatRelationResults(title: string, label: string, relations: RelationMatch[], ci = false, side: 'from' | 'to' = 'to'): string {
  const c = palette(ci);
  if (relations.length === 0) return `${c.dim('No relationships found.')}\n`;

  const table = new Table({
    head: [c.key(label), c.key('Location'), c.key('Resolution'), c.key('Detail')],
    chars: tableChars(ci),
    style: { head: [], border: [] },
  });

  for (const relation of relations) {
    const target = side === 'from' ? relation.from : relation.to;
    table.push([
      target?.name ?? relation.edge.targetName ?? '(unresolved)',
      target ? formatLocation(target) : relation.edge.toPath ?? '',
      formatResolution(relation.edge.status, c),
      formatRelationDetail(relation),
    ]);
  }

  return `${tableTitle(title, addSeparators(table.toString(), ci), ci)}\n`;
}

export function formatDependencies(result: DependencyAnalysis, ci = false): string {
  const c = palette(ci);
  const sections: string[] = [];

  sections.push(c.header(`Repository: ${result.targetFile?.relativePath ?? result.target}`));

  if (result.importers.length > 0) {
    const table = new Table({
      head: [c.key('Importer'), c.key('Resolution'), c.key('Specifier')],
      chars: tableChars(ci),
      style: { head: [], border: [] },
    });
    for (const importer of result.importers) {
      table.push([
        importer.from.relativePath ?? importer.from.name,
        formatResolution(importer.edge.status, c),
        importer.edge.specifier ?? importer.edge.targetName ?? '',
      ]);
    }
    sections.push(tableTitle('Importers', addSeparators(table.toString(), ci), ci));
  } else {
    sections.push(c.dim('No importers found.'));
  }

  if (result.localImports.length > 0) {
    const table = new Table({
      head: [c.key('Local Module'), c.key('Resolution'), c.key('Specifier')],
      chars: tableChars(ci),
      style: { head: [], border: [] },
    });
    for (const imported of result.localImports) {
      table.push([
        imported.to?.name ?? imported.edge.targetName ?? '(unresolved)',
        formatResolution(imported.edge.status, c),
        imported.edge.specifier ?? imported.edge.targetName ?? '',
      ]);
    }
    sections.push(tableTitle('Local Imports', addSeparators(table.toString(), ci), ci));
  }

  if (result.externalImports.length > 0) {
    const table = new Table({
      head: [c.key('External Package'), c.key('Resolution'), c.key('Specifier')],
      chars: tableChars(ci),
      style: { head: [], border: [] },
    });
    for (const imported of result.externalImports) {
      table.push([
        imported.to?.name ?? imported.edge.targetName ?? '(unresolved)',
        formatResolution(imported.edge.status, c),
        imported.edge.specifier ?? imported.edge.targetName ?? '',
      ]);
    }
    sections.push(tableTitle('External Imports', addSeparators(table.toString(), ci), ci));
  }

  if (result.unresolvedImports.length > 0) {
    const table = new Table({
      head: [c.key('Unresolved Import'), c.key('Resolution'), c.key('Specifier')],
      chars: tableChars(ci),
      style: { head: [], border: [] },
    });
    for (const imported of result.unresolvedImports) {
      table.push([
        imported.edge.targetName ?? '(unresolved)',
        formatResolution(imported.edge.status, c),
        imported.edge.specifier ?? imported.edge.targetName ?? '',
      ]);
    }
    sections.push(tableTitle('Unresolved Imports', addSeparators(table.toString(), ci), ci));
  }

  return sections.join('\n\n') + '\n';
}

export function formatClassTree(result: ClassTreeAnalysis | null, ci = false): string {
  const c = palette(ci);
  if (!result) return `${c.dim('Class not found.')}\n`;

  const typeLabel = result.target.type === 'interface' ? 'Interface'
    : result.target.type === 'enum' ? 'Enum'
    : 'Class';
  const lines: string[] = [];
  lines.push(c.header(`${typeLabel}: ${result.target.name} (${formatLocation(result.target)})`));

  if (result.parents.length > 0) {
    lines.push('');
    lines.push(c.key('Parents'));
    for (const parent of result.parents) {
      const relation = parent.edge.type === 'implements' ? 'implements' : 'extends';
      lines.push(`  ${parent.to?.name ?? parent.edge.targetName ?? '(unresolved)'} [${relation}, ${parent.edge.status}]`);
    }
  }

  if (result.children.length > 0) {
    lines.push('');
    lines.push(c.key('Children'));
    for (const child of result.children) {
      lines.push(`  ${child.from.name} (${formatLocation(child.from)})`);
    }
  }

  if (result.methods.length > 0) {
    lines.push('');
    lines.push(c.key(`Methods (${formatNumber(result.methods.length)})`));
    for (const method of result.methods) {
      lines.push(`  ${method.name}${method.signature ? `(${method.signature})` : ''}`);
    }
  }

  return lines.join('\n') + '\n';
}

export function formatChains(chains: CallChain[], ci = false): string {
  const c = palette(ci);
  if (chains.length === 0) return `${c.dim('No call chain found.')}\n`;

  const lines: string[] = [];
  for (let index = 0; index < chains.length; index++) {
    const chain = chains[index];
    const title = chain.status === 'blocked_ambiguous'
      ? `Chain ${index + 1} (blocked by ambiguity)`
      : chain.direction === 'reverse'
        ? `Chain ${index + 1} (reverse path, depth ${chain.edges.length})`
      : `Chain ${index + 1} (depth ${chain.edges.length})`;
    lines.push(c.header(title));
    if (chain.direction === 'reverse') {
      lines.push(c.dim('Calls flow in the opposite direction of the requested query.'));
    }
    for (let step = 0; step < chain.nodes.length; step++) {
      const node = chain.nodes[step];
      lines.push(`${'  '.repeat(step)}${node.name} (${formatLocation(node)})`);
      const edge = chain.edges[step];
      if (edge) {
        const extra = edge.status === 'ambiguous' && edge.candidates && edge.candidates.length > 0
          ? ` (${edge.candidates.length} candidates)`
          : '';
        lines.push(`${'  '.repeat(step)}${c.dim(`calls [${edge.status}] at line ${edge.line ?? '?'}${extra}`)}`);
      }
    }
    if (chain.status === 'blocked_ambiguous' && chain.blockedBy && chain.blockedAt) {
      const candidates = chain.blockedBy.candidates?.slice(0, 3).map(formatCandidate).join(', ') ?? '';
      const extra = candidates ? `: ${candidates}` : '';
      lines.push(`${'  '.repeat(chain.nodes.length - 1)}${c.dim(`blocked by ambiguous call "${chain.blockedBy.targetName ?? '(unknown)'}" at line ${chain.blockedBy.line ?? '?'}${extra}`)}`);
    }
    if (index < chains.length - 1) lines.push('');
  }
  return lines.join('\n') + '\n';
}

export function formatFusedResults(results: FusedSearchResult[], ci = false): string {
  const c = palette(ci);
  if (results.length === 0) return `${c.dim('No fused search results found.')}\n`;

  const table = new Table({
    head: [c.key('Name'), c.key('Type'), c.key('Location'), c.key('Score'), c.key('Sources')],
    chars: tableChars(ci),
    style: { head: [], border: [] },
  });

  for (const result of results) {
    table.push([
      c.value(result.name.slice(0, 60)),
      result.type,
      result.relativePath ? `${result.relativePath}${result.line ? `:${result.line}` : ''}` : result.path,
      result.score.toFixed(4),
      result.sources.map(s => `${s.method}#${s.rank}`).join(', '),
    ]);
  }

  return `${tableTitle('Fused Search', addSeparators(table.toString(), ci), ci)}\n`;
}
