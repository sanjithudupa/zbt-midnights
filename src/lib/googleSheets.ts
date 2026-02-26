import { google } from "googleapis";
import { JWT } from "google-auth-library";
import fs from "node:fs";
import path from "node:path";

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
};

const SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const PROTECTION_DESCRIPTION_PREFIX = "MIDNIGHTS_PROTECTION::";

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

export async function getSheetMeta(spreadsheetId: string, sheetName: string) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),protectedRanges(range,description,protectedRangeId))",
  });
  const sheet = response.data.sheets?.find(
    (item) => item.properties?.title === sheetName
  );
  if (
    !sheet?.properties ||
    sheet.properties.sheetId === undefined ||
    sheet.properties.sheetId === null
  ) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const rowCount = sheet.properties.gridProperties?.rowCount ?? 1000;
  const columnCount = sheet.properties.gridProperties?.columnCount ?? 26;
  return {
    sheetId: sheet.properties.sheetId,
    rowCount,
    columnCount,
    protectedRanges: sheet.protectedRanges ?? [],
  };
}

export async function applySheetProtectionMode(args: {
  spreadsheetId: string;
  sheetName: string;
  mode: "full_protected" | "signup_open";
  jobCount: number;
  allowedEmails: string[];
}) {
  const sheets = getSheetsClient();
  const meta = await getSheetMeta(args.spreadsheetId, args.sheetName);
  const requests: Array<Record<string, unknown>> = [];

  let deletedProtectionCount = 0;
  for (const protection of meta.protectedRanges) {
    const description = protection.description ?? "";
    if (
      description.startsWith(PROTECTION_DESCRIPTION_PREFIX) &&
      protection.protectedRangeId
    ) {
      deletedProtectionCount += 1;
      requests.push({
        deleteProtectedRange: {
          protectedRangeId: protection.protectedRangeId,
        },
      });
    }
  }

  const signupColumns = [2, 4, 6, 8, 10, 12, 14];
  const startRowIndex = 2;
  const endRowIndex = startRowIndex + Math.max(0, args.jobCount);
  const unprotectedRanges =
    args.mode === "signup_open" && args.jobCount > 0
      ? signupColumns.map((columnIndex) => ({
          sheetId: meta.sheetId,
          startRowIndex,
          endRowIndex,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1,
        }))
      : [];

  requests.push({
    addProtectedRange: {
      protectedRange: {
        description: `${PROTECTION_DESCRIPTION_PREFIX}${args.sheetName}`,
        warningOnly: false,
        range: {
          sheetId: meta.sheetId,
          startRowIndex: 0,
          endRowIndex: meta.rowCount,
          startColumnIndex: 0,
          endColumnIndex: meta.columnCount,
        },
        unprotectedRanges,
        editors: {
          users: args.allowedEmails,
        },
      },
    },
  });

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: { requests },
  });
  const replies = response.data.replies ?? [];
  const added = replies
    .map((reply) => reply.addProtectedRange?.protectedRange?.protectedRangeId)
    .find((value) => typeof value === "number");

  return {
    appliedMode: args.mode,
    addedProtectionId: added ?? null,
    deletedProtectionCount,
  };
}

export async function writeSheetProtectionStatusCell(args: {
  spreadsheetId: string;
  sheetName: string;
  rowNumber: number;
  mode: "full_protected" | "signup_open";
}) {
  const sheets = getSheetsClient();
  const meta = await getSheetMeta(args.spreadsheetId, args.sheetName);
  const statusText = args.mode === "full_protected" ? "LOCKED" : "SIGNUPS OPEN";
  const fullText = `Status: ${statusText}`;
  const statusStart = "Status: ".length;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [
        {
          updateCells: {
            range: {
              sheetId: meta.sheetId,
              startRowIndex: Math.max(0, args.rowNumber - 1),
              endRowIndex: Math.max(0, args.rowNumber),
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: fullText },
                    userEnteredFormat: {
                      textFormat: {
                        bold: true,
                        foregroundColor: {
                          red: 0,
                          green: 0,
                          blue: 0,
                        },
                      },
                    },
                    textFormatRuns: [
                      {
                        startIndex: 0,
                        format: {
                          foregroundColor: {
                            red: 0,
                            green: 0,
                            blue: 0,
                          },
                        },
                      },
                      {
                        startIndex: statusStart,
                        format: {
                          foregroundColor:
                            args.mode === "full_protected"
                              ? { red: 0.8, green: 0.1, blue: 0.1 }
                              : { red: 0.1, green: 0.55, blue: 0.2 },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
            fields:
              "userEnteredValue,userEnteredFormat.textFormat.bold,userEnteredFormat.textFormat.foregroundColor,textFormatRuns",
          },
        },
      ],
    },
  });
}

export async function getSheetProtectionMode(
  spreadsheetId: string,
  sheetName: string
) {
  const meta = await getSheetMeta(spreadsheetId, sheetName);
  const matching = meta.protectedRanges.find((protection) =>
    (protection.description ?? "").startsWith(
      `${PROTECTION_DESCRIPTION_PREFIX}${sheetName}`
    )
  );
  if (!matching) {
    return "none" as const;
  }

  const ranges = matching.unprotectedRanges ?? [];
  if (ranges.length === 0) {
    return "full_protected" as const;
  }

  const signature = new Set(
    ranges.map(
      (range) =>
        `${range.startColumnIndex ?? -1}:${range.endColumnIndex ?? -1}:${
          range.startRowIndex ?? -1
        }:${range.endRowIndex ?? -1}`
    )
  );
  const expectedColumns = [2, 4, 6, 8, 10, 12, 14];
  const isSignupShape =
    signature.size === expectedColumns.length &&
    expectedColumns.every((column) =>
      Array.from(signature).some((key) => key.startsWith(`${column}:${column + 1}:2:`))
    );

  return isSignupShape ? ("signup_open" as const) : ("full_protected" as const);
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
