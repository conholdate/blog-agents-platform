import { google } from "googleapis";
import { TRANSLATION_SHEET_ID } from "../config";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export type QueueState = "queued" | "partial" | "hold" | "invalid";

export interface QueueRow {
  sheetRow: number;
  workOrder: number | null;
  missingSince: string;
  daysMissing: number;
  priority: string;
  product: string;
  dirBase: string;
  postDate: string;
  postUrl: string;
  author: string;
  issue: string;
  count: number;
  langs: string[];
  status: string;
  state: QueueState;
  source: string;
  notes: string;
  comments: string;
}

export interface CleanupRow {
  sheetRow: number;
  product: string;
  dirBase: string;
  postUrl: string;
  author: string;
  count: number;
  langs: string[];
  notes: string;
}

export interface HistoryRow {
  sheetRow: number;
  product: string;
  dirBase: string;
  postUrl: string;
  author: string;
  issue: string;
  count: number;
  langs: string[];
  completedDate: string;
  priority: string;
  source: string;
  notes: string;
  comments: string;
}

export interface TranslationData {
  queue: QueueRow[];
  cleanup: CleanupRow[];
  history: HistoryRow[];
  reportOnly: boolean;
}

const HISTORY_TAB = "history";
const CLEANUP_TAB = "cleanup";

// Mirrors blog-translation-agent: no scheduled translation run, and config.py NO_HISTORY_DOMAINS drops closed rows.
const REPORT_ONLY_DOMAINS = new Set(["blog.groupdocs.com"]);

// Mirrors config.py PRIORITY_RANK / DEFAULT_PRIORITY so the work order matches what Step 2 runs.
const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const DEFAULT_PRIORITY: Record<string, string> = { MISSING: "High", ISSUE: "Normal", OUTDATED: "Low" };

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

function normalizeUrl(url: string): string {
  if (!url || /^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function reader(headers: string[]) {
  const index = new Map(headers.map((h, i) => [h.trim().toLowerCase(), i]));
  return (row: string[], name: string): string => {
    const i = index.get(name.toLowerCase());
    return i === undefined ? "" : (row[i] ?? "").trim();
  };
}

function postDateOf(dirBase: string): string {
  return /^(\d{4}-\d{2}-\d{2})/.exec(dirBase)?.[1] ?? "";
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

function stateOf(status: string): QueueState {
  const s = status.toLowerCase();
  if (s === "" || s === "pending") return "queued";
  if (s === "partial") return "partial";
  if (s === "invalid") return "invalid";
  return "hold";
}

function priorityRank(row: QueueRow): number {
  const p = PRIORITY_RANK[row.priority] !== undefined ? row.priority : DEFAULT_PRIORITY[row.issue] ?? "Normal";
  return PRIORITY_RANK[p];
}

// Same rule as scan_queue.order_rows(): by priority, sheet order within a priority,
// except OUTDATED rows take their priority's OUTDATED places newest post first.
function assignWorkOrder(rows: QueueRow[]): void {
  const open = rows.filter((r) => r.state === "queued" || r.state === "partial");
  const ordered = [...open].sort((a, b) => priorityRank(a) - priorityRank(b));
  for (const rank of new Set(ordered.map(priorityRank))) {
    const places = ordered.flatMap((r, i) => (priorityRank(r) === rank && r.issue === "OUTDATED" ? [i] : []));
    const newest = places.map((i) => ordered[i]).sort((a, b) => b.postDate.localeCompare(a.postDate));
    places.forEach((p, k) => { ordered[p] = newest[k]; });
  }
  ordered.forEach((r, i) => { r.workOrder = i + 1; });
}

function parseQueue(raw: string[][]): QueueRow[] {
  const get = reader(raw[0] ?? []);
  const rows: QueueRow[] = [];
  raw.slice(1).forEach((row, i) => {
    const postUrl = normalizeUrl(get(row, "Blog Post URL"));
    if (!postUrl) return;
    const dirBase = get(row, "Blog Post Directory");
    const status = get(row, "Status");
    rows.push({
      sheetRow: i + 2,
      workOrder: null,
      missingSince: get(row, "Missing Since"),
      daysMissing: parseInt(get(row, "Days Missing")) || 0,
      priority: capitalize(get(row, "Priority")),
      product: get(row, "Product"),
      dirBase,
      postDate: postDateOf(dirBase),
      postUrl,
      author: get(row, "Author"),
      issue: get(row, "Issue").toUpperCase(),
      count: parseInt(get(row, "Count")) || 0,
      langs: splitLangs(get(row, "Target Translations")),
      status,
      state: stateOf(status),
      source: get(row, "Source"),
      notes: get(row, "Notes"),
      comments: get(row, "Comments"),
    });
  });
  assignWorkOrder(rows);
  return rows;
}

function parseCleanup(raw: string[][], domain: string): CleanupRow[] {
  const get = reader(raw[0] ?? []);
  const rows: CleanupRow[] = [];
  raw.slice(1).forEach((row, i) => {
    const postUrl = normalizeUrl(get(row, "Blog Post URL"));
    if (!postUrl || get(row, "Domain") !== domain) return;
    rows.push({
      sheetRow: i + 2,
      product: get(row, "Product"),
      dirBase: get(row, "Blog Post Directory"),
      postUrl,
      author: get(row, "Author"),
      count: parseInt(get(row, "Count")) || 0,
      langs: splitLangs(get(row, "Target Translations")),
      notes: get(row, "Notes"),
    });
  });
  return rows;
}

function parseHistory(raw: string[][], domain: string): HistoryRow[] {
  const get = reader(raw[0] ?? []);
  const rows: HistoryRow[] = [];
  raw.slice(1).forEach((row, i) => {
    const postUrl = normalizeUrl(get(row, "Blog Post URL"));
    if (!postUrl || get(row, "Domain") !== domain) return;
    rows.push({
      sheetRow: i + 2,
      product: get(row, "Product"),
      dirBase: get(row, "Blog Post Directory"),
      postUrl,
      author: get(row, "Author"),
      issue: get(row, "Issue").toUpperCase(),
      count: parseInt(get(row, "Count")) || 0,
      langs: splitLangs(get(row, "Target Translations")),
      completedDate: get(row, "Completed Date"),
      priority: capitalize(get(row, "Priority")),
      source: get(row, "Source"),
      notes: get(row, "Notes"),
      comments: get(row, "Comments"),
    });
  });
  return rows;
}

export async function getTranslationData(domain: string): Promise<TranslationData> {
  const [queueRaw, cleanupRaw, historyRaw] = await Promise.all([
    fetchTab(domain),
    fetchTab(CLEANUP_TAB),
    fetchTab(HISTORY_TAB),
  ]);

  return {
    queue: parseQueue(queueRaw),
    cleanup: parseCleanup(cleanupRaw, domain),
    history: parseHistory(historyRaw, domain),
    reportOnly: REPORT_ONLY_DOMAINS.has(domain),
  };
}

export interface TranslationSummary {
  missing: number;
  retranslate: number;
  partial: number;
  completed: number;
}

export async function getTranslationSummary(domain: string): Promise<TranslationSummary> {
  const { queue, history } = await getTranslationData(domain);
  const open = queue.filter((r) => r.workOrder !== null);
  return {
    missing:     open.filter((r) => r.issue === "MISSING").length,
    retranslate: open.filter((r) => r.issue !== "MISSING").length,
    partial:     open.filter((r) => r.state === "partial").length,
    completed:   history.length,
  };
}
