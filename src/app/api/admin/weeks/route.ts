import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";
import { parseDateInput, isMonday } from "@/lib/date";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("weeks")
    .select("id, start_date, template_id, created_at")
    .order("start_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load weeks." }, { status: 500 });
  }

  return NextResponse.json({ weeks: data ?? [] });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { start_date, template_id, schedule } = await request.json();
  if (typeof start_date !== "string") {
    return NextResponse.json({ error: "Start date required." }, { status: 400 });
  }

  const parsedDate = parseDateInput(start_date);
  if (!isMonday(parsedDate)) {
    return NextResponse.json({ error: "Start date must be a Monday." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: week, error: insertError } = await supabase
    .from("weeks")
    .insert({ start_date, template_id: template_id ?? null })
    .select("id, start_date, template_id, created_at")
    .single();

  if (insertError || !week) {
    return NextResponse.json({ error: "Failed to create week." }, { status: 500 });
  }

  let scheduleRows: Array<{
    week_id: string;
    day_of_week: number;
    job_definition_id: string;
    sort_order: number;
  }> = [];

  if (Array.isArray(schedule) && schedule.length > 0) {
    scheduleRows = schedule.map((item: any) => ({
      week_id: week.id,
      day_of_week: Number(item.day_of_week),
      job_definition_id: String(item.job_definition_id),
      sort_order: Number(item.sort_order ?? 0),
    }));
  } else if (template_id) {
    const { data: templateDays, error: templateError } = await supabase
      .from("week_template_days")
      .select("day_of_week, job_definition_id, sort_order")
      .eq("week_template_id", template_id);

    if (templateError) {
      return NextResponse.json(
        { error: "Failed to load template." },
        { status: 500 }
      );
    }

    scheduleRows = (templateDays ?? []).map((item) => ({
      week_id: week.id,
      day_of_week: item.day_of_week,
      job_definition_id: item.job_definition_id,
      sort_order: item.sort_order,
    }));
  }

  if (scheduleRows.length > 0) {
    const { error: scheduleError } = await supabase
      .from("scheduled_jobs")
      .insert(scheduleRows);

    if (scheduleError) {
      return NextResponse.json(
        { error: "Failed to schedule jobs." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ week });
}
