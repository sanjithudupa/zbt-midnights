import "server-only";

import fs from "fs";
import path from "path";
import { google } from "googleapis";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SHEETS_EDIT_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const STATUS_COLUMNS = ["D", "F", "H", "J", "L", "N", "P"] as const;

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
    scopes: [SHEETS_SCOPE, SHEETS_EDIT_SCOPE],
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

function normalizeName(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NONE") return "";
  return trimmed.split(/\s+/)[0].toLowerCase();
}

function normalizeStatus(value: string) {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed === "NONE") return "";
  if (trimmed === "RNG") return "RNG";
  return trimmed[0];
}

export function parseSheet(values: string[][]) {
  const signups: string[][] = [];
  const statuses: string[][] = [];

  values.forEach((row) => {
    const cols = row ?? [];
    const names: string[] = [];
    const stats: string[] = [];
    for (let i = 0; i < cols.length; i += 2) {
      names.push(normalizeName(String(cols[i] ?? "")));
      stats.push(normalizeStatus(String(cols[i + 1] ?? "")));
    }
    while (names.length < 7) names.push("");
    while (stats.length < 7) stats.push("");
    signups.push(names.slice(0, 7));
    statuses.push(stats.slice(0, 7));
  });

  return { signups, statuses };
}

export function getStatusColumn(dayIndex: number) {
  return STATUS_COLUMNS[dayIndex] ?? "D";
}

export async function updateStatusCells({
  spreadsheetId,
  tabName,
  statuses,
  rowCount,
}: {
  spreadsheetId: string;
  tabName: string;
  statuses: string[][];
  rowCount: number;
}) {
  const sheets = await getSheetsClient();
  const endRow = 2 + rowCount;
  const data = STATUS_COLUMNS.map((col, dayIndex) => ({
    range: `'${tabName}'!${col}3:${col}${endRow}`,
    values: Array.from({ length: rowCount }).map((_, rowIndex) => [
      statuses[rowIndex]?.[dayIndex] ?? "",
    ]),
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}

export async function updateSingleStatusCell({
  spreadsheetId,
  tabName,
  dayIndex,
  rowIndex,
  value,
}: {
  spreadsheetId: string;
  tabName: string;
  dayIndex: number;
  rowIndex: number;
  value: string;
}) {
  const sheets = await getSheetsClient();
  const col = getStatusColumn(dayIndex);
  const row = 3 + rowIndex;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!${col}${row}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[value]],
    },
  });
}
