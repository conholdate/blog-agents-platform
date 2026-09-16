"use client";

import { useState, Fragment } from "react";
import { Loader2, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { formatDuration } from "./DailyRunsChart";
import { EnvTag, ProviderTag } from "./DeployTag";
import type { FailedStep } from "@/lib/workflows/workflows";
import type { WorkflowRun } from "./Workflows";

function isFailedRun(run: WorkflowRun): boolean {
  return run.status === "completed" && (run.conclusion === "failure" || run.conclusion === "timed_out");
}

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

interface Props {
  domain: string;
  runs: WorkflowRun[];
}

// The env/provider + workflow filter chips and the run history table, including
// on-demand failure-reason lookup for a clicked failed run. Owns its own filter
// and expand state since none of it needs to be visible to the rest of the
// CI/CD Status screen.
export function RunsTable({ domain, runs }: Props) {
  const [filterWorkflow, setFilterWorkflow] = useState<string>("all");
  const [filterEnv, setFilterEnv] = useState<"all" | "production" | "staging">("all");
  const [filterProvider, setFilterProvider] = useState<"all" | "aws" | "ceph">("all");
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [failedSteps, setFailedSteps] = useState<Record<number, FailedStep[] | "loading" | "error">>({});

  function toggleFailureReason(run: WorkflowRun) {
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(run.id);
    if (failedSteps[run.id]) return;
    setFailedSteps((prev) => ({ ...prev, [run.id]: "loading" }));
    fetch(`/api/workflows/${encodeURIComponent(domain)}/runs/${run.id}/jobs`)
      .then((r) => r.json())
      .then((d) => setFailedSteps((prev) => ({ ...prev, [run.id]: d.failedSteps ?? [] })))
      .catch(() => setFailedSteps((prev) => ({ ...prev, [run.id]: "error" })));
  }

  const workflowCounts: Record<string, number> = {};
  for (const run of runs) {
    workflowCounts[run.workflowName] = (workflowCounts[run.workflowName] ?? 0) + 1;
  }

  const filteredRuns = runs
    .filter((r) => filterWorkflow === "all" || r.workflowName === filterWorkflow)
    .filter((r) => filterEnv === "all" || r.env === filterEnv)
    .filter((r) => filterProvider === "all" || r.provider === filterProvider);

  return (
    <>
      {/* Env / provider filter chips */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
          {(["all", "production", "staging"] as const).map((env) => (
            <button
              key={env}
              onClick={() => setFilterEnv(env)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all capitalize ${
                filterEnv === env ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {env}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
          {(["all", "aws", "ceph"] as const).map((provider) => (
            <button
              key={provider}
              onClick={() => setFilterProvider(provider)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all capitalize ${
                filterProvider === provider ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {provider}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterWorkflow("all")}
          className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
            filterWorkflow === "all"
              ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent"
              : "bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400"
          }`}
        >
          All ({runs.length})
        </button>
        {Object.entries(workflowCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => (
            <button
              key={name}
              onClick={() => setFilterWorkflow(name)}
              className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                filterWorkflow === name
                  ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent"
                  : "bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400"
              }`}
            >
              {name} ({count})
            </button>
          ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5"></th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Workflow</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400">Title</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Branch</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Actor</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Duration</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Updated</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredRuns.map((run) => {
                const failed = isFailedRun(run);
                const expanded = expandedRunId === run.id;
                const steps = failedSteps[run.id];
                return (
                  <Fragment key={run.id}>
                    <tr
                      onClick={failed ? () => toggleFailureReason(run) : undefined}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 ${failed ? "cursor-pointer" : ""}`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {failed && (
                          expanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 max-w-[260px]">
                          <span className="truncate min-w-0" title={run.workflowName}>{run.workflowName}</span>
                          {run.env !== "other" && <EnvTag env={run.env} />}
                          {run.provider !== "other" && <ProviderTag provider={run.provider} />}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <WorkflowStatusBadge status={run.status} conclusion={run.conclusion} />
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[280px] truncate" title={run.displayTitle}>
                        {run.displayTitle}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{run.branch}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{run.actor ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDuration(run.durationSeconds)}</td>
                      <td className="px-3 py-2 text-slate-400 dark:text-slate-500 whitespace-nowrap">{timeAgo(run.updatedAt)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <a
                          href={run.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                    {failed && expanded && (
                      <tr className="bg-red-50/50 dark:bg-red-900/10">
                        <td></td>
                        <td colSpan={8} className="px-3 py-2.5 text-[12px]">
                          {steps === "loading" && (
                            <span className="flex items-center gap-1.5 text-slate-400"><Loader2 className="h-3 w-3 animate-spin" />Loading failure detail…</span>
                          )}
                          {steps === "error" && <span className="text-red-600 dark:text-red-400">Couldn&apos;t load failure detail.</span>}
                          {Array.isArray(steps) && steps.length === 0 && (
                            <span className="text-slate-400 dark:text-slate-500">No failed step detail available for this run.</span>
                          )}
                          {Array.isArray(steps) && steps.length > 0 && (
                            <ul className="flex flex-col gap-1">
                              {steps.map((s, i) => (
                                <li key={i} className="flex items-center gap-2 text-red-700 dark:text-red-300">
                                  <span className="font-medium">{s.jobName}</span>
                                  <span className="text-red-300 dark:text-red-700">›</span>
                                  <span>{s.stepName}</span>
                                  <a href={s.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
