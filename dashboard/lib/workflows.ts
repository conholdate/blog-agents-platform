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
        if (!contentRes.ok) return { workflowName: w.name, path: w.path, crons: [], description: "", nextRunAt: null };

        const contentJson: { content?: string } = await contentRes.json();
        const yamlText = contentJson.content ? Buffer.from(contentJson.content, "base64").toString("utf-8") : "";
        const crons = [...yamlText.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

        return { workflowName: w.name, path: w.path, crons, description: describeCrons(crons), nextRunAt: earliestNextRun(crons) };
      } catch {
        return { workflowName: w.name, path: w.path, crons: [], description: "", nextRunAt: null };
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

export interface WorkflowsSummary {
  repo: string;
  latestRun: { workflowName: string; status: string; conclusion: string | null; updatedAt: string; htmlUrl: string } | null;
  successCount: number;
  failureCount: number;
  inProgressCount: number;
  // Oldest → newest, for a left-to-right timeline strip.
  recentRuns: WorkflowRunTick[];
  nextScheduledRun: { workflowName: string; nextRunAt: string; description: string } | null;
}

export async function getWorkflowsSummary(domain: string): Promise<WorkflowsSummary | { notConfigured: true }> {
  const repo = getWorkflowsRepo(domain);
  if (!getGithubToken() || !repo) return { notConfigured: true };

  const [{ runs }, schedules] = await Promise.all([
    getRecentWorkflowRuns(domain, 10),
    getWorkflowSchedules(domain),
  ]);

  let successCount = 0, failureCount = 0, inProgressCount = 0;
  for (const r of runs) {
    if (r.status === "in_progress" || r.status === "queued" || r.status === "waiting") inProgressCount++;
    else if (r.conclusion === "success") successCount++;
    else if (r.conclusion === "failure" || r.conclusion === "timed_out") failureCount++;
  }

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
    recentRuns: runs
      .slice()
      .reverse()
      .map((r) => ({ status: r.status, conclusion: r.conclusion, workflowName: r.workflowName, updatedAt: r.updatedAt, htmlUrl: r.htmlUrl })),
    nextScheduledRun,
  };
}
