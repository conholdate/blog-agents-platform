import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, TTL_WORKFLOWS } from "@/lib/cache";
import { getRecentWorkflowRuns, getWorkflowSchedules, withScheduledSlots } from "@/lib/workflows/workflows";
import { isGithubWorkflowsConfigured, getWorkflowsRepo } from "@/lib/workflows/workflows-config";

type Params = Promise<{ domain: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  if (!isGithubWorkflowsConfigured() || !getWorkflowsRepo(decoded)) {
    return NextResponse.json({ runs: [], notConfigured: true });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const key = `workflows:runs:${decoded}`;

  if (!refresh) {
    const hit = getCached<object>(key, TTL_WORKFLOWS);
    if (hit) return NextResponse.json(hit);
  }

  try {
    // Scheduled times only add detail to the runs table, so a failed lookup shouldn't hide the runs.
    const [result, schedules] = await Promise.all([
      getRecentWorkflowRuns(decoded),
      getWorkflowSchedules(decoded).catch(() => []),
    ]);
    const repo = getWorkflowsRepo(decoded);
    const payload = { ...result, runs: withScheduledSlots(result.runs, schedules), repo: repo ? `${repo.owner}/${repo.repo}` : null };
    setCached(key, payload);
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
