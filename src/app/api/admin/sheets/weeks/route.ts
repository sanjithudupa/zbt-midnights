import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { listSheetWeeks } from "@/lib/sheetsWeek";

export const runtime = "nodejs";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const [sheetWeeks, dbWeeksResult] = await Promise.all([
      listSheetWeeks(),
      getServiceSupabase().from("weeks").select("id, start_date"),
    ]);

    if (dbWeeksResult.error) {
      return NextResponse.json(
        { error: "Failed to load database weeks." },
        { status: 500 }
      );
    }

    const byStartDate = new Map(
      (dbWeeksResult.data ?? []).map((week) => [week.start_date, week.id] as const)
    );

    const merged = sheetWeeks.map((sheetWeek) => ({
      sheet_name: sheetWeek.sheetName,
      start_date: sheetWeek.startDate,
      protection_mode: sheetWeek.protectionMode,
      has_week_record: byStartDate.has(sheetWeek.startDate),
      week_id: byStartDate.get(sheetWeek.startDate) ?? null,
    }));

    return NextResponse.json({ sheetWeeks: merged });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load sheet weeks.",
      },
      { status: 500 }
    );
  }
}
