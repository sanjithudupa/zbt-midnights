import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/session";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { getAdminSetting } from "@/lib/adminSettings";
import { parseDateInput } from "@/lib/date";
import {
  extractSpreadsheetId,
  formatWeekTab,
  getSheetsClient,
  parseSheet,
} from "@/lib/googleSheets";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "user")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weekId = searchParams.get("weekId");
  const sync = searchParams.get("sync") === "1";
  if (!weekId) {
    return NextResponse.json({ error: "Week required." }, { status: 400 });
  }

  const sheetUrl = await getAdminSetting("google_sheet_url");
  if (!sheetUrl) {
    return NextResponse.json(
      { error: "Google Sheet URL not configured." },
      { status: 400 }
    );
  }

  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "Invalid Google Sheet URL." },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();
  const { data: week, error: weekError } = await supabase
    .from("weeks")
    .select("start_date")
    .eq("id", weekId)
    .single();

  if (weekError || !week) {
    return NextResponse.json({ error: "Week not found." }, { status: 404 });
  }

  const startDate = parseDateInput(week.start_date);
  const tabName = formatWeekTab(startDate);
  const range = `'${tabName}'!C3:P11`;

  const sheets = await getSheetsClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const values = data.values ?? [];
  const { signups, statuses } = parseSheet(values);

  const { data: jobs } = await supabase
    .from("job_definitions")
    .select("id, sort_order")
    .order("sort_order", { ascending: true });

  const jobOrder = (jobs ?? []).map((job) => job.id);

  if (sync && session.role === "admin") {
    const { data: existing } = await supabase
      .from("scheduled_jobs")
      .select("id, day_of_week, job_definition_id")
      .eq("week_id", weekId);

    const existingMap = new Map<string, string>();
    (existing ?? []).forEach((row) => {
      existingMap.set(`${row.day_of_week}:${row.job_definition_id}`, row.id);
    });

    const deletes: string[] = [];
    const inserts: Array<{
      week_id: string;
      day_of_week: number;
      job_definition_id: string;
      sort_order: number;
    }> = [];

    for (let rowIndex = 0; rowIndex < jobOrder.length; rowIndex += 1) {
      const jobId = jobOrder[rowIndex];
      const rowStatuses = statuses[rowIndex] ?? [];
      for (let day = 0; day < 7; day += 1) {
        const status = (rowStatuses[day] ?? "").toUpperCase();
        const key = `${day}:${jobId}`;
        const exists = existingMap.has(key);
        const isOn = status !== "N" && status !== "";
        if (!isOn && exists) {
          deletes.push(existingMap.get(key) as string);
        }
        if (isOn && !exists) {
          inserts.push({
            week_id: weekId,
            day_of_week: day,
            job_definition_id: jobId,
            sort_order: rowIndex,
          });
        }
      }
    }

    if (deletes.length > 0) {
      await supabase.from("scheduled_jobs").delete().in("id", deletes);
    }
    if (inserts.length > 0) {
      await supabase.from("scheduled_jobs").insert(inserts);
    }
  }

  const { data: submissions } = await supabase
    .from("job_submissions")
    .select(
      "id, scheduled_job_id, submitted_at, verified_by_admin, scheduled_jobs ( day_of_week, job_definition_id )"
    )
    .eq("scheduled_jobs.week_id", weekId);

  if (submissions?.length) {
    const latestMap = new Map<
      string,
      { id: string; submitted_at: string; verified_by_admin?: boolean | null }
    >();
    submissions.forEach((submission: any) => {
      const key = `${submission.scheduled_jobs?.day_of_week}:${submission.scheduled_jobs?.job_definition_id}`;
      const existing = latestMap.get(key);
      if (!existing || new Date(submission.submitted_at) > new Date(existing.submitted_at)) {
        latestMap.set(key, submission);
      }
    });

    const updates: string[] = [];
    for (let rowIndex = 0; rowIndex < jobOrder.length; rowIndex += 1) {
      const jobId = jobOrder[rowIndex];
      const rowStatuses = statuses[rowIndex] ?? [];
      for (let day = 0; day < 7; day += 1) {
        const status = (rowStatuses[day] ?? "").toUpperCase();
        if (status === "V") {
          const key = `${day}:${jobId}`;
          const submission = latestMap.get(key);
          if (submission && !submission.verified_by_admin) {
            updates.push(submission.id);
          }
        }
      }
    }

    if (updates.length > 0) {
      await supabase
        .from("job_submissions")
        .update({ verified_by_admin: true })
        .in("id", updates);
    }
  }

  return NextResponse.json({ ok: true, tabName, signups, statuses });
}
