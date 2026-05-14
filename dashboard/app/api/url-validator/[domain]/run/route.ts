import { NextRequest } from "next/server";
import { existsSync } from "fs";
import { scanAll } from "@/lib/url-validator";
import { writeToSheets } from "@/lib/url-validator-sheets";
import { getUrlValidatorSheetId, getUrlValidatorContentDir } from "@/lib/url-validator-config";
import { invalidateCache } from "@/lib/cache";

type Params = Promise<{ domain: string }>;

export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded      = decodeURIComponent(domain);
  const contentDir    = getUrlValidatorContentDir(decoded);
  const spreadsheetId = getUrlValidatorSheetId(decoded);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (!contentDir || !existsSync(contentDir)) {
          send({ type: "error", message: `Content directory not configured for ${decoded}. Set URL_VALIDATOR_CONTENT_DIR_* in .env.local.` });
          return;
        }
        if (!spreadsheetId) {
          send({ type: "error", message: `No sheet configured for ${decoded}. Set URL_VALIDATOR_SHEET_ID_* in .env.local.` });
          return;
        }

        send({ type: "start" });

        const { issues, stats } = scanAll(contentDir, (product, postCount) => {
          send({ type: "progress", product, postCount });
        });

        send({ type: "scan_complete", stats, issueCount: issues.length });

        await writeToSheets(issues, stats, spreadsheetId);
        invalidateCache(`urlresults:${decoded}`);

        send({ type: "done", spreadsheetId, issueCount: issues.length });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
