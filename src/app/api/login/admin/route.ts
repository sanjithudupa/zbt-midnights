import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { setSessionCookie } from "@/lib/session";
import { getAdminSetting } from "@/lib/adminSettings";

export async function POST(request: Request) {
  const { password } = await request.json();
  if (typeof password !== "string") {
    return NextResponse.json({ error: "Invalid password." }, { status: 400 });
  }

  let hash: string | null = null;
  try {
    hash = await getAdminSetting("admin_password_hash");
  } catch {
    hash = null;
  }

  if (!hash) {
    return NextResponse.json(
      { error: "Admin password not configured." },
      { status: 500 }
    );
  }

  const isValid = await bcrypt.compare(password, hash);

  if (!isValid) {
    return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  await setSessionCookie({ role: "admin" });
  return NextResponse.json({ ok: true });
}
