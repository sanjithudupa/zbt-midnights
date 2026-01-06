import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("week_templates")
    .select(
      "id, name, is_active, week_template_days ( id, day_of_week, job_definition_id, sort_order )"
    )
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load week templates." },
      { status: 500 }
    );
  }

  return NextResponse.json({ weekTemplates: data ?? [] });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { name } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name required." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("week_templates")
    .insert({ name: name.trim() })
    .select("id, name, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create template." },
      { status: 500 }
    );
  }

  return NextResponse.json({ template: data });
}
