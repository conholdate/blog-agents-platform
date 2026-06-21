import { NextRequest, NextResponse } from "next/server";
import { getTranslationData } from "@/lib/translationSheets";
import { TRANSLATION_SHEET_ID } from "@/lib/config";
import { getCached, setCached, TTL_TRANSLATION } from "@/lib/cache";

type Params = Promise<{ domain: string }>;

const TTL = TTL_TRANSLATION;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { domain } = await params;
    const decoded = decodeURIComponent(domain);
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    const key = `translation:${decoded}`;

    if (!refresh) {
      const hit = getCached<object>(key, TTL);
      if (hit) return NextResponse.json(hit);
    }

    const data = await getTranslationData(decoded);
    const result = {
      ...data,
      sheetUrl: TRANSLATION_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${TRANSLATION_SHEET_ID}/edit` : null,
    };
    setCached(key, result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
