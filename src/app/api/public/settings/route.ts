import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAdminSetting } from "@/lib/adminSettings";

export async function GET() {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const scheduleSource =
    (await getAdminSetting("schedule_source_of_truth")) ?? "database";

  return NextResponse.json({
    settings: {
      scheduleSourceOfTruth: scheduleSource,
    },
  });
}
