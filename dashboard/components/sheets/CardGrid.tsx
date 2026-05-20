"use client";

import { useState, useEffect } from "react";
import { COLUMNS, joinItems } from "@/lib/columns";
import { KeywordCard } from "./KeywordCard";
import { RowDrawer } from "./RowDrawer";
import { PinDialog } from "./PinDialog";

const SESSION_KEY = "blog_tools_edit_auth";

function combinedScore(row: Record<string, string>): number {
  return (parseFloat(row.primary_keyword_score ?? "") || 0)
       + (parseFloat(row.primary_keyword_aeo_score ?? "") || 0);
}

interface Props {
  rows: Record<string, string>[];
  domain: string;
  tab: string;
  generatedMode?: boolean;
}

export function CardGrid({ rows: initialRows, domain, tab, generatedMode = false }: Props) {
  const activeRows = generatedMode
    ? [...initialRows].sort((a, b) =>
        (b.generated_at_utc ?? "").localeCompare(a.generated_at_utc ?? ""))
    : initialRows
        .filter((r) => (r.status ?? "").toLowerCase() !== "generated")
        .sort((a, b) => combinedScore(b) - combinedScore(a));

  const [rows, setRows] = useState(activeRows);
  const generatedCount = generatedMode
    ? 0
    : initialRows.filter((r) => (r.status ?? "").toLowerCase() === "generated").length;

  const [editingRow, setEditingRow] = useState<Record<string, string> | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [pendingRow, setPendingRow] = useState<Record<string, string> | null>(null);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "true") setAuthorized(true);
  }, []);

  function requestEdit(row: Record<string, string>) {
    if (authorized) {
      setEditingRow(row);
    } else {
      setPendingRow(row);
      setShowPin(true);
    }
  }

  function handlePinSuccess() {
    sessionStorage.setItem(SESSION_KEY, "true");
    setAuthorized(true);
    setShowPin(false);
    if (pendingRow) { setEditingRow(pendingRow); setPendingRow(null); }
  }

  function handlePinCancel() {
    setShowPin(false);
    setPendingRow(null);
  }

  async function handleSave(rowIndex: number, changes: Record<string, string>) {
    const currentRow = rows.find((r) => Number(r._rowIndex) === rowIndex);
    const apiChanges = Object.keys(changes)
      .filter((key) => {
        const col = COLUMNS.find((c) => c.key === key);
        if (!col) return false;
        const newVal = col.type === "bullets"
          ? joinItems(changes[key].split("\n").map((s) => s.trim()).filter(Boolean))
          : changes[key];
        return newVal !== (currentRow?.[key] ?? "");
      })
      .map((key) => {
        const col = COLUMNS.find((c) => c.key === key)!;
        const value = col.type === "bullets"
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

      {/* Top bar */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">{rows.length} entries</span>
        {generatedCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
            {generatedCount} generated
          </span>
        )}
      </div>

      {rows.length === 0 && (
        <div className="py-16 text-center text-slate-400 text-sm">No rows found.</div>
      )}

      <div className="grid grid-cols-1 gap-5">
        {rows.map((row, index) => (
          <KeywordCard
            key={row._rowIndex}
            row={row}
            domain={domain}
            isEditing={editingRow?._rowIndex === row._rowIndex}
            defaultExpanded={index === 0}
            onEdit={() => requestEdit(row)}
            readOnly={generatedMode}
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

      {showPin && (
        <PinDialog onSuccess={handlePinSuccess} onCancel={handlePinCancel} />
      )}
    </div>
  );
}
