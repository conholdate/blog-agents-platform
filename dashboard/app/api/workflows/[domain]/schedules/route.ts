import { NextRequest, NextResponse } from "next/server";
import { getWorkflowSchedules } from "@/lib/workflows/workflows";
import { isGithubWorkflowsConfigured, getWorkflowsRepo } from "@/lib/workflows/workflows-config";
import { invalidateCache } from "@/lib/cache";

type Params = Promise<{ domain: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  if (!isGithubWorkflowsConfigured() || !getWorkflowsRepo(decoded)) {
    return NextResponse.json({ schedules: [], notConfigured: true });
  }

  if (req.nextUrl.searchParams.get("refresh") === "1") {
    invalidateCache(`workflows:schedules:${decoded}`);
  }

  try {
    const schedules = await getWorkflowSchedules(decoded);
    return NextResponse.json({ schedules });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
