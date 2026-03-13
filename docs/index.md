<h1 align="center">OCC</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@cesarandreslopez/occ"><img src="https://img.shields.io/npm/v/@cesarandreslopez/occ?label=npm" alt="npm"></a>
  <a href="https://www.npmjs.com/package/@cesarandreslopez/occ"><img src="https://img.shields.io/npm/dt/@cesarandreslopez/occ?label=npm%20Downloads" alt="npm Downloads"></a>
  <a href="https://github.com/cesarandreslopez/occ/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://github.com/cesarandreslopez/occ/actions/workflows/ci.yml"><img src="https://github.com/cesarandreslopez/occ/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://deepwiki.com/cesarandreslopez/occ"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

<p align="center">
  <strong>Office Cloc and Count</strong> — document metrics, structure extraction, content inspection, and code exploration for real repositories.
</p>

---

> **Experimental:** All features in OCC are currently experimental. This project cannot be considered stable software yet. APIs, output formats, and command interfaces may change between minor versions.

OCC provides several command families:

- `occ [directories...]` for office document metrics, structure extraction, and `scc` code metrics
- `occ doc inspect`, `occ sheet inspect`, `occ slide inspect` for format-specific document preflight
- `occ table inspect` for structured table content extraction
- `occ code ...` for on-demand repository exploration over an in-memory code graph

## Feature Highlights

- **Office document metrics** for DOCX, XLSX, PPTX, PDF, ODT, ODS, and ODP
- **Document structure extraction** with `--structure`
- **Document inspection** via `occ doc inspect` — metadata, risk flags, content stats, and preview for DOCX/ODT
- **Spreadsheet inspection** via `occ sheet inspect` — schema preview, risk flags, and token estimates for XLSX
- **Presentation inspection** via `occ slide inspect` — slide inventory, risk flags, and content preview for PPTX/ODP
- **Table extraction** via `occ table inspect` — structured table data from DOCX, XLSX, PPTX, ODT, and ODP
- **Code metrics via scc** during default scans
- **Code exploration via `occ code`** with exact search, pattern search, content search, callers/callees, dependency categories, inheritance, and blocked-chain reporting
- **Explicit relationship status** through `resolved`, `ambiguous`, and `unresolved`
- **Dependency categorization** into local, external, and unresolved imports
- **JSON-first automation support** across all command families
- **Zero required services** for `occ code`; no database or daemon

## Why OCC?

Tools like `scc`, `cloc`, and `tokei` give you fast visibility into code. OCC extends that visibility to the rest of the repository:

- office documents that usually sit outside engineering metrics
- document structure that is useful for navigation and RAG pipelines
- repository code relationships that are useful for interactive exploration and agent workflows

### For Humans

- **Project audits** — quantify documentation footprint alongside source code
- **Migration planning** — quickly find both the documents and the symbols that matter
- **Onboarding** — scan a repo once, then drill into specific classes, functions, and dependencies

### For AI Agents

- **Context budgeting** — estimate document volume before ingestion
- **Document triage** — inspect documents, spreadsheets, and presentations for risk flags and token estimates before deep reading
- **Table extraction** — extract structured table data directly from documents without parsing raw XML
- **Repository mapping** — combine `occ --format json` for document inventory with `occ code ... --format json` for symbol and relationship data
- **RAG chunk mapping** — use `--structure --format json` to recover section boundaries and character offsets

## Quick Install

```bash
# Global install
npm i -g @cesarandreslopez/occ
occ

# No-install usage
npx @cesarandreslopez/occ docs/ reports/
```

## Quick Examples

```bash
# Document metrics + scc summary
occ docs/

# Document structure
occ --structure docs/

# Inspect a document for metadata and risk flags
occ doc inspect report.docx --format json

# Extract tables from a spreadsheet
occ table inspect finance.xlsx --format json

# Exact symbol lookup
occ code find name UserService --path .

# Inspect outgoing calls with ambiguity reporting
occ code analyze calls ambiguousCaller --path test/fixtures/code-explore

# Dependency inspection with local/external/unresolved grouping
occ code analyze deps src/deps --path test/fixtures/code-explore

# Call chain that reports blocked ambiguity
occ code analyze chain ambiguousCaller duplicate --path test/fixtures/code-explore
```

## Next Steps

- [Installation](getting-started/installation.md) — install methods and runtime notes
- [Quick Start](getting-started/quick-start.md) — first-run walkthrough for both command families
- [CLI Reference](usage/cli-reference.md) — full command and flag reference
- [Output Formats](usage/output-formats.md) — tabular and JSON payloads
- [Architecture](architecture/overview.md) — document pipeline and code graph internals
