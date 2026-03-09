# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install deps + auto-download scc binary via postinstall
npm run build        # Compile TypeScript → dist/
npm run dev          # Run via tsx (no build needed)
npm start            # Run compiled output (equivalent to: node dist/bin/occ.js)
npm link             # Make `occ` available globally

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

## Verification

- Run `node dist/bin/occ.js test/fixtures/` to verify document scanning works
- Run `node dist/bin/occ.js --format json test/fixtures/` to verify JSON output
- Run `node dist/bin/occ.js --structure test/fixtures/` to verify structure extraction
- Run `node dist/bin/occ.js --structure --format json test/fixtures/` to verify structure JSON
