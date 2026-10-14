import { getCached, setCached, TTL_REPO_DOCTOR_SITEMAP } from "@/lib/cache";

// Words that appear in almost every legacy source path (old WordPress-era
// "/aspose-products/<family>/archive/<date>/..." keys) or carry no topic, so
// matching on them would rank every post equally.
const STOPWORDS = new Set([
  "a", "an", "and", "the", "of", "in", "on", "for", "with", "to", "by", "from", "using", "via", "your", "how",
  "html", "htm", "php5", "aspx", "archive", "archives", "aspose", "groupdocs", "conholdate", "products", "product",
  "family", "blog", "post", "posts", "application", "applications", "document", "documents", "file", "files",
]);

const SYNONYMS: Record<string, string> = { jpeg: "jpg", image: "images", net: "dotnet", csharp: "dotnet", cs: "dotnet" };

export function tokenize(path: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of path.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || /^\d+$/.test(raw) || STOPWORDS.has(raw)) continue;
    tokens.add(SYNONYMS[raw] ?? raw);
  }
  return tokens;
}

// Hugo's English sitemap lists posts as "https://<domain>/<category>/<slug>/";
// anything else (home, pagination, archive/search pages, odd legacy shapes) isn't
// a post a redirect should land on.
export function extractPostUrls(sitemapXml: string, domain: string): string[] {
  const urls: string[] = [];
  for (const m of sitemapXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    let url: URL;
    try {
      url = new URL(m[1]);
    } catch {
      continue;
    }
    if (url.hostname !== domain) continue;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 2 || segments[0] === "page" || /^\d+$/.test(segments[1])) continue;
    urls.push(url.toString());
  }
  return urls;
}

export async function fetchPostUrls(domain: string): Promise<string[]> {
  const key = `repo-doctor:sitemap:${domain}`;
  const cached = getCached<string[]>(key, TTL_REPO_DOCTOR_SITEMAP);
  if (cached) return cached;

  const res = await fetch(`https://${domain}/en/sitemap.xml`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Sitemap for ${domain} returned HTTP ${res.status}.`);
  const urls = extractPostUrls(await res.text(), domain);
  setCached(key, urls);
  return urls;
}

// Ranks live posts by how many topic words they share with the dead source path,
// so the LLM only ever chooses among real URLs instead of inventing a slug.
export function shortlistCandidates(sourceKey: string, postUrls: string[], limit = 20): string[] {
  const wanted = tokenize(sourceKey);
  if (wanted.size === 0) return [];

  const scored: { url: string; score: number }[] = [];
  for (const url of postUrls) {
    const have = tokenize(new URL(url).pathname);
    let score = 0;
    for (const t of wanted) if (have.has(t)) score++;
    if (score > 0) scored.push({ url, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.url);
}
