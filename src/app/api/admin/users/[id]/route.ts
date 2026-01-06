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
  const { username, is_active } = await request.json();

  const updates: Record<string, unknown> = {};
  if (typeof username === "string" && username.trim()) {
    updates.username = username.trim();
  }
  if (typeof is_active === "boolean") {
    updates.is_active = is_active;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select("id, username, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = getServiceSupabase();

  await supabase.from("job_submissions").update({ reviewed_by: null }).eq("reviewed_by", id);
  await supabase.from("job_submissions").delete().eq("user_id", id);

  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
