import path from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { CodeCapabilitiesSchema } from './types.js';

export const ParserTypeSchema = z.enum(['typescript', 'python', 'go', 'rust', 'generic']);
export type ParserType = z.infer<typeof ParserTypeSchema>;

export const LanguageSpecSchema = z.object({
  name: z.string(),
  extensions: z.array(z.string()),
  parser: ParserTypeSchema,
  capabilities: CodeCapabilitiesSchema,
});
export type LanguageSpec = z.infer<typeof LanguageSpecSchema>;

export const LANGUAGE_SPECS: LanguageSpec[] = [
  {
    name: 'javascript',
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    parser: 'typescript',
    capabilities: { definitions: true, imports: true, calls: true, inheritance: true, content: true },
  },
  {
    name: 'typescript',
    extensions: ['ts', 'tsx'],
    parser: 'typescript',
    capabilities: { definitions: true, imports: true, calls: true, inheritance: true, content: true },
  },
  {
    name: 'python',
    extensions: ['py'],
    parser: 'python',
    capabilities: { definitions: true, imports: true, calls: true, inheritance: true, content: true },
  },
  {
    name: 'go',
    extensions: ['go'],
    parser: 'go',
    capabilities: { definitions: true, imports: true, calls: true, inheritance: false, content: true },
  },
  {
    name: 'rust',
    extensions: ['rs'],
    parser: 'rust',
    capabilities: { definitions: true, imports: true, calls: true, inheritance: false, content: true },
  },
  {
    name: 'generic',
    extensions: ['java', 'rb', 'php', 'c', 'h', 'hpp', 'hh', 'cpp', 'cc', 'cxx', 'cs', 'kt', 'scala', 'swift'],
    parser: 'generic',
    capabilities: { definitions: true, imports: true, calls: false, inheritance: false, content: true },
  },
];

const EXTENSION_TO_SPEC = new Map<string, LanguageSpec>();
for (const spec of LANGUAGE_SPECS) {
  for (const extension of spec.extensions) {
    EXTENSION_TO_SPEC.set(extension, spec);
  }
}

export const CODE_EXTENSIONS = [...EXTENSION_TO_SPEC.keys()].sort();

export function getLanguageSpec(filePath: string): LanguageSpec | null {
  const extension = path.extname(filePath).toLowerCase().replace('.', '');
  return EXTENSION_TO_SPEC.get(extension) ?? null;
}

export function getModuleName(repoRoot: string, filePath: string): string {
  const relative = normalizePath(path.relative(repoRoot, filePath));
  return relative.replace(/\.[^.]+$/, '');
}

export function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

export function isLocalSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/');
}

export function resolveLocalImport(
  repoRoot: string,
  fromFile: string,
  specifier: string,
): string | undefined {
  const fromDir = path.dirname(fromFile);
  const candidateBase = path.resolve(specifier.startsWith('/') ? repoRoot : fromDir, specifier.startsWith('/') ? `.${specifier}` : specifier);
  const candidates = new Set<string>([
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    `${candidateBase}.js`,
    `${candidateBase}.jsx`,
    `${candidateBase}.mjs`,
    `${candidateBase}.cjs`,
    `${candidateBase}.py`,
    `${candidateBase}.go`,
    `${candidateBase}.rs`,
    `${candidateBase}.java`,
    `${candidateBase}.rb`,
    `${candidateBase}.php`,
    `${candidateBase}.c`,
    `${candidateBase}.cpp`,
    `${candidateBase}.h`,
    `${candidateBase}.hpp`,
    path.join(candidateBase, 'index.ts'),
    path.join(candidateBase, 'index.tsx'),
    path.join(candidateBase, 'index.js'),
    path.join(candidateBase, 'index.jsx'),
    path.join(candidateBase, 'index.py'),
  ]);
  for (const candidate of candidates) {
    const spec = getLanguageSpec(candidate);
    if (spec && existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function resolvePythonImport(
  repoRoot: string,
  fromFile: string,
  specifier: string,
): string | undefined {
  const fromDir = path.dirname(fromFile);

  if (specifier.startsWith('.')) {
    const relativeSpecifier = specifier.replace(/\./g, '/');
    return resolveLocalImport(repoRoot, fromFile, relativeSpecifier);
  }

  const dottedPath = specifier.replace(/\./g, '/');
  const sameDirCandidate = path.resolve(fromDir, `${dottedPath}.py`);
  if (getLanguageSpec(sameDirCandidate)?.name === 'python' && existsSync(sameDirCandidate)) return sameDirCandidate;

  const repoCandidate = path.resolve(repoRoot, `${dottedPath}.py`);
  if (getLanguageSpec(repoCandidate)?.name === 'python' && existsSync(repoCandidate)) return repoCandidate;

  const sameDirInit = path.resolve(fromDir, dottedPath, '__init__.py');
  if (getLanguageSpec(sameDirInit)?.name === 'python' && existsSync(sameDirInit)) return sameDirInit;

  const repoInit = path.resolve(repoRoot, dottedPath, '__init__.py');
  if (getLanguageSpec(repoInit)?.name === 'python' && existsSync(repoInit)) return repoInit;

  return undefined;
}
