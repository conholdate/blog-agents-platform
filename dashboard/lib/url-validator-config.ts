// Converts a domain key to an env var suffix.
// "blog.aspose.com" → "ASPOSE_COM"
// "blog.groupdocs.cloud" → "GROUPDOCS_CLOUD"
export function domainToEnvKey(domain: string): string {
  return domain.replace(/^blog\./, "").replace(/[\.\-]/g, "_").toUpperCase();
}

export function getUrlValidatorSheetId(domain: string): string | null {
  return process.env[`URL_VALIDATOR_SHEET_ID_${domainToEnvKey(domain)}`] ?? null;
}

export function getUrlValidatorContentDir(domain: string): string | null {
  const perDomain = process.env[`URL_VALIDATOR_CONTENT_DIR_${domainToEnvKey(domain)}`];
  if (perDomain) return perDomain;
  // Fallback: the legacy BLOG_CONTENT_DIR was set up for blog.aspose.com
  if (domain === "blog.aspose.com") return process.env.BLOG_CONTENT_DIR ?? null;
  return null;
}
