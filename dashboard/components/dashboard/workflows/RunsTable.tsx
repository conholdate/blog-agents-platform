"use client";

import { useState, Fragment } from "react";
import { Loader2, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { EnvTag, ProviderTag, TriggerTag } from "./DeployTag";
import { formatClockTime, formatDelay, formatDuration, formatScheduleTime, formatScheduleTimeUtc } from "@/lib/format-time";
import { matchesStatusFilter, optionalRunColumns, runOutcome, type FailedStep, type RunStatusFilter } from "@/lib/workflows/workflows";
import type { WorkflowRun } from "./Workflows";

function isFailedRun(run: WorkflowRun): boolean {
  return runOutcome(run.status, run.conclusion) === "failed";
}

const STATUS_OPTIONS: { value: RunStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "success", label: "Success" },
  { value: "other", label: "Other" },
];

const ENV_OPTIONS = [
  { value: "all", label: "All" },
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
] as const;

const PROVIDER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "aws", label: "AWS" },
  { value: "ceph", label: "Ceph" },
] as const;

function FilterGroup<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              value === option.value ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {option.label}{option.count != null && ` (${option.count})`}
          </button>
        ))}
      </div>
    </div>
  );
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

type FailedStepsState = FailedStep[] | "loading" | "error";

function DurationBar({ seconds, longest, className }: { seconds: number; longest: number; className: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden ${className}`} aria-hidden="true">
      <div className="h-full rounded-full bg-slate-400 dark:bg-slate-400" style={{ width: `${Math.max(2, (seconds / longest) * 100)}%` }} />
    </div>
  );
}

function FailureDetail({ steps }: { steps: FailedStepsState | undefined }) {
  return (
    <>
      {steps === "loading" && (
        <span className="flex items-center gap-1.5 text-slate-500"><Loader2 className="h-3 w-3 animate-spin" />Loading failure detail…</span>
      )}
      {steps === "error" && <span className="text-red-600 dark:text-red-400">Couldn&apos;t load failure detail.</span>}
      {Array.isArray(steps) && steps.length === 0 && (
        <span className="text-slate-500 dark:text-slate-400">No failed step detail available for this run.</span>
      )}
      {Array.isArray(steps) && steps.length > 0 && (
        <ul className="flex flex-col gap-1">
          {steps.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-2 text-red-700 dark:text-red-300">
              <span className="font-medium">{s.jobName}</span>
              <span className="text-red-300 dark:text-red-700">›</span>
              <span>{s.stepName}</span>
              <a href={s.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label="Open failed job on GitHub" className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300">
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface Props {
  domain: string;
  runs: WorkflowRun[];
}

// The status/env/provider + workflow filter chips and the run history table, including
// on-demand failure-reason lookup for a clicked failed run. Owns its own filter
// and expand state since none of it needs to be visible to the rest of the
// CI/CD Status screen.
export function RunsTable({ domain, runs }: Props) {
  const [filterWorkflow, setFilterWorkflow] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<RunStatusFilter>("all");
  const [filterEnv, setFilterEnv] = useState<"all" | "production" | "staging">("all");
  const [filterProvider, setFilterProvider] = useState<"all" | "aws" | "ceph">("all");
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [failedSteps, setFailedSteps] = useState<Record<number, FailedStepsState>>({});

  function toggleFailureReason(run: WorkflowRun) {
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(run.id);
    if (failedSteps[run.id]) return;
    setFailedSteps((prev) => ({ ...prev, [run.id]: "loading" }));
    fetch(`/api/workflows/${encodeURIComponent(domain)}/runs/${run.id}/jobs`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load failure detail (${r.status})`);
        return r.json();
      })
      .then((d) => setFailedSteps((prev) => ({ ...prev, [run.id]: d.failedSteps ?? [] })))
      .catch(() => setFailedSteps((prev) => ({ ...prev, [run.id]: "error" })));
  }

  const workflowCounts: Record<string, number> = {};
  for (const run of runs) {
    workflowCounts[run.workflowName] = (workflowCounts[run.workflowName] ?? 0) + 1;
  }

  const matchesWorkflow = (r: WorkflowRun) => filterWorkflow === "all" || r.workflowName === filterWorkflow;
  const matchesStatus = (r: WorkflowRun) => matchesStatusFilter(r.status, r.conclusion, filterStatus);
  const matchesDeploy = (r: WorkflowRun) =>
    (filterEnv === "all" || r.env === filterEnv) && (filterProvider === "all" || r.provider === filterProvider);

  const filteredRuns = runs.filter((r) => matchesWorkflow(r) && matchesStatus(r) && matchesDeploy(r));

  // Each count answers "how many rows would I get if I picked this?", so it applies
  // every other active filter but not its own.
  const statusPool = runs.filter((r) => matchesWorkflow(r) && matchesDeploy(r));
  const statusOptions = STATUS_OPTIONS.map((option) => ({
    ...option,
    count: statusPool.filter((r) => matchesStatusFilter(r.status, r.conclusion, option.value)).length,
  }));
  const workflowPool = runs.filter((r) => matchesStatus(r) && matchesDeploy(r));

  function clearFilters() {
    setFilterWorkflow("all");
    setFilterStatus("all");
    setFilterEnv("all");
    setFilterProvider("all");
  }

  const columns = optionalRunColumns(runs);
  // Workflow, Trigger, Status, Comment, Duration, Started, Updated and the link column are always shown.
  const detailColSpan = 8 + Number(columns.title) + Number(columns.branch);
  // Scaled to the rows on screen, so the bars compare whatever the filters left showing.
  const longestDuration = Math.max(1, ...filteredRuns.map((r) => r.durationSeconds ?? 0));

  return (
    <>
      {/* Status / env / provider filters */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <FilterGroup label="Status" options={statusOptions} value={filterStatus} onChange={setFilterStatus} />
        <FilterGroup label="Environment" options={ENV_OPTIONS} value={filterEnv} onChange={setFilterEnv} />
        <FilterGroup label="Provider" options={PROVIDER_OPTIONS} value={filterProvider} onChange={setFilterProvider} />
      </div>

      {/* Workflow filter chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setFilterWorkflow("all")}
          aria-pressed={filterWorkflow === "all"}
          className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
            filterWorkflow === "all"
              ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent"
              : "bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400"
          }`}
        >
          All ({workflowPool.length})
        </button>
        {/* Sorted by the unfiltered counts so chips don't reorder as filters change. */}
        {Object.entries(workflowCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => (
            <button
              key={name}
              onClick={() => setFilterWorkflow(name)}
              aria-pressed={filterWorkflow === name}
              className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                filterWorkflow === name
                  ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent"
                  : "bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400"
              }`}
            >
              {name} ({workflowPool.filter((r) => r.workflowName === name).length})
            </button>
          ))}
      </div>

      <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
        Showing {filteredRuns.length} of the latest {runs.length} runs
      </p>

      {/* Stacked runs, below the width where every table column fits without scrolling */}
      <div className="min-[1280px]:hidden grid grid-cols-1 md:grid-cols-2 items-start gap-2">
        {filteredRuns.length === 0 && (
          <div className="md:col-span-2 px-3 py-10 text-center text-[13px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400">
            No runs match these filters.{" "}
            <button onClick={clearFilters} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              Clear filters
            </button>
          </div>
        )}
        {filteredRuns.map((run) => {
          const failed = isFailedRun(run);
          const expanded = expandedRunId === run.id;
          return (
            <div
              key={run.id}
              className={`flex flex-col gap-2 p-3 text-[12px] border rounded-xl shadow-sm ${failed
                ? "bg-red-50/60 dark:bg-red-900/10 border-red-200 dark:border-red-900"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 min-w-0 break-words">{run.workflowName}</span>
                <a
                  href={run.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open run on GitHub"
                  className="shrink-0 p-1 -m-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <WorkflowStatusBadge status={run.status} conclusion={run.conclusion} />
                <TriggerTag event={run.event} actor={run.actor} />
                {run.env !== "other" && <EnvTag env={run.env} />}
                {run.provider !== "other" && <ProviderTag provider={run.provider} />}
                {columns.actor && <span className="text-[11px] text-slate-500 dark:text-slate-400">{run.actor ?? "—"}</span>}
                {columns.branch && <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{run.branch}</span>}
              </div>
              {columns.title && <p className="text-slate-600 dark:text-slate-400 break-words">{run.displayTitle}</p>}
              {run.comment && <p className="text-slate-600 dark:text-slate-400 break-words">{run.comment}</p>}
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">{formatDuration(run.durationSeconds)}</span>
                {run.durationSeconds != null && <DurationBar seconds={run.durationSeconds} longest={longestDuration} className="flex-1" />}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                <div>{formatScheduleTime(run.runStartedAt)} · updated {timeAgo(run.updatedAt)}</div>
                {run.scheduledFor && (
                  <div className="text-slate-500 dark:text-slate-400">
                    Scheduled {formatClockTime(run.scheduledFor)} · {formatDelay(run.scheduledFor, run.createdAt)} late
                  </div>
                )}
              </div>
              {failed && (
                <button
                  onClick={() => toggleFailureReason(run)}
                  aria-expanded={expanded}
                  className="flex items-center gap-1 self-start py-1 text-[12px] font-medium text-red-700 dark:text-red-300"
                >
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Failure detail
                </button>
              )}
              {failed && expanded && <FailureDetail steps={failedSteps[run.id]} />}
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="hidden min-[1280px]:block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-2.5 py-2.5"></th>
                <th className="text-left px-2.5 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Workflow</th>
                <th className="text-left px-2.5 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Trigger</th>
                <th className="text-left px-2.5 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Status</th>
                <th className="text-left px-2.5 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Comment</th>
                {columns.title && <th className="text-left px-2.5 py-2.5 font-semibold text-slate-500 dark:text-slate-400">Title</th>}
                {columns.branch && <th className="text-left px-2.5 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Branch</th>}
                <th className="text-left px-2.5 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Duration</th>
                <th className="text-left px-2.5 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Started</th>
                <th className="text-left px-2.5 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Updated</th>
                <th className="px-2.5 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredRuns.length === 0 && (
                <tr>
                  <td colSpan={detailColSpan + 1} className="px-3 py-10 text-center text-slate-500 dark:text-slate-400">
                    No runs match these filters.{" "}
                    <button onClick={clearFilters} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
              {filteredRuns.map((run) => {
                const failed = isFailedRun(run);
                const expanded = expandedRunId === run.id;
                return (
                  <Fragment key={run.id}>
                    <tr
                      onClick={failed ? () => toggleFailureReason(run) : undefined}
                      className={failed
                        ? "cursor-pointer bg-red-50/60 hover:bg-red-50 dark:bg-red-900/10 dark:hover:bg-red-900/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}
                    >
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        {failed && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFailureReason(run);
                            }}
                            aria-expanded={expanded}
                            aria-label={`Failure detail for ${run.workflowName}`}
                            className="block rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </td>
                      <td className="px-2.5 py-2 font-medium text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 max-w-[260px]">
                          <span className="truncate min-w-0" title={run.workflowName}>{run.workflowName}</span>
                          {run.env !== "other" && <EnvTag env={run.env} />}
                          {run.provider !== "other" && <ProviderTag provider={run.provider} />}
                        </div>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <TriggerTag event={run.event} actor={run.actor} />
                        {columns.actor && <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{run.actor ?? "—"}</div>}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <WorkflowStatusBadge status={run.status} conclusion={run.conclusion} />
                      </td>
                      <td className="px-2.5 py-2 text-[12px] text-slate-600 dark:text-slate-400 min-w-[120px] max-w-[190px]">
                        {run.comment ?? "—"}
                      </td>
                      {columns.title && (
                        <td className="px-2.5 py-2 text-slate-600 dark:text-slate-400 max-w-[280px] truncate" title={run.displayTitle}>
                          {run.displayTitle}
                        </td>
                      )}
                      {columns.branch && <td className="px-2.5 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{run.branch}</td>}
                      <td className="px-2.5 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <div>{formatDuration(run.durationSeconds)}</div>
                        {run.durationSeconds != null && (
                          <DurationBar seconds={run.durationSeconds} longest={longestDuration} className="mt-1 w-16" />
                        )}
                      </td>
                      <td
                        className="px-2.5 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap"
                        title={[
                          run.scheduledFor && `Scheduled: ${formatScheduleTimeUtc(run.scheduledFor)}`,
                          `Started: ${formatScheduleTimeUtc(run.runStartedAt)}`,
                        ].filter(Boolean).join("\n")}
                      >
                        <div>{formatScheduleTime(run.runStartedAt)}</div>
                        {run.scheduledFor && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Scheduled {formatClockTime(run.scheduledFor)} · {formatDelay(run.scheduledFor, run.createdAt)} late
                          </div>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{timeAgo(run.updatedAt)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <a
                          href={run.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Open run on GitHub"
                          className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                    {failed && expanded && (
                      <tr className="bg-red-50/50 dark:bg-red-900/10">
                        <td></td>
                        <td colSpan={detailColSpan} className="px-2.5 py-2.5 text-[12px]">
                          <FailureDetail steps={failedSteps[run.id]} />
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
