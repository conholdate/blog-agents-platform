"use client";

import { Loader2 } from "lucide-react";

const STYLES: Record<string, string> = {
  success:         "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  failure:         "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  timed_out:       "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  cancelled:       "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
  skipped:         "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600",
  action_required: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  queued:          "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  in_progress:     "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
};

interface Props {
  status: string;
  conclusion: string | null;
}

export function WorkflowStatusBadge({ status, conclusion }: Props) {
  const key = conclusion ?? status;
  const style = STYLES[key] ?? "bg-gray-100 text-gray-600 border-gray-200";
  const isSpinning = status === "in_progress" || status === "queued" || status === "waiting";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${style}`}>
      {isSpinning && <Loader2 className="h-3 w-3 animate-spin" />}
      {key.replace(/_/g, " ")}
    </span>
  );
}
