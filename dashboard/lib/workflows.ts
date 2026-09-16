import { CronExpressionParser } from "cron-parser";
import { toString as cronToString } from "cronstrue";
import { getWorkflowsRepo, getGithubToken } from "./workflows-config";
import { getCached, setCached, TTL_WORKFLOW_SCHEDULES } from "./cache";

// Cron fields in GitHub Actions schedules are always UTC, so the description
// describes UTC clock times regardless of where this runs.
function describeCrons(crons: string[]): string {
  return crons
    .map((c) => {
      try {
        return cronToString(c, { use24HourTimeFormat: true, verbose: false });
      } catch {
        return c;
      }
    })
    .join("; ");
}

// Deploy workflows across every domain repo reliably spell out their environment
// and infra provider in the display name (e.g. "AWS Production - Pipeline", "Ceph
// Staging-2. Deploy Home Page Assets") — checked against all four workflows repos.
// Non-deploy workflows (translation scan, blog optimizer, ...) fall into "other".
export type RunEnv = "production" | "staging" | "other";
export type RunProvider = "aws" | "ceph" | "other";

function classifyEnv(workflowName: string): RunEnv {
  if (/prod/i.test(workflowName)) return "production";
  if (/stag/i.test(workflowName)) return "staging";
  return "other";
}

function classifyProvider(workflowName: string): RunProvider {
  if (/aws/i.test(workflowName)) return "aws";
  if (/ceph/i.test(workflowName)) return "ceph";
  return "other";
}

// Exposed so schedules (a separate GitHub API surface from runs) can be matched
// back to the same (env, provider) buckets a run gets classified into.
export function classifyWorkflowName(workflowName: string): { env: RunEnv; provider: RunProvider } {
  return { env: classifyEnv(workflowName), provider: classifyProvider(workflowName) };
}

export interface WorkflowRun {
  id: number;
  workflowName: string;
  displayTitle: string;
  status: string; // "queued" | "in_progress" | "completed" | "waiting"
  conclusion: string | null; // "success" | "failure" | "cancelled" | "skipped" | "timed_out" | "action_required" | null
  branch: string;
  event: string;
  actor: string | null;
  createdAt: string;
  updatedAt: string;
  runStartedAt: string;
  durationSeconds: number | null; // null until the run completes
  env: RunEnv;
  provider: RunProvider;
  htmlUrl: string;
}

export interface WorkflowRunsResult {
  runs: WorkflowRun[];
  notConfigured?: true;
}

interface RawRun {
  id: number;
  name: string | null;
  display_title: string | null;
  status: string;
  conclusion: string | null;
  head_branch: string | null;
  event: string | null;
  actor: { login?: string } | null;
  created_at: string;
  updated_at: string;
  run_started_at: string;
  html_url: string;
}

function getHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function getRecentWorkflowRuns(domain: string, perPage = 20): Promise<WorkflowRunsResult> {
  const token = getGithubToken();
  const repo = getWorkflowsRepo(domain);
  if (!token || !repo) return { runs: [], notConfigured: true };

  const res = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/runs?per_page=${perPage}`,
    { headers: getHeaders(token) }
  );

  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    const resetEpoch = Number(res.headers.get("x-ratelimit-reset") ?? 0);
    const resetTime = resetEpoch ? new Date(resetEpoch * 1000).toLocaleTimeString() : "unknown";
    throw new Error(`GitHub API rate limit exceeded, resets at ${resetTime}`);
  }
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${res.statusText}`);

  const json: { workflow_runs?: RawRun[] } = await res.json();
  const runs: WorkflowRun[] = (json.workflow_runs ?? []).map((r) => ({
    id: r.id,
    workflowName: r.name ?? "Unknown",
    displayTitle: r.display_title ?? "",
    status: r.status,
    conclusion: r.conclusion,
    branch: r.head_branch ?? "",
    event: r.event ?? "",
    actor: r.actor?.login ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    runStartedAt: r.run_started_at ?? r.created_at,
    durationSeconds: r.status === "completed"
      ? Math.max(0, Math.round((new Date(r.updated_at).getTime() - new Date(r.run_started_at ?? r.created_at).getTime()) / 1000))
      : null,
    env: classifyEnv(r.name ?? ""),
    provider: classifyProvider(r.name ?? ""),
    htmlUrl: r.html_url,
  }));

  return { runs };
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

interface RawWorkflowDef {
  name: string;
  path: string;
  state: string;
}

function earliestNextRun(crons: string[]): string | null {
  let earliest: Date | null = null;
  for (const cron of crons) {
    try {
      const next = CronExpressionParser.parse(cron, { tz: "UTC" }).next().toDate();
      if (!earliest || next < earliest) earliest = next;
    } catch {
      // Not a plain cron string GitHub Actions accepts (or a schedule we can't parse) — skip it.
    }
  }
  return earliest ? earliest.toISOString() : null;
}

// Cron schedules live only in each workflow's YAML file — GitHub's API doesn't
// surface them on the run/workflow list endpoints — so this fetches the file
// content per workflow and regex-extracts `cron:` lines rather than pulling in
// a full YAML parser for one field.
export async function getWorkflowSchedules(domain: string): Promise<WorkflowSchedule[]> {
  const token = getGithubToken();
  const repo = getWorkflowsRepo(domain);
  if (!token || !repo) return [];

  const cacheKey = `workflows:schedules:${domain}`;
  const cached = getCached<WorkflowSchedule[]>(cacheKey, TTL_WORKFLOW_SCHEDULES);
  if (cached) return cached;

  const listRes = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/workflows?per_page=100`,
    { headers: getHeaders(token) }
  );
  if (!listRes.ok) throw new Error(`GitHub API error ${listRes.status}: ${listRes.statusText}`);

  const listJson: { workflows?: RawWorkflowDef[] } = await listRes.json();
  const activeWorkflows = (listJson.workflows ?? []).filter((w) => w.state === "active");

  const schedules = await Promise.all(
    activeWorkflows.map(async (w): Promise<WorkflowSchedule> => {
      try {
        const contentRes = await fetch(
          `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${w.path}`,
          { headers: getHeaders(token) }
        );
        if (!contentRes.ok) return { workflowName: w.name, path: w.path, crons: [], description: "", nextRunAt: null, ...classifyWorkflowName(w.name) };

        const contentJson: { content?: string } = await contentRes.json();
        const yamlText = contentJson.content ? Buffer.from(contentJson.content, "base64").toString("utf-8") : "";
        const crons = [...yamlText.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

        return { workflowName: w.name, path: w.path, crons, description: describeCrons(crons), nextRunAt: earliestNextRun(crons), ...classifyWorkflowName(w.name) };
      } catch {
        return { workflowName: w.name, path: w.path, crons: [], description: "", nextRunAt: null, ...classifyWorkflowName(w.name) };
      }
    })
  );

  setCached(cacheKey, schedules);
  return schedules;
}

export interface WorkflowRunTick {
  status: string;
  conclusion: string | null;
  workflowName: string;
  updatedAt: string;
  htmlUrl: string;
}

export interface DailyRunStat {
  date: string; // YYYY-MM-DD, UTC
  success: number;
  failure: number;
  other: number; // cancelled/skipped/action_required/in-progress that day
  avgDurationSeconds: number | null;
}

export interface DeploymentLatestRun {
  status: string;
  conclusion: string | null;
  updatedAt: string;
  durationSeconds: number | null;
  workflowName: string;
  htmlUrl: string;
}

export interface DeploymentStatus {
  env: "production" | "staging";
  provider: "aws" | "ceph";
  latestRun: DeploymentLatestRun;
  successCount: number;
  failureCount: number;
}

// The single most recently-updated deployment bucket for an environment, across
// whichever provider(s) that domain deploys with (a domain may run both AWS and
// Ceph pipelines for production, e.g. blog.aspose.com).
export function latestDeployment(deployments: DeploymentStatus[], env: "production" | "staging"): DeploymentStatus | null {
  const matches = deployments.filter((d) => d.env === env);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (a.latestRun.updatedAt >= b.latestRun.updatedAt ? a : b));
}

export function deploymentFailureCount(deployments: DeploymentStatus[], env: "production" | "staging"): number {
  return deployments.filter((d) => d.env === env).reduce((sum, d) => sum + d.failureCount, 0);
}

export function buildDeployments(runs: WorkflowRun[]): DeploymentStatus[] {
  const byKey = new Map<string, DeploymentStatus>();
  // `runs` is newest-first (GitHub API default), so the first run seen per
  // (env, provider) key is already that bucket's latest.
  for (const r of runs) {
    if (r.env === "other" || r.provider === "other") continue;
    const key = `${r.env}:${r.provider}`;
    const isSuccess = r.status === "completed" && r.conclusion === "success";
    const isFailure = r.status === "completed" && (r.conclusion === "failure" || r.conclusion === "timed_out");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        env: r.env as "production" | "staging",
        provider: r.provider as "aws" | "ceph",
        latestRun: { status: r.status, conclusion: r.conclusion, updatedAt: r.updatedAt, durationSeconds: r.durationSeconds, workflowName: r.workflowName, htmlUrl: r.htmlUrl },
        successCount: isSuccess ? 1 : 0,
        failureCount: isFailure ? 1 : 0,
      });
    } else {
      if (isSuccess) existing.successCount++;
      else if (isFailure) existing.failureCount++;
    }
  }
  return Array.from(byKey.values()).sort((a, b) => {
    if (a.env !== b.env) return a.env === "production" ? -1 : 1;
    return a.provider.localeCompare(b.provider);
  });
}

export interface WorkflowsSummary {
  repo: string;
  latestRun: { workflowName: string; status: string; conclusion: string | null; updatedAt: string; htmlUrl: string } | null;
  successCount: number;
  failureCount: number;
  inProgressCount: number;
  avgDurationSeconds: number | null;
  // Per (environment, provider) combo actually seen in the recent run window —
  // e.g. Production/AWS, Production/Ceph, Staging/Ceph.
  deployments: DeploymentStatus[];
  // Oldest → newest, for a left-to-right timeline strip.
  recentRuns: WorkflowRunTick[];
  // Oldest → newest, zero-filled, for a calendar-style daily bar strip.
  dailyStats: DailyRunStat[];
  nextScheduledRun: { workflowName: string; nextRunAt: string; description: string } | null;
}

const DAILY_STATS_WINDOW_DAYS = 14;
// Wide enough to cover DAILY_STATS_WINDOW_DAYS for domains that run CI a few times a day.
const SUMMARY_RUNS_PAGE_SIZE = 40;

export function buildDailyStats(runs: WorkflowRun[], days = DAILY_STATS_WINDOW_DAYS): DailyRunStat[] {
  const byDate = new Map<string, { success: number; failure: number; other: number; durations: number[] }>();
  for (const r of runs) {
    const date = r.createdAt.slice(0, 10); // YYYY-MM-DD, UTC (ISO strings from GitHub are UTC)
    const bucket = byDate.get(date) ?? { success: 0, failure: 0, other: 0, durations: [] };
    if (r.status === "in_progress" || r.status === "queued" || r.status === "waiting") bucket.other++;
    else if (r.conclusion === "success") bucket.success++;
    else if (r.conclusion === "failure" || r.conclusion === "timed_out") bucket.failure++;
    else bucket.other++;
    if (r.durationSeconds != null) bucket.durations.push(r.durationSeconds);
    byDate.set(date, bucket);
  }

  const stats: DailyRunStat[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const date = d.toISOString().slice(0, 10);
    const bucket = byDate.get(date);
    stats.push({
      date,
      success: bucket?.success ?? 0,
      failure: bucket?.failure ?? 0,
      other: bucket?.other ?? 0,
      avgDurationSeconds: bucket && bucket.durations.length > 0
        ? Math.round(bucket.durations.reduce((a, b) => a + b, 0) / bucket.durations.length)
        : null,
    });
  }
  return stats;
}

export async function getWorkflowsSummary(domain: string): Promise<WorkflowsSummary | { notConfigured: true }> {
  const repo = getWorkflowsRepo(domain);
  if (!getGithubToken() || !repo) return { notConfigured: true };

  const [{ runs }, schedules] = await Promise.all([
    getRecentWorkflowRuns(domain, SUMMARY_RUNS_PAGE_SIZE),
    getWorkflowSchedules(domain),
  ]);

  let successCount = 0, failureCount = 0, inProgressCount = 0;
  const durations: number[] = [];
  for (const r of runs) {
    if (r.status === "in_progress" || r.status === "queued" || r.status === "waiting") inProgressCount++;
    else if (r.conclusion === "success") successCount++;
    else if (r.conclusion === "failure" || r.conclusion === "timed_out") failureCount++;
    if (r.durationSeconds != null) durations.push(r.durationSeconds);
  }
  const avgDurationSeconds = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  const latest = runs[0] ?? null;

  let nextScheduledRun: { workflowName: string; nextRunAt: string; description: string } | null = null;
  for (const s of schedules) {
    if (s.nextRunAt && (!nextScheduledRun || s.nextRunAt < nextScheduledRun.nextRunAt)) {
      nextScheduledRun = { workflowName: s.workflowName, nextRunAt: s.nextRunAt, description: s.description };
    }
  }

  return {
    repo: `${repo.owner}/${repo.repo}`,
    latestRun: latest ? { workflowName: latest.workflowName, status: latest.status, conclusion: latest.conclusion, updatedAt: latest.updatedAt, htmlUrl: latest.htmlUrl } : null,
    successCount,
    failureCount,
    inProgressCount,
    avgDurationSeconds,
    deployments: buildDeployments(runs),
    recentRuns: runs
      .slice(0, 12)
      .reverse()
      .map((r) => ({ status: r.status, conclusion: r.conclusion, workflowName: r.workflowName, updatedAt: r.updatedAt, htmlUrl: r.htmlUrl })),
    dailyStats: buildDailyStats(runs),
    nextScheduledRun,
  };
}

export interface FailedStep {
  jobName: string;
  stepName: string;
  htmlUrl: string;
}

interface RawJobStep {
  name: string;
  status: string;
  conclusion: string | null;
}

interface RawJob {
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  steps?: RawJobStep[];
}

// Run-level status has no failure reason — GitHub only exposes that on the job/step
// breakdown, which is a separate API call per run. Fetched on demand (when a user
// expands a failed run) rather than eagerly, to keep the summary/runs list cheap.
export async function getFailedSteps(domain: string, runId: number): Promise<FailedStep[]> {
  const token = getGithubToken();
  const repo = getWorkflowsRepo(domain);
  if (!token || !repo) return [];

  const cacheKey = `workflows:jobs:${domain}:${runId}`;
  const cached = getCached<FailedStep[]>(cacheKey, TTL_WORKFLOW_SCHEDULES);
  if (cached) return cached;

  const res = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/runs/${runId}/jobs`,
    { headers: getHeaders(token) }
  );
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${res.statusText}`);

  const json: { jobs?: RawJob[] } = await res.json();
  const failedSteps: FailedStep[] = [];
  for (const job of json.jobs ?? []) {
    if (job.conclusion !== "failure" && job.conclusion !== "timed_out") continue;
    const failedStep = (job.steps ?? []).find((s) => s.conclusion === "failure" || s.conclusion === "timed_out");
    failedSteps.push({ jobName: job.name, stepName: failedStep?.name ?? "Unknown step", htmlUrl: job.html_url });
  }

  // A completed run's job/step outcomes never change, so this can cache well past TTL_WORKFLOWS.
  setCached(cacheKey, failedSteps);
  return failedSteps;
}
