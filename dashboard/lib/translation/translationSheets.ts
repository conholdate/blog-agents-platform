import { google } from "googleapis";
import { TRANSLATION_SHEET_ID } from "../config";
import { isOpen } from "./queueOrder";

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
  missingSince: string;
  readyAt: string;
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

// The agent writes "2026-11-22 14:05 UTC"; an unreadable value counts as ready, as in scan_queue.parse_ready_after().
function readyAtIso(value: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(value);
  return m ? `${m[1]}T${m[2]}:00Z` : "";
}

// The scan's "⏳ Waiting until" line goes stale between scans; the screen derives waiting from Ready After instead.
function withoutWaitingLine(notes: string): string {
  return notes.split("\n").filter((l) => !l.startsWith("⏳ Waiting until")).join("\n").trim();
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
      missingSince: get(row, "Missing Since"),
      readyAt: readyAtIso(get(row, "Ready After")),
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
      notes: withoutWaitingLine(get(row, "Notes")),
      comments: get(row, "Comments"),
    });
  });
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
  const open = queue.filter(isOpen);
  return {
    missing:     open.filter((r) => r.issue === "MISSING").length,
    retranslate: open.filter((r) => r.issue !== "MISSING").length,
    partial:     open.filter((r) => r.state === "partial").length,
    completed:   history.length,
  };
}
