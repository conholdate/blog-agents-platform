"use client";

import { useState, useEffect } from "react";
import { BookMarked, Languages, TrendingUp, Link, Loader2 } from "lucide-react";
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

const WIP_CARDS: { section: Section; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  {
    section: "translations",
    label: "Translations",
    icon: Languages,
    description: "Track translation status per product and language",
  },
  {
    section: "optimization",
    label: "Optimization",
    icon: TrendingUp,
    description: "See which articles are queued for SEO optimization",
  },
  {
    section: "url-validator",
    label: "URL Validator",
    icon: Link,
    description: "Run URL validation scans and view reported issues",
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
      <h1 className="text-xl font-semibold text-white mb-5">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Keywords card */}
        <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-slate-600 p-2">
                <BookMarked className="h-4 w-4 text-slate-200" />
              </div>
              <span className="text-[15px] font-semibold text-white">Keywords</span>
            </div>
            <button
              onClick={() => onNavigate("keywords")}
              className="text-[12px] text-blue-400 hover:text-blue-300 transition-colors"
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

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {!loading && totals && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Pending" value={totals.pending} color="text-amber-400" />
                <StatBox label="OK" value={totals.ok} color="text-green-400" />
                <StatBox label="Rejected" value={totals.rejected} color="text-red-400" />
              </div>

              <div className="flex flex-col gap-1">
                {summary!.map((tab) => (
                  <div key={tab.name} className="flex items-center gap-2 text-[12px]">
                    <span className="text-slate-400 w-24 truncate shrink-0">{tab.name}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      {tab.total > 0 && (
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${Math.round((tab.ok / tab.total) * 100)}%` }}
                        />
                      )}
                    </div>
                    <span className="text-slate-500 shrink-0">{tab.ok}/{tab.total}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* WIP cards */}
        {WIP_CARDS.map(({ section, label, icon: Icon, description }) => (
          <div
            key={section}
            className="bg-slate-700/30 border border-slate-600/60 rounded-xl p-5 flex flex-col gap-3 opacity-70"
          >
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-slate-600/70 p-2">
                <Icon className="h-4 w-4 text-slate-300" />
              </div>
              <span className="text-[15px] font-semibold text-slate-300">{label}</span>
              <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
