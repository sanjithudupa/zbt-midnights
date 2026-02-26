import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const startDate = body?.start_date;
  if (
    typeof startDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())
  ) {
    return NextResponse.json({ error: "Invalid start_date." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: existing, error: existingError } = await supabase
    .from("weeks")
    .select("id, start_date, created_at")
    .eq("start_date", startDate.trim())
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: "Failed to check existing week." },
      { status: 500 }
    );
  }
  if (existing) {
    return NextResponse.json({ ok: true, week: existing, created: false });
  }

  const { data: created, error } = await supabase
    .from("weeks")
    .insert({ start_date: startDate.trim() })
    .select("id, start_date, created_at")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: "Failed to create week." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, week: created, created: true });
}
