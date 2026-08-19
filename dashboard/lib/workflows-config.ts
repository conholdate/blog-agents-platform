// GitHub repo that runs each domain's CI (URL validation, content checks, etc).
// The .com domains run CI in a separate "-workflows" repo; the .cloud domains
// run CI directly inside their content repo.
export const WORKFLOWS_REPOS: Record<string, { owner: string; repo: string }> = {
  "blog.aspose.com":       { owner: "Aspose",            repo: "aspose-blog-workflows" },
  "blog.aspose.cloud":     { owner: "aspose-cloud",       repo: "aspose-cloud-blog" },
  "blog.groupdocs.com":    { owner: "groupdocs",          repo: "groupdocs-blog-workflows" },
  "blog.groupdocs.cloud":  { owner: "groupdocs-cloud",    repo: "groupdocs-cloud-blog" },
  "blog.conholdate.com":   { owner: "conholdate",         repo: "conholdate-blog-workflows" },
  "blog.conholdate.cloud": { owner: "conholdate-cloud",   repo: "blog.conholdate.cloud" },
};

export function getWorkflowsRepo(domain: string): { owner: string; repo: string } | null {
  return WORKFLOWS_REPOS[domain] ?? null;
}

export function getGithubToken(): string | null {
  return process.env.GITHUB_READONLY_TOKEN ?? null;
}

export function isGithubWorkflowsConfigured(): boolean {
  return !!getGithubToken();
}
