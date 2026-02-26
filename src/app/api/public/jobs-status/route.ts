import { NextResponse } from "next/server";
import { getMonday, formatDateInput } from "@/lib/date";
import { DAY_LABELS } from "@/lib/constants";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { getWeekSheetData } from "@/lib/sheetsWeek";

export const runtime = "nodejs";

const dayKey = (day: number, jobDefinitionId: string) => `${day}:${jobDefinitionId}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate =
    searchParams.get("start_date") ?? formatDateInput(getMonday(new Date()));
  const verboseParam = searchParams.get("verbose")?.trim().toLowerCase();
  const verbose =
    verboseParam === "true" || verboseParam === "1" || verboseParam === "yes";

  try {
    const supabase = getServiceSupabase();

    const [weekResult, definitionsResult, sheetResult] = await Promise.all([
      supabase
        .from("weeks")
        .select("id, start_date")
        .eq("start_date", startDate)
        .maybeSingle(),
      supabase
        .from("job_definitions")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      getWeekSheetData(startDate),
    ]);

    if (weekResult.error) {
      return NextResponse.json({ error: "Failed to load week." }, { status: 500 });
    }
    if (definitionsResult.error) {
      return NextResponse.json(
        { error: "Failed to load job definitions." },
        { status: 500 }
      );
    }

    const week = weekResult.data ?? null;
    const definitions = definitionsResult.data ?? [];
    const nameToDefinition = new Map(
      definitions.map((definition) => [definition.name, definition])
    );

    const scheduledMap = new Map<
      string,
      {
        id: string;
        submissions: Array<{
          id: string;
          submitted_at: string;
          verified_by_admin?: boolean | null;
          users?: { id: string; username: string } | null;
        }>;
      }
    >();

    if (week?.id) {
      const scheduledResult = await supabase
        .from("scheduled_jobs")
        .select(
          "id, day_of_week, job_definition_id, job_submissions ( id, submitted_at, verified_by_admin, users!job_submissions_user_id_fkey ( id, username ) )"
        )
        .eq("week_id", week.id);

      if (scheduledResult.error) {
        return NextResponse.json(
          { error: "Failed to load scheduled jobs." },
          { status: 500 }
        );
      }

      (scheduledResult.data ?? []).forEach((row) => {
        const submissions =
          row.job_submissions
            ?.slice()
            .map((submission) => ({
              ...submission,
              users: Array.isArray(submission.users)
                ? submission.users[0] ?? null
                : submission.users ?? null,
            }))
            .sort(
              (a, b) =>
                new Date(b.submitted_at).getTime() -
                new Date(a.submitted_at).getTime()
            ) ?? [];
        scheduledMap.set(dayKey(row.day_of_week, row.job_definition_id), {
          id: row.id,
          submissions,
        });
      });
    }

    const columns = sheetResult.data;
    const jobNames = columns[0] ?? [];

    const days = DAY_LABELS.map((label, dayIndex) => {
      const nameColumn = columns[1 + dayIndex * 2] ?? [];
      const stateColumn = columns[2 + dayIndex * 2] ?? [];

      const jobs = jobNames.map((jobName, rowIndex) => {
        const definition = nameToDefinition.get(jobName);
        const assignmentRaw = (nameColumn[rowIndex] ?? "").trim();
        const stateRaw = (stateColumn[rowIndex] ?? "").trim();
        const state = stateRaw.toUpperCase();
        const enabled = state !== "N";
        const isRng =
          state === "RNG" || assignmentRaw.toUpperCase() === "RNG";
        const scheduled = definition
          ? scheduledMap.get(dayKey(dayIndex, definition.id))
          : undefined;
        const latestSubmission = scheduled?.submissions[0];
        const verified = state === "V" || Boolean(latestSubmission?.verified_by_admin);
        const submissionStatus = !enabled
          ? "disabled"
          : verified
            ? "verified"
            : latestSubmission
              ? "submitted"
              : "none";

        return {
          job_name: jobName,
          job_definition_id: definition?.id ?? null,
          enabled,
          assigned_to: assignmentRaw || null,
          is_rng: isRng,
          sheet_state: state || null,
          scheduled_job_id: scheduled?.id ?? null,
          submission_status: submissionStatus,
          latest_submission: latestSubmission
            ? {
                id: latestSubmission.id,
                submitted_at: latestSubmission.submitted_at,
                verified_by_admin: Boolean(latestSubmission.verified_by_admin),
                user: latestSubmission.users
                  ? {
                      id: latestSubmission.users.id,
                      username: latestSubmission.users.username,
                    }
                  : null,
              }
            : null,
        };
      });

      return {
        day_index: dayIndex,
        day_label: label,
        jobs,
      };
    });

    if (verbose) {
      return NextResponse.json({
        week: {
          id: week?.id ?? null,
          start_date: startDate,
          sheet_name: sheetResult.sheetName,
        },
        days,
      });
    }

    const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
    const compactDays = Object.fromEntries(
      dayKeys.map((key, index) => {
        const day = days[index];
        const remainingJobs = Object.fromEntries(
          (day?.jobs ?? [])
            .filter((job) => job.enabled && job.submission_status === "none")
            .map((job) => {
              const assigned = job.assigned_to?.trim() ?? "";
              const value = job.is_rng
                ? assigned && assigned.toUpperCase() !== "RNG"
                  ? `RNG (${assigned})`
                  : "RNG"
                : assigned || "UNASSIGNED";
              return [job.job_name, value];
            })
        );
        return [key, { remaining_jobs: remainingJobs }];
      })
    );

    return NextResponse.json({
      start_date: startDate,
      sheet_name: sheetResult.sheetName,
      days: compactDays,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load jobs status.",
      },
      { status: 400 }
    );
  }
}
