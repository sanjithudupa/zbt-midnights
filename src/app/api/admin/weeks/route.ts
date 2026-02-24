import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("weeks")
    .select("id, start_date, created_at")
    .order("start_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load weeks." }, { status: 500 });
  }

  return NextResponse.json({ weeks: data ?? [] });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  void request;
  return NextResponse.json(
    {
      error:
        "Week setup is deprecated. Schedule and assignment come from Google Sheets.",
    },
    { status: 410 }
  );
}
