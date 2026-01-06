import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { username } = await request.json();
  if (typeof username !== "string" || !username.trim()) {
    return NextResponse.json({ error: "Username required." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("users")
    .insert({ username: username.trim() })
    .select("id, username, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
