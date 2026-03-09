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
```

## npx (No Install)

Run OCC without installing it globally:

```bash
npx @cesarandreslopez/occ docs/ reports/
```

## Build from Source

```bash
git clone https://github.com/cesarandreslopez/occ.git
cd occ
npm install
npm run build
npm link    # makes `occ` available globally
```

Or run in dev mode without building:

```bash
npx tsx bin/occ.ts docs/
```

## scc Binary

OCC auto-downloads the [scc](https://github.com/boyter/scc) binary (v3.7.0) during `npm install` for code metrics. The binary is placed in the `vendor/` directory.

If the download fails, OCC falls back to looking for `scc` on your system PATH.

To skip the automatic download:

```bash
SCC_SKIP_DOWNLOAD=1 npm install
```

!!! note "Code metrics are optional"
    If scc is not available, OCC still works — it just won't show the code metrics section. You can also explicitly skip code analysis with `--no-code`.
