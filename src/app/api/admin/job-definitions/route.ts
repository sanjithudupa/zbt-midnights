import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("job_definitions")
    .select(
      "id, name, created_at, job_requirements ( id, position, description )"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load job definitions." },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobDefinitions: data ?? [] });
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
    .from("job_definitions")
    .insert({ name: name.trim() })
    .select("id, name, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create job definition." },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobDefinition: data });
}
