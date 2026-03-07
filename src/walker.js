import fg from 'fast-glob';
import { stat } from 'node:fs/promises';
import { OFFICE_EXTENSIONS } from './utils.js';

export async function findFiles(directories, options = {}) {
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

  const paths = await fg(pattern, {
    cwd: undefined,
    absolute: true,
    ignore,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
    ...(directories.length > 0 ? {} : { cwd: process.cwd() }),
  });

  // If directories specified, search each one
  let allPaths = [];
  if (directories.length > 0) {
    for (const dir of directories) {
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
  } else {
    allPaths = await fg(pattern, {
      cwd: process.cwd(),
      absolute: true,
      ignore,
      dot: false,
      onlyFiles: true,
      followSymbolicLinks: false,
    });
  }

  const limitBytes = largeFileLimit * 1024 * 1024;
  const files = [];
  const skipped = [];

  for (const p of allPaths) {
    try {
      const s = await stat(p);
      if (s.size > limitBytes) {
        skipped.push({ path: p, reason: `Exceeds ${largeFileLimit}MB limit`, size: s.size });
      } else {
        files.push({ path: p, size: s.size });
      }
    } catch (err) {
      skipped.push({ path: p, reason: err.code === 'EACCES' ? 'Permission denied' : err.message, size: 0 });
    }
  }

  return { files, skipped };
}
