"use client";

import { X, Search, Wrench, ShieldCheck, ExternalLink } from "lucide-react";
import { ISSUE_TYPE_COLORS, type RepoIssueType } from "./shared";

const ISSUE_TYPES: { type: RepoIssueType; catches: string; fix: string; strategy: string }[] = [
  { type: "DUPLICATE_KEY", catches: "the same source path appears more than once", fix: "delete every occurrence but the last", strategy: "Automatic" },
  { type: "INVALID_JSON", catches: "the file fails to parse as JSON", fix: "strip a trailing comma before a closing bracket, if that's the cause", strategy: "Automatic, or AI-assisted" },
  { type: "EMPTY_TARGET", catches: "a redirect's target is blank", fix: "AI proposes a destination, re-checked before use", strategy: "AI-assisted" },
  { type: "MALFORMED_TARGET", catches: "a target has no leading “/” and no URL scheme", fix: "prepend “/”, or “https://” for a bare hostname", strategy: "Automatic" },
  { type: "SELF_LOOP_REDIRECT", catches: "a redirect points to itself", fix: "delete the entry", strategy: "Automatic" },
  { type: "CHAINED_REDIRECT", catches: "a redirect's target is itself another redirect", fix: "point straight at the final destination", strategy: "Automatic" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HowItWorks({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 mt-8 mb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">How Repo Doctor works</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-6 text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-[13.5px]">
              <Search className="h-4 w-4 text-red-500" /> Scanning
            </div>
            <p>
              Repo Doctor reads this domain&apos;s redirects file straight from its GitHub repo and
              checks it against six rules — no AI involved in deciding what&apos;s wrong, only in
              phrasing it afterward. A scan runs when you click <strong className="text-slate-800 dark:text-slate-100">Run Scan</strong>,
              on a weekly schedule, and automatically whenever the file is pushed to the repo.
            </p>
            <div className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {ISSUE_TYPES.map((row, i) => (
                <div key={row.type} className={`flex items-start gap-2.5 px-3 py-2 text-[12px] ${i % 2 ? "bg-slate-50/70 dark:bg-slate-900/30" : ""}`}>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${ISSUE_TYPE_COLORS[row.type]}`}>
                    {row.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {row.catches} — <span className="text-slate-600 dark:text-slate-300">{row.fix}</span>
                    <span className="text-slate-400 dark:text-slate-500"> ({row.strategy.toLowerCase()})</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-[13.5px]">
              <Wrench className="h-4 w-4 text-red-500" /> Fixing — two clicks, not one
            </div>
            <p>
              <strong className="text-slate-800 dark:text-slate-100">Clicking &quot;Fix It&quot; only previews.</strong> It
              re-fetches the file, confirms the issue is still there, computes the fix, and shows
              you a before/after diff. Nothing is written to GitHub yet.
            </p>
            <p>
              <strong className="text-slate-800 dark:text-slate-100">Clicking &quot;Confirm &amp; Open PR&quot;</strong> is
              the only action that writes anything: it creates a branch, commits the fix, and
              opens a pull request on the repo — titled, described, and left for you to review.
              It is <strong className="text-slate-800 dark:text-slate-100">never merged automatically.</strong>
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-[13.5px]">
              <ShieldCheck className="h-4 w-4 text-red-500" /> Why it&apos;s safe to leave running
            </div>
            <ul className="flex flex-col gap-1.5 list-disc pl-5">
              <li>The AI never decides what counts as an issue — only the six deterministic rules do.</li>
              <li>Every computed fix is re-parsed as JSON before it can even be shown as a preview.</li>
              <li>What you confirm is byte-identical to what you previewed — nothing is re-drafted at commit time.</li>
              <li>A pull request is the ceiling. Nothing reaches the live branch without a human merging it.</li>
            </ul>
          </section>

          <a
            href="/repo-doctor-internals.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 pt-3 mt-1 border-t border-slate-100 dark:border-slate-700 text-[12px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View the full architecture diagrams <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
