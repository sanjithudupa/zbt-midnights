import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc("get_week_cleanup_summary");

  if (error) {
    return NextResponse.json(
      { error: "Failed to load cleanup summary." },
      { status: 500 }
    );
  }

  return NextResponse.json({ summary: data ?? [] });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { weekId } = await request.json();
  if (typeof weekId !== "string") {
    return NextResponse.json({ error: "Week required." }, { status: 400 });
  }

  const secret = process.env.ADMIN_SETTINGS_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Missing ADMIN_SETTINGS_SECRET." },
      { status: 500 }
    );
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc("get_week_delete_urls", {
    week_id: weekId,
    secret_text: secret,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load delete URLs." },
      { status: 500 }
    );
  }

  const successIds: string[] = [];
  let failed = 0;

  for (const row of data ?? []) {
    try {
      const response = await fetch(row.delete_url, { method: "GET" });
      if (response.ok) {
        successIds.push(row.submission_photo_id);
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  if (successIds.length > 0) {
    await supabase
      .from("submission_photos")
      .update({ imgbb_deleted_at: new Date().toISOString() })
      .in("id", successIds);
  }

  return NextResponse.json({
    attempted: (data ?? []).length,
    deleted: successIds.length,
    failed,
  });
}
