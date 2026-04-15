import { google } from "googleapis";
import { DOMAINS } from "./config";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetId(domain: string): string {
  const id = DOMAINS[domain];
  if (!id) throw new Error(`Unknown domain: ${domain}`);
  return id;
}

// Returns list of tab (sheet) names for a domain's spreadsheet
export async function getSheetTabs(domain: string): Promise<string[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSheetId(domain);

  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter(Boolean);
}

// Returns all rows (as objects) for a given tab
export async function getSheetRows(
  domain: string,
  tab: string
): Promise<Record<string, string>[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSheetId(domain);

  const range = `'${tab}'!A1:Z`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const values = res.data.values ?? [];
  if (values.length < 2) return [];

  const headers = values[0] as string[];
  return values.slice(1)
    .map((row, i) => {
      const obj: Record<string, string> = { _rowIndex: String(i + 2) }; // 1-based, row 1 is header
      headers.forEach((h, j) => {
        obj[h] = (row[j] as string) ?? "";
      });
      return obj;
    })
    .filter((row) => headers.some((h) => (row[h] ?? "").trim() !== ""));
}

// Saves a batch of cell updates back to the sheet
// changes: array of { rowIndex (1-based sheet row), key (column name), value }
export async function saveSheetRows(
  domain: string,
  tab: string,
  changes: { rowIndex: number; key: string; value: string }[]
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSheetId(domain);

  // Read the actual header row to get real column order
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!1:1`,
  });
  const headers: string[] = (headerRes.data.values?.[0] as string[]) ?? [];
  const headerIndex = Object.fromEntries(headers.map((h, i) => [h, i]));

  const data = changes.map(({ rowIndex, key, value }) => {
    const colIndex = headerIndex[key];
    if (colIndex === undefined) throw new Error(`Column "${key}" not found in sheet headers`);
    const col = columnLetter(colIndex);
    const range = `'${tab}'!${col}${rowIndex}`;
    return { range, values: [[value]] };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

function columnLetter(index: number): string {
  let letter = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}
