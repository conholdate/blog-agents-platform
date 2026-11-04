import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  classifyWorkflowName,
  buildDeployments,
  buildDailyStats,
  latestDeployment,
  deploymentFailureCount,
  describeCrons,
  withScheduledSlots,
  runOutcome,
  optionalRunColumns,
  matchesStatusFilter,
  describeRun,
  addRetryContext,
  applyRunJobs,
  type WorkflowRun,
  type WorkflowSchedule,
  type DeploymentStatus,
} from "./workflows";

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  const { env, provider } = classifyWorkflowName(overrides.workflowName ?? "");
  return {
    id: 1,
    workflowName: "Some Workflow",
    displayTitle: "",
    status: "completed",
    conclusion: "success",
    branch: "main",
    event: "push",
    actor: "someone",
    createdAt: "2026-09-10T10:00:00Z",
    updatedAt: "2026-09-10T10:05:00Z",
    runStartedAt: "2026-09-10T10:00:00Z",
    durationSeconds: 300,
    env,
    provider,
    htmlUrl: "https://github.com/example/repo/actions/runs/1",
    ...overrides,
  };
}

describe("describeCrons", () => {
  it("describes the schedules the blog repos use in GMT+5", () => {
    expect(describeCrons(["0 3 * * 1-5"])).toBe("At 08:00, Monday through Friday (GMT+5)");
    expect(describeCrons(["30 2 * * *"])).toBe("At 07:30 (GMT+5)");
  });

  it("wraps past midnight when no days are restricted", () => {
    expect(describeCrons(["30 22 * * *"])).toBe("At 03:30 (GMT+5)");
  });

  it("stays in UTC when shifting would need a day change or the hour isn't a single value", () => {
    expect(describeCrons(["0 21 * * 1-5"])).toBe("At 21:00, Monday through Friday (UTC)");
    expect(describeCrons(["0 */6 * * *"])).toBe("On the hour, every 6 hours (UTC)");
  });
});

describe("withScheduledSlots", () => {
  const schedule = { workflowName: "AWS Production - Pipeline", crons: ["0 3 * * 1-5"] } as WorkflowSchedule;

  it("matches a late scheduled run to the cron time it belongs to", () => {
    const run = makeRun({ workflowName: "AWS Production - Pipeline", event: "schedule", createdAt: "2026-11-03T10:28:14Z" });
    expect(withScheduledSlots([run], [schedule])[0].scheduledFor).toBe("2026-11-03T03:00:00.000Z");
  });

  it("leaves manual runs and workflows without a schedule alone", () => {
    const manual = makeRun({ workflowName: "AWS Production - Pipeline", event: "workflow_dispatch" });
    const unscheduled = makeRun({ workflowName: "Other", event: "schedule" });
    const [a, b] = withScheduledSlots([manual, unscheduled], [schedule]);
    expect(a.scheduledFor).toBeUndefined();
    expect(b.scheduledFor).toBeUndefined();
  });
});

describe("classifyWorkflowName", () => {
  it("detects production + aws from a real deploy workflow name", () => {
    expect(classifyWorkflowName("AWS Production - Pipeline")).toEqual({
      env: "production",
      provider: "aws",
    });
  });

  it("detects staging + ceph from a real deploy workflow name", () => {
    expect(classifyWorkflowName("Ceph Staging-2. Deploy Home Page Assets")).toEqual({
      env: "staging",
      provider: "ceph",
    });
  });

  it("falls back to other/other for non-deploy workflows", () => {
    expect(classifyWorkflowName("Translation Scan")).toEqual({
      env: "other",
      provider: "other",
    });
  });

  it("is case-insensitive", () => {
    expect(classifyWorkflowName("prod deploy")).toEqual({ env: "production", provider: "other" });
    expect(classifyWorkflowName("STAGING release")).toEqual({ env: "staging", provider: "other" });
    expect(classifyWorkflowName("deploy via AWS")).toEqual({ env: "other", provider: "aws" });
  });

  it("matches production before staging when both substrings appear", () => {
    expect(classifyWorkflowName("prod-then-staging-promote")).toEqual({
      env: "production",
      provider: "other",
    });
  });
});

describe("runOutcome", () => {
  it("reports success only for a successful completed run", () => {
    expect(runOutcome("completed", "success")).toBe("success");
  });

  it.each(["failure", "timed_out", "startup_failure"])("treats %s as failed", (conclusion) => {
    expect(runOutcome("completed", conclusion)).toBe("failed");
  });

  it.each(["in_progress", "queued", "waiting"])("treats %s as running", (status) => {
    expect(runOutcome(status, null)).toBe("running");
  });

  it("flags action_required for attention", () => {
    expect(runOutcome("completed", "action_required")).toBe("attention");
  });

  it.each(["cancelled", "skipped", "neutral", "stale"])("does not report %s as success", (conclusion) => {
    expect(runOutcome("completed", conclusion)).toBe("neutral");
  });
});

describe("describeRun", () => {
  const job = (name: string, conclusion: string | null) => ({ name, conclusion });

  it("reports a scheduled run that skipped every deploy job as no changes", () => {
    expect(describeRun("Deploy Production - AWS", "success", [job("check-changes", "success"), job("deploy", "skipped")]))
      .toBe("Skipped - No changes found");
  });

  it("reports no changes across a multi-job chain", () => {
    expect(describeRun("AWS Production - Pipeline", "success", [job("check-changes", "success"), job("job1", "skipped"), job("job2", "skipped"), job("job3", "skipped")]))
      .toBe("Skipped - No changes found");
  });

  it("reports a deploy when the change check found work", () => {
    expect(describeRun("Deploy Production - AWS", "success", [job("check-changes", "success"), job("deploy", "success")])).toBe("Deployed");
  });

  it("reports a manual deploy, which skips the change check, as deployed", () => {
    expect(describeRun("Deploy Production - AWS", "success", [job("check-changes", "skipped"), job("deploy", "success")])).toBe("Deployed");
  });

  it("recognizes deploy workflows that the env classifier doesn't", () => {
    expect(describeRun("Deploy to blog.groupdocs.com (S3)", "success", [job("build", "success")])).toBe("Deployed");
  });

  it("says nothing for a successful non-deploy workflow", () => {
    expect(describeRun("Scan Missing Translations", "success", [job("scan", "success")])).toBeNull();
  });

  it("names the job a failed run stopped at", () => {
    expect(describeRun("AWS Production - Pipeline", "failure", [job("job1", "success"), job("job2 / build-global", "failure"), job("job3", "skipped")]))
      .toBe("Failed at job2 / build-global");
  });

  it("names the job a timed-out run stopped at, even when the run itself reports failure", () => {
    expect(describeRun("Deploy Production - AWS", "failure", [job("deploy", "timed_out")])).toBe("Timed out at deploy");
    expect(describeRun("Deploy Production - AWS", "timed_out", [job("deploy", "timed_out")])).toBe("Timed out at deploy");
  });

  it("names the job a cancelled run stopped at", () => {
    expect(describeRun("AWS Production - Pipeline", "cancelled", [job("job1", "success"), job("job2", "cancelled")])).toBe("Cancelled during job2");
  });

  it("falls back to a plain outcome when no job explains it", () => {
    expect(describeRun("Deploy Production - AWS", "failure", [])).toBe("Failed");
    expect(describeRun("Deploy Production - AWS", "cancelled", [])).toBe("Cancelled");
    expect(describeRun("Deploy Production - AWS", "startup_failure", [])).toBe("Failed to start");
  });
});

describe("applyRunJobs", () => {
  const noChangeJobs = [{ name: "check-changes", conclusion: "success" }, { name: "deploy", conclusion: "skipped" }];

  it("reports a no-change run as skipped rather than success", () => {
    const result = applyRunJobs(makeRun({ workflowName: "Deploy Production - AWS", status: "completed", conclusion: "success" }), noChangeJobs);
    expect(result.conclusion).toBe("skipped");
    expect(result.comment).toBe("Skipped - No changes found");
  });

  it("keeps a real deploy as success", () => {
    const jobs = [{ name: "check-changes", conclusion: "success" }, { name: "deploy", conclusion: "success" }];
    const result = applyRunJobs(makeRun({ workflowName: "Deploy Production - AWS", status: "completed", conclusion: "success" }), jobs);
    expect(result.conclusion).toBe("success");
    expect(result.comment).toBe("Deployed");
  });

  it("leaves no-change runs out of deployment success counts and averages", () => {
    const createdAt = new Date().toISOString();
    const skipped = applyRunJobs(makeRun({ workflowName: "Production - AWS", status: "completed", conclusion: "success", createdAt, durationSeconds: 8 }), noChangeJobs);
    const deployed = makeRun({ workflowName: "Production - AWS", status: "completed", conclusion: "success", createdAt, durationSeconds: 100 });

    expect(buildDeployments([deployed, skipped])[0].successCount).toBe(1);
    const day = buildDailyStats([deployed, skipped], 3).find((s) => s.date === createdAt.slice(0, 10))!;
    expect(day).toMatchObject({ success: 1, other: 1, avgDurationSeconds: 100 });
  });
});

describe("startup_failure", () => {
  it("counts as a failure in deployment totals and daily stats", () => {
    const createdAt = new Date().toISOString();
    const run = makeRun({ workflowName: "Production - AWS", status: "completed", conclusion: "startup_failure", createdAt });
    expect(buildDeployments([run])[0].failureCount).toBe(1);
    expect(buildDailyStats([run], 3).find((s) => s.date === createdAt.slice(0, 10))!.failure).toBe(1);
  });
});

describe("addRetryContext", () => {
  const run = (id: number, conclusion: string, comment: string | null, overrides: Partial<{ event: string; workflowName: string; status: string }> = {}) => ({
    id, conclusion, comment, event: "schedule", workflowName: "Pipeline", status: "completed", ...overrides,
  });
  const chainedCheck = [{ name: "check-changes", steps: [{ name: "Find last deploy attempt", status: "completed", conclusion: "success" }] }];
  const simpleCheck = [{ name: "check-changes", steps: [{ name: "Check for new commits", status: "completed", conclusion: "success" }] }];

  it("says the change check was skipped for a chained pipeline after a failure", () => {
    const result = addRetryContext([run(2, "success", "Deployed"), run(1, "failure", "Failed at job2")], new Map([[2, chainedCheck]]));
    expect(result[0].comment).toBe("Last build failed - Change check skipped");
  });

  it("says deployed again when the workflow still ran its check", () => {
    const result = addRetryContext([run(2, "success", "Deployed"), run(1, "failure", "Failed at deploy")], new Map([[2, simpleCheck]]));
    expect(result[0].comment).toBe("Last build failed - Deployed again");
  });

  it("names a cancelled previous attempt", () => {
    const result = addRetryContext([run(2, "success", "Deployed"), run(1, "cancelled", "Cancelled")], new Map([[2, chainedCheck]]));
    expect(result[0].comment).toBe("Last build cancelled - Change check skipped");
  });

  it("looks past no-change runs to the last real attempt", () => {
    const result = addRetryContext(
      [run(3, "success", "Deployed"), run(2, "success", "Skipped - No changes found"), run(1, "failure", "Failed at job1")],
      new Map([[3, simpleCheck]])
    );
    expect(result[0].comment).toBe("Last build failed - Deployed again");
  });

  it("leaves a deploy alone when the last attempt succeeded", () => {
    const result = addRetryContext([run(2, "success", "Deployed"), run(1, "success", "Deployed")], new Map([[2, chainedCheck]]));
    expect(result[0].comment).toBe("Deployed");
  });

  it("only compares runs of the same workflow", () => {
    const result = addRetryContext([run(2, "success", "Deployed"), run(1, "failure", "Failed", { workflowName: "Other" })], new Map([[2, chainedCheck]]));
    expect(result[0].comment).toBe("Deployed");
  });

  it("leaves manual runs alone, since a person chose to run them", () => {
    const result = addRetryContext([run(2, "success", "Deployed", { event: "workflow_dispatch" }), run(1, "failure", "Failed")], new Map());
    expect(result[0].comment).toBe("Deployed");
  });

  it("ignores an older run that is still in progress", () => {
    const result = addRetryContext([run(2, "success", "Deployed"), run(1, "", null, { status: "in_progress" })], new Map([[2, chainedCheck]]));
    expect(result[0].comment).toBe("Deployed");
  });
});

describe("matchesStatusFilter", () => {
  it("matches everything for all", () => {
    expect(matchesStatusFilter("completed", "cancelled", "all")).toBe(true);
    expect(matchesStatusFilter("in_progress", null, "all")).toBe(true);
  });

  it("includes every failure conclusion under failed", () => {
    for (const conclusion of ["failure", "timed_out", "startup_failure"]) {
      expect(matchesStatusFilter("completed", conclusion, "failed")).toBe(true);
    }
    expect(matchesStatusFilter("completed", "success", "failed")).toBe(false);
  });

  it("matches unfinished runs under running", () => {
    expect(matchesStatusFilter("queued", null, "running")).toBe(true);
    expect(matchesStatusFilter("completed", "success", "running")).toBe(false);
  });

  it("groups cancelled, skipped and action_required under other", () => {
    for (const conclusion of ["cancelled", "skipped", "action_required"]) {
      expect(matchesStatusFilter("completed", conclusion, "other")).toBe(true);
    }
    expect(matchesStatusFilter("completed", "failure", "other")).toBe(false);
    expect(matchesStatusFilter("completed", "success", "other")).toBe(false);
  });
});

describe("optionalRunColumns", () => {
  const run = { workflowName: "Deploy", displayTitle: "Deploy", branch: "main", actor: "a" };

  it("hides all three when nothing varies", () => {
    expect(optionalRunColumns([run, run])).toEqual({ title: false, branch: false, actor: false });
  });

  it("shows title when any run's title differs from its workflow name", () => {
    expect(optionalRunColumns([run, { ...run, displayTitle: "Fix typo" }]).title).toBe(true);
  });

  it("shows title for a single run with its own title", () => {
    expect(optionalRunColumns([{ ...run, displayTitle: "Fix typo" }]).title).toBe(true);
  });

  it("does not show title just because workflow names differ", () => {
    expect(optionalRunColumns([run, { ...run, workflowName: "Other", displayTitle: "Other" }]).title).toBe(false);
  });

  it("shows branch and actor only when they vary", () => {
    expect(optionalRunColumns([run, { ...run, branch: "dev" }]).branch).toBe(true);
    expect(optionalRunColumns([run, { ...run, actor: "b" }]).actor).toBe(true);
    expect(optionalRunColumns([run, { ...run, actor: null }]).actor).toBe(true);
  });
});

describe("buildDeployments", () => {
  it("drops runs that don't classify into a known env/provider", () => {
    const runs = [makeRun({ workflowName: "Translation Scan" })];
    expect(buildDeployments(runs)).toEqual([]);
  });

  it("groups by (env, provider) and counts success/failure across the bucket", () => {
    const runs: WorkflowRun[] = [
      makeRun({ id: 3, workflowName: "AWS Production - Pipeline", status: "completed", conclusion: "success", updatedAt: "2026-09-10T12:00:00Z" }),
      makeRun({ id: 2, workflowName: "AWS Production - Pipeline", status: "completed", conclusion: "failure", updatedAt: "2026-09-10T11:00:00Z" }),
      makeRun({ id: 1, workflowName: "AWS Production - Pipeline", status: "completed", conclusion: "success", updatedAt: "2026-09-10T10:00:00Z" }),
    ];

    const deployments = buildDeployments(runs);
    expect(deployments).toHaveLength(1);
    expect(deployments[0]).toMatchObject({
      env: "production",
      provider: "aws",
      successCount: 2,
      failureCount: 1,
    });
  });

  it("treats a timed_out run as a failure", () => {
    const runs = [makeRun({ workflowName: "AWS Production - Pipeline", status: "completed", conclusion: "timed_out" })];
    expect(buildDeployments(runs)[0]).toMatchObject({ successCount: 0, failureCount: 1 });
  });

  it("takes the first run per bucket as latestRun, since input is newest-first", () => {
    const runs: WorkflowRun[] = [
      makeRun({ id: 2, workflowName: "AWS Production - Pipeline", updatedAt: "2026-09-10T12:00:00Z", htmlUrl: "https://x/2" }),
      makeRun({ id: 1, workflowName: "AWS Production - Pipeline", updatedAt: "2026-09-10T10:00:00Z", htmlUrl: "https://x/1" }),
    ];
    expect(buildDeployments(runs)[0].latestRun.htmlUrl).toBe("https://x/2");
  });

  it("sorts production before staging, then providers alphabetically", () => {
    const runs: WorkflowRun[] = [
      makeRun({ workflowName: "Ceph Staging-2. Deploy" }),
      makeRun({ workflowName: "AWS Staging - Pipeline" }),
      makeRun({ workflowName: "Ceph Production - Pipeline" }),
      makeRun({ workflowName: "AWS Production - Pipeline" }),
    ];
    const keys = buildDeployments(runs).map((d) => `${d.env}:${d.provider}`);
    expect(keys).toEqual([
      "production:aws",
      "production:ceph",
      "staging:aws",
      "staging:ceph",
    ]);
  });
});

describe("buildDailyStats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T18:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("zero-fills every day in the window, even with no runs", () => {
    const stats = buildDailyStats([], 3);
    expect(stats.map((s) => s.date)).toEqual(["2026-09-08", "2026-09-09", "2026-09-10"]);
    expect(stats.every((s) => s.success === 0 && s.failure === 0 && s.other === 0)).toBe(true);
    expect(stats.every((s) => s.avgDurationSeconds === null)).toBe(true);
  });

  it("buckets runs into success/failure/other by UTC created date", () => {
    const runs: WorkflowRun[] = [
      makeRun({ createdAt: "2026-09-09T08:00:00Z", status: "completed", conclusion: "success", durationSeconds: 100 }),
      makeRun({ createdAt: "2026-09-09T09:00:00Z", status: "completed", conclusion: "failure", durationSeconds: 200 }),
      makeRun({ createdAt: "2026-09-09T10:00:00Z", status: "in_progress", conclusion: null, durationSeconds: null }),
      makeRun({ createdAt: "2026-09-09T11:00:00Z", status: "completed", conclusion: "cancelled", durationSeconds: 50 }),
    ];
    const stats = buildDailyStats(runs, 3);
    const day = stats.find((s) => s.date === "2026-09-09")!;
    expect(day).toMatchObject({ success: 1, failure: 1, other: 2 });
    expect(day.avgDurationSeconds).toBe(117); // avg of all durations that day (100, 200, 50), regardless of conclusion
  });

  it("excludes days outside the window", () => {
    const runs: WorkflowRun[] = [makeRun({ createdAt: "2026-08-01T00:00:00Z" })];
    const stats = buildDailyStats(runs, 3);
    expect(stats.every((s) => s.success === 0)).toBe(true);
  });
});

describe("latestDeployment", () => {
  function makeDeployment(overrides: Partial<DeploymentStatus> = {}): DeploymentStatus {
    return {
      env: "production",
      provider: "aws",
      latestRun: { status: "completed", conclusion: "success", updatedAt: "2026-09-10T10:00:00Z", durationSeconds: 100, workflowName: "w", htmlUrl: "https://x" },
      successCount: 1,
      failureCount: 0,
      ...overrides,
    };
  }

  it("returns null when no deployment matches the env", () => {
    expect(latestDeployment([makeDeployment({ env: "staging" })], "production")).toBeNull();
  });

  it("picks the most recently updated deployment among matches", () => {
    const older = makeDeployment({ provider: "aws", latestRun: { ...makeDeployment().latestRun, updatedAt: "2026-09-10T10:00:00Z" } });
    const newer = makeDeployment({ provider: "ceph", latestRun: { ...makeDeployment().latestRun, updatedAt: "2026-09-10T12:00:00Z" } });
    expect(latestDeployment([older, newer], "production")).toBe(newer);
  });
});

describe("deploymentFailureCount", () => {
  it("sums failureCount only across deployments matching the given env", () => {
    const deployments: DeploymentStatus[] = [
      { env: "production", provider: "aws", failureCount: 2, successCount: 0, latestRun: { status: "completed", conclusion: "failure", updatedAt: "2026-09-10T10:00:00Z", durationSeconds: 1, workflowName: "w", htmlUrl: "https://x" } },
      { env: "production", provider: "ceph", failureCount: 3, successCount: 0, latestRun: { status: "completed", conclusion: "failure", updatedAt: "2026-09-10T10:00:00Z", durationSeconds: 1, workflowName: "w", htmlUrl: "https://x" } },
      { env: "staging", provider: "aws", failureCount: 10, successCount: 0, latestRun: { status: "completed", conclusion: "failure", updatedAt: "2026-09-10T10:00:00Z", durationSeconds: 1, workflowName: "w", htmlUrl: "https://x" } },
    ];
    expect(deploymentFailureCount(deployments, "production")).toBe(5);
  });
});
