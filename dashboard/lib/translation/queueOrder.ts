import type { QueueRow } from "./translationSheets";

// Mirrors blog-translation-agent config.py PRIORITY_RANK / DEFAULT_PRIORITY and
// scan_queue.py is_settled() / order_rows(), so the screen shows what Step 2 will run.
export const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const DEFAULT_PRIORITY: Record<string, string> = { MISSING: "High", ISSUE: "Normal", OUTDATED: "Low" };

type OrderFields = Pick<QueueRow, "sheetRow" | "priority" | "issue" | "postDate" | "state" | "readyAt">;

function rank(row: OrderFields): number {
  const p = PRIORITY_RANK[row.priority] !== undefined ? row.priority : DEFAULT_PRIORITY[row.issue] ?? "Normal";
  return PRIORITY_RANK[p];
}

export function isOpen(row: Pick<QueueRow, "state">): boolean {
  return row.state === "queued" || row.state === "partial";
}

// Urgent and ISSUE rows never wait; a blank Ready After means ready.
export function waitsUntil(row: OrderFields, now: number): number | null {
  if (row.priority === "Urgent" || row.issue === "ISSUE" || !row.readyAt) return null;
  const at = Date.parse(row.readyAt);
  return at > now ? at : null;
}

// Open rows past their settling time, by priority, sheet order within a priority,
// except OUTDATED rows take their priority's OUTDATED places newest post first.
export function workOrder(rows: OrderFields[], now: number): Map<number, number> {
  const ordered = rows.filter((r) => isOpen(r) && waitsUntil(r, now) === null).sort((a, b) => rank(a) - rank(b));
  for (const r of new Set(ordered.map(rank))) {
    const places = ordered.flatMap((row, i) => (rank(row) === r && row.issue === "OUTDATED" ? [i] : []));
    const newest = places.map((i) => ordered[i]).sort((a, b) => b.postDate.localeCompare(a.postDate));
    places.forEach((p, k) => { ordered[p] = newest[k]; });
  }
  return new Map(ordered.map((row, i) => [row.sheetRow, i + 1]));
}
