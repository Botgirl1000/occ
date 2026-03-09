# Supported Formats

OCC supports seven office document formats across three categories.

## Format Summary

| Format | Extension | Words | Pages | Paragraphs | Sheets | Rows | Cells | Slides | Structure | Parser Library |
|--------|-----------|:-----:|:-----:|:----------:|:------:|:----:|:-----:|:------:|:---------:|---------------|
| Word | `.docx` | Yes | Yes* | Yes | | | | | Yes | mammoth |
| PDF | `.pdf` | Yes | Yes | | | | | | Yes | pdf-parse |
| Excel | `.xlsx` | | | | Yes | Yes | Yes | | — | SheetJS/xlsx |
| PowerPoint | `.pptx` | Yes | | | | | | Yes | Yes | JSZip + officeparser |
| ODT | `.odt` | Yes | Yes* | Yes | | | | | Yes | officeparser |
| ODS | `.ods` | | | | Yes | Yes | Yes | | — | JSZip + officeparser |
| ODP | `.odp` | Yes | | | | | | Yes | Yes | JSZip + officeparser |

\* Pages for Word (.docx) and ODT (.odt) are estimated at 250 words per page.

Structure extraction (`--structure`) parses heading hierarchy into a tree with dotted section codes. DOCX heading styles are accurately mapped via mammoth + turndown. PDF pages are mapped to sections. PPTX/ODP produce slide-level headers. Spreadsheets have no heading hierarchy and are skipped.

## Categories

### Text Documents

**Word (.docx)** and **ODT (.odt)** — extract word counts, page estimates, and paragraph counts.

### Spreadsheets

**Excel (.xlsx)** and **ODS (.ods)** — extract sheet counts, row counts, and cell counts. Word counts are not applicable.

### Presentations

**PowerPoint (.pptx)** and **ODP (.odp)** — extract word counts and slide counts from presentation text content.

### PDF

**PDF (.pdf)** — extracts word counts and actual page counts (not estimated).
