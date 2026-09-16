"use client";

import { Clock } from "lucide-react";
import { formatScheduleTime } from "@/lib/format-time";
import type { WorkflowSchedule } from "./Workflows";

function timeUntil(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "any moment";
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

// What's left over after deploy schedules are folded into the DeploymentCards
// above — non-deploy jobs like translation scans, or a schedule for a workflow
// that hasn't actually run recently.
export function ScheduledWorkflowsList({ schedules }: { schedules: WorkflowSchedule[] }) {
  if (schedules.length === 0) return null;

  return (
    <div className="mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">Scheduled Workflows</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {schedules.map((s) => (
          <div key={s.path} className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-300 text-[13px] truncate">{s.workflowName}</span>
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{s.crons.join(", ")}</span>
              </div>
              {s.description && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{s.description}</p>}
            </div>
            <div className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0">
              <div className="font-medium text-slate-700 dark:text-slate-300">{formatScheduleTime(s.nextRunAt!)}</div>
              <div className="text-slate-400 dark:text-slate-500 text-right">{timeUntil(s.nextRunAt!)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
