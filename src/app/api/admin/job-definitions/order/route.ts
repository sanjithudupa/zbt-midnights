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

  const normalizedIds = orderedIds.map((id) => String(id));
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    return NextResponse.json(
      { error: "Duplicate job ids in reorder payload." },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();
  const { data: existing, error: existingError } = await supabase
    .from("job_definitions")
    .select("id, sort_order");
  if (existingError) {
    return NextResponse.json(
      { error: "Failed to validate current job definitions." },
      { status: 500 }
    );
  }

  const existingIds = new Set((existing ?? []).map((row) => row.id));
  if (
    existingIds.size !== normalizedIds.length ||
    normalizedIds.some((id) => !existingIds.has(id))
  ) {
    return NextResponse.json(
      { error: "Reorder payload is stale. Refresh and try again." },
      { status: 409 }
    );
  }

  const maxCurrentOrder = Math.max(
    -1,
    ...(existing ?? []).map((row) =>
      typeof row.sort_order === "number" ? row.sort_order : -1
    )
  );
  const tempBase = maxCurrentOrder + normalizedIds.length + 1000;

  const tempResults = await Promise.all(
    normalizedIds.map((id, index) =>
      supabase
        .from("job_definitions")
        .update({ sort_order: tempBase + index })
        .eq("id", id)
        .select("id, sort_order")
        .single()
    )
  );

  const tempFailed = tempResults.find((result) => result.error);
  if (tempFailed?.error) {
    return NextResponse.json(
      {
        error: "Failed to prepare reorder.",
        details: tempFailed.error.message,
        code: tempFailed.error.code,
      },
      { status: 500 }
    );
  }

  const results = await Promise.all(
    normalizedIds.map((id, index) =>
      supabase
        .from("job_definitions")
        .update({ sort_order: index })
        .eq("id", id)
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
