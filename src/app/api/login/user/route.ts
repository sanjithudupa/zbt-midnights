import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const { userId } = await request.json();
  if (typeof userId !== "string") {
    return NextResponse.json({ error: "Select a user." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id, is_active")
    .eq("id", userId)
    .single();

  if (error || !data || !data.is_active) {
    return NextResponse.json({ error: "Invalid user selection." }, { status: 401 });
  }

  await setSessionCookie({ role: "user", userId: data.id });
  return NextResponse.json({ ok: true });
}
