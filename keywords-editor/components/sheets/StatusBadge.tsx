"use client";

import { Badge } from "@/components/ui/badge";
import { Status } from "@/lib/config";

const STATUS_STYLES: Record<Status, string> = {
  ok: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as Status] ?? "bg-gray-100 text-gray-600";
  return (
    <Badge variant="outline" className={`text-xs font-medium ${style}`}>
      {status || "—"}
    </Badge>
  );
}
