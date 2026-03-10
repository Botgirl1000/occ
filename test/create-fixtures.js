import { Packer, Document, Paragraph, TextRun, HeadingLevel } from 'docx';
import * as XLSX from 'xlsx';
import * as fs from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';

XLSX.set_fs(fs);

await mkdir('test/fixtures', { recursive: true });

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

// Create a DOCX with headings for structure testing
async function createStructuredDocx() {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Executive Summary')] }),
        new Paragraph({ children: [new TextRun('This report provides an overview of the project.')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Background')] }),
        new Paragraph({ children: [new TextRun('The project was initiated in January 2024.')] }),
        new Paragraph({ children: [new TextRun('It aims to improve operational efficiency across departments.')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Key Findings')] }),
        new Paragraph({ children: [new TextRun('Several important findings emerged from the analysis.')] }),
        new Paragraph({ children: [new TextRun('Overall performance improved by 25 percent year over year.')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Methodology')] }),
        new Paragraph({ children: [new TextRun('We employed a mixed-methods research approach.')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Data Collection')] }),
        new Paragraph({ children: [new TextRun('Data was collected through surveys and interviews.')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Analysis Framework')] }),
        new Paragraph({ children: [new TextRun('The analysis used both quantitative and qualitative methods.')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun('Quantitative Methods')] }),
        new Paragraph({ children: [new TextRun('Statistical analysis was performed using standard techniques.')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun('Qualitative Methods')] }),
        new Paragraph({ children: [new TextRun('Thematic analysis was applied to interview transcripts.')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Results')] }),
        new Paragraph({ children: [new TextRun('The results demonstrate significant improvements in key metrics.')] }),
        new Paragraph({ children: [new TextRun('Customer satisfaction increased from 72% to 89%.')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Conclusions')] }),
        new Paragraph({ children: [new TextRun('The project achieved its primary objectives.')] }),
        new Paragraph({ children: [new TextRun('Further research is recommended in specific areas.')] }),
      ],
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  await writeFile('test/fixtures/structured.docx', buffer);
  console.log('Created structured.docx');
}

// Create a small XLSX
async function createXlsx() {
  const workbook = XLSX.utils.book_new();
  const sheet1 = XLSX.utils.aoa_to_sheet([
    ['Name', 'Age', 'City'],
    ['Alice', 30, 'NYC'],
    ['Bob', 25, 'London'],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet1, 'Sheet1');

  const sheet2 = XLSX.utils.aoa_to_sheet([
    ['Product', 'Price'],
    ['Widget', 9.99],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet2, 'Sheet2');

  XLSX.writeFile(workbook, 'test/fixtures/sample.xlsx');
  console.log('Created sample.xlsx');
}

await createDocx();
await createStructuredDocx();
await createXlsx();
console.log('Fixtures created.');
