import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { schedule, template_id } = await request.json();

  const supabase = getServiceSupabase();

  if (template_id !== undefined) {
    const { error } = await supabase
      .from("weeks")
      .update({ template_id: template_id ?? null })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Failed to update week." }, { status: 500 });
    }
  }

  if (Array.isArray(schedule)) {
    const { error: deleteError } = await supabase
      .from("scheduled_jobs")
      .delete()
      .eq("week_id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to update schedule." },
        { status: 500 }
      );
    }

    if (schedule.length > 0) {
      const rows = schedule.map((item: any) => ({
        week_id: id,
        day_of_week: Number(item.day_of_week),
        job_definition_id: String(item.job_definition_id),
        sort_order: Number(item.sort_order ?? 0),
      }));

      const { error: insertError } = await supabase
        .from("scheduled_jobs")
        .insert(rows);

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to update schedule." },
          { status: 500 }
        );
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
  const { error } = await supabase.from("weeks").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete week." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
