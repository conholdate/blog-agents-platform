import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, TTL_REPO_DOCTOR } from "@/lib/cache";
import { getRepoDoctorTarget } from "@/lib/repo-doctor/repo-doctor-config";
import { scanDomain } from "@/lib/repo-doctor/repo-doctor";
import type { RepoDoctorScanResult, RepoDoctorSummary } from "@/lib/repo-doctor/types";

type Params = Promise<{ domain: string }>;

function summarize(result: RepoDoctorScanResult): RepoDoctorSummary {
  const byType: RepoDoctorSummary["byType"] = {};
  for (const issue of result.issues) byType[issue.type] = (byType[issue.type] ?? 0) + 1;
  return { totalIssues: result.issues.length, byType, lastScanAt: result.scannedAt };
}

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  if (!getRepoDoctorTarget(decoded)) {
    return NextResponse.json({ notConfigured: true });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  // Same cache key as results/route.ts — a summary fetch and a results fetch for
  // the same domain share one scan instead of triggering two GitHub round-trips.
  const key = `repo-doctor:results:${decoded}`;

  if (!refresh) {
    const hit = getCached<RepoDoctorScanResult>(key, TTL_REPO_DOCTOR);
    if (hit) return NextResponse.json(summarize(hit));
  }

  try {
    const result = await scanDomain(decoded);
    setCached(key, result);
    return NextResponse.json(summarize(result));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
