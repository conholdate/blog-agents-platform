"use client";

import { LayoutDashboard, BookMarked, Languages, TrendingUp, Link } from "lucide-react";

export type Section = "overview" | "keywords" | "translations" | "optimization" | "url-validator";

const NAV_ITEMS: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview",      label: "Overview",      icon: LayoutDashboard },
  { key: "keywords",      label: "Keywords",      icon: BookMarked },
  { key: "translations",  label: "Translations",  icon: Languages },
  { key: "optimization",  label: "Optimization",  icon: TrendingUp },
  { key: "url-validator", label: "URL Validator", icon: Link },
];

interface SidebarProps {
  activeSection: Section;
  onSelect: (section: Section) => void;
}

export function Sidebar({ activeSection, onSelect }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-48 bg-slate-900 border-r border-slate-700 shrink-0">
      <nav className="flex flex-col pt-2 pb-4">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = key === activeSection;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors border-l-2 ${
                isActive
                  ? "border-white bg-slate-800 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
