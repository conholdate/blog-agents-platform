import type { WorkflowsSummary } from "@/lib/workflows/workflows";
import { deploymentFailureCount } from "@/lib/workflows/workflows";

export interface DomainRow {
  domain: string;
  kw:  { queued: number; approved: number; generated: number } | null;
  opt: { pending: number; high: number; optimized: number } | null;
  url: { totalIssues: number; latestScan: string | null } | null;
  tr:  { missing: number; pending: number; completed: number } | null;
  wf:  WorkflowsSummary | null;
}

/* Rolls each domain's per-tool signals into one glanceable status: critical
   (CI failing or high-priority SEO issues), attention (something pending), or clear. */
export function domainHealth({ opt, url, tr, wf }: {
  opt: DomainRow["opt"]; url: DomainRow["url"]; tr: DomainRow["tr"]; wf: DomainRow["wf"];
}): { dotClass: string; label: string } {
  const prodFailures = wf ? deploymentFailureCount(wf.deployments, "production") : 0;
  const stagingFailures = wf ? deploymentFailureCount(wf.deployments, "staging") : 0;
  const otherCiFailures = wf ? Math.max(0, wf.failureCount - prodFailures - stagingFailures) : 0;

  if (prodFailures > 0) return { dotClass: "bg-red-500 dark:bg-red-400", label: "Production deploy failing" };
  if ((opt?.high ?? 0) > 0) return { dotClass: "bg-red-500 dark:bg-red-400", label: "High-priority SEO issues pending" };
  if (stagingFailures > 0 || otherCiFailures > 0 || (url?.totalIssues ?? 0) > 0 || (tr?.missing ?? 0) > 0 || (opt?.pending ?? 0) > 0) {
    return { dotClass: "bg-amber-400 dark:bg-amber-500", label: stagingFailures > 0 ? "Staging deploy failing" : "Items need attention" };
  }
  return { dotClass: "bg-green-500 dark:bg-green-400", label: "All clear" };
}
