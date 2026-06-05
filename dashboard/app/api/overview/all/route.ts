import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, TTL_KEYWORDS } from "@/lib/cache";
import { DOMAIN_LABELS } from "@/lib/config";

const TTL = TTL_KEYWORDS;
const DOMAINS = Object.keys(DOMAIN_LABELS);
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return data.error || data.notConfigured ? null : (data as T);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const key = "overview:all";

  if (!refresh) {
    const hit = getCached<object>(key, TTL);
    if (hit) return NextResponse.json(hit);
  }

  const results = await Promise.all(
    DOMAINS.map(async (domain) => {
      const enc = encodeURIComponent(domain);
      const [kw, opt, url] = await Promise.all([
        safeFetch<{ tabs: { name: string; total: number; queued: number; approved: number; rejected: number; generated: number }[] }>(
          `${BASE}/api/sheets/${enc}/summary`
        ),
        safeFetch<{ pending: number; high: number; medium: number; optimized: number; page2: number; avgPosition: number; avgCtr: number }>(
          `${BASE}/api/optimization/${enc}/summary`
        ),
        safeFetch<{ totalIssues: number; productsAffected: number; latestScan: string | null }>(
          `${BASE}/api/url-validator/${enc}/summary`
        ),
      ]);

      const kwTotals = kw?.tabs?.reduce(
        (acc, t) => ({ queued: acc.queued + t.queued, approved: acc.approved + t.approved, generated: acc.generated + t.generated }),
        { queued: 0, approved: 0, generated: 0 }
      ) ?? null;

      return { domain, kw: kwTotals, opt, url };
    })
  );

  const data = { domains: results };
  setCached(key, data);
  return NextResponse.json(data);
}
