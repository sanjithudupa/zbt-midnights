import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { weekId, dayOfWeek, jobDefinitionId } = body ?? {};
  if (!weekId || typeof weekId !== "string") {
    return NextResponse.json({ error: "Missing weekId." }, { status: 400 });
  }
  if (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json({ error: "Invalid dayOfWeek." }, { status: 400 });
  }
  if (!jobDefinitionId || typeof jobDefinitionId !== "string") {
    return NextResponse.json({ error: "Missing jobDefinitionId." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: existing, error: existingError } = await supabase
    .from("scheduled_jobs")
    .select("id")
    .eq("week_id", weekId)
    .eq("day_of_week", dayOfWeek)
    .eq("job_definition_id", jobDefinitionId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: "Failed to look up scheduled job." },
      { status: 500 }
    );
  }

  if (existing?.id) {
    return NextResponse.json({ scheduledJobId: existing.id });
  }

  const { data: maxRow } = await supabase
    .from("scheduled_jobs")
    .select("sort_order")
    .eq("week_id", weekId)
    .eq("day_of_week", dayOfWeek)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data: created, error } = await supabase
    .from("scheduled_jobs")
    .insert({
      week_id: weekId,
      day_of_week: dayOfWeek,
      job_definition_id: jobDefinitionId,
      sort_order: nextSortOrder,
    })
    .select("id")
    .single();

  if (error || !created?.id) {
    console.error("Failed to create scheduled job (admin).", {
      error,
      weekId,
      dayOfWeek,
      jobDefinitionId,
    });
    return NextResponse.json(
      { error: "Failed to create scheduled job.", details: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ scheduledJobId: created.id });
}
