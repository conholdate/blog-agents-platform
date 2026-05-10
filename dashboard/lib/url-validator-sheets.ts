import { google } from "googleapis";
import type { Issue, ScanStats } from "./url-validator";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: SCOPES });
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

export async function writeToSheets(
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

  const sortedIssues = [...issues].sort((a, b) => a.errorType.localeCompare(b.errorType));

  // ── Tab 1: All Issues ─────────────────────────────────────────────────────
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: tabIssues,
            index: 0,
            gridProperties: { rowCount: sortedIssues.length + 2, columnCount: 9 },
          }
        }
      }]
    }
  });
  const issuesSheetId = addRes.data.replies![0].addSheet!.properties!.sheetId!;

  const headers = ["#", "Product", "Post Folder", "Language", "Error Type", "Current URL", "Expected URL", "Notes", "Redirect Rule"];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabIssues}'!A1`,
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

  // Header style + freeze + auto-resize
  const formatReqs: object[] = [
    {
      repeatCell: {
        range: { sheetId: issuesSheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: HEADER_FG }, backgroundColor: HEADER_COLOR } },
        fields: "userEnteredFormat(textFormat,backgroundColor)",
      }
    },
    {
      updateSheetProperties: {
        properties: { sheetId: issuesSheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      }
    },
    {
      autoResizeDimensions: {
        dimensions: { sheetId: issuesSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 9 },
      }
    },
  ];

  // Color error type column (E) in batches of 1000
  for (let i = 0; i < sortedIssues.length; i += 1000) {
    const batch = sortedIssues.slice(i, i + 1000).flatMap((issue, j) => {
      const bg = ERROR_COLORS[issue.errorType];
      if (!bg) return [];
      return [{
        repeatCell: {
          range: { sheetId: issuesSheetId, startRowIndex: i + j + 1, endRowIndex: i + j + 2, startColumnIndex: 4, endColumnIndex: 5 },
          cell: { userEnteredFormat: { backgroundColor: bg } },
          fields: "userEnteredFormat.backgroundColor",
        }
      }];
    });
    formatReqs.push(...batch);
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: formatReqs } });

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
