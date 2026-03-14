import fg from 'fast-glob';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { CODE_EXTENSIONS, normalizePath } from './languages.js';

export const DiscoverCodeOptionsSchema = z.object({
  excludeDir: z.array(z.string()).optional(),
  noGitignore: z.boolean().optional(),
});
export type DiscoverCodeOptions = z.infer<typeof DiscoverCodeOptionsSchema>;

async function loadGitignorePatterns(repoRoot: string): Promise<string[]> {
  try {
    const content = await readFile(path.join(repoRoot, '.gitignore'), 'utf8');
    return content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('!'))
      .map(line => {
        const normalized = normalizePath(line.replace(/^\//, ''));
        if (normalized.endsWith('/')) return `${normalized}**`;
        return normalized;
      });
  } catch {
    return [];
  }
}

export async function discoverCodeFiles(repoRoot: string, options: DiscoverCodeOptions = {}): Promise<string[]> {
  const excludeDir = options.excludeDir ?? ['node_modules', '.git', 'dist', 'vendor', 'build', 'coverage', 'target'];
  const ignore = excludeDir.flatMap(dir => [`**/${dir}/**`]);
  if (!options.noGitignore) {
    ignore.push(...await loadGitignorePatterns(repoRoot));
  }

  const pattern = CODE_EXTENSIONS.length === 1
    ? `**/*.${CODE_EXTENSIONS[0]}`
    : `**/*.{${CODE_EXTENSIONS.join(',')}}`;

  const discovered = await fg(pattern, {
    cwd: repoRoot,
    absolute: true,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    ignore,
  });

  const existing: string[] = [];
  for (const filePath of discovered.sort()) {
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) existing.push(filePath);
    } catch {
      // Ignore files that disappear during discovery.
    }
  }

  return existing;
}
