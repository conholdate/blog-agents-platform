import { CronExpressionParser } from "cron-parser";
import { toString as cronToString } from "cronstrue";
import { getWorkflowsRepo, getGithubToken } from "./workflows-config";
import { getCached, setCached, TTL_WORKFLOW_SCHEDULES } from "../cache";

const GMT5_OFFSET_HOURS = 5;

// Cron fields in GitHub Actions schedules are always UTC, and cronstrue no longer
// supports a timezone offset, so the hour is shifted before describing it. Returns
// null when a shift isn't a simple hour change: a step or list in the hour field,
// or a time that crosses midnight on a schedule restricted to certain days.
function cronToGmt5(cron: string): string | null {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.trim().split(/\s+/);
  if (!/^\d+$/.test(hour)) return null;
  const shifted = Number(hour) + GMT5_OFFSET_HOURS;
  if (shifted >= 24 && (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*")) return null;
  return [minute, shifted % 24, dayOfMonth, month, dayOfWeek].join(" ");
}

export function describeCrons(crons: string[]): string {
  return crons
    .map((c) => {
      try {
        const gmt5 = cronToGmt5(c);
        const options = { use24HourTimeFormat: true, verbose: false };
        return gmt5 ? `${cronToString(gmt5, options)} (GMT+5)` : `${cronToString(c, options)} (UTC)`;
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
  scheduledFor?: string | null; // the cron time a scheduled run belongs to, when known
  comment?: string | null; // what the run actually did, derived from its jobs; see describeRun
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

// GitHub doesn't record which cron time a run belongs to, and often starts scheduled
// runs hours late. The latest cron time at or before the trigger is that run's slot.
function latestCronSlot(crons: string[], triggeredAt: string): string | null {
  let latest: Date | null = null;
  for (const cron of crons) {
    try {
      const slot = CronExpressionParser.parse(cron, { tz: "UTC", currentDate: triggeredAt }).prev().toDate();
      if (!latest || slot > latest) latest = slot;
    } catch {
      // Same as earliestNextRun: a schedule we can't parse just gets no slot.
    }
  }
  return latest ? latest.toISOString() : null;
}

export function withScheduledSlots(runs: WorkflowRun[], schedules: WorkflowSchedule[]): WorkflowRun[] {
  const cronsByWorkflow = new Map(schedules.map((s) => [s.workflowName, s.crons]));
  return runs.map((r) => {
    const crons = r.event === "schedule" ? cronsByWorkflow.get(r.workflowName) : undefined;
    return crons?.length ? { ...r, scheduledFor: latestCronSlot(crons, r.createdAt) } : r;
  });
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

// The one deployment to summarize an environment with, across whichever provider(s)
// that domain deploys with (a domain may run both AWS and Ceph pipelines for production,
// e.g. blog.aspose.com). A failing deploy wins over a newer healthy one, otherwise a
// failing Ceph deploy could hide behind an AWS run that merely finished more recently.
export function headlineDeployment(deployments: DeploymentStatus[], env: "production" | "staging"): DeploymentStatus | null {
  const matches = deployments.filter((d) => d.env === env);
  const failing = matches.filter((d) => runOutcome(d.latestRun.status, d.latestRun.conclusion) === "failed");
  const candidates = failing.length > 0 ? failing : matches;
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a.latestRun.updatedAt >= b.latestRun.updatedAt ? a : b));
}

export function deploymentFailureCount(deployments: DeploymentStatus[], env: "production" | "staging"): number {
  return deployments.filter((d) => d.env === env).reduce((sum, d) => sum + d.failureCount, 0);
}

export type RunOutcome = "success" | "failed" | "running" | "attention" | "neutral";

// Green is reserved for an actual success: a cancelled or skipped latest run says
// nothing about whether the deploy is healthy, so it must not read as passing.
export function runOutcome(status: string, conclusion: string | null): RunOutcome {
  if (status !== "completed") return "running";
  switch (conclusion) {
    case "success":
      return "success";
    case "failure":
    case "timed_out":
    case "startup_failure":
      return "failed";
    case "action_required":
      return "attention";
    default:
      return "neutral";
  }
}

export type RunStatusFilter = "all" | "failed" | "running" | "success" | "other";

export function matchesStatusFilter(status: string, conclusion: string | null, filter: RunStatusFilter): boolean {
  if (filter === "all") return true;
  const outcome = runOutcome(status, conclusion);
  if (filter === "other") return outcome === "attention" || outcome === "neutral";
  return outcome === filter;
}

// Scheduled runs repeat the workflow name as their title, and most repos have one
// branch and one actor, so these columns only earn their width when they differ.
// Decided from the unfiltered runs so columns don't appear and vanish as filters change.
export function optionalRunColumns(runs: Pick<WorkflowRun, "workflowName" | "displayTitle" | "branch" | "actor">[]): { title: boolean; branch: boolean; actor: boolean } {
  return {
    title: runs.some((r) => r.displayTitle !== r.workflowName),
    branch: new Set(runs.map((r) => r.branch)).size > 1,
    actor: new Set(runs.map((r) => r.actor)).size > 1,
  };
}

export function buildDeployments(runs: WorkflowRun[]): DeploymentStatus[] {
  const byKey = new Map<string, DeploymentStatus>();
  // `runs` is newest-first (GitHub API default), so the first run seen per
  // (env, provider) key is already that bucket's latest.
  for (const r of runs) {
    if (r.env === "other" || r.provider === "other") continue;
    const key = `${r.env}:${r.provider}`;
    const isSuccess = r.status === "completed" && r.conclusion === "success";
    const isFailure = runOutcome(r.status, r.conclusion) === "failed";
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
export const SUMMARY_RUNS_PAGE_SIZE = 40;

export function buildDailyStats(runs: WorkflowRun[], days = DAILY_STATS_WINDOW_DAYS): DailyRunStat[] {
  const byDate = new Map<string, { success: number; failure: number; other: number; durations: number[] }>();
  for (const r of runs) {
    const date = r.createdAt.slice(0, 10); // YYYY-MM-DD, UTC (ISO strings from GitHub are UTC)
    const bucket = byDate.get(date) ?? { success: 0, failure: 0, other: 0, durations: [] };
    if (r.status === "in_progress" || r.status === "queued" || r.status === "waiting") bucket.other++;
    else if (r.conclusion === "success") bucket.success++;
    else if (runOutcome(r.status, r.conclusion) === "failed") bucket.failure++;
    else bucket.other++;
    if (r.durationSeconds != null && r.conclusion !== "skipped") bucket.durations.push(r.durationSeconds);
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

  const [{ runs: recentRuns }, schedules] = await Promise.all([
    getRecentWorkflowRuns(domain, SUMMARY_RUNS_PAGE_SIZE),
    getWorkflowSchedules(domain),
  ]);
  const runs = await withRunComments(domain, recentRuns);

  let successCount = 0, failureCount = 0, inProgressCount = 0;
  const durations: number[] = [];
  for (const r of runs) {
    if (r.status === "in_progress" || r.status === "queued" || r.status === "waiting") inProgressCount++;
    else if (r.conclusion === "success") successCount++;
    else if (runOutcome(r.status, r.conclusion) === "failed") failureCount++;
    if (r.durationSeconds != null && r.conclusion !== "skipped") durations.push(r.durationSeconds);
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

// Run-level status says nothing about what a run did or why it failed — GitHub only
// exposes that on the job/step breakdown, which is a separate API call per run. Only
// call this for completed runs: their outcomes never change, so this can cache well
// past TTL_WORKFLOWS, and each new run costs a single call.
async function getRunJobs(domain: string, runId: number): Promise<RawJob[]> {
  const token = getGithubToken();
  const repo = getWorkflowsRepo(domain);
  if (!token || !repo) return [];

  const cacheKey = `workflows:jobs:${domain}:${runId}`;
  const cached = getCached<RawJob[]>(cacheKey, TTL_WORKFLOW_SCHEDULES);
  if (cached) return cached;

  const res = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/runs/${runId}/jobs?per_page=100`,
    { headers: getHeaders(token) }
  );
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${res.statusText}`);

  const json: { jobs?: RawJob[] } = await res.json();
  const jobs = json.jobs ?? [];
  setCached(cacheKey, jobs);
  return jobs;
}

export async function getFailedSteps(domain: string, runId: number): Promise<FailedStep[]> {
  const failedSteps: FailedStep[] = [];
  for (const job of await getRunJobs(domain, runId)) {
    if (job.conclusion !== "failure" && job.conclusion !== "timed_out") continue;
    const failedStep = (job.steps ?? []).find((s) => s.conclusion === "failure" || s.conclusion === "timed_out");
    failedSteps.push({ jobName: job.name, stepName: failedStep?.name ?? "Unknown step", htmlUrl: job.html_url });
  }
  return failedSteps;
}

// Job and step names the deploy workflows in each domain's repo use. If those YAMLs
// rename them, no-change runs fall back to reading as plain "Deployed".
const CHECK_CHANGES_JOB = "check-changes";
const LAST_ATTEMPT_STEP = "Find last deploy attempt";

const NO_CHANGES_COMMENT = "Skipped - No changes found";
const DEPLOYED_COMMENT = "Deployed";

function isDeployWorkflow(workflowName: string): boolean {
  return classifyEnv(workflowName) !== "other" || /deploy/i.test(workflowName);
}

// GitHub reports a run that found nothing to deploy as a plain "success", the same as
// a real deploy, so the difference can only be read from which jobs actually ran.
export function describeRun(workflowName: string, conclusion: string | null, jobs: Pick<RawJob, "name" | "conclusion">[]): string | null {
  const stoppedAt = (jobConclusion: string) => jobs.find((j) => j.conclusion === jobConclusion)?.name;

  switch (conclusion) {
    case "success": {
      const checkedChanges = jobs.some((j) => j.name === CHECK_CHANGES_JOB && j.conclusion === "success");
      const work = jobs.filter((j) => j.name !== CHECK_CHANGES_JOB);
      if (checkedChanges && work.length > 0 && work.every((j) => j.conclusion === "skipped")) return NO_CHANGES_COMMENT;
      return isDeployWorkflow(workflowName) ? DEPLOYED_COMMENT : null;
    }
    case "failure":
    case "timed_out": {
      const timedOutJob = stoppedAt("timed_out");
      if (timedOutJob) return `Timed out at ${timedOutJob}`;
      const failedJob = stoppedAt("failure");
      return failedJob ? `Failed at ${failedJob}` : "Failed";
    }
    case "cancelled": {
      const cancelledJob = stoppedAt("cancelled");
      return cancelledJob ? `Cancelled during ${cancelledJob}` : "Cancelled";
    }
    case "startup_failure":
      return "Failed to start";
    case "skipped":
      return "Skipped";
    default:
      return null;
  }
}

// A scheduled deploy right after a failed attempt isn't necessarily new content: the
// pipelines redeploy until one completes. The chained pipelines (blog.aspose.com) skip
// the commit check entirely in that case; the others still run it, so they get
// different wording. `runs` must be newest-first, as the GitHub API returns them.
export function addRetryContext<T extends Pick<WorkflowRun, "id" | "workflowName" | "event" | "status" | "conclusion" | "comment">>(
  runs: T[],
  jobsByRun: Map<number, Pick<RawJob, "name" | "steps">[]>
): T[] {
  return runs.map((run, i) => {
    if (run.event !== "schedule" || run.comment !== DEPLOYED_COMMENT) return run;

    const lastAttempt = runs.slice(i + 1).find((r) => r.workflowName === run.workflowName && r.status === "completed" && r.comment !== NO_CHANGES_COMMENT);
    if (!lastAttempt) return run;

    const lastResult = runOutcome(lastAttempt.status, lastAttempt.conclusion) === "failed" ? "failed" : lastAttempt.conclusion === "cancelled" ? "cancelled" : null;
    if (!lastResult) return run;

    const checkJob = jobsByRun.get(run.id)?.find((j) => j.name === CHECK_CHANGES_JOB);
    const skipsCheck = checkJob?.steps?.some((s) => s.name === LAST_ATTEMPT_STEP);
    return { ...run, comment: `Last build ${lastResult} - ${skipsCheck ? "Change check skipped" : "Deployed again"}` };
  });
}

// Reports a no-change run as "skipped" rather than GitHub's "success". Everything
// downstream reads the conclusion, so this one change keeps these runs out of the
// green badges, success counts and build-time averages: nothing was deployed.
export function applyRunJobs(run: WorkflowRun, jobs: Pick<RawJob, "name" | "conclusion">[]): WorkflowRun {
  const comment = describeRun(run.workflowName, run.conclusion, jobs);
  return { ...run, comment, conclusion: comment === NO_CHANGES_COMMENT ? "skipped" : run.conclusion };
}

// The Overview loads all 6 domains at once, so this keeps a cold cache at 90 concurrent
// requests, under GitHub's secondary rate limit of 100.
const JOB_LOOKUP_BATCH_SIZE = 15;

export async function withRunComments(domain: string, runs: WorkflowRun[]): Promise<WorkflowRun[]> {
  const jobsByRun = new Map<number, RawJob[]>();
  const commented: WorkflowRun[] = [];
  for (let i = 0; i < runs.length; i += JOB_LOOKUP_BATCH_SIZE) {
    commented.push(...await Promise.all(runs.slice(i, i + JOB_LOOKUP_BATCH_SIZE).map(async (run) => {
      if (run.status !== "completed") return run;
      try {
        const jobs = await getRunJobs(domain, run.id);
        jobsByRun.set(run.id, jobs);
        return applyRunJobs(run, jobs);
      } catch {
        // A comment only adds detail, so one failed lookup shouldn't hide the runs.
        return run;
      }
    })));
  }
  return addRetryContext(commented, jobsByRun);
}
