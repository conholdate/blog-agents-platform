import { NextRequest, NextResponse } from "next/server";
import { getOptimizationData } from "@/lib/optimizationSheets";
import { getCached, setCached } from "@/lib/cache";

type Params = Promise<{ domain: string }>;

const TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { domain } = await params;
    const decoded = decodeURIComponent(domain);
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    const key = `optimization:${decoded}`;

    if (!refresh) {
      const hit = getCached<object>(key, TTL);
      if (hit) return NextResponse.json(hit);
    }

    const data = await getOptimizationData(decoded);
    setCached(key, data);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
