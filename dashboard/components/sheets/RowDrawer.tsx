"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { StatusBadge } from "./StatusBadge";
import { COLUMNS } from "@/lib/columns";
import { STATUS_OPTIONS } from "@/lib/config";
import { parseItems } from "@/lib/columns";

interface Props {
  row: Record<string, string>;
  domain: string;
  tab: string;
  onSave: (rowIndex: number, changes: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

const READONLY_FIELDS = [
  { key: "source_sheet_row",          label: "Sheet Row"    },
  { key: "run_id",                    label: "Run ID"       },
  { key: "generated_at_utc",          label: "Generated At" },
  { key: "brand",                     label: "Brand"        },
  { key: "product",                   label: "Product"      },
  { key: "baseline_platform",         label: "Platform"     },
  { key: "category",                  label: "Category"     },
  { key: "sub_category",              label: "Sub Category" },
  { key: "seed_topic",                label: "Seed Topic"   },
  { key: "primary_keyword_intent",    label: "KW Intent"    },
  { key: "primary_keyword_score",     label: "SEO Score"    },
  { key: "primary_keyword_aeo_score", label: "AEO Score"    },
  { key: "primary_keyword_placement", label: "KW Placement" },
  { key: "keyword_clusters",          label: "KW Clusters"  },
  { key: "rejected_keywords",         label: "Rejected KWs" },
  { key: "markdown_path",             label: "Markdown Path"},
];

const EDITABLE_FIELDS = COLUMNS.filter((c) =>
  ["status", "text", "bullets", "textarea"].includes(c.type)
);

export function RowDrawer({ row, domain, tab, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initial: Record<string, string> = {};
    EDITABLE_FIELDS.forEach((col) => {
      if (col.type === "bullets") {
        initial[col.key] = parseItems(row[col.key] ?? "").join("\n");
      } else {
        initial[col.key] = row[col.key] ?? "";
      }
    });
    setDraft(initial);
    setSaveError(null);
  }, [row]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const toSave: Record<string, string> = {};
    EDITABLE_FIELDS.forEach((col) => {
      if (col.type === "bullets") {
        toSave[col.key] = draft[col.key]
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(" | ");
      } else {
        toSave[col.key] = draft[col.key] ?? "";
      }
    });
    try {
      await onSave(Number(row._rowIndex), toSave);
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const rowTitle =
    row.generated_title || row.seed_topic || `Row ${row.source_sheet_row}`;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-20" onClick={onClose} />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full w-full md:w-[500px] bg-white dark:bg-slate-800 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium mb-0.5">
              {tab} · Row {row.source_sheet_row}
            </p>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
              {rowTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Read-only section */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
              Info
            </h3>
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2">
              {READONLY_FIELDS.map(({ key, label }) => {
                const val = row[key];
                if (!val) return null;
                return (
                  <React.Fragment key={key}>
                    <dt className="text-xs text-slate-400 dark:text-slate-500 pt-0.5 truncate">{label}</dt>
                    <dd className="text-xs text-slate-700 dark:text-slate-300 break-words leading-relaxed">{val}</dd>
                  </React.Fragment>
                );
              })}
            </dl>
          </section>

          <div className="border-t border-slate-100 dark:border-slate-700" />

          {/* Editable section */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Edit
            </h3>

            {EDITABLE_FIELDS.map((col) => (
              <div key={col.key}>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {col.label}
                </label>

                {col.type === "status" && (
                  <Select
                    value={draft[col.key] ?? ""}
                    onValueChange={(v) => {
                      if (v === null) return;
                      setDraft((prev) => ({ ...prev, [col.key]: v }));
                    }}
                  >
                    <SelectTrigger className="w-36 h-8 text-sm">
                      <StatusBadge status={draft[col.key] ?? ""} />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          <StatusBadge status={s} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {col.type === "text" && (
                  <Input
                    value={draft[col.key] ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [col.key]: e.target.value }))
                    }
                    className="text-sm h-8"
                  />
                )}

                {(col.type === "bullets" || col.type === "textarea") && (
                  <>
                    <Textarea
                      value={draft[col.key] ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [col.key]: e.target.value }))
                      }
                      className="text-sm font-mono resize-y"
                      rows={col.type === "bullets" ? 4 : 3}
                    />
                    {col.type === "bullets" && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        One item per line
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          {saveError && (
            <span className="text-xs text-red-600 dark:text-red-400 flex-1">{saveError}</span>
          )}
          {!saveError && <span className="flex-1" />}
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Row
          </Button>
        </div>
      </div>
    </>
  );
}
