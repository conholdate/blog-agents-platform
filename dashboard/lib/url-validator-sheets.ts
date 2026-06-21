import { google, sheets_v4 } from "googleapis";
import type { Issue, ScanStats } from "./url-validator";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: SCOPES });
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

const HEADER_COLOR = { red: 0.157, green: 0.306, blue: 0.612 };
const HEADER_FG    = { red: 1, green: 1, blue: 1 };

const ERROR_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  MISSING_URL:               { red: 0.96, green: 0.26, blue: 0.21 },
  MISSING_TRAILING_SLASH:    { red: 1.00, green: 0.76, blue: 0.03 },
  WRONG_PRODUCT:             { red: 1.00, green: 0.60, blue: 0.00 },
  LANG_CODE_MISMATCH:        { red: 0.80, green: 0.00, blue: 0.80 },
  URL_MISMATCH_WITH_ENGLISH: { red: 0.00, green: 0.59, blue: 0.53 },
  NO_ENGLISH_BASE:           { red: 0.55, green: 0.55, blue: 0.55 },
  URL_TOO_SHORT:             { red: 0.96, green: 0.26, blue: 0.21 },
  DATE_BASED_URL:            { red: 0.13, green: 0.59, blue: 0.95 },
};

export const HISTORY_TAB_NAME = "History";
const HISTORY_HEADERS = ["Run Date", "Domain", "Products", "Posts", "Files", "Total Issues", "Error Breakdown"];

async function autosizeColumns(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetId: number, numCols: number) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: numCols } } }] },
  });
}

export async function findTabId(sheets: sheets_v4.Sheets, spreadsheetId: string, title: string): Promise<number | null> {
  const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
  const found = (metaRes.data.sheets ?? []).find((s) => s.properties?.title === title);
  return found?.properties?.sheetId ?? null;
}

/** Read a domain's persistent tab from the consolidated spreadsheet. Returns [] if the tab
 * doesn't exist yet (e.g. no scan has run for this domain) rather than throwing. */
export async function readDomainTab(sheets: sheets_v4.Sheets, spreadsheetId: string, domain: string): Promise<string[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${domain}'!A1:I` });
    return res.data.values as string[][] ?? [];
  } catch {
    return [];
  }
}

export interface HistoryEntry {
  runDate: string;
  products: number;
  posts: number;
  files: number;
  totalIssues: number;
  errorBreakdown: string;
}

/** Read History rows for one domain, oldest first (matches append order). [] if the History
 * tab doesn't exist yet or has no entries for this domain. */
export async function getDomainHistory(sheets: sheets_v4.Sheets, spreadsheetId: string, domain: string): Promise<HistoryEntry[]> {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${HISTORY_TAB_NAME}'!A1:G` });
    const values = (res.data.values as string[][]) ?? [];
    if (values.length < 2) return [];
    return values
      .slice(1)
      .filter((row) => row[1] === domain)
      .map((row) => ({
        runDate: row[0] ?? "",
        products: Number(row[2] ?? 0),
        posts: Number(row[3] ?? 0),
        files: Number(row[4] ?? 0),
        totalIssues: Number(row[5] ?? 0),
        errorBreakdown: row[6] ?? "",
      }));
  } catch {
    return [];
  }
}

export function getLatestHistoryEntry(entries: HistoryEntry[]): HistoryEntry | null {
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

/** Write issue rows + standard formatting (headers, freeze, color-code, autosize) into an
 * issues sheet. Shared by the legacy dated-tab flow and the consolidated persistent-tab flow. */
async function writeIssueTab(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetId: number, tabTitle: string, issues: Issue[]) {
  const sortedIssues = [...issues].sort((a, b) => a.errorType.localeCompare(b.errorType));
  const headers = ["#", "Product", "Post Folder", "Language", "Error Type", "Current URL", "Expected URL", "Notes", "Redirect Rule"];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabTitle}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        headers,
        ...sortedIssues.map((issue, i) => [
          i + 1, issue.product, issue.postFolder, issue.lang, issue.errorType,
          issue.currentUrl, issue.expectedUrl, issue.notes, issue.redirectRule,
        ]),
      ]
    },
  });

  const formatReqs: object[] = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: HEADER_FG }, backgroundColor: HEADER_COLOR } },
        fields: "userEnteredFormat(textFormat,backgroundColor)",
      }
    },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      }
    },
  ];

  for (let i = 0; i < sortedIssues.length; i += 1000) {
    const batch = sortedIssues.slice(i, i + 1000).flatMap((issue, j) => {
      const bg = ERROR_COLORS[issue.errorType];
      if (!bg) return [];
      return [{
        repeatCell: {
          range: { sheetId, startRowIndex: i + j + 1, endRowIndex: i + j + 2, startColumnIndex: 4, endColumnIndex: 5 },
          cell: { userEnteredFormat: { backgroundColor: bg } },
          fields: "userEnteredFormat.backgroundColor",
        }
      }];
    });
    formatReqs.push(...batch);
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: formatReqs } });
  await autosizeColumns(sheets, spreadsheetId, sheetId, 9);
}

/** Append one summary row to the shared History tab, creating it (with headers) if missing. */
async function appendHistoryRow(sheets: sheets_v4.Sheets, spreadsheetId: string, domain: string, stats: ScanStats, issues: Issue[]) {
  const today = new Date().toISOString().slice(0, 10);
  const errorCounts: Record<string, number> = {};
  for (const issue of issues) errorCounts[issue.errorType] = (errorCounts[issue.errorType] ?? 0) + 1;
  const breakdown = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}:${c}`).join(", ") || "none";

  let historySheetId = await findTabId(sheets, spreadsheetId, HISTORY_TAB_NAME);
  if (historySheetId === null) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: HISTORY_TAB_NAME, gridProperties: { rowCount: 2, columnCount: HISTORY_HEADERS.length } } } }] },
    });
    historySheetId = addRes.data.replies![0].addSheet!.properties!.sheetId!;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${HISTORY_TAB_NAME}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HISTORY_HEADERS] },
    });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: historySheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: HEADER_FG }, backgroundColor: HEADER_COLOR } },
              fields: "userEnteredFormat(textFormat,backgroundColor)",
            }
          },
          {
            updateSheetProperties: {
              properties: { sheetId: historySheetId, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            }
          },
        ]
      }
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${HISTORY_TAB_NAME}'!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[today, domain, stats.products, stats.posts, stats.files, issues.length, breakdown]] },
  });
  await autosizeColumns(sheets, spreadsheetId, historySheetId, HISTORY_HEADERS.length);
}

/** Retry a Sheets write with exponential backoff on transient API errors. Safe to retry
 * whole-function here since the write paths are find-or-create / clear-and-rewrite --
 * re-running after a partial failure converges to the same result. Mirrors url-validator's
 * _with_retry() in main.py. */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelayMs = 2000): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(`Sheets write failed (attempt ${attempt}/${maxAttempts}): ${err}. Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function writeToConsolidatedSheetOnce(issues: Issue[], stats: ScanStats, domain: string, spreadsheetId: string): Promise<void> {
  const sheets = getSheetsClient();

  let sheetId = await findTabId(sheets, spreadsheetId, domain);
  if (sheetId === null) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: domain, gridProperties: { rowCount: issues.length + 5, columnCount: 9 } } } }] },
    });
    sheetId = addRes.data.replies![0].addSheet!.properties!.sheetId!;
  } else {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${domain}'!A1:Z` });
  }

  await writeIssueTab(sheets, spreadsheetId, sheetId, domain, issues);
  await appendHistoryRow(sheets, spreadsheetId, domain, stats, issues);
}

/** Write into the single consolidated spreadsheet: one persistent tab per domain (overwritten
 * in place each run, never a new dated tab) + a shared History row. Mirrors url-validator/main.py's
 * write_to_consolidated_sheet() so the CLI/CI and the dashboard produce identical results. */
export async function writeToConsolidatedSheet(issues: Issue[], stats: ScanStats, domain: string, spreadsheetId: string): Promise<void> {
  return withRetry(() => writeToConsolidatedSheetOnce(issues, stats, domain, spreadsheetId));
}

async function writeToSheetsOnce(
  issues: Issue[],
  stats: ScanStats,
  spreadsheetId: string
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const today = new Date().toISOString().slice(0, 10);
  const tabIssues  = today;
  const tabSummary = `${today} – Summary`;

  // Delete existing tabs with same names (re-run safety)
  const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
  const deleteRequests = (metaRes.data.sheets ?? [])
    .filter((s) => s.properties?.title === tabIssues || s.properties?.title === tabSummary)
    .map((s) => ({ deleteSheet: { sheetId: s.properties!.sheetId! } }));

  if (deleteRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: deleteRequests } });
  }

  // ── Tab 1: All Issues ─────────────────────────────────────────────────────
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: tabIssues,
            index: 0,
            gridProperties: { rowCount: issues.length + 2, columnCount: 9 },
          }
        }
      }]
    }
  });
  const issuesSheetId = addRes.data.replies![0].addSheet!.properties!.sheetId!;

  await writeIssueTab(sheets, spreadsheetId, issuesSheetId, tabIssues, issues);

  // ── Tab 2: Summary ────────────────────────────────────────────────────────
  const addSumRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: tabSummary, index: 0 } } }] }
  });
  const summarySheetId = addSumRes.data.replies![0].addSheet!.properties!.sheetId!;

  const errorCounts: Record<string, number>   = {};
  const productCounts: Record<string, number> = {};
  const langCounts: Record<string, number>    = {};

  for (const issue of issues) {
    errorCounts[issue.errorType]  = (errorCounts[issue.errorType]  ?? 0) + 1;
    productCounts[issue.product]  = (productCounts[issue.product]  ?? 0) + 1;
    langCounts[issue.lang]        = (langCounts[issue.lang]        ?? 0) + 1;
  }

  const summaryRows: (string | number)[][] = [
    ["Run Date", today],
    ["Products scanned", stats.products],
    ["Posts scanned", stats.posts],
    ["Files scanned", stats.files],
    ["Total issues", issues.length],
    [],
    ["Error Type", "Count"],
    ...Object.entries(errorCounts).sort((a, b) => b[1] - a[1]),
    [],
    ["Product", "Issue Count"],
    ...Object.entries(productCounts).sort((a, b) => b[1] - a[1]),
    [],
    ["Language", "Issue Count"],
    ...Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 30),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabSummary}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: summaryRows },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: summarySheetId, startRowIndex: 6, endRowIndex: 7 },
            cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: HEADER_FG }, backgroundColor: HEADER_COLOR } },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
          }
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId: summarySheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 4 },
          }
        },
      ]
    }
  });
}

export async function writeToSheets(issues: Issue[], stats: ScanStats, spreadsheetId: string): Promise<void> {
  return withRetry(() => writeToSheetsOnce(issues, stats, spreadsheetId));
}
