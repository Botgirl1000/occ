# Architecture Overview

OCC is a TypeScript ES module CLI with several execution paths:

- the default `occ [directories...]` pipeline for document metrics, structure extraction, and `scc` code metrics
- the `occ doc/sheet/slide inspect` commands for format-specific document preflight
- the `occ table inspect` command for structured table content extraction
- the `occ code ...` pipeline for on-demand repository exploration over an in-memory code graph

Source files live as `.ts` under `src/` and `bin/`, compiled to `dist/` via `tsc`. `scripts/postinstall.js` remains plain JS because it runs before dev dependencies are available.

## Module Flow

```mermaid
graph LR
    A[bin/occ.ts] --> B[src/cli.ts]
    B --> C[src/walker.ts]
    B --> D[src/parsers/index.ts]
    B --> E[src/stats.ts]
    B --> F[src/scc.ts]
    B --> G[src/output/tabular.ts]
    B --> H[src/output/json.ts]
    B --> I[src/markdown/convert.ts]
    B --> J[src/structure/extract.ts]
    B --> K[src/output/tree.ts]
    B --> L[src/code/command.ts]
    B --> L2[src/doc/command.ts]
    B --> L3[src/sheet/command.ts]
    B --> L4[src/slide/command.ts]
    B --> L5[src/table/command.ts]
    D --> M[src/parsers/docx.ts]
    D --> N[src/parsers/pdf.ts]
    D --> O[src/parsers/xlsx.ts]
    D --> P[src/parsers/pptx.ts]
    D --> Q[src/parsers/odf.ts]
    L --> R[src/code/build.ts]
    R --> S[src/code/discover.ts]
    R --> T[src/code/parsers.ts]
    L --> U[src/code/query.ts]
    L --> V[src/code/output.ts]
```

## Data Flow: Document Scan

```mermaid
graph TD
    A[CLI args] --> B[findFiles]
    B --> C[parseFiles]
    C --> D[aggregate]
    D --> E{format?}
    E -->|tabular| F[formatDocumentTable]
    E -->|json| G[formatJson]
    A --> H[runScc]
    H --> E
    B -->|--structure| I[documentToMarkdown]
    I --> J[extractFromMarkdown]
    J --> K{format?}
    K -->|tabular| L[formatStructureTree]
    K -->|json| G
    F --> M[stdout / file]
    L --> M
    G --> M
```

## Data Flow: Code Exploration

```mermaid
graph TD
    A[occ code ...] --> B[buildCodebaseIndex]
    B --> C[discoverCodeFiles]
    B --> D[parseCodeFile]
    D --> E[Normalized nodes + edges]
    E --> F[Query functions]
    F --> G{format?}
    G -->|tabular| H[src/code/output.ts]
    G -->|json| I[formatPayloadJson]
    H --> J[stdout / file]
    I --> J
```

## Code Graph Build Stages

The `occ code` path is intentionally simple at runtime:

1. discover supported code files under the chosen repo root
2. parse each file into normalized facts: symbols, imports, calls, and inheritance
3. resolve those facts into graph nodes and edges
4. run one query against the graph
5. format the result as a terminal view or JSON payload

The graph is rebuilt for each command. There is no daemon, cache, or persistent index.

## Source Tree

```
occ/
├── bin/occ.ts              # Entry point — calls cli.run()
├── src/
│   ├── cli.ts              # Orchestrator — arg parsing, pipeline
│   ├── types.ts            # Shared interfaces (FileEntry, ParseResult, etc.)
│   ├── walker.ts           # File discovery via fast-glob
│   ├── parsers/
│   │   ├── index.ts        # Routes to format-specific parser
│   │   ├── docx.ts         # mammoth (words, pages, paragraphs)
│   │   ├── pdf.ts          # pdf-parse (words, pages)
│   │   ├── xlsx.ts         # SheetJS/xlsx (sheets, rows, cells)
│   │   ├── pptx.ts         # JSZip + officeparser (words, slides)
│   │   └── odf.ts          # JSZip + officeparser (odt/ods/odp)
│   ├── markdown/
│   │   └── convert.ts      # Document → markdown conversion
│   ├── structure/
│   │   ├── types.ts        # StructureNode, DocumentStructure, PageMapping
│   │   ├── extract.ts      # Header extraction + tree building
│   │   └── index.ts        # Re-exports
│   ├── code/
│   │   ├── command.ts      # `occ code` command registration
│   │   ├── build.ts        # Graph builder + resolution pipeline
│   │   ├── cache.ts        # Index caching utilities
│   │   ├── chunk.ts        # Semantic code chunking
│   │   ├── discover.ts     # Code file discovery
│   │   ├── languages.ts    # Language support + import/path helpers
│   │   ├── parsers.ts      # JS/TS + Python-first parsers
│   │   ├── query.ts        # Symbol and relationship queries
│   │   ├── output.ts       # Tabular + JSON formatting for code queries
│   │   └── types.ts        # Graph/query/output types
│   ├── doc/
│   │   ├── command.ts      # `occ doc` command registration
│   │   ├── batch.ts        # Batch document inspection
│   │   ├── discover.ts     # Document file discovery
│   │   ├── inspect.ts      # Document format router
│   │   ├── inspect-docx.ts # DOCX metadata + content extraction
│   │   ├── inspect-odt.ts  # ODT metadata + content extraction
│   │   ├── output.ts       # Tabular + JSON formatting
│   │   └── types.ts        # Document inspection types
│   ├── sheet/
│   │   ├── command.ts      # `occ sheet` command registration
│   │   ├── inspect.ts      # XLSX workbook inspection
│   │   ├── output.ts       # Tabular + JSON formatting
│   │   └── types.ts        # Sheet inspection types
│   ├── slide/
│   │   ├── command.ts      # `occ slide` command registration
│   │   ├── inspect.ts      # Presentation format router
│   │   ├── inspect-pptx.ts # PPTX metadata + slide extraction
│   │   ├── output.ts       # Tabular + JSON formatting
│   │   └── types.ts        # Slide inspection types
│   ├── table/
│   │   ├── command.ts      # `occ table` command registration
│   │   ├── inspect.ts      # Table format router
│   │   ├── inspect-docx.ts # DOCX table extraction via mammoth HTML
│   │   ├── inspect-xlsx.ts # XLSX table extraction via SheetJS
│   │   ├── inspect-pptx.ts # PPTX table extraction from slide XML
│   │   ├── inspect-odt.ts  # ODT table extraction from content.xml
│   │   ├── inspect-odp.ts  # ODP table extraction from content.xml
│   │   ├── output.ts       # Tabular + JSON formatting
│   │   └── types.ts        # Table extraction types
│   ├── inspect/
│   │   ├── shared.ts       # Shared inspect utilities (properties, tokens, payloads)
│   │   └── xlsx-cells.ts   # Shared XLSX cell utilities (getCell, renderCell, isNonEmptyCell)
│   ├── stats.ts            # Aggregation, sorting, column detection
│   ├── scc.ts              # Finds/invokes vendored or PATH scc binary
│   ├── cli-validation.ts   # Shared Zod schemas for CLI option validation
│   ├── progress.ts         # Progress bar with ETA
│   ├── utils.ts            # Shared helpers
│   └── output/
│       ├── tabular.ts      # cli-table3 terminal tables
│       ├── json.ts         # JSON output
│       └── tree.ts         # Structure tree formatter
├── test/
│   ├── code-explore.test.ts   # Code exploration regression tests
│   ├── create-fixtures.js     # Document fixture generation
│   └── fixtures/              # Document + code exploration fixtures
├── dist/                   # Compiled output (generated by `npm run build`)
├── scripts/postinstall.js  # Downloads scc binary for current platform
└── vendor/                 # Vendored scc binary (auto-downloaded)
```

## Key Design Decisions

- **TypeScript with strict mode** — the entire codebase uses TypeScript with `strict: true`, compiled via `tsc` to `dist/`
- **ES modules** — native ES module syntax (`import`/`export`), set via `"type": "module"` in `package.json`
- **Dual-path support** — `import.meta.url`-based path resolution works from both `src/` (dev via tsx) and `dist/src/` (built)
- **Batch concurrency** — files are parsed 10 at a time using chunked `Promise.allSettled` to balance throughput and memory usage
- **Auto-detected columns** — the output table columns are determined dynamically based on which metrics actually have data (e.g., the "Details" column only appears when paragraphs, sheets, or slides are present)
- **Vendored scc** — the scc binary is auto-downloaded during `npm install` for zero-config code metrics, with PATH fallback if the download fails
- **Structure extraction pipeline** — documents are converted to markdown first (mammoth + turndown for DOCX, pdf-parse with page markers for PDF), then headers are extracted and assembled into a tree. This two-stage approach reuses existing parser dependencies and produces a uniform intermediate format
- **On-demand code graph** — `occ code` does not keep a persistent database; it builds a repository graph in memory for each command
- **JS/TS + Python first** — the current resolver and fixtures are optimized around JavaScript, TypeScript, and Python behavior
- **Explicit ambiguity** — code queries prefer `resolved` / `ambiguous` / `unresolved` states over pretending uncertain edges are definitive
- **Human + JSON parity** — ambiguity details, dependency categories, and chain-blocking reasons are surfaced in both terminal and JSON output
- **Format-specific inspection** — `occ doc`, `occ sheet`, `occ slide`, and `occ table` provide deep inspection of individual files with format-aware extraction, reusing existing parser dependencies (mammoth, SheetJS, JSZip)
- **Table extraction via existing parsers** — `occ table inspect` extracts structured table data without new dependencies by parsing mammoth HTML output (DOCX), SheetJS cell data (XLSX), slide XML (PPTX), and content.xml (ODT/ODP)
