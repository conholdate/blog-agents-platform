import { NextRequest, NextResponse } from "next/server";
import { confirmFix, RepoDoctorError } from "@/lib/repo-doctor/repo-doctor";
import { logAgentMetric, type AgentLogEntry } from "@/lib/agent-logger";

type Params = Promise<{ domain: string }>;

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  let issueId: string;
  let previewId: string;
  try {
    const body = await req.json();
    if (typeof body.issueId !== "string" || !body.issueId || typeof body.previewId !== "string" || !body.previewId) {
      throw new Error("issueId and previewId are required");
    }
    issueId = body.issueId;
    previewId = body.previewId;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON with issueId and previewId strings." }, { status: 400 });
  }

  try {
    const result = await confirmFix(decoded, issueId, previewId);

    const website = decoded.replace(/^blog\./, "");
    const isProd = process.env.NODE_ENV === "production";
    const metricEntry: AgentLogEntry = {
      timestamp: new Date().toISOString(),
      agent_name: "Repo Doctor",
      agent_owner: "Shoaib Khan",
      job_type: isProd ? "Repo Doctor Fix" : "test",
      run_id: crypto.randomUUID(),
      status: "success",
      product: website,
      platform: "All",
      website,
      website_section: "Blog",
      item_name: "Fix PRs Opened",
      items_discovered: 1,
      items_failed: 0,
      items_succeeded: 1,
      run_duration_ms: 0,
      token_usage: 0,
      api_calls_count: 0,
      run_env: isProd ? "PROD" : "DEV",
    };
    await logAgentMetric(metricEntry);

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof RepoDoctorError) {
      const status = e.code === "PREVIEW_EXPIRED" || e.code === "STALE_FILE" ? 409 : e.code === "NOT_CONFIGURED" ? 400 : 500;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    // Octokit request errors carry a numeric `.status` (e.g. 422 if the branch already exists).
    const octokitStatus = (e as { status?: number } | null)?.status;
    if (octokitStatus === 422) {
      return NextResponse.json({ error: "A branch for this fix already exists. Try again in a moment." }, { status: 422 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
