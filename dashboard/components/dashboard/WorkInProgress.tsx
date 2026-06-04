import { Languages, Link, Bot } from "lucide-react";
import type { Section } from "./Sidebar";

const WIP_META: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = {
  translations: {
    icon: Languages,
    description: "Track translation status (pending / done) per product and language",
  },
  "url-validator": {
    icon: Link,
    description: "Run URL validation scans and view issues reported to Google Sheets",
  },
  "post-generation": {
    icon: Bot,
    description: "Generate full blog post drafts from keyword briefs using AI agents",
  },
};

const SECTION_LABELS: Record<string, string> = {
  translations:      "Translation Agent",
  "url-validator":   "URL Validator",
  "post-generation": "Post Generation Agent",
};

interface WorkInProgressProps {
  section: Section;
  domain: string;
}

export function WorkInProgress({ section, domain }: WorkInProgressProps) {
  const meta = WIP_META[section];
  if (!meta) return null;
  const { icon: Icon, description } = meta;

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="rounded-full bg-slate-100 dark:bg-slate-700 p-4">
        <Icon className="h-8 w-8 text-slate-600 dark:text-slate-300" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{SECTION_LABELS[section]}</h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-600 border border-amber-400/40 dark:text-amber-400 dark:border-amber-500/30">
            Coming Soon
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{domain}</p>
      </div>
    </div>
  );
}
