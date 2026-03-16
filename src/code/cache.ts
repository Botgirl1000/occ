import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { buildCodebaseIndex, type BuildCodebaseOptions } from './build.js';
import type { CodebaseIndex } from './types.js';

export interface CachedCodebaseIndex extends CodebaseIndex {
  cacheVersion: string;
  cachedAt: string;
  fileHashes: Record<string, string>;
}

const CACHE_VERSION = '1';

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function defaultCachePath(repoRoot: string): string {
  return path.join(repoRoot, '.occ-cache', 'index.json');
}

export async function loadIndexCache(cachePath: string): Promise<CachedCodebaseIndex | undefined> {
  try {
    const raw = await readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw) as CachedCodebaseIndex;
    if (parsed.cacheVersion !== CACHE_VERSION) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function saveIndexCache(index: CachedCodebaseIndex, cachePath: string): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true });
  // Strip file content from cache to reduce size - content can be re-read
  const slimFiles = index.files.map(f => ({
    ...f,
    content: '',
    lines: [],
  }));
  const slimIndex = { ...index, files: slimFiles };
  await writeFile(cachePath, JSON.stringify(slimIndex), 'utf8');
}

export function invalidateCache(cachePath: string): Promise<void> {
  return writeFile(cachePath, '', 'utf8').catch(() => { /* ignore if missing */ });
}

export async function buildCodebaseIndexCached(options: BuildCodebaseOptions & {
  cachePath?: string;
}): Promise<CachedCodebaseIndex> {
  const repoRoot = path.resolve(options.repoRoot);
  const cachePath = options.cachePath ?? defaultCachePath(repoRoot);

  // Always do a full build (incremental rebuild would require re-reading all files
  // to compute hashes anyway, and the build is fast enough for most repos)
  const index = await buildCodebaseIndex(options);

  const fileHashes: Record<string, string> = {};
  for (const file of index.files) {
    fileHashes[file.relativePath] = hashContent(file.content);
  }

  const cached: CachedCodebaseIndex = {
    ...index,
    cacheVersion: CACHE_VERSION,
    cachedAt: new Date().toISOString(),
    fileHashes,
  };

  await saveIndexCache(cached, cachePath);
  return cached;
}
