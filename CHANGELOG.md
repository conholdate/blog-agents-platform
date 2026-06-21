# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- **Translation Agent** dashboard screen — reads the consolidated translation scan sheet (one tab per domain + a shared `history` tab): "Missing Translations" view (post, author, missing/extra language chips) and a "History" view (`pending`/`partial`/`completed` status per post), with product/language filters, search, and sortable columns
- Translation Agent card on the Overview "This Domain" view and a Translations column group on the "All Domains" table
- GitHub Actions workflow (`.github/workflows/url-validator.yml`) to run URL Validator on a daily schedule or on demand, across all 6 domains via a matrix job that checks out each domain's content repo
- `--domain` flag on the url-validator CLI to select one of the 6 supported domains, resolving content dir and sheet ID from per-domain env vars instead of manual swapping
- Consolidated spreadsheet mode (`URL_VALIDATOR_SPREADSHEET_ID`): one persistent tab per domain, updated in place each run instead of creating new dated tabs, plus a shared `History` tab with one summary row per run
- `--prepare-sheet` flag to idempotently create the consolidated spreadsheet's domain tabs + History tab ahead of the first real run
- Dashboard URL Validator screen now reads and writes the consolidated spreadsheet when `URL_VALIDATOR_SPREADSHEET_ID` is set (results, summary, status, and the "Run Scan" trigger), matching the CLI/CI behavior instead of the legacy per-domain dated tabs
- "Open Sheet" links deep-link to the active domain's tab (`#gid=`) instead of the spreadsheet root
- CI workflow (`.github/workflows/ci.yml`) running `pytest`, `eslint`, and `tsc` on every push/PR to main
- Retry with exponential backoff on Sheets writes (Python CLI and TS dashboard), and server-side validation of keyword brief `status` values against `STATUS_OPTIONS`

### Fixed
- Overview "All Domains" view showing no data in production — `/api/overview/all` was self-fetching its own API routes via `NEXT_PUBLIC_BASE_URL`, which falls back to `http://localhost:3000` when unset; that fallback doesn't exist inside a Vercel serverless function, so every sub-fetch failed silently and every domain rendered blank. Each tool's summary logic was extracted into a shared `lib` function (`getKeywordSummary`, `getOptimizationSummary`, `getUrlValidatorSummary`, `getTranslationSummary`) and `/api/overview/all` now calls them in-process instead — no HTTP round trip, works identically in dev and production
- 4 stale url-validator tests asserting the old `/zh-tw/` URL prefix for zh-hant content, instead of the current `/zh-hant/` prefix the site actually uses
- All 7 dashboard ESLint errors and 3 warnings (dead code, `let`/`const`, justified effect patterns)
- `pytest` was missing from `requirements.txt` entirely (only ever installed ad-hoc locally)

---

## [0.6.0] — 2026-06-05

### Added
- All-domains overview stats on the Overview section (live data across all 6 domains)

### Changed
- Server-side cache TTL increased for better performance under repeated loads
- Optimization Agent UI and priority logic improvements

---

## [0.5.0] — 2026-06-04

### Added
- **Optimization Agent** — live SEO optimization queue with priority scoring, per-product/URL filters, and optimized posts log

### Changed
- Priority formula improved for more accurate ranking
- Default row ordering restored to original sheet sequence

---

## [0.4.0] — 2026-05-22

### Added
- Generated Blog Posts tab in Keyword Agent — compact tile grid view

### Changed
- Keyword card visual polish — score color coding per threshold band
- Compact card grid layout improvements
- Keywords auto-sorted by score on load (manual reordering removed)
- Updated column structure for keyword agent sheet

---

## [0.3.0] — 2026-05-15

### Added
- Server-side in-memory cache with manual Refresh buttons per section
- Agent metrics logging after each URL Validator scan

### Changed
- URL Validator UI — updated theme, brand logos, colour-coded results
- Sections renamed from "editors" to "agents"; Post Generation Agent placeholder added
- `SHEET_ID_*` env vars renamed to `KEYWORD_AGENT_SHEET_ID_*` across all domains
- noindex/nofollow meta tags added to prevent search engine indexing
- Removed `zh-hant` language alias from URL Validator rules

### Fixed
- Stale env var hint text in URL Validator UI

---

## [0.2.0] — 2026-05-07

### Added
- **URL Validator** integrated into dashboard UI — run scans and view colour-coded results per domain
- Brand logo assets in dashboard header

### Changed
- Renamed "Keywords Editor" to "Blog Team Dashboard"
- Redirect rules and bug fixes across sections
- Full pytest test suite for URL Validator (`test_main.py`)

---

## [0.1.1] — 2026-04-22

### Added
- `url-validator/` — standalone Python 3 CLI for scanning blog post frontmatter
  - Detects 8 URL error types (`MISSING_URL`, `MISSING_TRAILING_SLASH`, `WRONG_PRODUCT`, `DATE_BASED_URL`, `URL_TOO_SHORT`, `LANG_CODE_MISMATCH`, `URL_MISMATCH_WITH_ENGLISH`, `NO_ENGLISH_BASE`)
  - Writes colour-coded report to Google Sheets (daily tab + summary tab)
  - Terminal progress output during scan
  - `VALIDATION_RULES.md` documenting all rules

---

## [0.1.0] — 2026-04-15

### Added
- Initial monorepo structure: `dashboard/` + `url-validator/`
- **Blog Team Dashboard** — Keyword Agent section
  - Google Sheets API v4 integration via service account
  - Multi-domain support — 6 brand domains (Aspose, GroupDocs, Conholdate + Cloud variants)
  - Product tab bar per domain
  - Collapsible keyword brief cards with platform-coloured banners
  - PIN-protected edit drawer (RowDrawer) with batch cell update
  - Row reordering (Save Order / Discard) via `batchUpdate`
  - Mobile-responsive layout with hamburger sidebar
  - Domain switcher with race condition fix for fast switching
  - "Open Sheet" direct link from the tab bar
  - Dark theme shell (slate-800 page, slate-900 header)

[Unreleased]: https://github.com/conholdate/blog-agents-platform/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/conholdate/blog-agents-platform/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/conholdate/blog-agents-platform/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/conholdate/blog-agents-platform/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/conholdate/blog-agents-platform/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/conholdate/blog-agents-platform/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/conholdate/blog-agents-platform/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/conholdate/blog-agents-platform/releases/tag/v0.1.0
