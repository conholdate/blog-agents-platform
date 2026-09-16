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
  return process.env[`URL_VALIDATOR_CONTENT_DIR_${domainToEnvKey(domain)}`] ?? null;
}

// Single consolidated spreadsheet (one persistent tab per domain + a History tab) — takes
// over from the legacy per-domain spreadsheets whenever it's configured. Same env var name
// as the url-validator CLI's url-validator/.env, kept consistent across both.
export function getUrlValidatorConsolidatedSpreadsheetId(): string | null {
  return process.env.URL_VALIDATOR_SPREADSHEET_ID ?? null;
}
