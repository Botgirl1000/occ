# Output Formats

OCC supports two output formats: tabular (default) and JSON.

## Tabular Output (Default)

For the default `occ [directories...]` command, OCC renders terminal tables for document metrics and, when available, `scc` code metrics. If `--structure` is enabled, structure sections are appended after those tables.

```bash
occ docs/
```

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
----------------------------------------------------------------------------
  Total          15     2340      180       320     1840

Scanned 23 documents (56,750 words, 201 pages) in 120ms
```

Columns are auto-detected based on which metrics have data. For example, the "Details" column combines paragraphs, sheets, rows, cells, and slides and only appears when at least one format produces those metrics.

### Confidence Annotations

When `--show-confidence` is enabled, estimated metrics are annotated with a `~` suffix:

```
-- Documents ---------------------------------------------------------------
  Format    Files    Words    Pages                  Details      Size
----------------------------------------------------------------------------
  Word         12   34,210     137~              1,203 paras    1.2 MB
  PDF           8   22,540       64                             4.5 MB
----------------------------------------------------------------------------
  Total        23   56,750      201              1,203 paras    6.5 MB
~ estimated metric
```

A footnote (`~ estimated metric`) explains the annotation.

## JSON Output

Use `--format json` for machine-readable output:

```bash
occ --format json docs/
```

```json
{
  "documents": {
    "files": [
      {
        "type": "Word",
        "count": 12,
        "words": 34210,
        "pages": 137,
        "paragraphs": 1203,
        "sheets": 0,
        "rows": 0,
        "cells": 0,
        "slides": 0,
        "size": 1258291
      }
    ],
    "totals": {
      "files": 23,
      "words": 56750,
      "pages": 201,
      "paragraphs": 1203,
      "sheets": 12,
      "rows": 450,
      "cells": 5400,
      "slides": 0,
      "size": 6815744
    }
  },
  "code": [
    {
      "Name": "JavaScript",
      "Count": 15,
      "Lines": 2340,
      "Blank": 180,
      "Comment": 320,
      "Code": 1840
    }
  ]
}
```

The `documents` section always contains `files` (array of per-type or per-file entries) and `totals`. The `code` section is the raw `scc` JSON output and is only present when code files are found and `scc` is available.

When `--show-confidence` is enabled, each file entry includes a `confidence` object:

```json
{
  "type": "Word",
  "count": 12,
  "words": 34210,
  "pages": 137,
  "paragraphs": 1203,
  "size": 1258291,
  "confidence": {
    "words": "exact",
    "pages": "estimated",
    "paragraphs": "exact"
  }
}
```

The `confidence` object maps metric names to `"exact"` or `"estimated"`. It is omitted when `--show-confidence` is not used. Totals do not include confidence since they are computed sums.

When `--structure` is used, an additional `structures` key appears:

```json
{
  "documents": { ... },
  "structures": [
    {
      "file": "/path/to/report.docx",
      "totalNodes": 10,
      "maxDepth": 3,
      "nodes": [
        {
          "nodeId": "0001",
          "title": "Executive Summary",
          "level": 1,
          "startChar": 0,
          "endChar": 325,
          "startLine": 1,
          "structureCode": "1",
          "children": [
            {
              "nodeId": "0002",
              "title": "Background",
              "level": 2,
              "startChar": 71,
              "endChar": 193,
              "startLine": 5,
              "structureCode": "1.1",
              "parentNodeId": "0001",
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

Each structure node includes character offsets (`startChar`, `endChar`), line numbers, and optional page mappings (`startPage`, `endPage`) for PDFs.

## Structure Output

Use `--structure` to display heading hierarchy for each document:

```bash
occ --structure docs/
```

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

Structure is extracted from DOCX (via heading styles), PDF (with page markers), PPTX/ODP (slide headers), and ODT (best-effort). Spreadsheets are skipped. Page ranges are only shown when available (primarily for PDFs).

## By-File Mode

Use `--by-file` / `-f` to show one row per file instead of grouping by type:

```bash
occ --by-file docs/
```

```
-- Documents ---------------------------------------------------------------
  File              Words    Pages              Details      Size
----------------------------------------------------------------------------
  report.docx       5,200       21             82 paras      45 KB
  spec.pdf          3,100       12                          1.2 MB
  data.xlsx                                    3 sheets     890 KB
----------------------------------------------------------------------------
  Total (3 files)   8,300       33             82 paras     2.1 MB
```

In JSON mode with `--by-file`, each file entry includes `name` and `path` fields:

```bash
occ --format json --by-file docs/
```

## File Output

Use `--output` / `-o` to write output to a file instead of stdout:

```bash
# Tabular to file
occ --output report.txt docs/

# JSON to file
occ --format json -o report.json docs/
```

## Spreadsheet Inspection Output

`occ sheet inspect` prints workbook-level preflight data plus per-sheet schema and sample previews.

```bash
occ sheet inspect finance.xlsx
```

Example tabular shape:

```text
File: /path/to/finance.xlsx
Format: XLSX
Size: 1.2 MB
Sheets: 4 total (2 visible, 1 hidden, 1 very hidden)
Risk Flags: hiddenSheets, formulas, hyperlinks

-- Sheet Inventory --------------------------------------------------------
  Sheet            Visibility     Range     Rows   Cols   Non-Empty   Tokens
  1. Revenue       visible        A1:H120    120      8         852      920
  2. Archive       hidden         A1:C40      40      3         118      140

-- Sheet: Revenue (visible) ----------------------------------------------
Range: A1:H120
Grid: 120 rows x 8 cols (960 cells)
Signals: 12 formulae | 0 comments | 3 hyperlinks | 0 merges
Header: 1 (auto)
Token Estimate: sample=45 | full=920

Schema
  Col      Name       Type      Non-Empty    Coverage    Examples
  A (1)    Region     string          119         99%    NA | EU | APAC
  B (2)    Revenue    number          119         99%    1200 | 980 | 1430

Sample
  Row    Region    Revenue
  2      NA        1200
  3      EU        980
```

JSON mode uses a stable command envelope:

```bash
occ sheet inspect finance.xlsx --format json
```

```json
{
  "file": "/path/to/finance.xlsx",
  "query": {
    "command": "sheet.inspect",
    "sampleRows": 5,
    "headerRow": "auto",
    "maxColumns": 50
  },
  "results": {
    "workbook": {
      "file": "/path/to/finance.xlsx",
      "format": "xlsx",
      "sheetCount": 4,
      "visibleSheetCount": 2,
      "hiddenSheetCount": 1,
      "veryHiddenSheetCount": 1,
      "definedNames": [
        {
          "name": "GlobalRevenue",
          "ref": "Revenue!$B$2:$B$100",
          "scope": "workbook",
          "external": false
        }
      ],
      "riskFlags": {
        "hiddenSheets": true,
        "formulas": true,
        "comments": false,
        "hyperlinks": true,
        "mergedCells": false,
        "protectedSheets": false,
        "externalFormulaRefs": false
      }
    },
    "sheets": [
      {
        "name": "Revenue",
        "visibility": "visible",
        "usedRange": "A1:H120",
        "formulaCellCount": 12,
        "schema": {
          "truncated": false,
          "columns": [
            {
              "letter": "A",
              "name": "Region",
              "dominantType": "string",
              "nonEmptyCount": 119,
              "nonEmptyRatio": 0.992,
              "examples": ["NA", "EU", "APAC"]
            }
          ]
        },
        "sample": {
          "truncatedRows": true,
          "truncatedColumns": false,
          "rows": [
            {
              "rowNumber": 2,
              "values": {
                "Region": "NA",
                "Revenue": "1200"
              }
            }
          ]
        },
        "sampleTokenEstimate": 45,
        "fullTokenEstimate": 920,
        "estimateMethod": "full_scan"
      }
    ]
  }
}
```

The workbook section carries file-level metadata and aggregate risk flags. Each sheet entry carries preflight signals, inferred schema, row samples, and token estimates.

## Table Extraction Output

`occ table inspect` prints an overview followed by per-table sections with sample data.

```bash
occ table inspect finance.xlsx
```

Example tabular shape:

```text
File: /path/to/finance.xlsx
Format: XLSX
Size: 17 KB
Tables Found: 2
Total Token Estimate: 18

-- Table 1 (Sheet: Sheet1) — 3 rows × 3 cols, 9 cells --
  Token Estimate: 11
----------------------------
  #    Name     Age    City
  2    Alice    30     NYC
  3    Bob      25     London
----------------------------

-- Table 2 (Sheet: Sheet2) — 2 rows × 2 cols, 4 cells --
  Token Estimate: 7
-----------------------
  #    Product    Price
  2    Widget     9.99
-----------------------
```

JSON mode uses a stable command envelope:

```bash
occ table inspect report.docx --format json
```

```json
{
  "file": "/path/to/report.docx",
  "query": {
    "command": "table.inspect",
    "sampleRows": 20,
    "headerRow": "auto"
  },
  "results": {
    "file": "/path/to/report.docx",
    "format": "docx",
    "size": 8568,
    "tableCount": 1,
    "tables": [
      {
        "tableIndex": 1,
        "location": null,
        "rowCount": 4,
        "columnCount": 3,
        "cellCount": 12,
        "headers": ["Name", "Role", "Status"],
        "rows": [
          {
            "index": 2,
            "cells": [
              { "value": "Alice" },
              { "value": "Engineer" },
              { "value": "Active" }
            ]
          }
        ],
        "truncated": false,
        "tokenEstimate": 15
      }
    ],
    "notes": [],
    "totalTokenEstimate": 15
  }
}
```

For PDF files, `tables` will be an empty array and `notes` will contain an explanation:

```json
{
  "results": {
    "tables": [],
    "notes": ["PDF format does not support structural table extraction..."],
    "totalTokenEstimate": 0
  }
}
```

## Code Exploration Tabular Output

`occ code` prints command-specific terminal output instead of the document summary tables. The exact layout depends on the query, but the semantics are consistent:

- relationship queries show `resolved`, `ambiguous`, or `unresolved`
- ambiguous calls include candidate hints when available
- dependency analysis is split into importer, local, external, and unresolved sections
- chain analysis explains when a path is blocked by ambiguity

### Ambiguous Calls

```bash
occ code analyze calls ambiguousCaller --path test/fixtures/code-explore
```

```
-- Outgoing Calls: ambiguousCaller ----------------------------------------
  Callee       Location    Resolution    Detail
  duplicate                ambiguous     2 candidates: src/duplicate-a.ts:1, src/duplicate-b.ts:1
```

### Blocked Chains

```bash
occ code analyze chain ambiguousCaller duplicate --path test/fixtures/code-explore
```

```
Chain 1 (blocked by ambiguity)
ambiguousCaller (src/ambiguous.ts:1)
blocked by ambiguous call "duplicate" at line 2: src/duplicate-a.ts:1, src/duplicate-b.ts:1
```

### Dependency Categories

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

## Code Exploration JSON

`occ code` uses a command-oriented JSON envelope so both humans and agents can rely on a stable top-level shape:

```bash
occ code find name Greeter --path test/fixtures/code-explore --format json
```

```json
{
  "repo": "/path/to/repo",
  "query": {
    "command": "code.find.name",
    "value": "Greeter"
  },
  "results": [
    {
      "node": {
        "id": "class:/path/to/repo/python/helpers.py:Greeter:5",
        "type": "class",
        "name": "Greeter",
        "relativePath": "python/helpers.py",
        "line": 5,
        "language": "python"
      }
    }
  ],
  "stats": {
    "filesIndexed": 17,
    "nodes": 70,
    "edges": 89
  },
  "capabilities": {
    "python": {
      "definitions": true,
      "imports": true,
      "calls": true,
      "inheritance": true,
      "content": true
    },
    "typescript": {
      "definitions": true,
      "imports": true,
      "calls": true,
      "inheritance": true,
      "content": true
    }
  }
}
```

The `query` object identifies the command variant. `results` varies by command, but the top-level `repo`, `stats`, and `capabilities` keys stay stable across the `occ code` command family.

Notable `occ code` JSON behaviors:

- **Call edges** include `status` and may include `candidates` when a target is ambiguous
- **Dependency analysis** returns separate `localImports`, `externalImports`, and `unresolvedImports`
- **Call chains** may include `direction: "reverse"` when the discovered path runs opposite to the requested query
- **Call chains** may return `status: "blocked_ambiguous"` with `blockedAt` and `blockedBy` metadata

### Ambiguous Call Edge Example

```json
{
  "edge": {
    "type": "calls",
    "status": "ambiguous",
    "targetName": "duplicate",
    "candidates": [
      { "name": "duplicate", "relativePath": "src/duplicate-a.ts", "line": 1 },
      { "name": "duplicate", "relativePath": "src/duplicate-b.ts", "line": 1 }
    ]
  }
}
```

### Blocked Chain Example

```json
{
  "status": "blocked_ambiguous",
  "blockedAt": {
    "name": "ambiguousCaller",
    "relativePath": "src/ambiguous.ts",
    "line": 1
  },
  "blockedBy": {
    "targetName": "duplicate",
    "line": 2,
    "status": "ambiguous"
  }
}
```

### Dependency Analysis Example

```json
{
  "results": {
    "target": "src/deps",
    "importers": [],
    "localImports": [
      {
        "edge": {
          "specifier": "./utils",
          "status": "resolved",
          "importKind": "local"
        }
      }
    ],
    "externalImports": [
      {
        "edge": {
          "specifier": "node:path",
          "status": "resolved",
          "importKind": "external"
        }
      }
    ],
    "unresolvedImports": [
      {
        "edge": {
          "specifier": "./missing",
          "status": "unresolved",
          "importKind": "unresolved"
        }
      }
    ]
  }
}
```
