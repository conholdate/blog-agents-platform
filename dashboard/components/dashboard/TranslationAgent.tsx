"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLink, RefreshCw, Loader2, Languages, CheckCircle2, Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { ScanRow, HistoryRow, HistoryStatus } from "@/lib/translationSheets";
import { PRODUCT_LABELS } from "@/lib/config";

interface Props { domain: string }

const STATUS_STYLES: Record<HistoryStatus, { badge: string; dot: string; label: string }> = {
  pending:   { badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700", dot: "bg-amber-400", label: "Pending" },
  partial:   { badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700",       dot: "bg-blue-400",  label: "Partial" },
  completed: { badge: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700", dot: "bg-green-500", label: "Completed" },
};

const PAGE_SIZE = 100;
const LANG_CHIP_LIMIT = 6;

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

function LangChips({ langs }: { langs: string[] }) {
  if (langs.length === 0) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  const shown = langs.slice(0, LANG_CHIP_LIMIT);
  const rest = langs.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((l) => (
        <span key={l} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
          {l}
        </span>
      ))}
      {rest > 0 && <span className="px-1.5 py-0.5 text-[10px] text-slate-400 dark:text-slate-500">+{rest}</span>}
    </span>
  );
}

export function TranslationAgent({ domain }: Props) {
  const [data, setData]               = useState<{ scan: ScanRow[]; history: HistoryRow[]; sheetUrl?: string | null } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [section, setSection]         = useState<"scan" | "history">("scan");
  const [productFilter, setProductFilter] = useState("All");
  const [langFilter, setLangFilter]   = useState("All");
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const [sortKey, setSortKey]         = useState<string>("originalIndex");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");

  function load(refresh = false) {
    setLoading(true); setError(null);
    fetch(`/api/translation/${encodeURIComponent(domain)}${refresh ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); setPage(1); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setData(null); setPage(1); setProductFilter("All"); setLangFilter("All"); setSearch("");
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
    const src = section === "scan" ? data.scan : data.history;
    return Array.from(new Set(src.map((r) => r.product).filter(Boolean))).sort();
  }, [data, section]);

  const langs = useMemo(() => {
    if (!data) return [];
    const src = section === "scan" ? data.scan : data.history;
    const all = src.flatMap((r) => r.missingLangs);
    return Array.from(new Set(all)).sort();
  }, [data, section]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const src = section === "scan" ? data.scan : data.history;
    return src.filter((r) => {
      const matchProduct = productFilter === "All" || r.product === productFilter;
      const matchLang    = langFilter === "All" || r.missingLangs.includes(langFilter);
      const q = search.toLowerCase();
      const matchSearch  = !search || r.postUrl.toLowerCase().includes(q) || r.product.toLowerCase().includes(q);
      return matchProduct && matchLang && matchSearch;
    });
  }, [data, section, productFilter, langFilter, search]);

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
    const totalMissingLangs = data.scan.reduce((s, r) => s + r.missingCount, 0);
    const pending   = data.history.filter((r) => r.status === "pending").length;
    const partial   = data.history.filter((r) => r.status === "partial").length;
    const completed = data.history.filter((r) => r.status === "completed").length;
    return { totalMissingLangs, pending, partial, completed };
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
          <span className="text-sm">Loading translation data…</span>
        </div>
      )}

      {!loading && data && (<>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-2">
          <StatChip label="Posts Missing"     value={String(data.scan.length)} />
          <StatChip label="Missing Langs"     value={String(stats?.totalMissingLangs ?? 0)} sub="total" />
          {stats && <>
            <StatChip label="Pending"   value={String(stats.pending)} />
            <StatChip label="Partial"   value={String(stats.partial)} />
            <StatChip label="Completed" value={String(stats.completed)} />
          </>}
          <button onClick={() => load(true)} disabled={loading} title="Refresh"
            className="ml-auto h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-0 border-b border-slate-200 dark:border-slate-700">
          {[
            { key: "scan",    label: "Missing Translations", count: data.scan.length,    icon: <Languages className="h-3.5 w-3.5" />,    countStyle: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", activeStyle: "border-indigo-600 text-indigo-700 dark:border-white dark:text-white" },
            { key: "history", label: "History",              count: data.history.length, icon: <CheckCircle2 className="h-3.5 w-3.5" />, countStyle: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",     activeStyle: "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400" },
          ].map(({ key, label, count, icon, countStyle, activeStyle }) => (
            <button key={key}
              onClick={() => { setSection(key as "scan" | "history"); setPage(1); setProductFilter("All"); setLangFilter("All"); setSearch(""); setSortKey("originalIndex"); setSortDir("asc"); }}
              className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${section === key ? activeStyle : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
              {icon}{label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${countStyle}`}>{count}</span>
            </button>
          ))}

          {/* Open Sheet link */}
          <div className="ml-auto flex items-center">
            {data.sheetUrl && (
              <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer"
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
            <input type="text" placeholder="Filter by URL or product…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-1.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-56" />
          </div>
          <select value={langFilter} onChange={(e) => { setLangFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400">
            <option value="All">All languages</option>
            {langs.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {["All", ...products].map((p) => (
              <button key={p} onClick={() => { setProductFilter(p); setPage(1); }}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${productFilter === p ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-transparent dark:text-slate-400 dark:border-slate-600 dark:hover:border-slate-400"}`}>
                {p === "All" ? p : slugToLabel(p)}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">{sorted.length} posts</span>
        </div>

        {/* Status legend */}
        {section === "history" && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">Status:</span>
            {(["pending", "partial", "completed"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[s].dot}`} />
                <span>{STATUS_STYLES[s].label}</span>
              </span>
            ))}
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
                    {section === "scan" ? <>
                      <Th label="#"       col="originalIndex" {...thProps} className="w-10" />
                      <Th label="Product" col="product"       {...thProps} />
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Post</th>
                      <Th label="Author"  col="author"        {...thProps} />
                      <Th label="Missing" col="missingCount"  {...thProps} className="text-right" />
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Missing Langs</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Extra</th>
                    </> : <>
                      <Th label="#"       col="originalIndex" {...thProps} className="w-10" />
                      <Th label="Product" col="product"       {...thProps} />
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Post</th>
                      <Th label="Status"  col="status"        {...thProps} />
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Missing Langs</th>
                      <Th label="Completed" col="completedDate" {...thProps} />
                    </>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                  {section === "scan"
                    ? (visible as ScanRow[]).map((row) => (
                        <tr key={row.postUrl} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="px-3 py-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">{row.originalIndex}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.product && (
                              <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
                                {slugToLabel(row.product)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 max-w-[320px]">
                            <a href={row.postUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 group text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                              <span className="truncate">{shortUrl(row.postUrl)}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">{row.author || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.missingCount}</td>
                          <td className="px-3 py-2 max-w-[260px]"><LangChips langs={row.missingLangs} /></td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-400 dark:text-slate-500">
                            {row.extraCount > 0 ? `${row.extraCount} (${row.extraLangs.join(", ")})` : "—"}
                          </td>
                        </tr>
                      ))
                    : (visible as HistoryRow[]).map((row) => {
                        const style = STATUS_STYLES[row.status] ?? STATUS_STYLES.pending;
                        return (
                          <tr key={`${row.postUrl}-${row.originalIndex}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="px-3 py-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">{row.originalIndex}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {row.product && (
                                <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
                                  {slugToLabel(row.product)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 max-w-[320px]">
                              <a href={row.postUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 group text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                <span className="truncate">{shortUrl(row.postUrl)}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${style.badge}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                                {style.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[260px]"><LangChips langs={row.missingLangs} /></td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono">{row.completedDate || "—"}</td>
                          </tr>
                        );
                      })
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
