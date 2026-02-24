import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("weeks")
    .select("id, start_date")
    .order("start_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load weeks." }, { status: 500 });
  }

  return NextResponse.json({ weeks: data ?? [] });
}
