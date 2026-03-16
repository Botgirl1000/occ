<h1 align="center">OCC</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@cesarandreslopez/occ"><img src="https://img.shields.io/npm/v/@cesarandreslopez/occ?label=npm" alt="npm"></a>
  <a href="https://www.npmjs.com/package/@cesarandreslopez/occ"><img src="https://img.shields.io/npm/dt/@cesarandreslopez/occ?label=npm%20Downloads" alt="npm Downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://github.com/cesarandreslopez/occ/actions/workflows/ci.yml"><img src="https://github.com/cesarandreslopez/occ/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://deepwiki.com/cesarandreslopez/occ"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

<p align="center">
  <strong>Office Cloc and Count</strong> — document metrics, structure extraction, content inspection, and code exploration for real repositories.
</p>

> **Experimental:** All features in OCC are currently experimental. This project cannot be considered stable software yet. APIs, output formats, and command interfaces may change between minor versions.

## What is this?

OCC started as a way to make office documents visible in the same workflows that already work well for code metrics tools like `scc` and `cloc`. It has since grown into a multi-purpose CLI that can:

- scan office documents for word/page/sheet/slide metrics
- extract document heading structure for navigation and RAG-style use cases
- inspect documents (`occ doc inspect`), spreadsheets (`occ sheet inspect`), and presentations (`occ slide inspect`) for metadata, risk flags, and content previews
- extract structured table content from documents (`occ table inspect`)
- summarize code metrics through `scc`
- explore JavaScript, TypeScript, and Python repositories with symbol search, call analysis, dependency inspection, and inheritance queries (`occ code`)

## Features

- **Office document metrics** — words, pages, paragraphs, slides, sheets, rows, cells
- **Seven formats supported** — DOCX, XLSX, PPTX, PDF, ODT, ODS, ODP
- **Document structure extraction** — `--structure` parses heading hierarchy into a navigable tree with dotted section codes (1, 1.1, 1.2, ...)
- **Document inspection via `occ doc inspect`** — metadata, risk flags, content stats, heading structure, and content preview for DOCX and ODT
- **Spreadsheet inspection via `occ sheet inspect`** — workbook properties, hidden sheets, names, formulas, links, comments, schema preview, and token estimates for XLSX
- **Presentation inspection via `occ slide inspect`** — metadata, risk flags, per-slide inventory, and content preview for PPTX and ODP
- **Table extraction via `occ table inspect`** — structured table content from DOCX, XLSX, PPTX, ODT, and ODP with auto-detected headers, sample row limits, and merged cell support
- **Code metrics via scc** — auto-detects code files and integrates scc output
- **Code exploration via `occ code`** — JS/TS and Python-first symbol lookup, content search, callers/callees, dependency categories, inheritance, and ambiguity-aware chains
- **Multiple output modes** — grouped by type, per-file breakdown, or JSON
- **CI-friendly** — ASCII-only, no-color mode for pipelines
- **Flexible filtering** — include/exclude extensions, exclude directories, .gitignore-aware
- **Progress bar** — with ETA for large scans
- **Zero config** — auto-downloads scc binary on install, works out of the box

## Quick Start

**Global install:**

```bash
npm i -g @cesarandreslopez/occ
occ
```

**No-install usage:**

```bash
npx @cesarandreslopez/occ docs/ reports/
```

**From source:**

```bash
git clone https://github.com/cesarandreslopez/occ.git && cd occ
npm install
npm run build
npm test
npm start
```

## Usage

```bash
# Scan current directory
occ

# Scan specific directories
occ docs/ reports/

# Per-file breakdown
occ --by-file docs/

# JSON output
occ --format json docs/

# Extract document structure (heading hierarchy)
occ --structure docs/

# Structure as JSON
occ --structure --format json docs/

# Inspect a document for metadata, risk flags, and content preview
occ doc inspect report.docx
occ doc inspect report.docx --format json

# Inspect an XLSX workbook before reading its contents deeply
occ sheet inspect finance.xlsx
occ sheet inspect finance.xlsx --format json --sample-rows 3 --max-columns 12

# Inspect a presentation for slide inventory and content preview
occ slide inspect deck.pptx
occ slide inspect deck.pptx --format json --slide 3

# Extract structured table data from documents
occ table inspect report.docx --format json
occ table inspect finance.xlsx --table 1 --sample-rows 10

# Explore JS/TS and Python code
occ code find name UserService --path .
occ code analyze callers createUser --path .
occ code analyze deps src/deps --path .
occ code analyze chain ambiguousCaller duplicate --path .

# Only specific formats
occ --include-ext pdf,docx docs/

# Skip code analysis
occ --no-code docs/

# CI-friendly (ASCII, no color)
occ --ci docs/
```

## Example Output

```
-- Documents ---------------------------------------------------------------
  Format    Files    Words    Pages                  Details      Size
----------------------------------------------------------------------------
  Word         12   34,210      137              1,203 paras    1.2 MB
  PDF           8   22,540       64                             4.5 MB
  Excel         3                                12 sheets      890 KB
----------------------------------------------------------------------------
  Total        23   56,750      201              1,203 paras    6.5 MB

-- Code (via scc) ----------------------------------------------------------
  Language    Files    Lines   Blanks  Comments     Code
----------------------------------------------------------------------------
  JavaScript     15     2340      180       320     1840
  Python          8     1200       90       150      960
----------------------------------------------------------------------------
  Total          23     3540      270       470     2800

Scanned 23 documents (56,750 words, 201 pages) in 120ms
```

### Structure Output (`--structure`)

```
-- Structure: report.docx --------------------------------------------------
1   Executive Summary
  1.1   Background ......................................... p.1
  1.2   Key Findings ....................................... p.1-2
2   Methodology
  2.1   Data Collection .................................... p.3
  2.2   Analysis Framework ................................. p.4
    2.2.1   Quantitative Methods ........................... p.4
    2.2.2   Qualitative Methods ............................ p.5
3   Results ................................................ p.6-8
4   Conclusions ............................................ p.9

4 sections, 10 nodes, max depth 3
```

## Supported Formats

| Format | Extension | Metrics | Structure |
|--------|-----------|---------|-----------|
| Word | `.docx` | words, pages*, paragraphs | Yes |
| PDF | `.pdf` | words, pages | Yes (with page mapping) |
| Excel | `.xlsx` | sheets, rows, cells | — |
| PowerPoint | `.pptx` | words, slides | Yes (slide headers) |
| ODT | `.odt` | words, pages*, paragraphs | Yes (best-effort) |
| ODS | `.ods` | sheets, rows, cells | — |
| ODP | `.odp` | words, slides | Yes (slide headers) |

\* Pages for Word/ODT are estimated at 250 words/page.

## CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--by-file` / `-f` | Row per file | grouped by type |
| `--format <type>` | `tabular` or `json` | `tabular` |
| `--structure` | Extract and display document heading hierarchy | off |
| `--include-ext <exts>` | Comma-separated extensions | all supported |
| `--exclude-ext <exts>` | Comma-separated to skip | none |
| `--exclude-dir <dirs>` | Directories to skip | `node_modules,.git` |
| `--no-gitignore` | Disable .gitignore respect | enabled |
| `--sort <col>` | Sort by: files, name, words, size | `files` |
| `--output <file>` / `-o` | Write to file | stdout |
| `--ci` | ASCII-only, no color | off |
| `--large-file-limit <mb>` | Skip files over this size | `50` |
| `--no-code` | Skip scc code analysis | off |
| `--show-confidence` | Show confidence levels for each metric | off |

## Code Exploration

`occ code` adds on-demand code exploration without changing the existing document-scan workflow. It builds an in-memory repository graph for each command and does not require a database, daemon, or background indexer.

The first-class support path is **JavaScript, TypeScript, and Python**. Other languages may be discovered and partially parsed, but the current resolver, fixtures, and output contracts are intentionally optimized around JS/TS and Python behavior.

```bash
# Exact symbol lookup
occ code find name Greeter --path test/fixtures/code-explore

# Substring search
occ code find pattern service --path .

# Full-text content search
occ code find content normalize_name --path .

# Outgoing and incoming call analysis
occ code analyze calls bootstrap --path test/fixtures/code-explore
occ code analyze callers createUser --path test/fixtures/code-explore

# Dependency and inheritance inspection
occ code analyze deps src/service --path test/fixtures/code-explore
occ code analyze tree UserService --path test/fixtures/code-explore

# Ambiguity-aware chain analysis
occ code analyze chain ambiguousCaller duplicate --path test/fixtures/code-explore
```

Highlights of the current code exploration behavior:

- **Exact, pattern, type, and content search** over the repository graph
- **Call analysis** with explicit `resolved`, `ambiguous`, and `unresolved` states
- **Receiver-aware method resolution** for `this`, `super`, `self`, and `cls`
- **Dependency analysis** grouped into local, external, and unresolved imports
- **Chain analysis** that reports when a path is blocked by ambiguity instead of silently returning nothing
- **Shared CLI ergonomics** with `--path`, `--format`, `--output`, `--exclude-dir`, and `.gitignore` support

All `occ code` commands support `--format tabular|json`. Most symbol-targeted commands also support `--file` for disambiguation, and JSON output includes repository metadata, query metadata, results, repository stats, and per-language capability flags.

## Programmatic Usage

The code exploration module is available as a library via subpath exports:

```ts
import { buildCodebaseIndex } from '@cesarandreslopez/occ/code/build';
import { discoverCodeFiles } from '@cesarandreslopez/occ/code/discover';
import { findByName, analyzeCalls } from '@cesarandreslopez/occ/code/query';
import type { CodebaseIndex, CodeNode } from '@cesarandreslopez/occ/code/types';

const index = await buildCodebaseIndex({ repoRoot: './my-repo' });
const results = findByName(index, 'UserService');
```

Available subpath exports:

| Import path | Description |
|-------------|-------------|
| `@cesarandreslopez/occ/code/build` | `buildCodebaseIndex` — graph construction |
| `@cesarandreslopez/occ/code/types` | TypeScript types (`CodebaseIndex`, `CodeNode`, `CodeEdge`, etc.) |
| `@cesarandreslopez/occ/code/query` | Query functions (`findByName`, `analyzeCalls`, `analyzeDeps`, etc.) |
| `@cesarandreslopez/occ/code/discover` | `discoverCodeFiles` — file discovery |
| `@cesarandreslopez/occ/code/chunk` | `chunkCodebase`, `chunkFromIndex` — semantic code chunking |
| `@cesarandreslopez/occ/code/cache` | Index caching utilities |
| `@cesarandreslopez/occ/doc/inspect` | `inspectDocument` — document metadata and content extraction |
| `@cesarandreslopez/occ/doc/types` | Document inspection types |
| `@cesarandreslopez/occ/doc/discover` | Document file discovery |
| `@cesarandreslopez/occ/doc/batch` | Batch document inspection |
| `@cesarandreslopez/occ/markdown/convert` | `documentToMarkdown` — document-to-markdown conversion |
| `@cesarandreslopez/occ/structure/extract` | `extractFromMarkdown` — heading tree extraction |
| `@cesarandreslopez/occ/structure/types` | Structure types and helpers |
| `@cesarandreslopez/occ/sheet/inspect` | `inspectWorkbook` — XLSX workbook inspection |
| `@cesarandreslopez/occ/sheet/types` | Sheet inspection types |
| `@cesarandreslopez/occ/slide/inspect` | `inspectPresentation` — presentation inspection |
| `@cesarandreslopez/occ/table/inspect` | Table extraction from documents |
| `@cesarandreslopez/occ/types` | Shared types (`ConfidenceLevel`, `ParseResult`, `ParserOutput`, etc.) |
| `@cesarandreslopez/occ/stats` | Stats types (`StatsRow`, `AggregateResult`) and `aggregate()` |

TypeScript is an optional peer dependency (`>=5.0.0`). If you use the code exploration module programmatically, ensure TypeScript is available in your project.

## Document Inspection

`occ doc inspect` extracts metadata, risk flags, content stats, heading structure, and a content preview from DOCX and ODT documents.

```bash
# Document overview with content preview
occ doc inspect report.docx

# Machine-readable payload
occ doc inspect report.docx --format json

# More paragraphs in the preview
occ doc inspect report.docx --sample-paragraphs 10
```

Current document inspection surfaces:

- **Document properties** — title, author, dates, keywords
- **Risk flags** — comments, tracked changes, hyperlinks, embedded objects, macros, tables, encryption
- **Content stats** — words, pages, paragraphs, characters, tables, images
- **Heading structure** — tree with section codes and depth
- **Content preview** — first N paragraphs with heading detection
- **Token estimates** — preview and full-document token estimates

## Spreadsheet Inspection

`occ sheet inspect` is a lightweight XLSX preflight command aimed at both humans and agents. It helps answer "is this workbook worth reading in depth?" before spending tokens serializing cells or opening the file in Excel.

```bash
# Workbook-level summary + per-sheet schema/sample preview
occ sheet inspect finance.xlsx

# Machine-readable inspection payload
occ sheet inspect finance.xlsx --format json

# Narrow to one sheet and reduce preview width
occ sheet inspect finance.xlsx --sheet Revenue --sample-rows 3 --max-columns 8
```

Current XLSX inspection highlights:

- **Workbook metadata** — file size, workbook properties, custom properties, workbook-scoped names
- **Sheet inventory** — visible / hidden / very hidden sheets, used ranges, cell counts, formula/comment/link counts
- **Schema preview** — detected header row, inferred column types, coverage ratios, example values
- **Lightweight sampling** — small row previews designed for preflight rather than full extraction
- **Token estimates** — sample and full-sheet token estimates to guide downstream agent reads

## Presentation Inspection

`occ slide inspect` provides presentation metadata, risk flags, per-slide inventory, and content previews for PPTX and ODP files.

```bash
# Presentation overview with slide preview
occ slide inspect deck.pptx

# Machine-readable payload
occ slide inspect deck.pptx --format json

# Inspect a specific slide
occ slide inspect deck.pptx --slide 3
```

Current presentation inspection surfaces:

- **Presentation properties** — title, author, dates
- **Risk flags** — comments, speaker notes, hyperlinks, embedded media, animations, macros, charts, tables
- **Slide inventory** — per-slide title, word count, notes, images, tables, charts
- **Content preview** — text preview for sample slides
- **Token estimates** — preview and full-presentation token estimates

## Table Extraction

`occ table inspect` extracts structured table content from DOCX, XLSX, PPTX, ODT, and ODP documents. For AI agents, this is the primary way to read financial summaries, comparison matrices, and data tables without parsing raw XML.

```bash
# Extract all tables as JSON
occ table inspect report.docx --format json

# Tabular preview of table content
occ table inspect finance.xlsx

# Extract a specific table
occ table inspect finance.xlsx --table 1

# Limit sample rows
occ table inspect report.docx --sample-rows 5
```

Current table extraction highlights:

- **Multi-format support** — DOCX (via mammoth HTML), XLSX (via SheetJS), PPTX (from slide XML), ODT and ODP (from content.xml)
- **Auto-detected headers** — first row is treated as headers when values are unique strings
- **Merged cell support** — colspan and rowspan are preserved in the output
- **Sample row limits** — configurable maximum rows per table (default: 20)
- **Table filtering** — extract a specific table by index with `--table N`
- **Token estimates** — per-table and total token estimates
- **PDF graceful degradation** — returns empty tables with an informative note instead of unreliable heuristic output

## Documentation

Full documentation is available at [cesarandreslopez.github.io/occ](https://cesarandreslopez.github.io/occ/), including:

- [Installation](https://cesarandreslopez.github.io/occ/getting-started/installation/)
- [Quick Start](https://cesarandreslopez.github.io/occ/getting-started/quick-start/)
- [CLI Reference](https://cesarandreslopez.github.io/occ/usage/cli-reference/)
- [Output Formats](https://cesarandreslopez.github.io/occ/usage/output-formats/)
- [Architecture](https://cesarandreslopez.github.io/occ/architecture/overview/)
- [Changelog](https://cesarandreslopez.github.io/occ/changelog/)

## Why OCC?

Tools like `scc`, `cloc`, and `tokei` give you instant visibility into codebases — lines, languages, complexity. But most projects also contain Word documents, PDFs, spreadsheets, and presentations that are invisible to these tools. OCC fills that gap.

### For Humans

- **Project audits** — instantly see how much documentation lives alongside your code: total word counts, page counts, spreadsheet sizes, and presentation lengths
- **Tracking documentation growth** — run OCC in CI to monitor how documentation scales over time, catch bloat early, or enforce minimums
- **Onboarding** — new team members get a quick sense of a project's documentation footprint before diving in
- **Migration planning** — when moving to a new platform, know exactly what you're dealing with across hundreds of files and formats

### For AI Agents

- **Context budgeting** — LLMs have finite context windows. OCC's word and page counts let agents estimate how much of a document set they can ingest before hitting token limits
- **Prioritization** — an agent deciding which documents to read can use OCC's JSON output to rank files by size, word count, or type, focusing on the most relevant content first
- **RAG chunk mapping** — `--structure --format json` outputs heading trees with character offsets, enabling chunk-to-section mapping, scoped retrieval, and citation paths in RAG pipelines
- **Document triage** — `occ doc inspect --format json` surfaces risk flags, content stats, structure, and token estimates before an agent reads the full document
- **Spreadsheet triage** — `occ sheet inspect --format json` exposes sheet visibility, formulas, links, comments, schema hints, and token estimates before an agent expands workbook contents
- **Presentation triage** — `occ slide inspect --format json` provides slide inventory, risk flags, and content previews for quick assessment
- **Table extraction** — `occ table inspect --format json` extracts structured table data (headers, rows, cells) from documents, giving agents direct access to tabular content without parsing raw XML
- **Repository mapping** — agents exploring an unfamiliar codebase can combine `occ --format json` for document inventory with `occ code ... --format json` for symbol and relationship data
- **Pipeline integration** — JSON output pipes directly into agent toolchains for automated document analysis, summarization, or compliance checking

## How It Works

OCC is written in TypeScript and uses [fast-glob](https://github.com/mrmlnc/fast-glob) for file discovery, dispatches to format-specific parsers (mammoth for DOCX, pdf-parse for PDF, SheetJS for XLSX, JSZip + officeparser for PPTX/ODF), aggregates metrics, and renders output via cli-table3. For code metrics, it shells out to a vendored [scc](https://github.com/boyter/scc) binary (auto-downloaded during `npm install`, with PATH fallback).

For structure extraction (`--structure`), documents are first converted to markdown (mammoth + [turndown](https://github.com/mixmark-io/turndown) for DOCX, pdf-parse with page markers for PDF), then headers are extracted and assembled into a tree with dotted section codes.

For `occ code`, OCC builds an in-memory code graph on demand. JavaScript and TypeScript are parsed with the TypeScript compiler API, Python uses a language-specific parser, and the query engine resolves symbols, imports, calls, inheritance, ambiguities, and dependency categories without a persistent database.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## License

[MIT](LICENSE)
