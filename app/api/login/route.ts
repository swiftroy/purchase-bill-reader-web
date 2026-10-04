import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, isAuthed, newSessionToken, passwordOk } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  return NextResponse.json({ authed: isAuthed(jar.get(COOKIE)?.value) });
}

export async function POST(req: NextRequest) {
  if (!process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "APP_PASSWORD is not set on the server" }, { status: 500 });
  }
  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!passwordOk(password)) {
    await new Promise((r) => setTimeout(r, 700)); // slows down guessing
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  const res = NextResponse.json({ authed: true });
  res.cookies.set(COOKIE, newSessionToken() as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ authed: false });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
