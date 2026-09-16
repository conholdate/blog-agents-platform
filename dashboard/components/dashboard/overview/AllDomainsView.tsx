"use client";

import { useState, useEffect } from "react";
import { BookMarked, Languages, TrendingUp, Link, Loader2, RefreshCw, GitBranch } from "lucide-react";
import { DOMAIN_LABELS } from "@/lib/config";
import type { Section } from "../Sidebar";
import { latestDeployment } from "@/lib/workflows/workflows";
import { WorkflowStatusBadge } from "../workflows/WorkflowStatusBadge";
import { DailyRunsChart, formatDuration } from "../workflows/DailyRunsChart";
import { EnvTag, ProviderTag } from "../workflows/DeployTag";
import { domainHealth, type DomainRow } from "./shared";

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

export function AllDomainsView({ onNavigate, onSelectDomain }: { onNavigate: (s: Section) => void; onSelectDomain: (d: string) => void }) {
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
