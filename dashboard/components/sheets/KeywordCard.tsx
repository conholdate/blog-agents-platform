"use client";

import { useState } from "react";
import { parseItems } from "@/lib/columns";
import { DOMAIN_LABELS, getPlatformColor } from "@/lib/config";
import { StatusBadge } from "./StatusBadge";
import { Pencil, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  row: Record<string, string>;
  domain: string;
  isEditing: boolean;
  defaultExpanded?: boolean;
  onEdit: () => void;
}

const KW_STYLES = {
  secondary: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  longTail:  "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  semantic:  "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  question:  "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  entity:    "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  cluster:   "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  rejected:  "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300",
} as const;

type KwType = keyof typeof KW_STYLES;

function PillList({ items, max, type }: { items: string[]; max: number; type: KwType }) {
  const visible = items.slice(0, max);
  const extra = items.length - max;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((item, i) => (
        <span key={i} className={`px-2.5 py-0.5 text-[12px] rounded-full ${KW_STYLES[type]}`}>
          {item}
        </span>
      ))}
      {extra > 0 && (
        <span className="px-2.5 py-0.5 text-slate-400 dark:text-slate-500 text-[12px] rounded-full border border-dashed border-slate-300 dark:border-slate-600">
          +{extra}
        </span>
      )}
    </div>
  );
}

function KwRow({ label, items, max, type }: { label: string; items: string[]; max: number; type: KwType }) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] text-slate-400 dark:text-slate-500 pt-0.5 w-20 shrink-0">{label}</span>
      <PillList items={items} max={max} type={type} />
    </div>
  );
}

function BannerScore({ label, value }: { label: string; value: string }) {
  const num = parseFloat(value);
  if (!value || isNaN(num)) return null;
  return (
    <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
      <span className="text-white/60 font-normal">{label}</span>
      <span className="font-mono">{num.toFixed(1)}</span>
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
      <p className="text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed">{value}</p>
    </div>
  );
}

const BANNER_STATUS: Record<string, { dot: string; label: string }> = {
  queued:    { dot: "bg-amber-400",  label: "Queued" },
  approved:  { dot: "bg-green-400",  label: "Approved" },
  rejected:  { dot: "bg-red-400",    label: "Rejected" },
  generated: { dot: "bg-indigo-400", label: "Generated" },
};

function BannerStatus({ status }: { status: string }) {
  const s = BANNER_STATUS[status?.toLowerCase()];
  if (!s) return null;
  return (
    <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: "rgba(0,0,0,0.20)" }}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function KeywordCard({ row, domain, isEditing, defaultExpanded = false, onEdit }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showMoreKws, setShowMoreKws] = useState(false);
  const brandColor  = DOMAIN_LABELS[domain]?.brandColor ?? "#64748B";
  const bannerColor = getPlatformColor(row.selected_platform ?? "", brandColor);

  const secondaryKws   = parseItems(row.secondary_keywords        ?? "");
  const longTailKws    = parseItems(row.long_tail_keywords        ?? "");
  const semanticKws    = parseItems(row.semantic_keywords         ?? "");
  const questionKws    = parseItems(row.question_keywords         ?? "");
  const entityKws      = parseItems(row.entity_keywords           ?? "");
  const kwClusters     = parseItems(row.keyword_clusters          ?? "");
  const rejectedKws    = parseItems(row.rejected_keywords         ?? "");
  const persona        = parseItems(row.target_persona            ?? "");
  const outline        = parseItems(row.outline                   ?? "");
  const editorialNotes = parseItems(row.editorial_notes           ?? "");

  return (
    <div className={`rounded-2xl overflow-hidden transition-all duration-150 ${
      isEditing
        ? "ring-2 ring-white/50 shadow-2xl"
        : "shadow-md hover:shadow-lg dark:shadow-lg dark:hover:shadow-xl"
    }`}>

      {/* ── Banner (always visible) ─────────────────────── */}
      <div
        className="px-4 md:px-5 py-3 flex items-center gap-3 cursor-pointer select-none"
        style={{ backgroundColor: bannerColor }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          {!expanded && row.generated_title ? (
            <>
              <span className="text-[13px] font-semibold text-white truncate shrink min-w-0">
                {row.generated_title}
              </span>
              {row.selected_platform && (
                <span className="px-2.5 py-0.5 text-[12px] rounded-full text-white/70 shrink-0"
                  style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
                  {row.selected_platform}
                </span>
              )}
            </>
          ) : (
            <>
              {row.product && (
                <span className="px-2.5 py-0.5 text-[12px] font-semibold rounded-full text-white shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                  {row.product}
                </span>
              )}
              {row.category && (
                <span className="px-2.5 py-0.5 text-[12px] rounded-full text-white/90 shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.13)" }}>
                  {row.category}
                </span>
              )}
              {row.sub_category && (
                <span className="px-2.5 py-0.5 text-[12px] rounded-full text-white/80 shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.10)" }}>
                  {row.sub_category}
                </span>
              )}
              {row.selected_platform && (
                <span className="px-2.5 py-0.5 text-[12px] rounded-full text-white/70 shrink-0"
                  style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
                  {row.selected_platform}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <BannerScore label="SEO" value={row.primary_keyword_score     ?? ""} />
          <BannerScore label="AEO" value={row.primary_keyword_aeo_score ?? ""} />
          <BannerStatus status={row.status ?? ""} />
          <span className="text-[11px] text-white/60 font-mono hidden sm:inline mr-1">#{row.source_sheet_row}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <Pencil className="h-3.5 w-3.5 text-white" />
          </button>
          <div className="h-7 w-7 flex items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            {expanded
              ? <ChevronUp className="h-4 w-4 text-white/80" />
              : <ChevronDown className="h-4 w-4 text-white/80" />
            }
          </div>
        </div>
      </div>

      {/* ── Expanded body ──────────────────────────────── */}
      {expanded && (
        <div className="bg-white dark:bg-slate-800">

          {/* Title */}
          <div className="px-4 md:px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <div className="pt-0.5 shrink-0">
                <StatusBadge status={row.status ?? ""} />
              </div>
              <h2 className="text-[17px] font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {row.generated_title || <span className="text-slate-300 dark:text-slate-600 italic font-normal">No title yet</span>}
              </h2>
            </div>
            {row.seed_topic && (
              <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1.5">Seed: {row.seed_topic}</p>
            )}
          </div>

          {/* Keywords + Content Brief */}
          <div className="flex flex-col md:grid md:grid-cols-5 md:divide-x divide-slate-100 dark:divide-slate-700 border-b border-slate-100 dark:border-slate-700">
            <div className="md:col-span-3 px-4 md:px-5 py-3 space-y-2 border-b md:border-b-0 border-slate-100 dark:border-slate-700">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Keywords</p>
              {row.primary_keyword && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 w-20 shrink-0">Primary</span>
                  <span className="px-3 py-0.5 bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 text-[13px] font-semibold rounded-full border border-indigo-200 dark:border-indigo-800">
                    {row.primary_keyword}
                  </span>
                </div>
              )}
              <KwRow label="Secondary" items={secondaryKws} max={5} type="secondary" />
              <KwRow label="Long Tail" items={longTailKws}  max={4} type="longTail"  />
              <KwRow label="Semantic"  items={semanticKws}  max={5} type="semantic"  />
            </div>

            <div className="md:col-span-2 px-4 md:px-5 py-3 space-y-3">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Content Brief</p>
              <Field label="Target Persona" value={persona.join(" · ")} />
              <Field label="Angle" value={row.angle ?? ""} />
            </div>
          </div>

          {/* Outline + Editorial Notes */}
          {(outline.length > 0 || editorialNotes.length > 0) && (
            <div className="flex flex-col md:grid md:grid-cols-5 md:divide-x divide-slate-100 dark:divide-slate-700 border-b border-slate-100 dark:border-slate-700">
              {outline.length > 0 && (
                <div className={`px-4 md:px-5 py-3 border-b md:border-b-0 border-slate-100 dark:border-slate-700 ${editorialNotes.length > 0 ? "md:col-span-2" : "md:col-span-5"}`}>
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Outline</p>
                  <ol className="space-y-1">
                    {outline.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-slate-800 dark:text-slate-200">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 shrink-0">{i + 1}.</span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {editorialNotes.length > 0 && (
                <div className={`px-4 md:px-5 py-3 bg-amber-50/60 dark:bg-amber-900/10 ${outline.length > 0 ? "md:col-span-3" : "md:col-span-5"}`}>
                  <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider mb-2">Editorial Notes</p>
                  <ul className="space-y-1.5">
                    {editorialNotes.map((note, i) => (
                      <li key={i} className="text-[13px] text-amber-900 dark:text-amber-200 leading-relaxed">· {note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* More Keywords */}
          {(questionKws.length > 0 || entityKws.length > 0 || kwClusters.length > 0 || rejectedKws.length > 0) && (
            <div className="border-b border-slate-100 dark:border-slate-700">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMoreKws((v) => !v); }}
                className="w-full px-4 md:px-5 py-2.5 flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${showMoreKws ? "rotate-180" : ""}`} />
                {showMoreKws ? "Hide additional keywords" : "Show additional keywords"}
              </button>
              {showMoreKws && (
                <div className="px-4 md:px-5 pb-3 space-y-2">
                  <KwRow label="Question"  items={questionKws}  max={4} type="question"  />
                  <KwRow label="Entity"    items={entityKws}    max={4} type="entity"    />
                  <KwRow label="Clusters"  items={kwClusters}   max={3} type="cluster"   />
                  <KwRow label="Rejected"  items={rejectedKws}  max={3} type="rejected"  />
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {row.generated_at_utc && (
            <div className="px-4 md:px-5 py-2 flex justify-end bg-slate-50 dark:bg-slate-700/50">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">Generated: {row.generated_at_utc.slice(0, 10)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
