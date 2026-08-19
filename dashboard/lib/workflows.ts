import { getWorkflowsRepo, getGithubToken } from "./workflows-config";

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

export interface WorkflowsSummary {
  repo: string;
  latestRun: { workflowName: string; status: string; conclusion: string | null; updatedAt: string; htmlUrl: string } | null;
  successCount: number;
  failureCount: number;
  inProgressCount: number;
}

export async function getWorkflowsSummary(domain: string): Promise<WorkflowsSummary | { notConfigured: true }> {
  const repo = getWorkflowsRepo(domain);
  if (!getGithubToken() || !repo) return { notConfigured: true };

  const { runs } = await getRecentWorkflowRuns(domain, 10);

  let successCount = 0, failureCount = 0, inProgressCount = 0;
  for (const r of runs) {
    if (r.status === "in_progress" || r.status === "queued" || r.status === "waiting") inProgressCount++;
    else if (r.conclusion === "success") successCount++;
    else if (r.conclusion === "failure" || r.conclusion === "timed_out") failureCount++;
  }

  const latest = runs[0] ?? null;
  return {
    repo: `${repo.owner}/${repo.repo}`,
    latestRun: latest ? { workflowName: latest.workflowName, status: latest.status, conclusion: latest.conclusion, updatedAt: latest.updatedAt, htmlUrl: latest.htmlUrl } : null,
    successCount,
    failureCount,
    inProgressCount,
  };
}
