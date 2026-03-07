import { Packer, Document, Paragraph, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';

// Create a small DOCX
async function createDocx() {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun('Hello world. This is a test document.')] }),
        new Paragraph({ children: [new TextRun('It has multiple paragraphs of text content.')] }),
        new Paragraph({ children: [new TextRun('The quick brown fox jumps over the lazy dog.')] }),
      ],
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  await writeFile('test/fixtures/sample.docx', buffer);
  console.log('Created sample.docx');
}

// Create a small XLSX
async function createXlsx() {
  const workbook = new ExcelJS.Workbook();
  const sheet1 = workbook.addWorksheet('Sheet1');
  sheet1.addRow(['Name', 'Age', 'City']);
  sheet1.addRow(['Alice', 30, 'NYC']);
  sheet1.addRow(['Bob', 25, 'London']);

  const sheet2 = workbook.addWorksheet('Sheet2');
  sheet2.addRow(['Product', 'Price']);
  sheet2.addRow(['Widget', 9.99]);

  await workbook.xlsx.writeFile('test/fixtures/sample.xlsx');
  console.log('Created sample.xlsx');
}

await createDocx();
await createXlsx();
console.log('Fixtures created.');
