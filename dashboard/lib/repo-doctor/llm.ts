import OpenAI from "openai";
import type { RepoIssue } from "./types";

// Internal OpenAI-API-compatible gateway ("Professionalize"), same env var
// convention used by blog-translation-agent (a separate Python repo) — only the
// gateway convention is reused here, not its code.
let cachedClient: OpenAI | null | undefined;

function getLlmClient(): OpenAI | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.PROFESSIONALIZE_API_KEY;
  const baseURL = process.env.PROFESSIONALIZE_BASE_URL;
  cachedClient = apiKey && baseURL ? new OpenAI({ apiKey, baseURL }) : null;
  return cachedClient;
}

export function isLlmConfigured(): boolean {
  return getLlmClient() != null;
}

function getModel(): string {
  return process.env.PROFESSIONALIZE_LLM_MODEL ?? "gpt-4o-mini";
}

// The LLM never decides *whether* something is an issue — detection is 100%
// deterministic (lib/repo-doctor/detect.ts). It only phrases an already-detected
// issue in plain English, and (for llm-assisted fix strategies) drafts literal
// replacement text, which the caller always re-validates before ever committing.

export async function explainIssue(
  issue: RepoIssue,
  context: string
): Promise<{ explanation: string; suggestedFixDescription: string }> {
  const client = getLlmClient();
  if (!client) {
    // Degrade to the rule-based defaults already on the issue — LLM only enriches wording.
    return { explanation: issue.explanation, suggestedFixDescription: issue.suggestedFixDescription };
  }

  try {
    const res = await client.chat.completions.create({
      model: getModel(),
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You explain data-quality issues in a redirects config file to a non-technical blog team member. " +
            "You are given an issue that has ALREADY been detected by rule-based logic — you never decide what " +
            "counts as an issue, only phrase it clearly. Reply with a JSON object: " +
            '{"explanation": "one or two plain-English sentences describing the problem", ' +
            '"suggestedFixDescription": "one short sentence describing the fix in plain English, e.g. \'remove the extra comma in the last entry\'"}. ' +
            "No markdown, no extra commentary — JSON only.",
        },
        {
          role: "user",
          content: `Issue type: ${issue.type}\nSource key: ${issue.sourceKey ?? "(file-level)"}\nCurrent value: ${issue.currentValue ?? "(none)"}\nSuggested value: ${issue.suggestedValue ?? "(none computed)"}\nSurrounding context:\n${context}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) return { explanation: issue.explanation, suggestedFixDescription: issue.suggestedFixDescription };

    const parsed = JSON.parse(raw) as { explanation?: string; suggestedFixDescription?: string };
    return {
      explanation: parsed.explanation?.trim() || issue.explanation,
      suggestedFixDescription: parsed.suggestedFixDescription?.trim() || issue.suggestedFixDescription,
    };
  } catch {
    // Any gateway/parse failure degrades to the rule-based defaults — never blocks the scan.
    return { explanation: issue.explanation, suggestedFixDescription: issue.suggestedFixDescription };
  }
}

// Only called for fixStrategy: "llm-assisted" issues (INVALID_JSON, EMPTY_TARGET).
// Returns null if the LLM can't propose safe replacement text (or isn't configured) —
// callers must treat that as "no fix available", never fall back to guessing.
export async function proposeFixText(issue: RepoIssue, context: string): Promise<string | null> {
  const client = getLlmClient();
  if (!client) return null;

  const instructions =
    issue.type === "INVALID_JSON"
      ? "The file has a JSON syntax error at this line. Reply with a JSON object " +
        '{"fixedLine": "the corrected single line of raw JSON text, exactly as it should appear in the file"}. ' +
        "Fix only the syntax problem (e.g. a missing/extra comma or quote) — do not change any key or value content. JSON only, no markdown."
      : "This redirect entry has an empty target. Reply with a JSON object " +
        '{"targetUrl": "a single proposed destination URL or path for this redirect, or null if none can be confidently inferred"}. ' +
        "Only propose a value if you can infer a highly plausible destination from the source key and surrounding entries — otherwise use null. JSON only, no markdown.";

  try {
    const res = await client.chat.completions.create({
      model: getModel(),
      temperature: 0,
      messages: [
        { role: "system", content: instructions },
        {
          role: "user",
          content: `Issue type: ${issue.type}\nSource key: ${issue.sourceKey ?? "(file-level)"}\nCurrent value: ${issue.currentValue ?? "(none)"}\nSurrounding context:\n${context}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fixedLine?: string | null; targetUrl?: string | null };
    const value = issue.type === "INVALID_JSON" ? parsed.fixedLine : parsed.targetUrl;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}
