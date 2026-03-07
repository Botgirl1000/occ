# occ — Office Cloc and Count

scc-style summary tables for office documents. Scans directories for DOCX, XLSX, PPTX, PDF, ODT, ODS, and ODP files, extracting metrics like word counts, page counts, slide counts, and cell counts. When code files are also present, auto-detects them and shells out to [scc](https://github.com/boyter/scc) for code metrics, printing both sections together.

## Prerequisites

- **Node.js** >= 18.0.0

## Install

```bash
git clone <repo-url> && cd occ
npm install       # auto-downloads scc binary for your platform
npm link          # optional, makes `occ` available globally
```

The `scc` binary is automatically downloaded during `npm install`. If the download fails (e.g. behind a firewall), occ falls back to `scc` on your PATH. Set `SCC_SKIP_DOWNLOAD=1` to skip the auto-download entirely.

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

# Only specific formats
occ --include-ext pdf,docx docs/

# Skip code analysis
occ --no-code docs/

# CI-friendly (ASCII, no color)
occ --ci docs/
```

## Example Output

```
── Documents ───────────────────────────────────────────────────────
Format        Files    Words    Pages    Extra          Size
────────────────────────────────────────────────────────────────────
Word             12   34,210      137    1,203 paras    1.2 MB
PDF               8   22,540       64                   4.5 MB
Excel             3                      12 sheets      890 KB
────────────────────────────────────────────────────────────────────
Total            23   56,750      201    1,203 paras    6.5 MB
────────────────────────────────────────────────────────────────────

── Code (via scc) ──────────────────────────────────────────────────
Language         Files    Lines   Blanks  Comments     Code
────────────────────────────────────────────────────────────────────
JavaScript          15     2340      180       320     1840
Python               8     1200       90       150      960
────────────────────────────────────────────────────────────────────
Total               23     3540      270       470     2800
────────────────────────────────────────────────────────────────────
```

## Supported Formats

| Format | Extension | Metrics |
|--------|-----------|---------|
| Word | `.docx` | words, pages*, paragraphs |
| PDF | `.pdf` | words, pages |
| Excel | `.xlsx` | sheets, rows, cells |
| PowerPoint | `.pptx` | words, slides |
| ODT | `.odt` | words, pages*, paragraphs |
| ODS | `.ods` | sheets, rows, cells |
| ODP | `.odp` | words, slides |

\* Pages for Word/ODT are estimated at 250 words/page.

## CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--by-file` / `-f` | Row per file | grouped by type |
| `--format <type>` | `tabular` or `json` | `tabular` |
| `--include-ext <exts>` | Comma-separated extensions | all supported |
| `--exclude-ext <exts>` | Comma-separated to skip | none |
| `--exclude-dir <dirs>` | Directories to skip | `node_modules,.git` |
| `--no-gitignore` | Disable .gitignore respect | enabled |
| `--sort <col>` | Sort by: files, name, words, size | `files` |
| `--output <file>` / `-o` | Write to file | stdout |
| `--ci` | ASCII-only, no color | off |
| `--large-file-limit <mb>` | Skip files over this size | `50` |
| `--no-code` | Skip scc code analysis | off |
