import { describe, it, expect } from "vitest";
import {
  detectIssues,
  normalizePath,
  applyDeterministicFix,
  validatePatchedText,
  replaceEntryLine,
  deleteEntryLine,
  replaceRawLine,
} from "./detect";
import type { RepoIssue } from "./types";

const DOMAIN = "blog.aspose.com";
const FILE = "Redirects.json";

describe("normalizePath", () => {
  it("strips scheme+host, adds leading slash, drops trailing slash, lowercases", () => {
    expect(normalizePath("https://blog.aspose.com/PDF/Convert/")).toBe("/pdf/convert");
    expect(normalizePath("/pdf/convert")).toBe("/pdf/convert");
    expect(normalizePath("pdf/convert")).toBe("/pdf/convert");
    expect(normalizePath("/")).toBe("/");
  });
});

describe("detectIssues", () => {
  it("finds an empty target (real aspose-blog shape)", () => {
    const raw = `{
  "/pdf/convert-pdf-document-to-jpg-images-in-php-application.html": ""
}`;
    const issues = detectIssues(raw, DOMAIN, FILE);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: "EMPTY_TARGET",
      sourceKey: "/pdf/convert-pdf-document-to-jpg-images-in-php-application.html",
      fixStrategy: "llm-assisted",
      line: 2,
      rawLine: '  "/pdf/convert-pdf-document-to-jpg-images-in-php-application.html": ""',
    });
  });

  it("finds a malformed relative target missing a leading slash (real aspose-blog shape)", () => {
    const raw = `{
  "/email/parse-outlook-pst-files-in-python/2": "email/parse-outlook-pst-files-in-python/2"
}`;
    const issues = detectIssues(raw, DOMAIN, FILE);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: "MALFORMED_TARGET",
      sourceKey: "/email/parse-outlook-pst-files-in-python/2",
      suggestedValue: "/email/parse-outlook-pst-files-in-python/2",
      fixStrategy: "deterministic",
    });
  });

  it("suggests adding a scheme (not a leading slash) for a bare-hostname malformed target", () => {
    const raw = `{
  "/wp-content": "blog.aspose.com"
}`;
    const issues = detectIssues(raw, DOMAIN, FILE);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: "MALFORMED_TARGET",
      suggestedValue: "https://blog.aspose.com",
    });
  });

  it("finds a self-loop redirect", () => {
    const raw = `{
  "/vi/words/convert-doc-to-markdown-in-java/": "/vi/words/convert-doc-to-markdown-in-java/"
}`;
    const issues = detectIssues(raw, DOMAIN, FILE);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ type: "SELF_LOOP_REDIRECT", fixStrategy: "deterministic" });
  });

  it("finds a self-loop even when scheme/host differ from the key", () => {
    const raw = `{
  "/ja/categories/aspose.words-product-family/": "https://blog.aspose.com/ja/categories/aspose.words-product-family/"
}`;
    const issues = detectIssues(raw, DOMAIN, FILE);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("SELF_LOOP_REDIRECT");
  });

  it("finds a 2-hop chained redirect and suggests the final raw target", () => {
    const raw = `{
  "/barcode/pl/generate-upc-barcode-in-python": "/pl/barcode/generate-upc-barcode-in-python/",
  "/pl/barcode/generate-upc-barcode-in-python/": "https://blog.aspose.com/barcode/generate-upc-barcode-in-python/"
}`;
    const issues = detectIssues(raw, DOMAIN, FILE);
    const chained = issues.find((i) => i.sourceKey === "/barcode/pl/generate-upc-barcode-in-python");
    expect(chained).toMatchObject({
      type: "CHAINED_REDIRECT",
      suggestedValue: "https://blog.aspose.com/barcode/generate-upc-barcode-in-python/",
      fixStrategy: "deterministic",
    });
    // the second entry points straight at a non-chained terminal target — not itself an issue
    expect(issues.find((i) => i.sourceKey === "/pl/barcode/generate-upc-barcode-in-python/")).toBeUndefined();
  });

  it("flags every occurrence but the last as a duplicate key, even across otherwise-valid JSON", () => {
    const raw = `{
  "/a/": "/first/",
  "/b/": "/only/",
  "/a/": "/second/"
}`;
    const issues = detectIssues(raw, DOMAIN, FILE);
    const dupes = issues.filter((i) => i.type === "DUPLICATE_KEY");
    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({ sourceKey: "/a/", currentValue: "/first/", line: 2 });
    expect(dupes[0].suggestedFixDescription).toMatch(/second/);
  });

  it("detects a trailing comma before the closing brace as a DETERMINISTIC fix, targeting the entry line (not the brace line)", () => {
    // Real-world shape: V8 reports the parse error at the "}" line, one line
    // after the actual entry with the dangling comma — confirmed live against
    // aspose-blog/Redirects.json, which has exactly this bug.
    const raw = `{
  "/a/": "/b/",
  "/c/": "/d/",
}`;
    const issues = detectIssues(raw, DOMAIN, FILE);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: "INVALID_JSON",
      fixStrategy: "deterministic",
      line: 3, // the "/c/": "/d/", line — not line 4, the closing brace
      suggestedValue: `  "/c/": "/d/"`,
      rawLine: `  "/c/": "/d/",`, // the ORIGINAL line, comma still present — distinct from suggestedValue
    });
  });

  it("falls back to llm-assisted for a JSON syntax error that isn't a trailing-comma-before-closer", () => {
    const raw = `{
  "/a/" "/b/"
}`;
    const issues = detectIssues(raw, DOMAIN, FILE);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("INVALID_JSON");
    expect(issues[0].fixStrategy).toBe("llm-assisted");
  });

  it("returns no issues for a clean file", () => {
    const raw = `{
  "/pdf/convert": "https://blog.aspose.com/pdf/convert-final/",
  "/words/convert": "https://blog.aspose.com/words/convert-final/"
}`;
    expect(detectIssues(raw, DOMAIN, FILE)).toHaveLength(0);
  });
});

describe("applyDeterministicFix + validatePatchedText", () => {
  function findIssue(raw: string, type: RepoIssue["type"]): RepoIssue {
    const issue = detectIssues(raw, DOMAIN, FILE).find((i) => i.type === type);
    if (!issue) throw new Error(`No ${type} issue found in fixture`);
    return issue;
  }

  it("deletes a self-loop line and keeps the file valid", () => {
    const raw = `{
  "/a/": "/keep/",
  "/loop/": "/loop/"
}`;
    const issue = findIssue(raw, "SELF_LOOP_REDIRECT");
    const patched = applyDeterministicFix(raw, issue);
    expect(validatePatchedText(patched)).toEqual({ ok: true });
    expect(JSON.parse(patched)).toEqual({ "/a/": "/keep/" });
  });

  it("deletes the LAST entry's self-loop and strips the now-dangling trailing comma", () => {
    const raw = `{
  "/loop/": "/loop/",
  "/a/": "/keep/",
  "/last-loop/": "/last-loop/"
}`;
    const issue = detectIssues(raw, DOMAIN, FILE).find((i) => i.sourceKey === "/last-loop/")!;
    const patched = applyDeterministicFix(raw, issue);
    expect(validatePatchedText(patched)).toEqual({ ok: true });
    expect(JSON.parse(patched)).toEqual({ "/loop/": "/loop/", "/a/": "/keep/" });
  });

  it("rewrites a malformed target with a leading slash", () => {
    const raw = `{
  "/email/x": "email/x"
}`;
    const issue = findIssue(raw, "MALFORMED_TARGET");
    const patched = applyDeterministicFix(raw, issue);
    expect(validatePatchedText(patched)).toEqual({ ok: true });
    expect(JSON.parse(patched)).toEqual({ "/email/x": "/email/x" });
  });

  it("rewrites a chained redirect to point at the final target", () => {
    const raw = `{
  "/a/": "/b/",
  "/b/": "https://blog.aspose.com/final/"
}`;
    const issue = findIssue(raw, "CHAINED_REDIRECT");
    const patched = applyDeterministicFix(raw, issue);
    expect(validatePatchedText(patched)).toEqual({ ok: true });
    expect(JSON.parse(patched)).toEqual({ "/a/": "https://blog.aspose.com/final/", "/b/": "https://blog.aspose.com/final/" });
  });

  it("deterministically fixes a trailing comma before the closing brace", () => {
    const raw = `{
  "/a/": "/b/",
  "/c/": "/d/",
}`;
    const issue = findIssue(raw, "INVALID_JSON");
    const patched = applyDeterministicFix(raw, issue);
    expect(validatePatchedText(patched)).toEqual({ ok: true });
    expect(JSON.parse(patched)).toEqual({ "/a/": "/b/", "/c/": "/d/" });
  });

  it("produces a minimal one-line diff, not a full re-serialize", () => {
    const raw = `{
  "/a/": "/keep-as-is/",
  "/loop/": "/loop/",
  "/z/": "/also-keep/"
}`;
    const issue = findIssue(raw, "SELF_LOOP_REDIRECT");
    const patched = applyDeterministicFix(raw, issue);
    const originalLines = raw.split("\n");
    const patchedLines = patched.split("\n");
    // one line removed, everything else byte-identical
    expect(patchedLines).toHaveLength(originalLines.length - 1);
    expect(patchedLines[0]).toBe(originalLines[0]);
    expect(patchedLines[1]).toBe(originalLines[1]);
  });
});

describe("replaceEntryLine / replaceRawLine / deleteEntryLine (llm-assisted fix primitives)", () => {
  it("replaceEntryLine preserves indentation and trailing comma", () => {
    const raw = `{
  "/a/": "",
  "/b/": "/keep/"
}`;
    const patched = replaceEntryLine(raw, 2, "/a/", "/filled-in/");
    expect(validatePatchedText(patched)).toEqual({ ok: true });
    expect(JSON.parse(patched)).toEqual({ "/a/": "/filled-in/", "/b/": "/keep/" });
  });

  it("replaceRawLine can fix a missing-comma syntax error", () => {
    const raw = `{
  "/a/": "/b/"
  "/c/": "/d/"
}`;
    expect(validatePatchedText(raw).ok).toBe(false);
    const patched = replaceRawLine(raw, 2, `  "/a/": "/b/",`);
    expect(validatePatchedText(patched)).toEqual({ ok: true });
  });

  it("deleteEntryLine rejects an out-of-range line", () => {
    expect(() => deleteEntryLine("{}", 99)).toThrow();
  });
});
