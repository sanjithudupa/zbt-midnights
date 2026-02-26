import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { getAdminSetting, setAdminSetting } from "@/lib/adminSettings";
import { normalizeAlwaysAllowedGmails } from "@/lib/sheetsProtection";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const adminPasswordHash = await getAdminSetting("admin_password_hash");
  const imgbbKey = await getAdminSetting("imgbb_api_key");
  const sheetsUrl = await getAdminSetting("SHEETS_URL");
  const scheduleSource =
    (await getAdminSetting("schedule_source_of_truth")) ?? "database";
  const alwaysAllowedGmails =
    (await getAdminSetting("always_allowed_gmails")) ?? "";

  return NextResponse.json({
    settings: {
      hasAdminPassword: Boolean(adminPasswordHash),
      hasImgbbKey: Boolean(imgbbKey),
      hasSheetsUrl: Boolean(sheetsUrl),
      scheduleSourceOfTruth: scheduleSource,
      alwaysAllowedGmails,
    },
  });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const {
    adminPassword,
    imgbbApiKey,
    sheetsUrl,
    scheduleSourceOfTruth,
    alwaysAllowedGmails,
    masterPassword,
  } = body ?? {};
  const master = process.env.ADMIN_UPDATE_MASTER_PASSWORD;
  if (!master || masterPassword !== master) {
    return NextResponse.json(
      { error: "Invalid master password." },
      { status: 401 }
    );
  }

  let normalizedAlwaysAllowed:
    | { emails: string[]; invalid: string[] }
    | null = null;
  if (typeof alwaysAllowedGmails === "string") {
    normalizedAlwaysAllowed = normalizeAlwaysAllowedGmails(alwaysAllowedGmails);
    if (normalizedAlwaysAllowed.invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid email(s): ${normalizedAlwaysAllowed.invalid.join(", ")}`,
        },
        { status: 400 }
      );
    }
  }

  if (typeof adminPassword === "string" && adminPassword.trim()) {
    const hash = await bcrypt.hash(adminPassword.trim(), 10);
    await setAdminSetting("admin_password_hash", hash);
  }

  if (typeof imgbbApiKey === "string" && imgbbApiKey.trim()) {
    await setAdminSetting("imgbb_api_key", imgbbApiKey.trim());
  }

  if (typeof sheetsUrl === "string" && sheetsUrl.trim()) {
    await setAdminSetting("SHEETS_URL", sheetsUrl.trim());
  }

  if (typeof scheduleSourceOfTruth === "string" && scheduleSourceOfTruth.trim()) {
    const value = scheduleSourceOfTruth.trim();
    if (value !== "database" && value !== "google sheet") {
      return NextResponse.json(
        { error: "Invalid schedule source of truth." },
        { status: 400 }
      );
    }
    await setAdminSetting("schedule_source_of_truth", value);
  }

  if (normalizedAlwaysAllowed) {
    await setAdminSetting(
      "always_allowed_gmails",
      normalizedAlwaysAllowed.emails.join("\n")
    );
  }

  return NextResponse.json({ ok: true });
}
