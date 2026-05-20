import { NextRequest, NextResponse } from "next/server";
import { getSheetTabs, getSheetRows } from "@/lib/sheets";
import { getCached, setCached } from "@/lib/cache";

type Params = Promise<{ domain: string }>;

const TTL = 5 * 60 * 1000;
const ALL_MISSING = "All Missing Topics";

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const key = `generated:${decoded}`;

  if (!refresh) {
    const hit = getCached<object>(key, TTL);
    if (hit) return NextResponse.json(hit);
  }

  try {
    const tabs = await getSheetTabs(decoded);
    const productTabs = tabs.filter((t) => t !== ALL_MISSING);
    const allRows = await Promise.all(productTabs.map((t) => getSheetRows(decoded, t)));
    const rows = allRows
      .flat()
      .filter((r) => (r.status ?? "").toLowerCase() === "generated")
      .sort((a, b) => (b.generated_at_utc ?? "").localeCompare(a.generated_at_utc ?? ""));

    const result = { rows };
    setCached(key, result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
