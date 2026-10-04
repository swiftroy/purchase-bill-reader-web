import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, isAuthed } from "@/lib/auth";
import { buildWorkbook } from "@/lib/excel";
import { validateInvoices } from "@/lib/validate";
import { normalizeInvoice } from "@/lib/normalize";
import type { Invoice } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const jar = await cookies();
  if (!isAuthed(jar.get(COOKIE)?.value)) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { invoices?: unknown; ownGstin?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!Array.isArray(body.invoices) || body.invoices.length === 0 || body.invoices.length > 500) {
    return NextResponse.json({ error: "No invoices to export" }, { status: 400 });
  }

  // Re-normalise and re-validate on the server so the sheet never trusts the browser's flags.
  const invoices: Invoice[] = (body.invoices as Record<string, unknown>[]).map((raw, i) => {
    const inv = normalizeInvoice(raw, typeof raw.file === "string" ? raw.file : `bill_${i + 1}`, String(raw.id ?? i));
    const err = typeof raw.read_error === "string" ? raw.read_error : undefined;
    return err ? { ...inv, read_error: err } : inv;
  });
  const own = typeof body.ownGstin === "string" && body.ownGstin.trim() ? body.ownGstin : null;
  const issues = validateInvoices(invoices, own);
  const buf = await buildWorkbook(invoices, issues);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="purchases_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
