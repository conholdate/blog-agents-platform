import { google, sheets_v4 } from "googleapis";
import type { RepoIssue } from "./types";

const FIX_LOG_TAB_NAME = "Fix Log";
const FIX_LOG_HEADERS = ["Timestamp", "Domain", "Issue Type", "Source Key", "Before", "After", "PR URL", "PR Number", "Raw Line", "File"];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export function getRepoDoctorLogSheetId(): string | null {
  return process.env.REPO_DOCTOR_LOG_SHEET_ID ?? null;
}

export function isRepoDoctorLogConfigured(): boolean {
  return !!getRepoDoctorLogSheetId();
}

async function findTabId(sheets: sheets_v4.Sheets, spreadsheetId: string, title: string): Promise<number | null> {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (res.data.sheets ?? []).find((s) => s.properties?.title === title);
  return sheet?.properties?.sheetId ?? null;
}

async function ensureFixLogTab(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<void> {
  const existing = await findTabId(sheets, spreadsheetId, FIX_LOG_TAB_NAME);
  if (existing != null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: FIX_LOG_TAB_NAME, gridProperties: { rowCount: 2, columnCount: FIX_LOG_HEADERS.length } } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${FIX_LOG_TAB_NAME}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [FIX_LOG_HEADERS] },
  });
}

export interface FixLogEntry {
  timestamp: string;
  domain: string;
  issueType: string;
  sourceKey: string;
  before: string;
  after: string;
  prUrl: string;
  prNumber: number;
  rawLine: string;
  filePath: string;
}

// Reads back what logFixedIssue has written — the durable, browsable history of
// fixed issues shown on the dashboard's "Fixed" tab. Returns [] (never throws)
// if logging isn't configured or the tab doesn't exist yet (no fixes logged so far).
export async function getFixLog(domain: string): Promise<FixLogEntry[]> {
  const spreadsheetId = getRepoDoctorLogSheetId();
  if (!spreadsheetId) return [];

  try {
    const sheets = getSheetsClient();
    const tabId = await findTabId(sheets, spreadsheetId, FIX_LOG_TAB_NAME);
    if (tabId == null) return [];

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${FIX_LOG_TAB_NAME}'!A1:J` });
    const values = res.data.values ?? [];
    if (values.length < 2) return [];

    return values
      .slice(1)
      .map((row): FixLogEntry => ({
        timestamp: (row[0] as string) ?? "",
        domain: (row[1] as string) ?? "",
        issueType: (row[2] as string) ?? "",
        sourceKey: (row[3] as string) ?? "",
        before: (row[4] as string) ?? "",
        after: (row[5] as string) ?? "",
        prUrl: (row[6] as string) ?? "",
        prNumber: Number(row[7] ?? 0),
        rawLine: (row[8] as string) ?? "", // absent on rows logged before this column existed
        filePath: (row[9] as string) ?? "", // ditto — older rows predate multi-file support
      }))
      .filter((entry) => entry.domain === domain)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}

// Appends one row to the "Fix Log" tab (created on first use) whenever a fix PR
// is opened — this is the durable, browsable history of fixed issues; the live
// issue list itself is never persisted here (it's always re-derived fresh from
// GitHub, see repo-doctor.ts's scanDomain). Best-effort and never throws: the
// PR has already been opened by the time this runs, so a logging failure must
// not be surfaced as a fix failure.
export async function logFixedIssue(domain: string, issue: RepoIssue, prUrl: string, prNumber: number): Promise<boolean> {
  const spreadsheetId = getRepoDoctorLogSheetId();
  if (!spreadsheetId) return false;

  try {
    const sheets = getSheetsClient();
    await ensureFixLogTab(sheets, spreadsheetId);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${FIX_LOG_TAB_NAME}'!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          new Date().toISOString(),
          domain,
          issue.type,
          issue.sourceKey ?? "",
          issue.currentValue ?? "",
          issue.suggestedValue ?? "",
          prUrl,
          String(prNumber),
          issue.rawLine ?? "",
          issue.filePath,
        ]],
      },
    });
    return true;
  } catch {
    return false;
  }
}
