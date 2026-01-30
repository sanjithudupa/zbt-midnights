import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { scheduledJobId, userId } = await request.json();
  if (typeof scheduledJobId !== "string" || !scheduledJobId) {
    return NextResponse.json(
      { error: "Scheduled job required." },
      { status: 400 }
    );
  }
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "User required." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("job_punts")
    .upsert({ scheduled_job_id: scheduledJobId, user_id: userId });

  if (error) {
    return NextResponse.json(
      { error: "Failed to save punt." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const scheduledJobId = searchParams.get("scheduledJobId");
  if (!scheduledJobId) {
    return NextResponse.json(
      { error: "Scheduled job required." },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("job_punts")
    .delete()
    .eq("scheduled_job_id", scheduledJobId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to clear punt." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
