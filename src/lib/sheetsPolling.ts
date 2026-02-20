import { getAdminSetting } from "./adminSettings";
import { getSpreadsheetId, listSheetNames } from "./googleSheets";

const DEFAULT_SCHEDULE_SOURCE = "database";

export async function logSheetNamesIfEnabled() {
  let scheduleSource = DEFAULT_SCHEDULE_SOURCE;
  try {
    const stored = await getAdminSetting("schedule_source_of_truth");
    if (typeof stored === "string" && stored.trim()) {
      scheduleSource = stored.trim();
    }
  } catch (error) {
    console.warn("Sheets polling skipped: unable to read schedule source.", error);
    return;
  }

  if (scheduleSource !== "google sheet") {
    return;
  }

  let sheetsUrl: string | null = null;
  try {
    const stored = await getAdminSetting("SHEETS_URL");
    sheetsUrl = typeof stored === "string" ? stored.trim() : null;
  } catch (error) {
    console.warn("Sheets polling skipped: unable to read SHEETS_URL.", error);
    return;
  }

  if (!sheetsUrl) {
    console.warn("Sheets polling skipped: SHEETS_URL missing.");
    return;
  }

  const spreadsheetId = getSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) {
    console.warn("Sheets polling skipped: invalid SHEETS_URL.");
    return;
  }

  try {
    const names = await listSheetNames(spreadsheetId);
    console.log(`[sheets] Available sheets: ${names.join(", ") || "(none)"}`);
  } catch (error) {
    console.error("Sheets polling failed.", error);
  }
}
