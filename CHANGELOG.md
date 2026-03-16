# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.1] - 2026-03-16

### Added

- `occ code index` command — builds and emits the full codebase index (files, symbols, edges, language capabilities) as JSON or a summary line

## [0.6.0] - 2026-03-16

### Added

- `--show-confidence` flag displays confidence levels (`exact` or `estimated`) for each metric in both tabular and JSON output
- Tabular output annotates estimated metrics with a `~` suffix and a `~ estimated metric` footnote when `--show-confidence` is enabled
- JSON output includes a `confidence` object per file row (e.g. `{ "words": "exact", "pages": "estimated" }`) when `--show-confidence` is enabled
- Confidence merging in grouped mode: if any file in a group has an estimated metric, the group's confidence for that metric is `estimated`
- `./types` and `./stats` subpath exports in `package.json` — consumers can now import `ConfidenceLevel`, `ParseResult`, `StatsRow`, and `AggregateResult` directly

## [0.5.1] - 2026-03-16

### Fixed

- XLSX header cells in markdown conversion now escape pipe (`|`) and newline characters, matching the existing data row escaping
- `npm test` script uses `test/*.test.ts` instead of `test/**/*.test.ts` for Node 18 compatibility (shell `**` glob requires bash globstar or Node 21+)
- Remove duplicate `countWords` function in `src/code/chunk.ts`; now imports from shared `src/utils.ts`
- Add `types` conditions to all `package.json` subpath exports so TypeScript consumers using `moduleResolution: "NodeNext"` resolve `.d.ts` files correctly

## [0.5.0] - 2026-03-15

### Added

- `exports` field with subpath imports for the code exploration module (`./code/build`, `./code/types`, `./code/query`, `./code/discover`) and root entry point (`.`) — consumers can now use clean imports instead of fragile deep paths into `dist/`
- TypeScript as an optional `peerDependency` (`>=5.0.0`) — consumers using the code exploration module programmatically can provide their own TypeScript installation

### Changed

- The `exports` field restricts importable entry points. Consumers relying on unlisted deep imports into `dist/` will need to use the declared subpath exports instead

## [0.4.1] - 2026-03-14

### Added

- Barrel re-export resolution: `occ code analyze calls/callers/chain` now resolves call targets through `index.ts` barrel files
- Zod runtime schema validation across all CLI options and data types (parsers, walker, stats, output, structure, and all inspect commands)

### Changed

- Enable `noImplicitReturns` and `noFallthroughCasesInSwitch` TypeScript compiler options for stricter type safety
- Extract shared XLSX cell utilities to `src/inspect/xlsx-cells.ts`
- Remove deprecated re-export shim from `src/sheet/inspect.ts`

## [0.4.0] - 2026-03-13

> **Note:** All features in OCC are currently experimental. This project cannot be considered stable software yet. APIs, output formats, and command interfaces may change between minor versions.

### Added

- `occ table inspect <file>` — extract structured table content from DOCX, XLSX, PPTX, ODT, and ODP as JSON or tabular output, with auto-detected headers, sample row limits, merged cell support, and per-table token estimates
- `occ doc inspect <file>` — document metadata, risk flags, content stats, heading structure, and content preview for DOCX and ODT
- `occ slide inspect <file>` — presentation metadata, risk flags, per-slide inventory, and content preview for PPTX and ODP
- `occ sheet inspect <file>` — XLSX workbook preflight with sheet inventory, schema preview, risk flags, and token estimates
- TypeScript interfaces, type aliases, enums, and `implements` clauses are now indexed in `occ code` exploration
- Directory targets in `occ code analyze deps` now aggregate imports across all files in the directory

### Fixed

- Bidirectional chain analysis: `occ code analyze chain` now searches both directions and labels reverse paths explicitly
- Code inheritance lookups disambiguate correctly when interfaces and classes share the same name
- Directory dependency matches are preserved when aggregating across multiple files

## [0.3.1] - 2026-03-10

### Fixed

- Upgrade xlsx from 0.18.5 to 0.20.3 (official SheetJS tarball), resolving npm vulnerability ([#1](https://github.com/cesarandreslopez/occ/pull/1) — thanks [@B33pBeeps](https://github.com/B33pBeeps))
- Configure `XLSX.set_fs(fs)` for ESM compatibility with SheetJS 0.20+

## [0.3.0] - 2026-03-10

### Added

- `occ code` command family for on-demand code exploration
- First-class JavaScript, TypeScript, and Python exploration support
- Automated fixture-based tests for code graph queries and output contracts

### Changed

- Improved call resolution for `this`, `super`, `self`, `cls`, and imported aliases
- Ambiguous calls and blocked call chains now surface candidate locations
- Dependency analysis now separates local, external, and unresolved imports

## [0.2.0] - 2026-03-09

### Added

- **Document structure extraction** — new `--structure` flag parses heading hierarchy from DOCX, PDF, PPTX, ODT, and ODP files, displaying a navigable tree with dotted section codes (1, 1.1, 1.2, 2, ...)
- Structure tree output in tabular mode with indented headings, dotted leaders, and page ranges (when available)
- Structure data in JSON output under a `structures` key (only when `--structure` is used)
- Page-to-section mapping for PDFs via `[Page N]` markers

### Changed

- **Migrated entire codebase to TypeScript** — all source files under `src/` and `bin/` are now `.ts` with strict type checking
- Added `npm run build` (compiles to `dist/`) and `npm run dev` (runs via tsx without build step)
- Published package now ships compiled `dist/` instead of raw `src/`
- New dependency: `turndown` (HTML-to-markdown conversion for DOCX structure extraction)
- New devDependencies: `typescript`, `@types/node`, `tsx`, `@types/turndown`

## [0.1.2] - 2026-03-07

### Changed

- Rename "Extra" column to "Details" for clarity
- Remove redundant top/bottom table borders for cleaner output
- Remove inter-row separators, keep only header and totals borders
- Right-align numeric columns in document table
- Apply consistent number coloring to all scc table columns
- Make section header width match table width dynamically
- Use ASCII-only dashes in section headers during `--ci` mode
- Parsers return only populated metric fields instead of null-filled objects
- Batch stat calls in walker for better throughput on large directories
- Pass scc binary path explicitly instead of module-level state

### Added

- Summary line showing scan scope, word/page counts, and elapsed time
- Word and page counts in summary line for at-a-glance utility
- SHA-256 checksum verification for scc binary downloads in postinstall
- Input validation for `--large-file-limit` (rejects NaN values)

### Fixed

- "No office documents found." message no longer shown when code results are present
- Table separator width mismatch between top-mid and middle characters

## [0.1.1] - 2026-03-07

### Changed

- Replace ExcelJS with SheetJS (xlsx) for XLSX parsing, eliminating deprecated transitive dependencies (rimraf, fstream, inflight, lodash.isequal, glob v7)

### Fixed

- Ensure `test/fixtures/` directory exists before creating test fixtures (fixes CI failure)
- Fix `workflow_dispatch` trigger in docs workflow (remove invalid `branches` key)
- Fix Node 22+ compatibility in release workflow (`require()` instead of `import()` with `assert`)
- Update GitHub Pages deployment branch policy from `master` to `main`

## [0.1.0] - 2026-03-07

### Added

- CLI tool for scanning directories for office documents (DOCX, XLSX, PPTX, PDF, ODT, ODS, ODP)
- Word count, page count, paragraph count, slide count, sheet/row/cell count extraction
- Automatic code metrics via scc integration (vendored binary with PATH fallback)
- Per-file (`--by-file`) and grouped-by-type output modes
- JSON output (`--format json`) for automation
- Extension filtering (`--include-ext`, `--exclude-ext`)
- Directory exclusion (`--exclude-dir`, default: node_modules,.git)
- .gitignore-aware file discovery (disable with `--no-gitignore`)
- Sortable output (`--sort`: files, name, words, size)
- File output (`--output`)
- CI mode (`--ci`) for ASCII-only, no-color output
- Large file skip threshold (`--large-file-limit`, default: 50MB)
- Progress bar with ETA
- Auto-download of scc binary during `npm install` (skip with `SCC_SKIP_DOWNLOAD=1`)

[0.6.1]: https://github.com/cesarandreslopez/occ/releases/tag/v0.6.1
[0.6.0]: https://github.com/cesarandreslopez/occ/releases/tag/v0.6.0
[0.5.1]: https://github.com/cesarandreslopez/occ/releases/tag/v0.5.1
[0.5.0]: https://github.com/cesarandreslopez/occ/releases/tag/v0.5.0
[0.4.1]: https://github.com/cesarandreslopez/occ/releases/tag/v0.4.1
[0.4.0]: https://github.com/cesarandreslopez/occ/releases/tag/v0.4.0
[0.3.1]: https://github.com/cesarandreslopez/occ/releases/tag/v0.3.1
[0.3.0]: https://github.com/cesarandreslopez/occ/releases/tag/v0.3.0
[0.2.0]: https://github.com/cesarandreslopez/occ/releases/tag/v0.2.0
[0.1.2]: https://github.com/cesarandreslopez/occ/releases/tag/v0.1.2
[0.1.1]: https://github.com/cesarandreslopez/occ/releases/tag/v0.1.1
[0.1.0]: https://github.com/cesarandreslopez/occ/releases/tag/v0.1.0
