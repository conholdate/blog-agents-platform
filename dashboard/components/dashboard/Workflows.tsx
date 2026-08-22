"use client";

import { useState, useEffect } from "react";
import { Loader2, ExternalLink, RefreshCw, GitBranch, Clock } from "lucide-react";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { formatScheduleTime } from "@/lib/format-time";

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
}

interface SchedulesResponse {
  schedules: WorkflowSchedule[];
  notConfigured?: true;
  error?: string;
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
  const [loading, setLoading] = useState(true);
  const [filterWorkflow, setFilterWorkflow] = useState<string>("all");

  const base = `/api/workflows/${encodeURIComponent(domain)}/runs`;
  const schedulesBase = `/api/workflows/${encodeURIComponent(domain)}/schedules`;

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
  }

  useEffect(() => {
    setData(null);
    setSchedules(null);
    setFilterWorkflow("all");
    load(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const scheduledWorkflows = (schedules?.schedules ?? [])
    .filter((s) => s.nextRunAt)
    .sort((a, b) => (a.nextRunAt! < b.nextRunAt! ? -1 : 1));

  const workflowCounts: Record<string, number> = {};
  for (const run of data?.runs ?? []) {
    workflowCounts[run.workflowName] = (workflowCounts[run.workflowName] ?? 0) + 1;
  }

  const filteredRuns = filterWorkflow === "all"
    ? (data?.runs ?? [])
    : (data?.runs ?? []).filter((r) => r.workflowName === filterWorkflow);

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

      {/* Scheduled workflows */}
      {scheduledWorkflows.length > 0 && (
        <div className="mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">Scheduled Workflows</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {scheduledWorkflows.map((s) => (
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
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Workflow</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Status</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400">Title</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Branch</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Actor</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Updated</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{run.workflowName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <WorkflowStatusBadge status={run.status} conclusion={run.conclusion} />
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[280px] truncate" title={run.displayTitle}>
                        {run.displayTitle}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{run.branch}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{run.actor ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-400 dark:text-slate-500 whitespace-nowrap">{timeAgo(run.updatedAt)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <a
                          href={run.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
