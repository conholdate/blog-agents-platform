"use client";

import type { DailyRunStat } from "@/lib/workflows/workflows";

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

interface Props {
  stats: DailyRunStat[];
  variant?: "compact" | "full";
}

// Zero-filled stacked bars, one per day: success (green) at the baseline, failure
// (red) above it, everything else (in-progress/cancelled/skipped) on top. A day
// with no runs still gets a flat gray tick rather than disappearing.
export function DailyRunsChart({ stats, variant = "full" }: Props) {
  const compact = variant === "compact";
  const barAreaHeight = compact ? 22 : 56;
  const maxTotal = Math.max(1, ...stats.map((d) => d.success + d.failure + d.other));

  return (
    <div className={compact ? "flex flex-col gap-1" : "flex flex-col gap-2"}>
      <div className="flex items-end gap-[3px]" style={{ height: barAreaHeight }}>
        {stats.map((d) => {
          const total = d.success + d.failure + d.other;
          if (total === 0) {
            return (
              <div key={d.date} title={`${formatDayLabel(d.date)} · no runs`} className="flex-1 flex flex-col justify-end">
                <div className="h-[2px] rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            );
          }
          const successH = d.success > 0 ? Math.max(2, Math.round((d.success / maxTotal) * barAreaHeight)) : 0;
          const failureH = d.failure > 0 ? Math.max(2, Math.round((d.failure / maxTotal) * barAreaHeight)) : 0;
          const otherH = d.other > 0 ? Math.max(2, Math.round((d.other / maxTotal) * barAreaHeight)) : 0;
          const title = `${formatDayLabel(d.date)} · ${d.success} success, ${d.failure} failed${d.other ? `, ${d.other} other` : ""}${
            d.avgDurationSeconds != null ? ` · avg ${formatDuration(d.avgDurationSeconds)}` : ""
          }`;
          return (
            <div
              key={d.date}
              title={title}
              className="flex-1 flex flex-col justify-end gap-[2px] rounded-t-[3px] overflow-hidden cursor-default"
            >
              {d.other > 0 && <div className="bg-blue-400 dark:bg-blue-500" style={{ height: otherH }} />}
              {d.failure > 0 && <div className="bg-red-500 dark:bg-red-400" style={{ height: failureH }} />}
              {d.success > 0 && <div className="bg-green-500 dark:bg-green-400" style={{ height: successH }} />}
            </div>
          );
        })}
      </div>
      {!compact && stats.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400" />Success</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />Failed</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-500" />Other</span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500">
            {formatDayLabel(stats[0].date)} – {formatDayLabel(stats[stats.length - 1].date)}
          </div>
        </div>
      )}
    </div>
  );
}
