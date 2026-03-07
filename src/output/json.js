export function formatJson(stats, sccData = null) {
  const output = {
    documents: {
      files: stats.rows.map(r => ({
        type: r.fileType,
        ...(r.fileName ? { name: r.fileName } : {}),
        ...(r.filePath ? { path: r.filePath } : {}),
        count: r.files,
        words: r.words || 0,
        pages: r.pages || 0,
        paragraphs: r.paragraphs || 0,
        sheets: r.sheets || 0,
        rows: r.rows || 0,
        cells: r.cells || 0,
        slides: r.slides || 0,
        size: r.size,
      })),
      totals: {
        files: stats.totals.files,
        words: stats.totals.words,
        pages: stats.totals.pages,
        paragraphs: stats.totals.paragraphs,
        sheets: stats.totals.sheets,
        rows: stats.totals.rows,
        cells: stats.totals.cells,
        slides: stats.totals.slides,
        size: stats.totals.size,
      },
    },
  };

  if (sccData && sccData.length > 0) {
    output.code = sccData;
  }

  return JSON.stringify(output, null, 2);
}
