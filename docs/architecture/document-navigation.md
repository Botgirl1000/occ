# Document Navigation Inventory

This page inventories OCC's office-document navigation capabilities as they exist in the current source tree. "Navigation" here means document structure discovery and section/location mapping behind `occ --structure`, not an interactive viewer or code navigation.

The relevant implementation lives in:

- `src/cli.ts` for the `--structure` command surface
- `src/markdown/convert.ts` for format-specific document-to-markdown conversion
- `src/structure/extract.ts` and `src/structure/types.ts` for the structure model and helper APIs
- `src/output/tree.ts` and `src/output/json.ts` for tree and JSON output

## User-Facing Surface

OCC exposes document navigation through the `--structure` flag on the default `occ [directories...]` command. This is an additive feature: it runs alongside normal document metrics and optional `scc` output rather than replacing them.

### What the CLI currently does

- Scans for office documents as usual
- Filters structure extraction to `docx`, `pdf`, `pptx`, `odt`, and `odp`
- Converts each structurable file to an intermediate markdown form
- Extracts headings from that markdown into a tree
- Renders either:
  - a tabular tree per document in text mode, or
  - a `structures` array in JSON mode

### Adjacent flags that matter

- `--format json` exposes the machine-readable structure payload
- `--by-file` only affects document metrics; structure output remains per document
- `--no-code` removes the `scc` section but does not change structure behavior
- `--ci` disables color only
- `--output <file>` writes the same structure output to disk

## What Counts As Navigation

OCC's current navigation model is a heading tree plus optional page ranges.

In text output, each node shows:

- a dotted `structureCode` such as `1`, `1.2`, or `2.3.1`
- indentation derived from heading depth
- the node title
- an optional page indicator such as `p.4` or `p.4-6`

In JSON output, each node carries offsets and ancestry metadata that can be used by downstream tools for section lookup and chunk attribution.

OCC does not currently provide:

- an interactive viewer
- a "jump to section" command
- a "go to page" command
- in-document text search
- bookmark, hyperlink, annotation, or footnote navigation

## Format Inventory

The table below distinguishes actual implementation behavior from the higher-level docs wording.

| Format | Structurable | Navigable unit | Hierarchy fidelity | Location fidelity | Notes |
|--------|--------------|----------------|--------------------|-------------------|-------|
| DOCX | Yes | Headings | Real heading hierarchy | No true page mapping; page counts are estimated elsewhere | Best-supported navigation path |
| PDF | Partially | Markdown-style headings only | No PDF-native heading inference | Page mapping is implemented when headings exist | Source support is narrower than the docs imply |
| PPTX | Yes | Slides | Synthetic flat structure | No page mapping | One `# Slide N` node per slide |
| ODT | Partially | Markdown-style headings only | No ODT-native heading inference | No page mapping | "Best-effort" currently means plain-text pass-through |
| ODP | Yes | Slides | Synthetic flat structure | No page mapping | One `# Slide N` node per slide |
| XLSX | No | None | Not applicable | Not applicable | Explicitly skipped |
| ODS | No | None | Not applicable | Not applicable | Explicitly skipped |

### DOCX

DOCX is the strongest navigation implementation in OCC.

- `mammoth.convertToHtml()` converts heading styles into HTML headings
- `turndown` converts those headings into markdown `#`-style headings
- `extractFromMarkdown()` reconstructs the heading tree from that markdown

This is the only format with a direct, format-aware heading pipeline rather than a synthetic or plain-text fallback.

### PDF

PDF support is narrower than the README and format tables suggest.

- OCC injects `[Page N]` markers during PDF text extraction
- OCC does **not** infer headings from PDF outline metadata, font size, font weight, layout, or tagged-PDF structure
- Heading extraction still depends on markdown heading syntax matching `^(#{1,6})\s+`

In practice, this means page-to-section mapping exists in the structure engine, but useful PDF section trees only appear when the extracted text already contains markdown-style headings.

### PPTX and ODP

Presentation support is synthetic and intentionally shallow.

- OCC counts slides
- OCC injects `# Slide N` headings in order
- The resulting structure is flat, one node per slide

This supports slide-to-slide navigation, but not semantic outline recovery from title placeholders, nested bullets, speaker notes, or slide masters.

### ODT

ODT structure extraction is currently plain-text based.

- `officeparser` returns text
- OCC passes that text directly into the markdown header extractor
- There is no ODT-specific heading-style detection or XML-based outline parsing

So the implementation is "best-effort" only in the sense that headings are recovered if the plain text already preserves recognizable markdown-style heading lines.

### XLSX and ODS

Spreadsheets participate in document metrics, but not document navigation.

- They are not included in `STRUCTURABLE_EXTS`
- `documentToMarkdown()` returns `null` for `xlsx` and `ods`
- No sheet/tab/cell navigation tree is generated

## Internal Data Model

Structure extraction is a two-stage pipeline:

1. Normalize the document into markdown-like text
2. Parse markdown headings into a `DocumentStructure`

### Header extraction rules

`extractFromMarkdown()` currently recognizes headings only when a line matches:

```text
^(#{1,6})\s+(.+)$
```

Additional behavior:

- heading levels are limited to 1 through 6
- fenced code blocks are ignored while scanning headings
- section boundaries are defined by heading start positions in the intermediate markdown, not by original document offsets

### Tree construction rules

The tree builder is purely stack-based:

- each heading becomes a `StructureNode`
- nodes attach to the nearest prior heading with a lower level
- equal-or-higher heading levels close the current branch
- `structureCode` values are assigned by encounter order, not by original numbering in the source document

### Node fields

Each node can carry:

- `nodeId`
- `title`
- `level`
- `startChar`
- `endChar`
- `startLine`
- optional `startPage`
- optional `endPage`
- optional `parentNodeId`
- optional `structureCode`
- `children`

Important detail: `startChar`, `endChar`, and `startLine` are positions in the intermediate markdown string, not offsets in the original DOCX/PDF/PPTX/ODT file.

### Page mapping model

The internal `DocumentStructure` includes:

- `rootNodes`
- `pageMappings`
- `totalNodes`
- `maxDepth`

`pageMappings` are derived from `[Page N]` markers. That mechanism is effectively PDF-centric in the current implementation.

## Programmatic Navigation Helpers

OCC includes internal helpers that make the structure tree usable by downstream code even though there is no dedicated CLI for them yet.

From `src/structure/types.ts`:

- `flatten(nodes)` to linearize the tree
- `getNodeById(nodes, nodeId)` to retrieve a node by stable generated ID
- `getNodeByPath(nodes, structureCode)` to retrieve a node by dotted path such as `2.1`

From `src/structure/extract.ts`:

- `findChunkSection(structure, start, end)` to map a character range back to the deepest containing section
- `getSectionContent(content, node, includeChildren)` to slice section content from the intermediate markdown

These helpers are the main evidence that OCC's structure model is designed for agent and RAG workflows in addition to human-readable terminal output.

## Output Contracts

### Text output

`formatStructureTree()` renders:

- one structure section per file
- dotted section codes
- indentation by depth
- optional page ranges when `startPage` is available
- a summary line with root section count, total node count, and max depth

### JSON output

When `--structure --format json` is used, OCC adds a `structures` key to the top-level JSON payload.

Each entry currently includes:

- `file`
- `totalNodes`
- `maxDepth`
- `nodes`

Each node in `nodes` includes the structure metadata listed above.

Important nuance: the internal `DocumentStructure.pageMappings` array is **not** currently emitted in CLI JSON output, even though page-derived fields may appear on individual nodes. The docs describe page mappings more broadly than the actual JSON contract exposes.

## Related: Table Extraction

While not a navigation feature per se, `occ table inspect` provides complementary content extraction for structured table data. It shares the same underlying libraries (mammoth for DOCX, JSZip for PPTX/ODT/ODP, SheetJS for XLSX) but targets a different question: "what data is in the tables?" rather than "how is the document structured?"

## Current Gaps

The current implementation has clear boundaries.

### Missing navigation behaviors

- No document-outline extraction from native PDF bookmarks or tagged-PDF structure
- No ODT outline extraction from document XML or style metadata
- No semantic slide-title extraction for PPTX or ODP
- No spreadsheet navigation model for sheets, named ranges, or tables
- No search-oriented navigation features such as "find heading by text"
- No cross-document navigation or linking model

### Fidelity limits

- Page ranges are meaningful primarily for PDFs
- DOCX and ODT page counts are estimated in the metrics pipeline and are not wired into structure nodes
- Character offsets are markdown offsets, not source-document positions
- `structureCode` values are generated by OCC and do not necessarily match author-visible numbering in the document

## Verification Notes

This inventory is source-first and intentionally conservative.

- The structure path is implemented in the source files listed above
- The current automated test suite in this checkout covers `occ code`, but there is no dedicated structure extraction test file
- End-to-end CLI verification in this environment is currently blocked by an `xlsx` startup failure in the built CLI, unrelated to `--structure`, so some inventory points are confirmed from source inspection rather than live CLI output

That distinction matters most for PDF and ODT claims: the implementation supports page-aware heading trees only after heading-like markdown exists in the intermediate text, which is materially narrower than "general document outline extraction."
