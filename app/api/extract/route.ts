import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, isAuthed } from "@/lib/auth";
import { extractWithGemini } from "@/lib/gemini";
import { normalizeInvoice } from "@/lib/normalize";
import { DEMO_INVOICES } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4.4 * 1024 * 1024; // Vercel rejects request bodies over 4.5 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
let demoCounter = 0;

export async function POST(req: NextRequest) {
  const jar = await cookies();
  if (!isAuthed(jar.get(COOKIE)?.value)) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the upload" }, { status: 400 });
  }
  const file = form.get("file");
  const id = typeof form.get("id") === "string" ? (form.get("id") as string) : crypto.randomUUID();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WebP or PDF files are supported" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is over 4 MB" }, { status: 413 });
  }

  try {
    if (process.env.DEMO_MODE === "1") {
      const sample = DEMO_INVOICES[demoCounter++ % DEMO_INVOICES.length];
      return NextResponse.json(normalizeInvoice(sample, file.name, id));
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const invoice = await extractWithGemini(buf, file.type, file.name, id);
    return NextResponse.json(invoice);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
