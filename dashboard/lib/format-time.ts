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
  const mins = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
