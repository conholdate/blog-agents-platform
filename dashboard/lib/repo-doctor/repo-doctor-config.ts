export interface RepoDoctorTarget {
  owner: string;
  repo: string;
  filePath: string;
}

// Content repo + target file to scan, per domain. Only blog.aspose.com is
// populated for V1 (per the staged rollout) — the other 5 domains stay null
// until their redirects file path is confirmed; adding one later is a one-line
// change here, not a rebuild. Mirrors WORKFLOWS_REPOS's shape in
// lib/workflows/workflows-config.ts.
export const REPO_DOCTOR_REPOS: Record<string, RepoDoctorTarget | null> = {
  "blog.aspose.com": { owner: "aspose", repo: "aspose-blog", filePath: "Redirects.json" },
  // TODO(repo-doctor): confirm and add this domain's redirects file path.
  "blog.aspose.cloud": null,
  // TODO(repo-doctor): confirm and add this domain's redirects file path.
  "blog.groupdocs.com": null,
  // TODO(repo-doctor): confirm and add this domain's redirects file path.
  "blog.groupdocs.cloud": null,
  // TODO(repo-doctor): confirm and add this domain's redirects file path.
  "blog.conholdate.com": null,
  // TODO(repo-doctor): confirm and add this domain's redirects file path.
  "blog.conholdate.cloud": null,
};

export function getRepoDoctorTarget(domain: string): RepoDoctorTarget | null {
  return REPO_DOCTOR_REPOS[domain] ?? null;
}

// Separate from GITHUB_READONLY_TOKEN (lib/workflows/workflows-config.ts), which
// is explicitly read-only — keeping them apart means a write path accidentally
// importing the read-only getter fails obviously in review.
export function getGithubWriteToken(): string | null {
  return process.env.GITHUB_WRITE_TOKEN ?? null;
}

export function isRepoDoctorWriteConfigured(): boolean {
  return !!getGithubWriteToken();
}
