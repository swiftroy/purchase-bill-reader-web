// Sample data used by DEMO_MODE and the self test. One clean bill, one problem bill, one duplicate.
export const DEMO_INVOICES: Record<string, unknown>[] = [
  {
    supplier_name: "Shree Hydraulics",
    supplier_gstin: "27AAPFU0939F1ZV",
    buyer_gstin: "27ABCDE1234F1Z5",
    invoice_number: "SH/2026/118",
    invoice_date: "2026-09-12",
    line_items: [
      { description: "Hydraulic hose 1in", hsn_sac: "4009", quantity: 10, unit: "NOS", rate: 1200, taxable_value: 12000, cgst_rate: 9, cgst_amount: 1080, sgst_rate: 9, sgst_amount: 1080 },
    ],
    taxable_total: 12000, cgst_total: 1080, sgst_total: 1080, igst_total: null, invoice_total: 14160, unclear_fields: [],
  },
  {
    supplier_name: "Delhi Steel Traders",
    supplier_gstin: "07AABCD1234E1Z9",
    buyer_gstin: "27ABCDE1234F1Z5",
    invoice_number: "DST-77",
    invoice_date: "20/09/2026",
    line_items: [
      { description: "MS plate 10mm", hsn_sac: null, quantity: 2, unit: "MT", rate: 60000, taxable_value: 120000, cgst_rate: 9, cgst_amount: 10800, sgst_rate: 9, sgst_amount: 10800 },
    ],
    taxable_total: 120000, cgst_total: 10800, sgst_total: 10800, igst_total: null, invoice_total: 150000, unclear_fields: ["supplier_gstin"],
  },
  {
    supplier_name: "Shree Hydraulics",
    supplier_gstin: "27AAPFU0939F1ZV",
    buyer_gstin: "27ABCDE1234F1Z5",
    invoice_number: "SH/2026/118",
    invoice_date: "2026-09-12",
    line_items: [
      { description: "Hydraulic hose 1in", hsn_sac: "4009", quantity: 10, unit: "NOS", rate: 1200, taxable_value: 12000, cgst_rate: 9, cgst_amount: 1080, sgst_rate: 9, sgst_amount: 1080 },
    ],
    taxable_total: 12000, cgst_total: 1080, sgst_total: 1080, igst_total: null, invoice_total: 14160, unclear_fields: [],
  },
];
