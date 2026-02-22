import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";
import { getAdminSetting } from "@/lib/adminSettings";
import { updateWeekSheetVerification } from "@/lib/sheetsWeek";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { submissionId } = await request.json();
  if (typeof submissionId !== "string" || !submissionId) {
    return NextResponse.json(
      { error: "Submission id required." },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();
  const { data: submission, error } = await supabase
    .from("job_submissions")
    .select(
      "id, scheduled_job_id, verified_by_admin, user_id, users ( username ), scheduled_jobs ( id, day_of_week, week_id, job_definitions ( name ) )"
    )
    .eq("id", submissionId)
    .single();

  if (error || !submission) {
    return NextResponse.json(
      { error: "Submission not found." },
      { status: 404 }
    );
  }

  if (!submission.verified_by_admin) {
    const { error: updateError } = await supabase
      .from("job_submissions")
      .update({
        verified_by_admin: true,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to approve submission." },
        { status: 500 }
      );
    }
  }

  const scheduleSource = (await getAdminSetting("schedule_source_of_truth")) ?? "database";
  const scheduledJobRaw = submission.scheduled_jobs as
    | {
        id: string;
        day_of_week: number;
        week_id: string;
        job_definitions?: { name?: string } | Array<{ name?: string }>;
      }
    | Array<{
        id: string;
        day_of_week: number;
        week_id: string;
        job_definitions?: { name?: string } | Array<{ name?: string }>;
      }>
    | null;
  const scheduledJob = Array.isArray(scheduledJobRaw)
    ? scheduledJobRaw[0]
    : scheduledJobRaw;
  const jobName =
    Array.isArray(scheduledJob?.job_definitions)
      ? scheduledJob?.job_definitions?.[0]?.name
      : scheduledJob?.job_definitions?.name;
  if (
    scheduleSource === "google sheet" &&
    jobName &&
    scheduledJob?.week_id &&
    typeof scheduledJob.day_of_week === "number"
  ) {
    const submissionUserRaw = submission.users as
      | { username?: string }
      | Array<{ username?: string }>
      | null;
    const submissionUser = Array.isArray(submissionUserRaw)
      ? submissionUserRaw[0]
      : submissionUserRaw;
    const username = submissionUser?.username ?? "NONE";
    const { data: week } = await supabase
      .from("weeks")
      .select("start_date")
      .eq("id", scheduledJob.week_id)
      .maybeSingle();
    if (week?.start_date) {
      try {
        await updateWeekSheetVerification({
          startDate: week.start_date,
          jobName,
          dayIndex: scheduledJob.day_of_week,
          username,
        });
      } catch (sheetError) {
        console.error("Failed to update sheet for approval.", sheetError);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
