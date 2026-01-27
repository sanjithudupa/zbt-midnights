import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const weekId = searchParams.get("weekId");
  if (!weekId) {
    return NextResponse.json({ error: "Week required." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("scheduled_jobs")
    .select(
      "id, day_of_week, sort_order, job_definition_id, job_definitions ( id, name, sort_order, job_requirements ( position, description ) ), job_submissions ( id, submitted_at, user_id, review_status, users!job_submissions_user_id_fkey ( id, username ) )"
    )
    .eq("week_id", weekId)
    .order("day_of_week", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load week status." },
      { status: 500 }
    );
  }

  return NextResponse.json({ scheduledJobs: data ?? [] });
}
