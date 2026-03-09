<h1 align="center">OCC</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@cesarandreslopez/occ"><img src="https://img.shields.io/npm/v/@cesarandreslopez/occ?label=npm" alt="npm"></a>
  <a href="https://www.npmjs.com/package/@cesarandreslopez/occ"><img src="https://img.shields.io/npm/dt/@cesarandreslopez/occ?label=npm%20Downloads" alt="npm Downloads"></a>
  <a href="https://github.com/cesarandreslopez/occ/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://github.com/cesarandreslopez/occ/actions/workflows/ci.yml"><img src="https://github.com/cesarandreslopez/occ/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  <strong>Office Cloc and Count</strong> — scc-style summary tables for office documents.
</p>

---

OCC scans directories for office documents (DOCX, XLSX, PPTX, PDF, ODT, ODS, ODP), extracts metrics like word counts, page counts, slide counts, and cell counts, and displays them in scc-style summary tables. When code files are also present, it auto-detects them and shells out to [scc](https://github.com/boyter/scc) for code metrics, printing both sections together.

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

## Feature Highlights

- **Office document metrics** — words, pages, paragraphs, slides, sheets, rows, cells
- **Seven formats supported** — DOCX, XLSX, PPTX, PDF, ODT, ODS, ODP
- **Document structure extraction** — `--structure` parses heading hierarchy into a navigable tree with dotted section codes
- **Code metrics via scc** — auto-detects code files and integrates scc output
- **Multiple output modes** — grouped by type, per-file breakdown, or JSON
- **CI-friendly** — ASCII-only, no-color mode for pipelines
- **Flexible filtering** — include/exclude extensions, exclude directories, .gitignore-aware
- **Progress bar** — with ETA for large scans
- **Zero config** — auto-downloads scc binary on install, works out of the box

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
- **Repository mapping** — agents exploring an unfamiliar codebase can run `occ --format json` to build a structured inventory of all non-code content alongside `scc` code metrics
- **Pipeline integration** — JSON output pipes directly into agent toolchains for automated document analysis, summarization, or compliance checking

## Quick Install

```bash
# Global install
npm i -g @cesarandreslopez/occ
occ

# No-install usage
npx @cesarandreslopez/occ docs/ reports/
```

## Next Steps

- [Installation](getting-started/installation.md) — all install methods
- [Quick Start](getting-started/quick-start.md) — first-run walkthrough
- [CLI Reference](usage/cli-reference.md) — every flag explained
- [Architecture](architecture/overview.md) — how it all fits together
