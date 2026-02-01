import "server-only";

import fs from "fs";
import path from "path";
import { google } from "googleapis";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function getServiceKeyPath() {
  return (
    process.env.GOOGLE_SHEETS_KEY_PATH ??
    path.join(process.cwd(), "secret", "sheets_bot.json")
  );
}

function loadServiceAccount() {
  const keyPath = getServiceKeyPath();
  const raw = fs.readFileSync(keyPath, "utf8");
  return JSON.parse(raw);
}

export async function getSheetsClient() {
  const credentials = loadServiceAccount();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [SHEETS_SCOPE],
  });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

export function extractSpreadsheetId(url: string) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export function formatWeekTab(startDate: Date) {
  const end = new Date(startDate);
  end.setDate(startDate.getDate() + 6);
  const fmt = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;
  return `${fmt(startDate)}-${fmt(end)}`;
}
