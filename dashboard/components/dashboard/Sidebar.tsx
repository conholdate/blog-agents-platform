"use client";

import { LayoutDashboard, BookMarked, Languages, TrendingUp, Link, Bot, GitBranch, Wrench } from "lucide-react";

export type Section = "overview" | "keywords" | "translations" | "optimization" | "url-validator" | "post-generation" | "workflows" | "repo-doctor";

const NAV_ITEMS: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview",         label: "Overview",              icon: LayoutDashboard },
  { key: "keywords",         label: "Keyword Agent",         icon: BookMarked },
  { key: "post-generation",  label: "Post Generation Agent", icon: Bot },
  { key: "translations",     label: "Translation Agent",     icon: Languages },
  { key: "optimization",     label: "Optimization Agent",    icon: TrendingUp },
  { key: "url-validator",    label: "URL Validator",         icon: Link },
  { key: "workflows",        label: "CI/CD Status",          icon: GitBranch },
  { key: "repo-doctor",      label: "Repo Doctor",           icon: Wrench },
];

interface SidebarProps {
  activeSection: Section;
  onSelect: (section: Section) => void;
}

export function Sidebar({ activeSection, onSelect }: SidebarProps) {
  return (
    <aside className="hidden md:flex md:sticky md:top-0 md:h-screen flex-col w-56 bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-700 shrink-0">
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
      <BuildVersion />
    </aside>
  );
}

// Fixed to GMT+5 (the team's timezone) rather than the viewer's, so everyone
// quotes the same version and server/client renders match.
const BUILD_TZ = "Asia/Karachi";

export function BuildVersion() {
  const builtAt = process.env.BUILD_TIME;
  const sha = process.env.BUILD_COMMIT_SHA?.slice(0, 7);

  if (!builtAt) {
    return <div className="mt-auto px-4 py-3 text-[11px] text-slate-400 dark:text-slate-500">dev</div>;
  }

  const date = new Date(builtAt);
  const version = new Intl.DateTimeFormat("en-CA", { timeZone: BUILD_TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date)
    .replaceAll("-", ".");
  const time = new Intl.DateTimeFormat("en-US", { timeZone: BUILD_TZ, hour: "numeric", minute: "2-digit" }).format(date);

  return (
    <div className="mt-auto px-4 py-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
      <div>
        v{version}
        {sha && (
          <>
            {" · "}
            <span className="font-mono">{sha}</span>
          </>
        )}
      </div>
      <div>Updated {time} GMT+5</div>
    </div>
  );
}
