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
  const { name, is_active } = await request.json();

  const updates: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) {
    updates.name = name.trim();
  }
  if (typeof is_active === "boolean") {
    updates.is_active = is_active;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("job_definitions")
    .update(updates)
    .eq("id", id)
    .select("id, name, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update job definition." },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobDefinition: data });
}
