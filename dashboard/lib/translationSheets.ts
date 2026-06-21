import { google } from "googleapis";
import { TRANSLATION_SHEET_ID } from "./config";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export type HistoryStatus = "pending" | "partial" | "completed";

export interface ScanRow {
  originalIndex: number;
  product: string;
  dirBase: string;
  postUrl: string;
  author: string;
  missingCount: number;
  missingLangs: string[];
  extraLangs: string[];
  extraCount: number;
}

export interface HistoryRow {
  originalIndex: number;
  product: string;
  dirBase: string;
  postUrl: string;
  author: string;
  missingLangs: string[];
  missingCount: number;
  status: HistoryStatus;
  completedDate: string;
}

export interface TranslationData {
  scan: ScanRow[];
  history: HistoryRow[];
}

const HISTORY_TAB = "history";

function splitLangs(s: string): string[] {
  return s.split(",").map((l) => l.trim()).filter((l) => l && l !== "-");
}

async function fetchTab(tab: string): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: TRANSLATION_SHEET_ID,
    range: `'${tab}'!A1:AZ`,
  });
  return (res.data.values ?? []) as string[][];
}

function colIndex(headers: string[], name: string): number {
  return headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
}

function parseScan(raw: string[][]): ScanRow[] {
  const headers = raw[0] ?? [];
  const iProduct  = colIndex(headers, "Product");
  const iDir      = colIndex(headers, "Blog Post Directory");
  const iUrl      = colIndex(headers, "Blog Post URL");
  const iAuthor   = colIndex(headers, "Author");
  const iMissCnt  = colIndex(headers, "Missing Count");
  const iMissLang = colIndex(headers, "Missing Translations");
  const iExtraLang = colIndex(headers, "Extra Translations");
  const iExtraCnt = colIndex(headers, "Extra Files Count");

  const rows: ScanRow[] = [];
  let i = 0;
  for (const row of raw.slice(1)) {
    const postUrl = (row[iUrl] ?? "").trim();
    if (!postUrl) continue;
    rows.push({
      originalIndex: ++i,
      product: (row[iProduct] ?? "").trim(),
      dirBase: (row[iDir] ?? "").trim(),
      postUrl,
      author: (row[iAuthor] ?? "").trim(),
      missingCount: parseInt(row[iMissCnt] ?? "0") || 0,
      missingLangs: splitLangs(row[iMissLang] ?? ""),
      extraLangs: splitLangs(row[iExtraLang] ?? ""),
      extraCount: parseInt(row[iExtraCnt] ?? "0") || 0,
    });
  }
  return rows;
}

function parseHistory(raw: string[][], domain: string): HistoryRow[] {
  const headers = raw[0] ?? [];
  const iDomain   = colIndex(headers, "Domain");
  const iProduct  = colIndex(headers, "Product");
  const iDir      = colIndex(headers, "Blog Post Directory");
  const iUrl      = colIndex(headers, "Blog Post URL");
  const iAuthor   = colIndex(headers, "Author");
  const iMissLang = colIndex(headers, "Missing Translations");
  const iMissCnt  = colIndex(headers, "Missing Count");
  const iStatus   = colIndex(headers, "Status");
  const iDone     = colIndex(headers, "Completed Date");

  const rows: HistoryRow[] = [];
  let i = 0;
  for (const row of raw.slice(1)) {
    const postUrl = (row[iUrl] ?? "").trim();
    if (!postUrl) continue;
    if ((row[iDomain] ?? "").trim() !== domain) continue;
    rows.push({
      originalIndex: ++i,
      product: (row[iProduct] ?? "").trim(),
      dirBase: (row[iDir] ?? "").trim(),
      postUrl,
      author: (row[iAuthor] ?? "").trim(),
      missingLangs: splitLangs(row[iMissLang] ?? ""),
      missingCount: parseInt(row[iMissCnt] ?? "0") || 0,
      status: ((row[iStatus] ?? "pending").trim().toLowerCase() as HistoryStatus) || "pending",
      completedDate: (row[iDone] ?? "").trim(),
    });
  }
  return rows;
}

export async function getTranslationData(domain: string): Promise<TranslationData> {
  const [scanRaw, historyRaw] = await Promise.all([
    fetchTab(domain),
    fetchTab(HISTORY_TAB),
  ]);

  return {
    scan: parseScan(scanRaw),
    history: parseHistory(historyRaw, domain),
  };
}

export interface TranslationSummary {
  missing: number;
  totalMissingLangs: number;
  pending: number;
  partial: number;
  completed: number;
}

export async function getTranslationSummary(domain: string): Promise<TranslationSummary> {
  const { scan, history } = await getTranslationData(domain);

  return {
    missing: scan.length,
    totalMissingLangs: scan.reduce((s, r) => s + r.missingCount, 0),
    pending:   history.filter((r) => r.status === "pending").length,
    partial:   history.filter((r) => r.status === "partial").length,
    completed: history.filter((r) => r.status === "completed").length,
  };
}
