import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { OFFICE_EXTENSIONS } from './utils.js';

const execFileAsync = promisify(execFile);

export interface SccLanguage {
  Name: string;
  Count: number;
  Lines: number;
  Blank: number;
  Comment: number;
  Code: number;
  Files?: SccFile[];
  [key: string]: unknown;
}

export interface SccFile {
  Filename?: string;
  Location?: string;
  Lines: number;
  Blank: number;
  Comment: number;
  Code: number;
  [key: string]: unknown;
}

export interface RunSccOptions {
  byFile?: boolean;
  excludeDir?: string[];
  sort?: string;
  ci?: boolean;
  noGitignore?: boolean;
}

function getVendoredSccPath(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const binary = process.platform === 'win32' ? 'scc.exe' : 'scc';
  // Works from both src/ (dev) and dist/src/ (built)
  const candidate1 = path.join(__dirname, '..', 'vendor', binary);
  const candidate2 = path.join(__dirname, '..', '..', 'vendor', binary);
  if (existsSync(candidate1)) return candidate1;
  return candidate2;
}

async function findScc(): Promise<string | null> {
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

export async function checkScc(): Promise<string> {
  const binary = await findScc();
  if (!binary) {
    throw new Error(
      'scc is required but not found.\n' +
      'Run "npm install" to auto-download it, or install manually from https://github.com/boyter/scc'
    );
  }
  return binary;
}

export async function runScc(sccBinary: string | null, directories: string[], options: RunSccOptions = {}): Promise<SccLanguage[]> {
  const {
    byFile = false,
    excludeDir = [],
    sort,
    ci = false,
    noGitignore = false,
  } = options;

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
    const sortMap: Record<string, string> = { files: 'files', name: 'name', size: 'lines', words: 'lines' };
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

    return JSON.parse(stdout) as SccLanguage[];
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      throw new Error('scc binary not found.');
    }
    // scc exited non-zero or produced no output
    process.stderr.write(`Warning: scc returned an error: ${error.message}\n`);
    return [];
  }
}
