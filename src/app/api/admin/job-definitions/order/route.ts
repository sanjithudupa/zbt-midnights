import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { orderedIds } = await request.json();
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "Order required." }, { status: 400 });
  }

  const updates = orderedIds.map((id, index) => ({
    id: String(id),
    sort_order: index,
  }));

  const supabase = getServiceSupabase();
  const results = await Promise.all(
    updates.map((update) =>
      supabase
        .from("job_definitions")
        .update({ sort_order: update.sort_order })
        .eq("id", update.id)
        .select("id, sort_order")
        .single()
    )
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    return NextResponse.json(
      {
        error: "Failed to update order.",
        details: failed.error.message,
        code: failed.error.code,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    updated: results.map((result) => result.data).filter(Boolean),
  });
}
