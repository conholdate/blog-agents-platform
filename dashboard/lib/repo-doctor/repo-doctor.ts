import { getCached, setCached, invalidateCache, TTL_REPO_DOCTOR_PREVIEW } from "@/lib/cache";
import { getRepoDoctorTarget } from "./repo-doctor-config";
import { detectIssues, applyDeterministicFix, replaceEntryLine, replaceRawLine, validatePatchedText, onlyPunctuationChanged } from "./detect";
import { explainIssue, proposeFixText, pickRedirectTarget } from "./llm";
import { fetchPostUrls, shortlistCandidates } from "./sitemap";
import { fetchFileContent, getDefaultBranch, createBranch, commitFile, openPullRequest } from "./github";
import { logFixedIssue } from "./repo-doctor-sheets";
import type { RepoIssue, RepoDoctorScanResult, FixPreview } from "./types";

export class RepoDoctorError extends Error {
  code: "NOT_CONFIGURED" | "ISSUE_NOT_FOUND" | "NO_FIX_AVAILABLE" | "INVALID_FIX" | "PREVIEW_EXPIRED" | "STALE_FILE";

  constructor(message: string, code: RepoDoctorError["code"]) {
    super(message);
    this.name = "RepoDoctorError";
    this.code = code;
  }
}

function requireTarget(domain: string) {
  const target = getRepoDoctorTarget(domain);
  if (!target) throw new RepoDoctorError(`Repo Doctor is not configured for ${domain}.`, "NOT_CONFIGURED");
  return target;
}

function contextAround(rawText: string, line: number | null, radius = 3): string {
  if (line == null) return "";
  const lines = rawText.split("\n");
  const start = Math.max(0, line - 1 - radius);
  const end = Math.min(lines.length, line + radius);
  return lines.slice(start, end).join("\n");
}

async function urlResolves(target: string, domain: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(target, `https://${domain}`);
  } catch {
    return false;
  }
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function scanDomain(domain: string): Promise<RepoDoctorScanResult> {
  const target = requireTarget(domain);
  const { content } = await fetchFileContent(target.owner, target.repo, target.filePath);
  const ruleIssues = detectIssues(content, domain, target.filePath);

  const issues: RepoIssue[] = await Promise.all(
    ruleIssues.map(async (issue) => {
      const { explanation, suggestedFixDescription } = await explainIssue(issue, contextAround(content, issue.line));
      return { ...issue, explanation, suggestedFixDescription };
    })
  );

  // Rough count for display only — nothing else depends on this being exact.
  const entryCount = (content.match(/^\s*"[^"]*"\s*:\s*"/gm) ?? []).length;

  return {
    domain,
    filePath: target.filePath,
    scannedAt: new Date().toISOString(),
    entryCount,
    issues,
  };
}

interface CachedPreview {
  previewId: string;
  issue: RepoIssue;
  before: string; // full file text this preview was computed against
  after: string; // full file text with the fix applied
}

function previewCacheKey(domain: string, issueId: string): string {
  return `repo-doctor:preview:${domain}:${issueId}`;
}

function extractSnippets(before: string, after: string, issue: RepoIssue): { beforeSnippet: string; afterSnippet: string | null } {
  const beforeLines = before.split("\n");
  const beforeSnippet = issue.line != null ? (beforeLines[issue.line - 1] ?? "") : (issue.currentValue ?? "");
  const isDeletion = issue.type === "SELF_LOOP_REDIRECT" || issue.type === "DUPLICATE_KEY";
  if (isDeletion) return { beforeSnippet, afterSnippet: null };
  const afterLines = after.split("\n");
  const afterSnippet = issue.line != null ? (afterLines[issue.line - 1] ?? "") : "";
  return { beforeSnippet, afterSnippet };
}

// Computes and caches the exact patch for one issue, WITHOUT writing anything to
// GitHub. Returns null if the issue's fixStrategy is "manual" (no Fix It flow at all).
export async function previewFix(domain: string, issueId: string): Promise<FixPreview | null> {
  const target = requireTarget(domain);
  const { content } = await fetchFileContent(target.owner, target.repo, target.filePath);
  const issues = detectIssues(content, domain, target.filePath);
  const issue = issues.find((i) => i.id === issueId);
  if (!issue) {
    throw new RepoDoctorError("This issue is no longer present — it may have already been fixed.", "ISSUE_NOT_FOUND");
  }
  if (issue.fixStrategy === "manual") return null;

  let patched: string;
  if (issue.fixStrategy === "deterministic") {
    // Both rewrite the target to a URL nobody has checked: MALFORMED_TARGET's is a
    // syntactic guess, CHAINED_REDIRECT's is the chain's last hop, which may be dead.
    if (issue.type === "MALFORMED_TARGET" && !(await urlResolves(issue.suggestedValue!, domain))) {
      throw new RepoDoctorError(
        `The corrected target "${issue.suggestedValue}" doesn't load on the live site, so this needs a human to pick the right destination.`,
        "NO_FIX_AVAILABLE"
      );
    }
    if (issue.type === "CHAINED_REDIRECT" && !(await urlResolves(issue.suggestedValue!, domain))) {
      throw new RepoDoctorError(
        `This chain ends at a dead page ("${issue.suggestedValue}"). Fix the redirect for that page first.`,
        "NO_FIX_AVAILABLE"
      );
    }
    patched = applyDeterministicFix(content, issue);
  } else if (issue.type === "EMPTY_TARGET") {
    const candidates = shortlistCandidates(issue.sourceKey!, await fetchPostUrls(domain));
    const picked = await pickRedirectTarget(issue.sourceKey!, candidates);
    if (!picked) {
      throw new RepoDoctorError("No existing post on the live site is a close enough match for this redirect.", "NO_FIX_AVAILABLE");
    }
    // The sitemap can list a post that has since been removed.
    if (!(await urlResolves(picked, domain))) {
      throw new RepoDoctorError(`The best-matching post "${picked}" doesn't load on the live site.`, "NO_FIX_AVAILABLE");
    }
    patched = replaceEntryLine(content, issue.line!, issue.sourceKey!, picked);
  } else {
    const proposed = await proposeFixText(issue, contextAround(content, issue.line));
    if (!proposed) {
      throw new RepoDoctorError("No confident automated fix is available for this issue.", "NO_FIX_AVAILABLE");
    }
    if (!onlyPunctuationChanged(content.split("\n")[issue.line! - 1] ?? "", proposed)) {
      throw new RepoDoctorError(
        "The suggested syntax fix also changed the redirect's text (not just commas or quotes), so it was rejected.",
        "NO_FIX_AVAILABLE"
      );
    }
    patched = replaceRawLine(content, issue.line!, proposed);
  }

  const validation = validatePatchedText(patched);
  if (!validation.ok) {
    throw new RepoDoctorError(`The computed fix would leave the file invalid: ${validation.error}`, "INVALID_FIX");
  }

  const previewId = crypto.randomUUID();
  setCached<CachedPreview>(previewCacheKey(domain, issueId), { previewId, issue, before: content, after: patched });

  const { beforeSnippet, afterSnippet } = extractSnippets(content, patched, issue);
  return { previewId, issueId, beforeSnippet, afterSnippet };
}

export interface ConfirmedFix {
  prUrl: string;
  prNumber: number;
}

// Commits exactly what previewFix computed and showed — never re-asks the LLM,
// so what's committed is byte-identical to what the user reviewed.
export async function confirmFix(domain: string, issueId: string, previewId: string): Promise<ConfirmedFix> {
  const target = requireTarget(domain);
  const cacheKey = previewCacheKey(domain, issueId);
  const cached = getCached<CachedPreview>(cacheKey, TTL_REPO_DOCTOR_PREVIEW);
  if (!cached || cached.previewId !== previewId) {
    throw new RepoDoctorError("This preview has expired or doesn't match — please preview the fix again.", "PREVIEW_EXPIRED");
  }

  // Re-fetch fresh: confirms nothing changed since the preview, and gets the
  // current blob sha GitHub requires to commit over existing content.
  const fresh = await fetchFileContent(target.owner, target.repo, target.filePath);
  if (fresh.content !== cached.before) {
    invalidateCache(cacheKey);
    throw new RepoDoctorError("The file has changed since this fix was previewed — please re-scan and try again.", "STALE_FILE");
  }

  const defaultBranch = await getDefaultBranch(target.owner, target.repo);
  const branchName = `repo-doctor/fix-${cached.issue.type.toLowerCase()}-${Date.now()}`;
  await createBranch(target.owner, target.repo, branchName, defaultBranch);

  const commitMessage = `Repo Doctor: fix ${cached.issue.type} for ${cached.issue.sourceKey ?? target.filePath}`;
  await commitFile(target.owner, target.repo, branchName, target.filePath, cached.after, commitMessage, fresh.sha);

  const pr = await openPullRequest(target.owner, target.repo, {
    title: `Repo Doctor: fix ${cached.issue.type.replace(/_/g, " ").toLowerCase()}`,
    body: [
      `**Issue:** ${cached.issue.explanation}`,
      `**Fix:** ${cached.issue.suggestedFixDescription}`,
      "",
      `Source key: \`${cached.issue.sourceKey ?? "(file-level)"}\``,
      ...(cached.issue.rawLine != null ? ["", "Line as it currently reads:", "```json", cached.issue.rawLine, "```"] : []),
      "",
      "_Opened automatically by Repo Doctor. This PR is not auto-merged — please review before merging._",
    ].join("\n"),
    head: branchName,
    base: defaultBranch,
  });

  await logFixedIssue(domain, cached.issue, pr.url, pr.number);
  invalidateCache(cacheKey, `repo-doctor:fix-log:${domain}`);
  return { prUrl: pr.url, prNumber: pr.number };
}
