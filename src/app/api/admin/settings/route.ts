import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { getAdminSetting, setAdminSetting } from "@/lib/adminSettings";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const adminPasswordHash = await getAdminSetting("admin_password_hash");
  const imgbbKey = await getAdminSetting("imgbb_api_key");
  const googleSheetUrl = await getAdminSetting("google_sheet_url");

  return NextResponse.json({
    settings: {
      hasAdminPassword: Boolean(adminPasswordHash),
      hasImgbbKey: Boolean(imgbbKey),
      hasGoogleSheetUrl: Boolean(googleSheetUrl),
    },
  });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { adminPassword, imgbbApiKey, masterPassword, googleSheetUrl } = body ?? {};
  const master = process.env.ADMIN_UPDATE_MASTER_PASSWORD;
  if (!master || masterPassword !== master) {
    return NextResponse.json(
      { error: "Invalid master password." },
      { status: 401 }
    );
  }

  if (typeof adminPassword === "string" && adminPassword.trim()) {
    const hash = await bcrypt.hash(adminPassword.trim(), 10);
    await setAdminSetting("admin_password_hash", hash);
  }

  if (typeof imgbbApiKey === "string" && imgbbApiKey.trim()) {
    await setAdminSetting("imgbb_api_key", imgbbApiKey.trim());
  }

  if (typeof googleSheetUrl === "string" && googleSheetUrl.trim()) {
    await setAdminSetting("google_sheet_url", googleSheetUrl.trim());
  }

  return NextResponse.json({ ok: true });
}
