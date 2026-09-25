export interface RepoDoctorTarget {
  owner: string;
  repo: string;
  filePath: string;
}

// Content repo + target file to scan, per domain — all 6 domains now covered.
// Each was verified against its real file (valid JSON, rules produce sane
// results, no false positives) before being added here. A `null` value is the
// pattern for a future 7th domain: stays unconfigured until confirmed the same
// way, one line to add. Mirrors WORKFLOWS_REPOS's shape in lib/workflows/workflows-config.ts.
export const REPO_DOCTOR_REPOS: Record<string, RepoDoctorTarget | null> = {
  "blog.aspose.com": { owner: "aspose", repo: "aspose-blog", filePath: "Redirects.json" },
  "blog.aspose.cloud": { owner: "aspose-cloud", repo: "aspose-cloud-blog", filePath: "Redirects.json" },
  "blog.groupdocs.com": { owner: "groupdocs", repo: "groupdocs-blog", filePath: "Redirects.json" },
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
