# CLI Reference

## Synopsis

```bash
occ [directories...] [options]
```

If no directories are specified, OCC scans the current working directory.

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--by-file` / `-f` | Show a row per file instead of grouped by type | grouped by type |
| `--format <type>` | Output format: `tabular` or `json` | `tabular` |
| `--include-ext <exts>` | Comma-separated extensions to include | all supported |
| `--exclude-ext <exts>` | Comma-separated extensions to skip | none |
| `--exclude-dir <dirs>` | Directories to skip (comma-separated) | `node_modules,.git` |
| `--no-gitignore` | Disable .gitignore respect | enabled |
| `--sort <col>` | Sort by: `files`, `name`, `words`, `size` | `files` |
| `--output <file>` / `-o` | Write output to file instead of stdout | stdout |
| `--ci` | ASCII-only output, no colors | off |
| `--large-file-limit <mb>` | Skip files over this size in MB | `50` |
| `--structure` | Extract and display document heading hierarchy | off |
| `--no-code` | Skip scc code analysis | off |
| `--version` / `-V` | Print version and exit | |
| `--help` / `-h` | Print help and exit | |

## Flag Details

### `--by-file` / `-f`

Show one row per file instead of grouping by document type:

```bash
occ --by-file docs/
```

### `--format <type>`

Choose between `tabular` (default terminal tables) or `json` (machine-readable):

```bash
occ --format json docs/
```

### `--include-ext <exts>`

Only scan specific file extensions:

```bash
occ --include-ext pdf,docx docs/
```

### `--exclude-ext <exts>`

Skip specific file extensions:

```bash
occ --exclude-ext xlsx,pptx docs/
```

### `--exclude-dir <dirs>`

Skip entire directories (comma-separated):

```bash
occ --exclude-dir node_modules,.git,vendor,build docs/
```

### `--no-gitignore`

By default, OCC respects `.gitignore` rules. Use this flag to scan all files regardless:

```bash
occ --no-gitignore docs/
```

### `--sort <col>`

Sort output rows by a column. Available values: `files`, `name`, `words`, `size`:

```bash
occ --sort words docs/
```

### `--output <file>` / `-o`

Write output to a file instead of stdout:

```bash
occ --output report.txt docs/
occ --format json -o report.json docs/
```

### `--ci`

ASCII-only output with no ANSI color codes, suitable for CI pipelines:

```bash
occ --ci docs/
```

### `--large-file-limit <mb>`

Skip files exceeding the specified size in megabytes:

```bash
occ --large-file-limit 100 docs/
```

### `--structure`

Extract and display document heading hierarchy. Works with DOCX, PDF, PPTX, ODT, and ODP. Spreadsheets (XLSX, ODS) are skipped since they have no heading hierarchy.

```bash
# Tree view of headings per document
occ --structure docs/

# Structure as JSON (includes nodes with character offsets and page mappings)
occ --structure --format json docs/

# Combine with other flags
occ --structure --by-file --no-code docs/
```

The structure output runs alongside existing metrics — the metrics pipeline is untouched.

### `--no-code`

Skip the scc code analysis section entirely:

```bash
occ --no-code docs/
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (invalid arguments, scc not found, etc.) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SCC_SKIP_DOWNLOAD` | Set to `1` to skip automatic scc binary download during `npm install` |
