export type RepoIssueType =
  | "INVALID_JSON"
  | "DUPLICATE_KEY"
  | "EMPTY_TARGET"
  | "MALFORMED_TARGET"
  | "SELF_LOOP_REDIRECT"
  | "CHAINED_REDIRECT";

// "deterministic": a safe replacement/deletion can be computed by rule alone.
// "llm-assisted": the LLM proposes the exact replacement text, which is always
// re-validated (JSON.parse) before it's ever committed.
// "manual": no safe automated fix exists — shown with an explanation only, no Fix It button.
export type FixStrategy = "deterministic" | "llm-assisted" | "manual";

export interface RepoIssue {
  id: string;
  type: RepoIssueType;
  domain: string;
  filePath: string;
  sourceKey: string | null;
  currentValue: string | null;
  suggestedValue: string | null;
  rawLine: string | null; // the literal line as it appears in the file, for display
  line: number | null;
  fixStrategy: FixStrategy;
  explanation: string;
  suggestedFixDescription: string;
  severity: "error" | "warning";
}

export interface RepoDoctorScanResult {
  domain: string;
  filePath: string;
  scannedAt: string;
  entryCount: number;
  issues: RepoIssue[];
}

export interface RepoDoctorSummary {
  totalIssues: number;
  byType: Partial<Record<RepoIssueType, number>>;
  lastScanAt: string | null;
}

// Snippets, not the whole file — the file can be megabytes; the UI only ever
// needs to show the one changed/deleted line (plus whatever context repo-doctor.ts
// includes). The full before/after file text stays server-side, cached against
// previewId, until confirmFix commits it.
export interface FixPreview {
  previewId: string;
  issueId: string;
  beforeSnippet: string;
  afterSnippet: string | null; // null when the fix is a deletion
}
