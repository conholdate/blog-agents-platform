"use client";

import { useState } from "react";
import { BookMarked, Globe } from "lucide-react";
import type { Section } from "../Sidebar";
import { SingleDomainView } from "./SingleDomainView";
import { AllDomainsView } from "./AllDomainsView";

interface OverviewProps {
  domain: string;
  onNavigate: (section: Section) => void;
  onSelectDomain: (domain: string) => void;
}

export function Overview({ domain, onNavigate, onSelectDomain }: OverviewProps) {
  const [view, setView] = useState<"domain" | "all">("domain");

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Overview</h1>
        {/* Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
          <button
            onClick={() => setView("domain")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${view === "domain" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
          >
            <BookMarked className="h-3.5 w-3.5" />
            This Domain
          </button>
          <button
            onClick={() => setView("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${view === "all" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
          >
            <Globe className="h-3.5 w-3.5" />
            All Domains
          </button>
        </div>
      </div>

      {view === "domain"
        ? <SingleDomainView domain={domain} onNavigate={onNavigate} />
        : <AllDomainsView onNavigate={onNavigate} onSelectDomain={onSelectDomain} />
      }
    </div>
  );
}
