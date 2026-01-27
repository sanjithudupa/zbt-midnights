import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = getServiceSupabase();

  const { error: photoError } = await supabase
    .from("submission_photos")
    .delete()
    .eq("submission_id", id);

  if (photoError) {
    return NextResponse.json(
      { error: "Failed to delete submission photos." },
      { status: 500 }
    );
  }

  const { error: submissionError } = await supabase
    .from("job_submissions")
    .delete()
    .eq("id", id);

  if (submissionError) {
    return NextResponse.json(
      { error: "Failed to delete submission." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
