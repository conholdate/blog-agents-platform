import { NextRequest, NextResponse } from "next/server";
import { getTranslationSummary } from "@/lib/translationSheets";
import { getCached, setCached, TTL_TRANSLATION } from "@/lib/cache";

type Params = Promise<{ domain: string }>;

const TTL = TTL_TRANSLATION;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { domain } = await params;
    const decoded = decodeURIComponent(domain);
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    const key = `translation-summary:${decoded}`;

    if (!refresh) {
      const hit = getCached<object>(key, TTL);
      if (hit) return NextResponse.json(hit);
    }

    const result = await getTranslationSummary(decoded);
    setCached(key, result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
