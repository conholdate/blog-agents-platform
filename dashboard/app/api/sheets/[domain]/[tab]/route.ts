import { NextRequest, NextResponse } from "next/server";
import { getSheetRows, saveSheetRows } from "@/lib/sheets";
import { getCached, setCached, invalidateCache, TTL_KEYWORDS } from "@/lib/cache";
import { STATUS_OPTIONS } from "@/lib/config";

type Params = Promise<{ domain: string; tab: string }>;

const TTL = TTL_KEYWORDS;

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

    // Reject invalid status values outright (whole request, not partial) -- the brief's
    // status field drives whether downstream agents pick it up, so it shouldn't silently
    // accept a typo'd or arbitrary value.
    const invalidStatus = changes.find(
      (c) => c.key === "status" && !STATUS_OPTIONS.includes(c.value as (typeof STATUS_OPTIONS)[number])
    );
    if (invalidStatus) {
      return NextResponse.json(
        { error: `Invalid status "${invalidStatus.value}". Must be one of: ${STATUS_OPTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    await saveSheetRows(decoded, decodedTab, changes);
    invalidateCache(`rows:${decoded}:${decodedTab}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
