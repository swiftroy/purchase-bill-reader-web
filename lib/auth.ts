import { createHash, createHmac, timingSafeEqual } from "crypto";

export const COOKIE = "gst_auth";

function sessionToken(): string | null {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  return createHmac("sha256", pw).update("gst-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isAuthed(cookieValue: string | undefined): boolean {
  const expected = sessionToken();
  if (!expected || !cookieValue) return false;
  return safeEqual(cookieValue, expected);
}

export function passwordOk(input: string): boolean {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  return safeEqual(input, pw);
}

export function newSessionToken(): string | null {
  return sessionToken();
}
