import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id, username")
    .order("username");

  if (error) {
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}
