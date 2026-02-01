import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/session";
import { getServiceSupabase } from "@/lib/supabaseServer";
import { getAdminSetting } from "@/lib/adminSettings";
import { parseDateInput } from "@/lib/date";
import {
  extractSpreadsheetId,
  formatWeekTab,
  getSheetsClient,
} from "@/lib/googleSheets";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "user")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weekId = searchParams.get("weekId");
  if (!weekId) {
    return NextResponse.json({ error: "Week required." }, { status: 400 });
  }

  const sheetUrl = await getAdminSetting("google_sheet_url");
  if (!sheetUrl) {
    return NextResponse.json(
      { error: "Google Sheet URL not configured." },
      { status: 400 }
    );
  }

  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "Invalid Google Sheet URL." },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();
  const { data: week, error: weekError } = await supabase
    .from("weeks")
    .select("start_date")
    .eq("id", weekId)
    .single();

  if (weekError || !week) {
    return NextResponse.json({ error: "Week not found." }, { status: 404 });
  }

  const startDate = parseDateInput(week.start_date);
  const tabName = formatWeekTab(startDate);
  const range = `'${tabName}'!C3:P11`;

  const sheets = await getSheetsClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  console.log("Sheets values", tabName, data.values ?? []);

  return NextResponse.json({ ok: true });
}
