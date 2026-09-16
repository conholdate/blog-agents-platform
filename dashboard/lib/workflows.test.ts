import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  classifyWorkflowName,
  buildDeployments,
  buildDailyStats,
  latestDeployment,
  deploymentFailureCount,
  type WorkflowRun,
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
