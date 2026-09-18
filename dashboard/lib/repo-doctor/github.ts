import { Octokit } from "@octokit/rest";
import { getGithubWriteToken } from "./repo-doctor-config";

// Content-repo-specific GitHub wrapper, kept separate from lib/workflows/workflows.ts
// (CI-runs-only, read-only-token-scoped) — this one writes (branches/commits/PRs) and
// uses a different, write-scoped token.
let cachedOctokit: Octokit | null | undefined;

function getOctokit(): Octokit | null {
  if (cachedOctokit !== undefined) return cachedOctokit;
  const token = getGithubWriteToken();
  cachedOctokit = token ? new Octokit({ auth: token }) : null;
  return cachedOctokit;
}

export function isGithubWriteConfigured(): boolean {
  return getOctokit() != null;
}

function requireOctokit(): Octokit {
  const octokit = getOctokit();
  if (!octokit) throw new Error("GITHUB_WRITE_TOKEN is not configured.");
  return octokit;
}

export interface FetchedFile {
  content: string;
  sha: string;
}

export async function fetchFileContent(owner: string, repo: string, path: string, ref?: string): Promise<FetchedFile> {
  const octokit = requireOctokit();
  const res = await octokit.repos.getContent({ owner, repo, path, ref });
  const data = res.data;
  if (Array.isArray(data) || data.type !== "file" || !("sha" in data)) {
    throw new Error(`${path} is not a file in ${owner}/${repo}.`);
  }

  // GitHub's Contents API omits the inline base64 `content` field for files
  // over ~1MB — Redirects.json is 2.4MB, so this branch is the common case for
  // it, not an edge case. Fall back to a raw-media-type request rather than
  // silently treating a large file as empty.
  if ("content" in data && data.content) {
    return { content: Buffer.from(data.content, "base64").toString("utf-8"), sha: data.sha };
  }

  const rawRes = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref,
    mediaType: { format: "raw" },
  });
  return { content: rawRes.data as unknown as string, sha: data.sha };
}

export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const octokit = requireOctokit();
  const res = await octokit.repos.get({ owner, repo });
  return res.data.default_branch;
}

export async function createBranch(owner: string, repo: string, newBranch: string, fromBranch: string): Promise<void> {
  const octokit = requireOctokit();
  const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${fromBranch}` });
  await octokit.git.createRef({ owner, repo, ref: `refs/heads/${newBranch}`, sha: ref.data.object.sha });
}

export async function commitFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
  sha: string
): Promise<void> {
  const octokit = requireOctokit();
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    branch,
    message,
    sha,
    content: Buffer.from(content, "utf-8").toString("base64"),
  });
}

export interface OpenedPullRequest {
  url: string;
  number: number;
}

export async function openPullRequest(
  owner: string,
  repo: string,
  params: { title: string; body: string; head: string; base: string }
): Promise<OpenedPullRequest> {
  const octokit = requireOctokit();
  const res = await octokit.pulls.create({
    owner,
    repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base,
  });
  return { url: res.data.html_url, number: res.data.number };
}
