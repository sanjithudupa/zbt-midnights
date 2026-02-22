import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminSetting } from "@/lib/adminSettings";
import { getWeekSheetData } from "@/lib/sheetsWeek";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const startDate = url.searchParams.get("start_date");
  if (!startDate) {
    return NextResponse.json({ error: "Missing start_date." }, { status: 400 });
  }

  const scheduleSource = (await getAdminSetting("schedule_source_of_truth")) ?? "database";
  if (scheduleSource !== "google sheet") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const { sheetName, data } = await getWeekSheetData(startDate);
    console.log(`[sheets] ${sheetName} transposed data:`, data);
    return NextResponse.json({ ok: true, sheetName, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sheet." },
      { status: 400 }
    );
  }
}
