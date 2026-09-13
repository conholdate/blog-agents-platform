"use client";

import { useState, useEffect, Fragment } from "react";
import { Loader2, ExternalLink, RefreshCw, GitBranch, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { DailyRunsChart, formatDuration } from "./DailyRunsChart";
import { EnvTag, ProviderTag } from "./DeployTag";
import { formatScheduleTime } from "@/lib/format-time";
import type { DailyRunStat, FailedStep, DeploymentStatus, RunEnv, RunProvider } from "@/lib/workflows";

interface WorkflowRun {
  id: number;
  workflowName: string;
  displayTitle: string;
  status: string;
  conclusion: string | null;
  branch: string;
  event: string;
  actor: string | null;
  createdAt: string;
  updatedAt: string;
  durationSeconds: number | null;
  env: RunEnv;
  provider: RunProvider;
  htmlUrl: string;
}

interface RunsResponse {
  runs: WorkflowRun[];
  repo?: string | null;
  notConfigured?: true;
  error?: string;
}

interface WorkflowSchedule {
  workflowName: string;
  path: string;
  crons: string[];
  description: string;
  nextRunAt: string | null;
  env: RunEnv;
  provider: RunProvider;
}

interface SchedulesResponse {
  schedules: WorkflowSchedule[];
  notConfigured?: true;
  error?: string;
}

interface SummaryResponse {
  avgDurationSeconds: number | null;
  dailyStats: DailyRunStat[];
  deployments: DeploymentStatus[];
  notConfigured?: true;
  error?: string;
}

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
  domain: string;
}

export function Workflows({ domain }: Props) {
  const [data, setData] = useState<RunsResponse | null>(null);
  const [schedules, setSchedules] = useState<SchedulesResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterWorkflow, setFilterWorkflow] = useState<string>("all");
  const [filterEnv, setFilterEnv] = useState<"all" | "production" | "staging">("all");
  const [filterProvider, setFilterProvider] = useState<"all" | "aws" | "ceph">("all");
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [failedSteps, setFailedSteps] = useState<Record<number, FailedStep[] | "loading" | "error">>({});

  const base = `/api/workflows/${encodeURIComponent(domain)}/runs`;
  const schedulesBase = `/api/workflows/${encodeURIComponent(domain)}/schedules`;
  const summaryBase = `/api/workflows/${encodeURIComponent(domain)}/summary`;

  function load(forceRefresh = false) {
    setLoading(true);
    const url = forceRefresh ? `${base}?refresh=1` : base;
    fetch(url)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setData({ runs: [], error: e.message }))
      .finally(() => setLoading(false));

    fetch(forceRefresh ? `${schedulesBase}?refresh=1` : schedulesBase)
      .then((r) => r.json())
      .then(setSchedules)
      .catch((e) => setSchedules({ schedules: [], error: e.message }));

    fetch(forceRefresh ? `${summaryBase}?refresh=1` : summaryBase)
      .then((r) => r.json())
      .then(setSummary)
      .catch((e) => setSummary({ avgDurationSeconds: null, dailyStats: [], deployments: [], error: e.message }));
  }

  useEffect(() => {
    setData(null);
    setSchedules(null);
    setSummary(null);
    setFilterWorkflow("all");
    setFilterEnv("all");
    setFilterProvider("all");
    setExpandedRunId(null);
    setFailedSteps({});
    load(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

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

  const scheduledWorkflows = (schedules?.schedules ?? [])
    .filter((s) => s.nextRunAt)
    .sort((a, b) => (a.nextRunAt! < b.nextRunAt! ? -1 : 1));

  // A deployment card already names its (env, provider) and its most recent run —
  // fold each schedule's "next run" into the matching card instead of repeating
  // the same workflow identity in a separate list below.
  const deploymentKeys = new Set((summary?.deployments ?? []).map((d) => `${d.env}:${d.provider}`));
  const schedulesByDeployment = new Map<string, WorkflowSchedule[]>();
  const otherScheduledWorkflows: WorkflowSchedule[] = [];
  for (const s of scheduledWorkflows) {
    const key = `${s.env}:${s.provider}`;
    if (s.env !== "other" && s.provider !== "other" && deploymentKeys.has(key)) {
      if (!schedulesByDeployment.has(key)) schedulesByDeployment.set(key, []);
      schedulesByDeployment.get(key)!.push(s);
    } else {
      otherScheduledWorkflows.push(s);
    }
  }

  const workflowCounts: Record<string, number> = {};
  for (const run of data?.runs ?? []) {
    workflowCounts[run.workflowName] = (workflowCounts[run.workflowName] ?? 0) + 1;
  }

  const filteredRuns = (data?.runs ?? [])
    .filter((r) => filterWorkflow === "all" || r.workflowName === filterWorkflow)
    .filter((r) => filterEnv === "all" || r.env === filterEnv)
    .filter((r) => filterProvider === "all" || r.provider === filterProvider);

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">CI/CD Status</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Recent GitHub Actions runs for{" "}
            {data?.repo ? (
              <a
                href={`https://github.com/${data.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
              >
                {data.repo}
              </a>
            ) : (
              <span className="font-medium text-slate-700 dark:text-slate-300">{domain}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data?.repo && (
            <a
              href={`https://github.com/${data.repo}/actions`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] font-medium text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View all on GitHub
            </a>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading}
            title="Refresh"
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Deployment status */}
      {summary && !summary.notConfigured && !summary.error && summary.deployments.length > 0 && (
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {summary.deployments.map((d) => {
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
      )}

      {/* Scheduled workflows — deploy schedules are folded into the cards above; this
          list is what's left over (non-deploy jobs like translation scans, or a
          schedule for a workflow that hasn't actually run recently). */}
      {otherScheduledWorkflows.length > 0 && (
        <div className="mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">Scheduled Workflows</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {otherScheduledWorkflows.map((s) => (
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
      )}

      {/* Daily runs */}
      {summary && !summary.notConfigured && !summary.error && summary.dailyStats.length > 0 && (
        <div className="mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">Daily Runs (last {summary.dailyStats.length} days)</span>
            {summary.avgDurationSeconds != null && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Avg build time <span className="font-medium text-slate-600 dark:text-slate-300">{formatDuration(summary.avgDurationSeconds)}</span>
              </span>
            )}
          </div>
          <DailyRunsChart stats={summary.dailyStats} variant="full" />
        </div>
      )}

      {/* Not configured */}
      {data?.notConfigured && (
        <div className="mb-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium mb-1">GitHub token not configured</p>
          <p className="text-amber-700 dark:text-amber-400">
            Set GITHUB_READONLY_TOKEN in dashboard/.env.local (a classic PAT with the &quot;repo&quot; scope, or a fine-grained PAT with Actions: Read-only access) to see workflow run statuses here.
          </p>
        </div>
      )}

      {/* Error */}
      {data?.error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          {data.error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading workflow runs…</span>
        </div>
      )}

      {/* Empty */}
      {data && !data.notConfigured && !data.error && data.runs.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center text-slate-400 dark:text-slate-500">
          <GitBranch className="h-10 w-10" />
          <p className="text-base font-medium text-slate-600 dark:text-slate-400">No workflow runs found</p>
        </div>
      )}

      {/* Results */}
      {data && !data.notConfigured && !data.error && data.runs.length > 0 && (
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
              All ({data.runs.length})
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
      )}
    </div>
  );
}
