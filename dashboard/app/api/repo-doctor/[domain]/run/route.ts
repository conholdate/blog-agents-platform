import { NextRequest } from "next/server";
import { scanDomain } from "@/lib/repo-doctor/repo-doctor";
import { getRepoDoctorTarget } from "@/lib/repo-doctor/repo-doctor-config";
import { setCached } from "@/lib/cache";
import { logAgentRun, logAgentMetric, type AgentLogEntry } from "@/lib/agent-logger";

type Params = Promise<{ domain: string }>;

export const maxDuration = 120;

export async function POST(_req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);
  const target = getRepoDoctorTarget(decoded);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (!target) {
          send({ type: "error", message: `Repo Doctor is not configured for ${decoded}. Set it up in lib/repo-doctor/repo-doctor-config.ts.` });
          return;
        }

        send({ type: "start" });
        const run_id = crypto.randomUUID();
        const startTime = Date.now();

        send({ type: "progress", stage: "fetching" });
        const result = await scanDomain(decoded);

        send({ type: "scan_complete", issueCount: result.issues.length });
        setCached(`repo-doctor:results:${decoded}`, result);

        const run_duration_ms = Date.now() - startTime;
        const website = decoded.replace(/^blog\./, "");
        const timestamp = new Date().toISOString();
        const isProd = process.env.NODE_ENV === "production";
        const run_env = isProd ? "PROD" : "DEV";
        const job_type = isProd ? "Repo Doctor Scan" : "test";

        const summaryEntry: AgentLogEntry = {
          timestamp,
          agent_name: "Repo Doctor",
          agent_owner: "Shoaib Khan",
          job_type,
          run_id,
          status: "success",
          product: target.filePath,
          platform: "All",
          website,
          website_section: "Blog",
          item_name: "Repo Issues",
          items_discovered: result.issues.length,
          items_failed: 0,
          items_succeeded: result.issues.length,
          run_duration_ms,
          token_usage: 0,
          api_calls_count: 0,
          run_env,
        };

        const loggedOk = await logAgentRun([summaryEntry]);
        await logAgentMetric(summaryEntry);
        send({ type: "log_status", success: loggedOk, count: 1 });

        send({ type: "done", issueCount: result.issues.length });
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
