import { NextRequest, NextResponse } from "next/server";
import { getKeywordSummary } from "@/lib/sheets";
import { getCached, setCached, TTL_KEYWORDS } from "@/lib/cache";

const TTL = TTL_KEYWORDS;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const decoded = decodeURIComponent(domain);
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    const key = `summary:${decoded}`;

    if (!refresh) {
      const hit = getCached<object>(key, TTL);
      if (hit) return NextResponse.json(hit);
    }

    const result = { tabs: await getKeywordSummary(decoded) };
    setCached(key, result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
