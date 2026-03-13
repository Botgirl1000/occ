# Installation

## Prerequisites

- **Node.js 18+** — OCC requires Node.js version 18 or later

## npm (Global Install)

Install OCC globally to make the `occ` command available everywhere:

```bash
npm i -g @cesarandreslopez/occ
```

Then run it from any directory:

```bash
occ docs/
occ code find name UserService --path .
```

## npx (No Install)

Run OCC without installing it globally:

```bash
npx @cesarandreslopez/occ docs/ reports/
npx @cesarandreslopez/occ code find name Greeter --path .
```

## Build from Source

```bash
git clone https://github.com/cesarandreslopez/occ.git
cd occ
npm install
npm run build
npm test
npm link    # makes `occ` available globally
```

Or run in dev mode without building:

```bash
npx tsx bin/occ.ts docs/
npx tsx bin/occ.ts code analyze deps src/deps --path test/fixtures/code-explore
```

## scc Binary

OCC auto-downloads the [scc](https://github.com/boyter/scc) binary (v3.7.0) during `npm install` for code metrics in the default `occ [directories...]` scan flow. The binary is placed in the `vendor/` directory.

If the download fails, OCC falls back to looking for `scc` on your system PATH.

To skip the automatic download:

```bash
SCC_SKIP_DOWNLOAD=1 npm install
```

!!! note "Code metrics are optional"
    If scc is not available, OCC still works — it just won't show the code metrics section in the default scan flow. You can also explicitly skip that section with `--no-code`.

## Code Exploration Support

`occ code` does not require a database or background service. It builds an in-memory graph on demand from the repository you point it at.

`occ code` also does not depend on the `scc` binary. The `scc` integration is only used for summary code metrics during the default scan command.

The code exploration path is tuned for:

- JavaScript
- TypeScript
- Python

Other languages may be discovered and partially parsed, but they are not yet the primary compatibility target.
