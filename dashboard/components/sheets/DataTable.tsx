"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronsUpDown, Pencil } from "lucide-react";
import { COLUMNS, joinItems } from "@/lib/columns";
import { StatusBadge } from "./StatusBadge";
import { BulletCell } from "./BulletCell";
import { RowDrawer } from "./RowDrawer";

interface Props {
  rows: Record<string, string>[];
  domain: string;
  tab: string;
}

type SortDir = "asc" | "desc" | null;

export function DataTable({ rows: initialRows, domain, tab }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [editingRow, setEditingRow] = useState<Record<string, string> | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const sortedRows = useMemo(() => {
    if (!sortCol || !sortDir) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [rows, sortCol, sortDir]);

  function handleSort(key: string) {
    if (sortCol !== key) { setSortCol(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortCol(null); setSortDir(null); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-30" />;
    if (sortDir === "asc") return <ChevronUp className="h-3 w-3 ml-1" />;
    return <ChevronDown className="h-3 w-3 ml-1" />;
  }

  async function handleSave(rowIndex: number, changes: Record<string, string>) {
    const changedKeys = Object.keys(changes);

    // Build API payload: only keys that actually changed vs current row
    const currentRow = rows.find((r) => Number(r._rowIndex) === rowIndex);
    const apiChanges = changedKeys
      .filter((key) => {
        const col = COLUMNS.find((c) => c.key === key);
        if (!col) return false;
        // Re-join bullets to compare against original pipe value
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

    if (apiChanges.length === 0) return; // nothing changed

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

    // Update local state
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{rows.length} rows</span>
      </div>

      <div className="overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-200">
              {/* Edit button column */}
              <TableHead className="w-10 px-3" />
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  style={{ minWidth: col.width, width: col.width }}
                  className="whitespace-nowrap cursor-pointer select-none py-2.5 hover:bg-gray-100"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {col.label}
                    <SortIcon col={col.key} />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow
                key={row._rowIndex}
                className={`align-top border-b border-gray-100 transition-colors ${
                  editingRow?._rowIndex === row._rowIndex
                    ? "bg-blue-50/60"
                    : "hover:bg-gray-50/80"
                }`}
              >
                {/* Edit button */}
                <TableCell className="px-3 py-2.5 align-middle">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-gray-300 hover:text-blue-500 hover:bg-blue-50"
                    onClick={() => setEditingRow(row)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>

                {COLUMNS.map((col) => {
                  const value = row[col.key] ?? "";
                  return (
                    <TableCell key={col.key} className="py-2.5 px-3 align-top">
                      {col.type === "status" && <StatusBadge status={value} />}
                      {col.type === "readonly" && (
                        <span className="text-[12.5px] text-gray-400 break-all leading-relaxed">
                          {value || "—"}
                        </span>
                      )}
                      {col.type === "text" && (
                        <span className="text-[13.5px] text-gray-800 leading-relaxed">
                          {value || <span className="text-gray-200">—</span>}
                        </span>
                      )}
                      {(col.type === "bullets" || col.type === "textarea") && (
                        <BulletCell value={value} />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {sortedRows.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm">No rows found.</div>
        )}
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
