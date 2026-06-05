import { NextRequest, NextResponse } from "next/server";
import { getOptimizationData } from "@/lib/optimizationSheets";
import { OPTIMIZATION_SHEET_ID_QUEUE, OPTIMIZATION_SHEET_ID_LOG } from "@/lib/config";
import { getCached, setCached, TTL_OPTIMIZATION } from "@/lib/cache";

type Params = Promise<{ domain: string }>;

const TTL = TTL_OPTIMIZATION;

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
    const result = {
      ...data,
      queueSheetUrl: OPTIMIZATION_SHEET_ID_QUEUE ? `https://docs.google.com/spreadsheets/d/${OPTIMIZATION_SHEET_ID_QUEUE}/edit` : null,
      logSheetUrl:   OPTIMIZATION_SHEET_ID_LOG   ? `https://docs.google.com/spreadsheets/d/${OPTIMIZATION_SHEET_ID_LOG}/edit`   : null,
    };
    setCached(key, result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
