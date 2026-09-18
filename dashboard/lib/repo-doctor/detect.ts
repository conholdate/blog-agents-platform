import { createHash } from "crypto";
import type { RepoIssue, RepoIssueType } from "./types";

// Matches one "key": "value" entry, allowing an optional trailing comma — the
// redirects file is one entry per physical line, so this is applied per-line
// rather than as a whole-file regex, which keeps line numbers trivial and
// fix application (below) a matter of replacing/deleting a single line.
const ENTRY_LINE_RE = /^(\s*)"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*(,?)\s*$/;

interface RawEntry {
  key: string;
  value: string;
  lineIndex: number; // 0-based
  rawLine: string; // the literal line text, for display in the UI
}

function unescapeJsonString(s: string): string {
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    return s;
  }
}

function escapeJsonString(s: string): string {
  return JSON.stringify(s).slice(1, -1);
}

function parseRawEntries(rawText: string): RawEntry[] {
  const lines = rawText.split("\n");
  const entries: RawEntry[] = [];
  lines.forEach((line, lineIndex) => {
    const m = ENTRY_LINE_RE.exec(line);
    if (!m) return;
    entries.push({ key: unescapeJsonString(m[2]), value: unescapeJsonString(m[3]), lineIndex, rawLine: line });
  });
  return entries;
}

function lineOf(rawText: string, charIndex: number): number {
  return rawText.slice(0, charIndex).split("\n").length;
}

function makeIssueId(domain: string, filePath: string, type: RepoIssueType, sourceKey: string | null, occurrence?: number): string {
  const parts = [domain, filePath, type, sourceKey ?? "", occurrence != null ? String(occurrence) : ""];
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

const HOST_PREFIX_RE = /^https?:\/\/[^/]+/i;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

// Normalizes a redirect source/target for comparison only — strips scheme+host,
// ensures a leading slash, drops a trailing slash, lowercases. Never used as a
// literal replacement value (see followChain, which returns the original raw string).
export function normalizePath(value: string): string {
  let v = value.trim().replace(HOST_PREFIX_RE, "");
  if (!v.startsWith("/")) v = "/" + v;
  if (v.length > 1 && v.endsWith("/")) v = v.slice(0, -1);
  return v.toLowerCase();
}

function isMalformedTarget(value: string): boolean {
  if (value === "") return false; // handled separately as EMPTY_TARGET
  if (value.startsWith("/")) return false;
  if (SCHEME_RE.test(value)) return false;
  return true;
}

function tryParseJson(rawText: string): { message: string; position: number | null } | null {
  try {
    JSON.parse(rawText);
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const posMatch = /position (\d+)/.exec(message);
    return { message, position: posMatch ? Number(posMatch[1]) : null };
  }
}

function detectDuplicateKeys(entries: RawEntry[], domain: string, filePath: string): RepoIssue[] {
  const countByKey = new Map<string, number>();
  for (const e of entries) countByKey.set(e.key, (countByKey.get(e.key) ?? 0) + 1);

  const lastValueByKey = new Map<string, string>();
  for (const e of entries) lastValueByKey.set(e.key, e.value); // last occurrence wins, matching JSON.parse

  const seenSoFar = new Map<string, number>();
  const issues: RepoIssue[] = [];
  for (const e of entries) {
    const total = countByKey.get(e.key)!;
    if (total <= 1) continue;
    const occurrence = (seenSoFar.get(e.key) ?? 0) + 1;
    seenSoFar.set(e.key, occurrence);
    if (occurrence === total) continue; // the last occurrence is the one that survives — not itself an issue

    const finalValue = lastValueByKey.get(e.key)!;
    issues.push({
      id: makeIssueId(domain, filePath, "DUPLICATE_KEY", e.key, occurrence),
      type: "DUPLICATE_KEY",
      domain,
      filePath,
      sourceKey: e.key,
      currentValue: e.value,
      suggestedValue: null,
      rawLine: e.rawLine,
      line: e.lineIndex + 1,
      fixStrategy: "deterministic",
      explanation: `The key "${e.key}" appears ${total} times in this file. Only the last occurrence is actually used when the file is parsed — this earlier one is dead and confusing.`,
      suggestedFixDescription: `Remove this duplicate entry; the later occurrence (value "${finalValue}") is the one that's kept.`,
      severity: "warning",
    });
  }
  return issues;
}

// Detects the single most common JSON syntax error in this file — confirmed by
// git history (past commits titled "fix - commas missing"): a trailing comma on
// the last entry before a closing "}"/"]". V8 reports the parse error AT the
// closer's position, one line AFTER the line that actually needs the fix, so a
// naive "patch the reported line" approach (see repo-doctor.ts's llm-assisted
// path) targets the wrong line entirely for this case. Deterministic and
// doesn't need the LLM at all.
function detectTrailingCommaBeforeCloser(rawText: string, errorPosition: number): { line: number; fixedLineText: string } | null {
  const lines = rawText.split("\n");
  const errorLineIndex = lineOf(rawText, errorPosition) - 1;
  const errorLine = lines[errorLineIndex] ?? "";
  if (!/^\s*[}\]]\s*,?\s*$/.test(errorLine)) return null; // the reported line isn't just a closer

  for (let i = errorLineIndex - 1; i >= 0; i--) {
    if (lines[i].trim() === "") continue;
    if (!/,\s*$/.test(lines[i])) return null; // previous content line has no trailing comma — not this pattern
    return { line: i + 1, fixedLineText: lines[i].replace(/,\s*$/, "") };
  }
  return null;
}

function makeInvalidJsonIssue(rawText: string, err: { message: string; position: number | null }, domain: string, filePath: string): RepoIssue {
  const lines = rawText.split("\n");
  const line = err.position != null ? lineOf(rawText, err.position) : null;
  const snippet = err.position != null ? rawText.slice(Math.max(0, err.position - 60), err.position + 60) : null;

  const trailingCommaFix = err.position != null ? detectTrailingCommaBeforeCloser(rawText, err.position) : null;
  if (trailingCommaFix) {
    return {
      id: makeIssueId(domain, filePath, "INVALID_JSON", null),
      type: "INVALID_JSON",
      domain,
      filePath,
      sourceKey: null,
      currentValue: snippet,
      suggestedValue: trailingCommaFix.fixedLineText,
      rawLine: lines[trailingCommaFix.line - 1] ?? snippet,
      line: trailingCommaFix.line,
      fixStrategy: "deterministic",
      explanation: "This file isn't valid JSON: a trailing comma appears before a closing bracket.",
      suggestedFixDescription: "Remove the trailing comma on the last entry before the closing bracket.",
      severity: "error",
    };
  }

  return {
    id: makeIssueId(domain, filePath, "INVALID_JSON", null),
    type: "INVALID_JSON",
    domain,
    filePath,
    sourceKey: null,
    currentValue: snippet,
    suggestedValue: null,
    rawLine: line != null ? (lines[line - 1] ?? snippet) : snippet,
    line,
    fixStrategy: line != null ? "llm-assisted" : "manual",
    explanation: `This file isn't valid JSON: ${err.message}.`,
    suggestedFixDescription: "Needs a syntax correction (e.g. a missing/extra comma or bracket) near this location.",
    severity: "error",
  };
}

interface CanonicalEntry {
  normValue: string;
  rawValue: string;
}

function buildCanonicalMap(entries: RawEntry[]): Map<string, CanonicalEntry> {
  const map = new Map<string, CanonicalEntry>();
  for (const e of entries) {
    map.set(normalizePath(e.key), { normValue: normalizePath(e.value), rawValue: e.value });
  }
  return map;
}

// Follows a redirect chain (normalized-value -> normalized-key lookups), cycle-guarded.
// Returns the final hop's RAW (non-normalized) value so a suggested fix preserves the
// file's existing URL format (full URL vs. relative path), or null if the starting
// value isn't itself a redirect source (i.e. not chained).
function followChain(startNormVal: string, canonical: Map<string, CanonicalEntry>): string | null {
  if (!canonical.has(startNormVal)) return null;
  let currentNorm = startNormVal;
  let currentRaw: string | null = null;
  const seen = new Set<string>();
  for (let i = 0; i < 10; i++) {
    if (seen.has(currentNorm)) return currentRaw; // cycle guard
    seen.add(currentNorm);
    const hit = canonical.get(currentNorm);
    if (!hit) return currentRaw;
    currentRaw = hit.rawValue;
    if (!canonical.has(hit.normValue)) return currentRaw; // reached a terminal (non-chained) target
    currentNorm = hit.normValue;
  }
  return currentRaw;
}

export function detectIssues(rawText: string, domain: string, filePath: string): RepoIssue[] {
  const entries = parseRawEntries(rawText);
  const issues: RepoIssue[] = [];

  // Runs regardless of overall JSON validity — a raw-text/line scan, not JSON.parse.
  issues.push(...detectDuplicateKeys(entries, domain, filePath));

  const parseError = tryParseJson(rawText);
  if (parseError) {
    issues.push(makeInvalidJsonIssue(rawText, parseError, domain, filePath));
    return issues; // file structure isn't trustworthy enough for entry-level rules below
  }

  const canonical = buildCanonicalMap(entries);

  for (const entry of entries) {
    if (entry.value === "") {
      issues.push({
        id: makeIssueId(domain, filePath, "EMPTY_TARGET", entry.key),
        type: "EMPTY_TARGET",
        domain,
        filePath,
        sourceKey: entry.key,
        currentValue: entry.value,
        suggestedValue: null,
        rawLine: entry.rawLine,
        line: entry.lineIndex + 1,
        fixStrategy: "llm-assisted",
        explanation: `The redirect for "${entry.key}" has an empty target — it redirects nowhere.`,
        suggestedFixDescription: "Needs a real destination URL; none can be inferred automatically.",
        severity: "error",
      });
      continue;
    }

    if (isMalformedTarget(entry.value)) {
      // A value with no "/" anywhere (e.g. "blog.aspose.com") reads as a bare
      // hostname missing its scheme, not a relative path — prepending "/" would
      // turn it into the nonsensical path "/blog.aspose.com". Only treat it as a
      // relative path (prepend "/") when it actually contains a path segment.
      const looksLikeBareHost = !entry.value.includes("/");
      const suggested = looksLikeBareHost ? `https://${entry.value}` : "/" + entry.value.replace(/^\/+/, "");
      issues.push({
        id: makeIssueId(domain, filePath, "MALFORMED_TARGET", entry.key),
        type: "MALFORMED_TARGET",
        domain,
        filePath,
        sourceKey: entry.key,
        currentValue: entry.value,
        suggestedValue: suggested,
        rawLine: entry.rawLine,
        line: entry.lineIndex + 1,
        fixStrategy: "deterministic",
        explanation: looksLikeBareHost
          ? `The redirect target "${entry.value}" for "${entry.key}" looks like a bare hostname missing its scheme.`
          : `The redirect target "${entry.value}" for "${entry.key}" has no leading "/" and no URL scheme, so it's ambiguous as a relative path.`,
        suggestedFixDescription: looksLikeBareHost
          ? `Add the missing scheme so it reads as "${suggested}".`
          : `Prefix it with "/" so it reads as "${suggested}".`,
        severity: "warning",
      });
      continue;
    }

    const normKey = normalizePath(entry.key);
    const normVal = normalizePath(entry.value);

    if (normKey === normVal) {
      issues.push({
        id: makeIssueId(domain, filePath, "SELF_LOOP_REDIRECT", entry.key),
        type: "SELF_LOOP_REDIRECT",
        domain,
        filePath,
        sourceKey: entry.key,
        currentValue: entry.value,
        suggestedValue: null,
        rawLine: entry.rawLine,
        line: entry.lineIndex + 1,
        fixStrategy: "deterministic",
        explanation: `"${entry.key}" redirects to itself — this entry does nothing useful.`,
        suggestedFixDescription: "Remove this entry — it redirects to itself.",
        severity: "warning",
      });
      continue;
    }

    const finalRawTarget = followChain(normVal, canonical);
    if (finalRawTarget && normalizePath(finalRawTarget) !== normVal) {
      issues.push({
        id: makeIssueId(domain, filePath, "CHAINED_REDIRECT", entry.key),
        type: "CHAINED_REDIRECT",
        domain,
        filePath,
        sourceKey: entry.key,
        currentValue: entry.value,
        suggestedValue: finalRawTarget,
        rawLine: entry.rawLine,
        line: entry.lineIndex + 1,
        fixStrategy: "deterministic",
        explanation: `"${entry.key}" redirects to "${entry.value}", which is itself a redirect. This causes an extra hop for visitors.`,
        suggestedFixDescription: `Point directly to the final destination "${finalRawTarget}" instead.`,
        severity: "warning",
      });
    }
  }

  return issues;
}

// Replaces a single "key": "value" line, preserving indentation and trailing comma.
export function replaceEntryLine(rawText: string, line: number, sourceKey: string, newValue: string): string {
  const lines = rawText.split("\n");
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) throw new Error(`Line ${line} out of range.`);
  const trailingComma = /,\s*$/.test(lines[idx]) ? "," : "";
  const indentMatch = /^\s*/.exec(lines[idx]);
  const indent = indentMatch ? indentMatch[0] : "";
  lines[idx] = `${indent}"${escapeJsonString(sourceKey)}": "${escapeJsonString(newValue)}"${trailingComma}`;
  return lines.join("\n");
}

// Replaces a single raw line verbatim with LLM-corrected text (used for INVALID_JSON,
// where the fix isn't a clean key/value replacement).
export function replaceRawLine(rawText: string, line: number, newLineContent: string): string {
  const lines = rawText.split("\n");
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) throw new Error(`Line ${line} out of range.`);
  lines[idx] = newLineContent;
  return lines.join("\n");
}

function stripTrailingCommaBeforeClosingBrace(lines: string[]): void {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() !== "}") continue;
    for (let j = i - 1; j >= 0; j--) {
      if (lines[j].trim() === "") continue;
      lines[j] = lines[j].replace(/,\s*$/, "");
      break;
    }
    break;
  }
}

// Deletes a single entry line (used for SELF_LOOP_REDIRECT, DUPLICATE_KEY), stripping
// a now-dangling trailing comma if the deleted line was the object's last entry.
export function deleteEntryLine(rawText: string, line: number): string {
  const lines = rawText.split("\n");
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) throw new Error(`Line ${line} out of range.`);
  lines.splice(idx, 1);
  stripTrailingCommaBeforeClosingBrace(lines);
  return lines.join("\n");
}

export function applyDeterministicFix(rawText: string, issue: RepoIssue): string {
  switch (issue.type) {
    case "SELF_LOOP_REDIRECT":
    case "DUPLICATE_KEY":
      if (issue.line == null) throw new Error(`Issue ${issue.id} has no line reference.`);
      return deleteEntryLine(rawText, issue.line);
    case "MALFORMED_TARGET":
    case "CHAINED_REDIRECT":
      if (issue.line == null || issue.sourceKey == null || issue.suggestedValue == null) {
        throw new Error(`Issue ${issue.id} is missing data needed to apply a deterministic fix.`);
      }
      return replaceEntryLine(rawText, issue.line, issue.sourceKey, issue.suggestedValue);
    case "INVALID_JSON":
      if (issue.line == null || issue.suggestedValue == null) {
        throw new Error(`Issue ${issue.id} is missing data needed to apply a deterministic fix.`);
      }
      return replaceRawLine(rawText, issue.line, issue.suggestedValue);
    default:
      throw new Error(`applyDeterministicFix does not support issue type ${issue.type}.`);
  }
}

export function validatePatchedText(rawText: string): { ok: true } | { ok: false; error: string } {
  try {
    JSON.parse(rawText);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
