// Regenerate the blank office templates that the "New document / spreadsheet /
// presentation" create flow seeds into Blob. Run once; the outputs are committed
// static assets under public/onlyoffice-templates/ (so they're reliably served
// at runtime — serverless functions don't bundle arbitrary fs paths).
//
// Dev-only deps, intentionally NOT in package.json — to regenerate:
//   npm install --no-save docx exceljs pptxgenjs && node scripts/gen-blank-templates.mjs
import { Document, Packer, Paragraph } from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outDir = path.join(process.cwd(), "public", "onlyoffice-templates");
await mkdir(outDir, { recursive: true });

// blank.docx — one empty paragraph
const docx = await Packer.toBuffer(
  new Document({ sections: [{ children: [new Paragraph("")] }] }),
);
await writeFile(path.join(outDir, "blank.docx"), docx);

// blank.xlsx — one empty sheet
const wb = new ExcelJS.Workbook();
wb.addWorksheet("Sheet1");
await wb.xlsx.writeFile(path.join(outDir, "blank.xlsx"));

// blank.pptx — one empty slide
const pptx = new PptxGenJS();
pptx.addSlide();
await pptx.writeFile({ fileName: path.join(outDir, "blank.pptx") });

console.log("Wrote blank.docx / blank.xlsx / blank.pptx to", outDir);
