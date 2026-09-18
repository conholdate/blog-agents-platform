import { NextRequest, NextResponse } from "next/server";
import { getRepoDoctorTarget } from "@/lib/repo-doctor/repo-doctor-config";
import { isGithubWriteConfigured } from "@/lib/repo-doctor/github";

type Params = Promise<{ domain: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);
  const target = getRepoDoctorTarget(decoded);

  return NextResponse.json({
    configured: target != null,
    owner: target?.owner ?? null,
    repo: target?.repo ?? null,
    filePath: target?.filePath ?? null,
    writeTokenConfigured: isGithubWriteConfigured(),
  });
}
