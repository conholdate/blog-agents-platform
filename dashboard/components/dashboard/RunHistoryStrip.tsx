"use client";

import type { WorkflowRunTick } from "@/lib/workflows";

const TICK_COLORS: Record<string, string> = {
  success:         "bg-green-500 dark:bg-green-400",
  failure:         "bg-red-500 dark:bg-red-400",
  timed_out:       "bg-red-500 dark:bg-red-400",
  cancelled:       "bg-slate-300 dark:bg-slate-600",
  skipped:         "bg-slate-300 dark:bg-slate-600",
  action_required: "bg-amber-400 dark:bg-amber-500",
};

function tickColor(run: WorkflowRunTick): string {
  if (run.status === "in_progress" || run.status === "queued" || run.status === "waiting") {
    return "bg-blue-500 dark:bg-blue-400 animate-pulse";
  }
  const key = run.conclusion ?? run.status;
  return TICK_COLORS[key] ?? "bg-slate-300 dark:bg-slate-600";
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

interface Props {
  runs: WorkflowRunTick[];
}

export function RunHistoryStrip({ runs }: Props) {
  if (runs.length === 0) {
    return <p className="text-[11px] text-slate-400 dark:text-slate-500">No recent runs</p>;
  }

  return (
    <div className="flex items-center gap-[3px]" role="img" aria-label={`Last ${runs.length} workflow runs, most recent last`}>
      {runs.map((run, i) => (
        <a
          key={i}
          href={run.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`${run.workflowName} · ${run.conclusion ?? run.status} · ${timeAgo(run.updatedAt)}`}
          className={`h-4 w-2.5 rounded-[2px] shrink-0 transition-transform hover:scale-110 ${tickColor(run)} ${i === runs.length - 1 ? "ring-2 ring-offset-1 ring-slate-300 dark:ring-slate-500 ring-offset-white dark:ring-offset-slate-700" : ""}`}
        />
      ))}
    </div>
  );
}
