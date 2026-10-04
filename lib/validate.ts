import type { Invoice } from "./types";

const GSTIN_RE = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function gstinChecksumOk(g: string | null): boolean {
  if (!g || g.length !== 15) return false;
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const idx = CHARS.indexOf(g[i]);
    if (idx < 0) return false;
    const val = idx * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(val / 36) + (val % 36);
  }
  return g[14] === CHARS[(36 - (total % 36)) % 36];
}

const n = (x: number | null) => (typeof x === "number" ? x : 0);
const money = (x: number) => x.toFixed(2);

function validateOne(inv: Invoice, own: string | null, seen: Map<string, string>): string[] {
  const issues: string[] = [];

  if (inv.read_error) {
    return [`Could not read this file: ${inv.read_error}`];
  }
  if (inv.unclear_fields.length) issues.push(`Unclear on bill: ${inv.unclear_fields.join(", ")}`);

  if (!inv.supplier_name) issues.push("Supplier name missing");
  if (!inv.invoice_number) issues.push("Invoice number missing");
  if (!inv.invoice_date) issues.push("Invoice date missing");

  const sg = inv.supplier_gstin;
  if (!sg) issues.push("Supplier GSTIN missing (ITC not claimable without it)");
  else if (!GSTIN_RE.test(sg)) issues.push("Supplier GSTIN format invalid");
  else if (!gstinChecksumOk(sg)) issues.push("Supplier GSTIN checksum failed (likely a misread digit)");

  if (own && inv.buyer_gstin && inv.buyer_gstin !== own) {
    issues.push("Buyer GSTIN on bill differs from your GSTIN");
  }

  if (inv.line_items.length === 0) issues.push("No line items found");
  inv.line_items.forEach((it, i) => {
    if (!it.hsn_sac) issues.push(`Line ${i + 1}: HSN/SAC missing`);
  });

  const lineTaxable = inv.line_items.reduce((s, it) => s + n(it.taxable_value), 0);
  const taxable = inv.taxable_total ?? (inv.line_items.length ? lineTaxable : null);
  const cgst = n(inv.cgst_total);
  const sgst = n(inv.sgst_total);
  const igst = n(inv.igst_total);
  const cess = n(inv.cess_total);

  if (inv.invoice_total !== null && taxable !== null) {
    const calc = taxable + cgst + sgst + igst + cess + n(inv.round_off);
    if (Math.abs(calc - inv.invoice_total) > 1.5) {
      issues.push(`Tax math off: parts add to ${money(calc)} but bill total is ${money(inv.invoice_total)}`);
    }
  }
  if (inv.line_items.length && lineTaxable && taxable !== null && Math.abs(lineTaxable - taxable) > 1.5) {
    issues.push(`Line taxable values add to ${money(lineTaxable)} but bill taxable total is ${money(taxable)}`);
  }

  if (igst && (cgst || sgst)) issues.push("Both IGST and CGST/SGST charged");
  if (own && sg && GSTIN_RE.test(sg)) {
    const sameState = sg.slice(0, 2) === own.slice(0, 2);
    if (sameState && igst) issues.push("Same-state purchase but IGST charged");
    if (!sameState && (cgst || sgst)) issues.push("Inter-state purchase but CGST/SGST charged");
  }
  if (cgst && Math.abs(cgst - sgst) > 0.05) issues.push("CGST and SGST amounts differ");

  const num = (inv.invoice_number ?? "").trim().toUpperCase();
  if (sg && num) {
    const key = `${sg}|${num}`;
    const first = seen.get(key);
    if (first) issues.push(`Duplicate of ${first}`);
    else seen.set(key, inv.file);
  }
  return issues;
}

/** Returns issues keyed by invoice id. Recomputed from scratch, so it is safe to call on every edit. */
export function validateInvoices(invoices: Invoice[], ownGstin: string | null): Record<string, string[]> {
  const own = ownGstin ? ownGstin.toUpperCase().replace(/[^A-Z0-9]/g, "") || null : null;
  const seen = new Map<string, string>();
  const out: Record<string, string[]> = {};
  for (const inv of invoices) out[inv.id] = validateOne(inv, own, seen);
  return out;
}
