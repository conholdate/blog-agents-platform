// GitHub Actions works in UTC but the blog team works in GMT+5, so times are shown
// in GMT+5 with UTC kept for hover text. Asia/Karachi is GMT+5 all year (no DST).
const GMT5_ZONE = "Asia/Karachi";

function formatIn(iso: string, timeZone: string, label: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });
  return `${day}, ${clock(date, timeZone)} ${label}`;
}

// hourCycle, not hour12: false, which renders midnight as "24:00" in en-US.
function clock(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });
}

export function formatScheduleTime(iso: string): string {
  return formatIn(iso, GMT5_ZONE, "GMT+5");
}

export function formatScheduleTimeUtc(iso: string): string {
  return formatIn(iso, "UTC", "UTC");
}

export function formatClockTime(iso: string): string {
  return clock(new Date(iso), GMT5_ZONE);
}

export function formatDelay(fromIso: string, toIso: string): string {
  return formatDuration(Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000)));
}

// Seconds only matter for very short runs; past a minute they're noise, and past an
// hour minutes read better as hours ("2hr 54m", not "173m 52s").
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hours}hr` : `${hours}hr ${mins}m`;
}
