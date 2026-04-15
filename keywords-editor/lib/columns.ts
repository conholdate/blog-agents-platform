export type ColumnType = "text" | "status" | "bullets" | "textarea" | "readonly";

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  width?: string;
}

export const COLUMNS: ColumnDef[] = [
  // ── Important: visible at first sight ──────────────────────────
  { key: "source_sheet_row",   label: "Row",              type: "readonly", width: "56px"  },
  { key: "status",             label: "Status",           type: "status",   width: "120px" },
  { key: "generated_title",    label: "Title",            type: "text",     width: "280px" },
  { key: "primary_keyword",    label: "Primary Keyword",  type: "text",     width: "220px" },
  { key: "selected_platform",  label: "Platform",         type: "text",     width: "110px" },

  // ── Generated content ───────────────────────────────────────────
  { key: "secondary_keywords", label: "Secondary KWs",   type: "bullets",  width: "240px" },
  { key: "long_tail_keywords", label: "Long Tail KWs",   type: "bullets",  width: "240px" },
  { key: "semantic_keywords",  label: "Semantic KWs",    type: "bullets",  width: "240px" },
  { key: "target_persona",     label: "Target Persona",  type: "bullets",  width: "220px" },
  { key: "angle",              label: "Angle",           type: "textarea", width: "220px" },
  { key: "outline",            label: "Outline",         type: "bullets",  width: "260px" },
  { key: "editorial_notes",    label: "Editorial Notes", type: "bullets",  width: "240px" },

  // ── Metadata: rarely needed ─────────────────────────────────────
  { key: "product",            label: "Product",         type: "readonly", width: "100px" },
  { key: "brand",              label: "Brand",           type: "readonly", width: "90px"  },
  { key: "seed_topic",         label: "Seed Topic",       type: "readonly", width: "200px" },
  { key: "category",           label: "Category",         type: "readonly", width: "120px" },
  { key: "sub_category",       label: "Sub Category",     type: "readonly", width: "150px" },
  { key: "baseline_platform",  label: "Base Platform",   type: "readonly", width: "110px" },
  { key: "generated_at_utc",   label: "Generated At",    type: "readonly", width: "180px" },
  { key: "run_id",             label: "Run ID",          type: "readonly", width: "100px" },
  { key: "markdown_path",      label: "Markdown Path",   type: "readonly", width: "260px" },
];

export const EDITABLE_TYPES: ColumnType[] = ["text", "status", "bullets", "textarea"];

export function isEditable(col: ColumnDef): boolean {
  return EDITABLE_TYPES.includes(col.type);
}

// Split pipe-separated string into array of items
export function parseItems(value: string): string[] {
  return value
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Join array back to pipe-separated string
export function joinItems(items: string[]): string {
  return items.join(" | ");
}
