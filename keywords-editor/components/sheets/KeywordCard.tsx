"use client";

import { parseItems } from "@/lib/columns";
import { DOMAIN_LABELS } from "@/lib/config";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface Props {
  row: Record<string, string>;
  domain: string;
  isEditing: boolean;
  onEdit: () => void;
}

const KW_STYLES = {
  secondary: "bg-blue-50 text-blue-700",
  longTail:  "bg-orange-50 text-orange-700",
  semantic:  "bg-teal-50 text-teal-700",
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
        <span className="px-2.5 py-0.5 text-gray-400 text-[12px] rounded-full border border-dashed border-gray-300">
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
      <span className="text-[11px] text-gray-400 pt-0.5 w-20 shrink-0">{label}</span>
      <PillList items={items} max={max} type={type} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-[13px] text-gray-800 leading-relaxed">{value}</p>
    </div>
  );
}

export function KeywordCard({ row, domain, isEditing, onEdit }: Props) {
  const brandColor = DOMAIN_LABELS[domain]?.brandColor ?? "#64748B";

  const secondaryKws   = parseItems(row.secondary_keywords ?? "");
  const longTailKws    = parseItems(row.long_tail_keywords ?? "");
  const semanticKws    = parseItems(row.semantic_keywords  ?? "");
  const persona        = parseItems(row.target_persona     ?? "");
  const outline        = parseItems(row.outline            ?? "");
  const editorialNotes = parseItems(row.editorial_notes   ?? "");

  return (
    <div className={`rounded-2xl overflow-hidden transition-all duration-150 ${
      isEditing
        ? "ring-2 ring-white/50 shadow-2xl scale-[1.002]"
        : "shadow-lg hover:shadow-xl hover:scale-[1.001]"
    }`}>

      {/* ── Coloured header ────────────────────────────── */}
      <div
        className="px-5 py-3.5 flex items-center justify-between gap-3"
        style={{ backgroundColor: brandColor }}
      >
        {/* Left: product / category tags */}
        <div className="flex items-center gap-2 flex-wrap">
          {row.product && (
            <span className="px-2.5 py-0.5 text-[12px] font-semibold rounded-full text-white"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
              {row.product}
            </span>
          )}
          {row.category && (
            <span className="px-2.5 py-0.5 text-[12px] rounded-full text-white/90"
              style={{ backgroundColor: "rgba(255,255,255,0.13)" }}>
              {row.category}
            </span>
          )}
          {row.sub_category && (
            <span className="px-2.5 py-0.5 text-[12px] rounded-full text-white/80"
              style={{ backgroundColor: "rgba(255,255,255,0.10)" }}>
              {row.sub_category}
            </span>
          )}
          {row.selected_platform && (
            <span className="px-2.5 py-0.5 text-[12px] rounded-full text-white/70"
              style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
              {row.selected_platform}
            </span>
          )}
        </div>

        {/* Right: row number + edit */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-white/60 font-mono">#{row.source_sheet_row}</span>
          <button
            onClick={onEdit}
            className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <Pencil className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* ── Card body ──────────────────────────────────── */}
      <div className="bg-white">

        {/* Title */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="pt-0.5">
              <StatusBadge status={row.status ?? ""} />
            </div>
            <h2 className="text-[17px] font-bold text-gray-900 leading-snug">
              {row.generated_title || <span className="text-gray-300 italic font-normal">No title yet</span>}
            </h2>
          </div>
          {row.seed_topic && (
            <p className="text-[12px] text-gray-400 mt-1.5 pl-0.5">Seed: {row.seed_topic}</p>
          )}
        </div>

        {/* Keywords + Content Brief side by side */}
        <div className="grid grid-cols-5 divide-x divide-gray-100 border-b border-gray-100">

          {/* Keywords — 3/5 */}
          <div className="col-span-3 px-5 py-3 space-y-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Keywords</p>
            {row.primary_keyword && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 w-20 shrink-0">Primary</span>
                <span className="px-3 py-0.5 bg-green-50 text-green-800 text-[13px] font-semibold rounded-full border border-green-200">
                  {row.primary_keyword}
                </span>
              </div>
            )}
            <KwRow label="Secondary" items={secondaryKws} max={5} type="secondary" />
            <KwRow label="Long Tail" items={longTailKws}  max={4} type="longTail"  />
            <KwRow label="Semantic"  items={semanticKws}  max={5} type="semantic"  />
          </div>

          {/* Content Brief — 2/5 */}
          <div className="col-span-2 px-5 py-3 space-y-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Content Brief</p>
            <Field label="Target Persona" value={persona.join(" · ")} />
            <Field label="Angle" value={row.angle ?? ""} />
          </div>
        </div>

        {/* Outline */}
        {outline.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Outline</p>
            <ol className="columns-2 gap-x-8 space-y-1">
              {outline.slice(0, 8).map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-gray-800">
                  <span className="text-[11px] text-gray-400 font-mono mt-0.5 shrink-0">{i + 1}.</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ol>
            {outline.length > 8 && (
              <p className="text-[11px] text-gray-400 mt-1.5 pl-5">+{outline.length - 8} more sections</p>
            )}
          </div>
        )}

        {/* Editorial Notes */}
        {editorialNotes.length > 0 && (
          <div className="px-5 py-3 bg-amber-50/60 border-b border-amber-100">
            <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider mb-2">Editorial Notes</p>
            <ul className="space-y-1.5">
              {editorialNotes.map((note, i) => (
                <li key={i} className="text-[13px] text-amber-900 leading-relaxed">· {note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        {row.generated_at_utc && (
          <div className="px-5 py-2 flex justify-end bg-gray-50">
            <span className="text-[11px] text-gray-400">Generated: {row.generated_at_utc.slice(0, 10)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
