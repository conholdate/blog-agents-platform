"use client";

import { Clock } from "lucide-react";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { formatDuration } from "./DailyRunsChart";
import { EnvTag, ProviderTag } from "./DeployTag";
import { formatScheduleTime } from "@/lib/format-time";
import type { DeploymentStatus } from "@/lib/workflows/workflows";
import type { WorkflowSchedule } from "./Workflows";

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
    <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {deployments.map((d) => {
        const isFailing = d.latestRun.status === "completed" && (d.latestRun.conclusion === "failure" || d.latestRun.conclusion === "timed_out");
        const borderClass = isFailing
          ? "border-l-red-500"
          : d.latestRun.status !== "completed"
          ? "border-l-blue-500"
          : "border-l-green-500";
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
              <span className="text-[11px] text-slate-400 dark:text-slate-500">{timeAgo(d.latestRun.updatedAt)}</span>
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
                className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500"
                title={schedules.map((s) => `${s.workflowName}: ${formatScheduleTime(s.nextRunAt!)}`).join("\n")}
              >
                <Clock className="h-3 w-3 shrink-0" />
                <span>Next <span className="font-medium text-slate-600 dark:text-slate-300">{timeUntil(nextSchedule.nextRunAt!)}</span></span>
                {schedules.length > 1 && <span className="text-slate-300 dark:text-slate-600">· +{schedules.length - 1} more</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
