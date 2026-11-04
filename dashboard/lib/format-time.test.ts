import { describe, it, expect } from "vitest";
import { formatClockTime, formatDelay, formatScheduleTime, formatScheduleTimeUtc } from "./format-time";

describe("format-time", () => {
  it("shows a scheduled time in GMT+5 and UTC", () => {
    expect(formatScheduleTime("2026-11-04T03:00:00Z")).toBe("Wed, Nov 4, 08:00 GMT+5");
    expect(formatScheduleTimeUtc("2026-11-04T03:00:00Z")).toBe("Wed, Nov 4, 03:00 UTC");
  });

  it("uses the GMT+5 date when it differs from the UTC date", () => {
    expect(formatScheduleTime("2026-11-04T21:30:00Z")).toBe("Thu, Nov 5, 02:30 GMT+5");
  });

  it("renders midnight as 00:00", () => {
    expect(formatClockTime("2026-11-04T19:00:00Z")).toBe("00:00");
  });

  it("formats how late a run started", () => {
    expect(formatDelay("2026-11-03T03:00:00Z", "2026-11-03T10:28:14Z")).toBe("7h 28m");
    expect(formatDelay("2026-11-03T03:00:00Z", "2026-11-03T03:12:00Z")).toBe("12m");
  });
});
