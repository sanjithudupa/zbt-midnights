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

type AdminCheck = { position: number; checked: boolean };

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { scheduledJobId, userId, checks } = await request.json();

  if (typeof scheduledJobId !== "string" || !scheduledJobId) {
    return NextResponse.json(
      { error: "Scheduled job required." },
      { status: 400 }
    );
  }
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "User required." }, { status: 400 });
  }
  if (!Array.isArray(checks)) {
    return NextResponse.json({ error: "Checks required." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: scheduledJob, error: scheduledError } = await supabase
    .from("scheduled_jobs")
    .select(
      "id, job_definition_id, job_definitions ( id, job_requirements ( position, description ) )"
    )
    .eq("id", scheduledJobId)
    .single();

  if (scheduledError || !scheduledJob) {
    return NextResponse.json(
      { error: "Scheduled job not found." },
      { status: 404 }
    );
  }

  const jobDefinition = Array.isArray(scheduledJob.job_definitions)
    ? scheduledJob.job_definitions[0]
    : scheduledJob.job_definitions;
  const requirements =
    jobDefinition?.job_requirements
      ?.slice()
      .sort((a, b) => a.position - b.position) ?? [];
  const requirementPositions = new Set(
    requirements.map((req) => req.position)
  );

  for (const check of checks as AdminCheck[]) {
    if (!requirementPositions.has(check?.position)) {
      return NextResponse.json(
        { error: "Invalid requirement position." },
        { status: 400 }
      );
    }
  }

  const reviewNote = JSON.stringify({
    admin_entry: true,
    checks: (checks as AdminCheck[]).map((check) => ({
      position: check.position,
      checked: Boolean(check.checked),
    })),
  });

  const { error: insertError } = await supabase.from("job_submissions").insert({
    scheduled_job_id: scheduledJobId,
    user_id: userId,
    review_status: "admin",
    verified_by_admin: true,
    review_note: reviewNote,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Submission already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to save admin submission." },
      { status: 500 }
    );
  }

  const sheetUrl = await getAdminSetting("google_sheet_url");
  if (sheetUrl) {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (spreadsheetId) {
      const { data: scheduled } = await supabase
        .from("scheduled_jobs")
        .select(
          "day_of_week, job_definition_id, weeks ( start_date ), job_definitions ( sort_order )"
        )
        .eq("id", scheduledJobId)
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

  return NextResponse.json({ ok: true });
}
