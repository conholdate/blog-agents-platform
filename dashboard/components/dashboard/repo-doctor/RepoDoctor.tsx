"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Loader2, ExternalLink, CheckCircle2, AlertCircle, RefreshCw, BarChart2, Wrench, X, HelpCircle, History } from "lucide-react";
import { ISSUE_TYPE_COLORS, type RepoIssueType } from "./shared";
import { HowItWorks } from "./HowItWorks";
import { FixedIssuesList } from "./FixedIssuesList";

type ScanPhase = "idle" | "running" | "done" | "error";

interface ScanProgress {
  stage: string | null;
  issueCount: number | null;
  errorMsg: string | null;
}

type FixStrategy = "deterministic" | "llm-assisted" | "manual";

interface RepoIssue {
  id: string;
  type: RepoIssueType;
  sourceKey: string | null;
  currentValue: string | null;
  suggestedValue: string | null;
  rawLine: string | null;
  line: number | null;
  fixStrategy: FixStrategy;
  explanation: string;
  suggestedFixDescription: string;
  severity: "error" | "warning";
}

interface ScanResult {
  domain: string;
  filePath: string;
  scannedAt: string;
  entryCount: number;
  issues: RepoIssue[];
  notConfigured?: true;
  error?: string;
}

interface Status {
  configured: boolean;
  owner: string | null;
  repo: string | null;
  filePath: string | null;
  writeTokenConfigured: boolean;
}

interface FixPreview {
  previewId: string;
  issueId: string;
  beforeSnippet: string;
  afterSnippet: string | null;
}

type IssueFixState =
  | { phase: "idle" }
  | { phase: "previewing" }
  | { phase: "previewed"; preview: FixPreview }
  | { phase: "manual"; message?: string }
  | { phase: "confirming"; preview: FixPreview }
  | { phase: "done"; prUrl: string; prNumber: number }
  | { phase: "error"; message: string };

interface Props {
  domain: string;
}

export function RepoDoctor({ domain }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState<ScanProgress>({ stage: null, issueCount: null, errorMsg: null });
  const [results, setResults] = useState<ScanResult | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [logStatus, setLogStatus] = useState<{ success: boolean; count: number } | null>(null);
  const [fixStates, setFixStates] = useState<Record<string, IssueFixState>>({});
  const [view, setView] = useState<"open" | "fixed">("open");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const base = `/api/repo-doctor/${encodeURIComponent(domain)}`;

  useEffect(() => {
    setPhase("idle");
    setProgress({ stage: null, issueCount: null, errorMsg: null });
    setResults(null);
    setFilterType("all");
    setLogStatus(null);
    setFixStates({});

    fetch(`${base}/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, owner: null, repo: null, filePath: null, writeTokenConfigured: false }));

    loadResults();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  function loadResults(forceRefresh = false) {
    setResultsLoading(true);
    const url = forceRefresh ? `${base}/results?refresh=1` : `${base}/results`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setResults(data))
      .catch((e) => setResults({ domain, filePath: "", scannedAt: "", entryCount: 0, issues: [], error: e.message }))
      .finally(() => setResultsLoading(false));
  }

  async function runScan() {
    if (phase === "running") return;
    abortRef.current = new AbortController();
    setPhase("running");
    setProgress({ stage: null, issueCount: null, errorMsg: null });
    setFixStates({});

    try {
      const res = await fetch(`${base}/run`, { method: "POST", signal: abortRef.current.signal });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "progress") {
            setProgress((p) => ({ ...p, stage: event.stage }));
          } else if (event.type === "scan_complete") {
            setProgress((p) => ({ ...p, issueCount: event.issueCount }));
          } else if (event.type === "log_status") {
            setLogStatus({ success: event.success, count: event.count });
          } else if (event.type === "done") {
            setPhase("done");
            loadResults(true);
          } else if (event.type === "error") {
            setProgress((p) => ({ ...p, errorMsg: event.message }));
            setPhase("error");
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setProgress((p) => ({ ...p, errorMsg: (e as Error).message }));
        setPhase("error");
      }
    }
  }

  async function previewFix(issue: RepoIssue) {
    setFixStates((s) => ({ ...s, [issue.id]: { phase: "previewing" } }));
    try {
      const res = await fetch(`${base}/fix/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: issue.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFixStates((s) => ({ ...s, [issue.id]: { phase: "error", message: data.error ?? "Preview failed." } }));
        return;
      }
      if (data.manual) {
        setFixStates((s) => ({ ...s, [issue.id]: { phase: "manual", message: data.message } }));
        return;
      }
      setFixStates((s) => ({ ...s, [issue.id]: { phase: "previewed", preview: data } }));
    } catch (e) {
      setFixStates((s) => ({ ...s, [issue.id]: { phase: "error", message: (e as Error).message } }));
    }
  }

  async function confirmFix(issue: RepoIssue, preview: FixPreview) {
    setFixStates((s) => ({ ...s, [issue.id]: { phase: "confirming", preview } }));
    try {
      const res = await fetch(`${base}/fix/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: issue.id, previewId: preview.previewId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFixStates((s) => ({ ...s, [issue.id]: { phase: "error", message: data.error ?? "Fix failed." } }));
        return;
      }
      setFixStates((s) => ({ ...s, [issue.id]: { phase: "done", prUrl: data.prUrl, prNumber: data.prNumber } }));
    } catch (e) {
      setFixStates((s) => ({ ...s, [issue.id]: { phase: "error", message: (e as Error).message } }));
    }
  }

  function cancelPreview(issueId: string) {
    setFixStates((s) => ({ ...s, [issueId]: { phase: "idle" } }));
  }

  const typeCounts: Record<string, number> = {};
  for (const issue of results?.issues ?? []) {
    typeCounts[issue.type] = (typeCounts[issue.type] ?? 0) + 1;
  }

  const filteredIssues = filterType === "all"
    ? (results?.issues ?? [])
    : (results?.issues ?? []).filter((i) => i.type === filterType);

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Repo Doctor</h1>
          {results && !results.error && !results.notConfigured && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {results.scannedAt && (
                <>Last scan: <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(results.scannedAt).toLocaleString()}</span>{" · "}</>
              )}
              <span className="font-medium text-slate-700 dark:text-slate-300">{results.issues?.length ?? 0} issue{(results.issues?.length ?? 0) !== 1 ? "s" : ""}</span>
              {status?.owner && status?.repo && (
                <>
                  {" · "}
                  <a
                    href={`https://github.com/${status.owner}/${status.repo}/blob/HEAD/${status.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    {status.owner}/{status.repo} <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {phase === "done" && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" /> Scan complete
            </span>
          )}
          {logStatus && (
            <span className={`flex items-center gap-1.5 text-sm ${logStatus.success ? "text-indigo-600 dark:text-indigo-400" : "text-red-500 dark:text-red-400"}`}>
              <BarChart2 className="h-4 w-4" />
              {logStatus.success ? "Metrics logged" : "Metrics logging failed"}
            </span>
          )}
          {phase === "error" && (
            <span className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
              <AlertCircle className="h-4 w-4" /> {progress.errorMsg ?? "Error"}
            </span>
          )}

          <button
            onClick={() => setShowHowItWorks(true)}
            title="How Repo Doctor works"
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => loadResults(true)}
            disabled={resultsLoading}
            title="Refresh results"
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resultsLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={runScan}
            disabled={phase === "running" || !status?.configured}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-medium transition-colors shadow-sm"
          >
            {phase === "running" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Scanning…</>) : (<><Play className="h-4 w-4" /> Run Scan</>)}
          </button>
        </div>
      </div>

      {/* Open / Fixed toggle */}
      <div className="flex items-center gap-1 p-1 mb-5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 w-fit">
        <button
          onClick={() => setView("open")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${view === "open" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Open Issues
        </button>
        <button
          onClick={() => setView("fixed")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${view === "fixed" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
        >
          <History className="h-3.5 w-3.5" />
          Fixed
        </button>
      </div>

      {view === "fixed" && <FixedIssuesList domain={domain} />}

      {view === "open" && (<>

      {/* Scan progress */}
      {phase === "running" && (
        <div className="mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-red-500" />
            <span>{progress.stage === "fetching" ? "Fetching and scanning the redirects file…" : "Scanning…"}</span>
          </div>
        </div>
      )}

      {/* Setup hints */}
      {status && !status.configured && (
        <div className="mb-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium mb-1">Repo Doctor isn&apos;t configured for {domain} yet</p>
          <p className="text-amber-700 dark:text-amber-400">Add its content repo and redirects file path to lib/repo-doctor/repo-doctor-config.ts.</p>
        </div>
      )}
      {status?.configured && !status.writeTokenConfigured && (
        <div className="mb-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium mb-1">Fix It is disabled — no write token configured</p>
          <p className="text-amber-700 dark:text-amber-400">Scanning still works. Set GITHUB_WRITE_TOKEN in dashboard/.env.local to enable opening fix PRs.</p>
        </div>
      )}

      {/* Results */}
      {resultsLoading && !results && (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading results…</span>
        </div>
      )}

      {results?.error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          {results.error}
        </div>
      )}

      {results && !results.error && !results.notConfigured && (results.issues?.length ?? 0) === 0 && !resultsLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 dark:text-green-400" />
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">All clear!</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">No issues found in {status?.filePath ?? "the redirects file"}.</p>
        </div>
      )}

      {results && !results.error && (results.issues?.length ?? 0) > 0 && (
        <>
          {/* Type filter chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                filterType === "all"
                  ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent"
                  : "bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400"
              }`}
            >
              All ({results.issues.length})
            </button>
            {Object.entries(typeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                    filterType === type
                      ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent"
                      : "bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400"
                  }`}
                >
                  {type.replace(/_/g, " ")} ({count})
                </button>
              ))}
          </div>

          {/* Issue cards */}
          <div className="flex flex-col gap-3">
            {filteredIssues.map((issue) => {
              const fixState: IssueFixState = fixStates[issue.id] ?? { phase: "idle" };
              return (
                <div key={issue.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ISSUE_TYPE_COLORS[issue.type]}`}>
                      {issue.type.replace(/_/g, " ")}
                    </span>
                    {issue.sourceKey && <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400 truncate">{issue.sourceKey}</span>}
                    {issue.line != null && <span className="text-[11px] text-slate-400 dark:text-slate-500">line {issue.line}</span>}
                  </div>

                  {issue.rawLine != null && (
                    <pre className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-2.5 text-[12px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                      {issue.rawLine}
                    </pre>
                  )}

                  <p className="text-sm text-slate-700 dark:text-slate-300">{issue.explanation}</p>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Suggested fix:</span> {issue.suggestedFixDescription}
                  </p>

                  {fixState.phase === "previewed" && (
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-3 text-[12px] font-mono flex flex-col gap-1">
                      <div className="flex gap-2">
                        <span className="text-red-500 dark:text-red-400 shrink-0">−</span>
                        <span className="text-slate-600 dark:text-slate-400 break-all">{fixState.preview.beforeSnippet}</span>
                      </div>
                      {fixState.preview.afterSnippet != null && (
                        <div className="flex gap-2">
                          <span className="text-green-600 dark:text-green-400 shrink-0">+</span>
                          <span className="text-slate-700 dark:text-slate-200 break-all">{fixState.preview.afterSnippet}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {issue.fixStrategy === "manual" || fixState.phase === "manual" ? (
                      <span className="px-2.5 py-1 rounded-lg text-[12px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                        Needs manual review
                      </span>
                    ) : fixState.phase === "idle" || fixState.phase === "error" ? (
                      <button
                        onClick={() => previewFix(issue)}
                        disabled={!status?.writeTokenConfigured}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[12px] font-medium transition-colors"
                      >
                        <Wrench className="h-3.5 w-3.5" /> Fix It
                      </button>
                    ) : fixState.phase === "previewing" ? (
                      <span className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing fix…
                      </span>
                    ) : fixState.phase === "previewed" ? (
                      <>
                        <button
                          onClick={() => confirmFix(issue, fixState.preview)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[12px] font-medium transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Confirm &amp; Open PR
                        </button>
                        <button
                          onClick={() => cancelPreview(issue.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 text-[12px] font-medium transition-colors"
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </>
                    ) : fixState.phase === "confirming" ? (
                      <span className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening pull request…
                      </span>
                    ) : fixState.phase === "done" ? (
                      <a
                        href={fixState.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-[12px] font-medium hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> PR #{fixState.prNumber} opened
                      </a>
                    ) : null}

                    {fixState.phase === "error" && (
                      <span className="text-[12px] text-red-500 dark:text-red-400">{fixState.message}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      </>)}

      <HowItWorks open={showHowItWorks} onClose={() => setShowHowItWorks(false)} />
    </div>
  );
}
