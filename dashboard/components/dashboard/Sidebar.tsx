"use client";

import { LayoutDashboard, BookMarked, Languages, TrendingUp, Link, Bot } from "lucide-react";

export type Section = "overview" | "keywords" | "translations" | "optimization" | "url-validator" | "post-generation";

const NAV_ITEMS: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview",         label: "Overview",              icon: LayoutDashboard },
  { key: "keywords",         label: "Keyword Agent",         icon: BookMarked },
  { key: "post-generation",  label: "Post Generation Agent", icon: Bot },
  { key: "translations",     label: "Translation Agent",     icon: Languages },
  { key: "optimization",     label: "Optimization Agent",    icon: TrendingUp },
  { key: "url-validator",    label: "URL Validator",         icon: Link },
];

interface SidebarProps {
  activeSection: Section;
  onSelect: (section: Section) => void;
}

export function Sidebar({ activeSection, onSelect }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-56 bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-700 shrink-0">
      <nav className="flex flex-col pt-2 pb-4">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = key === activeSection;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors border-l-2 ${
                isActive
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-white dark:bg-slate-800 dark:text-white"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-indigo-600 dark:text-white" : ""}`} />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
