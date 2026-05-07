import { NextRequest, NextResponse } from "next/server";
import { getSheetTabs, getSheetRows } from "@/lib/sheets";

type TabSummary = {
  name: string;
  total: number;
  pending: number;
  ok: number;
  rejected: number;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const decoded = decodeURIComponent(domain);
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

    return NextResponse.json({ tabs: summaries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
