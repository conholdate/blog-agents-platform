import { NextRequest, NextResponse } from "next/server";
import { getUrlValidatorSheetId, getUrlValidatorConsolidatedSpreadsheetId } from "@/lib/url-validator-config";
import { getUrlValidatorSummary } from "@/lib/url-validator-sheets";
import { getCached, setCached, TTL_URL_VALIDATOR } from "@/lib/cache";

type Params = Promise<{ domain: string }>;

const TTL = TTL_URL_VALIDATOR;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);
  const spreadsheetId = getUrlValidatorConsolidatedSpreadsheetId() ?? getUrlValidatorSheetId(decoded);

  if (!spreadsheetId) {
    return NextResponse.json({ notConfigured: true });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const key = `urlsummary:${decoded}`;

  if (!refresh) {
    const hit = getCached<object>(key, TTL);
    if (hit) return NextResponse.json(hit);
  }

  try {
    const result = await getUrlValidatorSummary(decoded);
    setCached(key, result);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
