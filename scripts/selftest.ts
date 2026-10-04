import { DEMO_INVOICES } from "../lib/demo";
import { normalizeInvoice, toIsoDate, toNum } from "../lib/normalize";
import { gstinChecksumOk, validateInvoices } from "../lib/validate";

let failed = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failed++;
}

const invoices = DEMO_INVOICES.map((d, i) => normalizeInvoice(d, `demo_${i + 1}.jpg`, `id${i + 1}`));
const issues = validateInvoices(invoices, "27ABCDE1234F1Z5");

check("valid GSTIN passes checksum", gstinChecksumOk("27AAPFU0939F1ZV"));
check("altered GSTIN fails checksum", !gstinChecksumOk("27AAPFU0939F1ZX"));
check("clean bill has no issues", issues.id1.length === 0);
check("problem bill flags unclear field", issues.id2.some((m) => m.startsWith("Unclear on bill")));
check("problem bill flags missing HSN", issues.id2.some((m) => m.includes("HSN/SAC missing")));
check("problem bill flags bad tax math", issues.id2.some((m) => m.startsWith("Tax math off")));
check("problem bill flags inter-state CGST/SGST", issues.id2.some((m) => m.includes("Inter-state")));
check("duplicate is flagged", issues.id3.some((m) => m.startsWith("Duplicate of demo_1.jpg")));
check("day-first date converts", invoices[1].invoice_date === "2026-09-20");
check("bad date rejected", toIsoDate("31/02/2026") === null);
check("amount strings parse", toNum("₹ 1,08,000.50") === 108000.5 && toNum("Rs. 12,000") === 12000);
check("array response is unwrapped", normalizeInvoice([DEMO_INVOICES[0]], "a", "x").invoice_number === "SH/2026/118");
check("read error short-circuits", validateInvoices([{ ...invoices[0], id: "e", read_error: "boom" }], null).e[0].includes("boom"));

process.exit(failed ? 1 : 0);
