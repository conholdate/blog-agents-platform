import { NextRequest, NextResponse } from "next/server";
import { getSheetTabs, getSheetRows } from "@/lib/sheets";
import { getCached, setCached } from "@/lib/cache";

type TabSummary = {
  name: string;
  total: number;
  pending: number;
  ok: number;
  rejected: number;
};

const TTL = 10 * 60 * 1000;

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
        const counts = { pending: 0, ok: 0, rejected: 0 };
        for (const row of rows) {
          const status = (row["Status"] ?? "").toLowerCase().trim();
          if (status === "ok") counts.ok++;
          else if (status === "rejected") counts.rejected++;
          else counts.pending++;
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
