import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";
import { updateWeekSheetVerification } from "@/lib/sheetsWeek";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { scheduledJobId, userId } = await request.json();

  if (typeof scheduledJobId !== "string" || !scheduledJobId) {
    return NextResponse.json(
      { error: "Scheduled job required." },
      { status: 400 }
    );
  }
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "User required." }, { status: 400 });
  }
  const supabase = getServiceSupabase();
  const { data: scheduledJob, error: scheduledError } = await supabase
    .from("scheduled_jobs")
    .select(
      "id, day_of_week, week_id, job_definition_id, job_definitions ( id, name, job_requirements ( position, description ) )"
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
  const reviewNote = JSON.stringify({
    admin_entry: true,
    checks: requirements.map((req) => ({
      position: req.position,
      checked: true,
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

  if (jobDefinition?.name) {
    const { data: week } = await supabase
      .from("weeks")
      .select("start_date")
      .eq("id", scheduledJob.week_id)
      .maybeSingle();
    const { data: user } = await supabase
      .from("users")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    if (week?.start_date) {
      try {
        await updateWeekSheetVerification({
          startDate: week.start_date,
          jobName: jobDefinition.name,
          dayIndex: scheduledJob.day_of_week,
          username: user?.username ?? "NONE",
        });
      } catch (error) {
        console.error("Failed to update sheet for admin entry.", error);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
