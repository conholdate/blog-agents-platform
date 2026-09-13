"use client";

import { useState, useEffect } from "react";
import { BookMarked, Languages, TrendingUp, Link, Bot, Loader2, RefreshCw, Globe, GitBranch, Clock } from "lucide-react";
import { DOMAIN_LABELS } from "@/lib/config";
import type { Section } from "./Sidebar";
import type { TranslationSummary } from "@/lib/translationSheets";
import type { WorkflowsSummary } from "@/lib/workflows";
import { latestDeployment, deploymentFailureCount } from "@/lib/workflows";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { RunHistoryStrip } from "./RunHistoryStrip";
import { DailyRunsChart, formatDuration } from "./DailyRunsChart";
import { EnvTag, ProviderTag } from "./DeployTag";
import { formatScheduleTime } from "@/lib/format-time";

type TabSummary = { name: string; total: number; queued: number; approved: number; rejected: number; generated: number };

interface OverviewProps {
  domain: string;
  onNavigate: (section: Section) => void;
  onSelectDomain: (domain: string) => void;
}

interface OptimizationSummary { pending: number; high: number; medium: number; optimized: number; page2: number; avgPosition: number; avgImpressions: number; avgCtr: number; }
interface UrlValidatorSummary  { totalIssues: number; productsAffected: number; topErrors: { type: string; count: number }[]; latestScan: string | null; scansAvailable: number; }

interface DomainRow {
  domain: string;
  kw:  { queued: number; approved: number; generated: number } | null;
  opt: { pending: number; high: number; optimized: number } | null;
  url: { totalIssues: number; latestScan: string | null } | null;
  tr:  { missing: number; pending: number; completed: number } | null;
  wf:  WorkflowsSummary | null;
}

const WIP_CARDS: {
  section: Section; label: string; icon: React.ComponentType<{ className?: string }>;
  description: string; accentLight: string; iconBg: string; iconColor: string; viewColor?: string; ready?: boolean;
}[] = [
  { section: "translations",   label: "Translation Agent",     icon: Languages, description: "Track translation status per product and language",                          accentLight: "border-l-sky-500",    iconBg: "bg-sky-50 dark:bg-slate-600/70",     iconColor: "text-sky-600 dark:text-slate-300",     viewColor: "text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300",         ready: true },
  { section: "optimization",   label: "Optimization Agent",    icon: TrendingUp, description: "SEO optimization queue with priority scoring; track pending and optimized posts", accentLight: "border-l-emerald-500", iconBg: "bg-emerald-50 dark:bg-slate-600/70",  iconColor: "text-emerald-600 dark:text-slate-300", viewColor: "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300", ready: true },
  { section: "post-generation", label: "Post Generation Agent", icon: Bot,        description: "Generate full blog post drafts from keyword briefs using AI agents",          accentLight: "border-l-rose-500",   iconBg: "bg-rose-50 dark:bg-slate-600/70",    iconColor: "text-rose-600 dark:text-slate-300"   },
  { section: "url-validator",  label: "URL Validator",         icon: Link,       description: "Run URL validation scans and view reported issues",                          accentLight: "border-l-orange-500", iconBg: "bg-orange-50 dark:bg-slate-600/70",  iconColor: "text-orange-600 dark:text-slate-300",  viewColor: "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300",   ready: true },
  { section: "workflows",      label: "CI/CD Status",          icon: GitBranch,  description: "Recent GitHub Actions workflow runs for this domain's repo",                 accentLight: "border-l-violet-500", iconBg: "bg-violet-50 dark:bg-slate-600/70",  iconColor: "text-violet-600 dark:text-slate-300",  viewColor: "text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300",   ready: true },
];

/* ─── Single-domain view ─────────────────────────────────────────── */
function SingleDomainView({ domain, onNavigate }: { domain: string; onNavigate: (s: Section) => void }) {
  const [summary, setSummary]       = useState<TabSummary[] | null>(null);
  const [optSummary, setOptSummary] = useState<OptimizationSummary | null>(null);
  const [urlSummary, setUrlSummary] = useState<UrlValidatorSummary | null>(null);
  const [trSummary, setTrSummary]   = useState<TranslationSummary | null>(null);
  const [wfSummary, setWfSummary]   = useState<WorkflowsSummary | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  function load(refresh = false, signal?: AbortSignal) {
    setLoading(true); setSummary(null); setOptSummary(null); setUrlSummary(null); setTrSummary(null); setWfSummary(null); setError(null);
    const qs = refresh ? "?refresh=1" : "";
    const enc = encodeURIComponent(domain);
    // Swallow AbortError right at the fetch site (rather than letting it reject
    // through Promise.all) — an aborted request just means the domain changed
    // mid-flight, not a real failure, and this keeps it from ever surfacing as
    // an unhandled rejection in the console.
    const fetchJson = (url: string) =>
      fetch(url, { signal })
        .then((r) => r.json())
        .catch((e) => { if (e.name === "AbortError") return null; throw e; });

    Promise.all([
      fetchJson(`/api/sheets/${enc}/summary${qs}`),
      fetchJson(`/api/optimization/${enc}/summary${qs}`),
      fetchJson(`/api/url-validator/${enc}/summary${qs}`),
      fetchJson(`/api/translation/${enc}/summary${qs}`),
      fetchJson(`/api/workflows/${enc}/summary${qs}`),
    ])
      .then(([kw, opt, url, tr, wf]) => {
        if (signal?.aborted || kw == null) return;
        if (kw.error) throw new Error(kw.error);
        setSummary(kw.tabs);
        if (opt && !opt.error && !opt.notConfigured) setOptSummary(opt);
        if (url && !url.error && !url.notConfigured) setUrlSummary(url);
        if (tr && !tr.error && !tr.notConfigured) setTrSummary(tr);
        if (wf && !wf.error && !wf.notConfigured) setWfSummary(wf);
      })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }

  // Cancel in-flight requests when domain changes to avoid quota bursts.
  useEffect(() => {
    const controller = new AbortController();
    load(false, controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const totals = summary?.reduce(
    (acc, t) => ({ total: acc.total + t.total, queued: acc.queued + t.queued, approved: acc.approved + t.approved, rejected: acc.rejected + t.rejected, generated: acc.generated + t.generated }),
    { total: 0, queued: 0, approved: 0, rejected: 0, generated: 0 }
  );

  const health = !loading ? domainHealth({ opt: optSummary, url: urlSummary, tr: trSummary, wf: wfSummary }) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {health && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border ${
            health.dotClass.includes("green") ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
            : health.dotClass.includes("amber") ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
            : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${health.dotClass}`} />
            {health.label}
          </span>
        )}
        <button onClick={() => load(true)} disabled={loading} title="Refresh"
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Keyword Agent */}
        <div className="bg-white border border-slate-200 border-l-4 border-l-indigo-500 dark:bg-slate-700/50 dark:border-slate-600 dark:border-l-indigo-500 rounded-xl p-5 flex flex-col gap-4 shadow-sm dark:shadow-none hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-indigo-50 dark:bg-slate-600 p-2"><BookMarked className="h-4 w-4 text-indigo-600 dark:text-slate-200" /></div>
              <span className="text-[15px] font-semibold text-slate-900 dark:text-white">Keyword Agent</span>
            </div>
            <button onClick={() => onNavigate("keywords")} className="text-[12px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors font-medium">View →</button>
          </div>
          {loading && <div className="flex items-center gap-2 text-slate-400 text-sm py-2"><Loader2 className="h-4 w-4 animate-spin" /><span>Loading…</span></div>}
          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
          {!loading && totals && (<>
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="Queued"    value={totals.queued}    valueColor="text-amber-600 dark:text-amber-400"   bgClass="bg-amber-50 dark:bg-slate-800/60"  labelColor="text-amber-500/80 dark:text-slate-400" />
              <StatBox label="Approved"  value={totals.approved}  valueColor="text-green-700 dark:text-green-400"   bgClass="bg-green-50 dark:bg-slate-800/60"  labelColor="text-green-600/70 dark:text-slate-400" />
              <StatBox label="Rejected"  value={totals.rejected}  valueColor="text-red-600 dark:text-red-400"       bgClass="bg-red-50 dark:bg-slate-800/60"    labelColor="text-red-400/80 dark:text-slate-400" />
              <StatBox label="Generated" value={totals.generated} valueColor="text-indigo-600 dark:text-indigo-400" bgClass="bg-indigo-50 dark:bg-slate-800/60" labelColor="text-indigo-400/80 dark:text-slate-400" />
            </div>
            {totals.total > 0 && (
              <Meter label="Approved of total backlog" value={totals.approved} total={totals.total} fillClass="bg-green-500 dark:bg-green-400" trackClass="bg-green-100 dark:bg-slate-800/60" />
            )}
            <div className="flex flex-wrap gap-1.5">
              {summary!.map((tab) => (
                <span key={tab.name} className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px]">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{tab.name}</span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-green-600 dark:text-green-400 font-semibold">{tab.approved}</span>
                  <span className="text-slate-300 dark:text-slate-600">/</span>
                  <span className="text-slate-400 dark:text-slate-500">{tab.total}</span>
                </span>
              ))}
            </div>
          </>)}
        </div>

        {/* Other tool cards */}
        {WIP_CARDS.map(({ section, label, icon: Icon, description, accentLight, iconBg, iconColor, viewColor, ready }) => (
          <div key={section} className={`bg-white border border-slate-200 border-l-4 ${accentLight} dark:bg-slate-700/30 dark:border-slate-600/60 rounded-xl p-5 flex flex-col gap-3 shadow-sm dark:shadow-none hover:shadow-md transition-shadow ${ready ? "" : "opacity-80"}`}>
            <div className="flex items-center gap-2.5">
              <div className={`rounded-lg ${iconBg} p-2`}><Icon className={`h-4 w-4 ${iconColor}`} /></div>
              <span className={`text-[15px] font-semibold ${ready ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>{label}</span>
              {ready ? (
                <button onClick={() => onNavigate(section)} className={`ml-auto text-[12px] transition-colors font-medium ${viewColor ?? "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"}`}>View →</button>
              ) : (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30">Coming Soon</span>
              )}
            </div>
            {section === "translations" && trSummary ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Missing"   value={trSummary.missing}   valueColor="text-amber-600 dark:text-amber-400"   bgClass="bg-amber-50 dark:bg-slate-800/60"  labelColor="text-amber-500/80 dark:text-slate-400" />
                  <StatBox label="Pending"   value={trSummary.pending}   valueColor="text-sky-600 dark:text-sky-400"       bgClass="bg-sky-50 dark:bg-slate-800/60"    labelColor="text-sky-500/80 dark:text-slate-400" />
                  <StatBox label="Partial"   value={trSummary.partial}   valueColor="text-blue-600 dark:text-blue-400"     bgClass="bg-blue-50 dark:bg-slate-800/60"   labelColor="text-blue-500/80 dark:text-slate-400" />
                  <StatBox label="Completed" value={trSummary.completed} valueColor="text-green-700 dark:text-green-400"   bgClass="bg-green-50 dark:bg-slate-800/60"  labelColor="text-green-600/70 dark:text-slate-400" />
                </div>
                {trSummary.missing + trSummary.pending + trSummary.partial + trSummary.completed > 0 && (
                  <Meter
                    label="Fully translated"
                    value={trSummary.completed}
                    total={trSummary.missing + trSummary.pending + trSummary.partial + trSummary.completed}
                    fillClass="bg-sky-500 dark:bg-sky-400"
                    trackClass="bg-sky-100 dark:bg-slate-800/60"
                  />
                )}
              </div>
            ) : section === "url-validator" && urlSummary ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Total Issues" value={urlSummary.totalIssues}      valueColor="text-amber-600 dark:text-amber-400"   bgClass="bg-amber-50 dark:bg-slate-800/60"  labelColor="text-amber-500/80 dark:text-slate-400" />
                  <StatBox label="Products"     value={urlSummary.productsAffected} valueColor="text-indigo-600 dark:text-indigo-400" bgClass="bg-indigo-50 dark:bg-slate-800/60" labelColor="text-indigo-400/80 dark:text-slate-400" />
                  <StatBox label="Scans Run"    value={urlSummary.scansAvailable}   valueColor="text-slate-700 dark:text-slate-300"   bgClass="bg-slate-50 dark:bg-slate-800/60"  labelColor="text-slate-400 dark:text-slate-500" />
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 text-center">
                    <div className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{urlSummary.latestScan ?? "—"}</div>
                    <div className="text-[11px] mt-0.5 font-medium text-slate-400 dark:text-slate-500">Last Scan</div>
                  </div>
                </div>
                {urlSummary.topErrors.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {urlSummary.topErrors.map(({ type, count }) => (
                      <div key={type} className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-orange-400 dark:bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.round((count / urlSummary.totalIssues) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0 w-8 text-right">{count}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 truncate max-w-[140px]">{type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : section === "optimization" && optSummary ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Pending"   value={optSummary.pending}   valueColor="text-amber-600 dark:text-amber-400"   bgClass="bg-amber-50 dark:bg-slate-800/60"  labelColor="text-amber-500/80 dark:text-slate-400" />
                  <StatBox label="High"      value={optSummary.high}      valueColor="text-red-600 dark:text-red-400"       bgClass="bg-red-50 dark:bg-slate-800/60"    labelColor="text-red-400/80 dark:text-slate-400" />
                  <StatBox label="Medium"    value={optSummary.medium}    valueColor="text-orange-600 dark:text-orange-400" bgClass="bg-orange-50 dark:bg-slate-800/60" labelColor="text-orange-400/80 dark:text-slate-400" />
                  <StatBox label="Optimized" value={optSummary.optimized} valueColor="text-green-700 dark:text-green-400"   bgClass="bg-green-50 dark:bg-slate-800/60"  labelColor="text-green-600/70 dark:text-slate-400" />
                </div>
                {optSummary.pending + optSummary.optimized > 0 && (
                  <Meter
                    label="Optimized of tracked posts"
                    value={optSummary.optimized}
                    total={optSummary.pending + optSummary.optimized}
                    fillClass="bg-emerald-500 dark:bg-emerald-400"
                    trackClass="bg-emerald-100 dark:bg-slate-800/60"
                  />
                )}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Search performance (avg.)</p>
                  <div className="grid grid-cols-4 gap-2">
                    <StatBox label="Page 2"     value={optSummary.page2} valueColor="text-indigo-600 dark:text-indigo-400" bgClass="bg-indigo-50 dark:bg-slate-800/60" labelColor="text-indigo-400/80 dark:text-slate-400" />
                    <StatBox label="Position"   value={optSummary.avgPosition} valueColor="text-slate-700 dark:text-slate-300" bgClass="bg-slate-50 dark:bg-slate-800/60" labelColor="text-slate-400 dark:text-slate-500" />
                    <StatBox label="Impressions" value={optSummary.avgImpressions >= 1000 ? parseFloat((optSummary.avgImpressions / 1000).toFixed(1)) : optSummary.avgImpressions} valueColor="text-slate-700 dark:text-slate-300" bgClass="bg-slate-50 dark:bg-slate-800/60" labelColor="text-slate-400 dark:text-slate-500" suffix={optSummary.avgImpressions >= 1000 ? "k" : ""} />
                    <StatBox label="CTR"        value={optSummary.avgCtr} valueColor="text-slate-700 dark:text-slate-300" bgClass="bg-slate-50 dark:bg-slate-800/60" labelColor="text-slate-400 dark:text-slate-500" suffix="%" />
                  </div>
                </div>
              </div>
            ) : section === "workflows" && wfSummary ? (
              <div className="flex flex-col gap-3">
                {(() => {
                  const prod = latestDeployment(wfSummary.deployments, "production");
                  const staging = latestDeployment(wfSummary.deployments, "staging");
                  return (prod || staging) ? (
                    <div className="flex flex-col gap-1.5">
                      {prod && (
                        <a href={prod.latestRun.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] hover:opacity-80 transition-opacity">
                          <EnvTag env="production" />
                          <ProviderTag provider={prod.provider} />
                          <WorkflowStatusBadge status={prod.latestRun.status} conclusion={prod.latestRun.conclusion} />
                          <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">{formatDuration(prod.latestRun.durationSeconds)}</span>
                        </a>
                      )}
                      {staging && (
                        <a href={staging.latestRun.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] hover:opacity-80 transition-opacity">
                          <EnvTag env="staging" />
                          <ProviderTag provider={staging.provider} />
                          <WorkflowStatusBadge status={staging.latestRun.status} conclusion={staging.latestRun.conclusion} />
                          <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">{formatDuration(staging.latestRun.durationSeconds)}</span>
                        </a>
                      )}
                    </div>
                  ) : wfSummary.latestRun ? (
                    <a
                      href={wfSummary.latestRun.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={wfSummary.latestRun.workflowName}
                      className="flex items-center gap-2 min-w-0 text-[12px] text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                      <WorkflowStatusBadge status={wfSummary.latestRun.status} conclusion={wfSummary.latestRun.conclusion} />
                      <span className="truncate min-w-0">{wfSummary.latestRun.workflowName}</span>
                    </a>
                  ) : null;
                })()}

                <RunHistoryStrip runs={wfSummary.recentRuns} />

                <div className="flex items-end gap-4">
                  {wfSummary.successCount + wfSummary.failureCount > 0 && (
                    <div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
                        {Math.round((wfSummary.successCount / (wfSummary.successCount + wfSummary.failureCount)) * 100)}%
                      </div>
                      <div className="text-[11px] mt-1 font-medium text-slate-400 dark:text-slate-500">Success rate (last {wfSummary.successCount + wfSummary.failureCount + wfSummary.inProgressCount})</div>
                    </div>
                  )}
                  <div className="flex gap-3 text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400" />{wfSummary.successCount} success</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />{wfSummary.failureCount} failed</span>
                    {wfSummary.inProgressCount > 0 && (
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />{wfSummary.inProgressCount} running</span>
                    )}
                  </div>
                  {wfSummary.avgDurationSeconds != null && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5 ml-auto">avg {formatDuration(wfSummary.avgDurationSeconds)}</span>
                  )}
                </div>

                {wfSummary.dailyStats.length > 0 && <DailyRunsChart stats={wfSummary.dailyStats} variant="compact" />}

                {wfSummary.nextScheduledRun && (
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700/60 min-w-0">
                    <Clock className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="min-w-0">
                      Next scheduled: <span className="font-medium text-slate-600 dark:text-slate-300">{formatScheduleTime(wfSummary.nextScheduledRun.nextRunAt)}</span> ·{" "}
                      <span className="inline-block max-w-[160px] align-bottom truncate" title={wfSummary.nextScheduledRun.workflowName}>{wfSummary.nextScheduledRun.workflowName}</span>
                      {wfSummary.nextScheduledRun.description && <span className="block text-slate-400 dark:text-slate-500 mt-0.5">{wfSummary.nextScheduledRun.description}</span>}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Rolls each domain's per-tool signals into one glanceable status: critical
   (CI failing or high-priority SEO issues), attention (something pending), or clear. */
function domainHealth({ opt, url, tr, wf }: {
  opt: DomainRow["opt"]; url: DomainRow["url"]; tr: DomainRow["tr"]; wf: DomainRow["wf"];
}): { dotClass: string; label: string } {
  const prodFailures = wf ? deploymentFailureCount(wf.deployments, "production") : 0;
  const stagingFailures = wf ? deploymentFailureCount(wf.deployments, "staging") : 0;
  const otherCiFailures = wf ? Math.max(0, wf.failureCount - prodFailures - stagingFailures) : 0;

  if (prodFailures > 0) return { dotClass: "bg-red-500 dark:bg-red-400", label: "Production deploy failing" };
  if ((opt?.high ?? 0) > 0) return { dotClass: "bg-red-500 dark:bg-red-400", label: "High-priority SEO issues pending" };
  if (stagingFailures > 0 || otherCiFailures > 0 || (url?.totalIssues ?? 0) > 0 || (tr?.missing ?? 0) > 0 || (opt?.pending ?? 0) > 0) {
    return { dotClass: "bg-amber-400 dark:bg-amber-500", label: stagingFailures > 0 ? "Staging deploy failing" : "Items need attention" };
  }
  return { dotClass: "bg-green-500 dark:bg-green-400", label: "All clear" };
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

function timeUntil(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "any moment";
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

type DomainTab = "keywords" | "translations" | "optimization" | "url-validator" | "workflows";

const DOMAIN_TABS: { key: DomainTab; label: string; icon: React.ComponentType<{ className?: string }>; activeClass: string }[] = [
  { key: "keywords",      label: "Keywords",      icon: BookMarked,  activeClass: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" },
  { key: "translations",  label: "Translations",  icon: Languages,   activeClass: "bg-sky-50 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300" },
  { key: "optimization",  label: "Optimization",  icon: TrendingUp,  activeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  { key: "url-validator", label: "URL Validator", icon: Link,        activeClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" },
  { key: "workflows",     label: "CI/CD",         icon: GitBranch,   activeClass: "bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" },
];

function DomainCell({ domain, health }: { domain: string; health: { dotClass: string; label: string } }) {
  const meta = DOMAIN_LABELS[domain];
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full shrink-0 ${health.dotClass}`} title={health.label} />
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: meta?.brandColor ?? "#64748b" }} />
      <span className="font-medium text-slate-700 dark:text-slate-200">{meta?.label ?? domain}</span>
    </div>
  );
}

/* ─── All-domains view ───────────────────────────────────────────── */
function AllDomainsView({ onNavigate, onSelectDomain }: { onNavigate: (s: Section) => void; onSelectDomain: (d: string) => void }) {
  const [rows, setRows]     = useState<DomainRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [tab, setTab]       = useState<DomainTab>("keywords");

  function load(refresh = false) {
    setLoading(true); setRows(null); setError(null);
    fetch(`/api/overview/all${refresh ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setRows(d.domains); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  // load() resets state then fetches; intentional fetch-on-mount pattern.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  function goTo(domain: string, section: Section) {
    onSelectDomain(domain);
    onNavigate(section);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-x-auto">
          {DOMAIN_TABS.map(({ key, label, icon: Icon, activeClass }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all whitespace-nowrap ${
                tab === key ? `${activeClass} shadow-sm` : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-400 dark:text-slate-500">Health</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400" />Clear</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 dark:bg-amber-500" />Attention</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />Critical</span>
          </div>
          <button onClick={() => load(true)} disabled={loading} title="Refresh"
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading all domains…</span>
        </div>
      )}

      {!loading && rows && (
        <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            {tab === "keywords" && (
              <>
                <thead className="bg-slate-50 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Domain</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-amber-500">Queued</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-green-600 dark:text-green-400">Approved</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-indigo-500">Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                  {rows.map(({ domain, kw, opt, url, tr, wf }) => (
                    <tr key={domain} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <DomainCell domain={domain} health={domainHealth({ opt, url, tr, wf })} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {kw ? <button onClick={() => goTo(domain, "keywords")} className="font-mono text-amber-600 dark:text-amber-400 hover:underline">{kw.queued}</button> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {kw ? <button onClick={() => goTo(domain, "keywords")} className="font-mono text-green-600 dark:text-green-400 hover:underline">{kw.approved}</button> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {kw ? <button onClick={() => goTo(domain, "keywords")} className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline">{kw.generated}</button> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {tab === "translations" && (
              <>
                <thead className="bg-slate-50 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Domain</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-amber-500">Missing</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-sky-500">Pending</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-green-600 dark:text-green-400">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                  {rows.map(({ domain, opt, url, tr, wf }) => (
                    <tr key={domain} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <DomainCell domain={domain} health={domainHealth({ opt, url, tr, wf })} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {tr ? <button onClick={() => goTo(domain, "translations")} className="font-mono text-amber-600 dark:text-amber-400 hover:underline">{tr.missing}</button> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {tr ? <button onClick={() => goTo(domain, "translations")} className="font-mono text-sky-600 dark:text-sky-400 hover:underline">{tr.pending}</button> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {tr ? <button onClick={() => goTo(domain, "translations")} className="font-mono text-green-600 dark:text-green-400 hover:underline">{tr.completed}</button> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {tab === "optimization" && (
              <>
                <thead className="bg-slate-50 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Domain</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-amber-500">Pending</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-red-500">High</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-green-600 dark:text-green-400">Optimized</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                  {rows.map(({ domain, opt, url, tr, wf }) => (
                    <tr key={domain} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <DomainCell domain={domain} health={domainHealth({ opt, url, tr, wf })} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {opt ? <button onClick={() => goTo(domain, "optimization")} className="font-mono text-amber-600 dark:text-amber-400 hover:underline">{opt.pending}</button> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {opt ? <button onClick={() => goTo(domain, "optimization")} className="font-mono text-red-600 dark:text-red-400 hover:underline">{opt.high}</button> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {opt ? <button onClick={() => goTo(domain, "optimization")} className="font-mono text-green-600 dark:text-green-400 hover:underline">{opt.optimized}</button> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {tab === "url-validator" && (
              <>
                <thead className="bg-slate-50 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Domain</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-orange-500">Issues</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-slate-400">Last Scan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                  {rows.map(({ domain, opt, url, tr, wf }) => (
                    <tr key={domain} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <DomainCell domain={domain} health={domainHealth({ opt, url, tr, wf })} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {url ? <button onClick={() => goTo(domain, "url-validator")} className="font-mono text-orange-600 dark:text-orange-400 hover:underline">{url.totalIssues.toLocaleString()}</button> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {url?.latestScan ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {tab === "workflows" && (
              <>
                <thead className="bg-slate-50 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Domain</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-violet-500">Production</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-slate-400">Prod OK/Fail</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-slate-400">Staging</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-blue-500">Running</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-slate-400">Avg Build</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-slate-400">Last 14 Days</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-medium text-slate-400">Next Run</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                  {rows.map(({ domain, opt, url, tr, wf }) => {
                    const prod = wf ? latestDeployment(wf.deployments, "production") : null;
                    const staging = wf ? latestDeployment(wf.deployments, "staging") : null;
                    const prodDeployments = wf?.deployments.filter((d) => d.env === "production") ?? [];
                    const prodSuccessCount = prodDeployments.reduce((s, d) => s + d.successCount, 0);
                    const prodFailureCount = prodDeployments.reduce((s, d) => s + d.failureCount, 0);
                    return (
                      <tr key={domain} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <DomainCell domain={domain} health={domainHealth({ opt, url, tr, wf })} />
                        </td>
                        {/* Production: badge + provider + individual run duration + relative time */}
                        <td className="px-3 py-3 text-center">
                          {prod ? (
                            <button onClick={() => goTo(domain, "workflows")} className="flex flex-col items-center gap-1">
                              <span className="flex items-center gap-1.5">
                                <WorkflowStatusBadge status={prod.latestRun.status} conclusion={prod.latestRun.conclusion} />
                                <ProviderTag provider={prod.provider} />
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                {formatDuration(prod.latestRun.durationSeconds)} · {timeAgo(prod.latestRun.updatedAt)}
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {prodDeployments.length > 0 ? (
                            <button onClick={() => goTo(domain, "workflows")} className="font-mono hover:underline">
                              <span className="text-green-600 dark:text-green-400">{prodSuccessCount}</span>
                              <span className="text-slate-300 dark:text-slate-600"> / </span>
                              <span className="text-red-600 dark:text-red-400">{prodFailureCount}</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        {/* Staging: compact secondary indicator */}
                        <td className="px-3 py-3 text-center">
                          {staging ? (
                            <button onClick={() => goTo(domain, "workflows")} className="inline-flex items-center gap-1.5">
                              <WorkflowStatusBadge status={staging.latestRun.status} conclusion={staging.latestRun.conclusion} />
                              <ProviderTag provider={staging.provider} />
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {wf && wf.inProgressCount > 0 ? (
                            <span className="inline-flex items-center gap-1 font-mono text-blue-600 dark:text-blue-400"><span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />{wf.inProgressCount}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDuration(wf?.avgDurationSeconds ?? null)}
                        </td>
                        <td className="px-3 py-3">
                          {wf && wf.dailyStats.length > 0 ? (
                            <div className="w-28 mx-auto">
                              <DailyRunsChart stats={wf.dailyStats} variant="compact" />
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 block text-center">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {wf?.nextScheduledRun ? timeUntil(wf.nextScheduledRun.nextRunAt) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </>
            )}
          </table>
          </div>
        </div>
      )}

      {/* Mobile: stacked cards instead of the wide table */}
      {!loading && rows && (
        <div className="md:hidden flex flex-col gap-3">
          {rows.map((row) => {
            const meta = DOMAIN_LABELS[row.domain];
            const health = domainHealth(row);
            return (
              <div key={row.domain} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${health.dotClass}`} title={health.label} />
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: meta?.brandColor ?? "#64748b" }} />
                  <span className="font-semibold text-slate-800 dark:text-white text-[14px]">{meta?.label ?? row.domain}</span>
                </div>

                {tab === "keywords" && row.kw && (
                  <MobileMetricGroup label="Keywords" labelColor="text-indigo-500 dark:text-indigo-400" onClick={() => goTo(row.domain, "keywords")} metrics={[
                    { value: row.kw.queued, text: "queued", color: "text-amber-600 dark:text-amber-400" },
                    { value: row.kw.approved, text: "approved", color: "text-green-600 dark:text-green-400" },
                    { value: row.kw.generated, text: "generated", color: "text-indigo-600 dark:text-indigo-400" },
                  ]} />
                )}
                {tab === "translations" && row.tr && (
                  <MobileMetricGroup label="Translations" labelColor="text-sky-500 dark:text-sky-400" onClick={() => goTo(row.domain, "translations")} metrics={[
                    { value: row.tr.missing, text: "missing", color: "text-amber-600 dark:text-amber-400" },
                    { value: row.tr.pending, text: "pending", color: "text-sky-600 dark:text-sky-400" },
                    { value: row.tr.completed, text: "completed", color: "text-green-600 dark:text-green-400" },
                  ]} />
                )}
                {tab === "optimization" && row.opt && (
                  <MobileMetricGroup label="Optimization" labelColor="text-emerald-600 dark:text-emerald-400" onClick={() => goTo(row.domain, "optimization")} metrics={[
                    { value: row.opt.pending, text: "pending", color: "text-amber-600 dark:text-amber-400" },
                    { value: row.opt.high, text: "high", color: "text-red-600 dark:text-red-400" },
                    { value: row.opt.optimized, text: "optimized", color: "text-green-600 dark:text-green-400" },
                  ]} />
                )}
                {tab === "url-validator" && row.url && (
                  <MobileMetricGroup label="URL Validator" labelColor="text-orange-500 dark:text-orange-400" onClick={() => goTo(row.domain, "url-validator")} metrics={[
                    { value: row.url.totalIssues.toLocaleString(), text: "issues", color: "text-orange-600 dark:text-orange-400" },
                    { value: row.url.latestScan ?? "—", text: "last scan", color: "text-slate-500 dark:text-slate-400" },
                  ]} />
                )}
                {tab === "workflows" && row.wf && (() => {
                  const prod = latestDeployment(row.wf.deployments, "production");
                  const staging = latestDeployment(row.wf.deployments, "staging");
                  const prodDeployments = row.wf.deployments.filter((d) => d.env === "production");
                  const prodSuccessCount = prodDeployments.reduce((s, d) => s + d.successCount, 0);
                  const prodFailureCount = prodDeployments.reduce((s, d) => s + d.failureCount, 0);
                  return (
                    <button onClick={() => goTo(row.domain, "workflows")} className="w-full text-left rounded-lg bg-slate-50 dark:bg-slate-700/40 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors flex flex-col gap-2">
                      {prod && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <EnvTag env="production" />
                          <ProviderTag provider={prod.provider} />
                          <WorkflowStatusBadge status={prod.latestRun.status} conclusion={prod.latestRun.conclusion} />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{formatDuration(prod.latestRun.durationSeconds)} · {timeAgo(prod.latestRun.updatedAt)}</span>
                        </div>
                      )}
                      {prodDeployments.length > 0 && (
                        <span className="text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="font-mono font-semibold text-green-600 dark:text-green-400">{prodSuccessCount}</span>
                          <span className="text-slate-300 dark:text-slate-600"> / </span>
                          <span className="font-mono font-semibold text-red-600 dark:text-red-400">{prodFailureCount}</span> prod runs
                        </span>
                      )}
                      {staging && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <EnvTag env="staging" />
                          <ProviderTag provider={staging.provider} />
                          <WorkflowStatusBadge status={staging.latestRun.status} conclusion={staging.latestRun.conclusion} />
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
                        <span>avg {formatDuration(row.wf.avgDurationSeconds)}</span>
                      </div>
                      {row.wf.dailyStats.length > 0 && <DailyRunsChart stats={row.wf.dailyStats} variant="compact" />}
                      {row.wf.nextScheduledRun && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 min-w-0">
                          <span className="shrink-0">Next: {timeUntil(row.wf.nextScheduledRun.nextRunAt)} ·</span>
                          <span className="truncate min-w-0" title={row.wf.nextScheduledRun.workflowName}>{row.wf.nextScheduledRun.workflowName}</span>
                        </div>
                      )}
                    </button>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MobileMetricGroup({ label, labelColor, onClick, metrics }: {
  label: string; labelColor: string; onClick: () => void;
  metrics: { value: number | string; text: string; color: string }[];
}) {
  return (
    <button onClick={onClick} className="text-left rounded-lg bg-slate-50 dark:bg-slate-700/40 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
      <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${labelColor}`}>{label}</div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
        {metrics.map((m, i) => (
          <span key={i} className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
            <span className={`font-mono font-semibold ${m.color}`}>{m.value}</span> {m.text}
          </span>
        ))}
      </div>
    </button>
  );
}

/* ─── Main Overview ──────────────────────────────────────────────── */
export function Overview({ domain, onNavigate, onSelectDomain }: OverviewProps) {
  const [view, setView] = useState<"domain" | "all">("domain");

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Overview</h1>
        {/* Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
          <button
            onClick={() => setView("domain")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${view === "domain" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
          >
            <BookMarked className="h-3.5 w-3.5" />
            This Domain
          </button>
          <button
            onClick={() => setView("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${view === "all" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
          >
            <Globe className="h-3.5 w-3.5" />
            All Domains
          </button>
        </div>
      </div>

      {view === "domain"
        ? <SingleDomainView domain={domain} onNavigate={onNavigate} />
        : <AllDomainsView onNavigate={onNavigate} onSelectDomain={onSelectDomain} />
      }
    </div>
  );
}

function StatBox({ label, value, valueColor, bgClass, labelColor, suffix = "" }: {
  label: string; value: number; valueColor: string; bgClass: string; labelColor: string; suffix?: string;
}) {
  return (
    <div className={`${bgClass} rounded-lg p-3 text-center`}>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}{suffix}</div>
      <div className={`text-[11px] mt-0.5 font-medium ${labelColor}`}>{label}</div>
    </div>
  );
}

function Meter({ label, value, total, fillClass, trackClass }: {
  label: string; value: number; total: number; fillClass: string; trackClass: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300">{pct}%</span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${trackClass}`}>
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
