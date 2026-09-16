import { NextRequest, NextResponse } from "next/server";
import { getOptimizationSummary } from "@/lib/optimization/optimizationSheets";
import { getCached, setCached, TTL_OPTIMIZATION } from "@/lib/cache";

type Params = Promise<{ domain: string }>;

const TTL = TTL_OPTIMIZATION;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { domain } = await params;
    const decoded = decodeURIComponent(domain);
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    const key = `optimization-summary:${decoded}`;

    if (!refresh) {
      const hit = getCached<object>(key, TTL);
      if (hit) return NextResponse.json(hit);
    }

    const result = await getOptimizationSummary(decoded);
    setCached(key, result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
