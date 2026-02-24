import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
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
        "Week configuration updates are deprecated. Schedule and assignment come from Google Sheets.",
    },
    { status: 410 }
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("weeks").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete week." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
