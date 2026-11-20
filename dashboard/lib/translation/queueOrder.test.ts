import { describe, expect, it } from "vitest";
import { waitsUntil, workOrder } from "./queueOrder";
import type { QueueRow } from "./translationSheets";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const FUTURE = "2026-11-21T12:00:00Z";
const PAST = "2026-11-19T12:00:00Z";

type Row = Pick<QueueRow, "sheetRow" | "priority" | "issue" | "postDate" | "state" | "readyAt">;

function row(sheetRow: number, over: Partial<Row> = {}): Row {
  return { sheetRow, priority: "Low", issue: "OUTDATED", postDate: "2026-01-01", state: "queued", readyAt: "", ...over };
}

describe("waitsUntil", () => {
  it("waits while Ready After is ahead", () => {
    expect(waitsUntil(row(2, { readyAt: FUTURE }), NOW)).toBe(Date.parse(FUTURE));
  });

  it("is ready once Ready After has passed or is blank", () => {
    expect(waitsUntil(row(2, { readyAt: PAST }), NOW)).toBeNull();
    expect(waitsUntil(row(2), NOW)).toBeNull();
  });

  it("never holds back Urgent or ISSUE rows", () => {
    expect(waitsUntil(row(2, { readyAt: FUTURE, priority: "Urgent" }), NOW)).toBeNull();
    expect(waitsUntil(row(2, { readyAt: FUTURE, issue: "ISSUE", priority: "Normal" }), NOW)).toBeNull();
  });
});

describe("workOrder", () => {
  it("orders by priority, FIFO within a priority, OUTDATED newest post first", () => {
    const order = workOrder([
      row(2, { postDate: "2022-05-01" }),
      row(3, { issue: "MISSING", priority: "High" }),
      row(4, { postDate: "2026-09-01" }),
      row(5, { issue: "ISSUE", priority: "Normal" }),
      row(6, { issue: "MISSING", priority: "High" }),
    ], NOW);
    expect([...order.entries()].sort((a, b) => a[1] - b[1]).map(([r]) => r)).toEqual([3, 6, 5, 4, 2]);
  });

  it("falls back to the issue's default priority when Priority is blank", () => {
    const order = workOrder([row(2), row(3, { issue: "MISSING", priority: "" })], NOW);
    expect(order.get(3)).toBe(1);
  });

  it("leaves out waiting, held and invalid rows", () => {
    const order = workOrder([
      row(2, { readyAt: FUTURE }),
      row(3, { state: "hold" }),
      row(4, { state: "invalid" }),
      row(5, { state: "partial" }),
    ], NOW);
    expect([...order.keys()]).toEqual([5]);
  });
});
