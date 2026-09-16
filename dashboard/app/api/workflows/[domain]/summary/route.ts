import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, TTL_WORKFLOWS } from "@/lib/cache";
import { getWorkflowsSummary } from "@/lib/workflows/workflows";

type Params = Promise<{ domain: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const key = `workflows:summary:${decoded}`;

  if (!refresh) {
    const hit = getCached<object>(key, TTL_WORKFLOWS);
    if (hit) return NextResponse.json(hit);
  }

  try {
    const result = await getWorkflowsSummary(decoded);
    setCached(key, result);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
