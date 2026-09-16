"use client";

import { useState, useEffect } from "react";
import { Loader2, ExternalLink, RefreshCw, GitBranch } from "lucide-react";
import { DailyRunsChart, formatDuration } from "./DailyRunsChart";
import { DeploymentCards } from "./DeploymentCards";
import { ScheduledWorkflowsList } from "./ScheduledWorkflowsList";
import { RunsTable } from "./RunsTable";
import type { DailyRunStat, DeploymentStatus, RunEnv, RunProvider } from "@/lib/workflows/workflows";

export interface WorkflowRun {
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

export interface WorkflowSchedule {
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

interface Props {
  domain: string;
}

export function Workflows({ domain }: Props) {
  const [data, setData] = useState<RunsResponse | null>(null);
  const [schedules, setSchedules] = useState<SchedulesResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
    load(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

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

      {summary && !summary.notConfigured && !summary.error && (
        <DeploymentCards deployments={summary.deployments} schedulesByDeployment={schedulesByDeployment} />
      )}

      <ScheduledWorkflowsList schedules={otherScheduledWorkflows} />

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
        <RunsTable domain={domain} runs={data.runs} />
      )}
    </div>
  );
}
