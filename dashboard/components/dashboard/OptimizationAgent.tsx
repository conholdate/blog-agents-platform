"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLink, RefreshCw, Loader2, TrendingUp, CheckCircle2, Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { QueueRow, LogRow } from "@/lib/optimizationSheets";
import { PRODUCT_LABELS } from "@/lib/config";

interface Props { domain: string }

const TIER_STYLES = {
  high:   { badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",   dot: "bg-red-500"   },
  medium: { badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700", dot: "bg-amber-400" },
  low:    { badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",   dot: "bg-slate-400" },
};

const PAGE_SIZE = 100;

type SortDir = "asc" | "desc";

function slugToLabel(s: string) {
  return PRODUCT_LABELS[s.toLowerCase()] ?? (s.charAt(0).toUpperCase() + s.slice(1));
}

function shortUrl(url: string) {
  try { return new URL(url).pathname; } catch { return url; }
}

function StatChip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[90px]">
      <span className="text-[18px] font-bold text-slate-900 dark:text-white leading-none">{value}</span>
      {sub && <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</span>}
      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</span>
    </div>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: string; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

function Th({ label, col, sortKey, sortDir, onSort, className = "" }: {
  label: string; col: string; sortKey: string; sortDir: SortDir;
  onSort: (col: string) => void; className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );
}

export function OptimizationAgent({ domain }: Props) {
  const [data, setData]               = useState<{ queue: QueueRow[]; optimized: LogRow[]; queueSheetUrl?: string | null; logSheetUrl?: string | null } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [section, setSection]         = useState<"queue" | "optimized">("queue");
  const [productFilter, setProductFilter] = useState("All");
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const [sortKey, setSortKey]         = useState<string>("originalIndex");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");

  function load(refresh = false) {
    setLoading(true); setError(null);
    fetch(`/api/optimization/${encodeURIComponent(domain)}${refresh ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); setPage(1); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setData(null); setPage(1); setProductFilter("All"); setSearch("");
    setSortKey("originalIndex"); setSortDir("asc");
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  function handleSort(col: string) {
    if (col === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(col); setSortDir("desc"); }
    setPage(1);
  }

  const products = useMemo(() => {
    if (!data) return [];
    const src = section === "queue" ? data.queue : data.optimized;
    return Array.from(new Set(src.map((r) => r.product).filter(Boolean))).sort();
  }, [data, section]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const src = section === "queue" ? data.queue : data.optimized;
    return src.filter((r) => {
      const matchProduct = productFilter === "All" || r.product === productFilter;
      const matchSearch  = !search || r.url.toLowerCase().includes(search.toLowerCase());
      return matchProduct && matchSearch;
    });
  }, [data, section, productFilter, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      const aStr = typeof av === "string" ? av : "";
      const bStr = typeof bv === "string" ? bv : "";
      const aNum = typeof av === "number" ? av : NaN;
      const bNum = typeof bv === "number" ? bv : NaN;
      const cmp = !isNaN(aNum) && !isNaN(bNum)
        ? aNum - bNum
        : aStr.localeCompare(bStr);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const visible  = sorted.slice(0, page * PAGE_SIZE);
  const hasMore  = visible.length < sorted.length;

  const stats = useMemo(() => {
    if (!data) return null;
    const q = data.queue;
    if (!q.length) return null;
    return {
      avgPos: (q.reduce((s, r) => s + r.position, 0) / q.length).toFixed(1),
      avgCtr: (q.reduce((s, r) => s + r.ctr, 0) / q.length).toFixed(2),
      avgImp: Math.round(q.reduce((s, r) => s + r.impressions, 0) / q.length),
      page2:  q.filter((r) => r.position >= 11 && r.position <= 20).length,
    };
  }, [data]);

  const thProps = { sortKey, sortDir, onSort: handleSort };

  return (
    <div className="px-3 md:px-6 py-4 md:py-5 flex flex-col gap-5">

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading optimization data…</span>
        </div>
      )}

      {!loading && data && (<>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-2">
          <StatChip label="Pending"       value={String(data.queue.length)} />
          <StatChip label="Optimized"     value={String(data.optimized.length)} />
          {stats && <>
            <StatChip label="Avg Position"   value={stats.avgPos}  sub="pending" />
            <StatChip label="Avg CTR"        value={`${stats.avgCtr}%`} sub="pending" />
            <StatChip label="Avg Impressions" value={stats.avgImp >= 1000 ? `${(stats.avgImp / 1000).toFixed(1)}k` : String(stats.avgImp)} sub="pending" />
            <StatChip label="Page 2 Posts"   value={String(stats.page2)} sub="pos 11–20" />
          </>}
          <button onClick={() => load(true)} disabled={loading} title="Refresh"
            className="ml-auto h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-0 border-b border-slate-200 dark:border-slate-700">
          {[
            { key: "queue",     label: "Pending Optimization", count: data.queue.length,     icon: <TrendingUp className="h-3.5 w-3.5" />,    countStyle: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", activeStyle: "border-indigo-600 text-indigo-700 dark:border-white dark:text-white" },
            { key: "optimized", label: "Optimized Posts",      count: data.optimized.length, icon: <CheckCircle2 className="h-3.5 w-3.5" />,  countStyle: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",  activeStyle: "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400" },
          ].map(({ key, label, count, icon, countStyle, activeStyle }) => (
            <button key={key}
              onClick={() => { setSection(key as "queue" | "optimized"); setPage(1); setProductFilter("All"); setSearch(""); setSortKey("originalIndex"); setSortDir("asc"); }}
              className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${section === key ? activeStyle : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
              {icon}{label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${countStyle}`}>{count}</span>
            </button>
          ))}

          {/* Open Sheet link */}
          <div className="ml-auto flex items-center">
            {section === "queue" && data.queueSheetUrl && (
              <a href={data.queueSheetUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:text-green-600 dark:text-slate-500 dark:hover:text-green-400 whitespace-nowrap transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
                Open Sheet
              </a>
            )}
            {section === "optimized" && data.logSheetUrl && (
              <a href={data.logSheetUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:text-green-600 dark:text-slate-500 dark:hover:text-green-400 whitespace-nowrap transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
                Open Sheet
              </a>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Filter by URL…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-1.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-52" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["All", ...products].map((p) => (
              <button key={p} onClick={() => { setProductFilter(p); setPage(1); }}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${productFilter === p ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-transparent dark:text-slate-400 dark:border-slate-600 dark:hover:border-slate-400"}`}>
                {slugToLabel(p)}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">{sorted.length} posts</span>
        </div>

        {/* Priority legend */}
        {section === "queue" && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">Priority score:</span>
            {(["high", "medium", "low"] as const).map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${TIER_STYLES[t].dot}`} />
                <span>{t === "high" ? "High" : t === "medium" ? "Med" : "Low"}</span>
                <span className="text-slate-400">
                  {t === "high" ? "(≥ 400)" : t === "medium" ? "(100–399)" : "(< 100)"}
                </span>
              </span>
            ))}
            <span className="text-slate-400">· impressions × CTR efficiency × position opportunity × age</span>
          </div>
        )}

        {/* Table */}
        {sorted.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No posts found.</div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-[12px] border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {section === "queue" ? <>
                      <Th label="#"           col="originalIndex"      {...thProps} className="w-10" />
                      <Th label="Priority"    col="priorityScore"      {...thProps} />
                      <Th label="Product"     col="product"            {...thProps} />
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Post</th>
                      <Th label="Impressions" col="impressions"        {...thProps} className="text-right" />
                      <Th label="CTR"         col="ctr"                {...thProps} className="text-right" />
                      <Th label="Position"    col="position"           {...thProps} className="text-right" />
                      <Th label="Clicks"      col="clicks"             {...thProps} className="text-right" />
                      <Th label="Age (days)"  col="daysSincePublished" {...thProps} className="text-right" />
                    </> : <>
                      <Th label="#"             col="originalIndex" {...thProps} className="w-10" />
                      <Th label="Product"       col="product"       {...thProps} />
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Post</th>
                      <Th label="Last Optimized" col="lastOptimized" {...thProps} />
                    </>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                  {section === "queue"
                    ? (visible as QueueRow[]).map((row) => {
                        const tier = TIER_STYLES[row.priorityTier];
                        return (
                          <tr key={row.url} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="px-3 py-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">{row.originalIndex}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tier.badge}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
                                {row.priorityTier === "high" ? "High" : row.priorityTier === "medium" ? "Med" : "Low"}
                                <span className="font-mono font-normal opacity-70">{Math.round(row.priorityScore).toLocaleString()}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {row.product && (
                                <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
                                  {row.product}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 max-w-[380px]">
                              <a href={row.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 group text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                <span className="truncate">{shortUrl(row.url)}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {row.impressions >= 1000 ? `${(row.impressions / 1000).toFixed(1)}k` : row.impressions}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <span className={`font-mono px-1.5 py-0.5 rounded text-[11px] ${
                                row.ctr >= 3 ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20"
                                : row.ctr >= 1 ? "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20"
                                : "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20"
                              }`}>{row.ctr.toFixed(2)}%</span>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <span className={`font-mono px-1.5 py-0.5 rounded text-[11px] ${
                                row.position <= 10 ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20"
                                : row.position <= 20 ? "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20"
                                : "text-slate-600 dark:text-slate-400"
                              }`}>{row.position.toFixed(1)}</span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{row.clicks}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-500 dark:text-slate-500 whitespace-nowrap">{row.daysSincePublished.toLocaleString()}</td>
                          </tr>
                        );
                      })
                    : (visible as LogRow[]).map((row) => (
                        <tr key={row.url} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="px-3 py-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">{row.originalIndex}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.product && (
                              <span className="px-2 py-0.5 text-[11px] rounded-full bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                {row.product}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 max-w-[480px]">
                            <a href={row.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 group text-slate-600 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                              <span className="truncate">{shortUrl(row.url)}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono">{row.lastOptimized}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

            {hasMore && (
              <button onClick={() => setPage((p) => p + 1)}
                className="self-center mt-2 px-5 py-2 text-[13px] font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Show more ({sorted.length - visible.length} remaining)
              </button>
            )}
          </>
        )}
      </>)}
    </div>
  );
}
