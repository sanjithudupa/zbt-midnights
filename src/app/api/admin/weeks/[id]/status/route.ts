import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: week, error: weekError } = await supabase
    .from("weeks")
    .select("id, start_date")
    .eq("id", id)
    .single();

  if (weekError || !week) {
    return NextResponse.json({ error: "Week not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .select(
      "id, day_of_week, sort_order, job_definition_id, job_definitions ( id, name, sort_order, job_requirements ( position, description ) ), job_punts ( scheduled_job_id, user_id, users!job_punts_user_id_fkey ( id, username ) ), job_submissions ( id, scheduled_job_id, submitted_at, user_id, review_status, review_note, verified_by_admin, users!job_submissions_user_id_fkey ( id, username ), submission_photos ( position, imgbb_url, requirement_description_snapshot ) )"
    )
    .eq("week_id", id)
    .order("day_of_week", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load status." }, { status: 500 });
  }

  return NextResponse.json({ week, scheduledJobs: data ?? [] });
}
