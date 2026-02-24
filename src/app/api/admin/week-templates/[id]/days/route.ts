import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  void request;
  void params;
  return NextResponse.json(
    {
      error:
        "Week templates are deprecated. Schedule and assignment come from Google Sheets.",
    },
    { status: 410 }
  );
}
