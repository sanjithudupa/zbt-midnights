import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminSetting } from "@/lib/adminSettings";
import { normalizeAlwaysAllowedGmails } from "@/lib/sheetsProtection";
import { setWeekSheetProtection } from "@/lib/sheetsWeek";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const startDate = body?.start_date;
  const mode = body?.mode;

  if (
    typeof startDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())
  ) {
    return NextResponse.json({ error: "Invalid start_date." }, { status: 400 });
  }
  if (mode !== "full_protected" && mode !== "signup_open") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }

  try {
    const rawAllowed = (await getAdminSetting("always_allowed_gmails")) ?? "";
    const normalized = normalizeAlwaysAllowedGmails(String(rawAllowed));
    const result = await setWeekSheetProtection({
      startDate: startDate.trim(),
      mode,
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
