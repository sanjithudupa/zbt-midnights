import { NextResponse } from "next/server";
import { getAdminSetting } from "@/lib/adminSettings";
import { normalizeAlwaysAllowedGmails } from "@/lib/sheetsProtection";
import { setWeekSheetProtection } from "@/lib/sheetsWeek";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date")?.trim();
  const state = searchParams.get("state")?.trim();
  const key = searchParams.get("key")?.trim();
  const expectedKey = process.env.PUBLIC_SHEETS_PROTECTION_KEY?.trim();

  if (!expectedKey || key !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "Invalid start_date." }, { status: 400 });
  }
  if (state !== "full_protected" && state !== "signup_open") {
    return NextResponse.json({ error: "Invalid state." }, { status: 400 });
  }

  try {
    const rawAllowed = (await getAdminSetting("always_allowed_gmails")) ?? "";
    const normalized = normalizeAlwaysAllowedGmails(String(rawAllowed));
    const result = await setWeekSheetProtection({
      startDate,
      mode: state,
      alwaysAllowedGmails: normalized.emails,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update sheet protection.";
    const status =
      message.includes("Invalid") ||
      message.includes("Missing") ||
      message.includes("No sheet found")
        ? 400
        : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
