# Supported Formats

This page covers the document formats supported by OCC across its command families.

For `occ code` language support, see the [CLI Reference](../usage/cli-reference.md). The strongest code exploration support path is JavaScript, TypeScript, and Python.

OCC supports seven office document formats across three categories.

## Format Summary

| Format | Extension | Words | Pages | Paragraphs | Sheets | Rows | Cells | Slides | Structure | Inspect | Tables | Parser Library |
|--------|-----------|:-----:|:-----:|:----------:|:------:|:----:|:-----:|:------:|:---------:|:-------:|:------:|---------------|
| Word | `.docx` | Yes | Yes* | Yes | | | | | Yes | Yes | Yes | mammoth |
| PDF | `.pdf` | Yes | Yes | | | | | | Yes | — | — | pdf-parse |
| Excel | `.xlsx` | | | | Yes | Yes | Yes | | — | Yes | Yes | SheetJS/xlsx |
| PowerPoint | `.pptx` | Yes | | | | | | Yes | Yes | Yes | Yes | JSZip + officeparser |
| ODT | `.odt` | Yes | Yes* | Yes | | | | | Yes | Yes | Yes | officeparser |
| ODS | `.ods` | | | | Yes | Yes | Yes | | — | — | — | JSZip + officeparser |
| ODP | `.odp` | Yes | | | | | | Yes | Yes | Yes | Yes | JSZip + officeparser |

\* Pages for Word (.docx) and ODT (.odt) are estimated at 250 words per page.

**Structure** extraction (`--structure`) parses heading hierarchy into a tree with dotted section codes. DOCX heading styles are accurately mapped via mammoth + turndown. PDF pages are mapped to sections. PPTX/ODP produce slide-level headers. Spreadsheets have no heading hierarchy and are skipped.

**Inspect** commands (`occ doc/sheet/slide inspect`) provide format-specific metadata, risk flags, content stats, and content previews. PDF does not currently have a dedicated inspect command.

**Tables** extraction (`occ table inspect`) returns structured table content with headers, rows, and merged cell support. PDF tables cannot be structurally extracted (returns an informative note). ODS table extraction is not yet supported.

## Categories

### Text Documents

**Word (.docx)** and **ODT (.odt)** — extract word counts, page estimates, and paragraph counts.

### Spreadsheets

**Excel (.xlsx)** and **ODS (.ods)** — extract sheet counts, row counts, and cell counts. Word counts are not applicable.

### Presentations

**PowerPoint (.pptx)** and **ODP (.odp)** — extract word counts and slide counts from presentation text content.

### PDF

**PDF (.pdf)** — extracts word counts and actual page counts (not estimated).
