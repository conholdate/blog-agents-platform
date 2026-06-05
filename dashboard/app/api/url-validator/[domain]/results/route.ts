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
  const decoded      = decodeURIComponent(domain);
  const spreadsheetId = getUrlValidatorSheetId(decoded);

  if (!spreadsheetId) {
    return NextResponse.json({ issues: [], latestDate: null, availableDates: [], notConfigured: true });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const key = `urlresults:${decoded}`;

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
      return NextResponse.json({ issues: [], latestDate: null, availableDates: [], spreadsheetId });
    }

    const latestTab = dateTabs[0];
    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${latestTab}'!A1:I`,
    });

    const values = dataRes.data.values ?? [];
    if (values.length < 2) {
      return NextResponse.json({ issues: [], latestDate: latestTab, availableDates: dateTabs.slice(0, 10), spreadsheetId });
    }

    const headers = values[0] as string[];
    const issues = values.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (row[i] as string) ?? ""; });
      return obj;
    });

    const result = { issues, latestDate: latestTab, availableDates: dateTabs.slice(0, 10), spreadsheetId };
    setCached(key, result);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
