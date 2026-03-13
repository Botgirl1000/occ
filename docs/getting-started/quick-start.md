# Quick Start

> **Experimental:** All features in OCC are currently experimental. APIs, output formats, and command interfaces may change between minor versions.

OCC provides several entry points:

- `occ [directories...]` for document scanning and `scc` code metrics
- `occ doc inspect`, `occ sheet inspect`, `occ slide inspect` for format-specific document preflight
- `occ table inspect` for structured table content extraction
- `occ code ...` for repository exploration against a code graph

## Your First Scan

Run OCC on any directory containing office documents:

```bash
occ docs/
```

OCC will discover all supported document files (DOCX, XLSX, PPTX, PDF, ODT, ODS, ODP), extract metrics, and display a summary table. If code is present and `scc` is available, the scan also includes a code metrics section.

## Your First Code Query

Use the `occ code` namespace for on-demand code exploration:

```bash
occ code find name UserService --path .
occ code analyze calls bootstrap --path .
```

Unlike the default scan command, `occ code` targets a repository root with `--path` instead of positional directories.

The strongest support path is **JavaScript, TypeScript, and Python**. The code graph is built in memory for each command; there is no database or background service to start.

## Understanding the Output

For the default `occ` scan command, OCC can produce up to three sections:

**Documents** — metrics from office files, grouped by format:

```
-- Documents ---------------------------------------------------------------
  Format    Files    Words    Pages                  Details      Size
----------------------------------------------------------------------------
  Word         12   34,210      137              1,203 paras    1.2 MB
  PDF           8   22,540       64                             4.5 MB
  Excel         3                                12 sheets      890 KB
----------------------------------------------------------------------------
  Total        23   56,750      201              1,203 paras    6.5 MB
```

**Code (via scc)** — if code files are found and `scc` is available, code metrics appear automatically:

```
-- Code (via scc) ----------------------------------------------------------
  Language    Files    Lines   Blanks  Comments     Code
----------------------------------------------------------------------------
  JavaScript     15     2340      180       320     1840
----------------------------------------------------------------------------
  Total          15     2340      180       320     1840
```

**Structure** (with `--structure`) — heading hierarchy per document:

```
-- Structure: report.docx --------------------------------------------------
1   Executive Summary
  1.1   Background ......................................... p.1
  1.2   Key Findings ....................................... p.1-2
2   Methodology
  2.1   Data Collection .................................... p.3
3   Results ................................................ p.6-8

3 sections, 6 nodes, max depth 2
```

For `occ code`, OCC prints command-specific tables or JSON envelopes instead of the document summary. For example:

```bash
occ code analyze deps src/deps --path test/fixtures/code-explore
```

```
Repository: src/deps.ts

-- Local Imports ----------------------------------------------------------
  Local Module    Resolution    Specifier
  src/utils       resolved      ./utils

-- External Imports -------------------------------------------------------
  External Package    Resolution    Specifier
  node:path           resolved      node:path

-- Unresolved Imports -----------------------------------------------------
  Unresolved Import    Resolution    Specifier
  ./missing            unresolved    ./missing
```

## Inspecting Individual Documents

OCC can inspect individual files for metadata, content stats, and structured data:

```bash
# Document metadata, risk flags, and content preview
occ doc inspect report.docx
occ doc inspect report.docx --format json

# Spreadsheet schema, risk flags, and sample data
occ sheet inspect finance.xlsx --format json

# Presentation slide inventory and content preview
occ slide inspect deck.pptx --format json

# Extract structured table data from any supported format
occ table inspect finance.xlsx --format json
occ table inspect report.docx --table 1 --sample-rows 5
```

## Key Flags to Try

```bash
# Per-file breakdown instead of grouped by type
occ --by-file docs/

# JSON output for automation
occ --format json docs/

# Extract document structure
occ --structure docs/

# Structure as JSON (for RAG pipelines)
occ --structure --format json docs/

# Skip code analysis
occ --no-code docs/

# CI-friendly (ASCII, no color)
occ --ci docs/

# Only specific formats
occ --include-ext pdf,docx docs/

# Scan multiple directories
occ docs/ reports/ specs/

# Find code by exact name
occ code find name Greeter --path test/fixtures/code-explore

# Narrow an exact name lookup to one file
occ code find name duplicate --path test/fixtures/code-explore --file src/duplicate-a.ts

# Inspect dependency categories
occ code analyze deps python/deps --path test/fixtures/code-explore

# Show a chain blocked by ambiguity
occ code analyze chain ambiguousCaller duplicate --path test/fixtures/code-explore
```

!!! tip "Scan the current directory"
    Running `occ` with no arguments scans the current working directory.

!!! tip "JSON output for scripting"
    Use `--format json` to pipe OCC output into `jq` or other tools for automated processing.

## Next Steps

- [CLI Reference](../usage/cli-reference.md) — every flag explained with examples
- [Output Formats](../usage/output-formats.md) — tabular, JSON, and file output
- [Filtering](../usage/filtering.md) — document-scan filters and `occ code` repo exclusions
- [Architecture](../architecture/overview.md) — default scan and `occ code` internals
- [Supported Formats](../formats/overview.md) — what metrics each format provides
