import ExcelJS from "exceljs";
import type { Invoice } from "./types";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
const BAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE2E2" } };
const OK_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F5E8" } };

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function buildWorkbook(invoices: Invoice[], issues: Record<string, string[]>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Invoices");
  ws.columns = [
    { header: "Status", width: 10 },
    { header: "Source file", width: 28 },
    { header: "Supplier", width: 30 },
    { header: "Supplier GSTIN", width: 18 },
    { header: "Invoice no", width: 16 },
    { header: "Invoice date", width: 13 },
    { header: "Taxable value", width: 14 },
    { header: "CGST", width: 11 },
    { header: "SGST", width: 11 },
    { header: "IGST", width: 11 },
    { header: "Cess", width: 9 },
    { header: "Round off", width: 10 },
    { header: "Invoice total", width: 14 },
    { header: "Issues to check", width: 70 },
  ];
  styleHeader(ws);

  const ls = wb.addWorksheet("Line items");
  ls.columns = [
    { header: "Source file", width: 28 },
    { header: "Invoice no", width: 16 },
    { header: "Supplier", width: 28 },
    { header: "Description", width: 34 },
    { header: "HSN/SAC", width: 12 },
    { header: "Qty", width: 8 },
    { header: "Unit", width: 8 },
    { header: "Rate", width: 11 },
    { header: "Taxable value", width: 14 },
    { header: "CGST %", width: 8 },
    { header: "CGST", width: 10 },
    { header: "SGST %", width: 8 },
    { header: "SGST", width: 10 },
    { header: "IGST %", width: 8 },
    { header: "IGST", width: 10 },
  ];
  styleHeader(ls);

  let ok = 0;
  for (const inv of invoices) {
    const list = issues[inv.id] ?? [];
    if (list.length === 0) ok++;
    const row = ws.addRow([
      list.length ? "Check" : "OK",
      inv.file,
      inv.supplier_name,
      inv.supplier_gstin,
      inv.invoice_number,
      inv.invoice_date,
      inv.taxable_total,
      inv.cgst_total,
      inv.sgst_total,
      inv.igst_total,
      inv.cess_total,
      inv.round_off,
      inv.invoice_total,
      list.join("; "),
    ]);
    row.eachCell({ includeEmpty: true }, (c) => {
      c.fill = list.length ? BAD_FILL : OK_FILL;
      c.alignment = { vertical: "top", wrapText: true };
    });
    for (let col = 7; col <= 13; col++) row.getCell(col).numFmt = "#,##0.00";

    for (const it of inv.line_items) {
      ls.addRow([
        inv.file, inv.invoice_number, inv.supplier_name, it.description, it.hsn_sac, it.quantity, it.unit,
        it.rate, it.taxable_value, it.cgst_rate, it.cgst_amount, it.sgst_rate, it.sgst_amount, it.igst_rate, it.igst_amount,
      ]);
    }
  }

  ws.addRow([]);
  const note = ws.addRow([
    `${invoices.length} bills read, ${ok} look clean, ${invoices.length - ok} need a check. Nothing here is final until a person approves it.`,
  ]);
  note.getCell(1).font = { italic: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
