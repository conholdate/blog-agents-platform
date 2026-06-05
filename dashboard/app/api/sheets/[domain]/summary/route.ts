import { NextRequest, NextResponse } from "next/server";
import { getSheetTabs, getSheetRows } from "@/lib/sheets";
import { getCached, setCached, TTL_KEYWORDS } from "@/lib/cache";

type TabSummary = {
  name: string;
  total: number;
  queued: number;
  approved: number;
  rejected: number;
  generated: number;
};

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

    const allTabs = await getSheetTabs(decoded);
    const productTabs = allTabs.filter((t) => t !== "All Missing Topics");

    const summaries: TabSummary[] = await Promise.all(
      productTabs.map(async (tab) => {
        const rows = await getSheetRows(decoded, tab);
        const counts = { queued: 0, approved: 0, rejected: 0, generated: 0 };
        for (const row of rows) {
          const status = (row["Status"] ?? "").toLowerCase().trim();
          if (status === "approved") counts.approved++;
          else if (status === "rejected") counts.rejected++;
          else if (status === "generated") counts.generated++;
          else counts.queued++;
        }
        return { name: tab, total: rows.length, ...counts };
      })
    );

    const result = { tabs: summaries };
    setCached(key, result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
