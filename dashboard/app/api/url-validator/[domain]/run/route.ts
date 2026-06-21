import { NextRequest } from "next/server";
import { existsSync } from "fs";
import { scanAll } from "@/lib/url-validator";
import { writeToSheets, writeToConsolidatedSheet } from "@/lib/url-validator-sheets";
import { getUrlValidatorSheetId, getUrlValidatorContentDir, getUrlValidatorConsolidatedSpreadsheetId } from "@/lib/url-validator-config";
import { invalidateCache } from "@/lib/cache";
import { logAgentRun, logAgentMetric, productName, type AgentLogEntry } from "@/lib/agent-logger";

type Params = Promise<{ domain: string }>;

export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded        = decodeURIComponent(domain);
  const contentDir      = getUrlValidatorContentDir(decoded);
  const consolidatedId  = getUrlValidatorConsolidatedSpreadsheetId();
  const legacyId        = getUrlValidatorSheetId(decoded);
  const spreadsheetId   = consolidatedId ?? legacyId;

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
          send({ type: "error", message: `No sheet configured for ${decoded}. Set URL_VALIDATOR_SPREADSHEET_ID or URL_VALIDATOR_SHEET_ID_* in .env.local.` });
          return;
        }

        send({ type: "start" });

        const run_id = crypto.randomUUID();
        const startTime = Date.now();

        const { issues, stats } = scanAll(contentDir, (product, postCount) => {
          send({ type: "progress", product, postCount });
        });

        send({ type: "scan_complete", stats, issueCount: issues.length });

        if (consolidatedId) {
          await writeToConsolidatedSheet(issues, stats, decoded, consolidatedId);
        } else {
          await writeToSheets(issues, stats, spreadsheetId);
        }
        invalidateCache(`urlresults:${decoded}`);
        invalidateCache(`urlsummary:${decoded}`);

        const run_duration_ms = Date.now() - startTime;
        const website = decoded.replace(/^blog\./, "");
        const timestamp = new Date().toISOString();
        const isProd = process.env.NODE_ENV === "production";
        const run_env = isProd ? "PROD" : "DEV";
        const job_type = isProd ? "URL Validation" : "test";

        const issuesByProduct: Record<string, number> = {};
        for (const issue of issues) {
          issuesByProduct[issue.product] = (issuesByProduct[issue.product] ?? 0) + 1;
        }

        const logEntries: AgentLogEntry[] = Object.entries(issuesByProduct).map(
          ([dir, count]) => ({
            timestamp,
            agent_name: "Blog URL Validator",
            agent_owner: "Shoaib Khan",
            job_type,
            run_id,
            status: "success",
            product: productName(decoded, dir),
            platform: "All",
            website,
            website_section: "Blog",
            item_name: "URL Issues",
            items_discovered: count,
            items_failed: 0,
            items_succeeded: count,
            run_duration_ms,
            token_usage: 0,
            api_calls_count: 0,
            run_env,
          })
        );

        const summaryEntry: AgentLogEntry = {
          timestamp,
          agent_name: "Blog URL Validator",
          agent_owner: "Shoaib Khan",
          job_type,
          run_id,
          status: "success",
          product: productName(decoded, "total"),
          platform: "All",
          website,
          website_section: "Blog",
          item_name: "URL Issues",
          items_discovered: issues.length,
          items_failed: 0,
          items_succeeded: issues.length,
          run_duration_ms,
          token_usage: 0,
          api_calls_count: 0,
          run_env,
        };

        const loggedOk = await logAgentRun(logEntries);
        await logAgentMetric(summaryEntry);
        send({ type: "log_status", success: loggedOk, count: logEntries.length });

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
