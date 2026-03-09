# Quick Start

## Your First Scan

Run OCC on any directory containing office documents:

```bash
occ docs/
```

OCC will discover all supported files (DOCX, XLSX, PPTX, PDF, ODT, ODS, ODP), extract metrics, and display a summary table.

## Understanding the Output

OCC produces up to three sections:

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

**Code (via scc)** — if code files are found, scc metrics appear automatically:

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
```

!!! tip "Scan the current directory"
    Running `occ` with no arguments scans the current working directory.

!!! tip "JSON output for scripting"
    Use `--format json` to pipe OCC output into `jq` or other tools for automated processing.

## Next Steps

- [CLI Reference](../usage/cli-reference.md) — every flag explained with examples
- [Output Formats](../usage/output-formats.md) — tabular, JSON, and file output
- [Filtering](../usage/filtering.md) — include/exclude extensions and directories
- [Supported Formats](../formats/overview.md) — what metrics each format provides
