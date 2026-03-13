# Format Details

Detailed breakdown of how OCC extracts metrics from each format.

## Word (.docx)

**Parser:** [mammoth](https://www.npmjs.com/package/mammoth)

**Metrics extracted:**

- **Words** — raw text extracted via `mammoth.extractRawText()`, then split on whitespace
- **Pages** — estimated at 250 words per page (`Math.max(1, Math.ceil(words / 250))`)
- **Paragraphs** — text split on double newlines, filtered for non-empty segments

**Structure extraction:** mammoth converts DOCX to HTML (mapping `Heading 1`–`Heading 6` styles to `<h1>`–`<h6>`), then [turndown](https://www.npmjs.com/package/turndown) converts to markdown with `#`–`######` headers. This gives accurate heading hierarchy without parsing DOCX XML directly.

**Table extraction:** `occ table inspect` parses `<table>/<tr>/<td>` elements from mammoth's HTML output, preserving `colspan` and `rowspan` attributes for merged cells. Headers are auto-detected from `<th>` tags or unique first-row values.

!!! note "Page estimation"
    DOCX files don't store reliable page counts. OCC estimates pages at 250 words per page, which is a standard publishing convention.

## PDF (.pdf)

**Parser:** [pdf-parse](https://www.npmjs.com/package/pdf-parse)

**Metrics extracted:**

- **Words** — text extracted by pdf-parse, then split on whitespace
- **Pages** — actual page count from the PDF metadata (`data.numpages`)

**Structure extraction:** pdf-parse is invoked with a custom `pagerender` callback that prepends `[Page N]` markers before each page's text. These markers enable section-to-page mapping in the structure tree. Headers in the extracted text are identified by markdown heading syntax.

PDF is the only format that provides a true page count rather than an estimate.

## Excel (.xlsx)

**Parser:** [SheetJS (xlsx)](https://www.npmjs.com/package/xlsx)

**Metrics extracted:**

- **Sheets** — `workbook.SheetNames.length`
- **Rows** — derived from each sheet's `!ref` range
- **Cells** — rows × columns derived from each sheet's `!ref` range

Word and page counts are not extracted from spreadsheets.

**Spreadsheet inspection:** `occ sheet inspect <file>` uses the same SheetJS workbook model to expose workbook properties, hidden sheet state, defined names, formula/comment/hyperlink signals, inferred schema, and lightweight row samples for agent-oriented preflight.

**Table extraction:** `occ table inspect` treats each sheet as a table, using the same `getCell()` and `renderCell()` utilities as sheet inspection. Merged cells are handled via the `!merges` array, with the top-left cell carrying colspan/rowspan values.

## PowerPoint (.pptx)

**Parser:** [JSZip](https://www.npmjs.com/package/jszip) + [officeparser](https://www.npmjs.com/package/officeparser)

**Metrics extracted:**

- **Words** — text extracted via officeparser, then split on whitespace
- **Slides** — counted by inspecting the ZIP structure for `ppt/slides/slideN.xml` entries

**Structure extraction:** Slides are enumerated from the ZIP in order and `# Slide N` headers are inserted, creating a flat one-level structure.

**Table extraction:** `occ table inspect` finds `<a:tbl>` elements in slide XML, extracting text from `<a:t>` tags within `<a:tc>` cells. `gridSpan` and `rowSpan` attributes are read for merged cells. Each table's location is reported as `Slide N`.

## ODT (OpenDocument Text)

**Parser:** [officeparser](https://www.npmjs.com/package/officeparser)

**Metrics extracted:**

- **Words** — text extracted via officeparser, then split on whitespace
- **Pages** — estimated at 250 words per page (same as Word)
- **Paragraphs** — text split on newlines, filtered for non-empty segments

**Structure extraction:** Text is extracted via officeparser. Heading detection is best-effort since ODT formatting may not always be preserved in the plain text output.

**Table extraction:** `occ table inspect` parses `<table:table>` elements from `content.xml`, extracting text from `<table:table-cell>` elements. `table:number-columns-spanned` and `table:number-rows-spanned` attributes are read for merged cells.

## ODS (OpenDocument Spreadsheet)

**Parser:** [JSZip](https://www.npmjs.com/package/jszip) + [officeparser](https://www.npmjs.com/package/officeparser)

**Metrics extracted:**

- **Sheets** — counted by matching `<table:table` elements in `content.xml`
- **Rows** — counted by matching `<table:table-row` elements in `content.xml`
- **Cells** — counted from officeparser text output (non-empty lines)

## ODP (OpenDocument Presentation)

**Parser:** [JSZip](https://www.npmjs.com/package/jszip) + [officeparser](https://www.npmjs.com/package/officeparser)

**Metrics extracted:**

- **Words** — text extracted via officeparser, then split on whitespace
- **Slides** — counted by matching `<draw:page` elements in `content.xml`

**Structure extraction:** Similar to PPTX — slides are counted from `content.xml` and `# Slide N` headers are inserted.

**Table extraction:** `occ table inspect` parses `<table:table>` elements from `content.xml` within each `<draw:page>`, providing per-slide context for each table's location.
