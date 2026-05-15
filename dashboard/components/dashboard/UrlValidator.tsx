"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Loader2, ExternalLink, CheckCircle2, AlertCircle, RefreshCw, BarChart2 } from "lucide-react";

type ScanPhase = "idle" | "running" | "done" | "error";

interface ScanProgress {
  scanned: string[];
  issueCount: number | null;
  stats: { products: number; posts: number; files: number } | null;
  errorMsg: string | null;
}

interface ResultIssue {
  "#": string;
  Product: string;
  "Post Folder": string;
  Language: string;
  "Error Type": string;
  "Current URL": string;
  "Expected URL": string;
  Notes: string;
  "Redirect Rule": string;
}

interface Results {
  issues: ResultIssue[];
  latestDate: string | null;
  availableDates: string[];
  spreadsheetId?: string;
  error?: string;
}

interface Status {
  canRun: boolean;
  contentDir: string | null;
  dirExists: boolean;
  spreadsheetId: string | null;
}

const ERROR_COLORS: Record<string, string> = {
  MISSING_URL:               "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  MISSING_TRAILING_SLASH:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  WRONG_PRODUCT:             "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  LANG_CODE_MISMATCH:        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  URL_MISMATCH_WITH_ENGLISH: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  NO_ENGLISH_BASE:           "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  URL_TOO_SHORT:             "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  DATE_BASED_URL:            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

interface Props {
  domain: string;
}

export function UrlValidator({ domain }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState<ScanProgress>({ scanned: [], issueCount: null, stats: null, errorMsg: null });
  const [results, setResults] = useState<Results | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [logStatus, setLogStatus] = useState<{ success: boolean; count: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const base = `/api/url-validator/${encodeURIComponent(domain)}`;

  useEffect(() => {
    setPhase("idle");
    setProgress({ scanned: [], issueCount: null, stats: null, errorMsg: null });
    setResults(null);
    setFilterType("all");
    setLogStatus(null);

    fetch(`${base}/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ canRun: false, contentDir: null, dirExists: false, spreadsheetId: null }));

    loadResults();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  function loadResults(forceRefresh = false) {
    setResultsLoading(true);
    const url = forceRefresh ? `${base}/results?refresh=1` : `${base}/results`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setResults(data))
      .catch((e) => setResults({ issues: [], latestDate: null, availableDates: [], error: e.message }))
      .finally(() => setResultsLoading(false));
  }

  async function runScan() {
    if (phase === "running") return;
    abortRef.current = new AbortController();
    setPhase("running");
    setProgress({ scanned: [], issueCount: null, stats: null, errorMsg: null });

    try {
      const res = await fetch(`${base}/run`, {
        method: "POST",
        signal: abortRef.current.signal,
      });

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
            setProgress((p) => ({ ...p, scanned: [...p.scanned, event.product] }));
          } else if (event.type === "scan_complete") {
            setProgress((p) => ({ ...p, stats: event.stats, issueCount: event.issueCount }));
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

  // Error type counts for filter chips
  const errorTypeCounts: Record<string, number> = {};
  for (const issue of results?.issues ?? []) {
    const t = issue["Error Type"];
    errorTypeCounts[t] = (errorTypeCounts[t] ?? 0) + 1;
  }

  const filteredIssues = filterType === "all"
    ? (results?.issues ?? [])
    : (results?.issues ?? []).filter((i) => i["Error Type"] === filterType);

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">URL Validator</h1>
          {results?.latestDate && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Last scan: <span className="font-medium text-slate-700 dark:text-slate-300">{results.latestDate}</span>
              {" · "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{results.issues?.length ?? 0} issues</span>
              {results.spreadsheetId && (
                <>
                  {" · "}
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${results.spreadsheetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    Open Sheet <ExternalLink className="h-3 w-3" />
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
              {logStatus.success
                ? `Metrics logged (${logStatus.count} product${logStatus.count !== 1 ? "s" : ""})`
                : "Metrics logging failed"}
            </span>
          )}
          {phase === "error" && (
            <span className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
              <AlertCircle className="h-4 w-4" /> {progress.errorMsg ?? "Error"}
            </span>
          )}

          <button
            onClick={() => loadResults(true)}
            disabled={resultsLoading}
            title="Refresh results"
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resultsLoading ? "animate-spin" : ""}`} />
          </button>

          {status?.canRun ? (
            <button
              onClick={runScan}
              disabled={phase === "running"}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium transition-colors shadow-sm"
            >
              {phase === "running" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Scanning…</>
              ) : (
                <><Play className="h-4 w-4" /> Run Scan</>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-sm border border-slate-200 dark:border-slate-600 cursor-not-allowed select-none"
              title="Set BLOG_CONTENT_DIR in dashboard/.env.local to enable running scans">
              <Play className="h-4 w-4" /> Run Scan
            </div>
          )}
        </div>
      </div>

      {/* Scan progress */}
      {phase === "running" && (
        <div className="mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-3">
            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
            <span>Scanning blog content…</span>
            {progress.stats && (
              <span className="ml-auto text-slate-400 dark:text-slate-500">
                {progress.stats.files.toLocaleString()} files · {progress.stats.posts.toLocaleString()} posts
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {progress.scanned.map((p) => (
              <span key={p} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                ✓ {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Setup hint if can't run */}
      {status && !status.canRun && (
        <div className="mb-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium mb-1">Run Scan requires local setup</p>
          <p className="text-amber-700 dark:text-amber-400">
            Add <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">BLOG_CONTENT_DIR</code> and{" "}
            <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">URL_VALIDATOR_SHEET_ID</code> to{" "}
            <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">dashboard/.env.local</code>.{" "}
            Viewing previous results still works from anywhere.
          </p>
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
          {/permission|forbidden|caller does not have/i.test(results.error)
            ? `This tool currently does not have permission to access the sheet for ${domain}. Share the spreadsheet with the service account and try again.`
            : results.error}
        </div>
      )}

      {results && !results.error && results.latestDate === null && !resultsLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center text-slate-400 dark:text-slate-500">
          <span className="text-4xl">🔍</span>
          <p className="text-base font-medium text-slate-600 dark:text-slate-400">No scan results yet</p>
          <p className="text-sm">
            {status?.canRun
              ? "Click \"Run Scan\" to scan the blog and write results to Google Sheets."
              : "Configure BLOG_CONTENT_DIR locally and run a scan to see results here."}
          </p>
        </div>
      )}

      {results && !results.error && results.latestDate && (results.issues?.length ?? 0) === 0 && !resultsLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 dark:text-green-400" />
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">All clear!</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No URL issues found in the <span className="font-medium text-slate-700 dark:text-slate-300">{results.latestDate}</span> scan.
          </p>
        </div>
      )}

      {results && (results.issues?.length ?? 0) > 0 && (
        <>
          {/* Error type filter chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                filterType === "all"
                  ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent"
                  : "bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400"
              }`}
            >
              All ({results.issues?.length ?? 0})
            </button>
            {Object.entries(errorTypeCounts)
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

          {/* Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Product</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Lang</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Error</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400">Current URL</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400">Expected URL</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400">Redirect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredIssues.slice(0, 500).map((issue, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{issue.Product}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{issue.Language}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ERROR_COLORS[issue["Error Type"]] ?? "bg-slate-100 text-slate-600"}`}>
                          {issue["Error Type"].replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] max-w-[240px] truncate" title={issue["Current URL"]}>
                        {issue["Current URL"]
                          ? <a href={`https://${domain}${issue["Current URL"]}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">{issue["Current URL"]}</a>
                          : <span className="italic text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-mono text-[11px] max-w-[240px] truncate" title={issue["Expected URL"]}>
                        {issue["Expected URL"]}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {issue["Redirect Rule"]
                          ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Redirect Required</span>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredIssues.length > 500 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 text-[12px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>Showing 500 of {filteredIssues.length} issues</span>
                {results.spreadsheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${results.spreadsheetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    View all in Google Sheets <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
