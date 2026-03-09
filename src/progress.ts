import { basename } from 'node:path';

const BAR_WIDTH = 20;

export interface ProgressBar {
  update(increment: number, detail?: string): void;
  done(): void;
}

export interface ProgressOptions {
  total: number;
  label?: string;
  enabled?: boolean;
}

function noop() {}
const noopProgress: ProgressBar = { update: noop, done: noop };

export function createProgress({ total, label = 'Parsing', enabled = true }: ProgressOptions): ProgressBar {
  if (!enabled || !process.stderr.isTTY || total === 0) return noopProgress;

  let completed = 0;
  const startTime = Date.now();
  const cols = process.stderr.columns || 80;

  function render(detail?: string) {
    const pct = Math.round((completed / total) * 100);
    const filled = Math.round((completed / total) * BAR_WIDTH);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(BAR_WIDTH - filled);

    let remaining = '';
    if (completed > 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const eta = Math.round((elapsed / completed) * (total - completed));
      remaining = ` ~${eta}s remaining`;
    }

    const name = detail ? ' ' + basename(detail) : '';
    let line = `${label} [${bar}] ${completed}/${total} (${pct}%)${name}${remaining}`;

    if (line.length > cols) line = line.slice(0, cols);
    line = line.padEnd(cols);

    process.stderr.write('\r' + line);
  }

  return {
    update(increment: number, detail?: string) {
      completed += increment;
      render(detail);
    },
    done() {
      process.stderr.write('\r' + ' '.repeat(cols) + '\r');
    },
  };
}
