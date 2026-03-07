import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { OFFICE_EXTENSIONS } from './utils.js';

const execFileAsync = promisify(execFile);

function getVendoredSccPath() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const binary = process.platform === 'win32' ? 'scc.exe' : 'scc';
  return path.join(__dirname, '..', 'vendor', binary);
}

async function findScc() {
  // Prefer vendored binary
  const vendored = getVendoredSccPath();
  if (existsSync(vendored)) return vendored;

  // Fall back to PATH
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const { stdout } = await execFileAsync(cmd, ['scc']);
    return stdout.trim().split('\n')[0];
  } catch {
    return null;
  }
}

let sccBinary = null;

export async function checkScc() {
  sccBinary = await findScc();
  if (!sccBinary) {
    throw new Error(
      'scc is required but not found.\n' +
      'Run "npm install" to auto-download it, or install manually from https://github.com/boyter/scc'
    );
  }
}

export async function runScc(directories, options = {}) {
  const {
    byFile = false,
    excludeDir = [],
    sort,
    ci = false,
    noGitignore = false,
  } = options;

  if (!sccBinary) sccBinary = await findScc();
  if (!sccBinary) return [];

  const args = ['--format', 'json'];

  // Exclude office extensions
  args.push('--exclude-ext', OFFICE_EXTENSIONS.join(','));

  if (byFile) args.push('--by-file');
  if (ci) args.push('--ci');
  if (noGitignore) args.push('--no-gitignore');

  for (const dir of excludeDir) {
    args.push('--exclude-dir', dir);
  }

  if (sort) {
    const sortMap = { files: 'files', name: 'name', size: 'lines', words: 'lines' };
    args.push('-s', sortMap[sort] || 'files');
  }

  // Add target directories
  const dirs = directories.length > 0 ? directories : ['.'];
  args.push(...dirs);

  try {
    const { stdout } = await execFileAsync(sccBinary, args, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    });

    if (!stdout.trim()) return [];

    return JSON.parse(stdout);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('scc binary not found.');
    }
    // scc exited non-zero or produced no output
    process.stderr.write(`Warning: scc returned an error: ${err.message}\n`);
    return [];
  }
}
