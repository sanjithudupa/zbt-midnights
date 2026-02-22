import { google } from "googleapis";
import { JWT } from "google-auth-library";
import fs from "node:fs";
import path from "node:path";

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
};

const SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export function getSpreadsheetId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  if (/^[a-zA-Z0-9-_]+$/.test(trimmed)) return trimmed;
  return null;
}

function getServiceAccountKey(): ServiceAccountKey {
  const raw = process.env.SHEETS_KEY;
  if (!raw) {
    throw new Error("Missing SHEETS_KEY env var.");
  }

  let trimmed = raw.trim();
  if (trimmed.startsWith("base64:")) {
    const encoded = trimmed.slice("base64:".length).trim();
    trimmed = Buffer.from(encoded, "base64").toString("utf-8").trim();
  } else if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("~/")
  ) {
    const resolved =
      trimmed.startsWith("~/")
        ? path.join(process.env.HOME ?? "", trimmed.slice(2))
        : trimmed;
    if (fs.existsSync(resolved)) {
      trimmed = fs.readFileSync(resolved, "utf-8").trim();
    }
  }

  const candidates = [];
  candidates.push(trimmed);
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    candidates.push(trimmed.slice(1, -1));
  }
  if (trimmed.includes("\n")) {
    candidates.push(trimmed.replace(/\n/g, "\\n"));
  }
  if (
    trimmed.includes("\n") &&
    ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"')))
  ) {
    candidates.push(trimmed.slice(1, -1).replace(/\n/g, "\\n"));
  }

  let parsed: Partial<ServiceAccountKey> | null = null;
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate) as Partial<ServiceAccountKey>;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!parsed) {
    throw new Error(
      `Invalid SHEETS_KEY JSON. Provide a single-line JSON string with escaped newlines, a file path, or base64:... (${String(
        lastError
      )})`
    );
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid SHEETS_KEY JSON: missing client_email/private_key.");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function getSheetsClient() {
  const key = getServiceAccountKey();
  const auth = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SHEETS_SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}

export async function listSheetNames(spreadsheetId: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });
  return (
    response.data.sheets?.map((sheet) => sheet.properties?.title ?? "") ?? []
  ).filter(Boolean);
}

export async function getSheetValues(
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });
  return (response.data.values ?? []) as string[][];
}

export async function updateSheetCell(
  spreadsheetId: string,
  sheetName: string,
  columnNumber: number,
  rowNumber: number,
  value: string
) {
  const sheets = getSheetsClient();
  const columnLabel = columnNumberToName(columnNumber);
  const range = `${sheetName}!${columnLabel}${rowNumber}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [[value]],
    },
  });
}

function columnNumberToName(columnNumber: number) {
  let num = columnNumber;
  let label = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    num = Math.floor((num - 1) / 26);
  }
  return label;
}
