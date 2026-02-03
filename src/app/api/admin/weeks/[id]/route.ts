import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";
import { getAdminSetting } from "@/lib/adminSettings";
import { parseDateInput } from "@/lib/date";
import {
  extractSpreadsheetId,
  formatWeekTab,
  getSheetsClient,
  parseSheet,
  updateStatusCells,
} from "@/lib/googleSheets";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { schedule, template_id } = await request.json();

  const supabase = getServiceSupabase();

  if (template_id !== undefined) {
    const { error } = await supabase
      .from("weeks")
      .update({ template_id: template_id ?? null })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Failed to update week." }, { status: 500 });
    }
  }

  if (Array.isArray(schedule)) {
    const { error: deleteError } = await supabase
      .from("scheduled_jobs")
      .delete()
      .eq("week_id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to update schedule." },
        { status: 500 }
      );
    }

    if (schedule.length > 0) {
      const rows = schedule.map((item: any) => ({
        week_id: id,
        day_of_week: Number(item.day_of_week),
        job_definition_id: String(item.job_definition_id),
        sort_order: Number(item.sort_order ?? 0),
      }));

      const { error: insertError } = await supabase
        .from("scheduled_jobs")
        .insert(rows);

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to update schedule." },
          { status: 500 }
        );
      }
    }

    const sheetUrl = await getAdminSetting("google_sheet_url");
    if (sheetUrl) {
      const spreadsheetId = extractSpreadsheetId(sheetUrl);
      if (spreadsheetId) {
        const { data: week } = await supabase
          .from("weeks")
          .select("start_date")
          .eq("id", id)
          .single();
        const { data: jobs } = await supabase
          .from("job_definitions")
          .select("id, sort_order")
          .order("sort_order", { ascending: true });
        if (week && jobs) {
          const jobOrder = jobs.map((job) => job.id);
          const startDate = parseDateInput(week.start_date);
          const tabName = formatWeekTab(startDate);
          const sheets = await getSheetsClient();
          const { data: sheetData } = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${tabName}'!C3:P${2 + jobOrder.length}`,
          });
          const { statuses } = parseSheet(sheetData.values ?? []);
          const desired = jobOrder.map((_jobId, rowIndex) => {
            return Array.from({ length: 7 }).map((_v, dayIndex) => {
              const scheduledOn = schedule.some(
                (item: any) =>
                  Number(item.day_of_week) === dayIndex &&
                  String(item.job_definition_id) === jobOrder[rowIndex]
              );
              const current = (statuses[rowIndex]?.[dayIndex] ?? "").toUpperCase();
              if (!scheduledOn) return "N";
              if (current === "N" || current === "") return "O";
              return current;
            });
          });

          await updateStatusCells({
            spreadsheetId,
            tabName,
            statuses: desired,
            rowCount: jobOrder.length,
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("weeks").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete week." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
