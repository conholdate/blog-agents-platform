"use client";

import { Fragment, useState, useEffect, useMemo, type ReactNode } from "react";
import { ExternalLink, RefreshCw, Loader2, Languages, CheckCircle2, Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, Trash2, Info, Hourglass } from "lucide-react";
import type { QueueRow, CleanupRow, HistoryRow, QueueState, TranslationData } from "@/lib/translation/translationSheets";
import { PRIORITY_RANK, isOpen, waitsUntil, workOrder } from "@/lib/translation/queueOrder";
import { formatScheduleTime, formatScheduleTimeUtc } from "@/lib/format-time";
import { PRODUCT_LABELS } from "@/lib/config";

interface Props { domain: string }

type Section = "queue" | "cleanup" | "history";
type SortDir = "asc" | "desc";
type Data = TranslationData & { sheetUrl?: string | null };

const PAGE_SIZE = 100;
const LANG_CHIP_LIMIT = 6;

const SETTLE_HOURS = 72;
const WAITING = "waiting";

const PRIORITY_STYLES: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
  High:   "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700",
  Normal: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700",
  Low:    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

const ISSUE_STYLES: Record<string, { cls: string; hint: string }> = {
  MISSING:  { cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700",       hint: "Translations don't exist yet" },
  OUTDATED: { cls: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700", hint: "English post changed after it was translated" },
  ISSUE:    { cls: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-700",             hint: "Bad translation flagged by a person or an agent" },
  EXTRA:    { cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",          hint: "Junk translation files to delete" },
};

const STATE_STYLES: Record<QueueState, { badge: string; dot: string; label: string }> = {
  queued:  { badge: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",       dot: "bg-slate-400", label: "Queued" },
  partial: { badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700",         dot: "bg-blue-500",  label: "In progress" },
  hold:    { badge: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700", dot: "bg-yellow-500", label: "On hold" },
  invalid: { badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",               dot: "bg-red-500",   label: "Invalid" },
};

function slugToLabel(s: string) {
  return PRODUCT_LABELS[s.toLowerCase()] ?? (s.charAt(0).toUpperCase() + s.slice(1));
}

function shortUrl(url: string) {
  try { return new URL(url).pathname; } catch { return url; }
}

function priorityRank(p: string) {
  return PRIORITY_RANK[p] ?? 9;
}

function timeLeft(ms: number) {
  const mins = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatChip({ label, value, sub, tone = "text-slate-900 dark:text-white" }: { label: string; value: number | string; sub?: string; tone?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[90px]">
      <span className={`text-[18px] font-bold leading-none ${tone}`}>{value}</span>
      {sub && <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</span>}
      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</span>
    </div>
  );
}

function Badge({ cls, children, title }: { cls: string; children: ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${cls}`}>{children}</span>;
}

function IssueBadge({ issue }: { issue: string }) {
  const s = ISSUE_STYLES[issue] ?? ISSUE_STYLES.EXTRA;
  return <Badge cls={s.cls} title={s.hint}>{issue || "—"}</Badge>;
}

function PriorityBadge({ priority }: { priority: string }) {
  if (!priority) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  return <Badge cls={PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.Low}>{priority}</Badge>;
}

function StateBadge({ state, status }: { state: QueueState; status: string }) {
  const s = STATE_STYLES[state];
  return (
    <Badge cls={s.badge} title={status ? `Status: ${status}` : "Status blank — waiting for the next translation run"}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {state === "hold" && status ? status : s.label}
    </Badge>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

const TH = "px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap";

function Th({ label, col, sortKey, sortDir, onSort, className = "" }: {
  label: string; col: string; sortKey: string; sortDir: SortDir; onSort: (col: string) => void; className?: string;
}) {
  return (
    <th className={`${TH} cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 ${className}`} onClick={() => onSort(col)}>
      <span className="flex items-center gap-1">{label}<SortIcon active={col === sortKey} dir={sortDir} /></span>
    </th>
  );
}

function LangChips({ langs }: { langs: string[] }) {
  if (langs.length === 0) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  const shown = langs.slice(0, LANG_CHIP_LIMIT);
  const rest = langs.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1" title={langs.join(", ")}>
      {shown.map((l) => (
        <span key={l} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">{l}</span>
      ))}
      {rest > 0 && <span className="px-1.5 py-0.5 text-[10px] text-slate-400 dark:text-slate-500">+{rest}</span>}
    </span>
  );
}

function PostCell({ product, postUrl, postDate }: { product: string; postUrl: string; postDate?: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <a href={postUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 group text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
        <span className="truncate">{shortUrl(postUrl)}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>
      <span className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
        {product && <span className="text-indigo-600 dark:text-indigo-400">{slugToLabel(product)}</span>}
        {postDate && <span className="font-mono">· posted {postDate}</span>}
      </span>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      <span className={`whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300 ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}

function ExpandToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={open ? "Hide details" : "Show notes & comments"}
      className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
    </button>
  );
}

function dateOnly(s: string) {
  return s.slice(0, 10);
}

const DEFAULT_SORT: Record<Section, { key: string; dir: SortDir }> = {
  queue:   { key: "workOrder", dir: "asc" },
  cleanup: { key: "sheetRow", dir: "asc" },
  history: { key: "completedDate", dir: "desc" },
};

function sortValue(section: Section, row: QueueRow | CleanupRow | HistoryRow, key: string, queuePlace: (r: QueueRow) => number): string | number {
  if (section === "queue") {
    const r = row as QueueRow;
    if (key === "workOrder") return queuePlace(r);
    if (key === "priority") return priorityRank(r.priority);
  }
  const v = (row as unknown as Record<string, unknown>)[key];
  return typeof v === "number" || typeof v === "string" ? v : "";
}

export function TranslationAgent({ domain }: Props) {
  const [data, setData]                   = useState<Data | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [section, setSection]             = useState<Section>("queue");
  const [issueFilter, setIssueFilter]     = useState("All");
  const [stateFilter, setStateFilter]     = useState("All");
  const [productFilter, setProductFilter] = useState("All");
  const [langFilter, setLangFilter]       = useState("All");
  const [search, setSearch]               = useState("");
  const [page, setPage]                   = useState(1);
  const [sortKey, setSortKey]             = useState(DEFAULT_SORT.queue.key);
  const [sortDir, setSortDir]             = useState<SortDir>(DEFAULT_SORT.queue.dir);
  const [expanded, setExpanded]           = useState<Set<number>>(new Set());
  const [now, setNow]                     = useState(0);

  function load(refresh = false) {
    setLoading(true); setError(null);
    fetch(`/api/translation/${encodeURIComponent(domain)}${refresh ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setNow(Date.now()); setData(d); setPage(1); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function resetView(next: Section) {
    setSection(next); setPage(1); setIssueFilter("All"); setStateFilter("All"); setProductFilter("All");
    setLangFilter("All"); setSearch(""); setSortKey(DEFAULT_SORT[next].key); setSortDir(DEFAULT_SORT[next].dir);
    setExpanded(new Set());
  }

  useEffect(() => {
    setData(null);
    resetView("queue");
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  // Rows leave the settling wait on their own; ticking keeps countdowns and the work order current between loads.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  function handleSort(col: string) {
    if (col === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(col); setSortDir(col === "workOrder" || col === "priority" ? "asc" : "desc"); }
    setPage(1);
  }

  function toggle(row: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row); else next.add(row);
      return next;
    });
  }

  const order = useMemo(() => (data ? workOrder(data.queue, now) : new Map<number, number>()), [data, now]);
  const waitAt = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of data?.queue ?? []) {
      const at = isOpen(r) ? waitsUntil(r, now) : null;
      if (at !== null) m.set(r.sheetRow, at);
    }
    return m;
  }, [data, now]);

  // Ready rows in run order, then waiting rows by when they become ready, then held / invalid rows.
  const queuePlace = useMemo(() => (r: QueueRow) => {
    const place = order.get(r.sheetRow);
    if (place !== undefined) return place;
    const at = waitAt.get(r.sheetRow);
    return at !== undefined ? 1e15 + at : Number.MAX_SAFE_INTEGER;
  }, [order, waitAt]);

  const source = useMemo<(QueueRow | CleanupRow | HistoryRow)[]>(() => {
    if (!data) return [];
    return section === "queue" ? data.queue : section === "cleanup" ? data.cleanup : data.history;
  }, [data, section]);

  const products = useMemo(() => Array.from(new Set(source.map((r) => r.product).filter(Boolean))).sort(), [source]);
  const langs    = useMemo(() => Array.from(new Set(source.flatMap((r) => r.langs))).sort(), [source]);
  const issues   = useMemo(() => {
    if (section === "cleanup") return [];
    return Array.from(new Set((source as (QueueRow | HistoryRow)[]).map((r) => r.issue).filter(Boolean))).sort();
  }, [source, section]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return source.filter((r) => {
      if (productFilter !== "All" && r.product !== productFilter) return false;
      if (langFilter !== "All" && !r.langs.includes(langFilter)) return false;
      if (issueFilter !== "All" && "issue" in r && r.issue !== issueFilter) return false;
      if (stateFilter === WAITING && !waitAt.has(r.sheetRow)) return false;
      if (stateFilter !== "All" && stateFilter !== WAITING && "state" in r && r.state !== stateFilter) return false;
      if (q && !r.postUrl.toLowerCase().includes(q) && !r.product.toLowerCase().includes(q) && !r.author.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [source, productFilter, langFilter, issueFilter, stateFilter, search, waitAt]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = sortValue(section, a, sortKey, queuePlace);
      const bv = sortValue(section, b, sortKey, queuePlace);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [filtered, section, sortKey, sortDir, queuePlace]);

  const visible = sorted.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < sorted.length;

  const stats = useMemo(() => {
    if (!data) return null;
    const open = data.queue.filter(isOpen);
    return {
      open:        open.length,
      openLangs:   open.reduce((s, r) => s + r.count, 0),
      missing:     open.filter((r) => r.issue === "MISSING").length,
      retranslate: open.filter((r) => r.issue !== "MISSING").length,
      partial:     open.filter((r) => r.state === "partial").length,
      ready:       order.size,
      waiting:     waitAt.size,
      skipped:     data.queue.length - open.length,
      oldest:      open.reduce((m, r) => Math.max(m, r.daysMissing), 0),
    };
  }, [data, order, waitAt]);

  const thProps = { sortKey, sortDir, onSort: handleSort };
  const selectCls = "px-2.5 py-1.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400";

  const tabs: { key: Section; label: string; count: number; icon: ReactNode; activeStyle: string }[] = data ? [
    { key: "queue",   label: "Queue",   count: data.queue.length,   icon: <Languages className="h-3.5 w-3.5" />,    activeStyle: "border-indigo-600 text-indigo-700 dark:border-white dark:text-white" },
    { key: "cleanup", label: "Cleanup", count: data.cleanup.length, icon: <Trash2 className="h-3.5 w-3.5" />,       activeStyle: "border-slate-600 text-slate-800 dark:border-slate-300 dark:text-slate-200" },
    { key: "history", label: "History", count: data.history.length, icon: <CheckCircle2 className="h-3.5 w-3.5" />, activeStyle: "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400" },
  ] : [];

  return (
    <div className="px-3 md:px-6 py-4 md:py-5 flex flex-col gap-5">

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading translation queue…</span>
        </div>
      )}

      {!loading && data && stats && (<>

        <div className="flex flex-wrap gap-2">
          <StatChip label="Open Posts"   value={stats.open} sub={`${stats.openLangs.toLocaleString()} languages`} />
          <StatChip label="Missing"      value={stats.missing}     tone="text-amber-600 dark:text-amber-400" />
          <StatChip label="Retranslate"  value={stats.retranslate} tone="text-violet-600 dark:text-violet-400" />
          <StatChip label="In Progress"  value={stats.partial}     tone="text-blue-600 dark:text-blue-400" />
          <StatChip label="Ready Now"    value={stats.ready}       tone="text-emerald-600 dark:text-emerald-400" />
          <StatChip label="Waiting"      value={stats.waiting}     sub={`${SETTLE_HOURS} h after edit`} tone="text-orange-600 dark:text-orange-400" />
          {stats.skipped > 0 && <StatChip label="Held / Invalid" value={stats.skipped} tone="text-yellow-600 dark:text-yellow-400" />}
          {data.cleanup.length > 0 && <StatChip label="Cleanup" value={data.cleanup.length} />}
          <StatChip label="Completed"    value={data.reportOnly ? "—" : data.history.length} tone="text-green-700 dark:text-green-400" />
          <StatChip label="Oldest Open"  value={stats.oldest} sub="days" />
          <button onClick={() => load(true)} disabled={loading} title="Refresh"
            className="ml-auto h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-0 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
          {tabs.map(({ key, label, count, icon, activeStyle }) => (
            <button key={key} onClick={() => resetView(key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${section === key ? activeStyle : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
              {icon}{label}
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{count}</span>
            </button>
          ))}
          {data.sheetUrl && (
            <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:text-green-600 dark:text-slate-500 dark:hover:text-green-400 whitespace-nowrap transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
              Open Sheet
            </a>
          )}
        </div>

        <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <Info className="h-3.5 w-3.5 mt-px shrink-0" />
          {section === "queue" && (data.reportOnly
            ? <span>Report-only blog: this queue is not translated on a schedule. # shows the order a manual translation run would follow.</span>
            : <span># is the order the next translation runs will work the ready rows: by Priority, first in first out, except OUTDATED rows go newest post first. A post waits until its English has gone {SETTLE_HOURS} h without an edit (<Hourglass className="inline h-3 w-3 -mt-px" />), so mistakes are fixed before they reach every language; Urgent and ISSUE rows don&apos;t wait. Raise a row&apos;s Priority or set its Status to <code>hold</code> in the Sheet to change the order.</span>)}
          {section === "cleanup" && <span>Junk translation files found in the repo (EXTRA), to be deleted by the translation run. The list is rebuilt on every scan.</span>}
          {section === "history" && (data.reportOnly
            ? <span>Report-only blog: closed rows are dropped, not kept in history.</span>
            : <span>Rows the translation runs closed, with each run&apos;s result in Comments.</span>)}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Filter by URL, product or author…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-1.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-64" />
          </div>
          {issues.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {["All", ...issues].map((i) => (
                <button key={i} onClick={() => { setIssueFilter(i); setPage(1); }}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${issueFilter === i ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-transparent dark:text-slate-400 dark:border-slate-600 dark:hover:border-slate-400"}`}>
                  {i === "All" ? "All issues" : i}
                </button>
              ))}
            </div>
          )}
          {section === "queue" && (
            <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="All">All statuses</option>
              {(Object.keys(STATE_STYLES) as QueueState[]).map((s) => <option key={s} value={s}>{STATE_STYLES[s].label}</option>)}
              <option value={WAITING}>Waiting ({SETTLE_HOURS} h)</option>
            </select>
          )}
          {products.length > 1 && (
            <select value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="All">All products</option>
              {products.map((p) => <option key={p} value={p}>{slugToLabel(p)}</option>)}
            </select>
          )}
          {langs.length > 1 && (
            <select value={langFilter} onChange={(e) => { setLangFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="All">All languages</option>
              {langs.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">{sorted.length} rows</span>
        </div>

        {sorted.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            {source.length === 0
              ? section === "queue" ? "Queue is empty — every post is fully translated." : section === "cleanup" ? "No junk translation files found." : "No completed rows yet."
              : "No rows match these filters."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-[12px] border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {section === "queue" && <>
                      <th className="w-6" />
                      <Th label="#"        col="workOrder"   {...thProps} className="w-10" />
                      <Th label="Priority" col="priority"    {...thProps} />
                      <Th label="Issue"    col="issue"       {...thProps} />
                      <Th label="Post"     col="postDate"    {...thProps} />
                      <Th label="Author"   col="author"      {...thProps} />
                      <Th label="Langs"    col="count"       {...thProps} />
                      <Th label="Status"   col="status"      {...thProps} />
                      <Th label="Open"     col="daysMissing" {...thProps} className="text-right" />
                    </>}
                    {section === "cleanup" && <>
                      <th className="w-6" />
                      <th className={TH}>Post</th>
                      <Th label="Author"      col="author" {...thProps} />
                      <Th label="Extra Files" col="count"  {...thProps} />
                    </>}
                    {section === "history" && <>
                      <th className="w-6" />
                      <Th label="Issue"     col="issue"         {...thProps} />
                      <Th label="Post"      col="dirBase"       {...thProps} />
                      <Th label="Author"    col="author"        {...thProps} />
                      <Th label="Langs"     col="count"         {...thProps} />
                      <Th label="Completed" col="completedDate" {...thProps} />
                    </>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                  {section === "queue" && (visible as QueueRow[]).map((row) => {
                    const open = expanded.has(row.sheetRow);
                    const place = order.get(row.sheetRow);
                    const wait = waitAt.get(row.sheetRow);
                    const exempt = row.priority === "Urgent" || row.issue === "ISSUE";
                    const readyLabel = exempt
                      ? "Doesn't wait (Urgent / ISSUE)"
                      : row.readyAt
                        ? `${formatScheduleTime(row.readyAt)} — ${wait !== undefined ? `in ${timeLeft(wait - now)}` : "passed"}`
                        : "";
                    return (
                      <Fragment key={row.sheetRow}>
                        <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${place === undefined && wait === undefined ? "opacity-60" : ""}`}>
                          <td className="pl-2 py-2"><ExpandToggle open={open} onClick={() => toggle(row.sheetRow)} /></td>
                          <td className="px-3 py-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {place ?? (wait !== undefined
                              ? <span title={`Waiting for the English to settle — ready ${formatScheduleTime(row.readyAt)} (${formatScheduleTimeUtc(row.readyAt)})`}><Hourglass className="h-3.5 w-3.5 text-orange-500" /></span>
                              : "—")}
                          </td>
                          <td className="px-3 py-2"><PriorityBadge priority={row.priority} /></td>
                          <td className="px-3 py-2"><IssueBadge issue={row.issue} /></td>
                          <td className="px-3 py-2 max-w-[340px]"><PostCell product={row.product} postUrl={row.postUrl} postDate={row.postDate} /></td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">{row.author || "—"}</td>
                          <td className="px-3 py-2 max-w-[280px]">
                            <div className="flex items-start gap-2">
                              <span className="font-mono text-slate-700 dark:text-slate-300 w-5 text-right shrink-0">{row.count}</span>
                              <LangChips langs={row.langs} />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col items-start gap-1">
                              <StateBadge state={row.state} status={row.status} />
                              {wait !== undefined && (
                                <span className="text-[10px] text-orange-600 dark:text-orange-400 whitespace-nowrap" title={formatScheduleTimeUtc(row.readyAt)}>
                                  Ready in {timeLeft(wait - now)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap" title={row.missingSince ? `Flagged ${row.missingSince}` : undefined}>{row.daysMissing}d</td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50/60 dark:bg-slate-900/30">
                            <td />
                            <td colSpan={8} className="px-3 py-3">
                              <div className="grid gap-3 md:grid-cols-[2fr_2fr_1fr]">
                                <Detail label="Why it was flagged" value={row.notes} />
                                <Detail label="Translation runs" value={row.comments} mono />
                                <div className="flex flex-col gap-2">
                                  <Detail label="Flagged by" value={row.source} />
                                  <Detail label="Flagged on" value={row.missingSince} />
                                  <Detail label={`Ready after (${SETTLE_HOURS} h after last English edit)`} value={readyLabel} />
                                  <Detail label="Folder" value={row.dirBase} mono />
                                  <Detail label="Sheet row" value={String(row.sheetRow)} mono />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  {section === "cleanup" && (visible as CleanupRow[]).map((row) => {
                    const open = expanded.has(row.sheetRow);
                    return (
                      <Fragment key={row.sheetRow}>
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="pl-2 py-2"><ExpandToggle open={open} onClick={() => toggle(row.sheetRow)} /></td>
                          <td className="px-3 py-2 max-w-[380px]"><PostCell product={row.product} postUrl={row.postUrl} /></td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">{row.author || "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-start gap-2">
                              <span className="font-mono text-slate-700 dark:text-slate-300 w-5 text-right shrink-0">{row.count}</span>
                              <LangChips langs={row.langs} />
                            </div>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50/60 dark:bg-slate-900/30">
                            <td />
                            <td colSpan={3} className="px-3 py-3">
                              <div className="flex flex-col gap-2">
                                <Detail label="Notes" value={row.notes} />
                                <Detail label="Folder" value={row.dirBase} mono />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  {section === "history" && (visible as HistoryRow[]).map((row) => {
                    const open = expanded.has(row.sheetRow);
                    return (
                      <Fragment key={row.sheetRow}>
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="pl-2 py-2"><ExpandToggle open={open} onClick={() => toggle(row.sheetRow)} /></td>
                          <td className="px-3 py-2"><IssueBadge issue={row.issue} /></td>
                          <td className="px-3 py-2 max-w-[340px]"><PostCell product={row.product} postUrl={row.postUrl} /></td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">{row.author || "—"}</td>
                          <td className="px-3 py-2 max-w-[280px]">
                            <div className="flex items-start gap-2">
                              <span className="font-mono text-slate-700 dark:text-slate-300 w-5 text-right shrink-0">{row.count}</span>
                              <LangChips langs={row.langs} />
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono text-slate-500 dark:text-slate-400">{dateOnly(row.completedDate) || "—"}</td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50/60 dark:bg-slate-900/30">
                            <td />
                            <td colSpan={5} className="px-3 py-3">
                              <div className="grid gap-3 md:grid-cols-[2fr_2fr_1fr]">
                                <Detail label="Why it was flagged" value={row.notes} />
                                <Detail label="Translation runs" value={row.comments} mono />
                                <div className="flex flex-col gap-2">
                                  <Detail label="Priority" value={row.priority} />
                                  <Detail label="Flagged by" value={row.source} />
                                  <Detail label="Folder" value={row.dirBase} mono />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
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
