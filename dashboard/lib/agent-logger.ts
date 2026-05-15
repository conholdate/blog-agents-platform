const BLOG_TEAM_METRICS_URL =
  "https://script.google.com/macros/s/AKfycbwYyPBs3ox6xhYfznVpu4Gh8T4l7cXrAIj1m_y1g-vWn6tyP_LAkv3eo6W2EZYAeHgLag/exec?token=blog_team_agent-2026";

const AGENTS_METRICS_URL =
  "https://script.google.com/macros/s/AKfycbyCHwElrM6RcYLi0JNQAkJmzGrBjAhf28mKXVyub_6SdaZ2ITvzCwfM5xCLE7rmuxio/exec?token=lM6iU2mW0gV1eZ";

const DOMAIN_PREFIX: Record<string, string> = {
  "blog.aspose.com":       "Aspose",
  "blog.aspose.cloud":     "Aspose",
  "blog.groupdocs.com":    "GroupDocs",
  "blog.groupdocs.cloud":  "GroupDocs",
  "blog.conholdate.com":   "Conholdate",
  "blog.conholdate.cloud": "Conholdate",
};

const DIR_TO_SUFFIX: Record<string, string> = {
  "3d":      "3D",
  "barcode": "BarCode",
  "cad":     "CAD",
  "gis":     "GIS",
  "html":    "HTML",
  "llm":     "LLM",
  "ocr":     "OCR",
  "omr":     "OMR",
  "pdf":     "PDF",
  "psd":     "PSD",
  "svg":     "SVG",
  "tex":     "TeX",
};

export function productName(domain: string, dir: string): string {
  const prefix = DOMAIN_PREFIX[domain] ?? domain.replace(/^blog\./, "");
  const suffix =
    DIR_TO_SUFFIX[dir] ?? dir.charAt(0).toUpperCase() + dir.slice(1);
  return `${prefix}.${suffix}`;
}

export interface AgentLogEntry {
  timestamp: string;
  agent_name: string;
  agent_owner: string;
  job_type: string;
  run_id: string;
  status: "success" | "failed";
  product: string;
  platform: string;
  website: string;
  website_section: string;
  item_name: string;
  items_discovered: number;
  items_failed: number;
  items_succeeded: number;
  run_duration_ms: number;
  token_usage: number;
  api_calls_count: number;
  run_env: string;
}

export async function logAgentRun(entries: AgentLogEntry[]): Promise<boolean> {
  const results = await Promise.allSettled(
    entries.map((entry) =>
      fetch(BLOG_TEAM_METRICS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      })
    )
  );
  return results.every((r) => r.status === "fulfilled");
}

export async function logAgentMetric(entry: AgentLogEntry): Promise<boolean> {
  try {
    const res = await fetch(AGENTS_METRICS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    return res.ok;
  } catch {
    return false;
  }
}
