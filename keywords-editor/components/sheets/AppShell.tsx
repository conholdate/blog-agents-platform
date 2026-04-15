"use client";

import { useState, useEffect } from "react";
import { DOMAINS, DOMAIN_LABELS } from "@/lib/config";
import { Loader2 } from "lucide-react";
import { DataTable } from "./DataTable";

const DOMAIN_LIST = Object.keys(DOMAINS);

export function AppShell() {
  const [activeDomain, setActiveDomain] = useState(DOMAIN_LIST[0]);
  const [tabs, setTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tabs whenever domain changes
  useEffect(() => {
    setTabs([]);
    setActiveTab("");
    setRows(null);
    setError(null);
    setTabsLoading(true);

    fetch(`/api/sheets/${encodeURIComponent(activeDomain)}/tabs`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setTabs(data.tabs);
        if (data.tabs.length > 0) setActiveTab(data.tabs[0]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setTabsLoading(false));
  }, [activeDomain]);

  // Fetch rows whenever tab changes
  useEffect(() => {
    if (!activeTab) return;
    setRows(null);
    setRowsLoading(true);
    setError(null);

    fetch(
      `/api/sheets/${encodeURIComponent(activeDomain)}/${encodeURIComponent(activeTab)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setRows(data.rows);
      })
      .catch((e) => setError(e.message))
      .finally(() => setRowsLoading(false));
  }, [activeDomain, activeTab]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center gap-6">
          <span className="text-[15px] font-semibold tracking-tight text-gray-900 shrink-0">
            Keywords Editor
          </span>
          <nav className="flex flex-wrap gap-1.5">
            {DOMAIN_LIST.map((domain) => {
              const meta = DOMAIN_LABELS[domain];
              const isActive = domain === activeDomain;
              return (
                <button
                  key={domain}
                  onClick={() => setActiveDomain(domain)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all border ${
                    isActive
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-800"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${meta.color}`} />
                  {meta.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Product tab bar */}
        {tabs.length > 0 && (
          <div className="px-6 flex gap-0 overflow-x-auto border-t border-gray-100">
            {tabs.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {(tabsLoading || rowsLoading) && (
          <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">
              {tabsLoading ? "Loading tabs…" : "Loading rows…"}
            </span>
          </div>
        )}

        {!tabsLoading && !rowsLoading && rows !== null && activeTab && (
          <DataTable rows={rows} domain={activeDomain} tab={activeTab} />
        )}

        {!tabsLoading && !rowsLoading && tabs.length === 0 && !error && (
          <div className="text-center py-24 text-gray-400 text-sm">
            No product tabs found in this sheet.
          </div>
        )}
      </main>
    </div>
  );
}
