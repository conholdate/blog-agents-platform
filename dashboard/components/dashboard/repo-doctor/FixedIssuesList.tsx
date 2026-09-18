"use client";

import { useState, useEffect } from "react";
import { Loader2, ExternalLink, RefreshCw, CheckCircle2 } from "lucide-react";
import { ISSUE_TYPE_COLORS, type RepoIssueType } from "./shared";

interface FixLogEntry {
  timestamp: string;
  domain: string;
  issueType: string;
  sourceKey: string;
  before: string;
  after: string;
  prUrl: string;
  prNumber: number;
  rawLine: string;
  filePath: string;
}

// Reconstructs a "key": "value" line for entries logged before the Raw Line
// column existed (or for any row where it's otherwise empty) — not byte-identical
// to the original file formatting, but far more legible than the bare value alone.
function reconstructLine(sourceKey: string, value: string): string {
  return `${JSON.stringify(sourceKey)}: ${JSON.stringify(value)}`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

interface Props {
  domain: string;
}

export function FixedIssuesList({ domain }: Props) {
  const [entries, setEntries] = useState<FixLogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/repo-doctor/${encodeURIComponent(domain)}/fix-log`;

  function load(refresh = false) {
    setLoading(true);
    setError(null);
    fetch(refresh ? `${base}?refresh=1` : base)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEntries(data.entries ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setEntries(null);
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {entries ? `${entries.length} fix${entries.length !== 1 ? "es" : ""} logged` : ""}
        </span>
        <button
          onClick={() => load(true)}
          disabled={loading}
          title="Refresh"
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !entries && (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading fix history…</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {entries && entries.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center text-slate-400 dark:text-slate-500">
          <CheckCircle2 className="h-10 w-10" />
          <p className="text-base font-medium text-slate-600 dark:text-slate-400">No fixes logged yet</p>
          <p className="text-sm">Confirmed fixes will show up here, newest first.</p>
        </div>
      )}

      {entries && entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {entries.map((entry, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ISSUE_TYPE_COLORS[entry.issueType as RepoIssueType] ?? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                  {entry.issueType.replace(/_/g, " ")}
                </span>
                {entry.filePath && (
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 shrink-0">
                    {entry.filePath}
                  </span>
                )}
                <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400 truncate">{entry.sourceKey}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto shrink-0">{timeAgo(entry.timestamp)}</span>
              </div>

              {entry.rawLine ? (
                <pre className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-2.5 text-[12px] font-mono text-slate-500 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap break-all line-through decoration-red-400/70">
                  {entry.rawLine}
                </pre>
              ) : (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-3 text-[12px] font-mono flex flex-col gap-1">
                  <div className="flex gap-2">
                    <span className="text-red-500 dark:text-red-400 shrink-0">−</span>
                    <span className="text-slate-600 dark:text-slate-400 break-all">
                      {entry.sourceKey ? reconstructLine(entry.sourceKey, entry.before) : (entry.before || "(empty)")}
                    </span>
                  </div>
                  {entry.after && (
                    <div className="flex gap-2">
                      <span className="text-green-600 dark:text-green-400 shrink-0">+</span>
                      <span className="text-slate-700 dark:text-slate-200 break-all">
                        {entry.sourceKey ? reconstructLine(entry.sourceKey, entry.after) : entry.after}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <a
                href={entry.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-[12px] font-medium hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> PR #{entry.prNumber}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
