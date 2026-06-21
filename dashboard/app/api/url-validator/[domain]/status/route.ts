import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { getUrlValidatorSheetId, getUrlValidatorContentDir, getUrlValidatorConsolidatedSpreadsheetId } from "@/lib/url-validator-config";

type Params = Promise<{ domain: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded      = decodeURIComponent(domain);
  const spreadsheetId = getUrlValidatorConsolidatedSpreadsheetId() ?? getUrlValidatorSheetId(decoded);
  const contentDir    = getUrlValidatorContentDir(decoded);
  const dirExists     = !!(contentDir && existsSync(contentDir));

  return NextResponse.json({
    canRun: dirExists && !!spreadsheetId,
    contentDir,
    dirExists,
    spreadsheetId,
  });
}
