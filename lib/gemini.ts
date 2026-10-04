import { normalizeInvoice } from "./normalize";
import type { Invoice } from "./types";

const PROMPT = `This is a purchase invoice/bill received by an Indian business. Read it carefully and return ONE JSON object, nothing else.

Rules:
- Copy numbers exactly as printed. Plain numbers only: no currency symbols, no thousands separators.
- If a value is blurry, cut off, or you are not sure, use null and add the field name to "unclear_fields". Never guess or calculate values that are not printed.
- invoice_date as YYYY-MM-DD. Indian bills are day-first (12/09/2026 is 12 September 2026).
- supplier_gstin and buyer_gstin are 15 characters, uppercase, exactly as printed.
- If the file has several pages, they belong to one invoice.
- "line_items" has one entry per product/service row. hsn_sac is the HSN or SAC code printed for that row.

JSON shape:
{
  "supplier_name": string|null,
  "supplier_gstin": string|null,
  "buyer_gstin": string|null,
  "invoice_number": string|null,
  "invoice_date": string|null,
  "line_items": [
    { "description": string|null, "hsn_sac": string|null, "quantity": number|null, "unit": string|null,
      "rate": number|null, "taxable_value": number|null,
      "cgst_rate": number|null, "cgst_amount": number|null,
      "sgst_rate": number|null, "sgst_amount": number|null,
      "igst_rate": number|null, "igst_amount": number|null }
  ],
  "taxable_total": number|null,
  "cgst_total": number|null,
  "sgst_total": number|null,
  "igst_total": number|null,
  "cess_total": number|null,
  "round_off": number|null,
  "invoice_total": number|null,
  "unclear_fields": string[]
}`;

function parseJson(text: string): unknown {
  const t = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(t);
}

export async function extractWithGemini(data: Buffer, mimeType: string, file: string, id: string): Promise<Invoice> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set on the server");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ inline_data: { mime_type: mimeType, data: data.toString("base64") } }, { text: PROMPT }],
          },
        ],
        generationConfig: { response_mime_type: "application/json", temperature: 0 },
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      throw new Error(`Gemini returned ${res.status}: ${body}`);
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text) throw new Error("Gemini returned no text (the file may have been blocked)");

    let raw: unknown;
    try {
      raw = parseJson(text);
    } catch {
      throw new Error("Gemini returned output that was not valid JSON");
    }
    return normalizeInvoice(raw, file, id);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Gemini took too long. Try this file again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
