import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, TTL_WORKFLOWS } from "@/lib/cache";
import { getRecentWorkflowRuns } from "@/lib/workflows";
import { isGithubWorkflowsConfigured } from "@/lib/workflows-config";

export async function GET(req: NextRequest) {
  if (!isGithubWorkflowsConfigured()) {
    return NextResponse.json({ runs: [], notConfigured: true });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const key = "workflows:runs";

  if (!refresh) {
    const hit = getCached<object>(key, TTL_WORKFLOWS);
    if (hit) return NextResponse.json(hit);
  }

  try {
    const result = await getRecentWorkflowRuns();
    setCached(key, result);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
