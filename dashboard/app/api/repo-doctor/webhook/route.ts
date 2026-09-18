import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { scanDomain } from "@/lib/repo-doctor/repo-doctor";
import { getRepoDoctorTarget } from "@/lib/repo-doctor/repo-doctor-config";
import { setCached } from "@/lib/cache";

// First genuine inbound-authenticated webhook in this dashboard: the content
// repo's on-commit workflow POSTs here after a push touching the redirects file.
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.REPO_DOCTOR_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-repo-doctor-secret") ?? "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  // Length check first, before the constant-time compare — timingSafeEqual throws
  // (rather than returning false) on mismatched buffer lengths.
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let domain: string;
  try {
    const body = await req.json();
    if (typeof body.domain !== "string" || !body.domain) throw new Error("domain is required");
    domain = body.domain;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON with a domain string." }, { status: 400 });
  }

  if (!getRepoDoctorTarget(domain)) {
    return NextResponse.json({ error: `Repo Doctor is not configured for ${domain}.` }, { status: 400 });
  }

  try {
    const result = await scanDomain(domain);
    setCached(`repo-doctor:results:${domain}`, result);
    return NextResponse.json({ issueCount: result.issues.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
