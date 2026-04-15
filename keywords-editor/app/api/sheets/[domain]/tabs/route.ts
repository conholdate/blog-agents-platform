import { NextRequest, NextResponse } from "next/server";
import { getSheetTabs } from "@/lib/sheets";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const tabs = await getSheetTabs(decodeURIComponent(domain));
    return NextResponse.json({ tabs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
