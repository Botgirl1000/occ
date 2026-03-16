import fg from 'fast-glob';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export interface DiscoveredDocument {
  filePath: string;
  relativePath: string;
  format: 'docx' | 'pdf' | 'pptx' | 'xlsx' | 'odt' | 'ods' | 'odp';
  sizeBytes: number;
}

const DOCUMENT_EXTENSIONS = ['docx', 'pdf', 'pptx', 'xlsx', 'odt', 'ods', 'odp'] as const;

type DocumentFormat = typeof DOCUMENT_EXTENSIONS[number];

function isDocumentFormat(ext: string): ext is DocumentFormat {
  return (DOCUMENT_EXTENSIONS as readonly string[]).includes(ext);
}

async function loadGitignorePatterns(rootDir: string): Promise<string[]> {
  try {
    const content = await readFile(path.join(rootDir, '.gitignore'), 'utf8');
    return content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('!'))
      .map(line => {
        const normalized = line.replace(/^\//, '').split(path.sep).join('/');
        if (normalized.endsWith('/')) return `${normalized}**`;
        return normalized;
      });
  } catch {
    return [];
  }
}

export async function discoverDocuments(rootDir: string, options?: {
  excludeDir?: string[];
  maxSizeBytes?: number;
}): Promise<DiscoveredDocument[]> {
  const resolvedRoot = path.resolve(rootDir);
  const excludeDir = options?.excludeDir ?? ['node_modules', '.git', 'dist', 'vendor', 'build', 'coverage', 'target'];
  const maxSizeBytes = options?.maxSizeBytes ?? 50 * 1024 * 1024; // 50MB

  const ignore = [
    ...excludeDir.flatMap(dir => [`**/${dir}/**`]),
    ...await loadGitignorePatterns(resolvedRoot),
  ];

  const pattern = `**/*.{${DOCUMENT_EXTENSIONS.join(',')}}`;

  const discovered = await fg(pattern, {
    cwd: resolvedRoot,
    absolute: true,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    ignore,
  });

  const documents: DiscoveredDocument[] = [];
  for (const filePath of discovered.sort()) {
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile() || fileStat.size > maxSizeBytes) continue;

      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      if (!isDocumentFormat(ext)) continue;

      documents.push({
        filePath,
        relativePath: path.relative(resolvedRoot, filePath).split(path.sep).join('/'),
        format: ext,
        sizeBytes: fileStat.size,
      });
    } catch {
      // Skip files that disappear during discovery
    }
  }

  return documents;
}
