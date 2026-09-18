import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, TTL_REPO_DOCTOR } from "@/lib/cache";
import { getFixLog } from "@/lib/repo-doctor/repo-doctor-sheets";

type Params = Promise<{ domain: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  // confirmFix() explicitly invalidates this key right after logging a fix, so a
  // fix you just confirmed shows up immediately rather than waiting out the TTL.
  const key = `repo-doctor:fix-log:${decoded}`;

  if (!refresh) {
    const hit = getCached<object>(key, TTL_REPO_DOCTOR);
    if (hit) return NextResponse.json(hit);
  }

  try {
    const entries = await getFixLog(decoded);
    const result = { entries };
    setCached(key, result);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
