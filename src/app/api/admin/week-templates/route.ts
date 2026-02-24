import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  return NextResponse.json(
    {
      error:
        "Week templates are deprecated. Schedule and assignment come from Google Sheets.",
    },
    { status: 410 }
  );
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  void request;
  return NextResponse.json(
    {
      error:
        "Week templates are deprecated. Schedule and assignment come from Google Sheets.",
    },
    { status: 410 }
  );
}
