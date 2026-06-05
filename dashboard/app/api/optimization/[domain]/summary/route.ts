import { NextRequest, NextResponse } from "next/server";
import { getOptimizationData } from "@/lib/optimizationSheets";
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

    const { queue, optimized } = await getOptimizationData(decoded);

    const high   = queue.filter((r) => r.priorityTier === "high").length;
    const medium = queue.filter((r) => r.priorityTier === "medium").length;
    const page2  = queue.filter((r) => r.position >= 11 && r.position <= 20).length;
    const avgPosition   = queue.length ? queue.reduce((s, r) => s + r.position, 0)   / queue.length : 0;
    const avgImpressions = queue.length ? queue.reduce((s, r) => s + r.impressions, 0) / queue.length : 0;
    const avgCtr        = queue.length ? queue.reduce((s, r) => s + r.ctr, 0)         / queue.length : 0;

    const result = {
      pending:        queue.length,
      high,
      medium,
      optimized:      optimized.length,
      page2,
      avgPosition:    parseFloat(avgPosition.toFixed(1)),
      avgImpressions: Math.round(avgImpressions),
      avgCtr:         parseFloat(avgCtr.toFixed(2)),
    };

    setCached(key, result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
