import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

export interface Issue {
  product: string;
  postFolder: string;
  file: string;
  lang: string;
  errorType: string;
  currentUrl: string;
  expectedUrl: string;
  notes: string;
  redirectRule: string;
}

export interface ScanStats {
  products: number;
  posts: number;
  files: number;
}

export type ProgressCallback = (product: string, postCount: number) => void;

const LANG_URL_ALIASES: Record<string, string> = {};

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---/;

function getUrlFromFile(filePath: string): string {
  try {
    const content = readFileSync(filePath, "utf-8");
    const fm = FRONTMATTER_RE.exec(content);
    if (!fm) return "";
    const m = /^url:\s*(.+)$/m.exec(fm[1]);
    if (!m) return "";
    return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url : url + "/";
}

function slugFromFolder(folder: string): string {
  return folder.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

function makeIssue(
  product: string,
  postFolder: string,
  file: string,
  lang: string,
  errorType: string,
  currentUrl: string,
  expectedUrl: string,
  notes = ""
): Issue {
  const redirectRule =
    currentUrl && expectedUrl && currentUrl !== expectedUrl
      ? `"${currentUrl}": "https://blog.aspose.com${expectedUrl}"`
      : "";
  return { product, postFolder, file, lang, errorType, currentUrl, expectedUrl, notes, redirectRule };
}

function validateEnglish(
  filePath: string,
  contentDir: string,
  product: string,
  postFolder: string
): { issues: Issue[]; englishUrl: string | null } {
  const url = getUrlFromFile(filePath);
  const rel = path.relative(contentDir, filePath);
  const slug = slugFromFolder(postFolder);
  const issues: Issue[] = [];

  if (!url) {
    issues.push(makeIssue(product, postFolder, rel, "en", "MISSING_URL", "", `/${product}/${slug}/`, "No url field in frontmatter"));
    return { issues, englishUrl: null };
  }

  const normalized = normalizeUrl(url);

  if (!url.endsWith("/")) {
    issues.push(makeIssue(product, postFolder, rel, "en", "MISSING_TRAILING_SLASH", url, normalized));
  }

  const parts = normalized.replace(/^\/|\/$/g, "").split("/");

  if (parts.length < 2) {
    issues.push(makeIssue(product, postFolder, rel, "en", "URL_TOO_SHORT", url, `/${product}/${slug}/`, `Expected 2 path segments, got ${parts.length}`));
    return { issues, englishUrl: null };
  }

  if (/^\/\d{4}\//.test(normalized)) {
    const dateSlug = parts[parts.length - 1] || slug;
    issues.push(makeIssue(product, postFolder, rel, "en", "DATE_BASED_URL", url, `/${product}/${dateSlug}/`, `URL uses date-based format instead of /${product}/slug/`));
    return { issues, englishUrl: normalized };
  }

  if (parts[0] !== product) {
    issues.push(makeIssue(product, postFolder, rel, "en", "WRONG_PRODUCT", url, `/${product}/${slug}/`, `URL has '/${parts[0]}/' but post is under '/${product}/'`));
  }

  return { issues, englishUrl: normalized };
}

function validateTranslated(
  filePath: string,
  contentDir: string,
  product: string,
  postFolder: string,
  lang: string,
  englishUrl: string | null
): Issue[] {
  const url = getUrlFromFile(filePath);
  const rel = path.relative(contentDir, filePath);
  const slug = slugFromFolder(postFolder);
  const urlLang = LANG_URL_ALIASES[lang] ?? lang;
  const issues: Issue[] = [];

  const expectedFallback = englishUrl
    ? `/${urlLang}${englishUrl}`
    : `/${urlLang}/${product}/${slug}/`;

  if (!url) {
    issues.push(makeIssue(product, postFolder, rel, lang, "MISSING_URL", "", expectedFallback, "No url field in frontmatter"));
    return issues;
  }

  const normalized = normalizeUrl(url);

  if (!url.endsWith("/")) {
    issues.push(makeIssue(product, postFolder, rel, lang, "MISSING_TRAILING_SLASH", url, normalized));
  }

  const parts = normalized.replace(/^\/|\/$/g, "").split("/");

  if (parts.length < 3) {
    issues.push(makeIssue(product, postFolder, rel, lang, "URL_TOO_SHORT", url, expectedFallback, `Expected 3+ path segments, got ${parts.length}`));
    return issues;
  }

  const langInUrl = parts[0];
  const prodInUrl = parts[1];
  const reportedErrors = new Set<string>();

  if (langInUrl !== urlLang) {
    issues.push(makeIssue(product, postFolder, rel, lang, "LANG_CODE_MISMATCH", url, `/${urlLang}/${product}/${slug}/`, `URL has '/${langInUrl}/' but expected '/${urlLang}/'`));
    reportedErrors.add("LANG_CODE_MISMATCH");
  }

  if (/^\d{4}$/.test(prodInUrl)) {
    const dateSlug = parts[parts.length - 1] || slug;
    issues.push(makeIssue(product, postFolder, rel, lang, "DATE_BASED_URL", url, `/${urlLang}/${product}/${dateSlug}/`, `URL uses date-based format instead of /${urlLang}/${product}/slug/`));
    reportedErrors.add("DATE_BASED_URL");
  } else if (prodInUrl !== product) {
    issues.push(makeIssue(product, postFolder, rel, lang, "WRONG_PRODUCT", url, `/${urlLang}/${product}/${slug}/`, `URL has '/${prodInUrl}/' but post is under '/${product}/'`));
    reportedErrors.add("WRONG_PRODUCT");
  }

  if (englishUrl) {
    const expectedTranslated = `/${urlLang}${englishUrl}`;
    if (normalized !== expectedTranslated && reportedErrors.size === 0) {
      issues.push(makeIssue(product, postFolder, rel, lang, "URL_MISMATCH_WITH_ENGLISH", url, expectedTranslated, "Slug differs from English base URL"));
    }
  }

  return issues;
}

function isDir(p: string): boolean {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function isFile(p: string): boolean {
  try { return statSync(p).isFile(); } catch { return false; }
}

export function scanAll(
  contentDir: string,
  onProgress?: ProgressCallback
): { issues: Issue[]; stats: ScanStats } {
  const allIssues: Issue[] = [];
  const stats: ScanStats = { products: 0, posts: 0, files: 0 };

  const productDirs = readdirSync(contentDir)
    .filter((name) => !name.startsWith("_") && isDir(path.join(contentDir, name)))
    .sort();

  stats.products = productDirs.length;

  for (const product of productDirs) {
    const productPath = path.join(contentDir, product);

    const postDirs = readdirSync(productPath)
      .filter((name) => isDir(path.join(productPath, name)))
      .sort();

    stats.posts += postDirs.length;

    for (const postFolder of postDirs) {
      const postPath = path.join(productPath, postFolder);
      const englishFile = path.join(postPath, "index.md");
      const englishExists = isFile(englishFile);
      let englishUrl: string | null = null;

      if (englishExists) {
        stats.files++;
        const { issues, englishUrl: eu } = validateEnglish(englishFile, contentDir, product, postFolder);
        allIssues.push(...issues);
        englishUrl = eu;
      }

      const translatedFiles = readdirSync(postPath)
        .filter((f) => /^index\..+\.md$/.test(f))
        .sort();

      for (const tf of translatedFiles) {
        stats.files++;
        const lang = tf.replace(/^index\./, "").replace(/\.md$/, "");
        const tfPath = path.join(postPath, tf);

        if (!englishExists) {
          allIssues.push(makeIssue(
            product, postFolder,
            path.relative(contentDir, tfPath),
            lang, "NO_ENGLISH_BASE",
            getUrlFromFile(tfPath), "",
            "No index.md found for this post"
          ));
        }

        allIssues.push(...validateTranslated(tfPath, contentDir, product, postFolder, lang, englishUrl));
      }
    }

    onProgress?.(product, postDirs.length);
  }

  return { issues: allIssues, stats };
}
