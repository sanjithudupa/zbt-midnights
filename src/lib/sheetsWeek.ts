import { getAdminSetting } from "./adminSettings";
import {
  applySheetProtectionMode,
  getSheetValues,
  getSpreadsheetId,
  listSheetNames,
  updateSheetCell,
} from "./googleSheets";

const SHEET_NAMES_TTL_MS = 60_000;
const WEEK_DATA_TTL_MS = 30_000;

const sheetNamesCache = new Map<
  string,
  { expiresAt: number; names: string[] }
>();
const weekDataCache = new Map<
  string,
  { expiresAt: number; sheetName: string; data: string[][] }
>();

function formatSheetPrefix(startDate: string) {
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return `${month}/${day}`;
}

async function getCachedSheetNames(spreadsheetId: string) {
  const cached = sheetNamesCache.get(spreadsheetId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.names;
  }
  const names = await listSheetNames(spreadsheetId);
  sheetNamesCache.set(spreadsheetId, {
    expiresAt: Date.now() + SHEET_NAMES_TTL_MS,
    names,
  });
  return names;
}

function processSheetValues(values: string[][]) {
  const data = values.slice(2);
  const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
  const transposed = Array.from({ length: maxCols }, (_, col) =>
    data.map((row) => row[col] ?? "")
  );
  const limited = transposed.slice(0, 16);
  const firstColumn = limited[0] ?? [];
  let cutoff = firstColumn.findIndex((value) => value === "");
  if (cutoff < 0) cutoff = firstColumn.length;
  const trimmed = limited.map((column) => column.slice(0, cutoff));
  const jobNames = trimmed[0] ?? [];
  const jobPoints = trimmed[1] ?? [];
  const combinedJobs = jobNames.map((name, index) => {
    const pointsRaw = jobPoints[index];
    const points = pointsRaw ? Number(pointsRaw) : NaN;
    if (!name) return "";
    if (!Number.isFinite(points)) return name;
    const label = points === 1 ? "point" : "points";
    return `${name} [${points} ${label}]`;
  });
  return [combinedJobs, ...trimmed.slice(2)];
}

export async function getWeekSheetData(startDate: string) {
  const sheetsUrl = await getAdminSetting("SHEETS_URL");
  if (!sheetsUrl || typeof sheetsUrl !== "string") {
    throw new Error("Missing SHEETS_URL.");
  }

  const spreadsheetId = getSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) {
    throw new Error("Invalid SHEETS_URL.");
  }

  const cacheKey = `${spreadsheetId}:${startDate}`;
  const cached = weekDataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { sheetName: cached.sheetName, data: cached.data };
  }

  const prefix = formatSheetPrefix(startDate);
  if (!prefix) {
    throw new Error("Invalid start_date format.");
  }

  const names = await getCachedSheetNames(spreadsheetId);
  const match = names.find((name) => {
    const [left] = name.split("-");
    return left?.trim() === prefix;
  });

  if (!match) {
    throw new Error(`No sheet found starting with ${prefix}.`);
  }

  const values = await getSheetValues(spreadsheetId, match);
  const data = processSheetValues(values);

  weekDataCache.set(cacheKey, {
    expiresAt: Date.now() + WEEK_DATA_TTL_MS,
    sheetName: match,
    data,
  });

  return { sheetName: match, data };
}

export async function updateWeekSheetState(args: {
  startDate: string;
  jobName: string;
  dayIndex: number;
  state: string;
}) {
  const sheetsUrl = await getAdminSetting("SHEETS_URL");
  if (!sheetsUrl || typeof sheetsUrl !== "string") {
    throw new Error("Missing SHEETS_URL.");
  }

  const spreadsheetId = getSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) {
    throw new Error("Invalid SHEETS_URL.");
  }

  const { sheetName, data } = await getWeekSheetData(args.startDate);
  const jobIndex = (data[0] ?? []).findIndex((name) => name === args.jobName);
  if (jobIndex < 0) {
    throw new Error(`Job not found in sheet: ${args.jobName}`);
  }

  const stateColumns = [4, 6, 8, 10, 12, 14, 16];
  const columnNumber = stateColumns[args.dayIndex];
  if (!columnNumber) {
    throw new Error("Invalid day index.");
  }
  const rowNumber = jobIndex + 3;
  await updateSheetCell(spreadsheetId, sheetName, columnNumber, rowNumber, args.state);

  const cacheKey = `${spreadsheetId}:${args.startDate}`;
  const cached = weekDataCache.get(cacheKey);
  if (cached) {
    const updated = cached.data.map((column) => column.slice());
    const cachedColumnIndex = 2 + args.dayIndex * 2;
    if (updated[cachedColumnIndex]?.[jobIndex] !== undefined) {
      updated[cachedColumnIndex][jobIndex] = args.state;
      weekDataCache.set(cacheKey, {
        ...cached,
        data: updated,
        expiresAt: Date.now() + WEEK_DATA_TTL_MS,
      });
    }
  }
}

export async function updateWeekSheetVerification(args: {
  startDate: string;
  jobName: string;
  dayIndex: number;
  username: string;
}) {
  const sheetsUrl = await getAdminSetting("SHEETS_URL");
  if (!sheetsUrl || typeof sheetsUrl !== "string") {
    throw new Error("Missing SHEETS_URL.");
  }

  const spreadsheetId = getSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) {
    throw new Error("Invalid SHEETS_URL.");
  }

  const { sheetName, data } = await getWeekSheetData(args.startDate);
  const jobIndex = (data[0] ?? []).findIndex((name) => name === args.jobName);
  if (jobIndex < 0) {
    throw new Error(`Job not found in sheet: ${args.jobName}`);
  }

  const stateColumns = [4, 6, 8, 10, 12, 14, 16];
  const nameColumns = [3, 5, 7, 9, 11, 13, 15];
  const stateColumnNumber = stateColumns[args.dayIndex];
  const nameColumnNumber = nameColumns[args.dayIndex];
  if (!stateColumnNumber || !nameColumnNumber) {
    throw new Error("Invalid day index.");
  }
  const rowNumber = jobIndex + 3;
  await updateSheetCell(spreadsheetId, sheetName, nameColumnNumber, rowNumber, args.username);
  await updateSheetCell(spreadsheetId, sheetName, stateColumnNumber, rowNumber, "V");

  const cacheKey = `${spreadsheetId}:${args.startDate}`;
  const cached = weekDataCache.get(cacheKey);
  if (cached) {
    const updated = cached.data.map((column) => column.slice());
    const cachedNameIndex = 1 + args.dayIndex * 2;
    const cachedStateIndex = 2 + args.dayIndex * 2;
    if (updated[cachedNameIndex]?.[jobIndex] !== undefined) {
      updated[cachedNameIndex][jobIndex] = args.username;
    }
    if (updated[cachedStateIndex]?.[jobIndex] !== undefined) {
      updated[cachedStateIndex][jobIndex] = "V";
    }
    weekDataCache.set(cacheKey, {
      ...cached,
      data: updated,
      expiresAt: Date.now() + WEEK_DATA_TTL_MS,
    });
  }
}

export async function setWeekSheetProtection(args: {
  startDate: string;
  mode: "full_protected" | "signup_open";
  alwaysAllowedGmails: string[];
}) {
  const sheetsUrl = await getAdminSetting("SHEETS_URL");
  if (!sheetsUrl || typeof sheetsUrl !== "string") {
    throw new Error("Missing SHEETS_URL.");
  }

  const spreadsheetId = getSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) {
    throw new Error("Invalid SHEETS_URL.");
  }

  const { sheetName, data } = await getWeekSheetData(args.startDate);
  const jobCount = (data[0] ?? []).length;
  const details = await applySheetProtectionMode({
    spreadsheetId,
    sheetName,
    mode: args.mode,
    jobCount,
    allowedEmails: args.alwaysAllowedGmails,
  });

  return {
    sheetName,
    jobCount,
    mode: args.mode,
    details,
  };
}
