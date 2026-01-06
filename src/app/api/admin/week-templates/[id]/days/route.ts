import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { days } = await request.json();
  if (!Array.isArray(days)) {
    return NextResponse.json({ error: "Template days required." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { error: deleteError } = await supabase
    .from("week_template_days")
    .delete()
    .eq("week_template_id", id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to update template." },
      { status: 500 }
    );
  }

  if (days.length > 0) {
    const rows = days.map((item: any) => ({
      week_template_id: id,
      day_of_week: Number(item.day_of_week),
      job_definition_id: String(item.job_definition_id),
      sort_order: Number(item.sort_order ?? 0),
    }));

    const { error: insertError } = await supabase
      .from("week_template_days")
      .insert(rows);

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to update template." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
