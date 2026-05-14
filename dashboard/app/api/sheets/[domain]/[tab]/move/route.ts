import { NextRequest, NextResponse } from "next/server";
import { reorderRows } from "@/lib/sheets";
import { invalidateCache } from "@/lib/cache";

type Params = Promise<{ domain: string; tab: string }>;

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { domain, tab } = await params;
    const { writes } = await req.json() as {
      writes: { rowIndex: number; data: Record<string, string> }[];
    };

    if (!Array.isArray(writes) || writes.length === 0) {
      return NextResponse.json({ error: "writes array is required" }, { status: 400 });
    }

    const decoded = decodeURIComponent(domain);
    const decodedTab = decodeURIComponent(tab);
    await reorderRows(decoded, decodedTab, writes);
    invalidateCache(`rows:${decoded}:${decodedTab}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
