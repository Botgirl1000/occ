import ExcelJS from 'exceljs';

export async function parseXlsx(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheets = workbook.worksheets.length;
  let rows = 0;
  let cells = 0;

  for (const worksheet of workbook.worksheets) {
    rows += worksheet.actualRowCount || 0;
    worksheet.eachRow((row) => {
      row.eachCell(() => {
        cells++;
      });
    });
  }

  return {
    fileType: 'Excel',
    metrics: {
      words: null,
      pages: null,
      paragraphs: null,
      sheets,
      rows,
      cells,
      slides: null,
    },
  };
}
