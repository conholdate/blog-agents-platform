import { google } from "googleapis";
import { OPTIMIZATION_SHEET_ID_QUEUE, OPTIMIZATION_SHEET_ID_LOG, PRODUCT_LABELS } from "./config";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export interface QueueRow {
  originalIndex: number;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;        // as percentage, e.g. 1.76
  position: number;
  daysSincePublished: number;
  product: string;    // extracted from URL path
  priorityScore: number;
  priorityTier: "high" | "medium" | "low";
}

export interface LogRow {
  originalIndex: number;
  url: string;
  lastOptimized: string; // YYYY-MM-DD
  product: string;
}

export interface OptimizationData {
  queue: QueueRow[];
  optimized: LogRow[];
}

function extractProduct(url: string): string {
  try {
    const path = new URL(url).pathname;
    const seg = path.split("/").filter(Boolean)[0] ?? "";
    if (!seg) return "";
    return PRODUCT_LABELS[seg.toLowerCase()] ?? (seg.charAt(0).toUpperCase() + seg.slice(1));
  } catch {
    return "";
  }
}

// SEO priority score — multi-factor:
//  1. Impressions × CTR efficiency: rewards content outperforming expected CTR for its position.
//     A post at pos 55 with 2.3% CTR (5× above expected 0.5%) signals great content that's buried —
//     exactly the kind worth optimising. CTR efficiency capped at 5× to avoid extreme outliers.
//  2. Position factor: page-2 (11–20) highest at 3×; deep positions (>30) also get 1.5× since
//     high CTR efficiency there means strong content with easy room to climb.
//  3. Age factor: older posts benefit most from a content refresh (1–2× over 10 years).
function computePriority(impressions: number, ctrPct: number, position: number, days: number): number {
  if (impressions < 5) return 0;
  const ctr = ctrPct / 100;
  const expectedCtr =
    position <= 1  ? 0.27 :
    position <= 2  ? 0.15 :
    position <= 3  ? 0.11 :
    position <= 5  ? 0.08 :
    position <= 10 ? 0.04 :
    position <= 20 ? 0.02 :
    position <= 50 ? 0.01 : 0.005;
  const ctrEfficiency = Math.min(ctr / expectedCtr, 5);
  const posFactor =
    position >= 11 && position <= 20 ? 3   :
    position >= 21 && position <= 30 ? 2   :
    position >= 5  && position <= 10 ? 1.5 :
    position > 30                    ? 1.5 : 1;
  const ageFactor = 1 + Math.min(days / 3650, 1);
  return impressions * ctrEfficiency * posFactor * ageFactor;
}

function priorityTier(score: number): "high" | "medium" | "low" {
  if (score >= 400) return "high";
  if (score >= 100) return "medium";
  return "low";
}

async function fetchTab(sheetId: string, tab: string): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab}'!A1:AZ`,
  });
  return (res.data.values ?? []) as string[][];
}

export async function getOptimizationData(domain: string): Promise<OptimizationData> {
  const [queueRaw, logRaw] = await Promise.all([
    fetchTab(OPTIMIZATION_SHEET_ID_QUEUE, domain),
    fetchTab(OPTIMIZATION_SHEET_ID_LOG, domain),
  ]);

  // Parse queue (headers: Page, Clicks, Impressions, CTR, Position, Days Since Published)
  const qHeaders = queueRaw[0] ?? [];
  const idx = (name: string) => qHeaders.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
  const iPage  = idx("Page");
  const iClk   = idx("Clicks");
  const iImp   = idx("Impressions");
  const iCtr   = idx("CTR");
  const iPos   = idx("Position");
  const iDays  = idx("Days Since Published");

  // Build optimized URL set for cross-reference
  const logHeaders = logRaw[0] ?? [];
  const iLogUrl  = logHeaders.findIndex(h => h.trim().toLowerCase() === "url");
  const iLogDate = logHeaders.findIndex(h => h.trim().toLowerCase() === "last optimized");
  const optimizedMap = new Map<string, string>();
  for (const row of logRaw.slice(1)) {
    const url  = (row[iLogUrl]  ?? "").trim();
    const date = (row[iLogDate] ?? "").trim();
    if (url) optimizedMap.set(url, date);
  }

  const queue: QueueRow[] = [];
  const optimized: LogRow[] = [];
  let queueIdx = 0;
  let logIdx   = 0;

  for (const row of queueRaw.slice(1)) {
    const url        = (row[iPage] ?? "").trim();
    if (!url) continue;
    const clean       = (s: string) => s.replace(/,/g, "");
    const clicks      = parseInt(clean(row[iClk]  ?? "0")) || 0;
    const impressions = parseInt(clean(row[iImp]  ?? "0")) || 0;
    const ctrStr      = (row[iCtr] ?? "").replace("%", "");
    const ctr         = parseFloat(ctrStr) || 0;
    const position    = parseFloat(row[iPos]  ?? "0") || 0;
    const days        = parseInt(clean(row[iDays] ?? "0")) || 0;
    const product     = extractProduct(url);
    const score       = computePriority(impressions, ctr, position, days);

    if (optimizedMap.has(url)) {
      optimized.push({ originalIndex: ++logIdx, url, lastOptimized: optimizedMap.get(url)!, product });
    } else {
      queue.push({ originalIndex: ++queueIdx, url, clicks, impressions, ctr, position, daysSincePublished: days, product, priorityScore: score, priorityTier: priorityTier(score) });
    }
  }

  optimized.sort((a, b) => b.lastOptimized.localeCompare(a.lastOptimized));

  return { queue, optimized };
}

export interface OptimizationSummary {
  pending: number;
  high: number;
  medium: number;
  optimized: number;
  page2: number;
  avgPosition: number;
  avgImpressions: number;
  avgCtr: number;
}

export async function getOptimizationSummary(domain: string): Promise<OptimizationSummary> {
  const { queue, optimized } = await getOptimizationData(domain);

  const high   = queue.filter((r) => r.priorityTier === "high").length;
  const medium = queue.filter((r) => r.priorityTier === "medium").length;
  const page2  = queue.filter((r) => r.position >= 11 && r.position <= 20).length;
  const avgPosition    = queue.length ? queue.reduce((s, r) => s + r.position, 0)     / queue.length : 0;
  const avgImpressions = queue.length ? queue.reduce((s, r) => s + r.impressions, 0)  / queue.length : 0;
  const avgCtr         = queue.length ? queue.reduce((s, r) => s + r.ctr, 0)          / queue.length : 0;

  return {
    pending:        queue.length,
    high,
    medium,
    optimized:      optimized.length,
    page2,
    avgPosition:    parseFloat(avgPosition.toFixed(1)),
    avgImpressions: Math.round(avgImpressions),
    avgCtr:         parseFloat(avgCtr.toFixed(2)),
  };
}
