import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  void params;
  return NextResponse.json(
    {
      error:
        "Week templates are deprecated. Schedule and assignment come from Google Sheets.",
    },
    { status: 410 }
  );
}
