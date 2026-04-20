"use client";

import { useState } from "react";
import { COLUMNS, joinItems } from "@/lib/columns";
import { KeywordCard } from "./KeywordCard";
import { RowDrawer } from "./RowDrawer";

interface Props {
  rows: Record<string, string>[];
  domain: string;
  tab: string;
}

export function CardGrid({ rows: initialRows, domain, tab }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [editingRow, setEditingRow] = useState<Record<string, string> | null>(null);

  async function handleSave(rowIndex: number, changes: Record<string, string>) {
    const currentRow = rows.find((r) => Number(r._rowIndex) === rowIndex);
    const apiChanges = Object.keys(changes)
      .filter((key) => {
        const col = COLUMNS.find((c) => c.key === key);
        if (!col) return false;
        const newVal =
          col.type === "bullets"
            ? joinItems(changes[key].split("\n").map((s) => s.trim()).filter(Boolean))
            : changes[key];
        return newVal !== (currentRow?.[key] ?? "");
      })
      .map((key) => {
        const col = COLUMNS.find((c) => c.key === key)!;
        const value =
          col.type === "bullets"
            ? joinItems(changes[key].split("\n").map((s) => s.trim()).filter(Boolean))
            : changes[key];
        return { rowIndex, key, value };
      });

    if (apiChanges.length === 0) return;

    const res = await fetch(
      `/api/sheets/${encodeURIComponent(domain)}/${encodeURIComponent(tab)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: apiChanges }),
      }
    );
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Save failed");
    }

    setRows((prev) =>
      prev.map((r) => {
        if (Number(r._rowIndex) !== rowIndex) return r;
        const updated = { ...r };
        apiChanges.forEach(({ key, value }) => { updated[key] = value; });
        return updated;
      })
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-sm text-slate-400">{rows.length} entries</span>

      {rows.length === 0 && (
        <div className="py-16 text-center text-gray-400 text-sm">No rows found.</div>
      )}

      <div className="grid grid-cols-1 gap-5">
        {rows.map((row) => (
          <KeywordCard
            key={row._rowIndex}
            row={row}
            domain={domain}
            isEditing={editingRow?._rowIndex === row._rowIndex}
            onEdit={() => setEditingRow(row)}
          />
        ))}
      </div>

      {editingRow && (
        <RowDrawer
          row={rows.find((r) => r._rowIndex === editingRow._rowIndex) ?? editingRow}
          domain={domain}
          tab={tab}
          onSave={handleSave}
          onClose={() => setEditingRow(null)}
        />
      )}
    </div>
  );
}
