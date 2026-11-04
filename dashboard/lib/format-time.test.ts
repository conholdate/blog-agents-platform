import { describe, it, expect } from "vitest";
import { formatClockTime, formatDelay, formatDuration, formatScheduleTime, formatScheduleTimeUtc } from "./format-time";

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
    expect(formatDelay("2026-11-03T03:00:00Z", "2026-11-03T10:28:14Z")).toBe("7hr 28m");
    expect(formatDelay("2026-11-03T03:00:00Z", "2026-11-03T03:12:00Z")).toBe("12m");
  });
});

describe("formatDuration", () => {
  it("shows a dash when there is no duration yet", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("shows seconds under a minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(20)).toBe("20s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("shows whole minutes under an hour, without seconds", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(430)).toBe("7m");
    expect(formatDuration(31 * 60)).toBe("31m");
  });

  it("rounds to the nearest minute", () => {
    expect(formatDuration(450)).toBe("8m");
    expect(formatDuration(449)).toBe("7m");
  });

  it("shows hours and minutes from an hour up", () => {
    expect(formatDuration(150 * 60)).toBe("2hr 30m");
    expect(formatDuration(173 * 60 + 52)).toBe("2hr 54m");
  });

  it("drops zero minutes", () => {
    expect(formatDuration(3600)).toBe("1hr");
    expect(formatDuration(7200)).toBe("2hr");
  });

  it("rolls 59m 40s up to an hour rather than showing 60m", () => {
    expect(formatDuration(59 * 60 + 40)).toBe("1hr");
  });
});
