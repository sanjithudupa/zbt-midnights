import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabaseServer";

export async function GET() {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("job_definitions")
    .select("id, name, sort_order, job_requirements ( position, description )")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load job definitions." },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobDefinitions: data ?? [] });
}
