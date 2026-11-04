"use client";

import { Clock } from "lucide-react";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { formatDuration } from "./DailyRunsChart";
import { EnvTag, ProviderTag } from "./DeployTag";
import { formatScheduleTime, formatScheduleTimeUtc } from "@/lib/format-time";
import { runOutcome, SUMMARY_RUNS_PAGE_SIZE, type DeploymentStatus, type RunOutcome } from "@/lib/workflows/workflows";
import type { WorkflowSchedule } from "./Workflows";

// The dark: variants are required: without them dark:border-slate-700 on the card
// also recolors the left edge and the status accent disappears in dark mode.
const OUTCOME_ACCENT: Record<RunOutcome, string> = {
  success:   "border-l-green-500 dark:border-l-green-500",
  failed:    "border-l-red-500 dark:border-l-red-500",
  running:   "border-l-blue-500 dark:border-l-blue-500",
  attention: "border-l-amber-500 dark:border-l-amber-500",
  neutral:   "border-l-slate-400 dark:border-l-slate-500",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function timeUntil(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "any moment";
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

interface Props {
  deployments: DeploymentStatus[];
  schedulesByDeployment: Map<string, WorkflowSchedule[]>;
}

// The deployment status cards grid at the top of the CI/CD Status screen — one
// card per (env, provider) combo actually seen in the recent run window, with
// any deploy schedule for that same combo folded in rather than listed twice.
export function DeploymentCards({ deployments, schedulesByDeployment }: Props) {
  if (deployments.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
        Latest run per deployment. Ok and failed counts come from the last {SUMMARY_RUNS_PAGE_SIZE} runs in this repo.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {deployments.map((d) => {
          const borderClass = OUTCOME_ACCENT[runOutcome(d.latestRun.status, d.latestRun.conclusion)];
          const schedules = (schedulesByDeployment.get(`${d.env}:${d.provider}`) ?? [])
            .sort((a, b) => (a.nextRunAt! < b.nextRunAt! ? -1 : 1));
          const nextSchedule = schedules[0];
          return (
            <div key={`${d.env}:${d.provider}`} className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-l-4 ${borderClass} rounded-xl p-3.5 shadow-sm flex flex-col gap-2`}>
              <div className="flex items-center gap-1.5">
                <EnvTag env={d.env} />
                <ProviderTag provider={d.provider} />
              </div>
              <div className="flex items-center gap-2">
                <WorkflowStatusBadge status={d.latestRun.status} conclusion={d.latestRun.conclusion} />
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{timeAgo(d.latestRun.updatedAt)}</span>
              </div>
              <a
                href={d.latestRun.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block min-w-0 text-[11px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 truncate transition-colors"
                title={d.latestRun.workflowName}
              >
                {d.latestRun.workflowName}
              </a>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-700/60">
                <span>
                  <span className="text-green-600 dark:text-green-400 font-medium">{d.successCount}</span> ok ·{" "}
                  <span className="text-red-600 dark:text-red-400 font-medium">{d.failureCount}</span> failed
                </span>
                <span className="font-mono">{formatDuration(d.latestRun.durationSeconds)}</span>
              </div>
              {nextSchedule && (
                <div
                  className="flex items-start gap-1 text-[11px] text-slate-500 dark:text-slate-400"
                  title={schedules.map((s) => `${s.workflowName}: ${formatScheduleTime(s.nextRunAt!)} (${formatScheduleTimeUtc(s.nextRunAt!)})`).join("\n")}
                >
                  <Clock className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>
                    Next <span className="font-medium text-slate-600 dark:text-slate-300">{formatScheduleTime(nextSchedule.nextRunAt!)}</span> · {timeUntil(nextSchedule.nextRunAt!)}
                    {schedules.length > 1 && <span className="text-slate-500 dark:text-slate-400"> · +{schedules.length - 1} more</span>}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
