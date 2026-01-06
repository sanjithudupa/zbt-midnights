import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const { password } = await request.json();
  if (typeof password !== "string") {
    return NextResponse.json({ error: "Invalid password." }, { status: 400 });
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  const plaintext = process.env.ADMIN_PASSWORD;

  let isValid = false;
  if (hash) {
    isValid = await bcrypt.compare(password, hash);
  } else if (plaintext) {
    isValid = password === plaintext;
  }

  if (!isValid) {
    return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  await setSessionCookie({ role: "admin" });
  return NextResponse.json({ ok: true });
}
