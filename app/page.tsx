"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Invoice } from "@/lib/types";
import { validateInvoices } from "@/lib/validate";

const MAX_UPLOAD = 4.2 * 1024 * 1024; // stay under Vercel's 4.5 MB request limit
const MAX_SIDE = 1800;

// crypto.randomUUID only exists on HTTPS or localhost; opening the app by LAN address (http://192.168.x.x) would crash without a fallback.
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function prepare(file: File): Promise<Blob> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_UPLOAD) throw new Error("PDF is over 4 MB. Re-save it smaller, or photograph the pages instead.");
    return file;
  }
  if (!file.type.startsWith("image/")) throw new Error("Only photos and PDFs are supported");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Could not open this image. For iPhone HEIC photos, share or export as JPEG first.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process this image");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process this image"))), "image/jpeg", 0.85),
  );
}

function errorRow(id: string, file: string, message: string): Invoice {
  return {
    id, file, supplier_name: null, supplier_gstin: null, buyer_gstin: null, invoice_number: null, invoice_date: null,
    line_items: [], taxable_total: null, cgst_total: null, sgst_total: null, igst_total: null, cess_total: null,
    round_off: null, invoice_total: null, unclear_fields: [], read_error: message,
  };
}

type TextField = "supplier_name" | "supplier_gstin" | "invoice_number" | "invoice_date";
type NumField = "taxable_total" | "cgst_total" | "sgst_total" | "igst_total" | "invoice_total";

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [rows, setRows] = useState<Invoice[]>([]);
  const [jobs, setJobs] = useState<{ id: string; name: string; status: "waiting" | "reading" }[]>([]);
  const pending = jobs.length;
  const [own, setOwn] = useState("");
  const [over, setOver] = useState(false);
  const [exportError, setExportError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const seenFiles = useRef(new Map<string, string>()); // file signature (name, size, modified) -> row id

  useEffect(() => {
    fetch("/api/login")
      .then((r) => r.json())
      .then((d: { authed?: boolean }) => setAuthed(!!d.authed))
      .catch(() => setAuthed(false));
    try {
      const saved = localStorage.getItem("own_gstin");
      if (saved) setOwn(saved);
    } catch {
      /* storage can be blocked; the field just starts empty */
    }
  }, []);

  const issues = useMemo(() => validateInvoices(rows, own.trim() || null), [rows, own]);
  const okCount = rows.filter((r) => (issues[r.id] ?? []).length === 0).length;

  function changeOwn(v: string) {
    const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
    setOwn(clean);
    try {
      localStorage.setItem("own_gstin", clean);
    } catch {
      /* ignore */
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setPassword("");
      setAuthed(true);
    } else {
      const d = (await res.json().catch(() => null)) as { error?: string } | null;
      setLoginError(d?.error ?? "Could not sign in");
    }
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    seenFiles.current.clear();
    setNotice("");
    setRows([]);
    setAuthed(false);
  }

  /** Returns true when the bill was read, false when it failed (so the same file can be tried again). */
  async function processOne(file: File, id: string): Promise<boolean> {
    const add = (inv: Invoice) => setRows((rs) => [...rs, inv]);
    try {
      const blob = await prepare(file);
      const form = new FormData();
      form.append("file", blob, file.name);
      form.append("id", id);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      if (res.status === 401) {
        setAuthed(false);
        return false;
      }
      const data = (await res.json().catch(() => null)) as (Partial<Invoice> & { error?: string }) | null;
      if (!res.ok || !data || data.error) {
        const msg = data?.error ?? (res.status === 413 ? "File too large to upload" : `Server error ${res.status}`);
        add(errorRow(id, file.name, msg));
        return false;
      }
      add({ ...(data as Invoice), id, file: file.name });
      return true;
    } catch (e) {
      add(errorRow(id, file.name, e instanceof Error ? e.message : "Failed to read this file"));
      return false;
    }
  }

  async function handleFiles(list: FileList | File[] | null) {
    if (!list) return;
    const skipped: string[] = [];
    const queue: { file: File; id: string; sig: string }[] = [];
    for (const file of Array.from(list)) {
      const sig = `${file.name}|${file.size}|${file.lastModified}`;
      if (seenFiles.current.has(sig)) {
        skipped.push(file.name);
        continue;
      }
      const id = newId();
      seenFiles.current.set(sig, id);
      queue.push({ file, id, sig });
    }
    setNotice(
      skipped.length
        ? `Skipped ${skipped.length} file${skipped.length > 1 ? "s" : ""} already added: ${skipped.join(", ")}. Remove its row first to read it again.`
        : "",
    );
    if (queue.length === 0) return;

    setJobs((j) => [...j, ...queue.map((q) => ({ id: q.id, name: q.file.name, status: "waiting" as const }))]);
    const worker = async () => {
      for (let q = queue.shift(); q; q = queue.shift()) {
        const jobId = q.id;
        const sig = q.sig;
        setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, status: "reading" as const } : x)));
        let ok = false;
        try {
          ok = await processOne(q.file, jobId);
        } finally {
          if (!ok) seenFiles.current.delete(sig); // a failed read can be retried
          setJobs((j) => j.filter((x) => x.id !== jobId));
        }
      }
    };
    await Promise.all([worker(), worker()]);
  }

  function removeRow(id: string) {
    for (const [sig, rowId] of seenFiles.current) {
      if (rowId === id) seenFiles.current.delete(sig);
    }
    setRows((rs) => rs.filter((x) => x.id !== id));
  }

  function clearAll() {
    seenFiles.current.clear();
    setNotice("");
    setRows([]);
  }

  function setText(id: string, field: TextField, value: string) {
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              [field]: value === "" ? null : value,
              unclear_fields: r.unclear_fields.filter((u) => u !== field),
              read_error: undefined,
            }
          : r,
      ),
    );
  }

  function setNum(id: string, field: NumField, value: number | null) {
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? { ...r, [field]: value, unclear_fields: r.unclear_fields.filter((u) => u !== field), read_error: undefined }
          : r,
      ),
    );
  }

  async function download() {
    setExportError("");
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invoices: rows, ownGstin: own }),
    });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    if (!res.ok) {
      setExportError("Could not build the Excel file. Try again.");
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchases_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (authed === null) return <main />;

  if (!authed) {
    return (
      <main style={{ maxWidth: 420 }}>
        <h1>Purchase bill reader</h1>
        <p className="sub">Enter the passcode to continue.</p>
        <form className="card" onSubmit={login}>
          <div className="field">
            <label htmlFor="pw">Passcode</label>
            <input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <p style={{ margin: "12px 0 0" }}>
            <button type="submit" disabled={!password}>Sign in</button>
          </p>
          {loginError && <p className="err" role="alert">{loginError}</p>}
        </form>
      </main>
    );
  }

  // A plain function, not a component: a component defined here would remount on every keystroke and drop focus.
  const numCell = (r: Invoice, f: NumField) => (
    <input
      className="num"
      type="number"
      step="0.01"
      aria-label={f.replace("_", " ")}
      value={r[f] ?? ""}
      onChange={(e) => setNum(r.id, f, e.target.value === "" ? null : Number(e.target.value))}
    />
  );

  return (
    <main>
      <div className="summary">
        <div>
          <h1>Purchase bill reader</h1>
          <p className="sub" style={{ margin: 0 }}>Upload bill photos or PDFs, fix the red rows, download the sheet.</p>
        </div>
        <button className="secondary" onClick={logout}>Sign out</button>
      </div>

      <div className="card">
        <div className="row">
          <div className="field">
            <label htmlFor="own">Your business GSTIN (enables state and buyer checks)</label>
            <input id="own" type="text" value={own} onChange={(e) => changeOwn(e.target.value)} placeholder="27ABCDE1234F1Z5" />
          </div>
        </div>
      </div>

      <div
        className={`drop${over ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void handleFiles(e.dataTransfer.files); }}
      >
        <p style={{ margin: "0 0 12px" }}><strong>Drop bills here</strong> or choose files (JPG, PNG, WebP, PDF under 4 MB)</p>
        <button onClick={() => inputRef.current?.click()}>Choose files</button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept="image/*,application/pdf"
          onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
        />
        <p className="note" style={{ margin: "12px 0 0" }}>
          Bills are sent to Google&apos;s Gemini API to be read. This app does not store them.
        </p>
        {notice && <p className="note" role="status" style={{ margin: "8px 0 0", color: "var(--bad-fg)" }}>{notice}</p>}
      </div>

      {jobs.length > 0 && (
        <div className="card" role="status" aria-live="polite" style={{ marginTop: 16 }}>
          {jobs.map((j) => (
            <div className="job" key={j.id}>
              {j.status === "reading" ? <span className="spinner" aria-hidden="true" /> : <span className="dot" aria-hidden="true" />}
              <span className="jobname">{j.name}</span>
              <span className="note">{j.status === "reading" ? "Reading this bill..." : "Waiting in line"}</span>
            </div>
          ))}
          <p className="note" style={{ margin: "8px 0 0" }}>
            Each bill takes about 10 to 30 seconds. Rows appear below as they finish.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="summary">
            <span>
              {rows.length} bill{rows.length > 1 ? "s" : ""} read: <span className="badge ok">{okCount} look clean</span>{" "}
              <span className="badge bad">{rows.length - okCount} need a check</span>
            </span>
            <span>
              <button className="secondary" onClick={clearAll} style={{ marginRight: 8 }}>Clear all</button>
              <button onClick={download} disabled={pending > 0}>Download Excel</button>
            </span>
          </div>
          {exportError && <p className="err" role="alert">{exportError}</p>}
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th><th>File</th><th>Supplier</th><th>Supplier GSTIN</th><th>Invoice no</th><th>Date</th>
                  <th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th><th>HSN</th><th>Issues to check</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const list = issues[r.id] ?? [];
                  const hsn = Array.from(new Set(r.line_items.map((l) => l.hsn_sac).filter(Boolean))).join(", ");
                  return (
                    <tr key={r.id} className={list.length ? "bad" : "ok"}>
                      <td><span className={`badge ${list.length ? "bad" : "ok"}`}>{list.length ? "Check" : "OK"}</span></td>
                      <td className="file">{r.file}</td>
                      <td><input className="wide" type="text" aria-label="supplier" value={r.supplier_name ?? ""} onChange={(e) => setText(r.id, "supplier_name", e.target.value)} /></td>
                      <td><input className="wide" type="text" aria-label="supplier GSTIN" value={r.supplier_gstin ?? ""} onChange={(e) => setText(r.id, "supplier_gstin", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></td>
                      <td><input type="text" aria-label="invoice number" value={r.invoice_number ?? ""} onChange={(e) => setText(r.id, "invoice_number", e.target.value)} /></td>
                      <td><input type="date" aria-label="invoice date" value={r.invoice_date ?? ""} onChange={(e) => setText(r.id, "invoice_date", e.target.value)} /></td>
                      <td>{numCell(r, "taxable_total")}</td>
                      <td>{numCell(r, "cgst_total")}</td>
                      <td>{numCell(r, "sgst_total")}</td>
                      <td>{numCell(r, "igst_total")}</td>
                      <td>{numCell(r, "invoice_total")}</td>
                      <td className="hsn">{hsn || "-"}</td>
                      <td>{list.length > 0 && <ul className="issues">{list.map((m) => <li key={m}>{m}</li>)}</ul>}</td>
                      <td><button className="secondary" aria-label={`Remove ${r.file}`} onClick={() => removeRow(r.id)}>Remove</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ margin: "12px 0 0" }}>
            Line items and HSN per item are in the Excel file. Compare each red row with the original bill, and spot-check a few green rows too.
          </p>
        </div>
      )}
    </main>
  );
}
