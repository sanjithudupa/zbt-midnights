import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { requirements } = await request.json();
  if (!Array.isArray(requirements)) {
    return NextResponse.json({ error: "Requirements required." }, { status: 400 });
  }

  const cleaned = requirements
    .map((requirement: { description: string }, index: number) => ({
      job_definition_id: id,
      position: index,
      description: String(requirement.description || "").trim(),
    }))
    .filter((requirement) => requirement.description.length > 0);

  const supabase = getServiceSupabase();
  const { error: deleteError } = await supabase
    .from("job_requirements")
    .delete()
    .eq("job_definition_id", id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to update requirements." },
      { status: 500 }
    );
  }

  if (cleaned.length > 0) {
    const { error: insertError } = await supabase
      .from("job_requirements")
      .insert(cleaned);

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to update requirements." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
