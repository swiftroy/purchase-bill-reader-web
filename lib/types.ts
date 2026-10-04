export type LineItem = {
  description: string | null;
  hsn_sac: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  taxable_value: number | null;
  cgst_rate: number | null;
  cgst_amount: number | null;
  sgst_rate: number | null;
  sgst_amount: number | null;
  igst_rate: number | null;
  igst_amount: number | null;
};

export type Invoice = {
  id: string;
  file: string;
  supplier_name: string | null;
  supplier_gstin: string | null;
  buyer_gstin: string | null;
  invoice_number: string | null;
  invoice_date: string | null; // YYYY-MM-DD
  line_items: LineItem[];
  taxable_total: number | null;
  cgst_total: number | null;
  sgst_total: number | null;
  igst_total: number | null;
  cess_total: number | null;
  round_off: number | null;
  invoice_total: number | null;
  unclear_fields: string[];
  read_error?: string;
};
