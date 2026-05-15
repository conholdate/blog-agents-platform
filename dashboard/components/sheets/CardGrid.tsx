"use client";

import { useState, useEffect } from "react";
import { COLUMNS, joinItems } from "@/lib/columns";
import { KeywordCard } from "./KeywordCard";
import { RowDrawer } from "./RowDrawer";
import { PinDialog } from "./PinDialog";
import { Loader2, Save, Undo2 } from "lucide-react";

const SESSION_KEY = "blog_tools_edit_auth";

interface Props {
  rows: Record<string, string>[];
  domain: string;
  tab: string;
}

export function CardGrid({ rows: initialRows, domain, tab }: Props) {
  const [rows, setRows] = useState(initialRows.filter((r) => (r.status ?? "").toLowerCase() !== "generated"));
  const generatedCount = initialRows.filter((r) => (r.status ?? "").toLowerCase() === "generated").length;
  const [originalOrder, setOriginalOrder] = useState(() => initialRows.filter((r) => (r.status ?? "").toLowerCase() !== "generated").map((r) => r._rowIndex));
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [editingRow, setEditingRow] = useState<Record<string, string> | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [pendingRow, setPendingRow] = useState<Record<string, string> | null>(null);
  const [showPin, setShowPin] = useState(false);

  const isDirty = rows.some((r, i) => r._rowIndex !== originalOrder[i]);

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

  function handleMove(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setOrderError(null);
  }

  function handleDiscard() {
    setRows((prev) => {
      const map = Object.fromEntries(prev.map((r) => [r._rowIndex, r]));
      return originalOrder.map((id) => map[id]).filter(Boolean);
    });
    setOrderError(null);
  }

  async function handleSaveOrder() {
    setSavingOrder(true);
    setOrderError(null);
    try {
      const writes = rows.map((row, i) => ({
        rowIndex: Number(originalOrder[i]),
        data: row,
      }));

      const res = await fetch(
        `/api/sheets/${encodeURIComponent(domain)}/${encodeURIComponent(tab)}/move`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ writes }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }

      setOriginalOrder(rows.map((r) => r._rowIndex));
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingOrder(false);
    }
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">{rows.length} entries</span>
          {generatedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
              {generatedCount} generated
            </span>
          )}
        </div>

        {isDirty && (
          <div className="flex items-center gap-2">
            {orderError && (
              <span className="text-[12px] text-red-500 dark:text-red-400">{orderError}</span>
            )}
            <button
              onClick={handleDiscard}
              disabled={savingOrder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-600 border border-slate-300 hover:border-slate-500 dark:text-slate-300 dark:border-slate-600 dark:hover:border-slate-400 transition-colors disabled:opacity-50"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Discard
            </button>
            <button
              onClick={handleSaveOrder}
              disabled={savingOrder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              {savingOrder
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Save className="h-3.5 w-3.5" />
              }
              {savingOrder ? "Saving…" : "Save Order"}
            </button>
          </div>
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
            canMoveUp={index > 0}
            canMoveDown={index < rows.length - 1}
            onEdit={() => requestEdit(row)}
            onMoveUp={() => handleMove(index, "up")}
            onMoveDown={() => handleMove(index, "down")}
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
