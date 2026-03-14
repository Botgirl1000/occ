# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install deps + auto-download scc binary via postinstall
npm run build        # Compile TypeScript → dist/
npm run dev          # Run via tsx (no build needed)
npm start            # Run compiled output (equivalent to: node dist/bin/occ.js)
npm test             # Build + run all tests (node:test runner via tsx)
npm link             # Make `occ` available globally

# Run a single test file
node --import tsx --test test/doc-inspect.test.ts

# Run directly
node dist/bin/occ.js [directories...] [options]

# Dev mode (no build step)
npx tsx bin/occ.ts [directories...] [options]

# Generate test fixtures (DOCX + XLSX samples)
node test/create-fixtures.js
```

## Architecture

OCC is a TypeScript ES module (`"type": "module"`) CLI tool that scans directories for office documents, extracts metrics, and optionally shells out to [scc](https://github.com/boyter/scc) for code metrics. It also supports hierarchical document structure extraction via the `--structure` flag.

Source lives in `src/` and `bin/` as `.ts` files. `npm run build` compiles to `dist/` via `tsc`. The `scripts/postinstall.js` remains plain JS (runs before devDeps are available).

### Module flow

```
bin/occ.ts → src/cli.ts (orchestrator)
               ├→ src/walker.ts          — file discovery via fast-glob
               ├→ src/parsers/index.ts   — routes to format-specific parser
               │    ├→ parsers/docx.ts   — mammoth (words, pages, paragraphs)
               │    ├→ parsers/pdf.ts    — pdf-parse (words, pages)
               │    ├→ parsers/xlsx.ts   — SheetJS/xlsx (sheets, rows, cells)
               │    ├→ parsers/pptx.ts   — JSZip + officeparser (words, slides)
               │    └→ parsers/odf.ts    — JSZip + officeparser (odt/ods/odp)
               ├→ src/stats.ts           — aggregation, sorting, column detection
               ├→ src/scc.ts             — finds/invokes vendored or PATH scc binary
               ├→ src/markdown/convert.ts — document → markdown conversion
               ├→ src/structure/
               │    ├→ types.ts          — StructureNode, DocumentStructure, PageMapping
               │    ├→ extract.ts        — header extraction + tree building
               │    └→ index.ts          — re-exports
               ├→ src/inspect/shared.ts  — shared inspect utilities (properties, tokens, payloads)
               ├→ src/doc/command.ts     — `occ doc inspect` for DOCX/ODT/PDF
               ├→ src/sheet/command.ts   — `occ sheet inspect` for XLSX
               ├→ src/slide/command.ts   — `occ slide inspect` for PPTX/ODP
               ├→ src/code/             — `occ code` subcommands (explore, build, find, query)
               │    ├→ command.ts       — CLI registration for code subcommands
               │    ├→ build.ts         — builds a CodebaseIndex (nodes + edges)
               │    ├→ discover.ts      — code file discovery via fast-glob
               │    ├→ parsers.ts       — regex-based code parsing (functions, classes, imports)
               │    ├→ query.ts         — graph queries (deps, callers, chains, tree)
               │    ├→ languages.ts     — language specs and extension mappings
               │    ├→ output.ts        — code query formatters
               │    └→ types.ts         — CodeNode, CodeEdge, CodebaseIndex types
               ├→ src/table/
               │    ├→ command.ts        — `occ table inspect` CLI registration
               │    ├→ inspect.ts        — format router
               │    ├→ inspect-docx.ts   — DOCX tables via mammoth HTML
               │    ├→ inspect-xlsx.ts   — XLSX tables via SheetJS
               │    ├→ inspect-pptx.ts   — PPTX tables from slide XML
               │    ├→ inspect-odt.ts    — ODT tables from content.xml
               │    ├→ inspect-odp.ts    — ODP tables from content.xml
               │    ├→ output.ts         — tabular + JSON formatters
               │    └→ types.ts          — table extraction types
               └→ src/output/
                    ├→ tabular.ts        — cli-table3 terminal tables
                    ├→ json.ts           — JSON output
                    └→ tree.ts           — structure tree formatter
```

### Key patterns

- **Parser interface**: Each parser returns `ParserOutput { fileType, metrics }`. The router in `parsers/index.ts` dispatches by extension and wraps results with `ParseResult { filePath, size, success }`.
- **Shared types**: `src/types.ts` defines `FileEntry`, `SkippedEntry`, `ParserOutput`, `ParseResult`.
- **Batch concurrency**: `parseFiles()` processes 10 files concurrently using chunked `Promise.allSettled`.
- **scc integration**: `src/scc.ts` prefers the vendored binary at `vendor/scc`, falls back to PATH. The postinstall script (`scripts/postinstall.js`) downloads scc v3.7.0 for the current platform. Set `SCC_SKIP_DOWNLOAD=1` to skip.
- **Output modes**: Stats object from `aggregate()` drives both tabular and JSON formatters. Columns are auto-detected based on which metrics have data.
- **Structure extraction** (`--structure`): Converts documents to markdown (mammoth → turndown for DOCX, pdf-parse with page markers for PDF), then extracts headers to build a tree with dotted structure codes (1, 1.1, 1.2, 2, ...).
- **`src/utils.ts`**: Shared helpers — `countWords`, `formatBytes`, `formatNumber`, `getExtension`, `OFFICE_EXTENSIONS`, `EXTENSION_TO_TYPE`.
- **Zod validation**: Options and data structures are validated with Zod schemas (defined alongside their types). CLI option schemas live in the relevant command files; shared validation helpers are in `src/cli-validation.ts`.
- **Testing**: Uses Node.js built-in `node:test` runner with `node:assert/strict`. Tests import source `.ts` files directly via `tsx`. Test fixtures live in `test/fixtures/`.

## Refactoring Status

**Phase 3 complete** — modular TypeScript refactoring. See `specs/refactor/` for architecture, `specs/*/progress.md` for per-module status.

### Module Map

The existing directory structure IS the target architecture. All 7 modules extracted and verified:

| Module | Layer | Location | Status |
|--------|-------|----------|--------|
| `shared` | 0 | `src/types.ts`, `src/utils.ts`, `src/@types/` | Done |
| `pipeline` | 1 | `src/walker.ts`, `src/parsers/`, `src/stats.ts`, `src/scc.ts`, `src/progress.ts`, `src/cli-validation.ts` | Done |
| `content` | 1 | `src/markdown/`, `src/structure/`, `src/inspect/` | Done |
| `output` | 2 | `src/output/` | Done |
| `code` | 3 | `src/code/` | Done |
| `inspect-commands` | 3 | `src/doc/`, `src/sheet/`, `src/slide/`, `src/table/` | Done |
| `cli` | 4 | `src/cli.ts` | Done |

### Key Changes in Phase 3

- Extracted `getCell`, `renderCell`, `isNonEmptyCell` from `sheet/inspect.ts` to `inspect/xlsx-cells.ts` (Decision D3)
- Eliminated `table→sheet` cross-domain dependency
- Deprecated re-export shim in `sheet/inspect.ts` for backwards compatibility
- Import DAG linter updated: `table` no longer depends on `sheet`

### Rules

- Every PR must be under ~300 lines changed (excluding tests)
- `npx tsc --noEmit` must pass after every commit
- `npm test` must pass after every commit
- `node scripts/check-imports.mjs` must pass (DAG enforcement)
- `npx madge --circular --extensions ts,tsx src/` must show no cycles
- No new `any` types
- Re-exports follow the pattern in `specs/refactor/re-export-template.md`

## Verification

- Run `node dist/bin/occ.js test/fixtures/` to verify document scanning works
- Run `node dist/bin/occ.js --format json test/fixtures/` to verify JSON output
- Run `node dist/bin/occ.js --structure test/fixtures/` to verify structure extraction
- Run `node dist/bin/occ.js --structure --format json test/fixtures/` to verify structure JSON
- Run `node dist/bin/occ.js doc inspect test/fixtures/sample.docx` to verify document inspection
- Run `node dist/bin/occ.js sheet inspect test/fixtures/sample.xlsx` to verify sheet inspection
- Run `node dist/bin/occ.js slide inspect test/fixtures/sample.pptx` to verify slide inspection
- Run `node dist/bin/occ.js table inspect test/fixtures/sample.xlsx --format json` to verify table extraction
