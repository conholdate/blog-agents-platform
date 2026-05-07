"use client";

import { parseItems } from "@/lib/columns";

export function BulletCell({ value }: { value: string }) {
  const items = parseItems(value);
  if (items.length === 0) return <span className="text-gray-200 text-xs">—</span>;
  if (items.length === 1) return <span className="text-[13.5px] text-gray-800 leading-relaxed">{items[0]}</span>;
  return (
    <ul className="space-y-1 pl-0">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[13px] text-gray-700 leading-snug">
          <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-gray-300 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
