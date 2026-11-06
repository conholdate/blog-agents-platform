import { NextRequest, NextResponse } from "next/server";
import { getRunFailureDetail } from "@/lib/workflows/workflows";
import { isGithubWorkflowsConfigured, getWorkflowsRepo } from "@/lib/workflows/workflows-config";

type Params = Promise<{ domain: string; runId: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { domain, runId } = await params;
  const decoded = decodeURIComponent(domain);

  if (!isGithubWorkflowsConfigured() || !getWorkflowsRepo(decoded)) {
    return NextResponse.json({ failedSteps: [], report: null, notConfigured: true });
  }

  try {
    return NextResponse.json(await getRunFailureDetail(decoded, Number(runId)));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
