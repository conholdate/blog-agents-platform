"use client";

import { Badge } from "@/components/ui/badge";
import { Status } from "@/lib/config";

const STATUS_STYLES: Record<Status, string> = {
  queued:    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  approved:  "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  rejected:  "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  generated: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as Status] ?? "bg-gray-100 text-gray-600";
  return (
    <Badge variant="outline" className={`text-xs font-medium ${style}`}>
      {status || "—"}
    </Badge>
  );
}
