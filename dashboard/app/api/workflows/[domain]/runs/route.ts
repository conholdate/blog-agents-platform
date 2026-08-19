import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, TTL_WORKFLOWS } from "@/lib/cache";
import { getRecentWorkflowRuns } from "@/lib/workflows";
import { isGithubWorkflowsConfigured, getWorkflowsRepo } from "@/lib/workflows-config";

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
    const result = await getRecentWorkflowRuns(decoded);
    const repo = getWorkflowsRepo(decoded);
    const payload = { ...result, repo: repo ? `${repo.owner}/${repo.repo}` : null };
    setCached(key, payload);
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
