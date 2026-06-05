"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { DOMAINS, DOMAIN_LABELS } from "@/lib/config";
import { Loader2, ExternalLink, Menu, X, RefreshCw } from "lucide-react";
import { CardGrid } from "./CardGrid";
import { Sidebar, type Section } from "@/components/dashboard/Sidebar";
import { Overview } from "@/components/dashboard/Overview";
import { WorkInProgress } from "@/components/dashboard/WorkInProgress";
import { UrlValidator } from "@/components/dashboard/UrlValidator";
import { OptimizationAgent } from "@/components/dashboard/OptimizationAgent";
import { ThemeToggle } from "@/components/ThemeToggle";

const DOMAIN_LIST = Object.keys(DOMAINS);
const ALL_MISSING_TAB = "All Missing Topics";
const GENERATED_POSTS_TAB = "Generated Blog Posts";

export function AppShell() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [activeDomain, setActiveDomain] = useState(DOMAIN_LIST[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [tabs, setTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeSection !== "keywords") return;
    let cancelled = false;

    setTabs([]);
    setActiveTab("");
    setSheetUrl(null);
    setRows(null);
    setError(null);
    setTabsLoading(true);

    fetch(`/api/sheets/${encodeURIComponent(activeDomain)}/tabs`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        const sorted = [
          ...data.tabs.filter((t: string) => t !== ALL_MISSING_TAB),
          ...data.tabs.filter((t: string) => t === ALL_MISSING_TAB),
        ];
        setTabs(sorted);
        setSheetUrl(data.sheetUrl ?? null);
        if (sorted.length > 0) setActiveTab(sorted[0]);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setTabsLoading(false); });

    return () => { cancelled = true; };
  }, [activeDomain, activeSection]);

  useEffect(() => {
    if (activeSection !== "keywords") return;
    if (!activeTab || activeTab === ALL_MISSING_TAB) return;
    let cancelled = false;

    setRows(null);
    setRowsLoading(true);
    setError(null);

    const rowUrl = activeTab === GENERATED_POSTS_TAB
      ? `/api/sheets/${encodeURIComponent(activeDomain)}/generated`
      : `/api/sheets/${encodeURIComponent(activeDomain)}/${encodeURIComponent(activeTab)}`;

    fetch(rowUrl)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setRows(data.rows);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setRowsLoading(false); });

    return () => { cancelled = true; };
  }, [activeDomain, activeTab, activeSection]);

  function refreshKeywords() {
    if (rowsLoading || tabsLoading) return;
    setRows(null);
    setRowsLoading(true);
    setError(null);
    const refreshUrl = activeTab === GENERATED_POSTS_TAB
      ? `/api/sheets/${encodeURIComponent(activeDomain)}/generated?refresh=1`
      : `/api/sheets/${encodeURIComponent(activeDomain)}/${encodeURIComponent(activeTab)}?refresh=1`;
    fetch(refreshUrl)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setRows(data.rows);
      })
      .catch((e) => setError(e.message))
      .finally(() => setRowsLoading(false));
  }

  function handleSectionSelect(section: Section) {
    setActiveSection(section);
    setSidebarOpen(false);
    if (section !== "keywords") {
      setTabs([]);
      setActiveTab("");
      setRows(null);
      setError(null);
    }
  }

  const mobileSectionLabels: Record<Section, string> = {
    overview:          "Overview",
    keywords:          "Keyword Agent",
    translations:      "Translation Agent",
    optimization:      "Optimization Agent",
    "post-generation": "Post Generation Agent",
    "url-validator":   "URL Validator",
  };

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-800">
      {/* Desktop sidebar */}
      <Sidebar activeSection={activeSection} onSelect={handleSectionSelect} />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-56 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Menu</span>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col pt-2 pb-4">
              {(Object.keys(mobileSectionLabels) as Section[]).map((key) => (
                <button
                  key={key}
                  onClick={() => handleSectionSelect(key)}
                  className={`px-4 py-2.5 text-left text-[13px] font-medium transition-colors border-l-2 ${
                    key === activeSection
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-white dark:bg-slate-800 dark:text-white"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {mobileSectionLabels[key]}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-10">
          <div className="px-3 md:px-4 py-2.5 flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white shrink-0">
              Blog Team
            </span>

            {/* Domain pills */}
            <nav className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1 py-0.5">
              {DOMAIN_LIST.map((domain) => {
                const meta = DOMAIN_LABELS[domain];
                const isActive = domain === activeDomain;
                return (
                  <button
                    key={domain}
                    onClick={() => setActiveDomain(domain)}
                    className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full text-[12px] font-medium transition-all border shrink-0 ${
                      isActive
                        ? "text-white border-transparent shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-transparent dark:text-slate-400 dark:border-slate-600 dark:hover:border-slate-400 dark:hover:text-slate-200"
                    }`}
                    style={isActive ? { backgroundColor: meta.brandColor } : undefined}
                  >
                    <span className="h-5 w-5 rounded-full overflow-hidden shrink-0 bg-white/20 flex items-center justify-center">
                      <Image
                        src={meta.logo}
                        alt={meta.label}
                        width={20}
                        height={20}
                        className="object-contain"
                      />
                    </span>
                    {meta.label}
                  </button>
                );
              })}
            </nav>

            <ThemeToggle />
          </div>

          {/* Product tab bar — keywords only */}
          {activeSection === "keywords" && tabs.length > 0 && (
            <div className="px-3 md:px-4 flex gap-0 overflow-x-auto border-t border-slate-100 dark:border-slate-700 items-center scrollbar-none">
              {tabs.filter((t) => t !== ALL_MISSING_TAB).map((tab) => {
                const isActive = tab === activeTab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? "border-indigo-600 text-indigo-700 dark:border-white dark:text-white"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-500"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}

              {tabs.includes(ALL_MISSING_TAB) && (
                <>
                  <div className="mx-3 self-stretch w-px bg-slate-200 dark:bg-slate-600 my-1.5" />
                  <button
                    onClick={() => setActiveTab(ALL_MISSING_TAB)}
                    className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === ALL_MISSING_TAB
                        ? "border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400"
                        : "border-transparent text-amber-500/80 hover:text-amber-600 hover:border-amber-400 dark:text-amber-500/70 dark:hover:text-amber-400 dark:hover:border-amber-500"
                    }`}
                  >
                    {ALL_MISSING_TAB}
                  </button>
                </>
              )}

              {tabs.length > 0 && (
                <>
                  <div className="mx-3 self-stretch w-px bg-slate-200 dark:bg-slate-600 my-1.5" />
                  <button
                    onClick={() => setActiveTab(GENERATED_POSTS_TAB)}
                    className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === GENERATED_POSTS_TAB
                        ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-400"
                        : "border-transparent text-indigo-500/70 hover:text-indigo-600 hover:border-indigo-400 dark:text-indigo-500/60 dark:hover:text-indigo-400 dark:hover:border-indigo-500"
                    }`}
                  >
                    {GENERATED_POSTS_TAB}
                  </button>
                </>
              )}

              <div className="ml-auto flex items-center gap-1">
                {activeTab && activeTab !== ALL_MISSING_TAB && (
                <button
                  onClick={refreshKeywords}
                  disabled={rowsLoading || tabsLoading}
                  title="Refresh"
                  className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${rowsLoading ? "animate-spin" : ""}`} />
                </button>
              )}
                {sheetUrl && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:text-green-600 dark:text-slate-500 dark:hover:text-green-400 whitespace-nowrap transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Sheet
                  </a>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Section content */}
        <main className="flex-1">
          {activeSection === "overview" && (
            <Overview domain={activeDomain} onNavigate={handleSectionSelect} onSelectDomain={setActiveDomain} />
          )}

          {activeSection === "keywords" && (
            <div className="px-3 md:px-6 py-4 md:py-5">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300 mb-4">
                  {error}
                </div>
              )}

              {(tabsLoading || rowsLoading) && (
                <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{tabsLoading ? "Loading tabs…" : "Loading rows…"}</span>
                </div>
              )}

              {!tabsLoading && activeTab === ALL_MISSING_TAB && (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <span className="text-4xl">🗂️</span>
                  <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                    Current view does not support <span className="font-semibold">All Missing Topics</span>
                  </p>
                  <p className="text-sm text-slate-500">Open the sheet directly to review this tab.</p>
                  {sheetUrl && (
                    <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-indigo-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3.5 w-3.5" /> Open in Google Sheets
                    </a>
                  )}
                </div>
              )}

              {!tabsLoading && !rowsLoading && rows !== null && activeTab && activeTab !== ALL_MISSING_TAB && (
                <CardGrid
                  rows={rows}
                  domain={activeDomain}
                  tab={activeTab}
                  generatedMode={activeTab === GENERATED_POSTS_TAB}
                />
              )}

              {!tabsLoading && !rowsLoading && tabs.length === 0 && !error && (
                <div className="text-center py-24 text-slate-400 text-sm">
                  No product tabs found in this sheet.
                </div>
              )}
            </div>
          )}

          {activeSection === "url-validator" && (
            <UrlValidator domain={activeDomain} />
          )}

          {activeSection === "optimization" && (
            <OptimizationAgent domain={activeDomain} />
          )}

          {activeSection !== "overview" && activeSection !== "keywords" && activeSection !== "url-validator" && activeSection !== "optimization" && (
            <WorkInProgress section={activeSection} domain={activeDomain} />
          )}
        </main>
      </div>
    </div>
  );
}
