export const GITHUB_WORKFLOWS_OWNER = "Aspose";
export const GITHUB_WORKFLOWS_REPO = "aspose-blog-workflows";

export function getGithubToken(): string | null {
  return process.env.GITHUB_READONLY_TOKEN ?? null;
}

export function isGithubWorkflowsConfigured(): boolean {
  return !!getGithubToken();
}
