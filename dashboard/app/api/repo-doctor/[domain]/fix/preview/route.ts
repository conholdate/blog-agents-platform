import { NextRequest, NextResponse } from "next/server";
import { previewFix, RepoDoctorError } from "@/lib/repo-doctor/repo-doctor";

type Params = Promise<{ domain: string }>;

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  let issueId: string;
  try {
    const body = await req.json();
    if (typeof body.issueId !== "string" || !body.issueId) throw new Error("issueId is required");
    issueId = body.issueId;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON with an issueId string." }, { status: 400 });
  }

  try {
    const preview = await previewFix(decoded, issueId);
    if (preview == null) {
      return NextResponse.json({ manual: true });
    }
    return NextResponse.json(preview);
  } catch (e) {
    if (e instanceof RepoDoctorError) {
      if (e.code === "NO_FIX_AVAILABLE") {
        return NextResponse.json({ manual: true, message: e.message });
      }
      const status = e.code === "ISSUE_NOT_FOUND" ? 409 : e.code === "NOT_CONFIGURED" ? 400 : 500;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
