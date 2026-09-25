export interface RepoDoctorTarget {
  owner: string;
  repo: string;
  filePath: string;
}

// Content repo + target file to scan, per domain. Rolled out incrementally —
// each entry is verified against the real file (valid JSON, rules produce
// sane results) before being added here. Remaining null entries stay that way
// until confirmed; adding one is a one-line change here, not a rebuild.
// Mirrors WORKFLOWS_REPOS's shape in lib/workflows/workflows-config.ts.
export const REPO_DOCTOR_REPOS: Record<string, RepoDoctorTarget | null> = {
  "blog.aspose.com": { owner: "aspose", repo: "aspose-blog", filePath: "Redirects.json" },
  "blog.aspose.cloud": { owner: "aspose-cloud", repo: "aspose-cloud-blog", filePath: "Redirects.json" },
  // TODO(repo-doctor): confirm and add this domain's redirects file path.
  "blog.groupdocs.com": null,
  "blog.groupdocs.cloud": { owner: "groupdocs-cloud", repo: "groupdocs-cloud-blog", filePath: "Redirects.json" },
  "blog.conholdate.com": { owner: "conholdate", repo: "conholdate-blog", filePath: "Redirects.json" },
  "blog.conholdate.cloud": { owner: "conholdate-cloud", repo: "blog.conholdate.cloud", filePath: "Redirects.json" },
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
