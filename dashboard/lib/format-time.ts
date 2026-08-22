// GitHub Actions cron schedules run in UTC; the blog team is in Pakistan, so every
// schedule time is shown in both zones rather than making people do the +5 math.
export function formatScheduleTime(iso: string): string {
  const date = new Date(iso);
  const utcDate = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const utcTime = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  const pktTime = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" });

  const utcDay = date.toLocaleDateString("en-CA", { timeZone: "UTC" });
  const pktDay = date.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
  const dayShift = pktDay !== utcDay ? " next day" : "";

  return `${utcDate}, ${utcTime} UTC (${pktTime}${dayShift} PKT)`;
}
