import { NextRequest, NextResponse } from "next/server";
import { getSheetTabs } from "@/lib/sheets";
import { DOMAINS } from "@/lib/config";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const decoded = decodeURIComponent(domain);
    const tabs = await getSheetTabs(decoded);
    const sheetId = DOMAINS[decoded] ?? "";
    const sheetUrl = sheetId
      ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
      : null;
    return NextResponse.json({ tabs, sheetUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
