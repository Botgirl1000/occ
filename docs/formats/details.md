# Format Details

Detailed breakdown of how OCC extracts metrics from each format.

## Word (.docx)

**Parser:** [mammoth](https://www.npmjs.com/package/mammoth)

**Metrics extracted:**

- **Words** — raw text extracted via `mammoth.extractRawText()`, then split on whitespace
- **Pages** — estimated at 250 words per page (`Math.max(1, Math.ceil(words / 250))`)
- **Paragraphs** — text split on double newlines, filtered for non-empty segments

**Structure extraction:** mammoth converts DOCX to HTML (mapping `Heading 1`–`Heading 6` styles to `<h1>`–`<h6>`), then [turndown](https://www.npmjs.com/package/turndown) converts to markdown with `#`–`######` headers. This gives accurate heading hierarchy without parsing DOCX XML directly.

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

## PowerPoint (.pptx)

**Parser:** [JSZip](https://www.npmjs.com/package/jszip) + [officeparser](https://www.npmjs.com/package/officeparser)

**Metrics extracted:**

- **Words** — text extracted via officeparser, then split on whitespace
- **Slides** — counted by inspecting the ZIP structure for `ppt/slides/slideN.xml` entries

**Structure extraction:** Slides are enumerated from the ZIP in order and `# Slide N` headers are inserted, creating a flat one-level structure.

## ODT (OpenDocument Text)

**Parser:** [officeparser](https://www.npmjs.com/package/officeparser)

**Metrics extracted:**

- **Words** — text extracted via officeparser, then split on whitespace
- **Pages** — estimated at 250 words per page (same as Word)
- **Paragraphs** — text split on newlines, filtered for non-empty segments

**Structure extraction:** Text is extracted via officeparser. Heading detection is best-effort since ODT formatting may not always be preserved in the plain text output.

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
