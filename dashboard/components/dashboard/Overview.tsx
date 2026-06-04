"use client";

import { useState, useEffect } from "react";
import { BookMarked, Languages, TrendingUp, Link, Bot, Loader2, RefreshCw } from "lucide-react";
import type { Section } from "./Sidebar";

type TabSummary = {
  name: string;
  total: number;
  queued: number;
  approved: number;
  rejected: number;
  generated: number;
};

interface OverviewProps {
  domain: string;
  onNavigate: (section: Section) => void;
}

const WIP_CARDS: {
  section: Section;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  accentLight: string;
  iconBg: string;
  iconColor: string;
  viewColor?: string;
  ready?: boolean;
}[] = [
  {
    section: "translations",
    label: "Translation Agent",
    icon: Languages,
    description: "Track translation status per product and language",
    accentLight: "border-l-sky-500",
    iconBg: "bg-sky-50 dark:bg-slate-600/70",
    iconColor: "text-sky-600 dark:text-slate-300",
  },
  {
    section: "optimization",
    label: "Optimization Agent",
    icon: TrendingUp,
    description: "SEO optimization queue with priority scoring; track pending and optimized posts per domain",
    accentLight: "border-l-emerald-500",
    iconBg: "bg-emerald-50 dark:bg-slate-600/70",
    iconColor: "text-emerald-600 dark:text-slate-300",
    viewColor: "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300",
    ready: true,
  },
  {
    section: "post-generation",
    label: "Post Generation Agent",
    icon: Bot,
    description: "Generate full blog post drafts from keyword briefs using AI agents",
    accentLight: "border-l-rose-500",
    iconBg: "bg-rose-50 dark:bg-slate-600/70",
    iconColor: "text-rose-600 dark:text-slate-300",
  },
  {
    section: "url-validator",
    label: "URL Validator",
    icon: Link,
    description: "Run URL validation scans and view reported issues",
    accentLight: "border-l-orange-500",
    iconBg: "bg-orange-50 dark:bg-slate-600/70",
    iconColor: "text-orange-600 dark:text-slate-300",
    viewColor: "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300",
    ready: true,
  },
];

interface OptimizationSummary {
  pending: number;
  high: number;
  medium: number;
  optimized: number;
  page2: number;
  avgPosition: number;
  avgImpressions: number;
  avgCtr: number;
}

interface UrlValidatorSummary {
  totalIssues: number;
  productsAffected: number;
  topErrors: { type: string; count: number }[];
  latestScan: string | null;
  scansAvailable: number;
}

export function Overview({ domain, onNavigate }: OverviewProps) {
  const [summary, setSummary]         = useState<TabSummary[] | null>(null);
  const [optSummary, setOptSummary]   = useState<OptimizationSummary | null>(null);
  const [urlSummary, setUrlSummary]   = useState<UrlValidatorSummary | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  function loadSummary(forceRefresh = false) {
    setLoading(true);
    setSummary(null);
    setOptSummary(null);
    setUrlSummary(null);
    setError(null);
    const qs = forceRefresh ? "?refresh=1" : "";
    const enc = encodeURIComponent(domain);
    Promise.all([
      fetch(`/api/sheets/${enc}/summary${qs}`).then((r) => r.json()),
      fetch(`/api/optimization/${enc}/summary${qs}`).then((r) => r.json()),
      fetch(`/api/url-validator/${enc}/summary${qs}`).then((r) => r.json()),
    ])
      .then(([kwData, optData, urlData]) => {
        if (kwData.error) throw new Error(kwData.error);
        setSummary(kwData.tabs);
        if (!optData.error && !optData.notConfigured) setOptSummary(optData);
        if (!urlData.error && !urlData.notConfigured) setUrlSummary(urlData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const totals = summary?.reduce(
    (acc, t) => ({
      total: acc.total + t.total,
      queued: acc.queued + t.queued,
      approved: acc.approved + t.approved,
      rejected: acc.rejected + t.rejected,
      generated: acc.generated + t.generated,
    }),
    { total: 0, queued: 0, approved: 0, rejected: 0, generated: 0 }
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Overview</h1>
        <button
          onClick={() => loadSummary(true)}
          disabled={loading}
          title="Refresh"
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

        {/* Keyword Agent card */}
        <div className="bg-white border border-slate-200 border-l-4 border-l-indigo-500 dark:bg-slate-700/50 dark:border-slate-600 dark:border-l-indigo-500 rounded-xl p-5 flex flex-col gap-4 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-indigo-50 dark:bg-slate-600 p-2">
                <BookMarked className="h-4 w-4 text-indigo-600 dark:text-slate-200" />
              </div>
              <span className="text-[15px] font-semibold text-slate-900 dark:text-white">Keyword Agent</span>
            </div>
            <button
              onClick={() => onNavigate("keywords")}
              className="text-[12px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors font-medium"
            >
              View →
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading stats…</span>
            </div>
          )}

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          {!loading && totals && (
            <>
              <div className="grid grid-cols-4 gap-2">
                <StatBox label="Queued" value={totals.queued}
                  valueColor="text-amber-600 dark:text-amber-400"
                  bgClass="bg-amber-50 dark:bg-slate-800/60"
                  labelColor="text-amber-500/80 dark:text-slate-400" />
                <StatBox label="Approved" value={totals.approved}
                  valueColor="text-green-700 dark:text-green-400"
                  bgClass="bg-green-50 dark:bg-slate-800/60"
                  labelColor="text-green-600/70 dark:text-slate-400" />
                <StatBox label="Rejected" value={totals.rejected}
                  valueColor="text-red-600 dark:text-red-400"
                  bgClass="bg-red-50 dark:bg-slate-800/60"
                  labelColor="text-red-400/80 dark:text-slate-400" />
                <StatBox label="Generated" value={totals.generated}
                  valueColor="text-indigo-600 dark:text-indigo-400"
                  bgClass="bg-indigo-50 dark:bg-slate-800/60"
                  labelColor="text-indigo-400/80 dark:text-slate-400" />
              </div>

              {/* Product chips — horizontal, space-efficient */}
              <div className="flex flex-wrap gap-1.5">
                {summary!.map((tab) => (
                  <span
                    key={tab.name}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px]"
                  >
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{tab.name}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-green-600 dark:text-green-400 font-semibold">{tab.approved}</span>
                    <span className="text-slate-300 dark:text-slate-600">/</span>
                    <span className="text-slate-400 dark:text-slate-500">{tab.total}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* WIP cards */}
        {WIP_CARDS.map(({ section, label, icon: Icon, description, accentLight, iconBg, iconColor, viewColor, ready }) => (
          <div
            key={section}
            className={`bg-white border border-slate-200 border-l-4 ${accentLight} dark:bg-slate-700/30 dark:border-slate-600/60 rounded-xl p-5 flex flex-col gap-3 shadow-sm dark:shadow-none ${ready ? "" : "opacity-80"}`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`rounded-lg ${iconBg} p-2`}>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <span className={`text-[15px] font-semibold ${ready ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>{label}</span>
              {ready ? (
                <button
                  onClick={() => onNavigate(section)}
                  className={`ml-auto text-[12px] transition-colors font-medium ${viewColor ?? "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"}`}
                >
                  View →
                </button>
              ) : (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30">
                  Coming Soon
                </span>
              )}
            </div>
            {section === "url-validator" && urlSummary ? (
              <div className="flex flex-col gap-2">
                {/* Row 1: Total · Products · Scans · Last Scan */}
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Total Issues"  value={urlSummary.totalIssues}      valueColor="text-amber-600 dark:text-amber-400"   bgClass="bg-amber-50 dark:bg-slate-800/60"   labelColor="text-amber-500/80 dark:text-slate-400" />
                  <StatBox label="Products"      value={urlSummary.productsAffected} valueColor="text-indigo-600 dark:text-indigo-400" bgClass="bg-indigo-50 dark:bg-slate-800/60"  labelColor="text-indigo-400/80 dark:text-slate-400" />
                  <StatBox label="Scans Run"     value={urlSummary.scansAvailable}   valueColor="text-slate-700 dark:text-slate-300"   bgClass="bg-slate-50 dark:bg-slate-800/60"   labelColor="text-slate-400 dark:text-slate-500" />
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 text-center">
                    <div className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{urlSummary.latestScan ?? "—"}</div>
                    <div className="text-[11px] mt-0.5 font-medium text-slate-400 dark:text-slate-500">Last Scan</div>
                  </div>
                </div>
                {/* Top errors */}
                {urlSummary.topErrors.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {urlSummary.topErrors.map(({ type, count }) => (
                      <div key={type} className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-orange-400 dark:bg-orange-500 h-1.5 rounded-full"
                            style={{ width: `${Math.round((count / urlSummary.totalIssues) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0 w-8 text-right">{count}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 truncate max-w-[140px]">{type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : section === "optimization" && optSummary ? (
              <div className="flex flex-col gap-2">
                {/* Row 1: Pending · High · Medium · Optimized */}
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Pending"   value={optSummary.pending}   valueColor="text-amber-600 dark:text-amber-400"   bgClass="bg-amber-50 dark:bg-slate-800/60"   labelColor="text-amber-500/80 dark:text-slate-400" />
                  <StatBox label="High"      value={optSummary.high}      valueColor="text-red-600 dark:text-red-400"       bgClass="bg-red-50 dark:bg-slate-800/60"      labelColor="text-red-400/80 dark:text-slate-400" />
                  <StatBox label="Medium"    value={optSummary.medium}    valueColor="text-orange-600 dark:text-orange-400" bgClass="bg-orange-50 dark:bg-slate-800/60"   labelColor="text-orange-400/80 dark:text-slate-400" />
                  <StatBox label="Optimized" value={optSummary.optimized} valueColor="text-green-700 dark:text-green-400"   bgClass="bg-green-50 dark:bg-slate-800/60"   labelColor="text-green-600/70 dark:text-slate-400" />
                </div>
                {/* Row 2: Page 2 · Avg Position · Avg Impressions · Avg CTR */}
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Page 2"    value={optSummary.page2}         valueColor="text-indigo-600 dark:text-indigo-400" bgClass="bg-indigo-50 dark:bg-slate-800/60"  labelColor="text-indigo-400/80 dark:text-slate-400" />
                  <StatBox label="Avg Pos"   value={optSummary.avgPosition}   valueColor="text-slate-700 dark:text-slate-300"   bgClass="bg-slate-50 dark:bg-slate-800/60"   labelColor="text-slate-400 dark:text-slate-500" />
                  <StatBox label="Avg Imp"   value={optSummary.avgImpressions >= 1000 ? parseFloat((optSummary.avgImpressions / 1000).toFixed(1)) : optSummary.avgImpressions} valueColor="text-slate-700 dark:text-slate-300" bgClass="bg-slate-50 dark:bg-slate-800/60" labelColor="text-slate-400 dark:text-slate-500" suffix={optSummary.avgImpressions >= 1000 ? "k" : ""} />
                  <StatBox label="Avg CTR"   value={optSummary.avgCtr}        valueColor="text-slate-700 dark:text-slate-300"   bgClass="bg-slate-50 dark:bg-slate-800/60"   labelColor="text-slate-400 dark:text-slate-500" suffix="%" />
                </div>
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

function StatBox({
  label, value, valueColor, bgClass, labelColor, suffix = "",
}: {
  label: string; value: number; valueColor: string; bgClass: string; labelColor: string; suffix?: string;
}) {
  return (
    <div className={`${bgClass} rounded-lg p-3 text-center`}>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}{suffix}</div>
      <div className={`text-[11px] mt-0.5 font-medium ${labelColor}`}>{label}</div>
    </div>
  );
}
