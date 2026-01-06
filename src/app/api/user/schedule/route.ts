import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const weekId = searchParams.get("weekId");
  const day = Number(searchParams.get("day"));

  if (!weekId || Number.isNaN(day)) {
    return NextResponse.json({ error: "Missing week or day." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("scheduled_jobs")
    .select(
      "id, day_of_week, sort_order, job_definition_id, job_definitions ( id, name, job_requirements ( position, description ) )"
    )
    .eq("week_id", weekId)
    .eq("day_of_week", day)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load schedule." }, { status: 500 });
  }

  return NextResponse.json({ scheduledJobs: data ?? [] });
}
