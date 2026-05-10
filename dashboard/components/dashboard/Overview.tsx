"use client";

import { useState, useEffect } from "react";
import { BookMarked, Languages, TrendingUp, Link, Bot, Loader2 } from "lucide-react";
import type { Section } from "./Sidebar";

type TabSummary = {
  name: string;
  total: number;
  pending: number;
  ok: number;
  rejected: number;
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
    description: "See which articles are queued for SEO optimization",
    accentLight: "border-l-emerald-500",
    iconBg: "bg-emerald-50 dark:bg-slate-600/70",
    iconColor: "text-emerald-600 dark:text-slate-300",
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
    ready: true,
  },
];

export function Overview({ domain, onNavigate }: OverviewProps) {
  const [summary, setSummary] = useState<TabSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSummary(null);
    setError(null);

    fetch(`/api/sheets/${encodeURIComponent(domain)}/summary`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setSummary(data.tabs);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [domain]);

  const totals = summary?.reduce(
    (acc, t) => ({ total: acc.total + t.total, pending: acc.pending + t.pending, ok: acc.ok + t.ok, rejected: acc.rejected + t.rejected }),
    { total: 0, pending: 0, ok: 0, rejected: 0 }
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-5">Overview</h1>

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
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Pending" value={totals.pending}
                  valueColor="text-amber-600 dark:text-amber-400"
                  bgClass="bg-amber-50 dark:bg-slate-800/60"
                  labelColor="text-amber-500/80 dark:text-slate-400" />
                <StatBox label="OK" value={totals.ok}
                  valueColor="text-green-700 dark:text-green-400"
                  bgClass="bg-green-50 dark:bg-slate-800/60"
                  labelColor="text-green-600/70 dark:text-slate-400" />
                <StatBox label="Rejected" value={totals.rejected}
                  valueColor="text-red-600 dark:text-red-400"
                  bgClass="bg-red-50 dark:bg-slate-800/60"
                  labelColor="text-red-400/80 dark:text-slate-400" />
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
                    <span className="text-green-600 dark:text-green-400 font-semibold">{tab.ok}</span>
                    <span className="text-slate-300 dark:text-slate-600">/</span>
                    <span className="text-slate-400 dark:text-slate-500">{tab.total}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* WIP cards */}
        {WIP_CARDS.map(({ section, label, icon: Icon, description, accentLight, iconBg, iconColor, ready }) => (
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
                  className="ml-auto text-[12px] text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors font-medium"
                >
                  View →
                </button>
              ) : (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30">
                  Coming Soon
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        ))}

      </div>
    </div>
  );
}

function StatBox({
  label, value, valueColor, bgClass, labelColor,
}: {
  label: string; value: number; valueColor: string; bgClass: string; labelColor: string;
}) {
  return (
    <div className={`${bgClass} rounded-lg p-3 text-center`}>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      <div className={`text-[11px] mt-0.5 font-medium ${labelColor}`}>{label}</div>
    </div>
  );
}
