import { NextRequest, NextResponse } from "next/server";
import { getSheetRows, saveSheetRows } from "@/lib/sheets";

type Params = Promise<{ domain: string; tab: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { domain, tab } = await params;
    const rows = await getSheetRows(
      decodeURIComponent(domain),
      decodeURIComponent(tab)
    );
    return NextResponse.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { domain, tab } = await params;
    const body = await req.json();

    // body.changes: array of { rowIndex, key, value }
    const changes = body.changes as {
      rowIndex: number;
      key: string;
      value: string;
    }[];

    await saveSheetRows(
      decodeURIComponent(domain),
      decodeURIComponent(tab),
      changes
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
