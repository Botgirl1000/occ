import fg from 'fast-glob';
import { stat } from 'node:fs/promises';
import { OFFICE_EXTENSIONS } from './utils.js';
import type { FileEntry, SkippedEntry } from './types.js';

export interface FindFilesOptions {
  includeExt?: string;
  excludeExt?: string;
  excludeDir?: string[];
  noGitignore?: boolean;
  largeFileLimit?: number;
}

export interface FindFilesResult {
  files: FileEntry[];
  skipped: SkippedEntry[];
}

export async function findFiles(directories: string[], options: FindFilesOptions = {}): Promise<FindFilesResult> {
  const {
    includeExt,
    excludeExt,
    excludeDir = ['node_modules', '.git'],
    noGitignore = false,
    largeFileLimit = 50,
  } = options;

  let extensions = OFFICE_EXTENSIONS;
  if (includeExt) {
    extensions = includeExt.split(',').map(e => e.trim().toLowerCase());
  }
  if (excludeExt) {
    const excluded = new Set(excludeExt.split(',').map(e => e.trim().toLowerCase()));
    extensions = extensions.filter(e => !excluded.has(e));
  }

  if (extensions.length === 0) {
    return { files: [], skipped: [] };
  }

  const pattern = extensions.length === 1
    ? `**/*.${extensions[0]}`
    : `**/*.{${extensions.join(',')}}`;

  const ignore = excludeDir.map(d => `**/${d}/**`);

  const dirs = directories.length > 0 ? directories : [process.cwd()];
  const allPaths: string[] = [];
  for (const dir of dirs) {
    const found = await fg(pattern, {
      cwd: dir,
      absolute: true,
      ignore,
      dot: false,
      onlyFiles: true,
      followSymbolicLinks: false,
    });
    allPaths.push(...found);
  }

  const limitBytes = largeFileLimit * 1024 * 1024;
  const files: FileEntry[] = [];
  const skipped: SkippedEntry[] = [];

  // Batch stat calls for better throughput on large directories
  const BATCH_SIZE = 50;
  for (let i = 0; i < allPaths.length; i += BATCH_SIZE) {
    const batch = allPaths.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(p => stat(p)));
    for (let j = 0; j < results.length; j++) {
      const p = batch[j];
      const r = results[j];
      if (r.status === 'rejected') {
        const err = r.reason as NodeJS.ErrnoException;
        skipped.push({ path: p, reason: err.code === 'EACCES' ? 'Permission denied' : err.message, size: 0 });
      } else if (r.value.size > limitBytes) {
        skipped.push({ path: p, reason: `Exceeds ${largeFileLimit}MB limit`, size: r.value.size });
      } else {
        files.push({ path: p, size: r.value.size });
      }
    }
  }

  return { files, skipped };
}
