import { NextRequest, NextResponse } from "next/server";
import { getSheetRows, saveSheetRows } from "@/lib/sheets";
import { getCached, setCached, invalidateCache } from "@/lib/cache";

type Params = Promise<{ domain: string; tab: string }>;

const TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { domain, tab } = await params;
    const decoded = decodeURIComponent(domain);
    const decodedTab = decodeURIComponent(tab);
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    const key = `rows:${decoded}:${decodedTab}`;

    if (!refresh) {
      const hit = getCached<object>(key, TTL);
      if (hit) return NextResponse.json(hit);
    }

    const rows = await getSheetRows(decoded, decodedTab);
    const result = { rows };
    setCached(key, result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { domain, tab } = await params;
    const decoded = decodeURIComponent(domain);
    const decodedTab = decodeURIComponent(tab);
    const body = await req.json();

    const changes = body.changes as {
      rowIndex: number;
      key: string;
      value: string;
    }[];

    await saveSheetRows(decoded, decodedTab, changes);
    invalidateCache(`rows:${decoded}:${decodedTab}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
