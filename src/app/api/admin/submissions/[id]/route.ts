import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";
import { getAdminSetting } from "@/lib/adminSettings";
import { parseDateInput } from "@/lib/date";
import {
  extractSpreadsheetId,
  formatWeekTab,
  updateSingleStatusCell,
} from "@/lib/googleSheets";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { verified_by_admin } = await request.json();
  if (typeof verified_by_admin !== "boolean") {
    return NextResponse.json(
      { error: "verified_by_admin required." },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();
  const { data: updated, error } = await supabase
    .from("job_submissions")
    .update({ verified_by_admin })
    .eq("id", id)
    .select("id, scheduled_job_id, verified_by_admin")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: "Failed to update submission." },
      { status: 500 }
    );
  }

  if (verified_by_admin) {
    const sheetUrl = await getAdminSetting("google_sheet_url");
    if (sheetUrl) {
      const spreadsheetId = extractSpreadsheetId(sheetUrl);
      if (spreadsheetId) {
        const { data: scheduled } = await supabase
          .from("scheduled_jobs")
          .select(
            "day_of_week, job_definition_id, weeks ( start_date ), job_definitions ( sort_order )"
          )
          .eq("id", updated.scheduled_job_id)
          .single();

        if (scheduled?.weeks?.start_date) {
          const startDate = parseDateInput(scheduled.weeks.start_date);
          const tabName = formatWeekTab(startDate);
          const rowIndex = scheduled.job_definitions?.sort_order ?? 0;
          await updateSingleStatusCell({
            spreadsheetId,
            tabName,
            dayIndex: scheduled.day_of_week,
            rowIndex,
            value: "V",
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

  const { error: photoError } = await supabase
    .from("submission_photos")
    .delete()
    .eq("submission_id", id);

  if (photoError) {
    return NextResponse.json(
      { error: "Failed to delete submission photos." },
      { status: 500 }
    );
  }

  const { error: submissionError } = await supabase
    .from("job_submissions")
    .delete()
    .eq("id", id);

  if (submissionError) {
    return NextResponse.json(
      { error: "Failed to delete submission." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
