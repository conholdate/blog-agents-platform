"use client";

import { useState, useEffect } from "react";
import { DOMAINS, DOMAIN_LABELS } from "@/lib/config";
import { Loader2, ExternalLink, Menu, X } from "lucide-react";
import { CardGrid } from "./CardGrid";
import { Sidebar, type Section } from "@/components/dashboard/Sidebar";
import { Overview } from "@/components/dashboard/Overview";
import { WorkInProgress } from "@/components/dashboard/WorkInProgress";

const DOMAIN_LIST = Object.keys(DOMAINS);
const ALL_MISSING_TAB = "All Missing Topics";

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

  // Fetch tabs whenever domain changes (only for keywords section)
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

  // Fetch rows whenever tab changes (keywords only)
  useEffect(() => {
    if (activeSection !== "keywords") return;
    if (!activeTab || activeTab === ALL_MISSING_TAB) return;
    let cancelled = false;

    setRows(null);
    setRowsLoading(true);
    setError(null);

    fetch(
      `/api/sheets/${encodeURIComponent(activeDomain)}/${encodeURIComponent(activeTab)}`
    )
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

  function handleSectionSelect(section: Section) {
    setActiveSection(section);
    setSidebarOpen(false);
    // Reset keywords state when switching away
    if (section !== "keywords") {
      setTabs([]);
      setActiveTab("");
      setRows(null);
      setError(null);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-800">
      {/* Desktop sidebar */}
      <Sidebar activeSection={activeSection} onSelect={handleSectionSelect} />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-48 h-full bg-slate-900 border-r border-slate-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <span className="text-sm font-semibold text-white">Menu</span>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col pt-2 pb-4">
              {(["overview", "keywords", "translations", "optimization", "url-validator"] as Section[]).map((key) => {
                const labels: Record<Section, string> = {
                  overview: "Overview",
                  keywords: "Keywords",
                  translations: "Translations",
                  optimization: "Optimization",
                  "url-validator": "URL Validator",
                };
                return (
                  <button
                    key={key}
                    onClick={() => handleSectionSelect(key)}
                    className={`px-4 py-2.5 text-left text-[13px] font-medium transition-colors border-l-2 ${
                      key === activeSection
                        ? "border-white bg-slate-800 text-white"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {labels[key]}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-slate-900 border-b border-slate-700 shadow-lg sticky top-0 z-10">
          <div className="px-3 md:px-6 py-3 flex items-center gap-3 md:gap-6">
            {/* Mobile hamburger */}
            <button
              className="md:hidden text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            <span className="text-[15px] font-semibold tracking-tight text-white shrink-0">
              Blog Team
            </span>

            <nav className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {DOMAIN_LIST.map((domain) => {
                const meta = DOMAIN_LABELS[domain];
                const isActive = domain === activeDomain;
                return (
                  <button
                    key={domain}
                    onClick={() => setActiveDomain(domain)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all border ${
                      isActive
                        ? "bg-white text-slate-900 border-white"
                        : "bg-transparent text-slate-400 border-slate-600 hover:border-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${meta.color}`} />
                    {meta.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Product tab bar — keywords only */}
          {activeSection === "keywords" && tabs.length > 0 && (
            <div className="px-3 md:px-6 flex gap-0 overflow-x-auto border-t border-slate-700 items-center scrollbar-none">
              {tabs.filter((t) => t !== ALL_MISSING_TAB).map((tab) => {
                const isActive = tab === activeTab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? "border-white text-white"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}

              {tabs.includes(ALL_MISSING_TAB) && (
                <>
                  <div className="mx-3 self-stretch w-px bg-slate-600 my-1.5" />
                  <button
                    onClick={() => setActiveTab(ALL_MISSING_TAB)}
                    className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === ALL_MISSING_TAB
                        ? "border-amber-400 text-amber-400"
                        : "border-transparent text-amber-500/70 hover:text-amber-400 hover:border-amber-500"
                    }`}
                  >
                    {ALL_MISSING_TAB}
                  </button>
                </>
              )}

              {sheetUrl && (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-green-400 whitespace-nowrap transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Sheet
                </a>
              )}
            </div>
          )}
        </header>

        {/* Section content */}
        <main className="flex-1">
          {activeSection === "overview" && (
            <Overview domain={activeDomain} onNavigate={handleSectionSelect} />
          )}

          {activeSection === "keywords" && (
            <div className="px-3 md:px-6 py-4 md:py-5">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
                  {error}
                </div>
              )}

              {(tabsLoading || rowsLoading) && (
                <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">
                    {tabsLoading ? "Loading tabs…" : "Loading rows…"}
                  </span>
                </div>
              )}

              {!tabsLoading && activeTab === ALL_MISSING_TAB && (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <span className="text-4xl">🗂️</span>
                  <p className="text-base font-medium text-slate-300">
                    Current view does not support <span className="font-semibold">All Missing Topics</span>
                  </p>
                  <p className="text-sm text-slate-500">Open the sheet directly to review this tab.</p>
                  {sheetUrl && (
                    <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-blue-500 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3.5 w-3.5" /> Open in Google Sheets
                    </a>
                  )}
                </div>
              )}

              {!tabsLoading && !rowsLoading && rows !== null && activeTab && activeTab !== ALL_MISSING_TAB && (
                <CardGrid rows={rows} domain={activeDomain} tab={activeTab} />
              )}

              {!tabsLoading && !rowsLoading && tabs.length === 0 && !error && (
                <div className="text-center py-24 text-gray-400 text-sm">
                  No product tabs found in this sheet.
                </div>
              )}
            </div>
          )}

          {activeSection !== "overview" && activeSection !== "keywords" && (
            <WorkInProgress section={activeSection} domain={activeDomain} />
          )}
        </main>
      </div>
    </div>
  );
}
