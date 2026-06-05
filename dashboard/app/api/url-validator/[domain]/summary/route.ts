import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getUrlValidatorSheetId } from "@/lib/url-validator-config";
import { getCached, setCached, TTL_URL_VALIDATOR } from "@/lib/cache";

type Params = Promise<{ domain: string }>;

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

const TTL = TTL_URL_VALIDATOR;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);
  const spreadsheetId = getUrlValidatorSheetId(decoded);

  if (!spreadsheetId) {
    return NextResponse.json({ notConfigured: true });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const key = `urlsummary:${decoded}`;

  if (!refresh) {
    const hit = getCached<object>(key, TTL);
    if (hit) return NextResponse.json(hit);
  }

  try {
    const sheets = google.sheets({ version: "v4", auth: getAuth() });

    const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
    const dateTabs = (metaRes.data.sheets ?? [])
      .map((s) => s.properties?.title ?? "")
      .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t))
      .sort()
      .reverse();

    if (dateTabs.length === 0) {
      return NextResponse.json({ totalIssues: 0, productsAffected: 0, topErrors: [], latestScan: null, scansAvailable: 0 });
    }

    const latestTab = dateTabs[0];
    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${latestTab}'!A1:I`,
    });

    const values = dataRes.data.values ?? [];
    if (values.length < 2) {
      return NextResponse.json({ totalIssues: 0, productsAffected: 0, topErrors: [], latestScan: latestTab, scansAvailable: dateTabs.length });
    }

    const headers = values[0] as string[];
    const iProduct   = headers.findIndex((h) => h.toLowerCase() === "product");
    const iErrorType = headers.findIndex((h) => h.toLowerCase() === "error type");

    const rows = values.slice(1);
    const products  = new Set<string>();
    const errorCounts: Record<string, number> = {};

    for (const row of rows) {
      const product   = (row[iProduct]   as string ?? "").trim();
      const errorType = (row[iErrorType] as string ?? "").trim();
      if (product)   products.add(product);
      if (errorType) errorCounts[errorType] = (errorCounts[errorType] ?? 0) + 1;
    }

    const topErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));

    const result = {
      totalIssues:      rows.length,
      productsAffected: products.size,
      topErrors,
      latestScan:       latestTab,
      scansAvailable:   dateTabs.length,
    };

    setCached(key, result);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
