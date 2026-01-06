import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { getSessionFromCookies } from "@/lib/session";

export async function GET(request: Request) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const scheduledJobId = searchParams.get("scheduledJobId");
  if (!scheduledJobId) {
    return NextResponse.json({ error: "Missing scheduled job." }, { status: 400 });
  }

  const session = await getSessionFromCookies();
  if (!session || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("job_submissions")
    .select(
      "id, scheduled_job_id, submitted_at, note, review_status, review_note, submission_photos ( position, imgbb_url, requirement_description_snapshot )"
    )
    .eq("scheduled_job_id", scheduledJobId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load submission." }, { status: 500 });
  }

  return NextResponse.json({ submission: data ?? null });
}

export async function POST(request: Request) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const session = await getSessionFromCookies();
  if (!session || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scheduledJobId, note, photos } = await request.json();
  if (typeof scheduledJobId !== "string") {
    return NextResponse.json({ error: "Missing scheduled job." }, { status: 400 });
  }
  if (!Array.isArray(photos)) {
    return NextResponse.json({ error: "Missing photos." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: scheduledJob, error: scheduledError } = await supabase
    .from("scheduled_jobs")
    .select(
      "id, job_definition_id, job_definitions ( id, job_requirements ( position, description ) )"
    )
    .eq("id", scheduledJobId)
    .single();

  if (scheduledError || !scheduledJob) {
    return NextResponse.json({ error: "Scheduled job not found." }, { status: 404 });
  }

  const requirements =
    scheduledJob.job_definitions?.job_requirements
      ?.slice()
      .sort((a, b) => a.position - b.position) ?? [];

  if (requirements.length !== photos.length) {
    return NextResponse.json(
      { error: "All required photos must be uploaded." },
      { status: 400 }
    );
  }

  for (let i = 0; i < requirements.length; i += 1) {
    if (photos[i]?.position !== requirements[i].position) {
      return NextResponse.json(
        { error: "Photo order does not match requirements." },
        { status: 400 }
      );
    }
    if (typeof photos[i]?.url !== "string" || photos[i].url.length === 0) {
      return NextResponse.json({ error: "Missing photo URL." }, { status: 400 });
    }
  }

  const { data: submission, error: insertError } = await supabase
    .from("job_submissions")
    .insert({
      scheduled_job_id: scheduledJobId,
      user_id: session.userId,
      note: typeof note === "string" ? note : null,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "You already submitted this job." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to submit." }, { status: 500 });
  }

  if (requirements.length > 0) {
    const photoRows = requirements.map((requirement) => {
      const match = photos.find((photo) => photo.position === requirement.position);
      return {
        submission_id: submission.id,
        position: requirement.position,
        requirement_description_snapshot: requirement.description,
        imgbb_url: match?.url ?? "",
      };
    });

    const { error: photoError } = await supabase
      .from("submission_photos")
      .insert(photoRows);

    if (photoError) {
      return NextResponse.json(
        { error: "Failed to attach photos." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, submissionId: submission.id });
}
