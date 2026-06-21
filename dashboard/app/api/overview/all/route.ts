import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, TTL_KEYWORDS } from "@/lib/cache";
import { DOMAIN_LABELS } from "@/lib/config";
import { getKeywordSummary } from "@/lib/sheets";
import { getOptimizationSummary } from "@/lib/optimizationSheets";
import { getUrlValidatorSummary } from "@/lib/url-validator-sheets";
import { getTranslationSummary } from "@/lib/translationSheets";

const TTL = TTL_KEYWORDS;
const DOMAINS = Object.keys(DOMAIN_LABELS);

// Returns null on failure or when a tool isn't configured for this domain, instead of
// throwing — one domain/tool failing shouldn't blank out the rest of the table.
async function safeCall<T extends object>(fn: () => Promise<T>): Promise<T | null> {
  try {
    const result = await fn();
    return "notConfigured" in result ? null : result;
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
      const [kw, opt, url, tr] = await Promise.all([
        safeCall(() => getKeywordSummary(domain)),
        safeCall(() => getOptimizationSummary(domain)),
        safeCall(() => getUrlValidatorSummary(domain)),
        safeCall(() => getTranslationSummary(domain)),
      ]);

      const kwTotals = kw?.reduce(
        (acc, t) => ({ queued: acc.queued + t.queued, approved: acc.approved + t.approved, generated: acc.generated + t.generated }),
        { queued: 0, approved: 0, generated: 0 }
      ) ?? null;

      return { domain, kw: kwTotals, opt, url, tr };
    })
  );

  const data = { domains: results };
  setCached(key, data);
  return NextResponse.json(data);
}
