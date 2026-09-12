import { NextRequest, NextResponse } from "next/server";
import { getFailedSteps } from "@/lib/workflows";
import { isGithubWorkflowsConfigured, getWorkflowsRepo } from "@/lib/workflows-config";

type Params = Promise<{ domain: string; runId: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { domain, runId } = await params;
  const decoded = decodeURIComponent(domain);

  if (!isGithubWorkflowsConfigured() || !getWorkflowsRepo(decoded)) {
    return NextResponse.json({ failedSteps: [], notConfigured: true });
  }

  try {
    const failedSteps = await getFailedSteps(decoded, Number(runId));
    return NextResponse.json({ failedSteps });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
