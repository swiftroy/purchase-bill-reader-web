import type { Invoice, LineItem } from "./types";

export function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const c = v
      .replace(/₹/g, "")
      .replace(/\bINR\b/gi, "")
      .replace(/\bRs\.?/gi, "")
      .replace(/[,\s]/g, "");
    if (c === "") return null;
    const n = Number(c);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function toStr(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function cleanGstin(v: unknown): string | null {
  const s = toStr(v);
  if (!s) return null;
  const c = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c === "" ? null : c;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDate(v: unknown): string | null {
  const s = toStr(v);
  if (!s) return null;
  let y = 0;
  let mo = 0;
  let d = 0;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    y = +m[1];
    mo = +m[2];
    d = +m[3];
  } else {
    // Indian bills are day-first: 12/09/2026 means 12 September
    m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (!m) return null;
    d = +m[1];
    mo = +m[2];
    y = +m[3];
    if (y < 100) y += 2000;
  }
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

type Raw = Record<string, unknown>;

function normalizeLine(raw: unknown): LineItem {
  const r: Raw = raw && typeof raw === "object" ? (raw as Raw) : {};
  const hsn = toStr(r.hsn_sac ?? r.hsn);
  return {
    description: toStr(r.description),
    hsn_sac: hsn ? hsn.replace(/\s/g, "") : null,
    quantity: toNum(r.quantity),
    unit: toStr(r.unit),
    rate: toNum(r.rate),
    taxable_value: toNum(r.taxable_value),
    cgst_rate: toNum(r.cgst_rate),
    cgst_amount: toNum(r.cgst_amount),
    sgst_rate: toNum(r.sgst_rate),
    sgst_amount: toNum(r.sgst_amount),
    igst_rate: toNum(r.igst_rate),
    igst_amount: toNum(r.igst_amount),
  };
}

export function normalizeInvoice(input: unknown, file: string, id: string): Invoice {
  const raw: Raw = Array.isArray(input) ? ((input[0] as Raw) ?? {}) : ((input as Raw) ?? {});
  const unclear = Array.isArray(raw.unclear_fields)
    ? (raw.unclear_fields as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  let date = toIsoDate(raw.invoice_date);
  if (!date && toStr(raw.invoice_date)) unclear.push("invoice_date");

  return {
    id,
    file,
    supplier_name: toStr(raw.supplier_name),
    supplier_gstin: cleanGstin(raw.supplier_gstin),
    buyer_gstin: cleanGstin(raw.buyer_gstin),
    invoice_number: toStr(raw.invoice_number),
    invoice_date: date,
    line_items: Array.isArray(raw.line_items) ? (raw.line_items as unknown[]).map(normalizeLine) : [],
    taxable_total: toNum(raw.taxable_total),
    cgst_total: toNum(raw.cgst_total),
    sgst_total: toNum(raw.sgst_total),
    igst_total: toNum(raw.igst_total),
    cess_total: toNum(raw.cess_total),
    round_off: toNum(raw.round_off),
    invoice_total: toNum(raw.invoice_total),
    unclear_fields: unclear,
  };
}
